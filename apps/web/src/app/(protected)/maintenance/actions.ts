'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Server action result types
// ---------------------------------------------------------------------------

export interface ActionResult {
  error: string | null;
  fieldErrors?: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Internal fetch helper for server actions
// ---------------------------------------------------------------------------

async function actionFetch(
  path: string,
  method: string,
  body?: unknown,
): Promise<{ ok: boolean; code?: string; message?: string }> {
  let token: string | undefined;
  try {
    const store = await cookies();
    token = store.get('recafco_access')?.value;
  } catch {
    // not in request context
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });

  if (res.ok) return { ok: true };

  let code: string | undefined;
  let message: string | undefined;

  try {
    const json = (await res.json()) as { error?: { code?: string; message?: string } };
    code = json.error?.code;
    message = json.error?.message;
  } catch {
    message = `HTTP ${res.status}`;
  }

  return {
    ok: false,
    ...(code !== undefined ? { code } : {}),
    ...(message !== undefined ? { message } : {}),
  };
}

// ---------------------------------------------------------------------------
// Create maintenance request
// ---------------------------------------------------------------------------

export async function createMrAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get('title') as string)?.trim();
  const problemDescription = (formData.get('problemDescription') as string)?.trim();
  const priority = (formData.get('priority') as string | null) || undefined;
  const affectedDepartmentId = (formData.get('affectedDepartmentId') as string | null) || null;
  const plantId = (formData.get('plantId') as string | null) || null;
  const locationId = (formData.get('locationId') as string | null) || null;
  const equipmentDescription = (formData.get('equipmentDescription') as string | null)?.trim() || null;
  const requestedCompletionAt = (formData.get('requestedCompletionAt') as string | null) || null;

  if (!title) return { error: 'Title is required' };
  if (!problemDescription) return { error: 'Problem description is required' };

  const result = await actionFetch('/maintenance', 'POST', {
    title,
    problemDescription,
    ...(priority ? { priority } : {}),
    ...(affectedDepartmentId ? { affectedDepartmentId } : {}),
    ...(plantId ? { plantId } : {}),
    ...(locationId ? { locationId } : {}),
    ...(equipmentDescription ? { equipmentDescription } : {}),
    ...(requestedCompletionAt ? { requestedCompletionAt } : {}),
  });

  if (!result.ok) return { error: result.message ?? 'Failed to create maintenance request' };

  redirect('/maintenance');
}

// ---------------------------------------------------------------------------
// Update draft
// ---------------------------------------------------------------------------

export async function updateMrDraftAction(
  mrId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get('title') as string)?.trim();
  const problemDescription = (formData.get('problemDescription') as string)?.trim();
  const priority = (formData.get('priority') as string | null) || undefined;
  const affectedDepartmentId = (formData.get('affectedDepartmentId') as string | null) || null;
  const plantId = (formData.get('plantId') as string | null) || null;
  const locationId = (formData.get('locationId') as string | null) || null;
  const equipmentDescription = (formData.get('equipmentDescription') as string | null)?.trim() || null;
  const requestedCompletionAt = (formData.get('requestedCompletionAt') as string | null) || null;

  const data: Record<string, unknown> = {};
  if (title) data['title'] = title;
  if (problemDescription) data['problemDescription'] = problemDescription;
  if (priority) data['priority'] = priority;
  if (affectedDepartmentId !== null) data['affectedDepartmentId'] = affectedDepartmentId || undefined;
  if (plantId !== null) data['plantId'] = plantId || undefined;
  if (locationId !== null) data['locationId'] = locationId || undefined;
  if (equipmentDescription !== null) data['equipmentDescription'] = equipmentDescription || undefined;
  data['requestedCompletionAt'] = requestedCompletionAt || null;

  const result = await actionFetch(`/maintenance/${mrId}`, 'PATCH', data);

  if (!result.ok) return { error: result.message ?? 'Failed to update maintenance request' };

  redirect(`/maintenance/${mrId}`);
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

export async function submitMrAction(mrId: string): Promise<ActionResult> {
  const result = await actionFetch(`/maintenance/${mrId}/submit`, 'POST');
  if (!result.ok) return { error: result.message ?? 'Failed to submit request' };
  return { error: null };
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export async function reviewMrAction(mrId: string): Promise<ActionResult> {
  const result = await actionFetch(`/maintenance/${mrId}/review`, 'POST');
  if (!result.ok) return { error: result.message ?? 'Failed to set under review' };
  return { error: null };
}

// ---------------------------------------------------------------------------
// Approve
// ---------------------------------------------------------------------------

export async function approveMrAction(mrId: string): Promise<ActionResult> {
  const result = await actionFetch(`/maintenance/${mrId}/approve`, 'POST');
  if (!result.ok) return { error: result.message ?? 'Failed to approve request' };
  return { error: null };
}

// ---------------------------------------------------------------------------
// Reject
// ---------------------------------------------------------------------------

export async function rejectMrAction(
  mrId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const rejectionReason = (formData.get('rejectionReason') as string)?.trim();
  if (!rejectionReason) return { error: 'Rejection reason is required' };

  const result = await actionFetch(`/maintenance/${mrId}/reject`, 'POST', { rejectionReason });
  if (!result.ok) return { error: result.message ?? 'Failed to reject request' };
  return { error: null };
}

// ---------------------------------------------------------------------------
// Assign
// ---------------------------------------------------------------------------

export async function assignMrAction(
  mrId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const assignedToUserId = formData.get('assignedToUserId') as string;
  if (!assignedToUserId) return { error: 'Please select a user to assign' };

  const result = await actionFetch(`/maintenance/${mrId}/assign`, 'POST', { assignedToUserId });
  if (!result.ok) return { error: result.message ?? 'Failed to assign request' };
  return { error: null };
}

// ---------------------------------------------------------------------------
// Unassign
// ---------------------------------------------------------------------------

export async function unassignMrAction(mrId: string): Promise<ActionResult> {
  const result = await actionFetch(`/maintenance/${mrId}/unassign`, 'POST');
  if (!result.ok) return { error: result.message ?? 'Failed to unassign request' };
  return { error: null };
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

export async function startMrAction(mrId: string): Promise<ActionResult> {
  const result = await actionFetch(`/maintenance/${mrId}/start`, 'POST');
  if (!result.ok) return { error: result.message ?? 'Failed to start request' };
  return { error: null };
}

// ---------------------------------------------------------------------------
// Waiting for parts
// ---------------------------------------------------------------------------

export async function waitingForPartsMrAction(
  mrId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const waitingForPartsReason = (formData.get('waitingForPartsReason') as string)?.trim();
  if (!waitingForPartsReason) return { error: 'Reason is required' };

  const result = await actionFetch(`/maintenance/${mrId}/waiting-for-parts`, 'POST', { waitingForPartsReason });
  if (!result.ok) return { error: result.message ?? 'Failed to update status' };
  return { error: null };
}

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

export async function resumeMrAction(mrId: string): Promise<ActionResult> {
  const result = await actionFetch(`/maintenance/${mrId}/resume`, 'POST');
  if (!result.ok) return { error: result.message ?? 'Failed to resume request' };
  return { error: null };
}

// ---------------------------------------------------------------------------
// Complete
// ---------------------------------------------------------------------------

export async function completeMrAction(
  mrId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const completionSummary = (formData.get('completionSummary') as string)?.trim();
  if (!completionSummary) return { error: 'Completion summary is required' };

  const result = await actionFetch(`/maintenance/${mrId}/complete`, 'POST', { completionSummary });
  if (!result.ok) return { error: result.message ?? 'Failed to complete request' };
  return { error: null };
}

// ---------------------------------------------------------------------------
// Close
// ---------------------------------------------------------------------------

export async function closeMrAction(mrId: string): Promise<ActionResult> {
  const result = await actionFetch(`/maintenance/${mrId}/close`, 'POST');
  if (!result.ok) return { error: result.message ?? 'Failed to close request' };
  return { error: null };
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export async function cancelMrAction(
  mrId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const reason = (formData.get('reason') as string)?.trim();
  if (!reason) return { error: 'Cancellation reason is required' };

  const result = await actionFetch(`/maintenance/${mrId}/cancel`, 'POST', { reason });
  if (!result.ok) return { error: result.message ?? 'Failed to cancel request' };
  return { error: null };
}

// ---------------------------------------------------------------------------
// Reopen
// ---------------------------------------------------------------------------

export async function reopenMrAction(
  mrId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const reason = (formData.get('reason') as string)?.trim();
  if (!reason) return { error: 'Reason is required to reopen' };

  const result = await actionFetch(`/maintenance/${mrId}/reopen`, 'POST', { reason });
  if (!result.ok) return { error: result.message ?? 'Failed to reopen request' };
  return { error: null };
}

// ---------------------------------------------------------------------------
// Add comment
// ---------------------------------------------------------------------------

export async function addMrCommentAction(
  mrId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = (formData.get('body') as string)?.trim();
  if (!body) return { error: 'Comment cannot be empty' };

  const result = await actionFetch(`/maintenance/${mrId}/comments`, 'POST', { body });
  if (!result.ok) return { error: result.message ?? 'Failed to add comment' };
  return { error: null };
}
