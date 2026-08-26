import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ModuleIdentifier, ContractStatus } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import {
  CloseoutAttachmentStorageService,
  CLOSEOUT_ATTACHMENT_MAX_BYTES,
  CLOSEOUT_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './closeout-attachment-storage.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateContractCloseoutRequestDto } from './dto/create-contract-closeout-request.dto';
import type { UpdateContractCloseoutRequestDto } from './dto/update-contract-closeout-request.dto';
import type { ReviewContractCloseoutRequestDto } from './dto/review-contract-closeout-request.dto';
import type { RejectContractCloseoutRequestDto } from './dto/reject-contract-closeout-request.dto';
import type { ContractCloseoutListQueryDto } from './dto/contract-closeout-list-query.dto';

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

function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

// ---------------------------------------------------------------------------
// Closeout readiness — status classifications exactly as specified for this
// unit. These are DELIBERATELY separate constant sets from each owning
// module's own "open"/"overdue" definitions (CM-30 issues, CM-31 claims,
// CM-32 workflow tasks) — closeout readiness is a cross-cutting judgment call
// for this unit only, not a redefinition of those modules' own semantics.
// ---------------------------------------------------------------------------

/** RESOLVED is treated as still-open for closeout purposes — a resolved-but-not-formally-closed issue hasn't gone through final sign-off, so a closeout gate should still surface it. This is the conservative choice the spec explicitly allows either way. */
const OPEN_ISSUE_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_RESPONSE', 'RESOLVED'];
const FINAL_ISSUE_STATUSES = ['CLOSED', 'CANCELLED'];

const OPEN_CLAIM_STATUSES = ['DRAFT', 'UNDER_REVIEW', 'SUBMITTED', 'UNDER_NEGOTIATION', 'PARTIALLY_APPROVED'];
const FINAL_CLAIM_STATUSES = ['APPROVED', 'REJECTED', 'SETTLED', 'CLOSED', 'CANCELLED'];

/** A workflow task counts as "closeout-ready" only once APPROVED or COMPLETED — every other status (including REJECTED/ON_HOLD) still needs attention before closure. */
const CLOSEOUT_READY_WORKFLOW_STATUSES = ['APPROVED', 'COMPLETED'];

const FINAL_PAYMENT_STATUSES = ['PAID', 'CANCELLED'];
const OVERDUE_PAYMENT_STATUS = 'OVERDUE';
const PARTIALLY_PAID_STATUS = 'PARTIALLY_PAID';

/** Active closeout-request statuses — only one may exist per contract at a time; a new request may only be created once the previous one is REJECTED, CANCELLED, or CLOSED. */
const ACTIVE_REQUEST_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED'];

export interface CloseoutChecks {
  workflow: { total: number; open: number; overdue: number; completed: number };
  issues: { total: number; open: number; final: number };
  claims: { total: number; open: number; final: number };
  payments: { nonFinalCount: number; partiallyPaidCount: number; overdueCount: number; outstandingAmount: string };
  documents: { count: number };
  isReadyForClosure: boolean;
  checkedAt: string;
}

export interface CloseoutRiskSnapshot {
  openWorkflowTasksCount: number;
  overdueWorkflowTasksCount: number;
  openIssuesCount: number;
  openClaimsCount: number;
  outstandingPaymentAmount: string;
  unpaidPaymentsCount: number;
  missingCloseoutDocumentsCount: number;
  checkedAt: string;
}

export function toRiskSnapshot(checks: CloseoutChecks): CloseoutRiskSnapshot {
  return {
    openWorkflowTasksCount: checks.workflow.open,
    overdueWorkflowTasksCount: checks.workflow.overdue,
    openIssuesCount: checks.issues.open,
    openClaimsCount: checks.claims.open,
    outstandingPaymentAmount: checks.payments.outstandingAmount,
    unpaidPaymentsCount: checks.payments.nonFinalCount,
    missingCloseoutDocumentsCount: checks.documents.count === 0 ? 1 : 0,
    checkedAt: checks.checkedAt,
  };
}

/** Pure aggregation over already-fetched rows — exported for direct unit testing without a DB. */
export function computeCloseoutChecks(input: {
  workflowTasks: { status: string; dueDate: Date | null }[];
  issues: { status: string }[];
  claims: { status: string }[];
  payments: { status: string; submittedAmount: unknown; certifiedAmount: unknown; paidAmount: unknown }[];
  documentsCount: number;
  today?: Date;
}): CloseoutChecks {
  const today = input.today ?? utcToday();

  let workflowOpen = 0;
  let workflowOverdue = 0;
  let workflowCompleted = 0;
  for (const t of input.workflowTasks) {
    const isReady = CLOSEOUT_READY_WORKFLOW_STATUSES.includes(t.status);
    if (isReady) workflowCompleted += 1;
    else workflowOpen += 1;
    if (!isReady && t.dueDate) {
      const due = new Date(Date.UTC(t.dueDate.getUTCFullYear(), t.dueDate.getUTCMonth(), t.dueDate.getUTCDate()));
      if (due < today) workflowOverdue += 1;
    }
  }

  const issuesOpen = input.issues.filter((i) => OPEN_ISSUE_STATUSES.includes(i.status)).length;
  const issuesFinal = input.issues.filter((i) => FINAL_ISSUE_STATUSES.includes(i.status)).length;

  const claimsOpen = input.claims.filter((c) => OPEN_CLAIM_STATUSES.includes(c.status)).length;
  const claimsFinal = input.claims.filter((c) => FINAL_CLAIM_STATUSES.includes(c.status)).length;

  let paymentsNonFinalCount = 0;
  let partiallyPaidCount = 0;
  let overdueCount = 0;
  let outstandingAmount = 0;
  for (const p of input.payments) {
    if (FINAL_PAYMENT_STATUSES.includes(p.status)) continue;
    paymentsNonFinalCount += 1;
    if (p.status === PARTIALLY_PAID_STATUS) partiallyPaidCount += 1;
    if (p.status === OVERDUE_PAYMENT_STATUS) overdueCount += 1;
    const cap = toNum(p.certifiedAmount) ?? toNum(p.submittedAmount) ?? 0;
    const paid = toNum(p.paidAmount) ?? 0;
    outstandingAmount += cap - paid;
  }

  const isReadyForClosure =
    workflowOpen === 0 && workflowOverdue === 0 && issuesOpen === 0 && claimsOpen === 0 && paymentsNonFinalCount === 0;

  return {
    workflow: { total: input.workflowTasks.length, open: workflowOpen, overdue: workflowOverdue, completed: workflowCompleted },
    issues: { total: input.issues.length, open: issuesOpen, final: issuesFinal },
    claims: { total: input.claims.length, open: claimsOpen, final: claimsFinal },
    payments: {
      nonFinalCount: paymentsNonFinalCount,
      partiallyPaidCount,
      overdueCount,
      outstandingAmount: round3(outstandingAmount).toFixed(3),
    },
    documents: { count: input.documentsCount },
    isReadyForClosure,
    checkedAt: today.toISOString(),
  };
}

const REQUEST_SELECT = {
  id: true,
  contractId: true,
  requestNo: true,
  status: true,
  requestedByUserId: true,
  requestedAt: true,
  reviewedByUserId: true,
  reviewedAt: true,
  approvedAt: true,
  rejectedAt: true,
  closedAt: true,
  closeoutSummary: true,
  requestedRemarks: true,
  reviewRemarks: true,
  rejectionReason: true,
  riskSnapshot: true,
  createdAt: true,
  updatedAt: true,
  requestedByUser: { select: { id: true, displayName: true } },
  reviewedByUser: { select: { id: true, displayName: true } },
  _count: { select: { attachments: true } },
} as const;

function withRequestDerivedFields<T extends { _count: { attachments: number } }>(
  row: T,
): Omit<T, '_count'> & { attachmentsCount: number } {
  const { _count, ...rest } = row;
  return { ...rest, attachmentsCount: _count.attachments };
}

// ---------------------------------------------------------------------------
// CM-38 — module-level Closeout Requests register (GET /contracts/closeouts).
// Read-only list across ALL contracts in scope, distinct from listRequests()
// above (which is scoped to one contract's own Closeout tab). No new table:
// every row reads directly from ContractCloseoutRequest + its parent
// Contract, the same source-of-truth rows the per-contract tab already uses.
//
// "Workflow Open / Issues Open / Claims Open / Outstanding Payment" columns
// deliberately read from the request's own STORED riskSnapshot (captured at
// submission, refreshed at review — see review()/createRequest() above)
// rather than recomputing live per row. This avoids an N+1 query fan-out
// across workflow/issue/claim/payment tables for every request in the list,
// and is also more correct: the register shows the risk picture AS OF the
// request's own submission/review moment, exactly what riskSnapshot exists
// for. "Documents" uses the live attachmentsCount instead, since that count
// only ever grows and isn't part of the readiness snapshot concept.
// ---------------------------------------------------------------------------

/** Distinct naming from closeout READINESS's ACTIVE_REQUEST_STATUSES above — this is "needs a manager's review action" for the register's own Pending Review card/filter, not "blocks a new request from being submitted" (APPROVED is active for the latter but not pending for the former). */
const PENDING_REVIEW_STATUSES = ['SUBMITTED', 'UNDER_REVIEW'];

export interface CloseoutListSummary {
  totalRequests: number;
  submitted: number;
  underReview: number;
  approved: number;
  rejected: number;
  closed: number;
  pendingReview: number;
}

export function computeCloseoutListSummary(rows: { status: string }[]): CloseoutListSummary {
  let submitted = 0;
  let underReview = 0;
  let approved = 0;
  let rejected = 0;
  let closed = 0;

  for (const r of rows) {
    if (r.status === 'SUBMITTED') submitted += 1;
    else if (r.status === 'UNDER_REVIEW') underReview += 1;
    else if (r.status === 'APPROVED') approved += 1;
    else if (r.status === 'REJECTED') rejected += 1;
    else if (r.status === 'CLOSED') closed += 1;
  }

  return {
    totalRequests: rows.length,
    submitted,
    underReview,
    approved,
    rejected,
    closed,
    pendingReview: rows.filter((r) => PENDING_REVIEW_STATUSES.includes(r.status)).length,
  };
}

export function buildCloseoutListWhere(query: ContractCloseoutListQueryDto): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];

  if (query.contractId) where['contractId'] = query.contractId;
  if (query.status) and.push({ status: query.status });
  if (query.requestedByUserId) and.push({ requestedByUserId: query.requestedByUserId });
  if (query.reviewedByUserId) and.push({ reviewedByUserId: query.reviewedByUserId });

  if (query.requestedDateFrom || query.requestedDateTo) {
    and.push({
      requestedAt: {
        ...(query.requestedDateFrom ? { gte: new Date(query.requestedDateFrom) } : {}),
        ...(query.requestedDateTo ? { lte: new Date(query.requestedDateTo) } : {}),
      },
    });
  }
  if (query.reviewedDateFrom || query.reviewedDateTo) {
    and.push({
      reviewedAt: {
        ...(query.reviewedDateFrom ? { gte: new Date(query.reviewedDateFrom) } : {}),
        ...(query.reviewedDateTo ? { lte: new Date(query.reviewedDateTo) } : {}),
      },
    });
  }
  if (query.approvedDateFrom || query.approvedDateTo) {
    and.push({
      approvedAt: {
        ...(query.approvedDateFrom ? { gte: new Date(query.approvedDateFrom) } : {}),
        ...(query.approvedDateTo ? { lte: new Date(query.approvedDateTo) } : {}),
      },
    });
  }

  if (query.pendingOnly) and.push({ status: { in: PENDING_REVIEW_STATUSES } });

  const contractWhere: Record<string, unknown> = {};
  if (query.departmentId) contractWhere['departmentId'] = query.departmentId;
  if (Object.keys(contractWhere).length > 0) and.push({ contract: contractWhere });

  if (query.search?.trim()) {
    const s = query.search.trim();
    and.push({
      OR: [
        { requestNo: { contains: s, mode: 'insensitive' } },
        { contract: { referenceNumber: { contains: s, mode: 'insensitive' } } },
        { contract: { title: { contains: s, mode: 'insensitive' } } },
        { contract: { counterpartyName: { contains: s, mode: 'insensitive' } } },
      ],
    });
  }

  if (and.length > 0) where['AND'] = and;
  return where;
}

const CLOSEOUT_LIST_SELECT = {
  id: true,
  contractId: true,
  requestNo: true,
  status: true,
  requestedAt: true,
  reviewedAt: true,
  approvedAt: true,
  rejectedAt: true,
  closedAt: true,
  closeoutSummary: true,
  requestedRemarks: true,
  reviewRemarks: true,
  rejectionReason: true,
  riskSnapshot: true,
  requestedByUser: { select: { id: true, displayName: true } },
  reviewedByUser: { select: { id: true, displayName: true } },
  _count: { select: { attachments: true } },
  contract: {
    select: {
      id: true,
      referenceNumber: true,
      title: true,
      counterpartyName: true,
      department: { select: { id: true, name: true } },
    },
  },
} as const;

interface CloseoutListRow {
  id: string;
  requestNo: string;
  status: string;
  requestedAt: Date;
  reviewedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  closedAt: Date | null;
  closeoutSummary: string | null;
  requestedRemarks: string | null;
  reviewRemarks: string | null;
  rejectionReason: string | null;
  riskSnapshot: unknown;
  requestedByUser: { id: string; displayName: string };
  reviewedByUser: { id: string; displayName: string } | null;
  _count: { attachments: number };
  contract: {
    id: string;
    referenceNumber: string;
    title: string;
    counterpartyName: string;
    department: { id: string; name: string } | null;
  };
}

export interface CloseoutListItem {
  requestId: string;
  requestNo: string;
  status: string;
  contractId: string;
  contractReference: string;
  contractTitle: string;
  companyName: string;
  department: { id: string; name: string } | null;
  requestedBy: { id: string; displayName: string };
  requestedAt: string;
  reviewedBy: { id: string; displayName: string } | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  closedAt: string | null;
  closeoutSummary: string | null;
  requestedRemarks: string | null;
  reviewRemarks: string | null;
  rejectionReason: string | null;
  riskSnapshot: CloseoutRiskSnapshot | null;
  attachmentsCount: number;
  actionUrl: string;
}

export function toCloseoutListItem(row: CloseoutListRow): CloseoutListItem {
  return {
    requestId: row.id,
    requestNo: row.requestNo,
    status: row.status,
    contractId: row.contract.id,
    contractReference: row.contract.referenceNumber,
    contractTitle: row.contract.title,
    companyName: row.contract.counterpartyName,
    department: row.contract.department,
    requestedBy: row.requestedByUser,
    requestedAt: row.requestedAt.toISOString(),
    reviewedBy: row.reviewedByUser,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    rejectedAt: row.rejectedAt ? row.rejectedAt.toISOString() : null,
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    closeoutSummary: row.closeoutSummary,
    requestedRemarks: row.requestedRemarks,
    reviewRemarks: row.reviewRemarks,
    rejectionReason: row.rejectionReason,
    riskSnapshot: (row.riskSnapshot as CloseoutRiskSnapshot | null) ?? null,
    attachmentsCount: row._count.attachments,
    actionUrl: `/contracts/${row.contract.id}/closeout`,
  };
}

export interface PaginatedCloseoutResult {
  items: CloseoutListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: CloseoutListSummary;
}

@Injectable()
export class ContractCloseoutService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
    private readonly attachmentStorage: CloseoutAttachmentStorageService,
  ) {}

  // ---------------------------------------------------------------------------
  // Shared lookups
  // ---------------------------------------------------------------------------

  private async loadContractForCloseout(contractId: string, actor: AuthUser): Promise<{ id: string; referenceNumber: string; status: ContractStatus; departmentId: string | null; version: number; ownerUserId: string }> {
    const contract = await this.db.getClient().contract.findUnique({
      where: { id: contractId },
      select: { id: true, referenceNumber: true, status: true, departmentId: true, version: true, ownerUserId: true },
    });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);
    return contract;
  }

  private async loadRequestForCloseout(requestId: string, actor: AuthUser): Promise<{
    id: string; contractId: string; status: string; closeoutSummary: string | null;
    requestedRemarks: string | null; reviewRemarks: string | null;
    contract: { id: string; referenceNumber: string; status: ContractStatus; departmentId: string | null; version: number; ownerUserId: string };
  }> {
    const request = await this.db.getClient().contractCloseoutRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true, contractId: true, status: true, closeoutSummary: true, requestedRemarks: true, reviewRemarks: true,
        contract: { select: { id: true, referenceNumber: true, status: true, departmentId: true, version: true, ownerUserId: true } },
      },
    });
    if (!request) {
      throw new NotFoundException({ code: 'CONTRACT_CLOSEOUT_REQUEST_NOT_FOUND', message: 'Closeout request not found' });
    }
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, request.contract.departmentId);
    return request as never;
  }

  // ---------------------------------------------------------------------------
  // Readiness checks — read-only, cross-module counts. Direct Prisma queries
  // (not calls into ContractIssuesService/ContractClaimsService/etc.) to avoid
  // a cross-service DI dependency for what is fundamentally a read-only report.
  // ---------------------------------------------------------------------------

  async getCloseoutChecks(contractId: string, actor: AuthUser): Promise<CloseoutChecks> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    await this.loadContractForCloseout(contractId, actor);
    return this.computeChecksForContract(contractId);
  }

  private async computeChecksForContract(contractId: string): Promise<CloseoutChecks> {
    const [workflowTasks, issues, claims, payments, latestRequest] = await Promise.all([
      this.db.getClient().contractWorkflowTask.findMany({ where: { contractId }, select: { status: true, dueDate: true } }),
      this.db.getClient().contractIssue.findMany({ where: { contractId }, select: { status: true } }),
      this.db.getClient().contractClaim.findMany({ where: { contractId }, select: { status: true } }),
      this.db.getClient().contractPayment.findMany({ where: { contractId }, select: { status: true, submittedAmount: true, certifiedAmount: true, paidAmount: true } }),
      this.db.getClient().contractCloseoutRequest.findFirst({
        where: { contractId },
        orderBy: [{ createdAt: 'desc' }],
        select: { _count: { select: { attachments: true } } },
      }),
    ]);

    return computeCloseoutChecks({
      workflowTasks,
      issues,
      claims,
      payments,
      documentsCount: latestRequest?._count.attachments ?? 0,
    });
  }

  // ---------------------------------------------------------------------------
  // List requests for a contract (most recent first).
  // ---------------------------------------------------------------------------

  async listRequests(contractId: string, actor: AuthUser): Promise<unknown[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    await this.loadContractForCloseout(contractId, actor);

    const requests = await this.db.getClient().contractCloseoutRequest.findMany({
      where: { contractId },
      orderBy: [{ createdAt: 'desc' }],
      select: REQUEST_SELECT,
    });
    return requests.map(withRequestDerivedFields);
  }

  // ---------------------------------------------------------------------------
  // Module-level list — every closeout request across every contract in
  // scope (paginated + filtered), distinct from listRequests() above.
  // ---------------------------------------------------------------------------

  async findAll(query: ContractCloseoutListQueryDto, actor: AuthUser): Promise<PaginatedCloseoutResult> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT);
    const where = buildCloseoutListWhere(query);
    if (deptFilter !== null) {
      const and = (where['AND'] as Record<string, unknown>[] | undefined) ?? [];
      and.push({ contract: { departmentId: deptFilter } });
      where['AND'] = and;
    }

    const [rows, total, summaryRows] = await Promise.all([
      this.db.getClient().contractCloseoutRequest.findMany({
        where,
        select: CLOSEOUT_LIST_SELECT,
        orderBy: [{ requestedAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.db.getClient().contractCloseoutRequest.count({ where }),
      this.db.getClient().contractCloseoutRequest.findMany({ where, select: { status: true } }),
    ]);

    return {
      items: (rows as unknown as CloseoutListRow[]).map(toCloseoutListItem),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      summary: computeCloseoutListSummary(summaryRows),
    };
  }

  // ---------------------------------------------------------------------------
  // Create + submit (DRAFT flow intentionally skipped — see report: the spec
  // explicitly permits creating directly as SUBMITTED).
  // ---------------------------------------------------------------------------

  async createRequest(contractId: string, dto: CreateContractCloseoutRequestDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }
    const contract = await this.loadContractForCloseout(contractId, actor);

    if (contract.status === ContractStatus.CLOSED) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_CLOSEOUT_ALREADY_CLOSED',
        message: 'This contract is already closed.',
      });
    }

    const existingActive = await this.db.getClient().contractCloseoutRequest.findFirst({
      where: { contractId, status: { in: ACTIVE_REQUEST_STATUSES as never[] } },
      select: { id: true, requestNo: true },
    });
    if (existingActive) {
      throw new ConflictException({
        code: 'CONTRACT_CLOSEOUT_REQUEST_ALREADY_ACTIVE',
        message: `An active closeout request (${existingActive.requestNo}) already exists for this contract.`,
      });
    }

    const checks = await this.computeChecksForContract(contractId);
    const riskSnapshot = toRiskSnapshot(checks);

    const created = await this.db.getClient().$transaction(async (tx) => {
      const count = await tx.contractCloseoutRequest.count({ where: { contractId } });
      const requestNo = `${contract.referenceNumber}-CLO-${String(count + 1).padStart(2, '0')}`;

      const request = await tx.contractCloseoutRequest.create({
        data: {
          contractId,
          requestNo,
          status: 'SUBMITTED',
          requestedByUserId: actor.id,
          closeoutSummary: dto.closeoutSummary,
          ...(dto.requestedRemarks !== undefined ? { requestedRemarks: dto.requestedRemarks } : {}),
          riskSnapshot: riskSnapshot as never,
        },
        select: REQUEST_SELECT,
      });

      await tx.contractActivity.create({
        data: {
          contractId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'closeout_requested',
          metadata: { requestId: request.id, requestNo: request.requestNo, riskSnapshot: riskSnapshot as never },
        },
      });

      return request;
    });

    return withRequestDerivedFields(created);
  }

  // ---------------------------------------------------------------------------
  // Update remarks — only while the request hasn't entered review yet.
  // ---------------------------------------------------------------------------

  async updateRequest(requestId: string, dto: UpdateContractCloseoutRequestDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }
    const existing = await this.loadRequestForCloseout(requestId, actor);

    if (!['DRAFT', 'SUBMITTED'].includes(existing.status)) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_CLOSEOUT_REQUEST_NOT_EDITABLE',
        message: `Cannot update a closeout request with status ${existing.status}.`,
      });
    }

    const updated = await this.db.getClient().contractCloseoutRequest.update({
      where: { id: requestId },
      data: {
        ...(dto.closeoutSummary !== undefined ? { closeoutSummary: dto.closeoutSummary } : {}),
        ...(dto.requestedRemarks !== undefined ? { requestedRemarks: dto.requestedRemarks } : {}),
      },
      select: REQUEST_SELECT,
    });
    return withRequestDerivedFields(updated);
  }

  // ---------------------------------------------------------------------------
  // Review — SUBMITTED -> UNDER_REVIEW. Re-checks readiness at review time so
  // riskSnapshot reflects conditions as of the review, not just the original
  // request (see model comment in schema.prisma).
  // ---------------------------------------------------------------------------

  async review(requestId: string, dto: ReviewContractCloseoutRequestDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.close')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.close' });
    }
    const existing = await this.loadRequestForCloseout(requestId, actor);

    if (existing.status !== 'SUBMITTED') {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_CLOSEOUT_REQUEST_INVALID_TRANSITION',
        message: `Cannot start review for a request with status ${existing.status}.`,
      });
    }

    const checks = await this.computeChecksForContract(existing.contractId);
    const riskSnapshot = toRiskSnapshot(checks);
    const now = new Date();

    const updated = await this.db.getClient().$transaction(async (tx) => {
      const request = await tx.contractCloseoutRequest.update({
        where: { id: requestId },
        data: {
          status: 'UNDER_REVIEW',
          reviewedByUserId: actor.id,
          reviewedAt: now,
          riskSnapshot: riskSnapshot as never,
          ...(dto.reviewRemarks !== undefined ? { reviewRemarks: dto.reviewRemarks } : {}),
        },
        select: REQUEST_SELECT,
      });

      await tx.contractActivity.create({
        data: {
          contractId: existing.contractId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'closeout_review_started',
          metadata: { requestId, requestNo: request.requestNo },
        },
      });

      return request;
    });

    return withRequestDerivedFields(updated);
  }

  // ---------------------------------------------------------------------------
  // Approve — SUBMITTED or UNDER_REVIEW -> APPROVED. Never closes the
  // contract itself (that's the separate closeContract action below).
  // ---------------------------------------------------------------------------

  async approve(requestId: string, dto: ReviewContractCloseoutRequestDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.close')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.close' });
    }
    const existing = await this.loadRequestForCloseout(requestId, actor);

    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(existing.status)) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_CLOSEOUT_REQUEST_INVALID_TRANSITION',
        message: `Cannot approve a request with status ${existing.status}.`,
      });
    }

    const now = new Date();

    const updated = await this.db.getClient().$transaction(async (tx) => {
      const request = await tx.contractCloseoutRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedAt: now,
          reviewedByUserId: actor.id,
          ...(existing.status === 'UNDER_REVIEW' ? {} : { reviewedAt: now }),
          ...(dto.reviewRemarks !== undefined ? { reviewRemarks: dto.reviewRemarks } : {}),
        },
        select: REQUEST_SELECT,
      });

      await tx.contractActivity.create({
        data: {
          contractId: existing.contractId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'closeout_approved',
          metadata: { requestId, requestNo: request.requestNo },
        },
      });

      return request;
    });

    return withRequestDerivedFields(updated);
  }

  // ---------------------------------------------------------------------------
  // Reject — SUBMITTED or UNDER_REVIEW -> REJECTED. Contract remains open; a
  // new request may be submitted afterward.
  // ---------------------------------------------------------------------------

  async reject(requestId: string, dto: RejectContractCloseoutRequestDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.close')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.close' });
    }
    const existing = await this.loadRequestForCloseout(requestId, actor);

    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(existing.status)) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_CLOSEOUT_REQUEST_INVALID_TRANSITION',
        message: `Cannot reject a request with status ${existing.status}.`,
      });
    }

    const now = new Date();

    const updated = await this.db.getClient().$transaction(async (tx) => {
      const request = await tx.contractCloseoutRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          rejectedAt: now,
          rejectionReason: dto.rejectionReason,
          reviewedByUserId: actor.id,
          ...(existing.status === 'UNDER_REVIEW' ? {} : { reviewedAt: now }),
        },
        select: REQUEST_SELECT,
      });

      await tx.contractActivity.create({
        data: {
          contractId: existing.contractId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'closeout_rejected',
          metadata: { requestId, requestNo: request.requestNo, rejectionReason: dto.rejectionReason },
        },
      });

      return request;
    });

    return withRequestDerivedFields(updated);
  }

  // ---------------------------------------------------------------------------
  // Final close — requires an APPROVED request. Atomically closes the
  // contract AND the request together so they can never disagree.
  // ---------------------------------------------------------------------------

  async closeContract(requestId: string, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.close')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.close' });
    }
    const existing = await this.loadRequestForCloseout(requestId, actor);

    if (existing.status !== 'APPROVED') {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_CLOSEOUT_APPROVAL_REQUIRED',
        message: 'Closure approval is required before closing this contract.',
      });
    }
    if (existing.contract.status !== ContractStatus.ACTIVE && existing.contract.status !== ContractStatus.TERMINATED) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_INVALID_TRANSITION',
        message: `Cannot close a contract with status ${String(existing.contract.status)}`,
      });
    }

    const now = new Date();
    const currentStatus = existing.contract.status;

    const updated = await this.db.getClient().$transaction(async (tx) => {
      const contractResult = await tx.contract.updateMany({
        where: { id: existing.contractId, status: currentStatus, version: existing.contract.version },
        data: {
          status: ContractStatus.CLOSED,
          closedAt: now,
          closedByUserId: actor.id,
          version: { increment: 1 },
        },
      });
      if (contractResult.count === 0) {
        throw new ConflictException({
          code: 'CONTRACT_VERSION_CONFLICT',
          message: 'Contract was modified concurrently; please reload and retry',
        });
      }

      const request = await tx.contractCloseoutRequest.update({
        where: { id: requestId },
        data: { status: 'CLOSED', closedAt: now },
        select: REQUEST_SELECT,
      });

      await tx.contractActivity.create({
        data: {
          contractId: existing.contractId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'closed',
          previousStatus: currentStatus,
          newStatus: ContractStatus.CLOSED,
          metadata: { requestId, requestNo: request.requestNo, viaCloseoutApproval: true },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'CONTRACT_CLOSED',
          userId: existing.contract.ownerUserId,
          actorId: actor.id,
          metadata: {
            contractId: existing.contractId,
            referenceNumber: existing.contract.referenceNumber,
            previousStatus: currentStatus,
            newStatus: ContractStatus.CLOSED,
            departmentId: existing.contract.departmentId,
            closeoutRequestId: requestId,
          },
        },
      });

      return request;
    });

    return withRequestDerivedFields(updated);
  }

  // ---------------------------------------------------------------------------
  // Attachments — metadata + storage-relative path only; binary data lives on
  // disk via CloseoutAttachmentStorageService, never in the database.
  // ---------------------------------------------------------------------------

  async listAttachments(requestId: string, actor: AuthUser): Promise<unknown[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    await this.loadRequestForCloseout(requestId, actor);

    return this.db.getClient().contractCloseoutAttachment.findMany({
      where: { closeoutRequestId: requestId },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true, closeoutRequestId: true, fileName: true, originalFileName: true, mimeType: true, fileSize: true,
        uploadedByUserId: true, createdAt: true,
        uploadedByUser: { select: { id: true, displayName: true } },
      },
    });
  }

  async createAttachment(
    requestId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actor: AuthUser,
  ): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }
    const existing = await this.loadRequestForCloseout(requestId, actor);

    if (!(CLOSEOUT_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_CLOSEOUT_ATTACHMENT_INVALID_TYPE',
        message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
      });
    }
    if (file.size > CLOSEOUT_ATTACHMENT_MAX_BYTES) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_CLOSEOUT_ATTACHMENT_TOO_LARGE',
        message: `File exceeds the ${CLOSEOUT_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB upload limit.`,
      });
    }

    const { fileName, storagePath } = await this.attachmentStorage.save(requestId, file.buffer, file.originalname);

    const created = await this.db.getClient().$transaction(async (tx) => {
      const attachment = await tx.contractCloseoutAttachment.create({
        data: {
          closeoutRequestId: requestId,
          fileName,
          originalFileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          storagePath,
          uploadedByUserId: actor.id,
        },
        select: {
          id: true, closeoutRequestId: true, fileName: true, originalFileName: true, mimeType: true, fileSize: true,
          uploadedByUserId: true, createdAt: true,
          uploadedByUser: { select: { id: true, displayName: true } },
        },
      });

      await tx.contractActivity.create({
        data: {
          contractId: existing.contractId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'closeout_attachment_uploaded',
          metadata: { requestId, fileName: file.originalname },
        },
      });

      return attachment;
    });

    return created;
  }

  async getAttachmentForDownload(
    requestId: string,
    attachmentId: string,
    actor: AuthUser,
  ): Promise<{ storagePath: string; originalFileName: string; mimeType: string }> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const attachment = await this.db.getClient().contractCloseoutAttachment.findFirst({
      where: { id: attachmentId, closeoutRequestId: requestId },
      select: {
        storagePath: true,
        originalFileName: true,
        mimeType: true,
        closeoutRequest: { select: { contract: { select: { departmentId: true } } } },
      },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'CONTRACT_CLOSEOUT_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      attachment.closeoutRequest.contract.departmentId,
    );

    return {
      storagePath: attachment.storagePath,
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
    };
  }
}
