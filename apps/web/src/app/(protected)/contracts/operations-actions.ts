'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import type { OperationsActionResult, RefreshResult } from '@/lib/operations-api';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// FMP-OPS-01 — server actions for the Operations screens. They call FMP's own API only (never the external
// Operations system), always as the signed-in user, so the API's permission and department checks apply.

interface Envelope<T> {
  data?: T | null;
  error?: { message?: string } | null;
}

async function call<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<{ ok: true; data: T | null } | { ok: false; error: string }> {
  let token: string | undefined;
  try {
    token = (await cookies()).get('recafco_access')?.value;
  } catch {
    token = undefined;
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json()) as Envelope<T>;
    if (!res.ok || json.error) return { ok: false, error: json.error?.message ?? 'The request could not be completed. Please try again.' };
    return { ok: true, data: json.data ?? null };
  } catch {
    return { ok: false, error: 'The request could not be completed. Please try again.' };
  }
}

/** Cheap change-detector polled by open screens. Returns null when FMP could not answer (the screen then stays as it is). */
export async function getOperationsFingerprintAction(contractIds: string[]): Promise<Record<string, string> | null> {
  const ids = contractIds.filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 100);
  if (ids.length === 0) return {};
  let token: string | undefined;
  try {
    token = (await cookies()).get('recafco_access')?.value;
  } catch {
    token = undefined;
  }
  try {
    const res = await fetch(`${API_BASE}/operations-source/monitoring/fingerprint?ids=${ids.join(',')}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const json = (await res.json()) as Envelope<Record<string, string>>;
    return res.ok && !json.error ? (json.data ?? {}) : null;
  } catch {
    return null;
  }
}

export async function requestOperationsRefreshAction(contractId: string): Promise<OperationsActionResult> {
  const r = await call<RefreshResult>(`/contracts/${encodeURIComponent(contractId)}/operations-progress/refresh`, 'POST');
  if (!r.ok) return { error: r.error };
  revalidatePath(`/contracts/${contractId}/operations`);
  return { error: null, message: r.data?.message ?? 'Refresh requested.' };
}

export async function linkOperationsProjectByIdAction(contractId: string, sourceProjectId: string, reason = ''): Promise<OperationsActionResult> {
  const id = sourceProjectId.trim();
  if (id === '') return { error: 'Enter the Operations project id.' };
  // The API requires a reason whenever the link has no automatic basis (job order and mapped factory confirmed).
  const r = await call<{ id: string }>('/operations-source/projects', 'POST', { sourceProjectId: id, contractId, ...(reason.trim() !== '' ? { reason: reason.trim() } : {}) });
  if (!r.ok) return { error: r.error };
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath(`/contracts/${contractId}/operations`);
  revalidatePath('/contracts/operations-links');
  return { error: null, message: 'Linked. Figures appear after the first background update.' };
}

export async function confirmOperationsLinkAction(projectId: string, contractId: string, reason = ''): Promise<OperationsActionResult> {
  const r = await call<{ id: string }>(`/operations-source/projects/${encodeURIComponent(projectId)}/link`, 'PUT', { contractId, ...(reason.trim() !== '' ? { reason: reason.trim() } : {}) });
  if (!r.ok) return { error: r.error };
  revalidatePath('/contracts/operations-links');
  revalidatePath(`/contracts/${contractId}/operations`);
  return { error: null, message: 'Link confirmed.' };
}

export async function removeOperationsLinkAction(projectId: string, contractId: string | null, reason: string): Promise<OperationsActionResult> {
  if (reason.trim() === '') return { error: 'Please give a reason for removing the link.' };
  const r = await call<{ id: string }>(`/operations-source/projects/${encodeURIComponent(projectId)}/unlink`, 'POST', { reason: reason.trim() });
  if (!r.ok) return { error: r.error };
  revalidatePath('/contracts/operations-links');
  if (contractId) {
    revalidatePath(`/contracts/${contractId}`);
    revalidatePath(`/contracts/${contractId}/operations`);
  }
  return { error: null, message: 'Link removed. Stored figures are kept for the record.' };
}

export async function registerOperationsProjectAction(sourceProjectId: string): Promise<OperationsActionResult> {
  const id = sourceProjectId.trim();
  if (id === '') return { error: 'Enter the Operations project id.' };
  const r = await call<{ id: string; created: boolean }>('/operations-source/projects', 'POST', { sourceProjectId: id });
  if (!r.ok) return { error: r.error };
  revalidatePath('/contracts/operations-links');
  return { error: null, message: r.data?.created === false ? 'That project is already registered.' : 'Project registered. Its job order appears after the first background update.' };
}

export async function setFactoryMappingAction(factoryCode: string, plantId: string): Promise<OperationsActionResult> {
  if (factoryCode.trim() === '' || plantId === '') return { error: 'Choose a factory code and a plant.' };
  const r = await call<{ id: string }>('/operations-source/factory-mappings', 'PUT', { factoryCode, plantId });
  if (!r.ok) return { error: r.error };
  revalidatePath('/contracts/operations-links');
  return { error: null, message: 'Factory mapping saved.' };
}

export async function deleteFactoryMappingAction(id: string): Promise<OperationsActionResult> {
  const r = await call<{ id: string }>(`/operations-source/factory-mappings/${encodeURIComponent(id)}`, 'DELETE');
  if (!r.ok) return { error: r.error };
  revalidatePath('/contracts/operations-links');
  return { error: null, message: 'Factory mapping removed.' };
}
