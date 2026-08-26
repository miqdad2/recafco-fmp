import { cookies } from 'next/headers';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'TERMINATED' | 'CLOSED';
export type DerivedLifecycleStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'TERMINATED' | 'CLOSED';

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
  createdAt: string;
  updatedAt: string;
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

export interface ContractSummary {
  totalDraft: number;
  totalActive: number;
  totalExpiring: number;
  totalExpired: number;
  totalTerminated: number;
  totalClosed: number;
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

export interface ManagerDashboardData {
  summary: ManagerDashboardSummary;
  attentionItems: ManagerAttentionItem[];
  workflowOverview: TeamWorkflowOverview[];
  upcomingSchedule: ScheduleItem[];
}

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
  };
  recent: { id: string; referenceNumber: string; title: string; status: string; updatedAt: string }[];
  dashboardType: ContractDashboardType;
  manager?: ManagerDashboardData;
  staff?: StaffDashboardData;
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

export interface ContractScheduleDetail {
  items: ScheduleItem[];
  summary: ScheduleSummary;
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

  summary: () =>
    apiFetch<ContractSummary>('/contracts/summary'),

  dashboard: () =>
    apiFetch<ContractDashboardData>('/contracts/dashboard'),

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

  getContractSchedule: (contractId: string) =>
    apiFetch<ContractScheduleDetail>(`/contracts/${contractId}/schedule`),
};
