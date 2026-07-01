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
  openActionCount?: number;
}

// ---------------------------------------------------------------------------
// Internal fetch helper for server actions
// ---------------------------------------------------------------------------

async function actionFetch(
  path: string,
  method: string,
  body?: unknown,
): Promise<{ ok: boolean; code?: string; message?: string; openActionCount?: number }> {
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
  let openActionCount: number | undefined;

  try {
    const json = (await res.json()) as {
      error?: { code?: string; message?: string };
      data?: { openActionCount?: number };
    };
    code = json.error?.code;
    message = json.error?.message;
    // The API embeds open action count in the error for INCIDENT_OPEN_ACTIONS
    if (code === 'INCIDENT_OPEN_ACTIONS') {
      const match = message?.match(/(\d+)/);
      const raw = match?.[1];
      if (raw !== undefined) openActionCount = parseInt(raw, 10);
    }
  } catch {
    message = `HTTP ${res.status}`;
  }

  return {
    ok: false,
    ...(code !== undefined ? { code } : {}),
    ...(message !== undefined ? { message } : {}),
    ...(openActionCount !== undefined ? { openActionCount } : {}),
  };
}

// ---------------------------------------------------------------------------
// Create incident
// ---------------------------------------------------------------------------

export async function createIncidentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();
  const severity = formData.get('severity') as string;
  const occurredAt = formData.get('occurredAt') as string;
  const immediateAction = (formData.get('immediateAction') as string | null)?.trim() || null;
  const reportedForUserId = (formData.get('reportedForUserId') as string | null) || null;
  const affectedPlantId = (formData.get('affectedPlantId') as string | null) || null;
  const affectedLocationId = (formData.get('affectedLocationId') as string | null) || null;
  const affectedDepartmentId = (formData.get('affectedDepartmentId') as string | null) || null;

  const body: Record<string, unknown> = { title, description, severity, occurredAt };
  if (immediateAction) body['immediateAction'] = immediateAction;
  if (reportedForUserId) body['reportedForUserId'] = reportedForUserId;
  if (affectedPlantId) body['affectedPlantId'] = affectedPlantId;
  if (affectedLocationId) body['affectedLocationId'] = affectedLocationId;
  if (affectedDepartmentId) body['affectedDepartmentId'] = affectedDepartmentId;

  // Validate required fields client-side before API call
  const fieldErrors: Record<string, string[]> = {};
  if (!title) fieldErrors['title'] = ['Title is required'];
  if (!description) fieldErrors['description'] = ['Description is required'];
  if (!severity) fieldErrors['severity'] = ['Severity is required'];
  if (!occurredAt) fieldErrors['occurredAt'] = ['Date and time of occurrence is required'];
  if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors };

  let token: string | undefined;
  try {
    const store = await cookies();
    token = store.get('recafco_access')?.value;
  } catch { /* ignore */ }

  const res = await fetch(`${API_BASE}/incidents`, {
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
    redirect(`/incidents/${json.data.id}`);
  }

  let message = 'Failed to create incident';
  try {
    const json = (await res.json()) as { error?: { message?: string; code?: string } };
    if (json.error?.code === 'VALIDATION_ERROR') {
      return { error: json.error.message ?? message };
    }
    message = json.error?.message ?? message;
  } catch { /* ignore */ }

  return { error: message };
}

// ---------------------------------------------------------------------------
// Update own DRAFT
// ---------------------------------------------------------------------------

export async function updateDraftAction(
  incidentId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body: Record<string, unknown> = {};
  const title = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();
  const severity = formData.get('severity') as string | null;
  const occurredAt = formData.get('occurredAt') as string | null;
  const immediateAction = (formData.get('immediateAction') as string | null)?.trim();

  if (title) body['title'] = title;
  if (description) body['description'] = description;
  if (severity) body['severity'] = severity;
  if (occurredAt) body['occurredAt'] = occurredAt;
  if (immediateAction !== null) body['immediateAction'] = immediateAction || null;

  const result = await actionFetch(`/incidents/${incidentId}`, 'PATCH', body);
  if (result.ok) redirect(`/incidents/${incidentId}`);
  return { error: result.message ?? 'Failed to update incident' };
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

export async function submitIncidentAction(incidentId: string): Promise<ActionResult> {
  const result = await actionFetch(`/incidents/${incidentId}/submit`, 'POST');
  if (result.ok) redirect(`/incidents/${incidentId}`);
  return { error: result.message ?? 'Failed to submit incident' };
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export async function startReviewAction(incidentId: string): Promise<ActionResult> {
  const result = await actionFetch(`/incidents/${incidentId}/start-review`, 'POST');
  if (result.ok) redirect(`/incidents/${incidentId}`);
  return { error: result.message ?? 'Failed to start review' };
}

export async function assignAction(incidentId: string, assignedToUserId: string): Promise<ActionResult> {
  const result = await actionFetch(`/incidents/${incidentId}/assign`, 'POST', { assignedToUserId });
  if (result.ok) redirect(`/incidents/${incidentId}`);
  return { error: result.message ?? 'Failed to assign' };
}

export async function beginInvestigationAction(incidentId: string): Promise<ActionResult> {
  const result = await actionFetch(`/incidents/${incidentId}/begin-investigation`, 'POST');
  if (result.ok) redirect(`/incidents/${incidentId}`);
  return { error: result.message ?? 'Failed to begin investigation' };
}

export async function requestActionsAction(incidentId: string): Promise<ActionResult> {
  const result = await actionFetch(`/incidents/${incidentId}/request-actions`, 'POST');
  if (result.ok) redirect(`/incidents/${incidentId}`);
  return { error: result.message ?? 'Failed to request actions' };
}

export async function resolveIncidentAction(
  incidentId: string,
  resolutionSummary: string,
  confirmOpenActions: boolean,
): Promise<ActionResult> {
  const result = await actionFetch(`/incidents/${incidentId}/resolve`, 'POST', {
    resolutionSummary,
    confirmOpenActions,
  });
  if (result.ok) redirect(`/incidents/${incidentId}`);
  if (result.code === 'INCIDENT_OPEN_ACTIONS') {
    return {
      error: result.message ?? 'Open actions exist',
      ...(result.openActionCount !== undefined ? { openActionCount: result.openActionCount } : {}),
    };
  }
  return { error: result.message ?? 'Failed to resolve' };
}

export async function closeIncidentAction(incidentId: string): Promise<ActionResult> {
  const result = await actionFetch(`/incidents/${incidentId}/close`, 'POST');
  if (result.ok) redirect(`/incidents/${incidentId}`);
  return { error: result.message ?? 'Failed to close' };
}

export async function cancelIncidentAction(incidentId: string, reason?: string): Promise<ActionResult> {
  const result = await actionFetch(`/incidents/${incidentId}/cancel`, 'POST', { reason: reason ?? null });
  if (result.ok) redirect(`/incidents/${incidentId}`);
  return { error: result.message ?? 'Failed to cancel' };
}

export async function reopenIncidentAction(incidentId: string, reason: string): Promise<ActionResult> {
  const result = await actionFetch(`/incidents/${incidentId}/reopen`, 'POST', { reason });
  if (result.ok) redirect(`/incidents/${incidentId}`);
  return { error: result.message ?? 'Failed to reopen' };
}

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------

export async function updateSeverityAction(incidentId: string, severity: string): Promise<ActionResult> {
  const result = await actionFetch(`/incidents/${incidentId}/severity`, 'PATCH', { severity });
  if (result.ok) redirect(`/incidents/${incidentId}`);
  return { error: result.message ?? 'Failed to update severity' };
}

// ---------------------------------------------------------------------------
// Investigation fields
// ---------------------------------------------------------------------------

export async function updateInvestigationAction(
  incidentId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const rootCause = (formData.get('rootCause') as string | null)?.trim();
  const investigationSummary = (formData.get('investigationSummary') as string | null)?.trim();

  const result = await actionFetch(`/incidents/${incidentId}/investigation`, 'PATCH', {
    rootCause: rootCause || null,
    investigationSummary: investigationSummary || null,
  });
  if (result.ok) redirect(`/incidents/${incidentId}`);
  return { error: result.message ?? 'Failed to save investigation' };
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function addCommentAction(
  incidentId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = (formData.get('body') as string)?.trim();
  if (!body) return { error: null, fieldErrors: { body: ['Comment cannot be empty'] } };

  const result = await actionFetch(`/incidents/${incidentId}/comments`, 'POST', { body });
  if (result.ok) redirect(`/incidents/${incidentId}#comments`);
  return { error: result.message ?? 'Failed to post comment' };
}

// ---------------------------------------------------------------------------
// Corrective actions
// ---------------------------------------------------------------------------

export async function addActionItemAction(
  incidentId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string | null)?.trim();
  const assignedToUserId = (formData.get('assignedToUserId') as string | null) || null;
  const dueDate = (formData.get('dueDate') as string | null) || null;

  if (!title) return { error: null, fieldErrors: { title: ['Title is required'] } };

  const body: Record<string, unknown> = { title };
  if (description) body['description'] = description;
  if (assignedToUserId) body['assignedToUserId'] = assignedToUserId;
  if (dueDate) body['dueDate'] = dueDate;

  const result = await actionFetch(`/incidents/${incidentId}/actions`, 'POST', body);
  if (result.ok) redirect(`/incidents/${incidentId}#actions`);
  return { error: result.message ?? 'Failed to add action' };
}

export async function updateActionItemStatusAction(
  incidentId: string,
  actionId: string,
  status: string,
): Promise<ActionResult> {
  const result = await actionFetch(`/incidents/${incidentId}/actions/${actionId}`, 'PATCH', { status });
  if (result.ok) redirect(`/incidents/${incidentId}#actions`);
  return { error: result.message ?? 'Failed to update action' };
}
