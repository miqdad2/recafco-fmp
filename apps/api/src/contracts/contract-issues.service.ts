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
import type { CreateContractIssueDto } from './dto/create-contract-issue.dto';
import type { UpdateContractIssueDto } from './dto/update-contract-issue.dto';
import type { ContractIssueListQueryDto } from './dto/contract-issue-list-query.dto';
import { logContractActivity } from './contract-activity-log';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Statuses that make an issue no longer "open" for overdue-tracking purposes. */
const CLOSED_LIKE_STATUSES = ['CLOSED', 'RESOLVED', 'CANCELLED'];
/** Statuses that auto-set closedDate when reached without an explicit value — CANCELLED is deliberately excluded (a cancelled issue wasn't resolved, so it shouldn't get a "closed" date). */
const AUTO_CLOSE_DATE_STATUSES = ['CLOSED', 'RESOLVED'];

// ---------------------------------------------------------------------------
// Derived values — never stored, always computed from the current row.
// overdueDays = today - dueDate, only when status is not CLOSED/RESOLVED/
// CANCELLED and dueDate has passed.
// ---------------------------------------------------------------------------

interface OverdueFields {
  dueDate: Date | null;
  status: string;
}

export function computeIssueOverdueDays(row: OverdueFields, today: Date = utcToday()): number | null {
  if (CLOSED_LIKE_STATUSES.includes(row.status)) return null;
  if (!row.dueDate) return null;
  const due = new Date(Date.UTC(row.dueDate.getUTCFullYear(), row.dueDate.getUTCMonth(), row.dueDate.getUTCDate()));
  if (due >= today) return null;
  return Math.round((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeIssueIsOverdue(row: OverdueFields, today: Date = utcToday()): boolean {
  return computeIssueOverdueDays(row, today) !== null;
}

function withDerivedFields<T extends OverdueFields>(
  row: T,
  today: Date,
): T & { overdueDays: number | null; isOverdue: boolean } {
  return {
    ...row,
    overdueDays: computeIssueOverdueDays(row, today),
    isOverdue: computeIssueIsOverdue(row, today),
  };
}

// ---------------------------------------------------------------------------
// Cross-field validation
// ---------------------------------------------------------------------------

export function assertIssueDatesValid(effective: {
  raisedDate: Date | null | undefined;
  dueDate: Date | null | undefined;
}): void {
  if (effective.dueDate && effective.raisedDate && effective.dueDate < effective.raisedDate) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_ISSUE_DUE_BEFORE_RAISED',
      message: 'Due Date cannot be before Raised Date.',
    });
  }
}

/**
 * closedDate resolution: an explicit dto value always wins; otherwise, if the
 * effective status is CLOSED/RESOLVED and there's no closed date yet, it's
 * auto-set to today (never invented for any other status). Returns undefined
 * when the field should be left untouched.
 */
export function resolveClosedDate(
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
// Module-level list where builder (exported for tests) — issue-own filters
// only. Department scope and any explicit contract-level filters are combined
// in via a nested `contract: {...}` AND clause by findAll().
// ---------------------------------------------------------------------------

export function buildIssueListWhere(query: ContractIssueListQueryDto, today: Date = utcToday()): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];

  if (query.contractId) where['contractId'] = query.contractId;

  if (query.status) and.push({ status: query.status });
  if (query.priority) and.push({ priority: query.priority });
  if (query.category) and.push({ category: query.category });
  if (query.responsibleUserId) and.push({ responsibleUserId: query.responsibleUserId });

  if (query.raisedDateFrom || query.raisedDateTo) {
    and.push({
      raisedDate: {
        ...(query.raisedDateFrom ? { gte: new Date(query.raisedDateFrom) } : {}),
        ...(query.raisedDateTo ? { lte: new Date(query.raisedDateTo) } : {}),
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
      and.push({ status: { notIn: CLOSED_LIKE_STATUSES } });
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
        { issueNo: { contains: s, mode: 'insensitive' } },
        { title: { contains: s, mode: 'insensitive' } },
        { contract: { referenceNumber: { contains: s, mode: 'insensitive' } } },
        { contract: { title: { contains: s, mode: 'insensitive' } } },
        { contract: { counterpartyName: { contains: s, mode: 'insensitive' } } },
      ],
    });
  }

  if (and.length > 0) where['AND'] = and;
  return where;
}

export interface IssueSummary {
  totalIssues: number;
  openIssues: number;
  inProgressIssues: number;
  highCriticalIssues: number;
  overdueIssues: number;
  closedIssues: number;
  /** CM-65 — status === 'WAITING_RESPONSE', for the Contract Detail Issue Log tab's "Waiting" KPI card. */
  waitingResponseIssues: number;
  /** CM-65 — status === 'RESOLVED' (distinct from CLOSED — a resolved issue may not yet be formally closed), for the same tab's "Resolved" KPI card. */
  resolvedIssues: number;
}

export function computeIssueSummary(rows: (OverdueFields & { priority: string })[], today: Date = utcToday()): IssueSummary {
  let openIssues = 0;
  let inProgressIssues = 0;
  let highCriticalIssues = 0;
  let overdueIssues = 0;
  let closedIssues = 0;
  let waitingResponseIssues = 0;
  let resolvedIssues = 0;

  for (const row of rows) {
    if (row.status === 'OPEN') openIssues += 1;
    if (row.status === 'IN_PROGRESS') inProgressIssues += 1;
    if (row.priority === 'HIGH' || row.priority === 'CRITICAL') highCriticalIssues += 1;
    if (row.status === 'CLOSED') closedIssues += 1;
    if (row.status === 'WAITING_RESPONSE') waitingResponseIssues += 1;
    if (row.status === 'RESOLVED') resolvedIssues += 1;
    if (computeIssueIsOverdue(row, today)) overdueIssues += 1;
  }

  return {
    totalIssues: rows.length,
    openIssues,
    inProgressIssues,
    highCriticalIssues,
    overdueIssues,
    closedIssues,
    waitingResponseIssues,
    resolvedIssues,
  };
}

// ---------------------------------------------------------------------------
// Prisma select shapes
// ---------------------------------------------------------------------------

const ISSUE_SELECT = {
  id: true,
  contractId: true,
  issueNo: true,
  title: true,
  description: true,
  category: true,
  priority: true,
  status: true,
  responsibleUserId: true,
  raisedDate: true,
  dueDate: true,
  closedDate: true,
  resolution: true,
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
      ownerUser: { select: { id: true, displayName: true } },
      department: { select: { id: true, name: true } },
    },
  },
} as const;

const SUMMARY_SELECT = {
  status: true,
  priority: true,
  dueDate: true,
} as const;

export interface PaginatedIssueResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: IssueSummary;
}

@Injectable()
export class ContractIssuesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  // ---------------------------------------------------------------------------
  // List (paginated + filtered), scoped by department access, with summary
  // totals computed across the FULL filtered set (not just the current page).
  // ---------------------------------------------------------------------------

  async findAll(query: ContractIssueListQueryDto, actor: AuthUser): Promise<PaginatedIssueResult<unknown>> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const today = utcToday();

    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT);
    const where = buildIssueListWhere(query, today);
    if (deptFilter !== null) {
      const and = (where['AND'] as Record<string, unknown>[] | undefined) ?? [];
      and.push({ contract: { departmentId: deptFilter } });
      where['AND'] = and;
    }

    const [items, total, summaryRows] = await Promise.all([
      this.db.getClient().contractIssue.findMany({
        where,
        select: ISSUE_SELECT,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.db.getClient().contractIssue.count({ where }),
      this.db.getClient().contractIssue.findMany({ where, select: SUMMARY_SELECT }),
    ]);

    return {
      items: items.map((i) => withDerivedFields(i, today)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      summary: computeIssueSummary(summaryRows as unknown as (OverdueFields & { priority: string })[], today),
    };
  }

  // ---------------------------------------------------------------------------
  // Create — issue always belongs to an existing contract (contractId comes
  // from the route, POST /contracts/:id/issues).
  // ---------------------------------------------------------------------------

  async create(contractId: string, dto: CreateContractIssueDto, actor: AuthUser): Promise<unknown> {
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
          code: 'CONTRACT_ISSUE_INVALID_RESPONSIBLE',
          message: 'responsibleUserId does not refer to a valid user.',
        });
      }
    }

    // raisedDate is left unset unless the caller provides it — never
    // defaulted to today, since that would make it impossible to log a
    // past-due issue (raisedDate defaulting to "now" would always be after
    // an explicitly past dueDate, tripping the dueDate-after-raisedDate rule).
    const raisedDate = dto.raisedDate !== undefined ? new Date(dto.raisedDate) : undefined;
    const dueDate = dto.dueDate !== undefined ? new Date(dto.dueDate) : undefined;
    assertIssueDatesValid({ raisedDate, dueDate });

    const effectiveStatus = dto.status ?? 'OPEN';
    const closedDate = resolveClosedDate(effectiveStatus, dto.closedDate, null);

    if (dto.issueNo) {
      const existing = await this.db.getClient().contractIssue.findUnique({
        where: { contractId_issueNo: { contractId, issueNo: dto.issueNo } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          code: 'CONTRACT_ISSUE_NO_DUPLICATE',
          message: `Issue No. "${dto.issueNo}" already exists for this contract.`,
        });
      }
    }

    const created = await this.db.getClient().contractIssue.create({
      data: {
        contractId,
        createdByUserId: actor.id,
        title: dto.title,
        ...(raisedDate !== undefined ? { raisedDate } : {}),
        ...(dto.issueNo !== undefined ? { issueNo: dto.issueNo } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority as never } : {}),
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
        ...(dto.responsibleUserId !== undefined ? { responsibleUserId: dto.responsibleUserId } : {}),
        ...(dueDate !== undefined ? { dueDate } : {}),
        ...(closedDate !== undefined ? { closedDate } : {}),
        ...(dto.resolution !== undefined ? { resolution: dto.resolution } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      },
      select: ISSUE_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, 'issue_created', {
      issueId: created.id,
      issueNo: created.issueNo ?? null,
    });

    return withDerivedFields(created, utcToday());
  }

  // ---------------------------------------------------------------------------
  // Update.
  // ---------------------------------------------------------------------------

  async update(issueId: string, dto: UpdateContractIssueDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const existing = await this.db.getClient().contractIssue.findUnique({
      where: { id: issueId },
      select: {
        id: true,
        contractId: true,
        issueNo: true,
        status: true,
        raisedDate: true,
        dueDate: true,
        closedDate: true,
        contract: { select: { departmentId: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'CONTRACT_ISSUE_NOT_FOUND', message: 'Issue not found' });
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
          code: 'CONTRACT_ISSUE_INVALID_RESPONSIBLE',
          message: 'responsibleUserId does not refer to a valid user.',
        });
      }
    }

    const effectiveRaisedDate = dto.raisedDate !== undefined ? new Date(dto.raisedDate) : existing.raisedDate;
    const effectiveDueDate = dto.dueDate !== undefined ? new Date(dto.dueDate) : existing.dueDate;
    assertIssueDatesValid({ raisedDate: effectiveRaisedDate, dueDate: effectiveDueDate });

    const effectiveStatus = dto.status ?? existing.status;
    const closedDate = resolveClosedDate(effectiveStatus, dto.closedDate, existing.closedDate);

    if (dto.issueNo !== undefined && dto.issueNo !== existing.issueNo && dto.issueNo !== '') {
      const duplicate = await this.db.getClient().contractIssue.findUnique({
        where: { contractId_issueNo: { contractId: existing.contractId, issueNo: dto.issueNo } },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'CONTRACT_ISSUE_NO_DUPLICATE',
          message: `Issue No. "${dto.issueNo}" already exists for this contract.`,
        });
      }
    }

    const updated = await this.db.getClient().contractIssue.update({
      where: { id: issueId },
      data: {
        updatedByUserId: actor.id,
        ...(dto.issueNo !== undefined ? { issueNo: dto.issueNo } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority as never } : {}),
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
        ...(dto.responsibleUserId !== undefined ? { responsibleUserId: dto.responsibleUserId } : {}),
        ...(dto.raisedDate !== undefined ? { raisedDate: effectiveRaisedDate } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: effectiveDueDate } : {}),
        ...(closedDate !== undefined ? { closedDate } : {}),
        ...(dto.resolution !== undefined ? { resolution: dto.resolution } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      },
      select: ISSUE_SELECT,
    });

    await logContractActivity(this.db, existing.contractId, actor, 'issue_updated', {
      issueId: updated.id,
      issueNo: updated.issueNo ?? null,
    });

    return withDerivedFields(updated, utcToday());
  }

  // ---------------------------------------------------------------------------
  // Close — dedicated safe action. Sets status = CLOSED and, if no closedDate
  // exists yet, defaults it to today. No hard delete anywhere in this service.
  // ---------------------------------------------------------------------------

  async close(issueId: string, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const existing = await this.db.getClient().contractIssue.findUnique({
      where: { id: issueId },
      select: { id: true, closedDate: true, contract: { select: { departmentId: true } } },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'CONTRACT_ISSUE_NOT_FOUND', message: 'Issue not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      existing.contract.departmentId,
    );

    const updated = await this.db.getClient().contractIssue.update({
      where: { id: issueId },
      data: {
        status: 'CLOSED',
        closedDate: existing.closedDate ?? utcToday(),
        updatedByUserId: actor.id,
      },
      select: ISSUE_SELECT,
    });

    return withDerivedFields(updated, utcToday());
  }
}
