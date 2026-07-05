// Server-side only — never import from client components.

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  employeeNumber: string | null;
  roleId: string;
  role: { code: string; name: string };
  isActive: boolean;
  mustChangePassword: boolean;
  isLocked: boolean;
  lastLoginAt: string | null;
  departmentId: string | null;
  plantId: string | null;
  locationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserCreatedResult {
  user: UserSummary;
  tempPassword: string;
}

export interface UserListResult {
  items: UserSummary[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface CreateUserPayload {
  username: string;
  displayName: string;
  email?: string;
  employeeNumber?: string;
  roleId?: string;
  departmentId?: string;
  plantId?: string;
  locationId?: string;
}

export interface UpdateUserPayload {
  displayName?: string;
  email?: string;
  employeeNumber?: string;
  departmentId?: string | null;
  plantId?: string | null;
  locationId?: string | null;
}

export type DepartmentAccessScope = 'OWN_DEPARTMENT' | 'SELECTED_DEPARTMENTS' | 'ALL_DEPARTMENTS';

export type ModuleIdentifier =
  | 'FACTORY_TASKS'
  | 'INCIDENT_REPORT'
  | 'MAINTENANCE_REQUESTS'
  | 'SAFETY_COMPLIANCE'
  | 'CONTRACTS_MANAGEMENT'
  | 'PRODUCTION_DASHBOARD'
  | 'ADMINISTRATION';

export interface UserModuleAccessConfig {
  module: ModuleIdentifier;
  scope: DepartmentAccessScope;
  grantedDepartments: { id: string; code: string; name: string }[];
}

export interface SetModuleAccessPayload {
  scope: DepartmentAccessScope;
  departmentIds?: string[];
}

export interface AdminDashboardData {
  scope: { type: DepartmentAccessScope; departmentNames: string[] };
  metrics: {
    totalActiveUsers: number;
    totalInactiveUsers: number;
    totalLockedUsers: number;
    mustChangePassword: number;
  };
  recent: { id: string; referenceNumber: string; title: string; status: string; updatedAt: string }[];
}

type ApiOk<T> = { data: T; meta: { requestId?: string }; error: null };
type ApiErr = { data: null; meta: { requestId?: string }; error: { code: string; message: string } };

async function apiFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; code: string; message: string }> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
    cache: 'no-store',
  });

  const json = (await res.json()) as ApiOk<T> | ApiErr;
  if (!res.ok || json.error !== null) {
    const err = (json as ApiErr).error;
    return { ok: false, code: err?.code ?? 'UNKNOWN', message: err?.message ?? `HTTP ${res.status}` };
  }
  return { ok: true, data: (json as ApiOk<T>).data };
}

export const usersApi = {
  list: (
    accessToken: string,
    q: { page?: number; pageSize?: number; search?: string; isActive?: boolean; roleCode?: string } = {},
  ) => {
    const params = new URLSearchParams();
    if (q.page) params.set('page', String(q.page));
    if (q.pageSize) params.set('pageSize', String(q.pageSize));
    if (q.search) params.set('search', q.search);
    if (q.isActive !== undefined) params.set('isActive', String(q.isActive));
    if (q.roleCode) params.set('roleCode', q.roleCode);
    const qs = params.toString();
    return apiFetch<UserListResult>(`/administration/users${qs ? `?${qs}` : ''}`, accessToken);
  },

  get: (accessToken: string, id: string) =>
    apiFetch<UserSummary>(`/administration/users/${id}`, accessToken),

  create: (accessToken: string, payload: CreateUserPayload) =>
    apiFetch<UserCreatedResult>('/administration/users', accessToken, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (accessToken: string, id: string, payload: UpdateUserPayload) =>
    apiFetch<UserSummary>(`/administration/users/${id}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  assignRole: (accessToken: string, id: string, roleId: string) =>
    apiFetch<UserSummary>(`/administration/users/${id}/role`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ roleId }),
    }),

  activate: (accessToken: string, id: string) =>
    apiFetch<UserSummary>(`/administration/users/${id}/activate`, accessToken, { method: 'POST' }),

  deactivate: (accessToken: string, id: string) =>
    apiFetch<UserSummary>(`/administration/users/${id}/deactivate`, accessToken, { method: 'POST' }),

  resetPassword: (accessToken: string, id: string) =>
    apiFetch<{ tempPassword: string }>(`/administration/users/${id}/reset-password`, accessToken, {
      method: 'POST',
    }),

  unlock: (accessToken: string, id: string) =>
    apiFetch<UserSummary>(`/administration/users/${id}/unlock`, accessToken, { method: 'POST' }),

  getModuleAccess: (accessToken: string, id: string) =>
    apiFetch<UserModuleAccessConfig[]>(`/administration/users/${id}/module-access`, accessToken),

  setModuleAccess: (accessToken: string, id: string, module: ModuleIdentifier, payload: SetModuleAccessPayload) =>
    apiFetch<null>(`/administration/users/${id}/module-access/${module}`, accessToken, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  dashboard: (accessToken: string) =>
    apiFetch<AdminDashboardData>('/administration/users/dashboard', accessToken),
};
