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
      const id = json.data?.id;
      return id !== undefined ? { ok: true, id } : { ok: true };
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
// Create contract
// ---------------------------------------------------------------------------

export async function createContractAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get('title') as string)?.trim();
  const counterpartyName = (formData.get('counterpartyName') as string)?.trim();

  if (!title) return { error: 'Title is required' };
  if (!counterpartyName) return { error: 'Counterparty name is required' };

  const description = (formData.get('description') as string | null)?.trim() || undefined;
  const counterpartyContact = (formData.get('counterpartyContact') as string | null)?.trim() || undefined;
  const contractValueRaw = (formData.get('contractValue') as string | null)?.trim();
  const contractValue = contractValueRaw ? parseFloat(contractValueRaw) : undefined;
  const currency = (formData.get('currency') as string | null)?.trim() || undefined;
  const startDate = (formData.get('startDate') as string | null) || undefined;
  const endDate = (formData.get('endDate') as string | null) || undefined;
  const renewalNoticeDate = (formData.get('renewalNoticeDate') as string | null) || undefined;
  const ownerUserId = (formData.get('ownerUserId') as string | null) || undefined;
  const departmentId = (formData.get('departmentId') as string | null) || undefined;
  const plantId = (formData.get('plantId') as string | null) || undefined;
  const locationId = (formData.get('locationId') as string | null) || undefined;
  const notes = (formData.get('notes') as string | null)?.trim() || undefined;

  const result = await actionFetch('/contracts', 'POST', {
    title,
    counterpartyName,
    ...(description !== undefined ? { description } : {}),
    ...(counterpartyContact !== undefined ? { counterpartyContact } : {}),
    ...(contractValue !== undefined && !isNaN(contractValue) ? { contractValue } : {}),
    ...(currency !== undefined ? { currency } : {}),
    ...(startDate !== undefined ? { startDate } : {}),
    ...(endDate !== undefined ? { endDate } : {}),
    ...(renewalNoticeDate !== undefined ? { renewalNoticeDate } : {}),
    ...(ownerUserId !== undefined ? { ownerUserId } : {}),
    ...(departmentId !== undefined ? { departmentId } : {}),
    ...(plantId !== undefined ? { plantId } : {}),
    ...(locationId !== undefined ? { locationId } : {}),
    ...(notes !== undefined ? { notes } : {}),
  });

  if (!result.ok) return { error: result.message ?? 'Failed to create contract' };

  revalidatePath('/contracts');
  if (result.id) {
    redirect(`/contracts/${result.id}`);
  }
  redirect('/contracts');
}

// ---------------------------------------------------------------------------
// Update contract
// ---------------------------------------------------------------------------

export async function updateContractAction(
  contractId: string,
  version: number,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get('title') as string | null)?.trim() || undefined;
  const counterpartyName = (formData.get('counterpartyName') as string | null)?.trim() || undefined;
  const description = (formData.get('description') as string | null)?.trim() || undefined;
  const counterpartyContact = (formData.get('counterpartyContact') as string | null)?.trim() || undefined;
  const contractValueRaw = (formData.get('contractValue') as string | null)?.trim();
  const contractValue = contractValueRaw ? parseFloat(contractValueRaw) : undefined;
  const currency = (formData.get('currency') as string | null)?.trim() || undefined;
  const startDate = (formData.get('startDate') as string | null) || undefined;
  const endDate = (formData.get('endDate') as string | null) || undefined;
  const renewalNoticeDate = (formData.get('renewalNoticeDate') as string | null) || undefined;
  const ownerUserId = (formData.get('ownerUserId') as string | null) || undefined;
  const departmentId = (formData.get('departmentId') as string | null) || undefined;
  const plantId = (formData.get('plantId') as string | null) || undefined;
  const locationId = (formData.get('locationId') as string | null) || undefined;
  const notes = (formData.get('notes') as string | null)?.trim() || undefined;

  const result = await actionFetch(`/contracts/${contractId}`, 'PATCH', {
    version,
    ...(title !== undefined ? { title } : {}),
    ...(counterpartyName !== undefined ? { counterpartyName } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(counterpartyContact !== undefined ? { counterpartyContact } : {}),
    ...(contractValue !== undefined && !isNaN(contractValue) ? { contractValue } : {}),
    ...(currency !== undefined ? { currency } : {}),
    ...(startDate !== undefined ? { startDate } : {}),
    ...(endDate !== undefined ? { endDate } : {}),
    ...(renewalNoticeDate !== undefined ? { renewalNoticeDate } : {}),
    ...(ownerUserId !== undefined ? { ownerUserId } : {}),
    ...(departmentId !== undefined ? { departmentId } : {}),
    ...(plantId !== undefined ? { plantId } : {}),
    ...(locationId !== undefined ? { locationId } : {}),
    ...(notes !== undefined ? { notes } : {}),
  });

  if (!result.ok) return { error: result.message ?? 'Failed to update contract' };

  revalidatePath('/contracts');
  redirect(`/contracts/${contractId}`);
}

// ---------------------------------------------------------------------------
// Activate contract
// ---------------------------------------------------------------------------

export async function activateContractAction(id: string, version: number): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/${id}/activate`, 'POST', { version });
  if (!result.ok) return { error: result.message ?? 'Failed to activate contract' };

  revalidatePath('/contracts');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Terminate contract
// ---------------------------------------------------------------------------

export async function terminateContractAction(
  id: string,
  version: number,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const reason = (formData.get('reason') as string)?.trim();
  if (!reason) return { error: 'Termination reason is required' };

  const result = await actionFetch(`/contracts/${id}/terminate`, 'POST', { reason, version });
  if (!result.ok) return { error: result.message ?? 'Failed to terminate contract' };

  revalidatePath('/contracts');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Close contract
// ---------------------------------------------------------------------------

export async function closeContractAction(id: string, version: number): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/${id}/close`, 'POST', { version });
  if (!result.ok) return { error: result.message ?? 'Failed to close contract' };

  revalidatePath('/contracts');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Add comment
// ---------------------------------------------------------------------------

export async function addContractCommentAction(
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = (formData.get('body') as string)?.trim();
  if (!body) return { error: 'Comment cannot be empty' };

  const result = await actionFetch(`/contracts/${contractId}/comments`, 'POST', { body });
  if (!result.ok) return { error: result.message ?? 'Failed to add comment' };

  revalidatePath('/contracts');
  return { error: null };
}
