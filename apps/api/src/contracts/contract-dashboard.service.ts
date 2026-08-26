import { Injectable, ForbiddenException } from '@nestjs/common';
import { ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import { ContractsService } from './contracts.service';
import { ContractScheduleService } from './contract-schedule.service';
import { computeTaskIsOverdue } from './contract-workflow.service';
import { computeIssueSummary } from './contract-issues.service';
import { computeClaimSummary } from './contract-claims.service';
import { computeOverdueDays as computePaymentOverdueDays, computeOutstandingAmount as computePaymentOutstanding } from './contract-payments.service';
import type { AuthUser } from '../common/types/auth-user';
import type { ScheduleItem } from './contract-schedule.service';
import type { ContractScheduleListQueryDto } from './dto/contract-schedule-list-query.dto';

// ---------------------------------------------------------------------------
// CM-37 — role-based Contract dashboard. Deliberately NO new table: every
// field below is derived live from Contract/ContractWorkflowTask/
// ContractIssue/ContractClaim/ContractPayment/ContractCloseoutRequest, the
// same source-of-truth rows every other contracts sub-module already reads.
//
// dashboardType is permission-driven only (never role-code), per the CM-35
// precedent this unit continues: contracts.update OR contracts.close ->
// MANAGER; everything else (including a bare contracts.workflow_update
// staff actor, or a plain VIEWER) -> STAFF, the safer/least-privileged
// default. This single rule already covers every case the spec names
// (Contract Manager, Contract Management User legacy, Super Admin, Admin all
// carry contracts.update; Contract Staff does not) without special-casing
// role codes.
//
// Overdue/open/outstanding logic REUSES each owning module's own
// already-audited pure function (computeTaskIsOverdue, computeIssueSummary,
// computeClaimSummary, computeOverdueDays/computeOutstandingAmount) — the
// same "reuse, don't re-derive" choice CM-34's schedule service made. The
// exceptions (FINAL_ISSUE_STATUSES_FOR_DASHBOARD etc. below) are this unit's
// OWN "does this belong in the manager's attention list" judgment call,
// deliberately separate from closeout's private readiness lists (see CM-33)
// — a different question ("is this ready to close the contract?" vs "should
// the manager glance at this today?").
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

// ---------------------------------------------------------------------------
// Dashboard type — permissions only.
// ---------------------------------------------------------------------------

export type ContractDashboardType = 'MANAGER' | 'STAFF';

export function computeContractDashboardType(permissions: string[]): ContractDashboardType {
  return permissions.includes('contracts.update') || permissions.includes('contracts.close') ? 'MANAGER' : 'STAFF';
}

// ---------------------------------------------------------------------------
// Shared row shapes (Prisma select results feed these directly).
// ---------------------------------------------------------------------------

export interface DashboardContractRow {
  id: string;
  referenceNumber: string;
  title: string;
  status: string;
  createdAt: Date;
  endDate: Date | null;
  forecastCompletionDate: Date | null;
  counterpartyName: string;
}

export interface DashboardTaskRow {
  id: string;
  contractId: string;
  taskName: string;
  team: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  responsibleUserId: string | null;
  lastActivityAt: Date;
}

export interface DashboardIssueRow {
  id: string;
  contractId: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
}

export interface DashboardClaimRow {
  id: string;
  contractId: string;
  claimTitle: string;
  status: string;
  dueDate: Date | null;
  submittedValue: unknown;
  approvedValue: unknown;
}

export interface DashboardPaymentRow {
  id: string;
  contractId: string;
  paymentNo: string | null;
  invoiceNumber: string | null;
  status: string;
  dueDate: Date | null;
  submittedAmount: unknown;
  certifiedAmount: unknown;
  paidAmount: unknown;
}

export interface DashboardCloseoutRequestRow {
  id: string;
  contractId: string;
  requestNo: string;
  status: string;
  requestedAt: Date;
}

// ---------------------------------------------------------------------------
// Workflow Assignment Overview — grouped by team.
// ---------------------------------------------------------------------------

export const WORKFLOW_TEAMS = ['TECHNICAL', 'PRODUCTION', 'ERECTION', 'QS_COMMERCIAL'] as const;
export type WorkflowTeam = (typeof WORKFLOW_TEAMS)[number];

export interface TeamWorkflowOverview {
  team: WorkflowTeam;
  openTasks: number;
  unassignedTasks: number;
  overdueTasks: number;
  completedTasks: number;
}

export function buildWorkflowOverview(tasks: DashboardTaskRow[], today: Date = utcToday()): TeamWorkflowOverview[] {
  return WORKFLOW_TEAMS.map((team) => {
    const teamTasks = tasks.filter((t) => t.team === team);
    return {
      team,
      openTasks: teamTasks.filter((t) => t.status !== 'COMPLETED').length,
      unassignedTasks: teamTasks.filter((t) => !t.responsibleUserId && t.status !== 'COMPLETED').length,
      overdueTasks: teamTasks.filter((t) => computeTaskIsOverdue(t, today)).length,
      completedTasks: teamTasks.filter((t) => t.status === 'COMPLETED').length,
    };
  });
}

// ---------------------------------------------------------------------------
// Contracts Requiring Manager Action.
// ---------------------------------------------------------------------------

export const MANAGER_ATTENTION_ACTION_TYPES = [
  'ACTIVATE_CONTRACT', 'ASSIGN_TASKS', 'OVERDUE_TASK', 'OPEN_ISSUE', 'OPEN_CLAIM',
  'OUTSTANDING_PAYMENT', 'CLOSEOUT_REVIEW', 'CONTRACT_ENDING_SOON',
] as const;
export type ManagerAttentionActionType = (typeof MANAGER_ATTENTION_ACTION_TYPES)[number];

export interface ManagerAttentionItem {
  key: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  actionType: ManagerAttentionActionType;
  contractId: string;
  contractReference: string;
  contractTitle: string;
  description: string;
  date: string | null;
  isOverdue: boolean;
  overdueDays: number | null;
  actionUrl: string;
  actionLabel: string;
}

// This unit's own definition of "belongs in the manager's attention list" —
// deliberately not imported from contract-closeout.service.ts's private
// readiness lists (see file header). Conservative: only truly final states
// are excluded, matching each source module's own "open" framing.
const FINAL_ISSUE_STATUSES_FOR_DASHBOARD = ['CLOSED', 'CANCELLED'];
const FINAL_CLAIM_STATUSES_FOR_DASHBOARD = ['APPROVED', 'REJECTED', 'SETTLED', 'CLOSED', 'CANCELLED'];
const FINAL_PAYMENT_STATUSES_FOR_DASHBOARD = ['PAID', 'CANCELLED'];
const PENDING_CLOSEOUT_STATUSES = ['SUBMITTED', 'UNDER_REVIEW'];
const CONTRACT_ENDING_SOON_WINDOW_DAYS = 30;

const ATTENTION_PRIORITY_RANK: Record<ManagerAttentionItem['priority'], number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function sortAttentionItems(items: ManagerAttentionItem[]): ManagerAttentionItem[] {
  return [...items].sort((a, b) => {
    const p = ATTENTION_PRIORITY_RANK[a.priority] - ATTENTION_PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    if (a.date === null && b.date === null) return 0;
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });
}

export function buildManagerAttentionItems(input: {
  contracts: DashboardContractRow[];
  tasks: DashboardTaskRow[];
  issues: DashboardIssueRow[];
  claims: DashboardClaimRow[];
  payments: DashboardPaymentRow[];
  closeoutRequests: DashboardCloseoutRequestRow[];
  today?: Date;
}): ManagerAttentionItem[] {
  const today = input.today ?? utcToday();
  const contractsById = new Map(input.contracts.map((c) => [c.id, c]));
  const items: ManagerAttentionItem[] = [];

  // 1. Draft contracts awaiting activation.
  for (const c of input.contracts) {
    if (c.status !== 'DRAFT') continue;
    items.push({
      key: `ACTIVATE_CONTRACT:${c.id}`,
      priority: 'MEDIUM',
      actionType: 'ACTIVATE_CONTRACT',
      contractId: c.id,
      contractReference: c.referenceNumber,
      contractTitle: c.title,
      description: 'Draft contract awaiting activation',
      date: isoDate(c.createdAt),
      isOverdue: false,
      overdueDays: null,
      actionUrl: `/contracts/${c.id}`,
      actionLabel: 'Activate Contract',
    });
  }

  // 2. Unassigned workflow tasks — grouped per contract, not per task.
  const unassignedByContract = new Map<string, number>();
  for (const t of input.tasks) {
    if (t.responsibleUserId || t.status === 'COMPLETED') continue;
    unassignedByContract.set(t.contractId, (unassignedByContract.get(t.contractId) ?? 0) + 1);
  }
  for (const [contractId, count] of unassignedByContract) {
    const c = contractsById.get(contractId);
    if (!c) continue;
    items.push({
      key: `ASSIGN_TASKS:${contractId}`,
      priority: 'HIGH',
      actionType: 'ASSIGN_TASKS',
      contractId,
      contractReference: c.referenceNumber,
      contractTitle: c.title,
      description: `${count} unassigned workflow task${count !== 1 ? 's' : ''}`,
      date: null,
      isOverdue: false,
      overdueDays: null,
      actionUrl: `/contracts/${contractId}/workflow`,
      actionLabel: 'Assign Tasks',
    });
  }

  // 3. Overdue workflow tasks — per task.
  for (const t of input.tasks) {
    if (!computeTaskIsOverdue(t, today)) continue;
    const c = contractsById.get(t.contractId);
    if (!c) continue;
    items.push({
      key: `OVERDUE_TASK:${t.id}`,
      priority: 'HIGH',
      actionType: 'OVERDUE_TASK',
      contractId: t.contractId,
      contractReference: c.referenceNumber,
      contractTitle: c.title,
      description: `Overdue: ${t.taskName}`,
      date: t.dueDate ? isoDate(t.dueDate) : null,
      isOverdue: true,
      overdueDays: t.dueDate ? diffDays(today, t.dueDate) : null,
      actionUrl: `/contracts/${t.contractId}/workflow`,
      actionLabel: 'View Workflow',
    });
  }

  // 4. Open high/critical issues.
  for (const i of input.issues) {
    if (FINAL_ISSUE_STATUSES_FOR_DASHBOARD.includes(i.status)) continue;
    if (i.priority !== 'HIGH' && i.priority !== 'CRITICAL') continue;
    const c = contractsById.get(i.contractId);
    if (!c) continue;
    const overdue = i.dueDate ? i.dueDate < today : false;
    items.push({
      key: `OPEN_ISSUE:${i.id}`,
      priority: 'HIGH',
      actionType: 'OPEN_ISSUE',
      contractId: i.contractId,
      contractReference: c.referenceNumber,
      contractTitle: c.title,
      description: i.title,
      date: i.dueDate ? isoDate(i.dueDate) : null,
      isOverdue: overdue,
      overdueDays: overdue && i.dueDate ? diffDays(today, i.dueDate) : null,
      actionUrl: `/contracts/${i.contractId}/issues`,
      actionLabel: 'View Issues',
    });
  }

  // 5. Open claims.
  for (const cl of input.claims) {
    if (FINAL_CLAIM_STATUSES_FOR_DASHBOARD.includes(cl.status)) continue;
    const c = contractsById.get(cl.contractId);
    if (!c) continue;
    const overdue = cl.dueDate ? cl.dueDate < today : false;
    items.push({
      key: `OPEN_CLAIM:${cl.id}`,
      priority: 'MEDIUM',
      actionType: 'OPEN_CLAIM',
      contractId: cl.contractId,
      contractReference: c.referenceNumber,
      contractTitle: c.title,
      description: cl.claimTitle,
      date: cl.dueDate ? isoDate(cl.dueDate) : null,
      isOverdue: overdue,
      overdueDays: overdue && cl.dueDate ? diffDays(today, cl.dueDate) : null,
      actionUrl: `/contracts/${cl.contractId}/claims`,
      actionLabel: 'View Claims',
    });
  }

  // 6. Outstanding / overdue payments.
  for (const p of input.payments) {
    if (FINAL_PAYMENT_STATUSES_FOR_DASHBOARD.includes(p.status)) continue;
    const outstanding = computePaymentOutstanding(p) ?? 0;
    if (outstanding <= 0) continue;
    const c = contractsById.get(p.contractId);
    if (!c) continue;
    const overdueDays = computePaymentOverdueDays(p, today);
    items.push({
      key: `OUTSTANDING_PAYMENT:${p.id}`,
      priority: overdueDays !== null ? 'HIGH' : 'MEDIUM',
      actionType: 'OUTSTANDING_PAYMENT',
      contractId: p.contractId,
      contractReference: c.referenceNumber,
      contractTitle: c.title,
      description: p.paymentNo ?? p.invoiceNumber ?? 'Outstanding payment',
      date: p.dueDate ? isoDate(p.dueDate) : null,
      isOverdue: overdueDays !== null,
      overdueDays,
      actionUrl: `/contracts/${p.contractId}/payments`,
      actionLabel: 'View Payments',
    });
  }

  // 7. Closeout requests awaiting review.
  for (const r of input.closeoutRequests) {
    if (!PENDING_CLOSEOUT_STATUSES.includes(r.status)) continue;
    const c = contractsById.get(r.contractId);
    if (!c) continue;
    items.push({
      key: `CLOSEOUT_REVIEW:${r.id}`,
      priority: 'HIGH',
      actionType: 'CLOSEOUT_REVIEW',
      contractId: r.contractId,
      contractReference: c.referenceNumber,
      contractTitle: c.title,
      description: `Closeout request ${r.requestNo} awaiting review`,
      date: isoDate(r.requestedAt),
      isOverdue: false,
      overdueDays: null,
      actionUrl: `/contracts/${r.contractId}/closeout`,
      actionLabel: 'Review Closeout',
    });
  }

  // 8. Contracts ending soon (active only — mirrors CM-34's schedule "ending soon" window).
  const endingSoonIso = isoDate(new Date(today.getTime() + CONTRACT_ENDING_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000));
  for (const c of input.contracts) {
    if (c.status !== 'ACTIVE') continue;
    const endish = c.endDate ?? c.forecastCompletionDate;
    if (!endish) continue;
    if (isoDate(endish) > endingSoonIso) continue;
    const overdue = endish < today;
    items.push({
      key: `CONTRACT_ENDING_SOON:${c.id}`,
      priority: 'MEDIUM',
      actionType: 'CONTRACT_ENDING_SOON',
      contractId: c.id,
      contractReference: c.referenceNumber,
      contractTitle: c.title,
      description: 'Contract ending soon',
      date: isoDate(endish),
      isOverdue: overdue,
      overdueDays: overdue ? diffDays(today, endish) : null,
      actionUrl: `/contracts/${c.id}`,
      actionLabel: 'View Contract',
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Manager summary cards.
// ---------------------------------------------------------------------------

export interface ManagerDashboardSummary {
  activeContracts: number;
  draftContracts: number;
  contractsAwaitingActivation: number;
  overdueWorkflowTasks: number;
  openIssues: number;
  openClaims: number;
  outstandingPayments: number;
  pendingCloseoutRequests: number;
  dueThisWeek: number;
}

export function computeManagerSummary(input: {
  contracts: DashboardContractRow[];
  tasks: DashboardTaskRow[];
  issues: DashboardIssueRow[];
  claims: DashboardClaimRow[];
  payments: DashboardPaymentRow[];
  closeoutRequests: DashboardCloseoutRequestRow[];
  dueThisWeek: number;
  today?: Date;
}): ManagerDashboardSummary {
  const today = input.today ?? utcToday();
  const draftContracts = input.contracts.filter((c) => c.status === 'DRAFT').length;
  const activeContracts = input.contracts.filter((c) => c.status === 'ACTIVE').length;
  const overdueWorkflowTasks = input.tasks.filter((t) => computeTaskIsOverdue(t, today)).length;
  const outstandingPayments = input.payments.filter((p) => {
    if (FINAL_PAYMENT_STATUSES_FOR_DASHBOARD.includes(p.status)) return false;
    return (computePaymentOutstanding(p) ?? 0) > 0;
  }).length;
  const pendingCloseoutRequests = input.closeoutRequests.filter((r) => PENDING_CLOSEOUT_STATUSES.includes(r.status)).length;

  return {
    activeContracts,
    draftContracts,
    // Deliberately the same population as draftContracts — this codebase has
    // no separate "activation readiness" concept (e.g. BOQ-complete flag), so
    // "awaiting activation" and "draft" are the same query. Kept as two cards
    // per the spec's literal list rather than inventing a new readiness rule.
    contractsAwaitingActivation: draftContracts,
    overdueWorkflowTasks,
    openIssues: computeIssueSummary(input.issues, today).openIssues,
    openClaims: computeClaimSummary(input.claims, today).openClaims,
    outstandingPayments,
    pendingCloseoutRequests,
    dueThisWeek: input.dueThisWeek,
  };
}

export interface ManagerDashboardData {
  summary: ManagerDashboardSummary;
  attentionItems: ManagerAttentionItem[];
  workflowOverview: TeamWorkflowOverview[];
  upcomingSchedule: ScheduleItem[];
}

// ---------------------------------------------------------------------------
// Staff — My Work.
// ---------------------------------------------------------------------------

export interface StaffTaskRow {
  id: string;
  taskName: string;
  contractId: string;
  contractReference: string;
  contractTitle: string;
  counterpartyName: string;
  team: string;
  status: string;
  dueDate: string | null;
  priority: string;
  isOverdue: boolean;
  actionUrl: string;
}

export interface StaffDashboardSummary {
  myOpenTasks: number;
  myInProgressTasks: number;
  myOverdueTasks: number;
  dueThisWeek: number;
  completedTasks: number;
  myActiveContracts: number;
}

export function computeStaffSummary(
  myTasks: DashboardTaskRow[],
  contractStatusById: Map<string, string>,
  dueThisWeek: number,
  today: Date = utcToday(),
): StaffDashboardSummary {
  const activeContractIds = new Set(
    myTasks.filter((t) => contractStatusById.get(t.contractId) === 'ACTIVE').map((t) => t.contractId),
  );
  return {
    myOpenTasks: myTasks.filter((t) => t.status !== 'COMPLETED').length,
    myInProgressTasks: myTasks.filter((t) => t.status === 'IN_PROGRESS').length,
    myOverdueTasks: myTasks.filter((t) => computeTaskIsOverdue(t, today)).length,
    dueThisWeek,
    completedTasks: myTasks.filter((t) => t.status === 'COMPLETED').length,
    myActiveContracts: activeContractIds.size,
  };
}

export function buildStaffTaskRows(
  myTasks: DashboardTaskRow[],
  contractsById: Map<string, DashboardContractRow>,
  today: Date = utcToday(),
): StaffTaskRow[] {
  const rows: StaffTaskRow[] = [];
  for (const t of myTasks) {
    const c = contractsById.get(t.contractId);
    if (!c) continue;
    rows.push({
      id: t.id,
      taskName: t.taskName,
      contractId: t.contractId,
      contractReference: c.referenceNumber,
      contractTitle: c.title,
      counterpartyName: c.counterpartyName,
      team: t.team,
      status: t.status,
      dueDate: t.dueDate ? isoDate(t.dueDate) : null,
      priority: t.priority,
      isOverdue: computeTaskIsOverdue(t, today),
      actionUrl: `/contracts/${t.contractId}/workflow`,
    });
  }
  return rows.sort((a, b) => (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99'));
}

export type StaffRecentUpdateType = 'STATUS_UPDATE' | 'COMMENT' | 'ATTACHMENT';

export interface StaffRecentUpdate {
  key: string;
  type: StaffRecentUpdateType;
  taskId: string;
  taskName: string;
  contractId: string;
  contractReference: string;
  contractTitle: string;
  description: string;
  date: string;
  actionUrl: string;
}

const RECENT_UPDATES_CAP = 10;

// Honest about what's derivable: ContractWorkflowTask has no field-level
// change log (unlike Contract's own ContractActivity table), so the
// "status update"/"due date changed" scenarios named in the spec are both
// represented by a single generic "Task updated" entry sourced from
// lastActivityAt — we do not fabricate which field changed.
export function buildStaffRecentUpdates(input: {
  myTasks: DashboardTaskRow[];
  comments: { id: string; taskId: string; createdAt: Date }[];
  attachments: { id: string; taskId: string; originalFileName: string; createdAt: Date }[];
  contractsById: Map<string, DashboardContractRow>;
}): StaffRecentUpdate[] {
  const taskById = new Map(input.myTasks.map((t) => [t.id, t]));
  const updates: StaffRecentUpdate[] = [];

  for (const t of input.myTasks) {
    const c = input.contractsById.get(t.contractId);
    if (!c) continue;
    updates.push({
      key: `STATUS_UPDATE:${t.id}:${t.lastActivityAt.toISOString()}`,
      type: 'STATUS_UPDATE',
      taskId: t.id,
      taskName: t.taskName,
      contractId: t.contractId,
      contractReference: c.referenceNumber,
      contractTitle: c.title,
      description: `Task updated — status ${t.status}`,
      date: t.lastActivityAt.toISOString(),
      actionUrl: `/contracts/${t.contractId}/workflow`,
    });
  }
  for (const cm of input.comments) {
    const t = taskById.get(cm.taskId);
    if (!t) continue;
    const c = input.contractsById.get(t.contractId);
    if (!c) continue;
    updates.push({
      key: `COMMENT:${cm.id}`,
      type: 'COMMENT',
      taskId: t.id,
      taskName: t.taskName,
      contractId: t.contractId,
      contractReference: c.referenceNumber,
      contractTitle: c.title,
      description: 'Comment added',
      date: cm.createdAt.toISOString(),
      actionUrl: `/contracts/${t.contractId}/workflow`,
    });
  }
  for (const a of input.attachments) {
    const t = taskById.get(a.taskId);
    if (!t) continue;
    const c = input.contractsById.get(t.contractId);
    if (!c) continue;
    updates.push({
      key: `ATTACHMENT:${a.id}`,
      type: 'ATTACHMENT',
      taskId: t.id,
      taskName: t.taskName,
      contractId: t.contractId,
      contractReference: c.referenceNumber,
      contractTitle: c.title,
      description: `Attachment uploaded — ${a.originalFileName}`,
      date: a.createdAt.toISOString(),
      actionUrl: `/contracts/${t.contractId}/workflow`,
    });
  }

  return updates.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, RECENT_UPDATES_CAP);
}

export interface StaffDashboardData {
  summary: StaffDashboardSummary;
  assignedTasks: StaffTaskRow[];
  upcomingSchedule: ScheduleItem[];
  recentUpdates: StaffRecentUpdate[];
}

// ---------------------------------------------------------------------------
// Injectable service.
// ---------------------------------------------------------------------------

const DASHBOARD_CONTRACT_CAP = 1000;
const MANAGER_ATTENTION_LIST_CAP = 30;
const UPCOMING_SCHEDULE_CAP = 15;
const STAFF_ACTIVITY_FETCH_CAP = 50;

const CONTRACT_DASHBOARD_SELECT = {
  id: true,
  referenceNumber: true,
  title: true,
  status: true,
  createdAt: true,
  endDate: true,
  forecastCompletionDate: true,
  departmentId: true,
  // CM-47 — needed for the staff dashboard's Today's Work panel and
  // assigned-task cards (Client). Already selected elsewhere on this same
  // contracts.read scope (e.g. contract-schedule.service.ts); adding it
  // here is a same-authorization-boundary field exposure, not new data.
  counterpartyName: true,
} as const;

const TASK_DASHBOARD_SELECT = {
  id: true,
  contractId: true,
  taskName: true,
  team: true,
  status: true,
  priority: true,
  dueDate: true,
  responsibleUserId: true,
  lastActivityAt: true,
} as const;

const ISSUE_DASHBOARD_SELECT = { id: true, contractId: true, title: true, status: true, priority: true, dueDate: true } as const;
const CLAIM_DASHBOARD_SELECT = {
  id: true, contractId: true, claimTitle: true, status: true, dueDate: true, submittedValue: true, approvedValue: true,
} as const;
const PAYMENT_DASHBOARD_SELECT = {
  id: true, contractId: true, paymentNo: true, invoiceNumber: true, status: true, dueDate: true,
  submittedAmount: true, certifiedAmount: true, paidAmount: true,
} as const;
const CLOSEOUT_DASHBOARD_SELECT = { id: true, contractId: true, requestNo: true, status: true, requestedAt: true } as const;

type BaseDashboard = Awaited<ReturnType<ContractsService['getDashboard']>>;

export interface ContractDashboardResult extends BaseDashboard {
  dashboardType: ContractDashboardType;
  manager?: ManagerDashboardData;
  staff?: StaffDashboardData;
}

@Injectable()
export class ContractDashboardService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
    private readonly contractsService: ContractsService,
    private readonly scheduleService: ContractScheduleService,
  ) {}

  async getDashboard(actor: AuthUser): Promise<ContractDashboardResult> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const [base, dashboardType] = [await this.contractsService.getDashboard(actor), computeContractDashboardType(actor.permissions)];
    const today = utcToday();

    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT);
    const where = deptFilter !== null ? { departmentId: deptFilter } : {};

    const contracts = await this.db.getClient().contract.findMany({
      where,
      select: CONTRACT_DASHBOARD_SELECT,
      take: DASHBOARD_CONTRACT_CAP,
      orderBy: [{ createdAt: 'desc' }],
    });
    const contractIds = contracts.map((c) => c.id);

    if (dashboardType === 'MANAGER') {
      return { ...base, dashboardType, manager: await this.buildManagerData(actor, contracts, contractIds, today) };
    }
    return { ...base, dashboardType, staff: await this.buildStaffData(actor, contracts, contractIds, today) };
  }

  private async buildManagerData(
    actor: AuthUser,
    contracts: DashboardContractRow[],
    contractIds: string[],
    today: Date,
  ): Promise<ManagerDashboardData> {
    const scheduleQuery = { upcomingOnly: true, pageSize: UPCOMING_SCHEDULE_CAP } as ContractScheduleListQueryDto;

    if (contractIds.length === 0) {
      const scheduleResult = await this.scheduleService.findAll(scheduleQuery, actor);
      return {
        summary: computeManagerSummary({
          contracts: [], tasks: [], issues: [], claims: [], payments: [], closeoutRequests: [],
          dueThisWeek: scheduleResult.summary.upcomingThisWeek, today,
        }),
        attentionItems: [],
        workflowOverview: buildWorkflowOverview([], today),
        upcomingSchedule: scheduleResult.items,
      };
    }

    const [tasks, issues, claims, payments, closeoutRequests, scheduleResult] = await Promise.all([
      this.db.getClient().contractWorkflowTask.findMany({ where: { contractId: { in: contractIds } }, select: TASK_DASHBOARD_SELECT }),
      this.db.getClient().contractIssue.findMany({ where: { contractId: { in: contractIds } }, select: ISSUE_DASHBOARD_SELECT }),
      this.db.getClient().contractClaim.findMany({ where: { contractId: { in: contractIds } }, select: CLAIM_DASHBOARD_SELECT }),
      this.db.getClient().contractPayment.findMany({ where: { contractId: { in: contractIds } }, select: PAYMENT_DASHBOARD_SELECT }),
      this.db.getClient().contractCloseoutRequest.findMany({ where: { contractId: { in: contractIds } }, select: CLOSEOUT_DASHBOARD_SELECT }),
      this.scheduleService.findAll(scheduleQuery, actor),
    ]);

    const summary = computeManagerSummary({
      contracts, tasks, issues, claims, payments, closeoutRequests, dueThisWeek: scheduleResult.summary.upcomingThisWeek, today,
    });
    const attentionItems = sortAttentionItems(
      buildManagerAttentionItems({ contracts, tasks, issues, claims, payments, closeoutRequests, today }),
    ).slice(0, MANAGER_ATTENTION_LIST_CAP);
    const workflowOverview = buildWorkflowOverview(tasks, today);

    return { summary, attentionItems, workflowOverview, upcomingSchedule: scheduleResult.items };
  }

  private async buildStaffData(
    actor: AuthUser,
    contracts: DashboardContractRow[],
    contractIds: string[],
    today: Date,
  ): Promise<StaffDashboardData> {
    const contractsById = new Map(contracts.map((c) => [c.id, c]));
    const scheduleQuery = {
      upcomingOnly: true, pageSize: UPCOMING_SCHEDULE_CAP, responsibleUserId: actor.id,
    } as ContractScheduleListQueryDto;

    if (contractIds.length === 0) {
      const scheduleResult = await this.scheduleService.findAll(scheduleQuery, actor);
      return {
        summary: computeStaffSummary([], new Map(), scheduleResult.summary.upcomingThisWeek, today),
        assignedTasks: [],
        upcomingSchedule: scheduleResult.items,
        recentUpdates: [],
      };
    }

    const [myTasks, scheduleResult] = await Promise.all([
      this.db.getClient().contractWorkflowTask.findMany({
        where: { contractId: { in: contractIds }, responsibleUserId: actor.id },
        select: TASK_DASHBOARD_SELECT,
      }),
      this.scheduleService.findAll(scheduleQuery, actor),
    ]);

    const contractStatusById = new Map(contracts.map((c) => [c.id, c.status]));
    const summary = computeStaffSummary(myTasks, contractStatusById, scheduleResult.summary.upcomingThisWeek, today);
    const assignedTasks = buildStaffTaskRows(myTasks, contractsById, today);

    let recentUpdates: StaffRecentUpdate[] = [];
    if (myTasks.length > 0) {
      const taskIds = myTasks.map((t) => t.id);
      const [comments, attachments] = await Promise.all([
        this.db.getClient().contractWorkflowTaskComment.findMany({
          where: { taskId: { in: taskIds } },
          orderBy: [{ createdAt: 'desc' }],
          take: STAFF_ACTIVITY_FETCH_CAP,
          select: { id: true, taskId: true, createdAt: true },
        }),
        this.db.getClient().contractWorkflowTaskAttachment.findMany({
          where: { taskId: { in: taskIds } },
          orderBy: [{ createdAt: 'desc' }],
          take: STAFF_ACTIVITY_FETCH_CAP,
          select: { id: true, taskId: true, originalFileName: true, createdAt: true },
        }),
      ]);
      recentUpdates = buildStaffRecentUpdates({ myTasks, comments, attachments, contractsById });
    }

    return { summary, assignedTasks, upcomingSchedule: scheduleResult.items, recentUpdates };
  }
}
