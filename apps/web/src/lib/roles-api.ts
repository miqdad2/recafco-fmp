// Server-side only — never import from client components.

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

export interface RoleSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionSummary {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
}

type ApiOk<T> = { data: T; meta: { requestId?: string }; error: null };
type ApiErr = { data: null; meta: { requestId?: string }; error: { code: string; message: string } };

async function apiFetch<T>(
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

export const rolesApi = {
  list: (accessToken: string) =>
    apiFetch<RoleSummary[]>('/administration/roles', accessToken),

  get: (accessToken: string, id: string) =>
    apiFetch<RoleSummary & { permissions: PermissionSummary[] }>(`/administration/roles/${id}`, accessToken),

  listPermissions: (accessToken: string) =>
    apiFetch<PermissionSummary[]>('/administration/roles/permissions', accessToken),
};
