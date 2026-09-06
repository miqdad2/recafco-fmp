import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateContractClaimDto } from './dto/create-contract-claim.dto';
import type { UpdateContractClaimDto } from './dto/update-contract-claim.dto';
import type { ContractClaimListQueryDto } from './dto/contract-claim-list-query.dto';
import { logContractActivity } from './contract-activity-log';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Prisma Decimal | number | null -> plain number | null, without importing the Decimal type directly. */
function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

/**
 * Statuses that exclude a claim from overdue-tracking — a claim that has
 * reached a concluded/withdrawn state stops accruing overdue days. APPROVED
 * is deliberately NOT included here: an approved claim can still be overdue
 * if the follow-up action (e.g. payment) hasn't happened by the due date.
 */
const OVERDUE_EXCLUDED_STATUSES = ['SETTLED', 'CLOSED', 'CANCELLED', 'REJECTED'];

/**
 * "Final" statuses for the Open Claims summary count — a claim is no longer
 * "open" once a decision or conclusion has been reached, even if it's still
 * technically overdue (e.g. APPROVED but not yet paid). Distinct from
 * OVERDUE_EXCLUDED_STATUSES on purpose — see the note above.
 */
const FINAL_STATUSES = ['APPROVED', 'REJECTED', 'SETTLED', 'CLOSED', 'CANCELLED'];

/** Statuses counted under the "Closed / Settled Claims" summary card. */
const CLOSED_OR_SETTLED_STATUSES = ['CLOSED', 'SETTLED'];

/**
 * CM-61 — statuses excluded from the Outstanding Value summary total. A
 * rejected or cancelled claim has no real balance still pending — before
 * this fix, computeClaimSummary() summed every row's submittedValue minus
 * approvedValue unconditionally, so a fully-rejected claim (e.g. submitted
 * 8,000, approved 0) still added its full 8,000 to the aggregate Outstanding
 * Value shown on both the module-level Claim Log and the Contract Detail
 * Claims tab, overstating real exposure. Deliberately narrower than
 * OVERDUE_EXCLUDED_STATUSES/CLOSED_OR_SETTLED_STATUSES — SETTLED/CLOSED are
 * NOT included here; a settled claim can genuinely still carry a real
 * outstanding balance (e.g. settled at a value not yet paid), so their
 * contribution is left exactly as it already was. Per-row outstandingValue
 * (computeOutstandingValue(), returned on every claim and shown in its own
 * table column) is intentionally NOT changed by this — that stays the raw,
 * unfiltered submitted-minus-approved delta for audit-trail honesty; only
 * the aggregate SUM excludes these two statuses.
 */
const OUTSTANDING_EXCLUDED_STATUSES = ['REJECTED', 'CANCELLED'];

/** Statuses that auto-set closedDate when reached without an explicit value. */
const AUTO_CLOSE_DATE_STATUSES = ['CLOSED', 'SETTLED'];

// ---------------------------------------------------------------------------
// Derived values — never stored, always computed from the current row.
// outstandingValue = submittedValue - approvedValue (null when neither is set).
// overdueDays = today - dueDate, only when status isn't SETTLED/CLOSED/
// CANCELLED/REJECTED and dueDate has passed.
// ---------------------------------------------------------------------------

interface ValueFields {
  submittedValue: unknown;
  approvedValue: unknown;
}

interface OverdueFields {
  dueDate: Date | null;
  status: string;
}

export function computeOutstandingValue(row: ValueFields): number | null {
  const submitted = toNum(row.submittedValue);
  if (submitted === null) return null;
  const approved = toNum(row.approvedValue) ?? 0;
  return round3(submitted - approved);
}

export function computeClaimOverdueDays(row: OverdueFields, today: Date = utcToday()): number | null {
  if (OVERDUE_EXCLUDED_STATUSES.includes(row.status)) return null;
  if (!row.dueDate) return null;
  const due = new Date(Date.UTC(row.dueDate.getUTCFullYear(), row.dueDate.getUTCMonth(), row.dueDate.getUTCDate()));
  if (due >= today) return null;
  return Math.round((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeClaimIsOverdue(row: OverdueFields, today: Date = utcToday()): boolean {
  return computeClaimOverdueDays(row, today) !== null;
}

/**
 * CM-61 — signed days until dueDate (negative once past due), for the
 * approved design's "Days to Deadline" table column. Unlike
 * computeClaimOverdueDays() (unsigned, status-gated, only ever non-null once
 * actually overdue), this is a neutral, always-present-when-dueDate-exists
 * value — never gated by status, so a manager can see how far past/before a
 * deadline any claim is regardless of its current state. null only when
 * dueDate itself is unset (never a fabricated number).
 */
export function computeClaimDaysToDeadline(row: { dueDate: Date | null }, today: Date = utcToday()): number | null {
  if (!row.dueDate) return null;
  const due = new Date(Date.UTC(row.dueDate.getUTCFullYear(), row.dueDate.getUTCMonth(), row.dueDate.getUTCDate()));
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function withDerivedFields<T extends ValueFields & OverdueFields>(
  row: T,
  today: Date,
): T & { outstandingValue: string | null; overdueDays: number | null; isOverdue: boolean; daysToDeadline: number | null } {
  const outstanding = computeOutstandingValue(row);
  return {
    ...row,
    outstandingValue: outstanding !== null ? outstanding.toFixed(3) : null,
    overdueDays: computeClaimOverdueDays(row, today),
    isOverdue: computeClaimIsOverdue(row, today),
    daysToDeadline: computeClaimDaysToDeadline(row, today),
  };
}

// ---------------------------------------------------------------------------
// Cross-field validation
// ---------------------------------------------------------------------------

export function assertClaimValuesValid(effective: {
  submittedValue?: number | null | undefined;
  approvedValue?: number | null | undefined;
}): void {
  if (
    effective.approvedValue !== undefined &&
    effective.approvedValue !== null &&
    effective.submittedValue !== undefined &&
    effective.submittedValue !== null &&
    effective.approvedValue > effective.submittedValue
  ) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_CLAIM_APPROVED_EXCEEDS_SUBMITTED',
      message: 'Approved Value cannot exceed Submitted Value.',
    });
  }
}

export function assertClaimDatesValid(effective: {
  claimDate: Date | null | undefined;
  dueDate: Date | null | undefined;
}): void {
  if (effective.dueDate && effective.claimDate && effective.dueDate < effective.claimDate) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_CLAIM_DUE_BEFORE_CLAIM_DATE',
      message: 'Due Date cannot be before Claim Date.',
    });
  }
}

/**
 * closedDate resolution: an explicit dto value always wins; otherwise, if the
 * effective status is CLOSED/SETTLED and there's no closed date yet, it's
 * auto-set to today (never invented for any other status). Returns undefined
 * when the field should be left untouched.
 */
export function resolveClaimClosedDate(
  effectiveStatus: string | undefined,
  dtoClosedDate: string | undefined,
  existingClosedDate: Date | null,
  today: Date = utcToday(),
): Date | undefined {
  if (dtoClosedDate !== undefined) return new Date(dtoClosedDate);
  if (effectiveStatus && AUTO_CLOSE_DATE_STATUSES.includes(effectiveStatus) && !existingClosedDate) {
    return today;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Module-level list where builder (exported for tests) — claim-own filters
// only. Department scope and any explicit contract-level filters are combined
// in via a nested `contract: {...}` AND clause by findAll().
// ---------------------------------------------------------------------------

export function buildClaimListWhere(query: ContractClaimListQueryDto, today: Date = utcToday()): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];

  if (query.contractId) where['contractId'] = query.contractId;

  if (query.status) and.push({ status: query.status });
  if (query.claimType) and.push({ claimType: query.claimType });
  if (query.responsibleUserId) and.push({ responsibleUserId: query.responsibleUserId });

  if (query.claimDateFrom || query.claimDateTo) {
    and.push({
      claimDate: {
        ...(query.claimDateFrom ? { gte: new Date(query.claimDateFrom) } : {}),
        ...(query.claimDateTo ? { lte: new Date(query.claimDateTo) } : {}),
      },
    });
  }

  if (query.dueDateFrom || query.dueDateTo) {
    and.push({
      dueDate: {
        ...(query.dueDateFrom ? { gte: new Date(query.dueDateFrom) } : {}),
        ...(query.dueDateTo ? { lte: new Date(query.dueDateTo) } : {}),
      },
    });
  }

  if (query.overdueOnly) {
    and.push({ dueDate: { lt: today } });
    if (!query.status) {
      and.push({ status: { notIn: OVERDUE_EXCLUDED_STATUSES } });
    }
  }

  const contractWhere: Record<string, unknown> = {};
  if (query.departmentId) contractWhere['departmentId'] = query.departmentId;
  if (query.ownerUserId) contractWhere['ownerUserId'] = query.ownerUserId;
  if (Object.keys(contractWhere).length > 0) {
    and.push({ contract: contractWhere });
  }

  if (query.search?.trim()) {
    const s = query.search.trim();
    and.push({
      OR: [
        { claimNo: { contains: s, mode: 'insensitive' } },
        { claimTitle: { contains: s, mode: 'insensitive' } },
        { contract: { referenceNumber: { contains: s, mode: 'insensitive' } } },
        { contract: { title: { contains: s, mode: 'insensitive' } } },
        { contract: { counterpartyName: { contains: s, mode: 'insensitive' } } },
      ],
    });
  }

  if (and.length > 0) where['AND'] = and;
  return where;
}

export interface ClaimSummary {
  openClaims: number;
  totalSubmittedValue: string;
  totalApprovedValue: string;
  totalOutstandingValue: string;
  overdueClaims: number;
  closedOrSettledClaims: number;
  totalEotClaimedDays: number;
  totalEotApprovedDays: number;
}

interface EotFields {
  // Optional — contract-dashboard.service.ts's own DashboardClaimRow feeds
  // computeClaimSummary() for openClaims/overdueClaims only (it never reads
  // totalEotClaimedDays/totalEotApprovedDays), so it doesn't select these
  // two columns. toEotDays() below treats an absent field the same as a
  // real 0, so that caller's totals are simply never read, never wrong.
  eotClaimedDays?: unknown;
  eotApprovedDays?: unknown;
}

/** Prisma Decimal | number | null -> plain number, defaulting to 0 for an unset EOT day count. */
function toEotDays(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return toNum(value) ?? 0;
}

export function computeClaimSummary(
  rows: (ValueFields & OverdueFields & EotFields)[],
  today: Date = utcToday(),
): ClaimSummary {
  let openClaims = 0;
  let totalSubmittedValue = 0;
  let totalApprovedValue = 0;
  let totalOutstandingValue = 0;
  let overdueClaims = 0;
  let closedOrSettledClaims = 0;
  let totalEotClaimedDays = 0;
  let totalEotApprovedDays = 0;

  for (const row of rows) {
    if (!FINAL_STATUSES.includes(row.status)) openClaims += 1;
    totalSubmittedValue += toNum(row.submittedValue) ?? 0;
    totalApprovedValue += toNum(row.approvedValue) ?? 0;
    if (!OUTSTANDING_EXCLUDED_STATUSES.includes(row.status)) {
      totalOutstandingValue += computeOutstandingValue(row) ?? 0;
    }
    if (computeClaimIsOverdue(row, today)) overdueClaims += 1;
    if (CLOSED_OR_SETTLED_STATUSES.includes(row.status)) closedOrSettledClaims += 1;
    totalEotClaimedDays += toEotDays(row.eotClaimedDays);
    totalEotApprovedDays += toEotDays(row.eotApprovedDays);
  }

  return {
    openClaims,
    totalSubmittedValue: round3(totalSubmittedValue).toFixed(3),
    totalApprovedValue: round3(totalApprovedValue).toFixed(3),
    totalOutstandingValue: round3(totalOutstandingValue).toFixed(3),
    overdueClaims,
    closedOrSettledClaims,
    totalEotClaimedDays,
    totalEotApprovedDays,
  };
}

// ---------------------------------------------------------------------------
// Prisma select shapes
// ---------------------------------------------------------------------------

const CLAIM_SELECT = {
  id: true,
  contractId: true,
  claimNo: true,
  claimTitle: true,
  claimType: true,
  eventDate: true,
  claimDate: true,
  status: true,
  submittedValue: true,
  approvedValue: true,
  eotClaimedDays: true,
  eotApprovedDays: true,
  responsibleUserId: true,
  nextAction: true,
  dueDate: true,
  closedDate: true,
  remarks: true,
  createdByUserId: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true,
  responsibleUser: { select: { id: true, displayName: true } },
  createdByUser: { select: { id: true, displayName: true } },
  updatedByUser: { select: { id: true, displayName: true } },
  contract: {
    select: {
      id: true,
      referenceNumber: true,
      title: true,
      counterpartyName: true,
      contractValue: true,
      currency: true,
      ownerUser: { select: { id: true, displayName: true } },
      department: { select: { id: true, name: true } },
    },
  },
} as const;

const SUMMARY_SELECT = {
  status: true,
  submittedValue: true,
  approvedValue: true,
  dueDate: true,
  eotClaimedDays: true,
  eotApprovedDays: true,
} as const;

export interface PaginatedClaimResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: ClaimSummary;
}

@Injectable()
export class ContractClaimsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  // ---------------------------------------------------------------------------
  // List (paginated + filtered), scoped by department access, with summary
  // totals computed across the FULL filtered set (not just the current page).
  // ---------------------------------------------------------------------------

  async findAll(query: ContractClaimListQueryDto, actor: AuthUser): Promise<PaginatedClaimResult<unknown>> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const today = utcToday();

    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT);
    const where = buildClaimListWhere(query, today);
    if (deptFilter !== null) {
      const and = (where['AND'] as Record<string, unknown>[] | undefined) ?? [];
      and.push({ contract: { departmentId: deptFilter } });
      where['AND'] = and;
    }

    const [items, total, summaryRows] = await Promise.all([
      this.db.getClient().contractClaim.findMany({
        where,
        select: CLAIM_SELECT,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.db.getClient().contractClaim.count({ where }),
      this.db.getClient().contractClaim.findMany({ where, select: SUMMARY_SELECT }),
    ]);

    return {
      items: items.map((c) => withDerivedFields(c, today)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      summary: computeClaimSummary(summaryRows as unknown as (ValueFields & OverdueFields & EotFields)[], today),
    };
  }

  // ---------------------------------------------------------------------------
  // Create — claim always belongs to an existing contract (contractId comes
  // from the route, POST /contracts/:id/claims).
  // ---------------------------------------------------------------------------

  async create(contractId: string, dto: CreateContractClaimDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const contract = await this.db.getClient().contract.findUnique({
      where: { id: contractId },
      select: { id: true, departmentId: true },
    });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);

    if (dto.responsibleUserId !== undefined) {
      const user = await this.db.getClient().user.findUnique({
        where: { id: dto.responsibleUserId },
        select: { id: true },
      });
      if (!user) {
        throw new UnprocessableEntityException({
          code: 'CONTRACT_CLAIM_INVALID_RESPONSIBLE',
          message: 'responsibleUserId does not refer to a valid user.',
        });
      }
    }

    assertClaimValuesValid({ submittedValue: dto.submittedValue, approvedValue: dto.approvedValue });

    // claimDate is left unset unless the caller provides it — never defaulted
    // to today, for the same reason raisedDate isn't auto-defaulted on Issues:
    // it would make it impossible to log a claim with only a past dueDate.
    const claimDate = dto.claimDate !== undefined ? new Date(dto.claimDate) : undefined;
    const dueDate = dto.dueDate !== undefined ? new Date(dto.dueDate) : undefined;
    assertClaimDatesValid({ claimDate, dueDate });

    const effectiveStatus = dto.status ?? 'DRAFT';
    const closedDate = resolveClaimClosedDate(effectiveStatus, dto.closedDate, null);

    if (dto.claimNo) {
      const existing = await this.db.getClient().contractClaim.findUnique({
        where: { contractId_claimNo: { contractId, claimNo: dto.claimNo } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          code: 'CONTRACT_CLAIM_NO_DUPLICATE',
          message: `Claim No. "${dto.claimNo}" already exists for this contract.`,
        });
      }
    }

    const created = await this.db.getClient().contractClaim.create({
      data: {
        contractId,
        createdByUserId: actor.id,
        claimTitle: dto.claimTitle,
        ...(dto.claimNo !== undefined ? { claimNo: dto.claimNo } : {}),
        ...(dto.claimType !== undefined ? { claimType: dto.claimType as never } : {}),
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
        ...(dto.eventDate !== undefined ? { eventDate: new Date(dto.eventDate) } : {}),
        ...(claimDate !== undefined ? { claimDate } : {}),
        ...(dto.submittedValue !== undefined ? { submittedValue: dto.submittedValue } : {}),
        ...(dto.approvedValue !== undefined ? { approvedValue: dto.approvedValue } : {}),
        ...(dto.eotClaimedDays !== undefined ? { eotClaimedDays: dto.eotClaimedDays } : {}),
        ...(dto.eotApprovedDays !== undefined ? { eotApprovedDays: dto.eotApprovedDays } : {}),
        ...(dto.responsibleUserId !== undefined ? { responsibleUserId: dto.responsibleUserId } : {}),
        ...(dto.nextAction !== undefined ? { nextAction: dto.nextAction } : {}),
        ...(dueDate !== undefined ? { dueDate } : {}),
        ...(closedDate !== undefined ? { closedDate } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      },
      select: CLAIM_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, 'claim_created', {
      claimId: created.id,
      claimNo: created.claimNo ?? null,
    });

    return withDerivedFields(created, utcToday());
  }

  // ---------------------------------------------------------------------------
  // Update.
  // ---------------------------------------------------------------------------

  async update(claimId: string, dto: UpdateContractClaimDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const existing = await this.db.getClient().contractClaim.findUnique({
      where: { id: claimId },
      select: {
        id: true,
        contractId: true,
        claimNo: true,
        status: true,
        claimDate: true,
        dueDate: true,
        closedDate: true,
        submittedValue: true,
        approvedValue: true,
        contract: { select: { departmentId: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'CONTRACT_CLAIM_NOT_FOUND', message: 'Claim not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      existing.contract.departmentId,
    );

    if (dto.responsibleUserId !== undefined) {
      const user = await this.db.getClient().user.findUnique({
        where: { id: dto.responsibleUserId },
        select: { id: true },
      });
      if (!user) {
        throw new UnprocessableEntityException({
          code: 'CONTRACT_CLAIM_INVALID_RESPONSIBLE',
          message: 'responsibleUserId does not refer to a valid user.',
        });
      }
    }

    const effectiveSubmittedValue = dto.submittedValue ?? toNum(existing.submittedValue);
    const effectiveApprovedValue = dto.approvedValue ?? toNum(existing.approvedValue);
    assertClaimValuesValid({ submittedValue: effectiveSubmittedValue, approvedValue: effectiveApprovedValue });

    const effectiveClaimDate = dto.claimDate !== undefined ? new Date(dto.claimDate) : existing.claimDate;
    const effectiveDueDate = dto.dueDate !== undefined ? new Date(dto.dueDate) : existing.dueDate;
    assertClaimDatesValid({ claimDate: effectiveClaimDate, dueDate: effectiveDueDate });

    const effectiveStatus = dto.status ?? existing.status;
    const closedDate = resolveClaimClosedDate(effectiveStatus, dto.closedDate, existing.closedDate);

    if (dto.claimNo !== undefined && dto.claimNo !== existing.claimNo && dto.claimNo !== '') {
      const duplicate = await this.db.getClient().contractClaim.findUnique({
        where: { contractId_claimNo: { contractId: existing.contractId, claimNo: dto.claimNo } },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'CONTRACT_CLAIM_NO_DUPLICATE',
          message: `Claim No. "${dto.claimNo}" already exists for this contract.`,
        });
      }
    }

    const updated = await this.db.getClient().contractClaim.update({
      where: { id: claimId },
      data: {
        updatedByUserId: actor.id,
        ...(dto.claimNo !== undefined ? { claimNo: dto.claimNo } : {}),
        ...(dto.claimTitle !== undefined ? { claimTitle: dto.claimTitle } : {}),
        ...(dto.claimType !== undefined ? { claimType: dto.claimType as never } : {}),
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
        ...(dto.eventDate !== undefined ? { eventDate: new Date(dto.eventDate) } : {}),
        ...(dto.claimDate !== undefined ? { claimDate: effectiveClaimDate } : {}),
        ...(dto.submittedValue !== undefined ? { submittedValue: dto.submittedValue } : {}),
        ...(dto.approvedValue !== undefined ? { approvedValue: dto.approvedValue } : {}),
        ...(dto.eotClaimedDays !== undefined ? { eotClaimedDays: dto.eotClaimedDays } : {}),
        ...(dto.eotApprovedDays !== undefined ? { eotApprovedDays: dto.eotApprovedDays } : {}),
        ...(dto.responsibleUserId !== undefined ? { responsibleUserId: dto.responsibleUserId } : {}),
        ...(dto.nextAction !== undefined ? { nextAction: dto.nextAction } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: effectiveDueDate } : {}),
        ...(closedDate !== undefined ? { closedDate } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      },
      select: CLAIM_SELECT,
    });

    await logContractActivity(this.db, existing.contractId, actor, 'claim_updated', {
      claimId: updated.id,
      claimNo: updated.claimNo ?? null,
    });

    return withDerivedFields(updated, utcToday());
  }

  // ---------------------------------------------------------------------------
  // Close/Settle — dedicated safe action. Sets status = CLOSED (default) or
  // SETTLED and, if no closedDate exists yet, defaults it to today. No hard
  // delete anywhere in this service.
  // ---------------------------------------------------------------------------

  async close(claimId: string, targetStatus: 'CLOSED' | 'SETTLED' | undefined, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const existing = await this.db.getClient().contractClaim.findUnique({
      where: { id: claimId },
      select: { id: true, closedDate: true, contract: { select: { departmentId: true } } },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'CONTRACT_CLAIM_NOT_FOUND', message: 'Claim not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      existing.contract.departmentId,
    );

    const status = targetStatus ?? 'CLOSED';

    const updated = await this.db.getClient().contractClaim.update({
      where: { id: claimId },
      data: {
        status,
        closedDate: existing.closedDate ?? utcToday(),
        updatedByUserId: actor.id,
      },
      select: CLAIM_SELECT,
    });

    return withDerivedFields(updated, utcToday());
  }
}
