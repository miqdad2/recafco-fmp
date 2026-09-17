import { Injectable, ForbiddenException } from '@nestjs/common';
import { ModuleIdentifier, ContractStatus } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import { getDerivedLifecycleStatus, type DerivedLifecycleStatus } from './contracts.service';
import { computeTaskIsOverdue } from './contract-workflow.service';
import type { AuthUser } from '../common/types/auth-user';

// ---------------------------------------------------------------------------
// CM-71B — Erection Manager Dashboard / Work Queue. Deliberately NO new
// table: every field below is derived live from Contract, the CM-71A
// ContractErectionMethodStatement record (if any), the existing generic
// ERECTION-team ContractWorkflowTask rows (contract-workflow-templates.ts —
// a DIFFERENT, already-real data source from CM-71A's own dedicated
// per-step model), and the existing ContractActivity log. Steps 2-7 have no
// dedicated screens/models yet — "Current Erection Step" is honestly
// derived from the generic ERECTION team task sequence (real data, just a
// different table than CM-71A's own), and the Checklist/Payment KPI cards
// are fixed "not available yet" placeholders, never fabricated counts.
//
// An "erection-related" contract is one where ANY of the following is true
// (see isErectionRelatedContract): scopeOfWork['erection'] === true, OR a
// ContractErectionMethodStatement record already exists for it, OR it has
// at least one ERECTION-team ContractWorkflowTask (auto-generated whenever
// shouldIncludeErection() was true at contract-creation time — see
// contract-workflow-templates.ts — which itself triggers on
// scope.delivery === true as well as scope.erection === true, so a
// delivery-only contract can already have real ERECTION tasks even if the
// erection scope flag itself was never set).
// ---------------------------------------------------------------------------

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export type ErectionMethodStatementDisplayStatus = 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED_FOR_APPROVAL' | 'ISSUED';

export const ERECTION_METHOD_STATEMENT_DISPLAY_LABELS: Record<ErectionMethodStatementDisplayStatus, string> = {
  NOT_STARTED: 'Not Started',
  DRAFT: 'Draft',
  SUBMITTED_FOR_APPROVAL: 'Submitted for Approval',
  ISSUED: 'Issued',
};

// CM-71C — Step 2's own review status, surfaced honestly on the dashboard.
// "NOT_STARTED" here is the dashboard's own display convention (no approval
// row exists yet) — distinct from the real DB enum's own PENDING_APPROVAL
// default, which only applies once a row actually exists.
export type ErectionMethodStatementApprovalDisplayStatus = 'NOT_STARTED' | 'PENDING_APPROVAL' | 'DRAFT_REVIEW' | 'APPROVED' | 'REVISION_REQUESTED' | 'REJECTED';

// CM-71D — Step 3's own schedule status, surfaced honestly on the
// dashboard. "NOT_STARTED" is the dashboard's own display convention (no
// schedule row exists yet) — the real DB enum has no such value (it
// defaults to DRAFT once a row exists, same as CM-71A's Step 1).
export type ErectionScheduleDisplayStatus = 'NOT_STARTED' | 'DRAFT' | 'ISSUED' | 'HOLD' | 'RETURNED';

// CM-71E — Step 4's own delivery-start status, surfaced honestly on the
// dashboard. "NOT_STARTED" is the dashboard's own display convention (no
// delivery-start row exists yet) — the real DB enum has no such value (it
// defaults to DRAFT once a row exists, same as Steps 1/3).
export type ErectionDeliveryStartDisplayStatus = 'NOT_STARTED' | 'DRAFT' | 'STARTED' | 'HOLD' | 'RETURNED';

// CM-71F — Step 5's own erection-start status, surfaced honestly on the
// dashboard. "NOT_STARTED" is the dashboard's own display convention (no
// erection-start row exists yet) — the real DB enum has no such value (it
// defaults to DRAFT once a row exists, same as Steps 1/3/4).
export type ErectionStartDisplayStatus = 'NOT_STARTED' | 'DRAFT' | 'STARTED' | 'HOLD' | 'RETURNED';

// CM-71G — Step 6's own erection-checklist status, surfaced honestly on the
// dashboard. "NOT_STARTED" is the dashboard's own display convention (no
// checklist row exists yet) — the real DB enum has no such value (it
// defaults to DRAFT once a row exists, same as Steps 1/3/4/5).
export type ErectionChecklistDisplayStatus = 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED_FOR_VERIFICATION' | 'VERIFIED' | 'HOLD' | 'RETURNED';

export type ErectionAttentionStatus = 'OVERDUE' | 'AWAITING_APPROVAL' | 'ON_TRACK' | 'NEEDS_PLANNING';

// CM-71H — who the Erection Workflow (CM-71A-G) is assigned to for this
// contract, per ContractErectionWorkflowAssignment (see that model's own
// doc comment). Surfaced honestly: null fields mean "not assigned yet", not
// a fabricated default.
export type ErectionAssignmentStatus = 'ASSIGNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

interface ErectionAssignmentRow {
  assignedToUserId: string | null;
  assignedToName: string | null;
  assignedDepartment: string;
  status: ErectionAssignmentStatus | string;
  assignedToUser: { displayName: string } | null;
}

/**
 * CM-71H — "if current user is assigned Erection Manager -> Continue/Update;
 * if Contract Manager -> View Status where appropriate; if neither ->
 * hide/read-only." ACT also covers the not-yet-assigned case for a
 * manager-tier actor (contracts.update) — someone still has to be able to
 * start the workflow, or assign it, before any Erection Manager exists.
 */
export type ErectionViewerActionMode = 'ACT' | 'MONITOR' | 'READ_ONLY';

export function computeErectionViewerActionMode(input: {
  hasAssignment: boolean;
  isAssignedToActor: boolean;
  actorCanManage: boolean;
}): ErectionViewerActionMode {
  if (input.isAssignedToActor) return 'ACT';
  if (!input.hasAssignment && input.actorCanManage) return 'ACT';
  if (input.actorCanManage) return 'MONITOR';
  return 'READ_ONLY';
}

interface ErectionMethodStatementRow {
  status: ErectionMethodStatementDisplayStatus | 'DRAFT_BACKEND' | string;
  plannedIssueDate: string | null;
  jobOrderNo: string | null;
  workLocationYard: string | null;
  updatedAt: string;
  approval: { reviewStatus: string } | null;
}

interface ErectionScheduleRow {
  status: ErectionScheduleDisplayStatus | string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  updatedAt: string;
}

interface ErectionDeliveryStartRow {
  status: ErectionDeliveryStartDisplayStatus | string;
  plannedDeliveryWindowStart: string | null;
  plannedDeliveryWindowEnd: string | null;
  updatedAt: string;
}

interface ErectionStartRow {
  status: ErectionStartDisplayStatus | string;
  actualStartDateTime: string | null;
  updatedAt: string;
}

interface ErectionChecklistRow {
  status: ErectionChecklistDisplayStatus | string;
  updatedAt: string;
}

interface ErectionWorkflowTaskRow {
  taskKey: string;
  taskName: string;
  sortOrder: number;
  status: string;
  dueDate: Date | null;
  responsibleUserId: string | null;
}

export interface ErectionScopeInput {
  scopeOfWork: unknown;
  hasErectionMethodStatement: boolean;
  hasErectionWorkflowTask: boolean;
}

/** A contract is "erection-related" if any real signal says so — see file header. Never combined with a fabricated 4th signal. */
export function isErectionRelatedContract(input: ErectionScopeInput): boolean {
  const scope = input.scopeOfWork as Record<string, boolean | string> | null | undefined;
  const scopeHasErection = scope?.['erection'] === true;
  return scopeHasErection === true || input.hasErectionMethodStatement || input.hasErectionWorkflowTask;
}

/** No record -> Not Started. A real record's own status is passed through as-is — "Ready to Issue" is a frontend-only computed label (CM-71A), never reproduced here. */
export function computeMethodStatementDisplayStatus(status: string | null | undefined): ErectionMethodStatementDisplayStatus {
  if (!status) return 'NOT_STARTED';
  if (status === 'SUBMITTED_FOR_APPROVAL' || status === 'ISSUED' || status === 'DRAFT') return status;
  return 'NOT_STARTED';
}

/** No approval row -> Not Started (dashboard-only convention — see the type's own doc comment). */
export function computeMethodStatementApprovalDisplayStatus(reviewStatus: string | null | undefined): ErectionMethodStatementApprovalDisplayStatus {
  if (!reviewStatus) return 'NOT_STARTED';
  if (['PENDING_APPROVAL', 'DRAFT_REVIEW', 'APPROVED', 'REVISION_REQUESTED', 'REJECTED'].includes(reviewStatus)) {
    return reviewStatus as ErectionMethodStatementApprovalDisplayStatus;
  }
  return 'NOT_STARTED';
}

/** No schedule row -> Not Started (dashboard-only convention — see the type's own doc comment). */
export function computeScheduleDisplayStatus(status: string | null | undefined): ErectionScheduleDisplayStatus {
  if (!status) return 'NOT_STARTED';
  if (['DRAFT', 'ISSUED', 'HOLD', 'RETURNED'].includes(status)) return status as ErectionScheduleDisplayStatus;
  return 'NOT_STARTED';
}

/** No delivery-start row -> Not Started (dashboard-only convention — see the type's own doc comment). */
export function computeDeliveryStartDisplayStatus(status: string | null | undefined): ErectionDeliveryStartDisplayStatus {
  if (!status) return 'NOT_STARTED';
  if (['DRAFT', 'STARTED', 'HOLD', 'RETURNED'].includes(status)) return status as ErectionDeliveryStartDisplayStatus;
  return 'NOT_STARTED';
}

/** No erection-start row -> Not Started (dashboard-only convention — see the type's own doc comment). */
export function computeErectionStartDisplayStatus(status: string | null | undefined): ErectionStartDisplayStatus {
  if (!status) return 'NOT_STARTED';
  if (['DRAFT', 'STARTED', 'HOLD', 'RETURNED'].includes(status)) return status as ErectionStartDisplayStatus;
  return 'NOT_STARTED';
}

/** No checklist row -> Not Started (dashboard-only convention — see the type's own doc comment). */
export function computeChecklistDisplayStatus(status: string | null | undefined): ErectionChecklistDisplayStatus {
  if (!status) return 'NOT_STARTED';
  if (['DRAFT', 'SUBMITTED_FOR_VERIFICATION', 'VERIFIED', 'HOLD', 'RETURNED'].includes(status)) return status as ErectionChecklistDisplayStatus;
  return 'NOT_STARTED';
}

export interface ErectionNextAction {
  label: string;
  href: string;
}

/**
 * CM-71C/CM-71D/CM-71E/CM-71F/CM-71G — "show Step 2 as the next action when
 * Step 1 is Submitted for Approval or Issued," then "show next action as
 * Issue Erection Schedule when Step 2 is Approved and Step 3 is not
 * issued," then "show next action as Delivery Start when Step 3 is Issued
 * and Step 4 is not confirmed," then "show next action as Erection Start
 * when Step 4 is Started and Step 5 is not confirmed," then "show next
 * action as Erection Checklist when Step 5 is Started and Step 6 is not
 * submitted/verified" (all 5 units' own explicit navigation rules, applied
 * identically to the dashboard's work-queue Action column). Once Step 6 is
 * Submitted for Verification or Verified there is no Step 7 screen yet, so
 * the action honestly stays on Step 6's own view — never a fabricated
 * Step 7 link.
 */
export function computeErectionNextAction(input: {
  contractId: string;
  methodStatementStatus: ErectionMethodStatementDisplayStatus;
  hasMethodStatement: boolean;
  approvalStatus: ErectionMethodStatementApprovalDisplayStatus;
  scheduleStatus: ErectionScheduleDisplayStatus;
  hasSchedule: boolean;
  deliveryStartStatus: ErectionDeliveryStartDisplayStatus;
  hasDeliveryStart: boolean;
  erectionStartStatus: ErectionStartDisplayStatus;
  hasErectionStart: boolean;
  checklistStatus: ErectionChecklistDisplayStatus;
  hasChecklist: boolean;
}): ErectionNextAction {
  const {
    contractId, methodStatementStatus, hasMethodStatement, approvalStatus, scheduleStatus, hasSchedule,
    deliveryStartStatus, hasDeliveryStart, erectionStartStatus, hasErectionStart, checklistStatus, hasChecklist,
  } = input;
  const step1Href = `/contracts/${contractId}/workflow/erection/method-statement`;
  const step2Href = `/contracts/${contractId}/workflow/erection/method-statement/approval`;
  const step3Href = `/contracts/${contractId}/workflow/erection/schedule`;
  const step4Href = `/contracts/${contractId}/workflow/erection/delivery-start`;
  const step5Href = `/contracts/${contractId}/workflow/erection/start`;
  const step6Href = `/contracts/${contractId}/workflow/erection/checklist`;
  const checklistNotYetSubmittedOrVerified = checklistStatus !== 'SUBMITTED_FOR_VERIFICATION' && checklistStatus !== 'VERIFIED';

  if (methodStatementStatus !== 'SUBMITTED_FOR_APPROVAL' && methodStatementStatus !== 'ISSUED') {
    return { label: hasMethodStatement ? 'View / Continue' : 'Start Method Statement', href: step1Href };
  }
  if (approvalStatus !== 'APPROVED') {
    return { label: approvalStatus === 'NOT_STARTED' ? 'Start Review' : 'View / Continue Review', href: step2Href };
  }
  if (scheduleStatus !== 'ISSUED') {
    return { label: hasSchedule ? 'View / Continue Schedule' : 'Issue Erection Schedule', href: step3Href };
  }
  if (deliveryStartStatus !== 'STARTED') {
    return { label: hasDeliveryStart ? 'View / Continue Delivery Start' : 'Delivery Start', href: step4Href };
  }
  if (erectionStartStatus !== 'STARTED') {
    return { label: hasErectionStart ? 'View / Continue Erection Start' : 'Erection Start', href: step5Href };
  }
  if (checklistNotYetSubmittedOrVerified) {
    return { label: hasChecklist ? 'View / Continue Checklist' : 'Erection Checklist', href: step6Href };
  }
  return { label: 'View Checklist', href: step6Href };
}

/**
 * Exhaustive if/elif implementation of this unit's own 4-bucket attention
 * spec, in the exact order given. The spec names no bucket for "Draft/Not
 * Started with a real planned date that hasn't arrived yet" — that case
 * falls through to Needs Planning (the closest honest fit: it still needs
 * active follow-up, it just isn't late yet), rather than inventing a 5th
 * category.
 */
export function computeErectionAttention(input: {
  methodStatementStatus: ErectionMethodStatementDisplayStatus;
  plannedIssueDate: string | null;
  today: string;
}): ErectionAttentionStatus {
  const { methodStatementStatus, plannedIssueDate, today } = input;
  const isDraftOrNotStarted = methodStatementStatus === 'DRAFT' || methodStatementStatus === 'NOT_STARTED';

  if (isDraftOrNotStarted && plannedIssueDate !== null && plannedIssueDate < today) return 'OVERDUE';
  if (methodStatementStatus === 'SUBMITTED_FOR_APPROVAL') return 'AWAITING_APPROVAL';
  if (methodStatementStatus === 'ISSUED') return 'ON_TRACK';
  if (plannedIssueDate === null) return 'NEEDS_PLANNING';
  return 'NEEDS_PLANNING';
}

/**
 * Honest "Current Erection Step" from the EXISTING generic ERECTION-team
 * ContractWorkflowTask sequence (contract-workflow-templates.ts) — a real,
 * already-populated data source, deliberately distinct from CM-71A's own
 * ContractErectionMethodStatement model. The first not-yet-COMPLETED task
 * in sortOrder is "current"; all-COMPLETED reads as fully done; no tasks at
 * all (can happen for a contract whose erection relevance comes only from
 * scopeOfWork/method-statement, with no generated workflow tasks) reads as
 * Not Started, never fabricated.
 */
export function computeCurrentErectionStep(tasks: ErectionWorkflowTaskRow[]): string {
  if (tasks.length === 0) return 'Not Started';
  const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
  const current = sorted.find((t) => t.status !== 'COMPLETED');
  return current ? current.taskName : 'All Steps Complete';
}

/**
 * CM-71D/CM-71E/CM-71F/CM-71G — layers the 6 real dedicated per-step
 * records (Steps 1-6, the authoritative source once they exist) on top of
 * the generic-task-derived fallback above (which still honestly covers
 * Step 7, which has no dedicated model yet). Exactly satisfies this unit's
 * own "Show current step as 'Erection Checklist' when Step 5 is Started and
 * Step 6 is not submitted/verified" rule, while staying correct for every
 * earlier state too.
 */
export function computeCurrentErectionStepLabel(input: {
  methodStatementStatus: ErectionMethodStatementDisplayStatus;
  approvalStatus: ErectionMethodStatementApprovalDisplayStatus;
  scheduleStatus: ErectionScheduleDisplayStatus;
  deliveryStartStatus: ErectionDeliveryStartDisplayStatus;
  erectionStartStatus: ErectionStartDisplayStatus;
  checklistStatus: ErectionChecklistDisplayStatus;
  genericTaskFallback: string;
}): string {
  const {
    methodStatementStatus, approvalStatus, scheduleStatus, deliveryStartStatus, erectionStartStatus, checklistStatus, genericTaskFallback,
  } = input;
  if (methodStatementStatus === 'NOT_STARTED' || methodStatementStatus === 'DRAFT') {
    return 'Issue Erection Method Statement';
  }
  if (approvalStatus !== 'APPROVED') {
    return 'Erection Method Statement Approval';
  }
  if (scheduleStatus !== 'ISSUED') {
    return 'Issue Erection Schedule';
  }
  if (deliveryStartStatus !== 'STARTED') {
    return 'Delivery Start';
  }
  if (erectionStartStatus !== 'STARTED') {
    return 'Erection Start';
  }
  if (checklistStatus !== 'SUBMITTED_FOR_VERIFICATION' && checklistStatus !== 'VERIFIED') {
    return 'Erection Checklist';
  }
  return genericTaskFallback;
}

export interface ErectionWorkQueueRow {
  contractId: string;
  contractReference: string;
  jobOrderNo: string | null;
  projectName: string;
  client: string;
  contractStatus: string;
  lifecycleStatus: DerivedLifecycleStatus;
  methodStatementStatus: ErectionMethodStatementDisplayStatus;
  /** Step 2's own real review status — NOT_STARTED when no approval row exists yet (see the type's own doc comment). */
  approvalStatus: ErectionMethodStatementApprovalDisplayStatus;
  /** Step 3's own real schedule status — NOT_STARTED when no schedule row exists yet (see the type's own doc comment). */
  scheduleStatus: ErectionScheduleDisplayStatus;
  plannedIssueDate: string | null;
  /** Step 3's own real planned dates — null until a schedule row exists. Distinct from plannedIssueDate above (Step 1's own field). */
  scheduleStartDate: string | null;
  scheduleEndDate: string | null;
  /** Step 4's own real delivery-start status — NOT_STARTED when no delivery-start row exists yet (see the type's own doc comment). */
  deliveryStartStatus: ErectionDeliveryStartDisplayStatus;
  /** Step 4's own real planned delivery window — null until a delivery-start row exists. */
  deliveryWindowStart: string | null;
  deliveryWindowEnd: string | null;
  /** Step 5's own real erection-start status — NOT_STARTED when no erection-start row exists yet (see the type's own doc comment). */
  erectionStartStatus: ErectionStartDisplayStatus;
  /** Step 5's own real actual start date/time — null until an erection-start row exists and it's been recorded. */
  actualStartDateTime: string | null;
  /** Step 6's own real checklist status — NOT_STARTED when no checklist row exists yet (see the type's own doc comment). */
  checklistStatus: ErectionChecklistDisplayStatus;
  workLocationYard: string | null;
  /** The contract's own real Department (org unit) — every row here is already erection-related by definition, so a fixed "Erection Team" label on every row would add no filtering value; "—" when the contract has no department assigned. */
  responsibleTeam: string;
  currentErectionStep: string;
  attention: ErectionAttentionStatus;
  lastUpdated: string;
  hasMethodStatement: boolean;
  /** Honest "what to do next" — Step 1 until Step 1 is Submitted for Approval/Issued, then Step 2 (see computeErectionNextAction). */
  nextAction: ErectionNextAction;
  /** CM-71H — null until a ContractErectionWorkflowAssignment row exists for this contract. */
  assignedToUserId: string | null;
  assignedToName: string | null;
  assignedDepartment: string | null;
  assignmentStatus: ErectionAssignmentStatus | null;
  /** CM-71H — "Continue/Update" vs "View Status" vs read-only, computed for the CURRENT viewer (see computeErectionViewerActionMode). */
  viewerActionMode: ErectionViewerActionMode;
  /**
   * CM-71H.4 — WORKFLOW_ASSIGNMENT: a real ContractErectionWorkflowAssignment
   * row exists (the intended, formal path). TASK_ASSIGNMENT_ONLY: no such
   * row, but at least one real ERECTION-team task has a responsibleUserId —
   * the contract still shows up correctly for whoever is assigned (see the
   * dashboard's own scoping filter), but a manager-tier viewer sees a
   * gentle nudge to formalize it via Assign Erection Workflow, never a
   * block. NONE: no assignment signal at all yet.
   */
  assignmentSource: 'WORKFLOW_ASSIGNMENT' | 'TASK_ASSIGNMENT_ONLY' | 'NONE';
}

export interface ErectionDashboardKpis {
  totalErectionContracts: number;
  methodStatementPending: number;
  submittedForApproval: number;
  readyForErection: number;
  erectionInProgress: number;
  delayedAttentionRequired: number;
  /**
   * CM-71G — now a REAL count: checklistStatus is DRAFT or SUBMITTED_FOR_
   * VERIFICATION (a checklist that still needs work before it reaches
   * VERIFIED), matching this unit's own "Draft/Ready/Submitted-but-not-
   * verified records" wording exactly (NOT_STARTED/HOLD/RETURNED rows are
   * deliberately not counted — they weren't named in that list, and a
   * HOLD/RETURNED checklist needs a different action, not "pending" work).
   */
  checklistPending: number;
  /** Step 7 (Payment Issued) has no dedicated screen/model yet — always a fixed placeholder, never a fabricated count. */
  paymentPendingAfterErectionAvailable: false;
}

export function computeErectionDashboardKpis(
  rows: {
    methodStatementStatus: ErectionMethodStatementDisplayStatus;
    attention: ErectionAttentionStatus;
    readyForErection: boolean;
    erectionInProgress: boolean;
    checklistStatus: ErectionChecklistDisplayStatus;
  }[],
): ErectionDashboardKpis {
  let methodStatementPending = 0;
  let submittedForApproval = 0;
  let readyForErection = 0;
  let erectionInProgress = 0;
  let delayedAttentionRequired = 0;
  let checklistPending = 0;

  for (const row of rows) {
    if (row.methodStatementStatus === 'NOT_STARTED' || row.methodStatementStatus === 'DRAFT') methodStatementPending += 1;
    if (row.methodStatementStatus === 'SUBMITTED_FOR_APPROVAL') submittedForApproval += 1;
    if (row.readyForErection) readyForErection += 1;
    if (row.erectionInProgress) erectionInProgress += 1;
    if (row.attention === 'OVERDUE') delayedAttentionRequired += 1;
    if (row.checklistStatus === 'DRAFT' || row.checklistStatus === 'SUBMITTED_FOR_VERIFICATION') checklistPending += 1;
  }

  return {
    totalErectionContracts: rows.length,
    methodStatementPending,
    submittedForApproval,
    readyForErection,
    erectionInProgress,
    delayedAttentionRequired,
    checklistPending,
    paymentPendingAfterErectionAvailable: false,
  };
}

export interface ErectionRecentActivityRow {
  id: string;
  contractId: string;
  contractReference: string;
  event: string;
  actorName: string | null;
  createdAt: string;
}

export interface ErectionDashboardResult {
  kpis: ErectionDashboardKpis;
  workQueue: ErectionWorkQueueRow[];
  todaysActions: ErectionWorkQueueRow[];
  pendingApproval: ErectionWorkQueueRow[];
  overdueAttention: ErectionWorkQueueRow[];
  recentActivity: ErectionRecentActivityRow[];
}

const DASHBOARD_CONTRACT_CAP = 1000;
const RECENT_ACTIVITY_CAP = 20;
const ERECTION_METHOD_STATEMENT_EVENT_PREFIX = 'erection_method_statement_';
const ERECTION_SCHEDULE_EVENT_PREFIX = 'erection_schedule_';
const ERECTION_DELIVERY_START_EVENT_PREFIX = 'erection_delivery_start_';
const ERECTION_START_EVENT_PREFIX = 'erection_start_';
const ERECTION_CHECKLIST_EVENT_PREFIX = 'erection_checklist_';

const ERECTION_DASHBOARD_CONTRACT_SELECT = {
  id: true,
  referenceNumber: true,
  title: true,
  counterpartyName: true,
  jobOrder: true,
  status: true,
  endDate: true,
  renewalNoticeDate: true,
  scopeOfWork: true,
  updatedAt: true,
  department: { select: { name: true } },
  erectionMethodStatement: {
    select: {
      status: true,
      plannedIssueDate: true,
      jobOrderNo: true,
      workLocationYard: true,
      updatedAt: true,
      approval: { select: { reviewStatus: true } },
    },
  },
  erectionSchedule: {
    select: {
      status: true,
      plannedStartDate: true,
      plannedEndDate: true,
      updatedAt: true,
    },
  },
  erectionDeliveryStart: {
    select: {
      status: true,
      plannedDeliveryWindowStart: true,
      plannedDeliveryWindowEnd: true,
      updatedAt: true,
    },
  },
  erectionStart: {
    select: {
      status: true,
      actualStartDateTime: true,
      updatedAt: true,
    },
  },
  erectionChecklist: {
    select: {
      status: true,
      updatedAt: true,
    },
  },
  erectionWorkflowAssignment: {
    select: {
      assignedToUserId: true,
      assignedToName: true,
      assignedDepartment: true,
      status: true,
      assignedToUser: { select: { displayName: true } },
    },
  },
  workflowTasks: {
    where: { team: 'ERECTION' as const },
    select: { taskKey: true, taskName: true, sortOrder: true, status: true, dueDate: true, responsibleUserId: true },
  },
} as const;

@Injectable()
export class ContractErectionDashboardService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  async getDashboard(actor: AuthUser): Promise<ErectionDashboardResult> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const today = isoDate(utcToday()) as string;
    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT);

    const contracts = await this.db.getClient().contract.findMany({
      where: {
        status: { not: ContractStatus.CANCELLED },
        ...(deptFilter !== null ? { departmentId: deptFilter } : {}),
      },
      select: ERECTION_DASHBOARD_CONTRACT_SELECT,
      take: DASHBOARD_CONTRACT_CAP,
      orderBy: [{ updatedAt: 'desc' }],
    });

    // CM-71H — Erection Dashboard shows only contracts assigned to the
    // current user (if they are an Erection Manager, i.e. lack
    // contracts.update) or every erection-related contract (if they are a
    // manager-tier actor — Contract Manager/Admin/Super Admin — shown as
    // monitoring, not ownership, via viewerActionMode below).
    //
    // CM-71H.4 — "assigned" for a non-manager actor is EITHER of two real,
    // independently-existing assignment mechanisms — never a fake/derived
    // third one, and never requiring both to be set up: a real
    // ContractErectionWorkflowAssignment row (the whole-workflow assignment
    // CM-71H's own Assign flow writes), OR at least one real ERECTION-team
    // ContractWorkflowTask with responsibleUserId = actor.id (the older,
    // per-task assignment mechanism that already existed before CM-71H and
    // that a Contract Manager may have used instead, or in addition). This
    // is deliberately an OR, not something that auto-creates a
    // ContractErectionWorkflowAssignment row from task assignments (or vice
    // versa) — see this unit's own "do not require duplicate assignment"
    // instruction; two independently-real, already-existing signals are
    // read together, nothing is synthesized.
    const actorCanManage = actor.permissions.includes('contracts.update');
    const scopedContracts = actorCanManage
      ? contracts
      : contracts.filter((c) => {
          const assignment = c.erectionWorkflowAssignment as ErectionAssignmentRow | null;
          const hasWorkflowAssignment = assignment?.assignedToUserId === actor.id;
          const hasOwnErectionTask = c.workflowTasks.some((t) => t.responsibleUserId === actor.id);
          return hasWorkflowAssignment || hasOwnErectionTask;
        });

    const rows: ErectionWorkQueueRow[] = [];
    const kpiInputRows: { methodStatementStatus: ErectionMethodStatementDisplayStatus; attention: ErectionAttentionStatus; readyForErection: boolean; erectionInProgress: boolean; checklistStatus: ErectionChecklistDisplayStatus }[] = [];

    for (const c of scopedContracts) {
      const hasErectionMethodStatement = c.erectionMethodStatement !== null;
      const hasErectionWorkflowTask = c.workflowTasks.length > 0;
      if (!isErectionRelatedContract({ scopeOfWork: c.scopeOfWork, hasErectionMethodStatement, hasErectionWorkflowTask })) continue;

      const statement = c.erectionMethodStatement as ErectionMethodStatementRow | null;
      const schedule = c.erectionSchedule as ErectionScheduleRow | null;
      const deliveryStart = c.erectionDeliveryStart as ErectionDeliveryStartRow | null;
      const erectionStart = c.erectionStart as ErectionStartRow | null;
      const checklist = c.erectionChecklist as ErectionChecklistRow | null;
      const hasErectionSchedule = schedule !== null;
      const hasErectionDeliveryStart = deliveryStart !== null;
      const hasErectionStart = erectionStart !== null;
      const hasErectionChecklist = checklist !== null;
      const methodStatementStatus = computeMethodStatementDisplayStatus(statement?.status ?? null);
      const approvalStatus = computeMethodStatementApprovalDisplayStatus(statement?.approval?.reviewStatus ?? null);
      const scheduleStatus = computeScheduleDisplayStatus(schedule?.status ?? null);
      const deliveryStartStatus = computeDeliveryStartDisplayStatus(deliveryStart?.status ?? null);
      const erectionStartStatus = computeErectionStartDisplayStatus(erectionStart?.status ?? null);
      const checklistStatus = computeChecklistDisplayStatus(checklist?.status ?? null);
      const plannedIssueDate = statement ? isoDate(statement.plannedIssueDate as unknown as Date | null) : null;
      const scheduleStartDate = schedule ? isoDate(schedule.plannedStartDate as unknown as Date | null) : null;
      const scheduleEndDate = schedule ? isoDate(schedule.plannedEndDate as unknown as Date | null) : null;
      const deliveryWindowStart = deliveryStart ? isoDate(deliveryStart.plannedDeliveryWindowStart as unknown as Date | null) : null;
      const deliveryWindowEnd = deliveryStart ? isoDate(deliveryStart.plannedDeliveryWindowEnd as unknown as Date | null) : null;
      const actualStartDateTime = erectionStart?.actualStartDateTime ?? null;
      const attention = computeErectionAttention({ methodStatementStatus, plannedIssueDate, today });
      const genericTaskFallback = computeCurrentErectionStep(c.workflowTasks as ErectionWorkflowTaskRow[]);
      const currentErectionStep = computeCurrentErectionStepLabel({
        methodStatementStatus,
        approvalStatus,
        scheduleStatus,
        deliveryStartStatus,
        erectionStartStatus,
        checklistStatus,
        genericTaskFallback,
      });
      const nextAction = computeErectionNextAction({
        contractId: c.id,
        methodStatementStatus,
        hasMethodStatement: hasErectionMethodStatement,
        approvalStatus,
        scheduleStatus,
        hasSchedule: hasErectionSchedule,
        deliveryStartStatus,
        hasDeliveryStart: hasErectionDeliveryStart,
        erectionStartStatus,
        hasErectionStart,
        checklistStatus,
        hasChecklist: hasErectionChecklist,
      });

      // CM-71F — "Ready for Erection should become true after Delivery
      // Start is Started and Step 5 is ready/not started": delivery
      // Started is still required, but erectionStartStatus === 'STARTED'
      // now EXCLUDES a row from Ready for Erection — once Step 5 itself has
      // begun, the contract has moved past "ready to begin" into "in
      // progress" (the separate erectionInProgress signal below).
      const readyForErection = methodStatementStatus === 'ISSUED' && scheduleStatus === 'ISSUED'
        && deliveryStartStatus === 'STARTED' && erectionStartStatus !== 'STARTED';
      // CM-71F/CM-71G — "Erection In Progress should still count Step 5
      // Started" — this unit's own task explicitly confirmed no change here.
      const erectionInProgress = erectionStartStatus === 'STARTED';
      const hasOverdueErectionTask = c.workflowTasks.some((t) => computeTaskIsOverdue({ status: t.status, dueDate: t.dueDate }, utcToday()));

      const assignment = c.erectionWorkflowAssignment as ErectionAssignmentRow | null;
      // CM-71H.4 — same OR as the dashboard-scoping filter above: a task-
      // level assignment (responsibleUserId) grants "ACT" just like a real
      // ContractErectionWorkflowAssignment row does — one viewer, one real
      // signal either way, never two different answers for "is this mine."
      const hasOwnErectionTask = c.workflowTasks.some((t) => t.responsibleUserId === actor.id);
      const viewerActionMode = computeErectionViewerActionMode({
        hasAssignment: assignment !== null,
        isAssignedToActor: assignment?.assignedToUserId === actor.id || hasOwnErectionTask,
        actorCanManage,
      });
      const assignmentSource: 'WORKFLOW_ASSIGNMENT' | 'TASK_ASSIGNMENT_ONLY' | 'NONE' = assignment !== null
        ? 'WORKFLOW_ASSIGNMENT'
        : c.workflowTasks.some((t) => t.responsibleUserId !== null)
          ? 'TASK_ASSIGNMENT_ONLY'
          : 'NONE';

      kpiInputRows.push({
        methodStatementStatus,
        attention: hasOverdueErectionTask && attention !== 'OVERDUE' ? 'OVERDUE' : attention,
        readyForErection,
        erectionInProgress,
        checklistStatus,
      });

      rows.push({
        contractId: c.id,
        contractReference: c.referenceNumber,
        jobOrderNo: statement?.jobOrderNo ?? c.jobOrder ?? null,
        projectName: c.title,
        client: c.counterpartyName,
        contractStatus: c.status,
        lifecycleStatus: getDerivedLifecycleStatus({ status: c.status, endDate: c.endDate, renewalNoticeDate: c.renewalNoticeDate }),
        methodStatementStatus,
        approvalStatus,
        scheduleStatus,
        plannedIssueDate,
        scheduleStartDate,
        scheduleEndDate,
        deliveryStartStatus,
        deliveryWindowStart,
        deliveryWindowEnd,
        erectionStartStatus,
        actualStartDateTime,
        checklistStatus,
        workLocationYard: statement?.workLocationYard ?? null,
        responsibleTeam: c.department?.name ?? '—',
        currentErectionStep,
        attention: hasOverdueErectionTask && attention !== 'OVERDUE' ? 'OVERDUE' : attention,
        lastUpdated: (statement ? (statement.updatedAt as unknown as Date) : c.updatedAt).toISOString(),
        hasMethodStatement: hasErectionMethodStatement,
        nextAction,
        assignedToUserId: assignment?.assignedToUserId ?? null,
        assignedToName: assignment?.assignedToUser?.displayName ?? assignment?.assignedToName ?? null,
        assignedDepartment: assignment?.assignedDepartment ?? null,
        assignmentStatus: (assignment?.status as ErectionAssignmentStatus | undefined) ?? null,
        viewerActionMode,
        assignmentSource,
      });
    }

    const kpis = computeErectionDashboardKpis(kpiInputRows);

    const todaysActions = rows.filter(
      (r) => r.plannedIssueDate !== null && r.plannedIssueDate <= today && (r.methodStatementStatus === 'DRAFT' || r.methodStatementStatus === 'NOT_STARTED'),
    );
    const pendingApproval = rows.filter((r) => r.methodStatementStatus === 'SUBMITTED_FOR_APPROVAL' || r.methodStatementStatus === 'ISSUED');
    const overdueAttention = rows.filter((r) => r.attention === 'OVERDUE');

    const contractRefById = new Map(rows.map((r) => [r.contractId, r.contractReference]));
    const activityRows = rows.length
      ? await this.db.getClient().contractActivity.findMany({
          where: {
            contractId: { in: rows.map((r) => r.contractId) },
            OR: [
              { event: { startsWith: ERECTION_METHOD_STATEMENT_EVENT_PREFIX } },
              { event: { startsWith: ERECTION_SCHEDULE_EVENT_PREFIX } },
              { event: { startsWith: ERECTION_DELIVERY_START_EVENT_PREFIX } },
              { event: { startsWith: ERECTION_START_EVENT_PREFIX } },
              { event: { startsWith: ERECTION_CHECKLIST_EVENT_PREFIX } },
            ],
          },
          select: { id: true, contractId: true, event: true, actorName: true, createdAt: true },
          orderBy: [{ createdAt: 'desc' }],
          take: RECENT_ACTIVITY_CAP,
        })
      : [];

    const recentActivity: ErectionRecentActivityRow[] = activityRows.map((a) => ({
      id: a.id,
      contractId: a.contractId,
      contractReference: contractRefById.get(a.contractId) ?? '—',
      event: a.event,
      actorName: a.actorName ?? null,
      createdAt: a.createdAt.toISOString(),
    }));

    return { kpis, workQueue: rows, todaysActions, pendingApproval, overdueAttention, recentActivity };
  }
}
