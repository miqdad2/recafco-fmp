import { cookies } from 'next/headers';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type MaintenanceStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_PARTS'
  | 'COMPLETED'
  | 'CLOSED'
  | 'REJECTED'
  | 'CANCELLED';

export interface UserRef {
  id: string;
  displayName: string;
  username: string;
}

export interface OrgRef {
  id: string;
  code: string;
  name: string;
}

export interface MaintenanceRequest {
  id: string;
  referenceNumber: string;
  title: string;
  problemDescription: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  createdByUserId: string;
  requestedByUserId: string;
  assignedToUserId: string | null;
  affectedDepartmentId: string | null;
  plantId: string | null;
  locationId: string | null;
  equipmentDescription: string | null;
  requestedCompletionAt: string | null;
  startedAt: string | null;
  waitingForPartsAt: string | null;
  waitingForPartsReason: string | null;
  completedAt: string | null;
  completedByUserId: string | null;
  completionSummary: string | null;
  closedAt: string | null;
  closedByUserId: string | null;
  rejectedAt: string | null;
  rejectedByUserId: string | null;
  rejectionReason: string | null;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUser: UserRef;
  requestedByUser: UserRef;
  assignedToUser: UserRef | null;
  affectedDepartment: OrgRef | null;
  plant: OrgRef | null;
  location: OrgRef | null;
}

export interface MaintenanceRequestComment {
  id: string;
  requestId: string;
  body: string;
  createdAt: string;
  authorUser: UserRef | null;
}

export interface MaintenanceRequestActivity {
  id: string;
  requestId: string;
  actorUserId: string | null;
  actorName: string | null;
  event: string;
  previousStatus: MaintenanceStatus | null;
  newStatus: MaintenanceStatus | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface MrSummary {
  openRequests: number;
  assignedToMe: number;
  overdueRequests: number;
  waitingForParts: number;
  completedThisMonth: number;
}

export type DashboardScopeType = 'OWN_DEPARTMENT' | 'SELECTED_DEPARTMENTS' | 'ALL_DEPARTMENTS';

export interface MrDashboardData {
  scope: { type: DashboardScopeType; departmentNames: string[] };
  metrics: {
    openRequests: number;
    assignedToMe: number;
    overdueRequests: number;
    waitingForParts: number;
    completedThisMonth: number;
  };
  recent: { id: string; referenceNumber: string; title: string; status: string; updatedAt: string }[];
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

interface ApiResponse<T> {
  data: T;
  meta: { requestId?: string };
  error: null;
}

interface ApiErrorResponse {
  data: null;
  meta: { requestId?: string };
  error: { code: string; message: string };
}

export interface MrApiError {
  code: string;
  message: string;
}

// ---------------------------------------------------------------------------
// apiFetch — auto-reads session cookie (server-side only)
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let authHeader: Record<string, string> = {};
  try {
    const store = await cookies();
    const token = store.get('recafco_access')?.value;
    if (token) authHeader = { Authorization: `Bearer ${token}` };
  } catch {
    // Not in a request context — proceed without auth
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeader, ...init?.headers },
    cache: 'no-store',
  });
  const body = (await res.json()) as ApiResponse<T> | ApiErrorResponse;
  if (!res.ok || body.error !== null) {
    const err = (body as ApiErrorResponse).error;
    throw new Error(err?.message ?? `API error ${res.status}`);
  }
  return (body as ApiResponse<T>).data;
}

// ---------------------------------------------------------------------------
// apiFetchResult — returns { data } or { error } for server actions
// ---------------------------------------------------------------------------

export async function apiFetchResult<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; error: null } | { data: null; error: MrApiError }> {
  let authHeader: Record<string, string> = {};
  try {
    const store = await cookies();
    const token = store.get('recafco_access')?.value;
    if (token) authHeader = { Authorization: `Bearer ${token}` };
  } catch {
    // Not in a request context
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...authHeader, ...init?.headers },
      cache: 'no-store',
    });
    const body = (await res.json()) as ApiResponse<T> | ApiErrorResponse;
    if (!res.ok || body.error !== null) {
      const err = (body as ApiErrorResponse).error;
      return { data: null, error: { code: err?.code ?? 'API_ERROR', message: err?.message ?? `API error ${res.status}` } };
    }
    return { data: (body as ApiResponse<T>).data, error: null };
  } catch (e) {
    return { data: null, error: { code: 'NETWORK_ERROR', message: e instanceof Error ? e.message : 'Network error' } };
  }
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

export interface MrListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  priority?: string;
  assignedToUserId?: string;
  affectedDepartmentId?: string;
  plantId?: string;
  locationId?: string;
  requestedCompletionFrom?: string;
  requestedCompletionTo?: string;
  overdue?: boolean;
}

function buildQuery(q: MrListQuery): string {
  const params = new URLSearchParams();
  if (q.page !== undefined) params.set('page', String(q.page));
  if (q.pageSize !== undefined) params.set('pageSize', String(q.pageSize));
  if (q.search) params.set('search', q.search);
  if (q.status) params.set('status', q.status);
  if (q.priority) params.set('priority', q.priority);
  if (q.assignedToUserId) params.set('assignedToUserId', q.assignedToUserId);
  if (q.affectedDepartmentId) params.set('affectedDepartmentId', q.affectedDepartmentId);
  if (q.plantId) params.set('plantId', q.plantId);
  if (q.locationId) params.set('locationId', q.locationId);
  if (q.requestedCompletionFrom) params.set('requestedCompletionFrom', q.requestedCompletionFrom);
  if (q.requestedCompletionTo) params.set('requestedCompletionTo', q.requestedCompletionTo);
  if (q.overdue !== undefined) params.set('overdue', String(q.overdue));
  const str = params.toString();
  return str ? `?${str}` : '';
}

// ---------------------------------------------------------------------------
// maintenance API namespace
// ---------------------------------------------------------------------------

export const maintenanceApi = {
  list: (q: MrListQuery = {}) =>
    apiFetch<ListResponse<MaintenanceRequest>>(`/maintenance${buildQuery(q)}`),

  get: (id: string) =>
    apiFetch<MaintenanceRequest>(`/maintenance/${id}`),

  summary: () =>
    apiFetch<MrSummary>('/maintenance/summary'),

  dashboard: () =>
    apiFetch<MrDashboardData>('/maintenance/dashboard'),

  my: (q: MrListQuery = {}) =>
    apiFetch<ListResponse<MaintenanceRequest>>(`/maintenance/my${buildQuery(q)}`),

  listComments: (id: string) =>
    apiFetch<MaintenanceRequestComment[]>(`/maintenance/${id}/comments`),

  listActivities: (id: string) =>
    apiFetch<MaintenanceRequestActivity[]>(`/maintenance/${id}/activities`),

  people: (search?: string) =>
    apiFetch<UserRef[]>(`/maintenance/people${search ? `?search=${encodeURIComponent(search)}` : ''}`),
};
