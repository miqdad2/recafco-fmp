import { Injectable, ForbiddenException } from '@nestjs/common';
import { ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import { computeTaskIsOverdue } from './contract-workflow.service';
import { computeIssueIsOverdue, computeIssueOverdueDays } from './contract-issues.service';
import { computeClaimIsOverdue, computeClaimOverdueDays, computeOutstandingValue as computeClaimOutstanding } from './contract-claims.service';
import { computeOverdueDays as computePaymentOverdueDays, computeOutstandingAmount as computePaymentOutstanding } from './contract-payments.service';
import type { AuthUser } from '../common/types/auth-user';
import type { ContractScheduleListQueryDto } from './dto/contract-schedule-list-query.dto';

// ---------------------------------------------------------------------------
// CM-34 — read-only schedule aggregation. No new table: every item is derived
// live from Contract/ContractWorkflowTask/ContractIssue/ContractClaim/
// ContractPayment/ContractCloseoutRequest, the existing source-of-truth rows
// for those modules. Overdue logic for WORKFLOW_TASK/ISSUE_DUE/CLAIM_DUE/
// PAYMENT_DUE deliberately REUSES each owning module's own already-audited
// pure function (computeTaskIsOverdue, computeIssueIsOverdue, etc.) rather
// than re-deriving a fourth definition — the one exception is CONTRACT_END/
// FORECAST_COMPLETION, which have no equivalent elsewhere, so a small
// contract-status-based rule is defined locally (see contractItemStatus /
// isContractDateOverdue below).
// ---------------------------------------------------------------------------

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function diffDays(today: Date, date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export const SCHEDULE_ITEM_TYPES = [
  'CONTRACT_START', 'CONTRACT_END', 'FORECAST_COMPLETION', 'WORKFLOW_TASK',
  'ISSUE_DUE', 'CLAIM_DUE', 'PAYMENT_DUE', 'CLOSEOUT_REQUEST', 'CLOSEOUT_APPROVAL', 'CLOSEOUT_CLOSED',
] as const;
export type ScheduleItemType = (typeof SCHEDULE_ITEM_TYPES)[number];

export interface ScheduleItem {
  id: string;
  sourceType: ScheduleItemType;
  sourceId: string;
  contractId: string;
  contractReference: string;
  contractTitle: string;
  companyName: string;
  department: { id: string; name: string } | null;
  title: string;
  description: string | null;
  date: string;
  status: string;
  priority: string | null;
  responsibleUser: { id: string; displayName: string } | null;
  amount: string | null;
  currency: string | null;
  isOverdue: boolean;
  overdueDays: number | null;
  actionUrl: string;
}

interface ContractSourceRow {
  id: string;
  referenceNumber: string;
  title: string;
  counterpartyName: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  forecastCompletionDate: Date | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  currency: string | null;
  ownerUser: { id: string; displayName: string };
}

// ---------------------------------------------------------------------------
// Contract-derived items (start/end/forecast). Never overdue: CONTRACT_START
// is a fixed historical/planned marker, not a deadline. CONTRACT_END and
// FORECAST_COMPLETION ARE deadline-like — overdue when the date has passed
// and the contract hasn't reached CLOSED yet.
// ---------------------------------------------------------------------------

function contractItemStatus(kind: 'CONTRACT_START' | 'CONTRACT_END' | 'FORECAST_COMPLETION', contract: ContractSourceRow, today: Date): string {
  if (contract.status === 'CLOSED') return 'Closed';
  if (kind === 'CONTRACT_END' && contract.endDate && contract.endDate < today) return 'Ended';
  if (kind === 'FORECAST_COMPLETION' && contract.forecastCompletionDate && contract.forecastCompletionDate < today) return 'Forecast Due';
  if (kind === 'CONTRACT_START' && contract.startDate && contract.startDate > today) return 'Upcoming';
  return 'Active';
}

export function contractToScheduleItems(contract: ContractSourceRow, today: Date = utcToday()): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  const base = {
    contractId: contract.id,
    contractReference: contract.referenceNumber,
    contractTitle: contract.title,
    companyName: contract.counterpartyName,
    department: contract.department,
    responsibleUser: contract.ownerUser,
    amount: null,
    currency: null,
    priority: null,
  };

  if (contract.startDate) {
    items.push({
      ...base,
      id: `CONTRACT_START:${contract.id}`,
      sourceType: 'CONTRACT_START',
      sourceId: contract.id,
      title: 'Contract Start',
      description: null,
      date: isoDate(contract.startDate),
      status: contractItemStatus('CONTRACT_START', contract, today),
      isOverdue: false,
      overdueDays: null,
      actionUrl: `/contracts/${contract.id}`,
    });
  }

  if (contract.endDate) {
    const overdue = contract.status !== 'CLOSED' && contract.endDate < today;
    items.push({
      ...base,
      id: `CONTRACT_END:${contract.id}`,
      sourceType: 'CONTRACT_END',
      sourceId: contract.id,
      title: 'Contract End',
      description: null,
      date: isoDate(contract.endDate),
      status: contractItemStatus('CONTRACT_END', contract, today),
      isOverdue: overdue,
      overdueDays: overdue ? diffDays(today, contract.endDate) : null,
      actionUrl: `/contracts/${contract.id}`,
    });
  }

  if (contract.forecastCompletionDate) {
    const overdue = contract.status !== 'CLOSED' && contract.forecastCompletionDate < today;
    items.push({
      ...base,
      id: `FORECAST_COMPLETION:${contract.id}`,
      sourceType: 'FORECAST_COMPLETION',
      sourceId: contract.id,
      title: 'Forecast Completion',
      description: null,
      date: isoDate(contract.forecastCompletionDate),
      status: contractItemStatus('FORECAST_COMPLETION', contract, today),
      isOverdue: overdue,
      overdueDays: overdue ? diffDays(today, contract.forecastCompletionDate) : null,
      actionUrl: `/contracts/${contract.id}`,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Workflow task -> WORKFLOW_TASK item. Skipped when the task has no dueDate
// (nothing to schedule). Reuses computeTaskIsOverdue from CM-32 verbatim.
// ---------------------------------------------------------------------------

interface WorkflowTaskSourceRow {
  id: string;
  taskName: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  responsibleUser: { id: string; displayName: string } | null;
}

export function workflowTaskToScheduleItem(
  task: WorkflowTaskSourceRow,
  contract: ContractSourceRow,
  today: Date = utcToday(),
): ScheduleItem | null {
  if (!task.dueDate) return null;
  const overdue = computeTaskIsOverdue({ status: task.status, dueDate: task.dueDate }, today);
  return {
    id: `WORKFLOW_TASK:${task.id}`,
    sourceType: 'WORKFLOW_TASK',
    sourceId: task.id,
    contractId: contract.id,
    contractReference: contract.referenceNumber,
    contractTitle: contract.title,
    companyName: contract.counterpartyName,
    department: contract.department,
    title: task.taskName,
    description: null,
    date: isoDate(task.dueDate),
    status: task.status,
    priority: task.priority,
    responsibleUser: task.responsibleUser,
    amount: null,
    currency: null,
    isOverdue: overdue,
    overdueDays: overdue ? diffDays(today, task.dueDate) : null,
    actionUrl: `/contracts/${contract.id}/workflow`,
  };
}

// ---------------------------------------------------------------------------
// Issue -> ISSUE_DUE. Reuses computeIssueIsOverdue/computeIssueOverdueDays
// from CM-30 verbatim.
// ---------------------------------------------------------------------------

interface IssueSourceRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  responsibleUser: { id: string; displayName: string } | null;
}

export function issueToScheduleItem(
  issue: IssueSourceRow,
  contract: ContractSourceRow,
  today: Date = utcToday(),
): ScheduleItem | null {
  if (!issue.dueDate) return null;
  const overdue = computeIssueIsOverdue({ status: issue.status, dueDate: issue.dueDate }, today);
  return {
    id: `ISSUE_DUE:${issue.id}`,
    sourceType: 'ISSUE_DUE',
    sourceId: issue.id,
    contractId: contract.id,
    contractReference: contract.referenceNumber,
    contractTitle: contract.title,
    companyName: contract.counterpartyName,
    department: contract.department,
    title: issue.title,
    description: null,
    date: isoDate(issue.dueDate),
    status: issue.status,
    priority: issue.priority,
    responsibleUser: issue.responsibleUser,
    amount: null,
    currency: null,
    isOverdue: overdue,
    overdueDays: overdue ? computeIssueOverdueDays({ status: issue.status, dueDate: issue.dueDate }, today) : null,
    actionUrl: `/contracts/${contract.id}/issues`,
  };
}

// ---------------------------------------------------------------------------
// Claim -> CLAIM_DUE. Reuses computeClaimIsOverdue/computeClaimOverdueDays
// from CM-31 verbatim. amount = outstanding value (submitted - approved).
// ---------------------------------------------------------------------------

interface ClaimSourceRow {
  id: string;
  claimTitle: string;
  status: string;
  dueDate: Date | null;
  responsibleUser: { id: string; displayName: string } | null;
  submittedValue: unknown;
  approvedValue: unknown;
}

export function claimToScheduleItem(
  claim: ClaimSourceRow,
  contract: ContractSourceRow,
  today: Date = utcToday(),
): ScheduleItem | null {
  if (!claim.dueDate) return null;
  const overdue = computeClaimIsOverdue({ status: claim.status, dueDate: claim.dueDate }, today);
  const outstanding = computeClaimOutstanding({ submittedValue: claim.submittedValue, approvedValue: claim.approvedValue });
  return {
    id: `CLAIM_DUE:${claim.id}`,
    sourceType: 'CLAIM_DUE',
    sourceId: claim.id,
    contractId: contract.id,
    contractReference: contract.referenceNumber,
    contractTitle: contract.title,
    companyName: contract.counterpartyName,
    department: contract.department,
    title: claim.claimTitle,
    description: null,
    date: isoDate(claim.dueDate),
    status: claim.status,
    priority: null,
    responsibleUser: claim.responsibleUser,
    amount: outstanding !== null ? outstanding.toFixed(3) : null,
    currency: contract.currency,
    isOverdue: overdue,
    overdueDays: overdue ? computeClaimOverdueDays({ status: claim.status, dueDate: claim.dueDate }, today) : null,
    actionUrl: `/contracts/${contract.id}/claims`,
  };
}

// ---------------------------------------------------------------------------
// Payment -> PAYMENT_DUE. Reuses computeOverdueDays/computeOutstandingAmount
// from CM-28 verbatim. Payments have no responsibleUserId field, so
// responsibleUser is always null here.
// ---------------------------------------------------------------------------

interface PaymentSourceRow {
  id: string;
  paymentNo: string | null;
  invoiceNumber: string | null;
  status: string;
  dueDate: Date | null;
  submittedAmount: unknown;
  certifiedAmount: unknown;
  paidAmount: unknown;
}

export function paymentToScheduleItem(
  payment: PaymentSourceRow,
  contract: ContractSourceRow,
  today: Date = utcToday(),
): ScheduleItem | null {
  if (!payment.dueDate) return null;
  const overdueDays = computePaymentOverdueDays({ status: payment.status, dueDate: payment.dueDate }, today);
  const outstanding = computePaymentOutstanding({
    submittedAmount: payment.submittedAmount,
    certifiedAmount: payment.certifiedAmount,
    paidAmount: payment.paidAmount,
  });
  return {
    id: `PAYMENT_DUE:${payment.id}`,
    sourceType: 'PAYMENT_DUE',
    sourceId: payment.id,
    contractId: contract.id,
    contractReference: contract.referenceNumber,
    contractTitle: contract.title,
    companyName: contract.counterpartyName,
    department: contract.department,
    title: payment.paymentNo ?? payment.invoiceNumber ?? 'Payment',
    description: null,
    date: isoDate(payment.dueDate),
    status: payment.status,
    priority: null,
    responsibleUser: null,
    amount: outstanding !== null ? outstanding.toFixed(3) : null,
    currency: contract.currency,
    isOverdue: overdueDays !== null,
    overdueDays,
    actionUrl: `/contracts/${contract.id}/payments`,
  };
}

// ---------------------------------------------------------------------------
// Closeout request -> up to 3 items (requested/approved/closed). These are
// point-in-time timeline markers, not due dates — requestedAt is inherently
// always in the past the moment a request exists, so applying date-vs-today
// overdue logic here would flag every request as overdue from day one. All
// three closeout item types are therefore NEVER marked overdue.
// ---------------------------------------------------------------------------

interface CloseoutRequestSourceRow {
  id: string;
  requestNo: string;
  status: string;
  requestedAt: Date;
  approvedAt: Date | null;
  closedAt: Date | null;
  requestedByUser: { id: string; displayName: string };
}

export function closeoutRequestToScheduleItems(
  request: CloseoutRequestSourceRow,
  contract: ContractSourceRow,
): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  const base = {
    contractId: contract.id,
    contractReference: contract.referenceNumber,
    contractTitle: contract.title,
    companyName: contract.counterpartyName,
    department: contract.department,
    responsibleUser: request.requestedByUser,
    amount: null,
    currency: null,
    priority: null,
    status: request.status,
    isOverdue: false,
    overdueDays: null,
    actionUrl: `/contracts/${contract.id}/closeout`,
  };

  items.push({
    ...base,
    id: `CLOSEOUT_REQUEST:${request.id}`,
    sourceType: 'CLOSEOUT_REQUEST',
    sourceId: request.id,
    title: `Closeout Requested — ${request.requestNo}`,
    description: null,
    date: isoDate(request.requestedAt),
  });

  if (request.approvedAt) {
    items.push({
      ...base,
      id: `CLOSEOUT_APPROVAL:${request.id}`,
      sourceType: 'CLOSEOUT_APPROVAL',
      sourceId: request.id,
      title: `Closeout Approved — ${request.requestNo}`,
      description: null,
      date: isoDate(request.approvedAt),
    });
  }

  if (request.closedAt) {
    items.push({
      ...base,
      id: `CLOSEOUT_CLOSED:${request.id}`,
      sourceType: 'CLOSEOUT_CLOSED',
      sourceId: request.id,
      title: `Contract Closed — ${request.requestNo}`,
      description: null,
      date: isoDate(request.closedAt),
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Item-level filtering, sorting, and summary — pure, exported for tests.
// ---------------------------------------------------------------------------

export function filterScheduleItems(items: ScheduleItem[], query: ContractScheduleListQueryDto, today: Date = utcToday()): ScheduleItem[] {
  let filtered = items;
  if (query.itemType) filtered = filtered.filter((i) => i.sourceType === query.itemType);
  if (query.status) filtered = filtered.filter((i) => i.status === query.status);
  if (query.responsibleUserId) filtered = filtered.filter((i) => i.responsibleUser?.id === query.responsibleUserId);
  if (query.dateFrom) filtered = filtered.filter((i) => i.date >= query.dateFrom!);
  if (query.dateTo) filtered = filtered.filter((i) => i.date <= query.dateTo!);
  if (query.overdueOnly) filtered = filtered.filter((i) => i.isOverdue);
  if (query.upcomingOnly) {
    const todayIso = isoDate(today);
    filtered = filtered.filter((i) => i.date >= todayIso);
  }
  return filtered;
}

export function sortScheduleItems(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export interface ScheduleSummary {
  totalItems: number;
  upcomingThisWeek: number;
  dueToday: number;
  overdueItems: number;
  workflowDue: number;
  paymentDue: number;
  issueClaimDue: number;
  contractsEndingSoon: number;
}

const ENDING_SOON_WINDOW_DAYS = 30;

export function computeScheduleSummary(items: ScheduleItem[], today: Date = utcToday()): ScheduleSummary {
  const todayIso = isoDate(today);
  const weekAheadIso = isoDate(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000));
  const endingSoonIso = isoDate(new Date(today.getTime() + ENDING_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000));

  let upcomingThisWeek = 0;
  let dueToday = 0;
  let overdueItems = 0;
  let workflowDue = 0;
  let paymentDue = 0;
  let issueClaimDue = 0;
  const endingSoonContracts = new Set<string>();

  for (const item of items) {
    if (item.date === todayIso) dueToday += 1;
    if (item.date >= todayIso && item.date <= weekAheadIso) upcomingThisWeek += 1;
    if (item.isOverdue) overdueItems += 1;
    if (item.sourceType === 'WORKFLOW_TASK') workflowDue += 1;
    if (item.sourceType === 'PAYMENT_DUE') paymentDue += 1;
    if (item.sourceType === 'ISSUE_DUE' || item.sourceType === 'CLAIM_DUE') issueClaimDue += 1;
    if (
      (item.sourceType === 'CONTRACT_END' || item.sourceType === 'FORECAST_COMPLETION') &&
      (item.isOverdue || item.date <= endingSoonIso)
    ) {
      endingSoonContracts.add(item.contractId);
    }
  }

  return {
    totalItems: items.length,
    upcomingThisWeek,
    dueToday,
    overdueItems,
    workflowDue,
    paymentDue,
    issueClaimDue,
    contractsEndingSoon: endingSoonContracts.size,
  };
}

// ---------------------------------------------------------------------------
// Candidate-contract where builder (search/departmentId/ownerUserId/contractId)
// — exported for tests. Department scope is combined in by the service, which
// knows the live dept-access scope.
// ---------------------------------------------------------------------------

export function buildScheduleContractWhere(query: ContractScheduleListQueryDto): Record<string, unknown> {
  // CM-69A — a cancelled/voided contract is never a scheduling concern; it
  // is unconditionally excluded here (this old register has no
  // cancelled-status filter of its own), same as the newer global schedule
  // overview (contract-schedule-overview.service.ts).
  const where: Record<string, unknown> = { status: { not: 'CANCELLED' } };
  const and: Record<string, unknown>[] = [];

  if (query.contractId) where['id'] = query.contractId;
  if (query.departmentId) and.push({ departmentId: query.departmentId });
  if (query.ownerUserId) and.push({ ownerUserId: query.ownerUserId });

  if (query.search?.trim()) {
    const s = query.search.trim();
    and.push({
      OR: [
        { referenceNumber: { contains: s, mode: 'insensitive' } },
        { title: { contains: s, mode: 'insensitive' } },
        { counterpartyName: { contains: s, mode: 'insensitive' } },
      ],
    });
  }

  if (and.length > 0) where['AND'] = and;
  return where;
}

const CONTRACT_SCHEDULE_SELECT = {
  id: true,
  referenceNumber: true,
  title: true,
  counterpartyName: true,
  status: true,
  startDate: true,
  endDate: true,
  forecastCompletionDate: true,
  departmentId: true,
  currency: true,
  department: { select: { id: true, name: true } },
  ownerUser: { select: { id: true, displayName: true } },
} as const;

const WORKFLOW_TASK_SCHEDULE_SELECT = {
  id: true,
  contractId: true,
  taskName: true,
  status: true,
  priority: true,
  dueDate: true,
  responsibleUser: { select: { id: true, displayName: true } },
} as const;

const ISSUE_SCHEDULE_SELECT = {
  id: true,
  contractId: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  responsibleUser: { select: { id: true, displayName: true } },
} as const;

const CLAIM_SCHEDULE_SELECT = {
  id: true,
  contractId: true,
  claimTitle: true,
  status: true,
  dueDate: true,
  submittedValue: true,
  approvedValue: true,
  responsibleUser: { select: { id: true, displayName: true } },
} as const;

const PAYMENT_SCHEDULE_SELECT = {
  id: true,
  contractId: true,
  paymentNo: true,
  invoiceNumber: true,
  status: true,
  dueDate: true,
  submittedAmount: true,
  certifiedAmount: true,
  paidAmount: true,
} as const;

const CLOSEOUT_REQUEST_SCHEDULE_SELECT = {
  id: true,
  contractId: true,
  requestNo: true,
  status: true,
  requestedAt: true,
  approvedAt: true,
  closedAt: true,
  requestedByUser: { select: { id: true, displayName: true } },
} as const;

// A cap on how many contracts the module-level schedule will pull in before
// pagination — generous for current data volumes without risking an
// unbounded query. Same pattern as CM-28/29's module-level registers.
const SCHEDULE_CONTRACT_CAP = 1000;

export interface PaginatedScheduleResult {
  items: ScheduleItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: ScheduleSummary;
}

@Injectable()
export class ContractScheduleService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  private async buildItemsForContracts(contracts: ContractSourceRow[], today: Date): Promise<ScheduleItem[]> {
    const contractIds = contracts.map((c) => c.id);
    if (contractIds.length === 0) return [];

    const contractsById = new Map(contracts.map((c) => [c.id, c]));

    const [workflowTasks, issues, claims, payments, closeoutRequests] = await Promise.all([
      this.db.getClient().contractWorkflowTask.findMany({ where: { contractId: { in: contractIds } }, select: WORKFLOW_TASK_SCHEDULE_SELECT }),
      this.db.getClient().contractIssue.findMany({ where: { contractId: { in: contractIds } }, select: ISSUE_SCHEDULE_SELECT }),
      this.db.getClient().contractClaim.findMany({ where: { contractId: { in: contractIds } }, select: CLAIM_SCHEDULE_SELECT }),
      this.db.getClient().contractPayment.findMany({ where: { contractId: { in: contractIds } }, select: PAYMENT_SCHEDULE_SELECT }),
      this.db.getClient().contractCloseoutRequest.findMany({ where: { contractId: { in: contractIds } }, select: CLOSEOUT_REQUEST_SCHEDULE_SELECT }),
    ]);

    const items: ScheduleItem[] = [];
    for (const contract of contracts) {
      items.push(...contractToScheduleItems(contract, today));
    }
    for (const task of workflowTasks) {
      const contract = contractsById.get(task.contractId);
      if (!contract) continue;
      const item = workflowTaskToScheduleItem(task, contract, today);
      if (item) items.push(item);
    }
    for (const issue of issues) {
      const contract = contractsById.get(issue.contractId);
      if (!contract) continue;
      const item = issueToScheduleItem(issue, contract, today);
      if (item) items.push(item);
    }
    for (const claim of claims) {
      const contract = contractsById.get(claim.contractId);
      if (!contract) continue;
      const item = claimToScheduleItem(claim, contract, today);
      if (item) items.push(item);
    }
    for (const payment of payments) {
      const contract = contractsById.get(payment.contractId);
      if (!contract) continue;
      const item = paymentToScheduleItem(payment, contract, today);
      if (item) items.push(item);
    }
    for (const request of closeoutRequests) {
      const contract = contractsById.get(request.contractId);
      if (!contract) continue;
      items.push(...closeoutRequestToScheduleItems(request, contract));
    }

    return items;
  }

  // ---------------------------------------------------------------------------
  // Module-level list — paginated + filtered, scoped by department access,
  // with summary computed over the FULL filtered set (not just the page).
  // ---------------------------------------------------------------------------

  async findAll(query: ContractScheduleListQueryDto, actor: AuthUser): Promise<PaginatedScheduleResult> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const today = utcToday();

    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT);
    const where = buildScheduleContractWhere(query);
    if (deptFilter !== null) {
      const and = (where['AND'] as Record<string, unknown>[] | undefined) ?? [];
      and.push({ departmentId: deptFilter });
      where['AND'] = and;
    }

    const contracts = await this.db.getClient().contract.findMany({
      where,
      select: CONTRACT_SCHEDULE_SELECT,
      orderBy: [{ createdAt: 'desc' }],
      take: SCHEDULE_CONTRACT_CAP,
    });

    const allItems = await this.buildItemsForContracts(contracts, today);
    const filtered = sortScheduleItems(filterScheduleItems(allItems, query, today));

    const total = filtered.length;
    const skip = (page - 1) * pageSize;
    const pageItems = filtered.slice(skip, skip + pageSize);

    return {
      items: pageItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      summary: computeScheduleSummary(filtered, today),
    };
  }

  // CM-68A — the old single-contract due-date aggregation (findAllForContract)
  // was removed: audit confirmed its ONLY consumer was the per-contract
  // Schedule tab (GET :id/schedule), which now calls
  // ContractSchedulePlanService.getScheduleDetail() instead (the real
  // Planned vs Actual view). buildItemsForContracts()/findAll() above are
  // UNCHANGED — the module-level register (GET /contracts/schedule) still
  // uses them and was not touched.
}
