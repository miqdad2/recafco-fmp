import { cookies } from 'next/headers';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'TERMINATED' | 'CLOSED' | 'CANCELLED';
export type DerivedLifecycleStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'TERMINATED' | 'CLOSED' | 'CANCELLED';

// CM-55 — manager-facing schedule/progress status (Contract List Status
// column). Deliberately separate from ContractStatus/DerivedLifecycleStatus
// above — never overwrites the real lifecycle.
export type ContractScheduleStatus = 'IN_PROGRESS' | 'ON_TRACK' | 'DELAYED' | 'COMPLETED' | 'AHEAD_OF_SCHEDULE';

export type ContractBoqMixDesignType = 'GRAY' | 'WHITE' | 'NOT_APPLICABLE';

export interface ContractBoqItem {
  id: string;
  sortOrder: number;
  itemCode?: string;
  category?: string;
  description: string;
  drawingReference?: string;
  specificationReference?: string;
  originalEstimatedQty?: string;
  revisedQty?: string;
  unitOfMeasure?: string;
  mixDesignType?: ContractBoqMixDesignType;
  concreteGrade?: string;
  unitPrice?: string;
  totalPrice?: string;
  // CM-56D — informational/technical quantity confirmed during
  // drawing/calculation stages. Never used by any BOQ formula.
  drawingQty?: string;
  // CM-56 — real, editable, stored field. Progress % / Amount Remaining are
  // deliberately NOT part of this shape — both are always derived from
  // invoiceQty/totalPrice (see contract-boq-helpers.ts).
  invoiceQty?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  referenceNumber: string;
  title: string;
  description?: string;
  status: ContractStatus;
  lifecycleStatus: DerivedLifecycleStatus;
  version: number;
  counterpartyName: string;
  counterpartyContact?: string;
  jobOrder?: string;
  contractDate?: string;
  quotationNumber?: string;
  projectNumber?: string;
  scopeOfWork?: Record<string, boolean | string>;
  paymentTerms?: Record<string, boolean>;
  boqItems?: ContractBoqItem[];
  contractValue?: string;
  currency?: string;
  startDate?: string;
  endDate?: string;
  renewalNoticeDate?: string;
  clientContactName?: string;
  clientContactPhone?: string;
  forecastCompletionDate?: string;
  originalContractValue?: string;
  originalCurrency?: string;
  projectSiteLocation?: string;
  scopeDescription?: string;
  scopeExclusions?: string;
  deliverables?: string;
  milestones?: string;
  scheduleSummary?: string;
  quantitiesSpecifications?: string;
  craneRequired?: string;
  craneProvidedBy?: string;
  estimatedCraneCapacity?: string;
  ownerUser: { id: string; displayName: string };
  department?: { id: string; name: string };
  plant?: { id: string; name: string };
  location?: { id: string; name: string };
  notes?: string;
  createdByUser: { id: string; displayName: string };
  activatedAt?: string;
  activatedByUser?: { id: string; displayName: string };
  terminatedAt?: string;
  terminatedByUser?: { id: string; displayName: string };
  terminationReason?: string;
  closedAt?: string;
  closedByUser?: { id: string; displayName: string };
  cancelledAt?: string;
  cancelledByUser?: { id: string; displayName: string };
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  // CM-55 — Contract List only (contractsApi.list()); absent from
  // contractsApi.get()'s findOne response. See contracts.service.ts's
  // toListItem()/computeEffectiveScheduleStatus() for how these are derived.
  scheduleStatus?: ContractScheduleStatus | null;
  effectiveScheduleStatus?: ContractScheduleStatus;
  progressPercent?: number;
  paymentProgressPercent?: number;
  openClaimsCount?: number;
}

export interface ContractComment {
  id: string;
  contractId: string;
  authorUser: { id: string; displayName: string };
  body: string;
  createdAt: string;
}

export interface ContractActivity {
  id: string;
  contractId: string;
  actorUserId?: string;
  actorName?: string;
  event: string;
  previousStatus?: ContractStatus;
  newStatus?: ContractStatus;
  metadata?: unknown;
  createdAt: string;
}

// CM-69I — every field here is now scoped to whatever filters the caller
// passed (same shape as ContractListQuery/ContractListQueryDto) — never a
// separate, filter-blind global count. See contracts.service.ts's
// getSummary() for the full reasoning.
export interface ContractSummary {
  totalContracts: number;
  activeContracts: number;
  totalContractValue: string;
  totalOpenClaims: number;
}

export type DashboardScopeType = 'OWN_DEPARTMENT' | 'SELECTED_DEPARTMENTS' | 'ALL_DEPARTMENTS';

// CM-37 — role-based dashboard. MANAGER/STAFF are computed server-side from
// the actor's permissions (contracts.update/contracts.close -> MANAGER,
// otherwise STAFF) — never trust a client-side role-code guess.
export type ContractDashboardType = 'MANAGER' | 'STAFF';

export type ManagerAttentionActionType =
  | 'ACTIVATE_CONTRACT' | 'ASSIGN_TASKS' | 'OVERDUE_TASK' | 'OPEN_ISSUE' | 'OPEN_CLAIM'
  | 'OUTSTANDING_PAYMENT' | 'CLOSEOUT_REVIEW' | 'CONTRACT_ENDING_SOON';

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

export type WorkflowTeam = 'TECHNICAL' | 'PRODUCTION' | 'ERECTION' | 'QS_COMMERCIAL';

export interface TeamWorkflowOverview {
  team: WorkflowTeam;
  openTasks: number;
  unassignedTasks: number;
  overdueTasks: number;
  completedTasks: number;
}

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

// CM-54 — approved-design dashboard insights (financial totals, top-5 lists,
// claims-by-status). Mirrors ManagerDashboardInsights in
// apps/api/src/contracts/contract-dashboard.service.ts exactly.
export interface ManagerDashboardFinancials {
  contractValueTotal: number;
  originalContractValueTotal: number;
  submittedTotal: number;
  paidTotal: number;
  outstandingTotal: number;
  openClaimsValue: number;
  overduePayments: number;
}

export interface TopDelayedContract {
  contractId: string;
  contractReference: string;
  jobOrderLabel: string;
  projectName: string;
  delayDays: number;
}

export interface TopValueContract {
  contractId: string;
  contractReference: string;
  jobOrderLabel: string;
  projectName: string;
  value: number;
}

export interface ClaimStatusCount {
  status: string;
  count: number;
}

export interface ManagerDashboardInsights {
  financials: ManagerDashboardFinancials;
  criticalProjectContracts: number;
  overdueWorkflowTasksContracts: number;
  claimsWithActionDue: number;
  contractsClosingSoon: number;
  claimsByStatus: ClaimStatusCount[];
  topDelayedContracts: TopDelayedContract[];
  topValueContracts: TopValueContract[];
}

export interface ManagerDashboardData {
  summary: ManagerDashboardSummary;
  attentionItems: ManagerAttentionItem[];
  workflowOverview: TeamWorkflowOverview[];
  upcomingSchedule: ScheduleItem[];
  insights: ManagerDashboardInsights;
}

export interface StaffTaskRow {
  id: string;
  taskKey: string;
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
  /** CM-71H.4 — frontend-computed only (see dashboard/page.tsx); true only for a guided erection task whose prerequisite hasn't been met yet. */
  guidedStepLocked?: boolean;
}

export interface StaffDashboardSummary {
  myOpenTasks: number;
  myInProgressTasks: number;
  myOverdueTasks: number;
  dueThisWeek: number;
  completedTasks: number;
  myActiveContracts: number;
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

export interface StaffDashboardData {
  summary: StaffDashboardSummary;
  assignedTasks: StaffTaskRow[];
  upcomingSchedule: ScheduleItem[];
  recentUpdates: StaffRecentUpdate[];
}

export interface ContractDashboardData {
  scope: { type: DashboardScopeType; departmentNames: string[] };
  metrics: {
    totalDraft: number;
    totalActive: number;
    totalExpiring: number;
    totalExpired: number;
    totalTerminated: number;
    totalClosed: number;
    totalCancelled: number;
  };
  recent: { id: string; referenceNumber: string; title: string; status: string; updatedAt: string }[];
  dashboardType: ContractDashboardType;
  manager?: ManagerDashboardData;
  staff?: StaffDashboardData;
}

// ---------------------------------------------------------------------------
// CM-71B — Erection Manager Dashboard / Work Queue. Mirrors
// apps/api/src/contracts/contract-erection-dashboard.service.ts exactly, no
// new table — see that file's own header comment for the real data sources
// (Contract.scopeOfWork, CM-71A's ContractErectionMethodStatement, the
// existing generic ERECTION-team ContractWorkflowTask rows).
// ---------------------------------------------------------------------------

export type ErectionMethodStatementDisplayStatus = 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED_FOR_APPROVAL' | 'ISSUED';
/** CM-71C — Step 2's own review status as surfaced on the dashboard; NOT_STARTED is the dashboard's own "no approval row yet" convention. */
export type ErectionMethodStatementApprovalDisplayStatus = 'NOT_STARTED' | 'PENDING_APPROVAL' | 'DRAFT_REVIEW' | 'APPROVED' | 'REVISION_REQUESTED' | 'REJECTED';
/** CM-71D — Step 3's own schedule status as surfaced on the dashboard; NOT_STARTED is the dashboard's own "no schedule row yet" convention. */
export type ErectionScheduleDisplayStatus = 'NOT_STARTED' | 'DRAFT' | 'ISSUED' | 'HOLD' | 'RETURNED';
/** CM-71E — Step 4's own delivery-start status as surfaced on the dashboard; NOT_STARTED is the dashboard's own "no delivery-start row yet" convention. */
export type ErectionDeliveryStartDisplayStatus = 'NOT_STARTED' | 'DRAFT' | 'STARTED' | 'HOLD' | 'RETURNED';
/** CM-71F — Step 5's own erection-start status as surfaced on the dashboard; NOT_STARTED is the dashboard's own "no erection-start row yet" convention. */
export type ErectionStartDisplayStatus = 'NOT_STARTED' | 'DRAFT' | 'STARTED' | 'HOLD' | 'RETURNED';
/** CM-71G — Step 6's own erection-checklist status as surfaced on the dashboard; NOT_STARTED is the dashboard's own "no checklist row yet" convention. */
export type ErectionChecklistDisplayStatus = 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED_FOR_VERIFICATION' | 'VERIFIED' | 'HOLD' | 'RETURNED';
export type ErectionAttentionStatus = 'OVERDUE' | 'AWAITING_APPROVAL' | 'ON_TRACK' | 'NEEDS_PLANNING';

export interface ErectionNextAction {
  label: string;
  href: string;
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
  approvalStatus: ErectionMethodStatementApprovalDisplayStatus;
  scheduleStatus: ErectionScheduleDisplayStatus;
  plannedIssueDate: string | null;
  scheduleStartDate: string | null;
  scheduleEndDate: string | null;
  deliveryStartStatus: ErectionDeliveryStartDisplayStatus;
  deliveryWindowStart: string | null;
  deliveryWindowEnd: string | null;
  erectionStartStatus: ErectionStartDisplayStatus;
  actualStartDateTime: string | null;
  checklistStatus: ErectionChecklistDisplayStatus;
  workLocationYard: string | null;
  responsibleTeam: string;
  currentErectionStep: string;
  attention: ErectionAttentionStatus;
  lastUpdated: string;
  hasMethodStatement: boolean;
  nextAction: ErectionNextAction;
  /** CM-71H — null until a ContractErectionWorkflowAssignment row exists for this contract. */
  assignedToUserId: string | null;
  assignedToName: string | null;
  assignedDepartment: string | null;
  assignmentStatus: ContractErectionWorkflowAssignmentStatus | null;
  /** CM-71H — "Continue/Update" vs "View Status" vs read-only, computed server-side for the CURRENT viewer. */
  viewerActionMode: ErectionViewerActionMode;
  /** CM-71H.4 — WORKFLOW_ASSIGNMENT (formal, preferred) / TASK_ASSIGNMENT_ONLY (a real task assignment exists but no formal workflow assignment yet — a manager-tier viewer sees a nudge to formalize it) / NONE. */
  assignmentSource: 'WORKFLOW_ASSIGNMENT' | 'TASK_ASSIGNMENT_ONLY' | 'NONE';
}

export interface ErectionDashboardKpis {
  totalErectionContracts: number;
  methodStatementPending: number;
  submittedForApproval: number;
  readyForErection: number;
  erectionInProgress: number;
  delayedAttentionRequired: number;
  /** CM-71G — now a real count (Step 6 Draft/Submitted-but-not-verified records), not a fixed placeholder. */
  checklistPending: number;
  paymentPendingAfterErectionAvailable: false;
}

export interface ErectionRecentActivityRow {
  id: string;
  contractId: string;
  contractReference: string;
  event: string;
  actorName: string | null;
  createdAt: string;
}

export interface ErectionDashboardData {
  kpis: ErectionDashboardKpis;
  workQueue: ErectionWorkQueueRow[];
  todaysActions: ErectionWorkQueueRow[];
  pendingApproval: ErectionWorkQueueRow[];
  overdueAttention: ErectionWorkQueueRow[];
  recentActivity: ErectionRecentActivityRow[];
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ContractPerson {
  id: string;
  displayName: string;
  departmentId?: string;
}

export interface OrgRef {
  id: string;
  name: string;
  code: string;
}

export interface LocationRef extends OrgRef {
  plantId?: string;
}

export type ContractPaymentStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'CERTIFIED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED';

export interface ContractPayment {
  id: string;
  contractId: string;
  paymentNo?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  paymentTerm?: string;
  submittedAmount?: string;
  certifiedAmount?: string;
  paidAmount?: string;
  outstandingAmount: string | null;
  overdueDays: number | null;
  dueDate?: string;
  paidDate?: string;
  status: ContractPaymentStatus;
  remarks?: string;
  createdByUser: { id: string; displayName: string };
  updatedByUser?: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
  contract: {
    id: string;
    referenceNumber: string;
    title: string;
    counterpartyName: string;
    contractValue?: string;
    currency?: string;
    ownerUser: { id: string; displayName: string };
    department?: { id: string; name: string };
  };
}

export interface ContractPaymentSummary {
  totalSubmitted: string;
  totalCertified: string;
  totalPaid: string;
  totalOutstanding: string;
  overdueCount: number;
  overdueValue: string;
}

export interface ContractPaymentListResponse extends ListResponse<ContractPayment> {
  summary: ContractPaymentSummary;
}

export interface ContractPaymentListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  company?: string;
  contractId?: string;
  status?: string;
  departmentId?: string;
  ownerUserId?: string;
  invoiceDateFrom?: string;
  invoiceDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  overdueOnly?: boolean;
}

export type ContractWorkflowTeam = 'TECHNICAL' | 'PRODUCTION' | 'ERECTION' | 'QS_COMMERCIAL';

export type ContractWorkflowTaskStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'ON_HOLD';

/** Derived, contract-level summary status — distinct from the per-task ContractWorkflowTaskStatus. */
export type WorkflowStatus = 'NOT_GENERATED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export type ContractWorkflowTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ContractWorkflowTask {
  id: string;
  contractId: string;
  team: ContractWorkflowTeam;
  taskKey: string;
  taskName: string;
  sortOrder: number;
  status: ContractWorkflowTaskStatus;
  priority: ContractWorkflowTaskPriority;
  delayReason?: string;
  responsibleUserId?: string;
  responsibleUser?: { id: string; displayName: string };
  startDate?: string;
  dueDate?: string;
  completedDate?: string;
  remarks?: string;
  /** CM-46B — optional Contract Staff task-intake fields (Receipt Details / Drawing-Task Information / Follow-up notes). Never core workflow state — see contract-workflow.service.ts's sanitizeWorkflowTaskFormData(). */
  formData?: Record<string, string | boolean> | null;
  lastActivityAt: string;
  attachmentsCount: number;
  commentsCount: number;
  isOverdue: boolean;
  createdByUser: { id: string; displayName: string };
  updatedByUser?: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
}

export interface ContractWorkflowTaskComment {
  id: string;
  taskId: string;
  comment: string;
  createdByUserId: string;
  createdByUser: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
}

export interface ContractWorkflowTaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  uploadedByUserId: string;
  uploadedByUser: { id: string; displayName: string };
  createdAt: string;
}

export interface ContractWorkflowProgress {
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  overdue: number;
  workflowStatus: WorkflowStatus;
}

// CM-57 — GET /contracts/:id/workflow-summary. Read-only; never generates tasks.
// CM-67 — id/taskName/priority/dueDate added for the Closeout tab's Blocking
// Items table; every existing consumer (Overview) only reads team/status/
// isOverdue/attachmentsCount, so this is purely additive.
export interface ContractWorkflowSummaryData {
  tasks: {
    id: string;
    taskName: string;
    team: ContractWorkflowTeam;
    status: ContractWorkflowTaskStatus;
    priority: ContractWorkflowTaskPriority;
    dueDate: string | null;
    isOverdue: boolean;
    attachmentsCount: number;
  }[];
}

export interface ContractWorkflowDetail {
  contract: {
    id: string;
    referenceNumber: string;
    title: string;
    counterpartyName: string;
    status: ContractStatus;
    scopeOfWork?: Record<string, boolean | string>;
    department?: { id: string; name: string };
    ownerUser: { id: string; displayName: string };
  };
  tasks: ContractWorkflowTask[];
  progress: ContractWorkflowProgress;
}

export interface ContractWorkflowListItem {
  id: string;
  referenceNumber: string;
  title: string;
  counterpartyName: string;
  status: ContractStatus;
  scopeOfWork?: Record<string, boolean | string>;
  department?: { id: string; name: string };
  ownerUser: { id: string; displayName: string };
  openTasks: number;
  overdueTasks: number;
  workflowStatus: WorkflowStatus;
  lastUpdated: string | null;
}

export interface ContractWorkflowSummary {
  totalContractsWithWorkflow: number;
  tasksNotStarted: number;
  tasksInProgress: number;
  tasksCompleted: number;
  tasksOverdue: number;
  myOpenTasks: number;
}

export interface ContractWorkflowListResponse extends ListResponse<ContractWorkflowListItem> {
  summary: ContractWorkflowSummary;
}

export interface ContractWorkflowListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  departmentId?: string;
  ownerUserId?: string;
  workflowStatus?: string;
  team?: string;
  taskStatus?: string;
  responsibleUserId?: string;
  overdueOnly?: boolean;
  myTasksOnly?: boolean;
}

// ---------------------------------------------------------------------------
// CM-40 — Manager Assignment Queue (/contracts/workflow?mode=assignment).
// A flat, task-level view distinct from ContractWorkflowListItem above (which
// is per-contract) — one row per unassigned workflow task, with contract
// context joined in.
// ---------------------------------------------------------------------------

export interface WorkflowAssignmentQueueItem {
  taskId: string;
  contractId: string;
  contractReference: string;
  contractTitle: string;
  counterpartyName: string;
  contractStatus: ContractStatus;
  department?: { id: string; name: string };
  ownerUser: { id: string; displayName: string };
  team: ContractWorkflowTeam;
  taskName: string;
  status: ContractWorkflowTaskStatus;
  priority: ContractWorkflowTaskPriority;
  dueDate: string | null;
}

export interface WorkflowAssignmentQueueSummary {
  contractsNeedingAssignment: number;
  unassignedTasksTotal: number;
  technicalUnassigned: number;
  productionUnassigned: number;
  erectionUnassigned: number;
  qsCommercialUnassigned: number;
}

export interface WorkflowContractNeedingSetup {
  id: string;
  referenceNumber: string;
  title: string;
  scopeOfWork?: Record<string, boolean | string>;
}

export interface WorkflowAssignmentQueueResponse {
  items: WorkflowAssignmentQueueItem[];
  truncated: boolean;
  summary: WorkflowAssignmentQueueSummary;
  contractsNeedingSetup: WorkflowContractNeedingSetup[];
}

export interface ContractWorkflowAssignmentQueueQuery {
  search?: string;
  status?: string;
  departmentId?: string;
  ownerUserId?: string;
  team?: string;
  priority?: string;
  dueDateMissing?: boolean;
}

export type ContractIssuePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ContractIssueStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_RESPONSE'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELLED';

export interface ContractIssue {
  id: string;
  contractId: string;
  issueNo?: string;
  title: string;
  description?: string;
  category?: string;
  priority: ContractIssuePriority;
  status: ContractIssueStatus;
  responsibleUserId?: string;
  responsibleUser?: { id: string; displayName: string };
  raisedDate?: string;
  dueDate?: string;
  closedDate?: string;
  overdueDays: number | null;
  isOverdue: boolean;
  resolution?: string;
  remarks?: string;
  createdByUser: { id: string; displayName: string };
  updatedByUser?: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
  contract: {
    id: string;
    referenceNumber: string;
    title: string;
    counterpartyName: string;
    ownerUser: { id: string; displayName: string };
    department?: { id: string; name: string };
  };
}

export interface ContractIssueSummary {
  totalIssues: number;
  openIssues: number;
  inProgressIssues: number;
  highCriticalIssues: number;
  overdueIssues: number;
  closedIssues: number;
  waitingResponseIssues: number;
  resolvedIssues: number;
}

export interface ContractIssueListResponse extends ListResponse<ContractIssue> {
  summary: ContractIssueSummary;
}

export interface ContractIssueListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  contractId?: string;
  status?: string;
  priority?: string;
  category?: string;
  departmentId?: string;
  responsibleUserId?: string;
  ownerUserId?: string;
  raisedDateFrom?: string;
  raisedDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  overdueOnly?: boolean;
}

export type ContractClaimType =
  | 'VARIATION'
  | 'EXTENSION_OF_TIME'
  | 'DELAY'
  | 'PAYMENT'
  | 'DAMAGE'
  | 'SCOPE_CHANGE'
  | 'OTHER';

export type ContractClaimStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'SUBMITTED'
  | 'UNDER_NEGOTIATION'
  | 'APPROVED'
  | 'PARTIALLY_APPROVED'
  | 'REJECTED'
  | 'SETTLED'
  | 'CLOSED'
  | 'CANCELLED';

export interface ContractClaim {
  id: string;
  contractId: string;
  claimNo?: string;
  claimTitle: string;
  claimType: ContractClaimType;
  eventDate?: string;
  claimDate?: string;
  status: ContractClaimStatus;
  submittedValue?: string;
  approvedValue?: string;
  outstandingValue: string | null;
  eotClaimedDays?: number;
  eotApprovedDays?: number;
  responsibleUserId?: string;
  responsibleUser?: { id: string; displayName: string };
  nextAction?: string;
  dueDate?: string;
  closedDate?: string;
  overdueDays: number | null;
  isOverdue: boolean;
  /** CM-61 — signed days until dueDate (negative once past due); null only when dueDate itself is unset. Never status-gated, unlike overdueDays. */
  daysToDeadline: number | null;
  remarks?: string;
  createdByUser: { id: string; displayName: string };
  updatedByUser?: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
  contract: {
    id: string;
    referenceNumber: string;
    title: string;
    counterpartyName: string;
    contractValue?: string;
    currency?: string;
    ownerUser: { id: string; displayName: string };
    department?: { id: string; name: string };
  };
}

export interface ContractClaimSummary {
  openClaims: number;
  totalSubmittedValue: string;
  totalApprovedValue: string;
  totalOutstandingValue: string;
  overdueClaims: number;
  closedOrSettledClaims: number;
  totalEotClaimedDays: number;
  totalEotApprovedDays: number;
}

export interface ContractClaimListResponse extends ListResponse<ContractClaim> {
  summary: ContractClaimSummary;
}

export interface ContractClaimListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  contractId?: string;
  status?: string;
  claimType?: string;
  departmentId?: string;
  responsibleUserId?: string;
  ownerUserId?: string;
  claimDateFrom?: string;
  claimDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  overdueOnly?: boolean;
}

export type ContractCloseoutRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CLOSED'
  | 'CANCELLED';

export interface ContractCloseoutRiskSnapshot {
  openWorkflowTasksCount: number;
  overdueWorkflowTasksCount: number;
  openIssuesCount: number;
  openClaimsCount: number;
  outstandingPaymentAmount: string;
  unpaidPaymentsCount: number;
  missingCloseoutDocumentsCount: number;
  checkedAt: string;
}

export interface ContractCloseoutRequest {
  id: string;
  contractId: string;
  requestNo: string;
  status: ContractCloseoutRequestStatus;
  requestedByUserId: string;
  requestedByUser: { id: string; displayName: string };
  requestedAt: string;
  reviewedByUserId?: string;
  reviewedByUser?: { id: string; displayName: string };
  reviewedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  closedAt?: string;
  closeoutSummary?: string;
  requestedRemarks?: string;
  reviewRemarks?: string;
  rejectionReason?: string;
  riskSnapshot?: ContractCloseoutRiskSnapshot;
  attachmentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContractCloseoutChecks {
  workflow: { total: number; open: number; overdue: number; completed: number };
  issues: { total: number; open: number; final: number };
  claims: { total: number; open: number; final: number };
  payments: { nonFinalCount: number; partiallyPaidCount: number; overdueCount: number; outstandingAmount: string };
  documents: { count: number };
  isReadyForClosure: boolean;
  checkedAt: string;
}

export interface ContractCloseoutAttachment {
  id: string;
  closeoutRequestId: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  uploadedByUserId: string;
  uploadedByUser: { id: string; displayName: string };
  createdAt: string;
}

// CM-38 — module-level Closeout Requests register.
export interface CloseoutListItem {
  requestId: string;
  requestNo: string;
  status: ContractCloseoutRequestStatus;
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
  riskSnapshot: ContractCloseoutRiskSnapshot | null;
  attachmentsCount: number;
  actionUrl: string;
}

export interface CloseoutListSummary {
  totalRequests: number;
  submitted: number;
  underReview: number;
  approved: number;
  rejected: number;
  closed: number;
  pendingReview: number;
}

export interface ContractCloseoutListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  contractId?: string;
  status?: string;
  requestedByUserId?: string;
  reviewedByUserId?: string;
  departmentId?: string;
  requestedDateFrom?: string;
  requestedDateTo?: string;
  reviewedDateFrom?: string;
  reviewedDateTo?: string;
  approvedDateFrom?: string;
  approvedDateTo?: string;
  pendingOnly?: boolean;
}

export interface ContractCloseoutListResponse extends ListResponse<CloseoutListItem> {
  summary: CloseoutListSummary;
}

export type ScheduleItemType =
  | 'CONTRACT_START'
  | 'CONTRACT_END'
  | 'FORECAST_COMPLETION'
  | 'WORKFLOW_TASK'
  | 'ISSUE_DUE'
  | 'CLAIM_DUE'
  | 'PAYMENT_DUE'
  | 'CLOSEOUT_REQUEST'
  | 'CLOSEOUT_APPROVAL'
  | 'CLOSEOUT_CLOSED';

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

export interface ContractScheduleListResponse extends ListResponse<ScheduleItem> {
  summary: ScheduleSummary;
}

export interface ContractScheduleListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  contractId?: string;
  itemType?: string;
  status?: string;
  departmentId?: string;
  responsibleUserId?: string;
  ownerUserId?: string;
  dateFrom?: string;
  dateTo?: string;
  overdueOnly?: boolean;
  upcomingOnly?: boolean;
}

// ---------------------------------------------------------------------------
// CM-68A — Contract Detail Schedule: real Planned vs Actual, replacing the
// old CM-34 due-date aggregation for this ONE per-contract tab (the
// module-level register at /contracts/schedule — ScheduleItem/
// ScheduleSummary/ContractScheduleListResponse above — is untouched).
// Planned values are only ever entered by a manager and stored in the real
// additive ContractScheduleItem table; actual values are never stored —
// always derived live from real workflow/payment/production/closeout
// records server-side. See contract-schedule-plan.service.ts.
// ---------------------------------------------------------------------------

export type ContractScheduleStageKey =
  | 'CONTRACT_SIGN'
  | 'ADVANCE_PAYMENT'
  | 'DRAWING_APPROVAL'
  | 'ESTIMATION_SHEET'
  | 'CASTING_PRODUCTION'
  | 'DELIVERY'
  | 'ERECTION'
  | 'FINAL_CLOSEOUT';

export type ContractScheduleStageStatus = 'NOT_PLANNED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED' | 'ON_TRACK' | 'AHEAD';

export interface ContractScheduleStageRow {
  stageKey: ContractScheduleStageKey;
  stageName: string;
  responsibleTeam: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  plannedQuantity: number | null;
  plannedMolds: number | null;
  remarks: string | null;
  isRequired: boolean;
  /** Real, derived only — "—" (null) whenever no real source is safely identifiable. */
  actualStartDate: string | null;
  actualEndDate: string | null;
  producedQuantity: number | null;
  moldsProduced: number | null;
  /** e.g. "Contract", "Payments (first received)", "Workflow (Technical)", "Production Status", "Closeout", "Not available", "Not linked yet". */
  source: string;
  status: ContractScheduleStageStatus;
  /** Positive = late, negative = early/ahead, 0 = on time, null = nothing real to show. */
  delayDays: number | null;
}

export interface ContractScheduleSummaryData {
  scheduleStatus: 'Delayed' | 'In Progress' | 'Completed' | 'On Track' | 'Not Planned';
  plannedCompletionDate: string | null;
  actualOrForecastCompletionDate: string | null;
  delayDays: number | null;
  completedStages: number;
  pendingStages: number;
  totalStages: number;
}

export interface ContractScheduleDetail {
  contractSummary: { contractDate: string | null; activatedAt: string | null; closedAt: string | null; status: string };
  stages: ContractScheduleStageRow[];
  hasPlannedSchedule: boolean;
  summary: ContractScheduleSummaryData;
}

export interface UpdateContractScheduleStageInput {
  stageKey: ContractScheduleStageKey;
  stageName?: string;
  responsibleTeam?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  plannedQuantity?: number;
  plannedMolds?: number;
  remarks?: string;
  isRequired?: boolean;
}

// ---------------------------------------------------------------------------
// CM-68B — Global Contract Schedule Overview (the sidebar "Schedule" page).
// Every row reuses CM-68A's real per-contract Planned vs Actual derivation
// server-side — never a duplicated/simplified re-derivation on the
// frontend. "—"/"Not Planned"/"No blocker" are real, honest values, never
// fabricated.
// ---------------------------------------------------------------------------

export type ContractScheduleOverviewStatus = 'Delayed' | 'On Track' | 'Not Planned' | 'Completed' | 'Attention';

export interface ContractScheduleOverviewRow {
  contractId: string;
  contractNumber: string;
  jobOrderNumber: string | null;
  projectName: string;
  clientName: string;
  contractStatus: string;
  scheduleStatus: ContractScheduleOverviewStatus;
  currentStage: string;
  plannedFinishDate: string | null;
  actualOrForecastFinishDate: string | null;
  delayDays: number | null;
  blockingTeam: string;
  blockingStage: string;
  openBlockerCount: number;
  nextMilestone: string;
  nextMilestoneDate: string | null;
  completedStages: number;
  totalStages: number;
  actionUrl: string;
}

export interface ContractScheduleOverviewSummary {
  totalActiveContracts: number;
  onTrack: number;
  delayed: number;
  notPlanned: number;
  dueThisWeek: number;
  completedThisMonth: number;
}

export interface ContractScheduleOverviewResult {
  rows: ContractScheduleOverviewRow[];
  summary: ContractScheduleOverviewSummary;
}

// ---------------------------------------------------------------------------
// CM-59 — Contract Production Status. Manually tracked inside Contract
// Management (no Production Module integration exists) — one row per
// ContractBoqItem, contract-scoped and unpaginated like ContractScheduleDetail
// above. totalQty/stockNotDelivered/remainingToCast/progressPercent are all
// server-computed, never entered directly.
// ---------------------------------------------------------------------------

export type ContractBoqProductionStatus =
  | 'NOT_STARTED'
  | 'IN_PRODUCTION'
  | 'PARTIALLY_DELIVERED'
  | 'COMPLETED'
  | 'DELAYED';

export interface ContractProductionItem {
  id: string;
  itemCode: string | null;
  category: string | null;
  description: string;
  unitOfMeasure: string | null;
  totalQty: number;
  producedQty: number;
  deliveredQty: number;
  stockNotDelivered: number;
  remainingToCast: number;
  progressPercent: number;
  status: ContractBoqProductionStatus;
  remarks: string | null;
  updatedByUser: { id: string; displayName: string } | null;
  updatedAt: string | null;
}

export interface ContractProductionSummary {
  totalQty: number;
  producedQty: number;
  deliveredQty: number;
  stockNotDelivered: number;
  remainingToCast: number;
  progressPercent: number;
}

export interface ContractProductionDetail {
  items: ContractProductionItem[];
  summary: ContractProductionSummary;
}

// ---------------------------------------------------------------------------
// CM-60 — Contract Variations / Change Orders. "Variation" is the real
// field/table terminology (per this unit's naming decision — "Change
// Orders" only appears in the page/tab title on the frontend). Contract-
// scoped and unpaginated like ContractProductionDetail above.
// computedCurrentValue/originalContractValue are server-computed strings,
// null when the contract has no originalContractValue — never a fabricated
// number. Contract.contractValue itself (BOQ-derived) is never written by
// this unit.
// ---------------------------------------------------------------------------

export type ContractVariationStatus = 'DRAFT' | 'SUBMITTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

// CM-60C — a real uploaded supporting document. Additive alongside the
// original supportingDocumentName/supportingDocumentUrl text/link fields
// (kept for backwards compatibility, never removed) — a variation can have
// both, or only the older text reference, or neither.
export interface ContractVariationAttachment {
  id: string;
  variationId: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploadedByUser: { id: string; displayName: string } | null;
}

export interface ContractVariation {
  id: string;
  contractId: string;
  variationNo?: string;
  description: string;
  amount?: string;
  currency: string;
  affectsContractValue: boolean;
  status: ContractVariationStatus;
  submittedDate?: string;
  approvedDate?: string;
  supportingDocumentName?: string;
  supportingDocumentUrl?: string;
  remarks?: string;
  createdByUser: { id: string; displayName: string };
  updatedByUser?: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
  attachments: ContractVariationAttachment[];
}

export interface ContractVariationSummary {
  totalVariations: number;
  approvedValue: string;
  pendingValue: string;
  rejectedCancelledValue: string;
  netVariationImpact: string;
}

export interface ContractVariationDetail {
  items: ContractVariation[];
  summary: ContractVariationSummary;
  originalContractValue: string | null;
  computedCurrentValue: string | null;
}

// ---------------------------------------------------------------------------
// CM-60C — Contract Attachments tab: a read-only aggregation across the 3
// attachment tables that already exist (workflow task, closeout, variation).
// No upload from this list — each source keeps its own real upload flow.
// ---------------------------------------------------------------------------

export type ContractAttachmentSource = 'WORKFLOW_TASK' | 'CLOSEOUT' | 'VARIATION' | 'DOCUMENT_OBLIGATION';

export interface ContractAttachment {
  id: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploadedByUser: { id: string; displayName: string } | null;
  source: ContractAttachmentSource;
  sourceLabel: string;
  relatedItemTitle: string;
  /** Real ContractDocumentObligation category (e.g. "PERFORMANCE_BOND") — only ever set for source === 'DOCUMENT_OBLIGATION'; null for the other 3 sources. */
  documentObligationCategory: string | null;
  downloadPath: string;
}

// ---------------------------------------------------------------------------
// CM-71A — Erection Workflow, Step 1: Issue Erection Method Statement. At
// most one record per contract (see the model comment in schema.prisma for
// why this is a new dedicated table, not a reuse of the existing generic
// ContractWorkflowTask "Team Task Register"). status only ever stores the 3
// real save-triggered values — "Ready to Issue" (shown in the approved
// design) is a computed frontend-only badge for a DRAFT record whose
// required fields are all already filled in, never a 4th stored value.
// ---------------------------------------------------------------------------

export type ContractErectionMethodStatementStatus = 'DRAFT' | 'SUBMITTED_FOR_APPROVAL' | 'ISSUED';

export interface ContractErectionMethodStatementAttachment {
  id: string;
  methodStatementId: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploadedByUser: { id: string; displayName: string } | null;
}

export interface ContractErectionMethodStatement {
  id: string;
  contractId: string;
  plannedIssueDate: string | null;
  methodStatementRefNo: string;
  jobOrderNo: string;
  workLocationYard: string;
  preparedBy: string;
  departmentArea: string;
  reviewedByInternal: string | null;
  documentRevision: string | null;
  applicableStandards: string | null;
  includesLiftPlan: boolean;
  includesRiskAssessment: boolean;
  requiresClientApproval: boolean;
  scopeDescription: string;
  status: ContractErectionMethodStatementStatus;
  createdByUser: { id: string; displayName: string };
  updatedByUser?: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
  attachments: ContractErectionMethodStatementAttachment[];
}

// ---------------------------------------------------------------------------
// CM-71C — Erection Workflow, Step 2: Erection Method Statement Approval.
// At most one record per method statement (see the model comment in
// schema.prisma). reviewStatus's PENDING_APPROVAL default IS a real stored
// value here (unlike CM-71A's Step 1, where the equivalent "not yet
// touched" state is a frontend-only computed label) — this table's own
// task explicitly lists it in the suggested enum.
// ---------------------------------------------------------------------------

export type ContractErectionMethodStatementApprovalReviewStatus =
  | 'PENDING_APPROVAL'
  | 'DRAFT_REVIEW'
  | 'APPROVED'
  | 'REVISION_REQUESTED'
  | 'REJECTED';

export type ContractErectionMethodStatementApprovalDecision = 'APPROVE' | 'REQUEST_REVISION' | 'REJECT';

export interface ContractErectionMethodStatementApprovalAttachment {
  id: string;
  approvalId: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploadedByUser: { id: string; displayName: string } | null;
}

export interface ContractErectionMethodStatementApproval {
  id: string;
  contractId: string;
  methodStatementId: string;
  reviewRequiredBy: string | null;
  reviewingEngineer: string | null;
  reviewType: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reviewStatus: ContractErectionMethodStatementApprovalReviewStatus;
  decision: ContractErectionMethodStatementApprovalDecision | null;
  requiresClientApproval: boolean;
  comments: string | null;
  approvedAt: string | null;
  revisionRequestedAt: string | null;
  rejectedAt: string | null;
  reviewedByUser?: { id: string; displayName: string } | null;
  createdByUser: { id: string; displayName: string };
  updatedByUser?: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
  attachments: ContractErectionMethodStatementApprovalAttachment[];
}

// ---------------------------------------------------------------------------
// CM-71D — Erection Workflow, Step 3: Issue Erection Schedule. At most one
// record per contract (see the model comment in schema.prisma) — same
// "one-per-contract, create-once-edit-forever" shape as CM-71A's Step 1.
// status only ever stores the 4 real save-triggered values — there is no
// "Ready to Issue" stored value, matching CM-71A's own precedent (that
// label, where shown, is a frontend-only computed badge for a DRAFT record
// whose required fields are all already filled in).
// ---------------------------------------------------------------------------

export type ContractErectionScheduleStatus = 'DRAFT' | 'ISSUED' | 'HOLD' | 'RETURNED';

export interface ContractErectionScheduleAttachment {
  id: string;
  erectionScheduleId: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploadedByUser: { id: string; displayName: string } | null;
}

export interface ContractErectionSchedule {
  id: string;
  contractId: string;
  methodStatementId: string | null;
  approvalId: string | null;
  scheduleReferenceNo: string;
  scheduleDate: string;
  plannedStartDate: string;
  plannedEndDate: string;
  jobOrderNo: string;
  erectionCrewTeam: string;
  estimatedManpowerPlanned: number;
  requiredEquipmentPlanned: number;
  preparedBy: string;
  reviewedByErectionManager: string | null;
  reviewedOn: string | null;
  documentRevision: string | null;
  totalActivities: number;
  criticalActivities: number;
  status: ContractErectionScheduleStatus;
  remarks: string | null;
  issuedAt: string | null;
  createdByUser: { id: string; displayName: string };
  updatedByUser?: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
  attachments: ContractErectionScheduleAttachment[];
}

// ---------------------------------------------------------------------------
// CM-71E — Erection Workflow, Step 4: Delivery Start. Owned by the
// Delivery / Logistics Team (never Erection Department — see the badge
// rendered by the Step 4 panel). At most one record per contract, same
// "one-per-contract, create-once-edit-forever" shape as Steps 1/3.
// status only ever stores the 4 real save-triggered values — there is no
// "Ready to Start" stored value, matching Steps 1/3's own "Ready to
// Issue" precedent. totalPackages/totalWeight/totalVolume/totalItems are
// SERVER-DERIVED from the real item rows below — never independently
// editable.
// ---------------------------------------------------------------------------

export type ContractErectionDeliveryStartStatus = 'DRAFT' | 'STARTED' | 'HOLD' | 'RETURNED';
export type ContractErectionDeliveryItemStatus = 'READY_TO_DISPATCH' | 'DISPATCHED' | 'DELIVERED' | 'HOLD';
export type ContractErectionDeliveryDocumentStatus = 'PENDING' | 'ATTACHED' | 'NOT_REQUIRED';

export interface ContractErectionDeliveryItem {
  id: string;
  srNo: number;
  description: string;
  packageNo: string | null;
  weight: number | null;
  volume: number | null;
  quantity: number;
  status: ContractErectionDeliveryItemStatus;
}

export interface ContractErectionDeliveryDocument {
  id: string;
  documentName: string;
  status: ContractErectionDeliveryDocumentStatus;
  attachmentId: string | null;
}

export interface ContractErectionDeliveryStartAttachment {
  id: string;
  deliveryStartId: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploadedByUser: { id: string; displayName: string } | null;
}

export interface ContractErectionDeliveryStart {
  id: string;
  contractId: string;
  erectionScheduleId: string | null;
  deliveryReferenceNo: string;
  deliveryDate: string;
  plannedDeliveryWindowStart: string;
  plannedDeliveryWindowEnd: string;
  transportMode: string;
  dispatchProductionSource: string;
  dispatchFromYard: string;
  deliveryToSiteLocation: string;
  gateEntryContact: string | null;
  deliveryNoteOrLrNo: string | null;
  vehicleNo: string | null;
  driverName: string | null;
  driverContact: string | null;
  totalPackages: number;
  totalWeight: number | null;
  totalVolume: number | null;
  totalItems: number;
  status: ContractErectionDeliveryStartStatus;
  comments: string | null;
  confirmedAt: string | null;
  createdByUser: { id: string; displayName: string };
  updatedByUser?: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
  items: ContractErectionDeliveryItem[];
  documents: ContractErectionDeliveryDocument[];
  attachments: ContractErectionDeliveryStartAttachment[];
}

// ---------------------------------------------------------------------------
// CM-71F — Erection Workflow, Step 5: Erection Start. Owned by the Erection
// Department / Site-Erection Team. At most one record per contract, same
// "one-per-contract, create-once-edit-forever" shape as Steps 1/3/4.
// status only ever stores the 4 real save-triggered values — there is no
// "Ready to Start" stored value, matching every earlier step's own "Ready
// to X" precedent. jobOrderNo/plannedStartDate/methodStatementRefNo are
// read-only snapshots auto-fetched server-side at creation time. Resources
// Summary is never stored — always computed live from the real manpower/
// equipment rows (see resourcesSummary, computed server-side on every read).
// ---------------------------------------------------------------------------

export type ContractErectionStartStatus = 'DRAFT' | 'STARTED' | 'HOLD' | 'RETURNED';
export type ContractErectionStartChecklistStatus = 'PENDING' | 'COMPLETED' | 'NOT_APPLICABLE';

export interface ContractErectionStartManpower {
  id: string;
  trade: string;
  plannedNos: number;
  actualDeployedNos: number;
  remarks: string | null;
}

export interface ContractErectionStartEquipment {
  id: string;
  equipmentType: string;
  descriptionCapacity: string;
  ownedOrRental: string;
  assignedQty: number;
  operatorDriver: string | null;
  remarks: string | null;
}

export interface ContractErectionStartChecklistRow {
  id: string;
  checklistItem: string;
  status: ContractErectionStartChecklistStatus;
  remarks: string | null;
}

export interface ContractErectionStartAttachment {
  id: string;
  erectionStartId: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploadedByUser: { id: string; displayName: string } | null;
}

export interface ErectionStartResourcesSummary {
  totalManpower: number;
  totalEquipment: number;
  craneAssigned: number;
  trailerAssigned: number;
}

export interface ContractErectionStart {
  id: string;
  contractId: string;
  deliveryStartId: string | null;
  erectionScheduleId: string | null;
  jobOrderNo: string;
  plannedStartDate: string | null;
  actualStartDateTime: string | null;
  workLocationYard: string;
  erectionCrewTeam: string;
  supervisor: string;
  weatherCondition: string | null;
  windSpeed: string | null;
  methodStatementRefNo: string | null;
  scopeOfWorkToday: string;
  status: ContractErectionStartStatus;
  comments: string | null;
  confirmedAt: string | null;
  createdByUser: { id: string; displayName: string };
  updatedByUser?: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
  manpowerRows: ContractErectionStartManpower[];
  equipmentRows: ContractErectionStartEquipment[];
  checklistRows: ContractErectionStartChecklistRow[];
  attachments: ContractErectionStartAttachment[];
  resourcesSummary: ErectionStartResourcesSummary;
}

// ---------------------------------------------------------------------------
// CM-71G — Erection Workflow, Step 6: Erection Checklist. Owned by the QA /
// QC Team. At most one record per contract, same "one-per-contract,
// create-once-edit-forever" shape as Steps 1/3/4/5. status only ever stores
// the 5 real save-triggered values — there is no "Ready for Verification"
// stored value, matching every earlier step's own "Ready to X" precedent.
// jobOrderNo is a read-only snapshot auto-fetched server-side at creation
// time. A DELIBERATELY SEPARATE model from Step 5's own pre-erection
// checklist (ContractErectionStartChecklistRow above) — never the same
// data. Checklist Items Summary is never stored — always computed live
// from the real item rows (see itemsSummary, computed server-side on every
// read).
// ---------------------------------------------------------------------------

export type ContractErectionChecklistStatus = 'DRAFT' | 'SUBMITTED_FOR_VERIFICATION' | 'VERIFIED' | 'HOLD' | 'RETURNED';
export type ContractErectionChecklistItemStatus = 'COMPLETED' | 'IN_PROGRESS' | 'NOT_COMPLETED' | 'NOT_APPLICABLE';

export interface ContractErectionChecklistItem {
  id: string;
  checklistItem: string;
  status: ContractErectionChecklistItemStatus;
  remarks: string | null;
  attachmentRef: string | null;
}

export interface ContractErectionChecklistAttachment {
  id: string;
  checklistId: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploadedByUser: { id: string; displayName: string } | null;
}

export interface ChecklistItemsSummary {
  totalItems: number;
  completed: number;
  inProgress: number;
  notCompleted: number;
  notApplicable: number;
}

export interface ContractErectionChecklist {
  id: string;
  contractId: string;
  erectionStartId: string | null;
  checklistRefNo: string;
  checklistDate: string;
  jobOrderNo: string;
  checklistType: string;
  preparedBy: string;
  reviewedByQaqc: string | null;
  verifiedByClientRepresentative: string | null;
  status: ContractErectionChecklistStatus;
  workLocationYard: string | null;
  comments: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  createdByUser: { id: string; displayName: string };
  updatedByUser?: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
  items: ContractErectionChecklistItem[];
  attachments: ContractErectionChecklistAttachment[];
  itemsSummary: ChecklistItemsSummary;
}

// ---------------------------------------------------------------------------
// CM-71H — Erection Workflow Assignment. Who owns Steps 1/3/5 (the Erection-
// Department-owned steps) for this contract — distinct from Contract.
// ownerUserId (the contract's own general business owner) and from
// ContractWorkflowTask.responsibleUserId (per-task assignment on the older,
// generic team-task register). One row per contract; Assign creates it,
// Change Assignment updates it in place (see the API model's own doc
// comment).
// ---------------------------------------------------------------------------

export type ContractErectionWorkflowAssignmentStatus = 'ASSIGNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

/** "ACT" = Continue/Update (assigned to the current viewer, or nobody assigned yet and the viewer is manager-tier); "MONITOR" = View Status (manager-tier, assigned to someone else); "READ_ONLY" = no update action shown. */
export type ErectionViewerActionMode = 'ACT' | 'MONITOR' | 'READ_ONLY';

export interface ContractErectionWorkflowAssignment {
  id: string;
  contractId: string;
  assignedToUserId: string | null;
  assignedToName: string | null;
  assignedDepartment: string;
  assignedByUserId: string | null;
  assignedAt: string;
  status: ContractErectionWorkflowAssignmentStatus;
  remarks: string | null;
  assignedToUser?: { id: string; displayName: string } | null;
  assignedByUser?: { id: string; displayName: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssignContractErectionWorkflowInput {
  assignedToUserId?: string;
  assignedToName?: string;
  assignedDepartment?: string;
  assignedAt?: string;
  remarks?: string;
}

// ---------------------------------------------------------------------------
// CM-62 — Contract Risk Assessment. Not an ISO risk-scoring system:
// riskEvaluation/residualRisk are plain manual dropdown values, never
// auto-calculated. Contract-scoped and unpaginated, same pattern as
// ContractVariationDetail above.
// ---------------------------------------------------------------------------

export type ContractRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ContractRiskResponse = 'MITIGATE' | 'ACCEPT' | 'AVOID' | 'TRANSFER';
export type ContractRiskStatus = 'OPEN' | 'IN_PROGRESS' | 'MITIGATED' | 'CLOSED' | 'CANCELLED';

export interface ContractRisk {
  id: string;
  contractId: string;
  riskNo?: string;
  description: string;
  riskEvaluation: ContractRiskLevel;
  riskResponse: ContractRiskResponse;
  riskResponseDescription?: string;
  /** Manual only — never auto-calculated from riskEvaluation/riskResponse. */
  residualRisk?: ContractRiskLevel;
  status: ContractRiskStatus;
  responsibleUserId?: string;
  responsibleUser?: { id: string; displayName: string };
  actionDueDate?: string;
  /** Signed days until actionDueDate (negative once past due); undefined only when actionDueDate itself is unset. */
  daysToDeadline?: number;
  remarks?: string;
  createdByUser: { id: string; displayName: string };
  updatedByUser?: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
}

export interface ContractRiskSummary {
  totalRisks: number;
  highCriticalRisks: number;
  openRisks: number;
  mitigatedRisks: number;
  /** Nearest label for the average of every real (non-null) residualRisk value — null when none is set (never fabricated). */
  averageResidualRisk: ContractRiskLevel | null;
  risksDueSoon: number;
}

export interface ContractRiskDetail {
  items: ContractRisk[];
  summary: ContractRiskSummary;
}

// ---------------------------------------------------------------------------
// CM-63 — Documents & Obligations. `status` is always a plain manual
// selection; Expiring Soon / Expired-Overdue KPI counts and daysRemaining
// are derived at read time from status + submissionOrExpiryDate, never
// written back to the stored status column. Contract-scoped and
// unpaginated, same pattern as ContractRiskDetail above.
// ---------------------------------------------------------------------------

export type ContractDocumentObligationCategory =
  | 'PERFORMANCE_BOND'
  | 'INSURANCE'
  | 'GUARANTEE'
  | 'TAX_STATUTORY'
  | 'TECHNICAL_SUBMISSION'
  | 'APPROVAL_DOCUMENT'
  | 'HEALTH_SAFETY'
  | 'OTHER';

export type ContractDocumentObligationStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'EXPIRING_SOON'
  | 'EXPIRED_OVERDUE'
  | 'NOT_REQUIRED'
  | 'CANCELLED';

export interface ContractDocumentObligationAttachment {
  id: string;
  documentObligationId: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploadedByUser: { id: string; displayName: string } | null;
}

export interface ContractDocumentObligation {
  id: string;
  contractId: string;
  itemNo?: string;
  title: string;
  category: ContractDocumentObligationCategory;
  responsibleParty?: string;
  requiredDate?: string;
  /** CM-70E — legacy combined field from before Submission Date/Expiry Date were split. Never written to by the current form; kept only for any pre-existing record's historical value. */
  submissionOrExpiryDate?: string;
  submissionDate?: string;
  expiryDate?: string;
  status: ContractDocumentObligationStatus;
  /** Signed days until the item's effective expiry date (expiryDate, falling back to the legacy submissionOrExpiryDate); undefined only when neither date is set. */
  daysRemaining?: number;
  remarks?: string;
  attachments: ContractDocumentObligationAttachment[];
  createdByUser: { id: string; displayName: string };
  updatedByUser?: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
}

export interface ContractDocumentObligationSummary {
  totalItems: number;
  submitted: number;
  pending: number;
  expiringSoon: number;
  expiredOverdue: number;
}

export interface ContractDocumentObligationDetail {
  items: ContractDocumentObligation[];
  summary: ContractDocumentObligationSummary;
}

// ---------------------------------------------------------------------------
// Internal response types
// ---------------------------------------------------------------------------

interface ApiResponse<T> {
  data: T;
  meta: { requestId?: string };
  error: null;
}

interface ApiErrorResponse {
  data: null;
  meta: { requestId?: string };
  error: { code: string; message: string };
}

// ---------------------------------------------------------------------------
// apiFetch
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let authHeader: Record<string, string> = {};
  try {
    const store = await cookies();
    const token = store.get('recafco_access')?.value;
    if (token) authHeader = { Authorization: `Bearer ${token}` };
  } catch {
    // Not in a request context — proceed without auth
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeader, ...init?.headers },
    cache: 'no-store',
  });
  const body = (await res.json()) as ApiResponse<T> | ApiErrorResponse;
  if (!res.ok || body.error !== null) {
    const err = (body as ApiErrorResponse).error;
    throw new Error(err?.message ?? `HTTP ${res.status}`);
  }
  return (body as ApiResponse<T>).data;
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

interface ContractListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  lifecycleStatus?: string;
  // CM-55 — Contract List filters. See ContractListQueryDto in the API for
  // the exact accepted values.
  scheduleStatus?: string;
  contractType?: string;
  daysRemaining?: string;
  search?: string;
  ownerUserId?: string;
  departmentId?: string;
  plantId?: string;
}

function buildQuery(q: ContractListQuery): string {
  const params = new URLSearchParams();
  if (q.page !== undefined) params.set('page', String(q.page));
  if (q.pageSize !== undefined) params.set('pageSize', String(q.pageSize));
  if (q.status) params.set('status', q.status);
  if (q.lifecycleStatus) params.set('lifecycleStatus', q.lifecycleStatus);
  if (q.scheduleStatus) params.set('scheduleStatus', q.scheduleStatus);
  if (q.contractType) params.set('contractType', q.contractType);
  if (q.daysRemaining) params.set('daysRemaining', q.daysRemaining);
  if (q.search) params.set('search', q.search);
  if (q.ownerUserId) params.set('ownerUserId', q.ownerUserId);
  if (q.departmentId) params.set('departmentId', q.departmentId);
  if (q.plantId) params.set('plantId', q.plantId);
  const str = params.toString();
  return str ? `?${str}` : '';
}

function buildPaymentQuery(q: ContractPaymentListQuery): string {
  const params = new URLSearchParams();
  if (q.page !== undefined) params.set('page', String(q.page));
  if (q.pageSize !== undefined) params.set('pageSize', String(q.pageSize));
  if (q.search) params.set('search', q.search);
  if (q.company) params.set('company', q.company);
  if (q.contractId) params.set('contractId', q.contractId);
  if (q.status) params.set('status', q.status);
  if (q.departmentId) params.set('departmentId', q.departmentId);
  if (q.ownerUserId) params.set('ownerUserId', q.ownerUserId);
  if (q.invoiceDateFrom) params.set('invoiceDateFrom', q.invoiceDateFrom);
  if (q.invoiceDateTo) params.set('invoiceDateTo', q.invoiceDateTo);
  if (q.dueDateFrom) params.set('dueDateFrom', q.dueDateFrom);
  if (q.dueDateTo) params.set('dueDateTo', q.dueDateTo);
  if (q.overdueOnly) params.set('overdueOnly', 'true');
  const str = params.toString();
  return str ? `?${str}` : '';
}

function buildWorkflowQuery(q: ContractWorkflowListQuery): string {
  const params = new URLSearchParams();
  if (q.page !== undefined) params.set('page', String(q.page));
  if (q.pageSize !== undefined) params.set('pageSize', String(q.pageSize));
  if (q.search) params.set('search', q.search);
  if (q.status) params.set('status', q.status);
  if (q.departmentId) params.set('departmentId', q.departmentId);
  if (q.ownerUserId) params.set('ownerUserId', q.ownerUserId);
  if (q.workflowStatus) params.set('workflowStatus', q.workflowStatus);
  if (q.team) params.set('team', q.team);
  if (q.taskStatus) params.set('taskStatus', q.taskStatus);
  if (q.responsibleUserId) params.set('responsibleUserId', q.responsibleUserId);
  if (q.overdueOnly) params.set('overdueOnly', 'true');
  if (q.myTasksOnly) params.set('myTasksOnly', 'true');
  const str = params.toString();
  return str ? `?${str}` : '';
}

function buildAssignmentQueueQuery(q: ContractWorkflowAssignmentQueueQuery): string {
  const params = new URLSearchParams();
  if (q.search) params.set('search', q.search);
  if (q.status) params.set('status', q.status);
  if (q.departmentId) params.set('departmentId', q.departmentId);
  if (q.ownerUserId) params.set('ownerUserId', q.ownerUserId);
  if (q.team) params.set('team', q.team);
  if (q.priority) params.set('priority', q.priority);
  if (q.dueDateMissing) params.set('dueDateMissing', 'true');
  const str = params.toString();
  return str ? `?${str}` : '';
}

function buildIssueQuery(q: ContractIssueListQuery): string {
  const params = new URLSearchParams();
  if (q.page !== undefined) params.set('page', String(q.page));
  if (q.pageSize !== undefined) params.set('pageSize', String(q.pageSize));
  if (q.search) params.set('search', q.search);
  if (q.contractId) params.set('contractId', q.contractId);
  if (q.status) params.set('status', q.status);
  if (q.priority) params.set('priority', q.priority);
  if (q.category) params.set('category', q.category);
  if (q.departmentId) params.set('departmentId', q.departmentId);
  if (q.responsibleUserId) params.set('responsibleUserId', q.responsibleUserId);
  if (q.ownerUserId) params.set('ownerUserId', q.ownerUserId);
  if (q.raisedDateFrom) params.set('raisedDateFrom', q.raisedDateFrom);
  if (q.raisedDateTo) params.set('raisedDateTo', q.raisedDateTo);
  if (q.dueDateFrom) params.set('dueDateFrom', q.dueDateFrom);
  if (q.dueDateTo) params.set('dueDateTo', q.dueDateTo);
  if (q.overdueOnly) params.set('overdueOnly', 'true');
  const str = params.toString();
  return str ? `?${str}` : '';
}

function buildClaimQuery(q: ContractClaimListQuery): string {
  const params = new URLSearchParams();
  if (q.page !== undefined) params.set('page', String(q.page));
  if (q.pageSize !== undefined) params.set('pageSize', String(q.pageSize));
  if (q.search) params.set('search', q.search);
  if (q.contractId) params.set('contractId', q.contractId);
  if (q.status) params.set('status', q.status);
  if (q.claimType) params.set('claimType', q.claimType);
  if (q.departmentId) params.set('departmentId', q.departmentId);
  if (q.responsibleUserId) params.set('responsibleUserId', q.responsibleUserId);
  if (q.ownerUserId) params.set('ownerUserId', q.ownerUserId);
  if (q.claimDateFrom) params.set('claimDateFrom', q.claimDateFrom);
  if (q.claimDateTo) params.set('claimDateTo', q.claimDateTo);
  if (q.dueDateFrom) params.set('dueDateFrom', q.dueDateFrom);
  if (q.dueDateTo) params.set('dueDateTo', q.dueDateTo);
  if (q.overdueOnly) params.set('overdueOnly', 'true');
  const str = params.toString();
  return str ? `?${str}` : '';
}

function buildCloseoutListQuery(q: ContractCloseoutListQuery): string {
  const params = new URLSearchParams();
  if (q.page !== undefined) params.set('page', String(q.page));
  if (q.pageSize !== undefined) params.set('pageSize', String(q.pageSize));
  if (q.search) params.set('search', q.search);
  if (q.contractId) params.set('contractId', q.contractId);
  if (q.status) params.set('status', q.status);
  if (q.requestedByUserId) params.set('requestedByUserId', q.requestedByUserId);
  if (q.reviewedByUserId) params.set('reviewedByUserId', q.reviewedByUserId);
  if (q.departmentId) params.set('departmentId', q.departmentId);
  if (q.requestedDateFrom) params.set('requestedDateFrom', q.requestedDateFrom);
  if (q.requestedDateTo) params.set('requestedDateTo', q.requestedDateTo);
  if (q.reviewedDateFrom) params.set('reviewedDateFrom', q.reviewedDateFrom);
  if (q.reviewedDateTo) params.set('reviewedDateTo', q.reviewedDateTo);
  if (q.approvedDateFrom) params.set('approvedDateFrom', q.approvedDateFrom);
  if (q.approvedDateTo) params.set('approvedDateTo', q.approvedDateTo);
  if (q.pendingOnly) params.set('pendingOnly', 'true');
  const str = params.toString();
  return str ? `?${str}` : '';
}

function buildScheduleQuery(q: ContractScheduleListQuery): string {
  const params = new URLSearchParams();
  if (q.page !== undefined) params.set('page', String(q.page));
  if (q.pageSize !== undefined) params.set('pageSize', String(q.pageSize));
  if (q.search) params.set('search', q.search);
  if (q.contractId) params.set('contractId', q.contractId);
  if (q.itemType) params.set('itemType', q.itemType);
  if (q.status) params.set('status', q.status);
  if (q.departmentId) params.set('departmentId', q.departmentId);
  if (q.responsibleUserId) params.set('responsibleUserId', q.responsibleUserId);
  if (q.ownerUserId) params.set('ownerUserId', q.ownerUserId);
  if (q.dateFrom) params.set('dateFrom', q.dateFrom);
  if (q.dateTo) params.set('dateTo', q.dateTo);
  if (q.overdueOnly) params.set('overdueOnly', 'true');
  if (q.upcomingOnly) params.set('upcomingOnly', 'true');
  const str = params.toString();
  return str ? `?${str}` : '';
}

// ---------------------------------------------------------------------------
// contractsApi namespace
// ---------------------------------------------------------------------------

export const contractsApi = {
  list: (params: ContractListQuery = {}) =>
    apiFetch<ListResponse<Contract>>(`/contracts${buildQuery(params)}`),

  get: (id: string) =>
    apiFetch<Contract>(`/contracts/${id}`),

  // CM-69I — same filter shape as list() so the KPI cards can be requested
  // with the identical scope as whatever the table is currently showing.
  summary: (params: ContractListQuery = {}) =>
    apiFetch<ContractSummary>(`/contracts/summary${buildQuery(params)}`),

  dashboard: () =>
    apiFetch<ContractDashboardData>('/contracts/dashboard'),

  erectionDashboard: () =>
    apiFetch<ErectionDashboardData>('/contracts/erection/dashboard'),

  listComments: (id: string) =>
    apiFetch<ContractComment[]>(`/contracts/${id}/comments`),

  listActivities: (id: string) =>
    apiFetch<ContractActivity[]>(`/contracts/${id}/activities`),

  people: () =>
    apiFetch<ContractPerson[]>('/contracts/people'),

  departments: () =>
    apiFetch<OrgRef[]>('/contracts/departments'),

  plants: () =>
    apiFetch<OrgRef[]>('/contracts/plants'),

  locations: (plantId?: string) =>
    apiFetch<LocationRef[]>(`/contracts/locations${plantId ? `?plantId=${encodeURIComponent(plantId)}` : ''}`),

  listPayments: (params: ContractPaymentListQuery = {}) =>
    apiFetch<ContractPaymentListResponse>(`/contracts/payments${buildPaymentQuery(params)}`),

  listWorkflow: (params: ContractWorkflowListQuery = {}) =>
    apiFetch<ContractWorkflowListResponse>(`/contracts/workflow${buildWorkflowQuery(params)}`),

  getWorkflow: (contractId: string, options: { myTasksOnly?: boolean } = {}) =>
    apiFetch<ContractWorkflowDetail>(`/contracts/${contractId}/workflow${options.myTasksOnly ? '?myTasksOnly=true' : ''}`),

  // CM-57 — read-only per-team task counts for Contract Detail Overview.
  // Never triggers getWorkflow()'s lazy first-view task generation.
  getWorkflowSummary: (contractId: string) =>
    apiFetch<ContractWorkflowSummaryData>(`/contracts/${contractId}/workflow-summary`),

  getAssignmentQueue: (params: ContractWorkflowAssignmentQueueQuery = {}) =>
    apiFetch<WorkflowAssignmentQueueResponse>(`/contracts/workflow/assignment-queue${buildAssignmentQueueQuery(params)}`),

  listWorkflowTaskComments: (taskId: string) =>
    apiFetch<ContractWorkflowTaskComment[]>(`/contracts/workflow/tasks/${taskId}/comments`),

  listWorkflowTaskAttachments: (taskId: string) =>
    apiFetch<ContractWorkflowTaskAttachment[]>(`/contracts/workflow/tasks/${taskId}/attachments`),

  listIssues: (params: ContractIssueListQuery = {}) =>
    apiFetch<ContractIssueListResponse>(`/contracts/issues${buildIssueQuery(params)}`),

  listClaims: (params: ContractClaimListQuery = {}) =>
    apiFetch<ContractClaimListResponse>(`/contracts/claims${buildClaimQuery(params)}`),

  getCloseoutChecks: (contractId: string) =>
    apiFetch<ContractCloseoutChecks>(`/contracts/${contractId}/closeout/checks`),

  listCloseoutRequests: (contractId: string) =>
    apiFetch<ContractCloseoutRequest[]>(`/contracts/${contractId}/closeout`),

  listCloseoutAttachments: (requestId: string) =>
    apiFetch<ContractCloseoutAttachment[]>(`/contracts/closeout/${requestId}/attachments`),

  listCloseouts: (params: ContractCloseoutListQuery = {}) =>
    apiFetch<ContractCloseoutListResponse>(`/contracts/closeouts${buildCloseoutListQuery(params)}`),

  listSchedule: (params: ContractScheduleListQuery = {}) =>
    apiFetch<ContractScheduleListResponse>(`/contracts/schedule${buildScheduleQuery(params)}`),

  // CM-68B — global sidebar Schedule page. Must be fetched before
  // listSchedule() below would even be relevant to a UI; kept as a
  // separate real endpoint (GET /contracts/schedule/overview) rather than
  // folding into listSchedule()'s own due-date-item shape, which is a
  // fundamentally different real data shape (due-date items vs. one row
  // per contract).
  getContractScheduleOverview: () =>
    apiFetch<ContractScheduleOverviewResult>('/contracts/schedule/overview'),

  getContractSchedule: (contractId: string) =>
    apiFetch<ContractScheduleDetail>(`/contracts/${contractId}/schedule`),

  getContractProduction: (contractId: string) =>
    apiFetch<ContractProductionDetail>(`/contracts/${contractId}/production`),

  getContractVariations: (contractId: string) =>
    apiFetch<ContractVariationDetail>(`/contracts/${contractId}/variations`),

  listVariationAttachments: (contractId: string, variationId: string) =>
    apiFetch<ContractVariationAttachment[]>(`/contracts/${contractId}/variations/${variationId}/attachments`),

  getContractAttachments: (contractId: string) =>
    apiFetch<ContractAttachment[]>(`/contracts/${contractId}/attachments`),

  /** Returns null when no Erection Method Statement has been created yet for this contract — a normal, valid state, not an error. */
  getErectionMethodStatement: (contractId: string) =>
    apiFetch<ContractErectionMethodStatement | null>(`/contracts/${contractId}/erection/method-statement`),

  /** Returns null when Step 1 or Step 2 simply hasn't happened yet — a normal, valid state, not an error. */
  getErectionMethodStatementApproval: (contractId: string) =>
    apiFetch<ContractErectionMethodStatementApproval | null>(`/contracts/${contractId}/erection/method-statement/approval`),

  /** Returns null when Step 3 (the erection schedule) hasn't been created yet for this contract — a normal, valid state, not an error. */
  getErectionSchedule: (contractId: string) =>
    apiFetch<ContractErectionSchedule | null>(`/contracts/${contractId}/erection/schedule`),

  /** Returns null when Step 4 (delivery start) hasn't been created yet for this contract — a normal, valid state, not an error. */
  getErectionDeliveryStart: (contractId: string) =>
    apiFetch<ContractErectionDeliveryStart | null>(`/contracts/${contractId}/erection/delivery-start`),

  /** Returns null when Step 5 (erection start) hasn't been created yet for this contract — a normal, valid state, not an error. */
  getErectionStart: (contractId: string) =>
    apiFetch<ContractErectionStart | null>(`/contracts/${contractId}/erection/start`),

  /** Returns null when Step 6 (erection checklist) hasn't been created yet for this contract — a normal, valid state, not an error. */
  getErectionChecklist: (contractId: string) =>
    apiFetch<ContractErectionChecklist | null>(`/contracts/${contractId}/erection/checklist`),

  /** CM-71H — returns null when the Erection Workflow hasn't been assigned to anyone yet for this contract — a normal, valid state, not an error. */
  getErectionWorkflowAssignment: (contractId: string) =>
    apiFetch<ContractErectionWorkflowAssignment | null>(`/contracts/${contractId}/erection/assignment`),

  getContractRisks: (contractId: string) =>
    apiFetch<ContractRiskDetail>(`/contracts/${contractId}/risks`),

  getContractDocumentObligations: (contractId: string) =>
    apiFetch<ContractDocumentObligationDetail>(`/contracts/${contractId}/document-obligations`),

  listDocumentObligationAttachments: (contractId: string, itemId: string) =>
    apiFetch<ContractDocumentObligationAttachment[]>(`/contracts/${contractId}/document-obligations/${itemId}/attachments`),
};
