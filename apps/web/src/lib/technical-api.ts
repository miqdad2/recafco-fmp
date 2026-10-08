import { cookies } from 'next/headers';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// FMP-TECH-01 — typed client for the Technical module's own API, mirroring
// incidents-api.ts's exact apiFetch/apiFetchResult shape (same error
// handling, same server-side cookie auth) — no new pattern introduced.
// ---------------------------------------------------------------------------

export type TechnicalStage = 'DRAWING_RECEIVED' | 'SD_CALCULATION_SUBMISSION' | 'GETTING_APPROVAL' | 'FD_ISSUANCE';
export type TechnicalWorkflowStatus = 'IN_PROGRESS' | 'COMPLETED';
export type TechnicalPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TechnicalReceivedFrom = 'CLIENT' | 'CONSULTANT' | 'EMPLOYER' | 'MAIN_CONTRACTOR' | 'INTERNAL';
export type TechnicalDrawingType =
  | 'SHOP_DRAWING'
  | 'ARCHITECTURAL'
  | 'STRUCTURAL'
  | 'MEP'
  | 'PRECAST'
  | 'COORDINATION'
  | 'AS_BUILT'
  | 'OTHER';
export type TechnicalDrawingStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
export type TechnicalLinkedStage = 'TECHNICAL_REVIEW' | 'SD_CALCULATION' | 'GETTING_APPROVAL' | 'FD_ISSUANCE';

// FMP-TECH-02
export type TechnicalSubmissionType = 'SHOP_DRAWING' | 'CALCULATION' | 'SHOP_DRAWING_AND_CALCULATION' | 'REVISION_SUBMISSION' | 'OTHER';
export type TechnicalCalculationType =
  | 'STRUCTURAL_CALCULATION'
  | 'PRECAST_CALCULATION'
  | 'CONNECTION_DESIGN'
  | 'LOAD_CALCULATION'
  | 'GENERAL_TECHNICAL_CALCULATION'
  | 'OTHER';
export type TechnicalSubmissionMethod = 'EMAIL' | 'PORTAL' | 'HAND_SUBMISSION' | 'COURIER' | 'INTERNAL_HANDOVER' | 'OTHER';
export type TechnicalSdSubmissionStatus = 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'CLARIFICATION_REQUESTED' | 'COMPLETED';

// FMP-TECH-03
export type TechnicalApprovalStatus = 'UNDER_REVIEW' | 'APPROVED' | 'APPROVED_WITH_COMMENTS' | 'CHANGES_REQUIRED' | 'REJECTED';
export type TechnicalApprovalRecordStatus = 'DRAFT' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'CHANGES_REQUIRED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

// FMP-TECH-04
export type TechnicalFdPurpose = 'PRODUCTION' | 'ERECTION' | 'STORAGE_YARD_DELIVERY' | 'QUALITY_CONTROL' | 'CLIENT_CONSULTANT' | 'INTERNAL_RECORD' | 'OTHER';
export type TechnicalFdIssueType = 'FINAL_DRAWING' | 'FINAL_DOCUMENT' | 'REVISED_FINAL_DRAWING' | 'APPROVED_PACKAGE' | 'OTHER';
export type TechnicalFdDistribution = 'ELECTRONIC' | 'PRINTED_COPY' | 'BOTH' | 'PORTAL' | 'OTHER';
export type TechnicalFdIssueMethod = 'EMAIL' | 'PORTAL' | 'HANDOVER' | 'INTERNAL_SYSTEM' | 'COURIER' | 'OTHER';
export type TechnicalFdStatus = 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'ISSUED' | 'RETURNED_REOPENED' | 'COMPLETED';

export const TECHNICAL_STAGE_LABELS: Record<TechnicalStage, string> = {
  DRAWING_RECEIVED: 'Drawing Received',
  SD_CALCULATION_SUBMISSION: 'SD & Calculation Submission',
  GETTING_APPROVAL: 'Getting Approval',
  FD_ISSUANCE: 'FD Issuance',
};

export const TECHNICAL_STAGE_ORDER: TechnicalStage[] = [
  'DRAWING_RECEIVED',
  'SD_CALCULATION_SUBMISSION',
  'GETTING_APPROVAL',
  'FD_ISSUANCE',
];

export interface UserRef {
  id: string;
  displayName: string;
  username: string;
}

export interface TechnicalContractSummary {
  id: string;
  referenceNumber: string;
  title: string;
  jobOrder: string | null;
  quotationNumber: string | null;
  counterpartyName: string;
  departmentId: string | null;
  status: string;
  updatedAt: string;
  ownerUser: { id: string; displayName: string };
}

export interface TechnicalWorkflow {
  id: string;
  contractId: string;
  currentStage: TechnicalStage;
  status: TechnicalWorkflowStatus;
  priority: TechnicalPriority;
  assignedDepartment: string;
  assignedToUserId: string | null;
  assignedToUser: { id: string; displayName: string } | null;
  createdByUserId: string;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TechnicalDrawing {
  id: string;
  technicalWorkflowId: string;
  contractId: string;
  drawingReferenceNo: string | null;
  revisionNo: string | null;
  drawingType: TechnicalDrawingType | null;
  drawingDescription: string | null;
  relatedAreaPackage: string | null;
  receivedDate: string | null;
  receivedFrom: TechnicalReceivedFrom | null;
  senderName: string | null;
  numberOfSheets: number | null;
  priority: TechnicalPriority;
  status: TechnicalDrawingStatus;
  internalReferenceNo: string | null;
  requiresImmediateReview: boolean;
  additionalDocumentsReceived: boolean;
  linkedWorkflowStage: TechnicalLinkedStage;
  remarks: string | null;
  internalNotes: string | null;
  assignedToUserId: string | null;
  plannedReviewStart: string | null;
  createdByUserId: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TechnicalActivity {
  id: string;
  technicalWorkflowId: string;
  actorUserId: string | null;
  actorName: string | null;
  event: string;
  previousStage: TechnicalStage | null;
  newStage: TechnicalStage | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface TechnicalAttachment {
  id: string;
  originalFileName: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedByUserId: string;
  createdAt: string;
  uploadedByUser: UserRef;
}

export interface TechnicalJobRow {
  contractId: string;
  jobOrderNo: string | null;
  referenceNumber: string;
  projectName: string;
  clientEmployer: string;
  contractManager: string;
  currentStage: TechnicalStage | null;
  nextStage: TechnicalStage | null;
  status: TechnicalWorkflowStatus | null;
  priority: TechnicalPriority | null;
  dueDate: string | null;
  assignedTo: string | null;
  updatedAt: string;
  workflowStarted: boolean;
}

export type TechnicalAttentionReason =
  | 'OVERDUE_PLANNED_REVIEW'
  | 'URGENT_PRIORITY'
  | 'DRAWING_RECEIVED_NOT_COMPLETED'
  | 'CLARIFICATION_REQUESTED'
  | 'WAITING_APPROVAL_TOO_LONG'
  | 'OVERDUE_TARGET_APPROVAL'
  | 'OVERDUE_EXPECTED_APPROVAL'
  | 'OVERDUE_FD_ISSUE_DATE';

export interface TechnicalAttentionItem {
  contractId: string;
  jobOrderNo: string | null;
  referenceNumber: string;
  projectName: string;
  reason: TechnicalAttentionReason;
  detail: string;
  stage: TechnicalStage;
}

export interface TechnicalActivityFeedItem {
  id: string;
  contractId: string;
  jobOrderNo: string | null;
  referenceNumber: string;
  event: string;
  stage: TechnicalStage;
  actorName: string | null;
  createdAt: string;
}

export interface TechnicalDashboardData {
  metrics: {
    pendingTechnicalReview: number;
    drawingReceived: number;
    sdCalculationPending: number;
    waitingApproval: number;
    fdIssued: number;
    readyForProductionRelease: number;
    needsAttention: number;
  };
  jobs: TechnicalJobRow[];
  needsAttention: TechnicalAttentionItem[];
  recentActivities: TechnicalActivityFeedItem[];
  stageBreakdown: Record<TechnicalStage, number>;
  boqAttention: TechnicalBoqAttentionSummary;
  /** FMP-BOQ-16 — drawing group / release numbers per started job, keyed by contract id. */
  releaseByContract: Record<string, JobReleaseSummary>;
}

// FMP-BOQ-16 — mirrors JobReleaseSummary in apps/api/src/technical/drawing-group-rules.ts exactly.
export interface JobReleaseSummary {
  confirmed: number;
  generated: number;
  assigned: number;
  notAssigned: number;
  filesAttachedPieces: number;
  released: number;
  notReleased: number;
  groupsTotal: number;
  groupsWithFiles: number;
  groupsNoFiles: number;
  groupsSubmitted: number;
  groupsApproved: number;
  groupsNotReleased: number;
  confirmedNotGenerated: number;
}

// FMP-UI-31 — mirrors TechnicalBoqAttentionSummary in
// apps/api/src/technical/technical.service.ts exactly.
export interface TechnicalBoqAttentionSummary {
  missingBoqConfirmation: number;
  confirmedPiecesNotGenerated: number;
  rejectedOrHoldPieces: number;
}

export interface TechnicalWorkflowOverview {
  contract: TechnicalContractSummary;
  workflow: TechnicalWorkflow | null;
  nextStage: TechnicalStage | null;
}

export interface TechnicalDrawingReceivedData {
  contract: TechnicalContractSummary;
  workflow: TechnicalWorkflow;
  drawing: TechnicalDrawing | null;
  attachments: TechnicalAttachment[];
  activities: TechnicalActivity[];
  nextStage: TechnicalStage | null;
}

// FMP-TECH-02 — SD & Calculation Submission (Technical Stage 2)

export interface TechnicalCompletedDrawingRef {
  id: string;
  drawingReferenceNo: string | null;
  revisionNo: string | null;
  receivedDate: string | null;
}

export interface TechnicalSdCalculationSubmission {
  id: string;
  technicalWorkflowId: string;
  contractId: string;
  relatedDrawingId: string | null;
  submissionDate: string | null;
  submissionType: TechnicalSubmissionType | null;
  submittedTo: string | null;
  targetApprovalDate: string | null;
  drawingReferenceNo: string | null;
  revisionNo: string | null;
  calculationType: TechnicalCalculationType | null;
  numberOfSheetsOrFiles: number | null;
  scopeDescription: string | null;
  submittedById: string | null;
  submittedByName: string | null;
  designation: string | null;
  submissionMethod: TechnicalSubmissionMethod | null;
  referenceSubmissionNo: string | null;
  contactNo: string | null;
  email: string | null;
  remarks: string | null;
  status: TechnicalSdSubmissionStatus;
  priority: TechnicalPriority;
  createdByUserId: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TechnicalSdCalculationSubmissionData {
  contract: TechnicalContractSummary;
  workflow: TechnicalWorkflow;
  submission: TechnicalSdCalculationSubmission | null;
  completedDrawings: TechnicalCompletedDrawingRef[];
  attachments: TechnicalAttachment[];
  activities: TechnicalActivity[];
  nextStage: TechnicalStage | null;
}

export interface SaveSdCalculationSubmissionInput {
  submissionDate?: string;
  submissionType?: TechnicalSubmissionType;
  submittedTo?: string;
  targetApprovalDate?: string;
  drawingReferenceNo?: string;
  revisionNo?: string;
  relatedDrawingId?: string;
  calculationType?: TechnicalCalculationType;
  numberOfSheetsOrFiles?: number;
  scopeDescription?: string;
  submissionMethod?: TechnicalSubmissionMethod;
  referenceSubmissionNo?: string;
  submittedById?: string;
  submittedByName?: string;
  designation?: string;
  contactNo?: string;
  email?: string;
  remarks?: string;
  status?: TechnicalSdSubmissionStatus;
  priority?: TechnicalPriority;
}

// FMP-TECH-03 — Getting Approval (Technical Stage 3)

export interface TechnicalEligibleSdSubmissionRef {
  id: string;
  drawingReferenceNo: string | null;
  revisionNo: string | null;
  submissionDate: string | null;
}

export interface TechnicalApproval {
  id: string;
  technicalWorkflowId: string;
  contractId: string;
  relatedSdSubmissionId: string | null;
  submittedOn: string | null;
  submittedById: string | null;
  submittedByName: string | null;
  submittedTo: string | null;
  approvalStatus: TechnicalApprovalStatus | null;
  expectedApprovalDate: string | null;
  reviewedOn: string | null;
  reviewedBy: string | null;
  revisionNo: string | null;
  reviewerComments: string | null;
  resubmissionRequired: boolean;
  resubmissionDate: string | null;
  resubmissionReason: string | null;
  priority: TechnicalPriority;
  status: TechnicalApprovalRecordStatus;
  createdByUserId: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TechnicalGettingApprovalData {
  contract: TechnicalContractSummary;
  workflow: TechnicalWorkflow;
  approval: TechnicalApproval | null;
  eligibleSdSubmissions: TechnicalEligibleSdSubmissionRef[];
  attachments: TechnicalAttachment[];
  activities: TechnicalActivity[];
  nextStage: TechnicalStage | null;
}

export interface SaveGettingApprovalInput {
  relatedSdSubmissionId?: string;
  submittedOn?: string;
  submittedById?: string;
  submittedByName?: string;
  submittedTo?: string;
  approvalStatus?: TechnicalApprovalStatus;
  expectedApprovalDate?: string;
  reviewedOn?: string;
  reviewedBy?: string;
  revisionNo?: string;
  reviewerComments?: string;
  resubmissionRequired?: boolean;
  resubmissionDate?: string;
  resubmissionReason?: string;
  priority?: TechnicalPriority;
  status?: TechnicalApprovalRecordStatus;
}

// FMP-TECH-04 — FD Issuance (Technical Stage 4, the final stage)

export interface TechnicalEligibleApprovalRef {
  id: string;
  approvalStatus: TechnicalApprovalStatus | null;
  revisionNo: string | null;
  reviewedOn: string | null;
}

export interface TechnicalFdIssuance {
  id: string;
  technicalWorkflowId: string;
  contractId: string;
  relatedApprovalId: string | null;
  fdIssueDate: string | null;
  issuedTo: string | null;
  purposeFor: TechnicalFdPurpose | null;
  issueType: TechnicalFdIssueType | null;
  drawingReferenceNo: string | null;
  revisionNo: string | null;
  approvedReferenceNo: string | null;
  approvedDate: string | null;
  numberOfSheetsOrFiles: number | null;
  distribution: TechnicalFdDistribution | null;
  issueMethod: TechnicalFdIssueMethod | null;
  issuedById: string | null;
  issuedByName: string | null;
  designation: string | null;
  contactNo: string | null;
  email: string | null;
  remarks: string | null;
  priority: TechnicalPriority;
  status: TechnicalFdStatus;
  createdByUserId: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TechnicalFdIssuanceData {
  contract: TechnicalContractSummary;
  workflow: TechnicalWorkflow;
  fdIssuance: TechnicalFdIssuance | null;
  eligibleApprovals: TechnicalEligibleApprovalRef[];
  attachments: TechnicalAttachment[];
  activities: TechnicalActivity[];
  nextStage: TechnicalStage | null;
}

export interface SaveFdIssuanceInput {
  relatedApprovalId?: string;
  fdIssueDate?: string;
  issuedTo?: string;
  purposeFor?: TechnicalFdPurpose;
  issueType?: TechnicalFdIssueType;
  drawingReferenceNo?: string;
  revisionNo?: string;
  approvedReferenceNo?: string;
  approvedDate?: string;
  numberOfSheetsOrFiles?: number;
  distribution?: TechnicalFdDistribution;
  issueMethod?: TechnicalFdIssueMethod;
  issuedById?: string;
  issuedByName?: string;
  designation?: string;
  contactNo?: string;
  email?: string;
  remarks?: string;
  priority?: TechnicalPriority;
  status?: TechnicalFdStatus;
}

export interface SaveDrawingReceivedInput {
  receivedDate?: string;
  receivedFrom?: TechnicalReceivedFrom;
  senderName?: string;
  drawingType?: TechnicalDrawingType;
  drawingReferenceNo?: string;
  revisionNo?: string;
  numberOfSheets?: number;
  priority?: TechnicalPriority;
  status?: TechnicalDrawingStatus;
  drawingDescription?: string;
  relatedAreaPackage?: string;
  linkedWorkflowStage?: TechnicalLinkedStage;
  internalReferenceNo?: string;
  requiresImmediateReview?: boolean;
  additionalDocumentsReceived?: boolean;
  remarks?: string;
  internalNotes?: string;
  assignedToUserId?: string;
  plannedReviewStart?: string;
}

interface ApiResponse<T> {
  data: T;
  meta: { requestId?: string };
  error: null;
}

interface ApiErrorResponse {
  data: null;
  meta: { requestId?: string };
  error: { code: string; message: string; details?: unknown };
}

export interface TechnicalApiError {
  code: string;
  message: string;
  details?: unknown;
  /** HTTP status of the failed response (0 for a network-level failure with no response at all) — lets a caller distinguish 401/403 from a generic 500/network failure for user-facing messaging. */
  status: number;
}

async function authHeader(): Promise<Record<string, string>> {
  try {
    const store = await cookies();
    const token = store.get('recafco_access')?.value;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(await authHeader()), ...init?.headers },
    cache: 'no-store',
  });
  const body = (await res.json()) as ApiResponse<T> | ApiErrorResponse;
  if (!res.ok || body.error !== null) {
    const err = (body as ApiErrorResponse).error;
    throw new Error(err?.message ?? `API error ${res.status}`);
  }
  return (body as ApiResponse<T>).data;
}

export async function technicalApiFetchResult<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; error: null } | { data: null; error: TechnicalApiError }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(await authHeader()), ...init?.headers },
      cache: 'no-store',
    });
    const body = (await res.json()) as ApiResponse<T> | ApiErrorResponse;
    if (!res.ok || body.error !== null) {
      const err = (body as ApiErrorResponse).error;
      return { data: null, error: { code: err?.code ?? 'API_ERROR', message: err?.message ?? `API error ${res.status}`, details: err?.details, status: res.status } };
    }
    return { data: (body as ApiResponse<T>).data, error: null };
  } catch (e) {
    return { data: null, error: { code: 'NETWORK_ERROR', message: e instanceof Error ? e.message : 'Network error', status: 0 } };
  }
}

export const technicalApi = {
  dashboard: () => apiFetch<TechnicalDashboardData>('/technical/dashboard'),

  workflowOverview: (contractId: string) =>
    apiFetch<TechnicalWorkflowOverview>(`/technical/jobs/${contractId}`),

  drawingReceived: (contractId: string) =>
    apiFetch<TechnicalDrawingReceivedData>(`/technical/jobs/${contractId}/drawing-received`),

  sdCalculationSubmission: (contractId: string) =>
    apiFetch<TechnicalSdCalculationSubmissionData>(`/technical/jobs/${contractId}/sd-calculation-submission`),

  gettingApproval: (contractId: string) =>
    apiFetch<TechnicalGettingApprovalData>(`/technical/jobs/${contractId}/getting-approval`),

  fdIssuance: (contractId: string) =>
    apiFetch<TechnicalFdIssuanceData>(`/technical/jobs/${contractId}/fd-issuance`),
};

// ---------------------------------------------------------------------------
// FMP-BOQ-03 — BOQ Drawing Confirmation (Technical confirms physical pieces).
// Contract Qty is commercial (M2/M3/Nos/LM); confirmedPieces is always in Nos.
// ---------------------------------------------------------------------------

export type BoqConfirmationStatus = 'DRAFT' | 'CONFIRMED' | 'REVISED' | 'CANCELLED';

export interface BoqDrawingConfirmation {
  id: string;
  contractId: string;
  boqItemId: string;
  drawingNo: string;
  drawingTitle: string | null;
  confirmedPieces: number | null;
  sizeOrSpecification: string | null;
  revision: string | null;
  confirmationStatus: BoqConfirmationStatus;
  remarks: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedByUser: { id: string; displayName: string } | null;
}

// FMP-BOQ-04 — pieces generated from CONFIRMED drawing confirmations.
export type BoqPieceStatus =
  | 'NOT_STARTED' | 'DRAWING_READY' | 'IN_PRODUCTION' | 'PRODUCED' | 'IN_STORE'
  | 'DELIVERED' | 'ERECTED' | 'COMPLETED' | 'ON_HOLD' | 'REJECTED' | 'CANCELLED';

export interface BoqPiece {
  id: string;
  boqItemId: string;
  pieceNo: number;
  pieceCode: string;
  drawingNo: string;
  currentStatus: BoqPieceStatus;
  sizeOrSpecification: string | null;
  currentLocation: string | null;
  isCancelled: boolean;
  updatedAt: string;
  // FMP-BOQ-11 — the drawing / calculation group the piece is in right now (empty = not assigned).
  drawingGroupLinks?: { group: { id: string; drawingNo: string; calculationRef: string | null; groupTitle: string | null; status: DrawingGroupStatus; _count?: { attachments: number } } }[];
}

export interface BoqConfirmationItem {
  boqItemId: string;
  sortOrder: number;
  description: string;
  contractQty: string | null;
  contractUnit: string | null;
  /** Sum of CONFIRMED rows; null = not confirmed yet. */
  confirmedPieces: number | null;
  confirmations: BoqDrawingConfirmation[];
  piecesGenerated: number;
  statusCounts: Partial<Record<BoqPieceStatus, number>>;
  /** Pieces still to be created from Confirmed rows (drives the Generate Pieces button). */
  pendingPieces: number;
  /** Pieces exist but their number differs from Drawing Confirmed Pieces. */
  needsAttention: boolean;
}

export async function fetchBoqConfirmations(contractId: string): Promise<BoqConfirmationItem[] | null> {
  const result = await technicalApiFetchResult<BoqConfirmationItem[]>(`/technical/jobs/${contractId}/boq-confirmations`);
  return result.error ? null : result.data;
}

// FMP-BOQ-05 — piece status updates and history.
export type BoqPieceUpdateStatus = Exclude<BoqPieceStatus, 'NOT_STARTED'>;

export interface BoqPieceHistoryEntry {
  id: string;
  oldStatus: BoqPieceStatus | null;
  newStatus: BoqPieceStatus;
  note: string | null;
  createdAt: string;
  updatedByUser: { id: string; displayName: string } | null;
}

/**
 * FMP-BOQ-06 — the piece statuses the current user may set from the Technical
 * page (decided by the API). null = could not be resolved, so the UI must stay read-only.
 */
export async function fetchAllowedPieceStatuses(contractId: string): Promise<BoqPieceUpdateStatus[] | null> {
  const result = await technicalApiFetchResult<{ context: string; statuses: BoqPieceUpdateStatus[] }>(
    `/technical/jobs/${contractId}/boq-pieces/allowed-statuses`,
  );
  return result.error ? null : result.data.statuses;
}

// ---------------------------------------------------------------------------
// FMP-BOQ-11 — Technical Drawing / Calculation Groups.
// ---------------------------------------------------------------------------

export type DrawingGroupStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RELEASED_TO_PRODUCTION' | 'REVISED' | 'CANCELLED';
export type DrawingGroupAction = 'EDIT' | 'SUBMIT' | 'APPROVE' | 'RELEASE' | 'CANCEL';

export interface DrawingGroup {
  id: string;
  boqItemId: string;
  drawingNo: string;
  calculationRef: string | null;
  groupTitle: string | null;
  status: DrawingGroupStatus;
  remarks: string | null;
  approvedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  pieceCount: number;
  /** FMP-BOQ-12 — number of drawing / calculation files attached to the group. */
  fileCount: number;
  /** Only the actions allowed for the current status. */
  actions: DrawingGroupAction[];
}

export interface DrawingGroupItem {
  boqItemId: string;
  sortOrder: number;
  description: string;
  piecesGenerated: number;
  assignedToGroups: number;
  notAssigned: number;
  approvedPieces: number;
  releasedToProduction: number;
  groups: DrawingGroup[];
}

/** A generated piece as offered in the Add Drawing Group picker. */
export interface GroupablePiece {
  id: string;
  pieceNo: number;
  pieceCode: string;
  currentStatus: BoqPieceStatus;
  drawingGroupLinks: { group: { id: string; drawingNo: string; calculationRef: string | null; status: DrawingGroupStatus } }[];
}

export async function fetchDrawingGroups(contractId: string): Promise<DrawingGroupItem[] | null> {
  const result = await technicalApiFetchResult<DrawingGroupItem[]>(`/technical/jobs/${contractId}/drawing-groups`);
  return result.error ? null : result.data;
}

// FMP-BOQ-12 — files attached to a Drawing / Calculation Group.
export type DrawingGroupFileCategory = 'DRAWING' | 'CALCULATION' | 'APPROVAL_DOCUMENT' | 'OTHER';

export interface DrawingGroupFile {
  id: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  category: DrawingGroupFileCategory;
  remarks: string | null;
  createdAt: string;
  uploadedByUser: { id: string; displayName: string } | null;
}
