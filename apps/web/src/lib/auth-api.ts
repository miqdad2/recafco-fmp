// Server-side only — never import from client components.

import { cache } from 'react';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  roleId: string;
  roleCode: string;
  roleName: string;
  permissions: string[];
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  departmentId: string | null;
  plantId: string | null;
  locationId: string | null;
  /** FMP-ACCESS-01 — explicit Full Platform Access display mode (presentation only). */
  fullPlatformAccess?: boolean;
}

type ApiOk<T> = { data: T; meta: { requestId?: string }; error: null };
type ApiErr = { data: null; meta: { requestId?: string }; error: { code: string; message: string } };

// A network-level failure (API unreachable — e.g. mid-startup, briefly down)
// throws from `fetch()` itself, before there's any response to parse. Every
// caller already handles `{ ok: false }` (login shows `result.message`;
// every protected page falls back to `permissions: []` → `notFound()`), so
// catching here turns an unhandled exception (crashing the page/action)
// into the same clean, already-handled failure path instead.
function networkErrorResult(error: unknown): { ok: false; code: string; message: string } {
  return {
    ok: false,
    code: 'NETWORK_ERROR',
    message: error instanceof Error ? error.message : 'Unable to reach the server. Please try again.',
  };
}

async function apiPost<T>(
  path: string,
  body: unknown,
  accessToken?: string,
): Promise<{ ok: true; data: T } | { ok: false; code: string; message: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch (error) {
    return networkErrorResult(error);
  }

  const json = (await res.json()) as ApiOk<T> | ApiErr;
  if (!res.ok || json.error !== null) {
    const err = (json as ApiErr).error;
    return { ok: false, code: err?.code ?? 'UNKNOWN', message: err?.message ?? `HTTP ${res.status}` };
  }
  return { ok: true, data: (json as ApiOk<T>).data };
}

async function apiGet<T>(
  path: string,
  accessToken: string,
): Promise<{ ok: true; data: T } | { ok: false; code: string; message: string }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
  } catch (error) {
    return networkErrorResult(error);
  }

  const json = (await res.json()) as ApiOk<T> | ApiErr;
  if (!res.ok || json.error !== null) {
    const err = (json as ApiErr).error;
    return { ok: false, code: err?.code ?? 'UNKNOWN', message: err?.message ?? `HTTP ${res.status}` };
  }
  return { ok: true, data: (json as ApiOk<T>).data };
}

// FMP-PERF-01 — every protected layout/page independently calls `authApi.me`
// to resolve the current user's permissions (there is no shared request
// context to pass it down through). `cache()` (React's per-request
// memoization) makes repeated calls with the same access token within one
// server render resolve to a single underlying `/auth/me` network+DB call
// instead of one per caller, with no change to the returned data, staleness
// window, or the backend's own live permission recomputation.
const getCurrentUser = cache((accessToken: string) => apiGet<UserProfile>('/auth/me', accessToken));

export const authApi = {
  login: (username: string, password: string) =>
    apiPost<LoginResult>('/auth/login', { username, password }),

  refresh: (refreshToken: string) =>
    apiPost<LoginResult>('/auth/refresh', { refreshToken }),

  logout: (refreshToken: string) =>
    apiPost<null>('/auth/logout', { refreshToken }),

  me: getCurrentUser,

  changePassword: (accessToken: string, currentPassword: string, newPassword: string) =>
    apiPost<null>('/auth/change-password', { currentPassword, newPassword }, accessToken),
};
