const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

export interface OrgEntity {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlantRef {
  id: string;
  code: string;
  name: string;
}

export interface LocationEntity extends OrgEntity {
  plantId: string | null;
  plant: PlantRef | null;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListResponse<T> {
  items: T[];
  pagination: Pagination;
}

export interface ApiResponse<T> {
  data: T;
  meta: { requestId?: string };
  error: null;
}

export interface ApiErrorResponse {
  data: null;
  meta: { requestId?: string };
  error: { code: string; message: string };
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  const body = (await res.json()) as ApiResponse<T> | ApiErrorResponse;
  if (!res.ok || body.error !== null) {
    const err = (body as ApiErrorResponse).error;
    throw new Error(err?.message ?? `API error ${res.status}`);
  }
  return (body as ApiResponse<T>).data;
}

function buildQuery(q: ListQuery & { plantId?: string }): string {
  const params = new URLSearchParams();
  if (q.page !== undefined) params.set('page', String(q.page));
  if (q.pageSize !== undefined) params.set('pageSize', String(q.pageSize));
  if (q.search) params.set('search', q.search);
  if (q.isActive !== undefined) params.set('isActive', String(q.isActive));
  if (q.plantId) params.set('plantId', q.plantId);
  const str = params.toString();
  return str ? `?${str}` : '';
}

// Departments
export const departments = {
  list: (q: ListQuery = {}) =>
    apiFetch<ListResponse<OrgEntity>>(`/organizations/departments${buildQuery(q)}`),
  get: (id: string) => apiFetch<OrgEntity>(`/organizations/departments/${id}`),
  create: (body: { code: string; name: string; description?: string }) =>
    apiFetch<OrgEntity>('/organizations/departments', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<{ code: string; name: string; description: string }>) =>
    apiFetch<OrgEntity>(`/organizations/departments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  activate: (id: string) =>
    apiFetch<OrgEntity>(`/organizations/departments/${id}/activate`, { method: 'POST' }),
  deactivate: (id: string) =>
    apiFetch<OrgEntity>(`/organizations/departments/${id}/deactivate`, { method: 'POST' }),
};

// Plants
export const plants = {
  list: (q: ListQuery = {}) =>
    apiFetch<ListResponse<OrgEntity>>(`/organizations/plants${buildQuery(q)}`),
  get: (id: string) => apiFetch<OrgEntity>(`/organizations/plants/${id}`),
  create: (body: { code: string; name: string; description?: string }) =>
    apiFetch<OrgEntity>('/organizations/plants', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<{ code: string; name: string; description: string }>) =>
    apiFetch<OrgEntity>(`/organizations/plants/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  activate: (id: string) =>
    apiFetch<OrgEntity>(`/organizations/plants/${id}/activate`, { method: 'POST' }),
  deactivate: (id: string) =>
    apiFetch<OrgEntity>(`/organizations/plants/${id}/deactivate`, { method: 'POST' }),
};

// Locations
export const locations = {
  list: (q: ListQuery & { plantId?: string } = {}) =>
    apiFetch<ListResponse<LocationEntity>>(`/organizations/locations${buildQuery(q)}`),
  get: (id: string) => apiFetch<LocationEntity>(`/organizations/locations/${id}`),
  create: (body: { code: string; name: string; description?: string; plantId?: string }) =>
    apiFetch<LocationEntity>('/organizations/locations', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<{ code: string; name: string; description: string; plantId: string | null }>) =>
    apiFetch<LocationEntity>(`/organizations/locations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  activate: (id: string) =>
    apiFetch<LocationEntity>(`/organizations/locations/${id}/activate`, { method: 'POST' }),
  deactivate: (id: string) =>
    apiFetch<LocationEntity>(`/organizations/locations/${id}/deactivate`, { method: 'POST' }),
};
