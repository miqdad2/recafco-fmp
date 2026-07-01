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
// Create task
// ---------------------------------------------------------------------------

export async function createTaskAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string | null)?.trim() || null;
  const priority = (formData.get('priority') as string | null) || undefined;
  const requestingDepartmentId = (formData.get('requestingDepartmentId') as string | null) || null;
  const responsibleDepartmentId = (formData.get('responsibleDepartmentId') as string | null) || null;
  const plantId = (formData.get('plantId') as string | null) || null;
  const locationId = (formData.get('locationId') as string | null) || null;
  const incidentId = (formData.get('incidentId') as string | null) || null;
  const dueAt = (formData.get('dueAt') as string | null) || null;

  if (!title) return { error: null, fieldErrors: { title: ['Title is required'] } };

  const body: Record<string, unknown> = { title };
  if (description) body['description'] = description;
  if (priority) body['priority'] = priority;
  if (requestingDepartmentId) body['requestingDepartmentId'] = requestingDepartmentId;
  if (responsibleDepartmentId) body['responsibleDepartmentId'] = responsibleDepartmentId;
  if (plantId) body['plantId'] = plantId;
  if (locationId) body['locationId'] = locationId;
  if (incidentId) body['incidentId'] = incidentId;
  if (dueAt) body['dueAt'] = dueAt;

  let token: string | undefined;
  try {
    const store = await cookies();
    token = store.get('recafco_access')?.value;
  } catch { /* ignore */ }

  const res = await fetch(`${API_BASE}/factory-tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (res.ok) {
    const json = (await res.json()) as { data: { id: string } };
    redirect(`/factory-tasks/${json.data.id}`);
  }

  let message = 'Failed to create task';
  try {
    const json = (await res.json()) as { error?: { message?: string } };
    message = json.error?.message ?? message;
  } catch { /* ignore */ }

  return { error: message };
}

// ---------------------------------------------------------------------------
// Update own DRAFT
// ---------------------------------------------------------------------------

export async function updateDraftTaskAction(
  taskId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body: Record<string, unknown> = {};
  const title = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string | null)?.trim();
  const priority = (formData.get('priority') as string | null);
  const responsibleDepartmentId = (formData.get('responsibleDepartmentId') as string | null);
  const requestingDepartmentId = (formData.get('requestingDepartmentId') as string | null);
  const plantId = (formData.get('plantId') as string | null);
  const locationId = (formData.get('locationId') as string | null);
  const incidentId = (formData.get('incidentId') as string | null);
  const dueAt = (formData.get('dueAt') as string | null);

  if (title) body['title'] = title;
  if (description !== null) body['description'] = description || null;
  if (priority) body['priority'] = priority;
  if (responsibleDepartmentId !== null) body['responsibleDepartmentId'] = responsibleDepartmentId || null;
  if (requestingDepartmentId !== null) body['requestingDepartmentId'] = requestingDepartmentId || null;
  if (plantId !== null) body['plantId'] = plantId || null;
  if (locationId !== null) body['locationId'] = locationId || null;
  if (incidentId !== null) body['incidentId'] = incidentId || null;
  if (dueAt !== null) body['dueAt'] = dueAt || null;

  const result = await actionFetch(`/factory-tasks/${taskId}`, 'PATCH', body);
  if (result.ok) redirect(`/factory-tasks/${taskId}`);
  return { error: result.message ?? 'Failed to update task' };
}

// ---------------------------------------------------------------------------
// Open (DRAFT → OPEN)
// ---------------------------------------------------------------------------

export async function openTaskAction(taskId: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/open`, 'POST');
  if (result.ok) redirect(`/factory-tasks/${taskId}`);
  return { error: result.message ?? 'Failed to open task' };
}

// ---------------------------------------------------------------------------
// Assign / Unassign
// ---------------------------------------------------------------------------

export async function assignTaskAction(taskId: string, assignedToUserId: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/assign`, 'POST', { assignedToUserId });
  if (result.ok) redirect(`/factory-tasks/${taskId}`);
  return { error: result.message ?? 'Failed to assign task' };
}

export async function unassignTaskAction(taskId: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/unassign`, 'POST');
  if (result.ok) redirect(`/factory-tasks/${taskId}`);
  return { error: result.message ?? 'Failed to unassign task' };
}

// ---------------------------------------------------------------------------
// Start (ASSIGNED → IN_PROGRESS)
// ---------------------------------------------------------------------------

export async function startTaskAction(taskId: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/start`, 'POST');
  if (result.ok) redirect(`/factory-tasks/${taskId}`);
  return { error: result.message ?? 'Failed to start task' };
}

// ---------------------------------------------------------------------------
// Block / Unblock
// ---------------------------------------------------------------------------

export async function blockTaskAction(taskId: string, blockedReason: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/block`, 'POST', { blockedReason });
  if (result.ok) redirect(`/factory-tasks/${taskId}`);
  return { error: result.message ?? 'Failed to block task' };
}

export async function unblockTaskAction(taskId: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/unblock`, 'POST');
  if (result.ok) redirect(`/factory-tasks/${taskId}`);
  return { error: result.message ?? 'Failed to unblock task' };
}

// ---------------------------------------------------------------------------
// Complete (IN_PROGRESS → COMPLETED)
// ---------------------------------------------------------------------------

export async function completeTaskAction(taskId: string, completionSummary: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/complete`, 'POST', { completionSummary });
  if (result.ok) redirect(`/factory-tasks/${taskId}`);
  return { error: result.message ?? 'Failed to complete task' };
}

// ---------------------------------------------------------------------------
// Close (COMPLETED → CLOSED)
// ---------------------------------------------------------------------------

export async function closeTaskAction(taskId: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/close`, 'POST');
  if (result.ok) redirect(`/factory-tasks/${taskId}`);
  return { error: result.message ?? 'Failed to close task' };
}

// ---------------------------------------------------------------------------
// Reopen (COMPLETED/CLOSED/CANCELLED → OPEN)
// ---------------------------------------------------------------------------

export async function reopenTaskAction(taskId: string, reason: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/reopen`, 'POST', { reason });
  if (result.ok) redirect(`/factory-tasks/${taskId}`);
  return { error: result.message ?? 'Failed to reopen task' };
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export async function cancelTaskAction(taskId: string, reason: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/cancel`, 'POST', { reason });
  if (result.ok) redirect(`/factory-tasks/${taskId}`);
  return { error: result.message ?? 'Failed to cancel task' };
}

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

export async function updatePriorityAction(taskId: string, priority: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/priority`, 'PATCH', { priority });
  if (result.ok) redirect(`/factory-tasks/${taskId}`);
  return { error: result.message ?? 'Failed to update priority' };
}

// ---------------------------------------------------------------------------
// Due date
// ---------------------------------------------------------------------------

export async function updateDueDateAction(taskId: string, dueAt: string | null): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/due-date`, 'PATCH', { dueAt });
  if (result.ok) redirect(`/factory-tasks/${taskId}`);
  return { error: result.message ?? 'Failed to update due date' };
}

// ---------------------------------------------------------------------------
// Progress note
// ---------------------------------------------------------------------------

export async function addProgressAction(
  taskId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const note = (formData.get('note') as string)?.trim();
  const pctRaw = formData.get('progressPercent') as string | null;
  const progressPercent = pctRaw ? parseInt(pctRaw, 10) : undefined;

  if (!note) return { error: null, fieldErrors: { note: ['Progress note is required'] } };

  const body: Record<string, unknown> = { note };
  if (progressPercent !== undefined && !isNaN(progressPercent)) body['progressPercent'] = progressPercent;

  const result = await actionFetch(`/factory-tasks/${taskId}/progress`, 'POST', body);
  if (result.ok) redirect(`/factory-tasks/${taskId}#progress`);
  return { error: result.message ?? 'Failed to add progress note' };
}

// ---------------------------------------------------------------------------
// Comment
// ---------------------------------------------------------------------------

export async function addTaskCommentAction(
  taskId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = (formData.get('body') as string)?.trim();
  if (!body) return { error: null, fieldErrors: { body: ['Comment cannot be empty'] } };

  const result = await actionFetch(`/factory-tasks/${taskId}/comments`, 'POST', { body });
  if (result.ok) redirect(`/factory-tasks/${taskId}#comments`);
  return { error: result.message ?? 'Failed to post comment' };
}
