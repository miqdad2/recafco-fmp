'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

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
): Promise<{ ok: boolean; id?: string; code?: string; message?: string }> {
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

  if (res.ok) {
    try {
      const json = (await res.json()) as { data?: { id?: string } };
      return { ok: true, id: json.data?.id };
    } catch {
      return { ok: true };
    }
  }

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
// Create inspection
// ---------------------------------------------------------------------------

export async function createInspectionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get('title') as string)?.trim();
  const summary = (formData.get('summary') as string | null)?.trim() || null;
  const departmentId = (formData.get('departmentId') as string | null) || null;
  const plantId = (formData.get('plantId') as string | null) || null;
  const locationId = (formData.get('locationId') as string | null) || null;
  const scheduledAt = (formData.get('scheduledAt') as string | null) || null;
  const inspectorUserId = (formData.get('inspectorUserId') as string | null) || null;

  if (!title) return { error: 'Title is required' };

  const result = await actionFetch('/safety-compliance', 'POST', {
    title,
    ...(summary ? { summary } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(plantId ? { plantId } : {}),
    ...(locationId ? { locationId } : {}),
    ...(scheduledAt ? { scheduledAt } : {}),
    ...(inspectorUserId ? { inspectorUserId } : {}),
  });

  if (!result.ok) return { error: result.message ?? 'Failed to create inspection' };

  revalidatePath('/safety-compliance');
  if (result.id) {
    redirect(`/safety-compliance/${result.id}`);
  }
  redirect('/safety-compliance');
}

// ---------------------------------------------------------------------------
// Update draft
// ---------------------------------------------------------------------------

export async function updateInspectionDraftAction(
  inspectionId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get('title') as string)?.trim();
  const summary = (formData.get('summary') as string | null)?.trim() || null;
  const departmentId = (formData.get('departmentId') as string | null) || null;
  const plantId = (formData.get('plantId') as string | null) || null;
  const locationId = (formData.get('locationId') as string | null) || null;
  const scheduledAt = (formData.get('scheduledAt') as string | null) || null;
  const inspectorUserId = (formData.get('inspectorUserId') as string | null) || null;
  const checklistSummary = (formData.get('checklistSummary') as string | null)?.trim() || null;

  const data: Record<string, unknown> = {};
  if (title) data['title'] = title;
  if (summary !== null) data['summary'] = summary || null;
  if (departmentId !== null) data['departmentId'] = departmentId || null;
  if (plantId !== null) data['plantId'] = plantId || null;
  if (locationId !== null) data['locationId'] = locationId || null;
  if (scheduledAt !== null) data['scheduledAt'] = scheduledAt || null;
  if (inspectorUserId !== null) data['inspectorUserId'] = inspectorUserId || null;
  if (checklistSummary !== null) data['checklistSummary'] = checklistSummary || null;

  const result = await actionFetch(`/safety-compliance/${inspectionId}`, 'PATCH', data);

  if (!result.ok) return { error: result.message ?? 'Failed to update inspection' };

  revalidatePath('/safety-compliance');
  redirect(`/safety-compliance/${inspectionId}`);
}

// ---------------------------------------------------------------------------
// Schedule inspection
// ---------------------------------------------------------------------------

export async function scheduleInspectionAction(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const scheduledAt = (formData.get('scheduledAt') as string | null) || null;
  const inspectorUserId = (formData.get('inspectorUserId') as string | null) || null;

  const result = await actionFetch(`/safety-compliance/${id}/schedule`, 'POST', {
    ...(scheduledAt ? { scheduledAt } : {}),
    ...(inspectorUserId ? { inspectorUserId } : {}),
  });

  if (!result.ok) return { error: result.message ?? 'Failed to schedule inspection' };

  revalidatePath('/safety-compliance');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Start inspection
// ---------------------------------------------------------------------------

export async function startInspectionAction(id: string): Promise<ActionResult> {
  const result = await actionFetch(`/safety-compliance/${id}/start`, 'POST');
  if (!result.ok) return { error: result.message ?? 'Failed to start inspection' };

  revalidatePath('/safety-compliance');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Complete inspection
// ---------------------------------------------------------------------------

export async function completeInspectionAction(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const conclusion = (formData.get('conclusion') as string | null)?.trim() || null;

  const result = await actionFetch(`/safety-compliance/${id}/complete`, 'POST', {
    ...(conclusion ? { conclusion } : {}),
  });

  if (!result.ok) return { error: result.message ?? 'Failed to complete inspection' };

  revalidatePath('/safety-compliance');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Close inspection
// ---------------------------------------------------------------------------

export async function closeInspectionAction(id: string): Promise<ActionResult> {
  const result = await actionFetch(`/safety-compliance/${id}/close`, 'POST');
  if (!result.ok) return { error: result.message ?? 'Failed to close inspection' };

  revalidatePath('/safety-compliance');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Reopen inspection
// ---------------------------------------------------------------------------

export async function reopenInspectionAction(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const reason = (formData.get('reason') as string)?.trim();
  if (!reason) return { error: 'Reason is required to reopen' };

  const result = await actionFetch(`/safety-compliance/${id}/reopen`, 'POST', { reason });
  if (!result.ok) return { error: result.message ?? 'Failed to reopen inspection' };

  revalidatePath('/safety-compliance');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Cancel inspection
// ---------------------------------------------------------------------------

export async function cancelInspectionAction(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const reason = (formData.get('reason') as string)?.trim();
  if (!reason) return { error: 'Cancellation reason is required' };

  const result = await actionFetch(`/safety-compliance/${id}/cancel`, 'POST', { reason });
  if (!result.ok) return { error: result.message ?? 'Failed to cancel inspection' };

  revalidatePath('/safety-compliance');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Create finding
// ---------------------------------------------------------------------------

export async function createFindingAction(
  inspectionId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();
  const severity = (formData.get('severity') as string | null) || undefined;
  const assignedToUserId = (formData.get('assignedToUserId') as string | null) || null;
  const dueAt = (formData.get('dueAt') as string | null) || null;
  const actionRequired = (formData.get('actionRequired') as string | null)?.trim() || null;

  if (!title) return { error: 'Title is required' };
  if (!description) return { error: 'Description is required' };

  const result = await actionFetch(`/safety-compliance/${inspectionId}/findings`, 'POST', {
    title,
    description,
    ...(severity ? { severity } : {}),
    ...(assignedToUserId ? { assignedToUserId } : {}),
    ...(dueAt ? { dueAt } : {}),
    ...(actionRequired ? { actionRequired } : {}),
  });

  if (!result.ok) return { error: result.message ?? 'Failed to create finding' };

  revalidatePath('/safety-compliance');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Assign finding
// ---------------------------------------------------------------------------

export async function assignFindingAction(
  inspectionId: string,
  findingId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const assignedToUserId = (formData.get('assignedToUserId') as string)?.trim();
  if (!assignedToUserId) return { error: 'Please select a user to assign' };

  const result = await actionFetch(
    `/safety-compliance/${inspectionId}/findings/${findingId}/assign`,
    'POST',
    { assignedToUserId },
  );

  if (!result.ok) return { error: result.message ?? 'Failed to assign finding' };

  revalidatePath('/safety-compliance');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Require action on finding
// ---------------------------------------------------------------------------

export async function requireActionOnFindingAction(
  inspectionId: string,
  findingId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const actionRequired = (formData.get('actionRequired') as string)?.trim();
  if (!actionRequired) return { error: 'Action description is required' };

  const result = await actionFetch(
    `/safety-compliance/${inspectionId}/findings/${findingId}/require-action`,
    'POST',
    { actionRequired },
  );

  if (!result.ok) return { error: result.message ?? 'Failed to set action required' };

  revalidatePath('/safety-compliance');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Resolve finding
// ---------------------------------------------------------------------------

export async function resolveFindingAction(
  inspectionId: string,
  findingId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const resolutionSummary = (formData.get('resolutionSummary') as string)?.trim();
  if (!resolutionSummary) return { error: 'Resolution summary is required' };

  const result = await actionFetch(
    `/safety-compliance/${inspectionId}/findings/${findingId}/resolve`,
    'POST',
    { resolutionSummary },
  );

  if (!result.ok) return { error: result.message ?? 'Failed to resolve finding' };

  revalidatePath('/safety-compliance');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Verify finding
// ---------------------------------------------------------------------------

export async function verifyFindingAction(
  inspectionId: string,
  findingId: string,
): Promise<ActionResult> {
  const result = await actionFetch(
    `/safety-compliance/${inspectionId}/findings/${findingId}/verify`,
    'POST',
  );

  if (!result.ok) return { error: result.message ?? 'Failed to verify finding' };

  revalidatePath('/safety-compliance');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Close finding
// ---------------------------------------------------------------------------

export async function closeFindingAction(
  inspectionId: string,
  findingId: string,
): Promise<ActionResult> {
  const result = await actionFetch(
    `/safety-compliance/${inspectionId}/findings/${findingId}/close`,
    'POST',
  );

  if (!result.ok) return { error: result.message ?? 'Failed to close finding' };

  revalidatePath('/safety-compliance');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Reopen finding
// ---------------------------------------------------------------------------

export async function reopenFindingAction(
  inspectionId: string,
  findingId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const reopenReason = (formData.get('reopenReason') as string)?.trim();
  if (!reopenReason) return { error: 'Reason is required to reopen finding' };

  const result = await actionFetch(
    `/safety-compliance/${inspectionId}/findings/${findingId}/reopen`,
    'POST',
    { reopenReason },
  );

  if (!result.ok) return { error: result.message ?? 'Failed to reopen finding' };

  revalidatePath('/safety-compliance');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Add comment
// ---------------------------------------------------------------------------

export async function addCommentAction(
  inspectionId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = (formData.get('body') as string)?.trim();
  if (!body) return { error: 'Comment cannot be empty' };

  const result = await actionFetch(`/safety-compliance/${inspectionId}/comments`, 'POST', { body });
  if (!result.ok) return { error: result.message ?? 'Failed to add comment' };

  revalidatePath('/safety-compliance');
  return { error: null };
}
