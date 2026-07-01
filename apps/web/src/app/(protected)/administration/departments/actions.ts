'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { OrgEntityFormState } from '../_components/org-entity-form';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

type ApiError = { error: { code: string; message: string; details?: { fields?: Record<string, string[]> } } };

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
