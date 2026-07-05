'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { OrgEntityFormState } from '../_components/org-entity-form';
import type { DependencyCheck } from '@/lib/organizations-api';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

type ApiError = { error: { code: string; message: string; details?: { fields?: Record<string, string[]> } } };

export type LifecycleActionResult = { error?: string };

async function getToken(): Promise<string> {
  const store = await cookies();
  const token = store.get('recafco_access')?.value;
  if (!token) redirect('/login');
  return token;
}

async function postJson(url: string, body: unknown, method = 'POST'): Promise<Response> {
  const store = await cookies();
  const token = store.get('recafco_access')?.value;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { method, headers, body: JSON.stringify(body), cache: 'no-store' });
}

export async function createDepartmentAction(
  _prev: OrgEntityFormState | null,
  formData: FormData,
): Promise<OrgEntityFormState | null> {
  const code = formData.get('code')?.toString().trim().toUpperCase();
  const name = formData.get('name')?.toString().trim();
  const description = formData.get('description')?.toString().trim() || undefined;

  const res = await postJson(`${API_BASE}/organizations/departments`, { code, name, description });
  if (res.ok) {
    redirect('/administration/departments');
  }

  const body = (await res.json()) as ApiError;
  if (body.error.code === 'VALIDATION_ERROR') {
    return { fieldErrors: body.error.details?.fields ?? {} };
  }
  return { error: body.error.message };
}

export async function updateDepartmentAction(
  id: string,
  _prev: OrgEntityFormState | null,
  formData: FormData,
): Promise<OrgEntityFormState | null> {
  const name = formData.get('name')?.toString().trim();
  const description = formData.get('description')?.toString().trim() || undefined;

  const res = await postJson(`${API_BASE}/organizations/departments/${id}`, { name, description }, 'PATCH');
  if (res.ok) {
    redirect('/administration/departments');
  }

  const body = (await res.json()) as ApiError;
  if (body.error.code === 'VALIDATION_ERROR') {
    return { fieldErrors: body.error.details?.fields ?? {} };
  }
  return { error: body.error.message };
}

export async function activateDepartmentAction(id: string): Promise<LifecycleActionResult> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/organizations/departments/${id}/activate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const b = (await res.json()) as ApiError;
    return { error: b.error?.message ?? 'Failed to activate' };
  }
  revalidatePath('/administration/departments');
  return {};
}

export async function deactivateDepartmentAction(id: string): Promise<LifecycleActionResult> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/organizations/departments/${id}/deactivate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const b = (await res.json()) as ApiError;
    return { error: b.error?.message ?? 'Failed to deactivate' };
  }
  revalidatePath('/administration/departments');
  return {};
}

export async function archiveDepartmentAction(id: string): Promise<LifecycleActionResult> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/organizations/departments/${id}/archive`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const b = (await res.json()) as ApiError;
    return { error: b.error?.message ?? 'Failed to archive' };
  }
  revalidatePath('/administration/departments');
  return {};
}

export async function getDepartmentDependenciesAction(id: string): Promise<DependencyCheck | { error: string }> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/organizations/departments/${id}/dependencies`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const b = (await res.json()) as ApiError;
    return { error: b.error?.message ?? 'Failed to check dependencies' };
  }
  const json = (await res.json()) as { data: DependencyCheck };
  return json.data;
}

export async function deleteDepartmentAction(id: string): Promise<LifecycleActionResult> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/organizations/departments/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 204) {
    revalidatePath('/administration/departments');
    return {};
  }
  if (!res.ok) {
    const b = (await res.json()) as ApiError;
    return { error: b.error?.message ?? 'Cannot delete this department' };
  }
  revalidatePath('/administration/departments');
  return {};
}
