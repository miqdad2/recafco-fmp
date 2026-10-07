'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authApi } from '@/lib/auth-api';
import type { PersonRef } from '@/lib/factory-tasks-api';

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

/**
 * After a successful change, report success. Deliberately NO revalidatePath here: it makes Next
 * push its own refresh that races with (and swallows) the calling client's router.refresh(),
 * leaving the page showing stale data. Task pages are dynamic (no cache), so the client refresh is enough.
 */
function finishTaskChange(): ActionResult {
  return { error: null };
}

/** After a successful change: refresh the cached task pages/lists, then show the task (so buttons and status are never stale). */
function goToTask(taskId: string): never {
  revalidatePath(`/factory-tasks/${taskId}`);
  revalidatePath('/factory-tasks');
  revalidatePath('/factory-tasks/executive');
  revalidatePath('/dashboard');
  redirect(`/factory-tasks/${taskId}`);
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
  // FMP-UI-20C — assignment is now optional, not a distinct button choice:
  // "Assign To User" is only ever rendered for a viewer with `tasks.assign`
  // (task-form.tsx), so its mere presence/absence in the submitted form is
  // enough to decide whether the create→open→assign chain below runs — no
  // separate "intent" field, no "Assign To User is required" error.
  const assignedToUserId = (formData.get('assignedToUserId') as string | null) || null;

  const fieldErrors: Record<string, string[]> = {};
  if (!title) fieldErrors['title'] = ['Task title is required.'];
  if (!responsibleDepartmentId) fieldErrors['responsibleDepartmentId'] = ['Responsible department is required.'];
  if (dueAt && isNaN(new Date(dueAt).getTime())) fieldErrors['dueAt'] = ['Due date must be valid.'];
  if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors };

  const body: Record<string, unknown> = { title, responsibleDepartmentId };
  if (description) body['description'] = description;
  if (priority) body['priority'] = priority;
  if (requestingDepartmentId) body['requestingDepartmentId'] = requestingDepartmentId;
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

  if (!res.ok) {
    let message = 'Failed to create task';
    try {
      const json = (await res.json()) as { error?: { message?: string } };
      message = json.error?.message ?? message;
    } catch { /* ignore */ }
    return { error: message };
  }

  const json = (await res.json()) as { data: { id: string } };
  const taskId = json.data.id;

  // FMP-UI-20B — an assignee selected in "Assign To User" chains the SAME 3
  // already-existing, already-permission-gated endpoints TaskTransitionsPanel
  // itself calls (open, then assign) — never a new endpoint, never a
  // fabricated assignment. If either later step fails, the task already
  // exists for real, so we still land on its own detail page (where the
  // real Open/Assign controls already live) rather than stranding the user
  // on a stale create form referring to a task it can no longer reach.
  if (assignedToUserId) {
    await actionFetch(`/factory-tasks/${taskId}/open`, 'POST').catch(() => ({ ok: false }));
    await actionFetch(`/factory-tasks/${taskId}/assign`, 'POST', { assignedToUserId }).catch(() => ({ ok: false }));
  }

  redirect(`/factory-tasks/${taskId}`);
}

// ---------------------------------------------------------------------------
// FMP-TASK-05 - simple Create Task (popup form)
// ---------------------------------------------------------------------------

export interface CreateTaskResult {
  error: string | null;
  fieldErrors?: Record<string, string[]>;
  /** Set once the task exists. */
  taskId?: string;
  /** Task was created, but a follow-up step (assigning / a file upload) failed. */
  warning?: string;
}

/** Plain-word priority from the form to the real backend value. */
const PRIORITY_FROM_FORM: Record<string, string> = { NORMAL: 'MEDIUM', HIGH: 'HIGH', URGENT: 'URGENT' };

/** Uploads one file. Returns true on success; technical details are logged server-side only. */
async function uploadTaskAttachment(taskId: string, token: string | undefined, file: File): Promise<boolean> {
  try {
    const body = new FormData();
    body.append('file', file, file.name);
    const res = await fetch(`${API_BASE}/factory-tasks/${taskId}/attachments`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
      cache: 'no-store',
    });
    if (res.ok) return true;
    console.error(`[tasks] attachment upload failed for task ${taskId}: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`);
  } catch (e) {
    console.error(`[tasks] attachment upload error for task ${taskId}:`, e);
  }
  return false;
}

/**
 * The popup/page "Create Task" form. Department is never asked and never required. Creator is always the
 * logged-in user (the API sets it). Reuses the existing create -> open ->
 * assign chain and the new attachment endpoint; does not redirect, so the
 * popup can close and the page refresh.
 */
export async function createSimpleTaskAction(formData: FormData): Promise<CreateTaskResult> {
  const title = (formData.get('title') as string | null)?.trim() ?? '';
  const description = (formData.get('description') as string | null)?.trim() || null;
  const priority = PRIORITY_FROM_FORM[(formData.get('priority') as string | null) ?? 'NORMAL'] ?? 'MEDIUM';
  const dueDate = (formData.get('dueDate') as string | null) || null;
  const assignedToUserId = (formData.get('assignedToUserId') as string | null) || null;
  const assigneeDepartmentId = (formData.get('assigneeDepartmentId') as string | null) || null;

  const fieldErrors: Record<string, string[]> = {};
  if (!title) fieldErrors['title'] = ['Please enter a task name.'];
  let dueAt: string | null = null;
  if (dueDate) {
    const d = new Date(`${dueDate}T23:59:00`);
    if (isNaN(d.getTime())) fieldErrors['dueDate'] = ['Please choose a valid date.'];
    else dueAt = d.toISOString();
  }
  if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors };

  let token: string | undefined;
  try {
    token = (await cookies()).get('recafco_access')?.value;
  } catch { /* ignore */ }

  // Department is optional. With a selected person it follows that person (none if they have
  // none); with no person it follows the logged-in user. Never an error, never asked for.
  let departmentId: string | null = null;
  if (assignedToUserId) {
    departmentId = assigneeDepartmentId;
  } else {
    const me = await authApi.me(token ?? '').catch(() => null);
    departmentId = me?.ok ? me.data.departmentId : null;
  }

  const body: Record<string, unknown> = { title, priority };
  if (departmentId) body['responsibleDepartmentId'] = departmentId;
  if (description) body['description'] = description;
  if (dueAt) body['dueAt'] = dueAt;

  const res = await fetch(`${API_BASE}/factory-tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    let message = 'Could not create the task. Please try again.';
    try {
      const json = (await res.json()) as { error?: { message?: string } };
      message = json.error?.message ?? message;
    } catch { /* ignore */ }
    return { error: message };
  }
  const taskId = ((await res.json()) as { data: { id: string } }).data.id;

  const problems: string[] = [];
  if (assignedToUserId) {
    // A new task starts as a draft; the existing lifecycle needs it opened before it can be assigned.
    const opened = await actionFetch(`/factory-tasks/${taskId}/open`, 'POST').catch(() => ({ ok: false, message: undefined as string | undefined }));
    const assigned = opened.ok
      ? await actionFetch(`/factory-tasks/${taskId}/assign`, 'POST', { assignedToUserId }).catch(() => ({ ok: false, message: undefined as string | undefined }))
      : opened;
    if (!assigned.ok) {
      console.error(`[tasks] assigning new task ${taskId} failed: ${assigned.message ?? 'no message'}`);
      problems.push('it could not be assigned');
    }
  }

  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  let failedFiles = 0;
  for (const file of files) {
    if (!(await uploadTaskAttachment(taskId, token, file))) failedFiles += 1;
  }

  revalidatePath('/factory-tasks');
  revalidatePath('/factory-tasks/executive');
  revalidatePath('/dashboard');

  const warnings: string[] = [];
  if (problems.length > 0) warnings.push('Task was created, but it could not be assigned. Please try again.');
  if (failedFiles > 0) {
    warnings.push(
      failedFiles === 1
        ? 'Task was created, but one file could not be uploaded. Please open the task and upload it again.'
        : `Task was created, but ${failedFiles} files could not be uploaded. Please open the task and upload them again.`,
    );
  }
  return warnings.length > 0 ? { error: null, taskId, warning: warnings.join(' ') } : { error: null, taskId };
}

/** Type-ahead for the Assign To picker (name, username, email or employee number). */
export async function searchPeopleAction(query: string): Promise<PersonRef[]> {
  const result = await apiFetchResultPeople(query);
  return result;
}

async function apiFetchResultPeople(query: string): Promise<PersonRef[]> {
  let token: string | undefined;
  try {
    token = (await cookies()).get('recafco_access')?.value;
  } catch { /* ignore */ }
  try {
    const res = await fetch(`${API_BASE}/factory-tasks/people${query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { data: PersonRef[] }).data;
  } catch {
    return [];
  }
}

/** Adds files to an existing task (task detail page). Never returns technical text. */
export async function uploadTaskFilesAction(taskId: string, formData: FormData): Promise<ActionResult> {
  let token: string | undefined;
  try {
    token = (await cookies()).get('recafco_access')?.value;
  } catch { /* ignore */ }
  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: 'Please choose a file.' };
  let failed = 0;
  for (const file of files) {
    if (!(await uploadTaskAttachment(taskId, token, file))) failed += 1;
  }
  revalidatePath(`/factory-tasks/${taskId}`);
  if (failed > 0) return { error: failed === 1 ? 'File could not be uploaded. Please try again.' : `${failed} files could not be uploaded. Please try again.` };
  return { error: null };
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
  if (result.ok) goToTask(taskId);
  return { error: result.message ?? 'Failed to update task' };
}

// ---------------------------------------------------------------------------
// Open (DRAFT → OPEN)
// ---------------------------------------------------------------------------

export async function openTaskAction(taskId: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/open`, 'POST');
  if (result.ok) return finishTaskChange();
  return { error: result.message ?? 'Failed to open task' };
}

// ---------------------------------------------------------------------------
// Assign / Unassign
// ---------------------------------------------------------------------------

export async function assignTaskAction(taskId: string, assignedToUserId: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/assign`, 'POST', { assignedToUserId });
  if (result.ok) return finishTaskChange();
  return { error: result.message ?? 'Failed to assign task' };
}

export async function unassignTaskAction(taskId: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/unassign`, 'POST');
  if (result.ok) return finishTaskChange();
  return { error: result.message ?? 'Failed to unassign task' };
}

// ---------------------------------------------------------------------------
// Start (ASSIGNED → IN_PROGRESS)
// ---------------------------------------------------------------------------

export async function startTaskAction(taskId: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/start`, 'POST');
  if (result.ok) return finishTaskChange();
  return { error: result.message ?? 'Failed to start task' };
}

// ---------------------------------------------------------------------------
// Block / Unblock
// ---------------------------------------------------------------------------

export async function blockTaskAction(taskId: string, blockedReason: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/block`, 'POST', { blockedReason });
  if (result.ok) return finishTaskChange();
  return { error: result.message ?? 'Failed to block task' };
}

export async function unblockTaskAction(taskId: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/unblock`, 'POST');
  if (result.ok) return finishTaskChange();
  return { error: result.message ?? 'Failed to unblock task' };
}

// ---------------------------------------------------------------------------
// Complete (IN_PROGRESS → COMPLETED)
// ---------------------------------------------------------------------------

export async function completeTaskAction(taskId: string, completionSummary: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/complete`, 'POST', { completionSummary });
  if (result.ok) return finishTaskChange();
  return { error: result.message ?? 'Failed to complete task' };
}

// ---------------------------------------------------------------------------
// Close (COMPLETED → CLOSED)
// ---------------------------------------------------------------------------

export async function closeTaskAction(taskId: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/close`, 'POST');
  if (result.ok) return finishTaskChange();
  return { error: result.message ?? 'Failed to close task' };
}

// ---------------------------------------------------------------------------
// Reopen (COMPLETED/CLOSED/CANCELLED → OPEN)
// ---------------------------------------------------------------------------

export async function reopenTaskAction(taskId: string, reason: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/reopen`, 'POST', { reason });
  if (result.ok) return finishTaskChange();
  return { error: result.message ?? 'Failed to reopen task' };
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export async function cancelTaskAction(taskId: string, reason: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/cancel`, 'POST', { reason });
  if (result.ok) return finishTaskChange();
  return { error: result.message ?? 'Failed to cancel task' };
}

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

export async function updatePriorityAction(taskId: string, priority: string): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/priority`, 'PATCH', { priority });
  if (result.ok) return finishTaskChange();
  return { error: result.message ?? 'Failed to update priority' };
}

// ---------------------------------------------------------------------------
// Due date
// ---------------------------------------------------------------------------

export async function updateDueDateAction(taskId: string, dueAt: string | null): Promise<ActionResult> {
  const result = await actionFetch(`/factory-tasks/${taskId}/due-date`, 'PATCH', { dueAt });
  if (result.ok) return finishTaskChange();
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

  if (!note) return { error: null, fieldErrors: { note: ['Please write a progress note.'] } };

  const body: Record<string, unknown> = { note };
  if (progressPercent !== undefined && !isNaN(progressPercent)) body['progressPercent'] = progressPercent;

  const result = await actionFetch(`/factory-tasks/${taskId}/progress`, 'POST', body);
  if (result.ok) return finishTaskChange();
  return { error: result.message ?? 'Progress could not be saved. Please try again.' };
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
  if (!body) return { error: null, fieldErrors: { body: ['Please write a comment.'] } };

  const result = await actionFetch(`/factory-tasks/${taskId}/comments`, 'POST', { body });
  if (result.ok) return finishTaskChange();
  return { error: result.message ?? 'Failed to post comment' };
}
