// Server-side only — never import from client components.

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
}

type ApiOk<T> = { data: T; meta: { requestId?: string }; error: null };
type ApiErr = { data: null; meta: { requestId?: string }; error: { code: string; message: string } };

async function apiPost<T>(
  path: string,
  body: unknown,
  accessToken?: string,
): Promise<{ ok: true; data: T } | { ok: false; code: string; message: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    cache: 'no-store',
  });

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
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  const json = (await res.json()) as ApiOk<T> | ApiErr;
  if (!res.ok || json.error !== null) {
    const err = (json as ApiErr).error;
    return { ok: false, code: err?.code ?? 'UNKNOWN', message: err?.message ?? `HTTP ${res.status}` };
  }
  return { ok: true, data: (json as ApiOk<T>).data };
}

export const authApi = {
  login: (username: string, password: string) =>
    apiPost<LoginResult>('/auth/login', { username, password }),

  refresh: (refreshToken: string) =>
    apiPost<LoginResult>('/auth/refresh', { refreshToken }),

  logout: (refreshToken: string) =>
    apiPost<null>('/auth/logout', { refreshToken }),

  me: (accessToken: string) =>
    apiGet<UserProfile>('/auth/me', accessToken),

  changePassword: (accessToken: string, currentPassword: string, newPassword: string) =>
    apiPost<null>('/auth/change-password', { currentPassword, newPassword }, accessToken),
};
