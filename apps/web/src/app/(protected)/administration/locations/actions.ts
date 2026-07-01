'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { LocationFormState } from '../_components/location-form';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

type ApiError = { error: { code: string; message: string; details?: { fields?: Record<string, string[]> } } };

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
  // Empty string = clear plant association (send null); non-empty = set plant
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
