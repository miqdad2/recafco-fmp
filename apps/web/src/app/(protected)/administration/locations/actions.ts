'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { LocationFormState } from '../_components/location-form';
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

export async function createLocationAction(
  _prev: LocationFormState | null,
  formData: FormData,
): Promise<LocationFormState | null> {
  const code = formData.get('code')?.toString().trim().toUpperCase();
  const name = formData.get('name')?.toString().trim();
  const description = formData.get('description')?.toString().trim() || undefined;
  const plantIdRaw = formData.get('plantId')?.toString().trim();
  const plantId = plantIdRaw || undefined;

  const res = await postJson(`${API_BASE}/organizations/locations`, { code, name, description, plantId });
  if (res.ok) {
    redirect('/administration/locations');
  }

  const body = (await res.json()) as ApiError;
  if (body.error.code === 'VALIDATION_ERROR') {
    return { fieldErrors: body.error.details?.fields ?? {} };
  }
  return { error: body.error.message };
}

export async function updateLocationAction(
  id: string,
  _prev: LocationFormState | null,
  formData: FormData,
): Promise<LocationFormState | null> {
  const name = formData.get('name')?.toString().trim();
  const description = formData.get('description')?.toString().trim() || undefined;
  const plantIdRaw = formData.get('plantId')?.toString().trim();
  const plantId = plantIdRaw ? plantIdRaw : null;

  const res = await postJson(
    `${API_BASE}/organizations/locations/${id}`,
    { name, description, plantId },
    'PATCH',
  );
  if (res.ok) {
    redirect('/administration/locations');
  }

  const body = (await res.json()) as ApiError;
  if (body.error.code === 'VALIDATION_ERROR') {
    return { fieldErrors: body.error.details?.fields ?? {} };
  }
  return { error: body.error.message };
}

export async function activateLocationAction(id: string): Promise<LifecycleActionResult> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/organizations/locations/${id}/activate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const b = (await res.json()) as ApiError;
    return { error: b.error?.message ?? 'Failed to activate' };
  }
  revalidatePath('/administration/locations');
  return {};
}

export async function deactivateLocationAction(id: string): Promise<LifecycleActionResult> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/organizations/locations/${id}/deactivate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const b = (await res.json()) as ApiError;
    return { error: b.error?.message ?? 'Failed to deactivate' };
  }
  revalidatePath('/administration/locations');
  return {};
}

export async function archiveLocationAction(id: string): Promise<LifecycleActionResult> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/organizations/locations/${id}/archive`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const b = (await res.json()) as ApiError;
    return { error: b.error?.message ?? 'Failed to archive' };
  }
  revalidatePath('/administration/locations');
  return {};
}

export async function getLocationDependenciesAction(id: string): Promise<DependencyCheck | { error: string }> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/organizations/locations/${id}/dependencies`, {
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

export async function deleteLocationAction(id: string): Promise<LifecycleActionResult> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/organizations/locations/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 204) {
    revalidatePath('/administration/locations');
    return {};
  }
  if (!res.ok) {
    const b = (await res.json()) as ApiError;
    return { error: b.error?.message ?? 'Cannot delete this location' };
  }
  revalidatePath('/administration/locations');
  return {};
}
