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
    const incidentId = json.data.id;

    // FMP-INC-01C — evidence files staged on the CREATE form (optional;
    // none is a completely normal, successful case) are only ever
    // uploaded AFTER the incident itself is confirmed created, using its
    // real id — never before, and never at all if creation itself
    // failed (this whole block is unreachable on that path). Each file
    // reuses the exact same real upload path
    // (`uploadIncidentAttachment` → `POST /incidents/:id/attachments`)
    // the Incident Detail page's own "Upload Evidence" button already
    // uses — no duplicated or fake upload logic. A failure on one or
    // more files never fails incident creation itself or crashes this
    // action — the incident stays created, and any failures are
    // summarized in a query param the detail page reads and displays as
    // a real, visible warning (see `[id]/page.tsx`).
    const evidenceFiles = formData.getAll('evidenceFiles').filter((f): f is File => f instanceof File && f.size > 0);
    const evidenceFailures: string[] = [];
    for (const file of evidenceFiles) {
      const result = await uploadIncidentAttachment(incidentId, file);
      if (result.error) evidenceFailures.push(`${file.name}: ${result.error}`);
    }

    // FMP-UI-22 — the new incident is created; make sure the list, the
    // dashboard, and the platform dashboard (which also shows incident
    // counts, gated on incidents.read) all show it on next visit rather
    // than a stale Router Cache entry from before this incident existed.
    revalidatePath('/incidents');
    revalidatePath('/incidents/executive');
    revalidatePath(`/incidents/${incidentId}`);
    revalidatePath('/dashboard');

    if (evidenceFailures.length > 0) {
      redirect(`/incidents/${incidentId}?evidenceIssue=${encodeURIComponent(evidenceFailures.join(' · '))}`);
    }
    redirect(`/incidents/${incidentId}`);
  }

  let message = 'Failed to create incident';
  try {
    const json = (await res.json()) as { error?: { message?: string; code?: string } };
    // FMP-INC-01D — the backend's real, still-enforced rejection
    // (`INCIDENT_OCCURRED_IN_FUTURE`, see `IncidentsService.validateOccurredAt()`)
    // returns the technical message "occurredAt cannot be in the future".
    // Mapped to the field itself (not just a generic top-of-form banner) so
    // it appears right under the Date and time of occurrence input, same
    // as the other 4 required-field checks above.
    if (json.error?.code === 'INCIDENT_OCCURRED_IN_FUTURE') {
      return { error: null, fieldErrors: { occurredAt: ['Date and time of occurrence cannot be in the future.'] } };
    }
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
  // FMP-INC-01D — same friendly-message mapping as createIncidentAction;
  // editing a DRAFT's occurredAt into the future hits the identical
  // backend rejection.
  if (result.code === 'INCIDENT_OCCURRED_IN_FUTURE') {
    return { error: null, fieldErrors: { occurredAt: ['Date and time of occurrence cannot be in the future.'] } };
  }
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

// ---------------------------------------------------------------------------
// Evidence attachments (FMP-INC-01)
// ---------------------------------------------------------------------------

/**
 * FMP-INC-01 — uploads one evidence file to an incident. Takes a real
 * `File` (not a whole `FormData`/form submission) so the calling client
 * component can loop over several selected files and call this once per
 * file — the backend endpoint (`POST /incidents/:id/attachments`,
 * `FileInterceptor('file')`) only ever accepts one file per request,
 * matching every existing Contract attachment upload endpoint. Does NOT
 * redirect on success (unlike the transition actions above) — the caller
 * uploads a BATCH of files in one UI action and needs to keep going after
 * each individual upload; the caller triggers the page refresh itself
 * once the whole batch finishes.
 */
/**
 * FMP-INC-01C — shared by `uploadAttachmentAction` (detail page's own
 * "Upload Evidence" button) AND `createIncidentAction` (uploading files
 * staged during creation, right after the new incident's id is known).
 * Reuses the exact same real backend endpoint both callers already relied
 * on (`POST /incidents/:id/attachments`, `IncidentsService.createAttachment()`,
 * the SAME storage/validation/activity-logging code from FMP-INC-01) — no
 * new backend code, no duplicated upload logic. Deliberately does NOT
 * `revalidatePath()` itself (unlike the exported action below) — during
 * incident creation, `createIncidentAction` redirects to the new detail
 * page right after, which already forces a fresh render; revalidating
 * per-file inside a loop would be redundant work for no benefit.
 */
async function uploadIncidentAttachment(incidentId: string, file: File): Promise<ActionResult> {
  let token: string | undefined;
  try {
    const store = await cookies();
    token = store.get('recafco_access')?.value;
  } catch {
    // not in request context
  }

  const body = new FormData();
  body.append('file', file, file.name);

  const res = await fetch(`${API_BASE}/incidents/${incidentId}/attachments`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
    cache: 'no-store',
  });

  if (res.ok) return { error: null };

  let message = 'Failed to upload evidence';
  try {
    const json = (await res.json()) as { error?: { message?: string } };
    message = json.error?.message ?? message;
  } catch { /* ignore */ }
  return { error: message };
}

export async function uploadAttachmentAction(incidentId: string, file: File): Promise<ActionResult> {
  const result = await uploadIncidentAttachment(incidentId, file);
  if (!result.error) revalidatePath(`/incidents/${incidentId}`);
  return result;
}

/** FMP-INC-01 — deletes one evidence attachment. Server enforces uploader-or-incidents.manage; see IncidentsService.deleteAttachment's own doc comment. */
export async function deleteAttachmentAction(incidentId: string, attachmentId: string): Promise<ActionResult> {
  const result = await actionFetch(`/incidents/${incidentId}/attachments/${attachmentId}`, 'DELETE');
  if (!result.ok) return { error: result.message ?? 'Failed to delete evidence' };
  revalidatePath(`/incidents/${incidentId}`);
  return { error: null };
}
