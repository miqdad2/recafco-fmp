'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { technicalApiFetchResult } from '@/lib/technical-api';
import type {
  SaveDrawingReceivedInput,
  TechnicalReceivedFrom,
  TechnicalDrawingType,
  TechnicalPriority,
  TechnicalDrawingStatus,
  TechnicalLinkedStage,
  SaveSdCalculationSubmissionInput,
  TechnicalSubmissionType,
  TechnicalCalculationType,
  TechnicalSubmissionMethod,
  TechnicalSdSubmissionStatus,
  SaveGettingApprovalInput,
  TechnicalApprovalStatus,
  TechnicalApprovalRecordStatus,
  SaveFdIssuanceInput,
  TechnicalFdPurpose,
  TechnicalFdIssueType,
  TechnicalFdDistribution,
  TechnicalFdIssueMethod,
  TechnicalFdStatus,
  BoqPieceStatus,
  BoqPiece,
  BoqPieceUpdateStatus,
  BoqPieceHistoryEntry,
  GroupablePiece,
  DrawingGroupFile,
} from '@/lib/technical-api';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

export interface ActionResult {
  error: string | null;
  missing?: string[];
}

// ---------------------------------------------------------------------------
// Start Technical Workflow
// ---------------------------------------------------------------------------

export async function startTechnicalWorkflowAction(contractId: string): Promise<ActionResult> {
  const result = await technicalApiFetchResult(`/technical/jobs/${contractId}/start`, { method: 'POST' });
  if (result.error) return { error: result.error.message };
  revalidatePath(`/technical/jobs/${contractId}`);
  redirect(`/technical/jobs/${contractId}/workflow/drawing-received`);
}

/**
 * FMP-TECH-05A — adapts startTechnicalWorkflowAction's `Promise<ActionResult>`
 * to the `Promise<void>` a native `<form action>` expects. This wrapper MUST
 * live in this 'use server' file (not as a local function inside the Server
 * Component page) — a bare function defined in a page.tsx module has no
 * "use server" marking of its own, so Next.js cannot create a valid server
 * reference for it when the form is serialized, which is exactly what
 * produced this ticket's "Functions cannot be passed directly to Client
 * Components" crash. Every export in this file is already a real server
 * action by virtue of the top-level directive, so this fixes the boundary
 * with zero business-logic change: on success it redirects (throws) same as
 * before; on failure (e.g. no permission) it returns quietly, matching the
 * page's own pre-existing "rare failure case isn't surfaced inline" note.
 */
export async function startTechnicalWorkflowFormAction(contractId: string): Promise<void> {
  await startTechnicalWorkflowAction(contractId);
}

// ---------------------------------------------------------------------------
// Drawing Received — form field extraction shared by save/complete
// ---------------------------------------------------------------------------

function extractDrawingReceivedInput(formData: FormData): SaveDrawingReceivedInput {
  const str = (key: string): string | undefined => {
    const v = formData.get(key);
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
  };
  const num = (key: string): number | undefined => {
    const v = str(key);
    if (v === undefined) return undefined;
    const parsed = parseInt(v, 10);
    return isNaN(parsed) ? undefined : parsed;
  };
  const bool = (key: string): boolean => formData.get(key) === 'on' || formData.get(key) === 'true';

  const input: SaveDrawingReceivedInput = {};
  const receivedDate = str('receivedDate');
  if (receivedDate) input.receivedDate = receivedDate;
  const receivedFrom = str('receivedFrom');
  if (receivedFrom) input.receivedFrom = receivedFrom as TechnicalReceivedFrom;
  const senderName = str('senderName');
  if (senderName) input.senderName = senderName;
  const drawingType = str('drawingType');
  if (drawingType) input.drawingType = drawingType as TechnicalDrawingType;
  const drawingReferenceNo = str('drawingReferenceNo');
  if (drawingReferenceNo) input.drawingReferenceNo = drawingReferenceNo;
  const revisionNo = str('revisionNo');
  if (revisionNo) input.revisionNo = revisionNo;
  const numberOfSheets = num('numberOfSheets');
  if (numberOfSheets !== undefined) input.numberOfSheets = numberOfSheets;
  const priority = str('priority');
  if (priority) input.priority = priority as TechnicalPriority;
  const status = str('status');
  if (status) input.status = status as TechnicalDrawingStatus;
  const drawingDescription = str('drawingDescription');
  if (drawingDescription) input.drawingDescription = drawingDescription;
  const relatedAreaPackage = str('relatedAreaPackage');
  if (relatedAreaPackage) input.relatedAreaPackage = relatedAreaPackage;
  const linkedWorkflowStage = str('linkedWorkflowStage');
  if (linkedWorkflowStage) input.linkedWorkflowStage = linkedWorkflowStage as TechnicalLinkedStage;
  const internalReferenceNo = str('internalReferenceNo');
  if (internalReferenceNo) input.internalReferenceNo = internalReferenceNo;
  input.requiresImmediateReview = bool('requiresImmediateReview');
  input.additionalDocumentsReceived = bool('additionalDocumentsReceived');
  const remarks = str('remarks');
  if (remarks) input.remarks = remarks;
  const internalNotes = str('internalNotes');
  if (internalNotes) input.internalNotes = internalNotes;
  const assignedToUserId = str('assignedToUserId');
  if (assignedToUserId) input.assignedToUserId = assignedToUserId;
  const plannedReviewStart = str('plannedReviewStart');
  if (plannedReviewStart) input.plannedReviewStart = plannedReviewStart;

  return input;
}

export async function saveDrawingReceivedDraftAction(contractId: string, formData: FormData): Promise<ActionResult> {
  const input = extractDrawingReceivedInput(formData);
  const result = await technicalApiFetchResult(`/technical/jobs/${contractId}/drawing-received`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (result.error) return { error: result.error.message };
  revalidatePath(`/technical/jobs/${contractId}/workflow/drawing-received`);
  return { error: null };
}

/**
 * Reuses the form's own Remarks field as the clarification note (this
 * screen has no separate dedicated clarification-note input in the
 * reference design) — falls back to a plain default if Remarks is empty,
 * since RequestClarificationDto requires a non-empty note.
 */
export async function requestClarificationAction(contractId: string, formData: FormData): Promise<ActionResult> {
  const remarks = (formData.get('remarks') as string | null)?.trim();
  const note = remarks || 'Clarification requested on the received drawing package.';

  const result = await technicalApiFetchResult(`/technical/jobs/${contractId}/drawing-received/clarification`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
  if (result.error) return { error: result.error.message };
  revalidatePath(`/technical/jobs/${contractId}/workflow/drawing-received`);
  return { error: null };
}

export async function completeDrawingReceivedAction(contractId: string, formData: FormData): Promise<ActionResult> {
  const input = extractDrawingReceivedInput(formData);
  const result = await technicalApiFetchResult<{ nextStage: string | null }>(
    `/technical/jobs/${contractId}/drawing-received/complete`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  if (result.error) {
    const missing = (result.error.details as { missing?: string[] } | undefined)?.missing;
    return { error: result.error.message, ...(missing ? { missing } : {}) };
  }
  revalidatePath(`/technical/jobs/${contractId}`);
  revalidatePath('/technical');
  redirect(`/technical/jobs/${contractId}`);
}

// ---------------------------------------------------------------------------
// Attachments — mirrors incidents/actions.ts's own uploadIncidentAttachment
// exactly (same real backend endpoint shape, same single-file-per-call
// design so the caller can loop over several selected files).
// ---------------------------------------------------------------------------

async function uploadTechnicalAttachment(contractId: string, file: File): Promise<ActionResult> {
  let token: string | undefined;
  try {
    const store = await cookies();
    token = store.get('recafco_access')?.value;
  } catch {
    // not in request context
  }

  const body = new FormData();
  body.append('file', file, file.name);

  const res = await fetch(`${API_BASE}/technical/jobs/${contractId}/drawing-received/attachments`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
    cache: 'no-store',
  });

  if (res.ok) return { error: null };

  let message = 'Failed to upload file';
  try {
    const json = (await res.json()) as { error?: { message?: string } };
    message = json.error?.message ?? message;
  } catch {
    // ignore
  }
  return { error: message };
}

export async function uploadDrawingAttachmentAction(contractId: string, file: File): Promise<ActionResult> {
  const result = await uploadTechnicalAttachment(contractId, file);
  if (!result.error) revalidatePath(`/technical/jobs/${contractId}/workflow/drawing-received`);
  return result;
}

export async function deleteDrawingAttachmentAction(contractId: string, attachmentId: string): Promise<ActionResult> {
  const result = await technicalApiFetchResult(
    `/technical/jobs/${contractId}/drawing-received/attachments/${attachmentId}`,
    { method: 'DELETE' },
  );
  if (result.error) return { error: result.error.message };
  revalidatePath(`/technical/jobs/${contractId}/workflow/drawing-received`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// FMP-TECH-02 — SD & Calculation Submission. Mirrors the Drawing Received
// actions above exactly in shape.
// ---------------------------------------------------------------------------

function extractSdSubmissionInput(formData: FormData): SaveSdCalculationSubmissionInput {
  const str = (key: string): string | undefined => {
    const v = formData.get(key);
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
  };
  const num = (key: string): number | undefined => {
    const v = str(key);
    if (v === undefined) return undefined;
    const parsed = parseInt(v, 10);
    return isNaN(parsed) ? undefined : parsed;
  };

  const input: SaveSdCalculationSubmissionInput = {};
  const submissionDate = str('submissionDate');
  if (submissionDate) input.submissionDate = submissionDate;
  const submissionType = str('submissionType');
  if (submissionType) input.submissionType = submissionType as TechnicalSubmissionType;
  const submittedTo = str('submittedTo');
  if (submittedTo) input.submittedTo = submittedTo;
  const targetApprovalDate = str('targetApprovalDate');
  if (targetApprovalDate) input.targetApprovalDate = targetApprovalDate;
  const drawingReferenceNo = str('drawingReferenceNo');
  if (drawingReferenceNo) input.drawingReferenceNo = drawingReferenceNo;
  const revisionNo = str('revisionNo');
  if (revisionNo) input.revisionNo = revisionNo;
  const relatedDrawingId = str('relatedDrawingId');
  if (relatedDrawingId) input.relatedDrawingId = relatedDrawingId;
  const calculationType = str('calculationType');
  if (calculationType) input.calculationType = calculationType as TechnicalCalculationType;
  const numberOfSheetsOrFiles = num('numberOfSheetsOrFiles');
  if (numberOfSheetsOrFiles !== undefined) input.numberOfSheetsOrFiles = numberOfSheetsOrFiles;
  const scopeDescription = str('scopeDescription');
  if (scopeDescription) input.scopeDescription = scopeDescription;
  const submissionMethod = str('submissionMethod');
  if (submissionMethod) input.submissionMethod = submissionMethod as TechnicalSubmissionMethod;
  const referenceSubmissionNo = str('referenceSubmissionNo');
  if (referenceSubmissionNo) input.referenceSubmissionNo = referenceSubmissionNo;
  const submittedByName = str('submittedByName');
  if (submittedByName) input.submittedByName = submittedByName;
  const designation = str('designation');
  if (designation) input.designation = designation;
  const contactNo = str('contactNo');
  if (contactNo) input.contactNo = contactNo;
  const email = str('email');
  if (email) input.email = email;
  const remarks = str('remarks');
  if (remarks) input.remarks = remarks;
  const status = str('status');
  if (status) input.status = status as TechnicalSdSubmissionStatus;

  return input;
}

export async function saveSdSubmissionDraftAction(contractId: string, formData: FormData): Promise<ActionResult> {
  const input = extractSdSubmissionInput(formData);
  const result = await technicalApiFetchResult(`/technical/jobs/${contractId}/sd-calculation-submission`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (result.error) return { error: result.error.message };
  revalidatePath(`/technical/jobs/${contractId}/workflow/sd-calculation-submission`);
  return { error: null };
}

export async function submitSdCalculationAction(contractId: string, formData: FormData): Promise<ActionResult> {
  const input = extractSdSubmissionInput(formData);
  const result = await technicalApiFetchResult(`/technical/jobs/${contractId}/sd-calculation-submission/submit`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (result.error) {
    const missing = (result.error.details as { missing?: string[] } | undefined)?.missing;
    return { error: result.error.message, ...(missing ? { missing } : {}) };
  }
  revalidatePath(`/technical/jobs/${contractId}/workflow/sd-calculation-submission`);
  return { error: null };
}

/** Reuses the form's own Remarks field as the clarification note — same reasoning as requestClarificationAction (Drawing Received) above. */
export async function requestSdClarificationAction(contractId: string, formData: FormData): Promise<ActionResult> {
  const remarks = (formData.get('remarks') as string | null)?.trim();
  const note = remarks || 'Clarification requested on the SD & Calculation submission.';

  const result = await technicalApiFetchResult(`/technical/jobs/${contractId}/sd-calculation-submission/clarification`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
  if (result.error) return { error: result.error.message };
  revalidatePath(`/technical/jobs/${contractId}/workflow/sd-calculation-submission`);
  return { error: null };
}

export async function completeSdCalculationAction(contractId: string, formData: FormData): Promise<ActionResult> {
  const input = extractSdSubmissionInput(formData);
  const result = await technicalApiFetchResult<{ nextStage: string | null }>(
    `/technical/jobs/${contractId}/sd-calculation-submission/complete`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  if (result.error) {
    const missing = (result.error.details as { missing?: string[] } | undefined)?.missing;
    return { error: result.error.message, ...(missing ? { missing } : {}) };
  }
  revalidatePath(`/technical/jobs/${contractId}`);
  revalidatePath('/technical');
  redirect(`/technical/jobs/${contractId}`);
}

async function uploadSdAttachmentRaw(contractId: string, file: File): Promise<ActionResult> {
  let token: string | undefined;
  try {
    const store = await cookies();
    token = store.get('recafco_access')?.value;
  } catch {
    // not in request context
  }

  const body = new FormData();
  body.append('file', file, file.name);

  const res = await fetch(`${API_BASE}/technical/jobs/${contractId}/sd-calculation-submission/attachments`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
    cache: 'no-store',
  });

  if (res.ok) return { error: null };

  let message = 'Failed to upload file';
  try {
    const json = (await res.json()) as { error?: { message?: string } };
    message = json.error?.message ?? message;
  } catch {
    // ignore
  }
  return { error: message };
}

export async function uploadSdAttachmentAction(contractId: string, file: File): Promise<ActionResult> {
  const result = await uploadSdAttachmentRaw(contractId, file);
  if (!result.error) revalidatePath(`/technical/jobs/${contractId}/workflow/sd-calculation-submission`);
  return result;
}

export async function deleteSdAttachmentAction(contractId: string, attachmentId: string): Promise<ActionResult> {
  const result = await technicalApiFetchResult(
    `/technical/jobs/${contractId}/sd-calculation-submission/attachments/${attachmentId}`,
    { method: 'DELETE' },
  );
  if (result.error) return { error: result.error.message };
  revalidatePath(`/technical/jobs/${contractId}/workflow/sd-calculation-submission`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// FMP-TECH-03 — Getting Approval. Mirrors the SD & Calculation Submission
// actions above; 3 write actions here (Send Back for Changes, Reject,
// Approve) instead of 2, matching this stage's own richer action set.
// ---------------------------------------------------------------------------

function extractApprovalInput(formData: FormData): SaveGettingApprovalInput {
  const str = (key: string): string | undefined => {
    const v = formData.get(key);
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
  };
  const bool = (key: string): boolean => formData.get(key) === 'on' || formData.get(key) === 'true';

  const input: SaveGettingApprovalInput = {};
  const relatedSdSubmissionId = str('relatedSdSubmissionId');
  if (relatedSdSubmissionId) input.relatedSdSubmissionId = relatedSdSubmissionId;
  const submittedOn = str('submittedOn');
  if (submittedOn) input.submittedOn = submittedOn;
  const submittedByName = str('submittedByName');
  if (submittedByName) input.submittedByName = submittedByName;
  const submittedTo = str('submittedTo');
  if (submittedTo) input.submittedTo = submittedTo;
  const approvalStatus = str('approvalStatus');
  if (approvalStatus) input.approvalStatus = approvalStatus as TechnicalApprovalStatus;
  const expectedApprovalDate = str('expectedApprovalDate');
  if (expectedApprovalDate) input.expectedApprovalDate = expectedApprovalDate;
  const reviewedOn = str('reviewedOn');
  if (reviewedOn) input.reviewedOn = reviewedOn;
  const reviewedBy = str('reviewedBy');
  if (reviewedBy) input.reviewedBy = reviewedBy;
  const revisionNo = str('revisionNo');
  if (revisionNo) input.revisionNo = revisionNo;
  const reviewerComments = str('reviewerComments');
  if (reviewerComments) input.reviewerComments = reviewerComments;
  input.resubmissionRequired = bool('resubmissionRequired');
  const resubmissionDate = str('resubmissionDate');
  if (resubmissionDate) input.resubmissionDate = resubmissionDate;
  const resubmissionReason = str('resubmissionReason');
  if (resubmissionReason) input.resubmissionReason = resubmissionReason;
  const status = str('status');
  if (status) input.status = status as TechnicalApprovalRecordStatus;

  return input;
}

export async function saveApprovalDraftAction(contractId: string, formData: FormData): Promise<ActionResult> {
  const input = extractApprovalInput(formData);
  const result = await technicalApiFetchResult(`/technical/jobs/${contractId}/getting-approval`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (result.error) return { error: result.error.message };
  revalidatePath(`/technical/jobs/${contractId}/workflow/getting-approval`);
  return { error: null };
}

/** Reuses the form's own Reviewer Comments field as the clarification note — same reasoning as the other 2 stages' own clarification actions. */
export async function requestApprovalClarificationAction(contractId: string, formData: FormData): Promise<ActionResult> {
  const reviewerComments = (formData.get('reviewerComments') as string | null)?.trim();
  const note = reviewerComments || 'Clarification requested on the Getting Approval package.';

  const result = await technicalApiFetchResult(`/technical/jobs/${contractId}/getting-approval/clarification`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
  if (result.error) return { error: result.error.message };
  revalidatePath(`/technical/jobs/${contractId}/workflow/getting-approval`);
  return { error: null };
}

export async function sendApprovalBackForChangesAction(contractId: string, formData: FormData): Promise<ActionResult> {
  const input = extractApprovalInput(formData);
  const result = await technicalApiFetchResult(`/technical/jobs/${contractId}/getting-approval/send-back`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (result.error) return { error: result.error.message };
  revalidatePath(`/technical/jobs/${contractId}/workflow/getting-approval`);
  return { error: null };
}

export async function rejectApprovalAction(contractId: string, formData: FormData): Promise<ActionResult> {
  const input = extractApprovalInput(formData);
  const result = await technicalApiFetchResult(`/technical/jobs/${contractId}/getting-approval/reject`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (result.error) return { error: result.error.message };
  revalidatePath(`/technical/jobs/${contractId}/workflow/getting-approval`);
  return { error: null };
}

export async function approveAndMoveToFdIssuanceAction(contractId: string, formData: FormData): Promise<ActionResult> {
  const input = extractApprovalInput(formData);
  const result = await technicalApiFetchResult<{ nextStage: string | null }>(
    `/technical/jobs/${contractId}/getting-approval/approve`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  if (result.error) {
    const missing = (result.error.details as { missing?: string[] } | undefined)?.missing;
    return { error: result.error.message, ...(missing ? { missing } : {}) };
  }
  revalidatePath(`/technical/jobs/${contractId}`);
  revalidatePath('/technical');
  redirect(`/technical/jobs/${contractId}`);
}

async function uploadApprovalAttachmentRaw(contractId: string, file: File): Promise<ActionResult> {
  let token: string | undefined;
  try {
    const store = await cookies();
    token = store.get('recafco_access')?.value;
  } catch {
    // not in request context
  }

  const body = new FormData();
  body.append('file', file, file.name);

  const res = await fetch(`${API_BASE}/technical/jobs/${contractId}/getting-approval/attachments`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
    cache: 'no-store',
  });

  if (res.ok) return { error: null };

  let message = 'Failed to upload file';
  try {
    const json = (await res.json()) as { error?: { message?: string } };
    message = json.error?.message ?? message;
  } catch {
    // ignore
  }
  return { error: message };
}

export async function uploadApprovalAttachmentAction(contractId: string, file: File): Promise<ActionResult> {
  const result = await uploadApprovalAttachmentRaw(contractId, file);
  if (!result.error) revalidatePath(`/technical/jobs/${contractId}/workflow/getting-approval`);
  return result;
}

export async function deleteApprovalAttachmentAction(contractId: string, attachmentId: string): Promise<ActionResult> {
  const result = await technicalApiFetchResult(
    `/technical/jobs/${contractId}/getting-approval/attachments/${attachmentId}`,
    { method: 'DELETE' },
  );
  if (result.error) return { error: result.error.message };
  revalidatePath(`/technical/jobs/${contractId}/workflow/getting-approval`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// FMP-TECH-04 — FD Issuance (Technical Stage 4, the final stage). Mirrors
// the Getting Approval actions above; Return/Reopen replaces Send Back for
// Changes, and Issue FD & Complete replaces Approve.
// ---------------------------------------------------------------------------

function extractFdInput(formData: FormData): SaveFdIssuanceInput {
  const str = (key: string): string | undefined => {
    const v = formData.get(key);
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
  };
  const num = (key: string): number | undefined => {
    const v = str(key);
    if (v === undefined) return undefined;
    const parsed = parseInt(v, 10);
    return isNaN(parsed) ? undefined : parsed;
  };

  const input: SaveFdIssuanceInput = {};
  const relatedApprovalId = str('relatedApprovalId');
  if (relatedApprovalId) input.relatedApprovalId = relatedApprovalId;
  const fdIssueDate = str('fdIssueDate');
  if (fdIssueDate) input.fdIssueDate = fdIssueDate;
  const issuedTo = str('issuedTo');
  if (issuedTo) input.issuedTo = issuedTo;
  const purposeFor = str('purposeFor');
  if (purposeFor) input.purposeFor = purposeFor as TechnicalFdPurpose;
  const issueType = str('issueType');
  if (issueType) input.issueType = issueType as TechnicalFdIssueType;
  const drawingReferenceNo = str('drawingReferenceNo');
  if (drawingReferenceNo) input.drawingReferenceNo = drawingReferenceNo;
  const revisionNo = str('revisionNo');
  if (revisionNo) input.revisionNo = revisionNo;
  const approvedReferenceNo = str('approvedReferenceNo');
  if (approvedReferenceNo) input.approvedReferenceNo = approvedReferenceNo;
  const approvedDate = str('approvedDate');
  if (approvedDate) input.approvedDate = approvedDate;
  const numberOfSheetsOrFiles = num('numberOfSheetsOrFiles');
  if (numberOfSheetsOrFiles !== undefined) input.numberOfSheetsOrFiles = numberOfSheetsOrFiles;
  const distribution = str('distribution');
  if (distribution) input.distribution = distribution as TechnicalFdDistribution;
  const issueMethod = str('issueMethod');
  if (issueMethod) input.issueMethod = issueMethod as TechnicalFdIssueMethod;
  const issuedByName = str('issuedByName');
  if (issuedByName) input.issuedByName = issuedByName;
  const designation = str('designation');
  if (designation) input.designation = designation;
  const contactNo = str('contactNo');
  if (contactNo) input.contactNo = contactNo;
  const email = str('email');
  if (email) input.email = email;
  const remarks = str('remarks');
  if (remarks) input.remarks = remarks;
  const status = str('status');
  if (status) input.status = status as TechnicalFdStatus;

  return input;
}

export async function saveFdDraftAction(contractId: string, formData: FormData): Promise<ActionResult> {
  const input = extractFdInput(formData);
  const result = await technicalApiFetchResult(`/technical/jobs/${contractId}/fd-issuance`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (result.error) return { error: result.error.message };
  revalidatePath(`/technical/jobs/${contractId}/workflow/fd-issuance`);
  return { error: null };
}

export async function submitFdIssueAction(contractId: string, formData: FormData): Promise<ActionResult> {
  const input = extractFdInput(formData);
  const result = await technicalApiFetchResult(`/technical/jobs/${contractId}/fd-issuance/submit`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (result.error) {
    const missing = (result.error.details as { missing?: string[] } | undefined)?.missing;
    return { error: result.error.message, ...(missing ? { missing } : {}) };
  }
  revalidatePath(`/technical/jobs/${contractId}/workflow/fd-issuance`);
  return { error: null };
}

/** Unlike the other stages' clarification actions, Return/Reopen genuinely requires a reason (the ticket's own explicit rule) — no default fallback text. */
export async function returnOrReopenFdAction(contractId: string, formData: FormData): Promise<ActionResult> {
  const note = (formData.get('returnReason') as string | null)?.trim();
  if (!note) return { error: 'A reason is required to return/reopen this FD Issuance.' };

  const result = await technicalApiFetchResult(`/technical/jobs/${contractId}/fd-issuance/return`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
  if (result.error) return { error: result.error.message };
  revalidatePath(`/technical/jobs/${contractId}`);
  revalidatePath('/technical');
  redirect(`/technical/jobs/${contractId}`);
}

export async function issueFdAndCompleteWorkflowAction(contractId: string, formData: FormData): Promise<ActionResult> {
  const input = extractFdInput(formData);
  const result = await technicalApiFetchResult<{ nextStage: string | null }>(
    `/technical/jobs/${contractId}/fd-issuance/complete`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  if (result.error) {
    const missing = (result.error.details as { missing?: string[] } | undefined)?.missing;
    return { error: result.error.message, ...(missing ? { missing } : {}) };
  }
  revalidatePath(`/technical/jobs/${contractId}`);
  revalidatePath('/technical');
  redirect(`/technical/jobs/${contractId}`);
}

async function uploadFdAttachmentRaw(contractId: string, file: File): Promise<ActionResult> {
  let token: string | undefined;
  try {
    const store = await cookies();
    token = store.get('recafco_access')?.value;
  } catch {
    // not in request context
  }

  const body = new FormData();
  body.append('file', file, file.name);

  const res = await fetch(`${API_BASE}/technical/jobs/${contractId}/fd-issuance/attachments`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
    cache: 'no-store',
  });

  if (res.ok) return { error: null };

  let message = 'Failed to upload file';
  try {
    const json = (await res.json()) as { error?: { message?: string } };
    message = json.error?.message ?? message;
  } catch {
    // ignore
  }
  return { error: message };
}

export async function uploadFdAttachmentAction(contractId: string, file: File): Promise<ActionResult> {
  const result = await uploadFdAttachmentRaw(contractId, file);
  if (!result.error) revalidatePath(`/technical/jobs/${contractId}/workflow/fd-issuance`);
  return result;
}

export async function deleteFdAttachmentAction(contractId: string, attachmentId: string): Promise<ActionResult> {
  const result = await technicalApiFetchResult(
    `/technical/jobs/${contractId}/fd-issuance/attachments/${attachmentId}`,
    { method: 'DELETE' },
  );
  if (result.error) return { error: result.error.message };
  revalidatePath(`/technical/jobs/${contractId}/workflow/fd-issuance`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// FMP-BOQ-03 — BOQ Drawing Confirmation (Technical confirms physical pieces)
// ---------------------------------------------------------------------------

export interface SaveBoqConfirmationInput {
  /** create = new row; update = edit a draft; revise = replace a confirmed row (old one is kept as Revised). */
  mode: 'create' | 'update' | 'revise';
  id?: string;
  action: 'DRAFT' | 'CONFIRM';
  boqItemId: string;
  drawingNo: string;
  drawingTitle: string;
  /** Whole number as typed; empty for a draft. */
  confirmedPieces: string;
  sizeOrSpecification: string;
  revision: string;
  remarks: string;
}

export async function saveBoqConfirmationAction(contractId: string, input: SaveBoqConfirmationInput): Promise<ActionResult> {
  const pieces = input.confirmedPieces.trim();
  const body = {
    action: input.action,
    drawingNo: input.drawingNo.trim(),
    drawingTitle: input.drawingTitle.trim(),
    sizeOrSpecification: input.sizeOrSpecification.trim(),
    revision: input.revision.trim(),
    remarks: input.remarks.trim(),
    ...(input.mode === 'create' ? { boqItemId: input.boqItemId } : {}),
    ...(pieces !== '' ? { confirmedPieces: Number(pieces) } : {}),
  };
  const base = `/technical/jobs/${contractId}/boq-confirmations`;
  const path = input.mode === 'create' ? base : input.mode === 'update' ? `${base}/${input.id}` : `${base}/${input.id}/revise`;
  const result = await technicalApiFetchResult(path, {
    method: input.mode === 'update' ? 'PATCH' : 'POST',
    body: JSON.stringify(body),
  });
  if (result.error) return { error: result.error.message };
  revalidatePath(`/technical/jobs/${contractId}`);
  return { error: null };
}

export async function cancelBoqConfirmationAction(contractId: string, id: string): Promise<ActionResult> {
  const result = await technicalApiFetchResult(`/technical/jobs/${contractId}/boq-confirmations/${id}/cancel`, { method: 'POST' });
  if (result.error) return { error: result.error.message };
  revalidatePath(`/technical/jobs/${contractId}`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// FMP-BOQ-04 — piece generation + read-only piece list
// ---------------------------------------------------------------------------

export interface GeneratePiecesResult {
  error: string | null;
  /** Plain-language outcome, e.g. "Pieces generated successfully." / "Pieces are already generated." */
  message?: string;
}

export async function generateBoqPiecesAction(contractId: string): Promise<GeneratePiecesResult> {
  const result = await technicalApiFetchResult<{ generatedCount: number; alreadyGenerated: boolean; message: string }>(
    `/technical/jobs/${contractId}/boq-pieces/generate`,
    { method: 'POST' },
  );
  if (result.error) return { error: result.error.message };
  revalidatePath(`/technical/jobs/${contractId}`);
  return { error: null, message: result.data.message };
}

export async function listBoqPiecesAction(
  contractId: string,
  boqItemId: string,
  status?: BoqPieceStatus,
): Promise<{ error: string | null; pieces: BoqPiece[] }> {
  const qs = new URLSearchParams({ boqItemId });
  if (status) qs.set('status', status);
  const result = await technicalApiFetchResult<BoqPiece[]>(`/technical/jobs/${contractId}/boq-pieces?${qs.toString()}`);
  if (result.error) return { error: 'Pieces could not be loaded. Please try again.', pieces: [] };
  return { error: null, pieces: result.data };
}

// ---------------------------------------------------------------------------
// FMP-BOQ-05 — piece status update (one or many) and history
// ---------------------------------------------------------------------------

export interface UpdatePieceStatusResult {
  error: string | null;
  /** e.g. "Pieces updated." / "8 pieces updated. 2 pieces skipped." */
  message?: string;
  updatedCount: number;
  skippedCount: number;
}

/** One piece or many: the same endpoint handles both, so every change writes history the same way. */
export async function updateBoqPieceStatusAction(
  contractId: string,
  pieceIds: string[],
  status: BoqPieceUpdateStatus,
  note: string,
): Promise<UpdatePieceStatusResult> {
  const result = await technicalApiFetchResult<{ updatedCount: number; skippedCount: number; message: string }>(
    `/technical/jobs/${contractId}/boq-pieces/bulk-status`,
    { method: 'POST', body: JSON.stringify({ pieceIds, status, ...(note.trim() ? { note: note.trim() } : {}) }) },
  );
  if (result.error) return { error: result.error.message, updatedCount: 0, skippedCount: 0 };
  revalidatePath(`/technical/jobs/${contractId}`);
  return { error: null, message: result.data.message, updatedCount: result.data.updatedCount, skippedCount: result.data.skippedCount };
}

export async function getBoqPieceHistoryAction(
  contractId: string,
  pieceId: string,
): Promise<{ error: string | null; entries: BoqPieceHistoryEntry[] }> {
  const result = await technicalApiFetchResult<{ pieceCode: string; history: BoqPieceHistoryEntry[] }>(
    `/technical/jobs/${contractId}/boq-pieces/${pieceId}/history`,
  );
  if (result.error) return { error: 'History could not be loaded. Please try again.', entries: [] };
  return { error: null, entries: result.data.history };
}

// ---------------------------------------------------------------------------
// FMP-BOQ-11 — Drawing / Calculation Groups
// ---------------------------------------------------------------------------

export interface SaveDrawingGroupInput {
  mode: 'create' | 'update';
  id?: string;
  action: 'DRAFT' | 'SUBMIT';
  boqItemId: string;
  drawingNo: string;
  calculationRef: string;
  groupTitle: string;
  remarks: string;
  pieceIds: string[];
}

export async function saveDrawingGroupAction(contractId: string, input: SaveDrawingGroupInput): Promise<ActionResult> {
  const base = `/technical/jobs/${contractId}/drawing-groups`;
  const result = await technicalApiFetchResult(input.mode === 'create' ? base : `${base}/${input.id}`, {
    method: input.mode === 'create' ? 'POST' : 'PATCH',
    body: JSON.stringify({
      action: input.action,
      drawingNo: input.drawingNo.trim(),
      calculationRef: input.calculationRef.trim(),
      groupTitle: input.groupTitle.trim(),
      remarks: input.remarks.trim(),
      pieceIds: input.pieceIds,
      ...(input.mode === 'create' ? { boqItemId: input.boqItemId } : {}),
    }),
  });
  if (result.error) return { error: result.error.message };
  return { error: null };
}

/** Submit, approve, release to Production or cancel a group. Only records the group status. */
export async function drawingGroupTransitionAction(
  contractId: string,
  groupId: string,
  transition: 'submit' | 'approve' | 'release' | 'cancel',
): Promise<ActionResult> {
  const result = await technicalApiFetchResult(`/technical/jobs/${contractId}/drawing-groups/${groupId}/${transition}`, { method: 'POST' });
  if (result.error) return { error: result.error.message };
  return { error: null };
}

/** Generated pieces of one BOQ item with the group each is in (for the picker). */
export async function listGroupablePiecesAction(
  contractId: string,
  boqItemId: string,
): Promise<{ error: string | null; pieces: GroupablePiece[] }> {
  const result = await technicalApiFetchResult<GroupablePiece[]>(`/technical/jobs/${contractId}/drawing-groups/pieces?boqItemId=${boqItemId}`);
  if (result.error) return { error: 'Pieces could not be loaded. Please try again.', pieces: [] };
  return { error: null, pieces: result.data };
}

/** The pieces one group covers (View Pieces on a group). */
export async function getDrawingGroupPiecesAction(
  contractId: string,
  groupId: string,
): Promise<{ error: string | null; pieces: { id: string; pieceCode: string; currentStatus: BoqPieceStatus }[] }> {
  const result = await technicalApiFetchResult<{ pieces: { id: string; pieceCode: string; currentStatus: BoqPieceStatus }[] }>(
    `/technical/jobs/${contractId}/drawing-groups/${groupId}`,
  );
  if (result.error) return { error: 'Pieces could not be loaded. Please try again.', pieces: [] };
  return { error: null, pieces: result.data.pieces };
}

// ---------------------------------------------------------------------------
// FMP-BOQ-12 — files on Drawing / Calculation Groups
// ---------------------------------------------------------------------------

export async function listDrawingGroupFilesAction(
  contractId: string,
  groupId: string,
): Promise<{ error: string | null; files: DrawingGroupFile[] }> {
  const result = await technicalApiFetchResult<DrawingGroupFile[]>(`/technical/jobs/${contractId}/drawing-groups/${groupId}/attachments`);
  if (result.error) return { error: 'Files could not be loaded. Please try again.', files: [] };
  return { error: null, files: result.data };
}

/** Uploads one file (category + optional remarks) to a group. Uploading never changes the group's status. */
export async function uploadDrawingGroupFileAction(contractId: string, groupId: string, formData: FormData): Promise<ActionResult> {
  let token: string | undefined;
  try {
    token = (await cookies()).get('recafco_access')?.value;
  } catch {
    token = undefined;
  }
  try {
    const res = await fetch(`${API_BASE}/technical/jobs/${contractId}/drawing-groups/${groupId}/attachments`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
      cache: 'no-store',
    });
    if (res.ok) return { error: null };
    let message = 'File could not be uploaded. Please try again.';
    try {
      const json = (await res.json()) as { error?: { message?: string } };
      if (json.error?.message) message = json.error.message;
    } catch {
      // keep the friendly default
    }
    return { error: message };
  } catch {
    return { error: 'File could not be uploaded. Please try again.' };
  }
}

export async function deleteDrawingGroupFileAction(contractId: string, groupId: string, attachmentId: string): Promise<ActionResult> {
  const result = await technicalApiFetchResult(`/technical/jobs/${contractId}/drawing-groups/${groupId}/attachments/${attachmentId}`, {
    method: 'DELETE',
  });
  if (result.error) return { error: result.error.message };
  return { error: null };
}
