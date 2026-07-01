import { cookies } from 'next/headers';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'CLOSED'
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

export interface IncidentRef {
  id: string;
  referenceNumber: string;
  title: string;
}

export interface FactoryTask {
  id: string;
  referenceNumber: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string | null;
  blockedReason: string | null;
  completionSummary: string | null;
  createdByUserId: string;
  requestedByUserId: string;
  assignedToUserId: string | null;
  responsibleDepartmentId: string | null;
  requestingDepartmentId: string | null;
  plantId: string | null;
  locationId: string | null;
  incidentId: string | null;
  blockedAt: string | null;
  blockedByUserId: string | null;
  completedAt: string | null;
  completedByUserId: string | null;
  closedAt: string | null;
  closedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUser: UserRef;
  requestedByUser: UserRef;
  assignedToUser: UserRef | null;
  responsibleDepartment: OrgRef | null;
  requestingDepartment: OrgRef | null;
  plant: OrgRef | null;
  location: OrgRef | null;
  incident: IncidentRef | null;
}

export interface FactoryTaskProgress {
  id: string;
  factoryTaskId: string;
  progressPercent: number | null;
  note: string;
  createdAt: string;
  authorUser: UserRef | null;
}

export interface FactoryTaskComment {
  id: string;
  factoryTaskId: string;
  body: string;
  createdAt: string;
  authorUser: UserRef | null;
}

export interface FactoryTaskActivity {
  id: string;
  factoryTaskId: string;
  actorUserId: string | null;
  actorName: string | null;
  event: string;
  previousStatus: TaskStatus | null;
  newStatus: TaskStatus | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface TaskSummary {
  openTasks: number;
  myOpenTasks: number;
  overdueTasks: number;
  completedThisMonth: number;
  blockedTasks: number;
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

export interface TaskApiError {
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
): Promise<{ data: T; error: null } | { data: null; error: TaskApiError }> {
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

export interface TaskListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  priority?: string;
  assignedToUserId?: string;
  responsibleDepartmentId?: string;
  requestingDepartmentId?: string;
  plantId?: string;
  locationId?: string;
  incidentId?: string;
  dueFrom?: string;
  dueTo?: string;
  overdue?: boolean;
}

function buildQuery(q: TaskListQuery): string {
  const params = new URLSearchParams();
  if (q.page !== undefined) params.set('page', String(q.page));
  if (q.pageSize !== undefined) params.set('pageSize', String(q.pageSize));
  if (q.search) params.set('search', q.search);
  if (q.status) params.set('status', q.status);
  if (q.priority) params.set('priority', q.priority);
  if (q.assignedToUserId) params.set('assignedToUserId', q.assignedToUserId);
  if (q.responsibleDepartmentId) params.set('responsibleDepartmentId', q.responsibleDepartmentId);
  if (q.requestingDepartmentId) params.set('requestingDepartmentId', q.requestingDepartmentId);
  if (q.plantId) params.set('plantId', q.plantId);
  if (q.locationId) params.set('locationId', q.locationId);
  if (q.incidentId) params.set('incidentId', q.incidentId);
  if (q.dueFrom) params.set('dueFrom', q.dueFrom);
  if (q.dueTo) params.set('dueTo', q.dueTo);
  if (q.overdue !== undefined) params.set('overdue', String(q.overdue));
  const str = params.toString();
  return str ? `?${str}` : '';
}

// ---------------------------------------------------------------------------
// factory-tasks API namespace
// ---------------------------------------------------------------------------

export const tasksApi = {
  list: (q: TaskListQuery = {}) =>
    apiFetch<ListResponse<FactoryTask>>(`/factory-tasks${buildQuery(q)}`),

  get: (id: string) =>
    apiFetch<FactoryTask>(`/factory-tasks/${id}`),

  summary: () =>
    apiFetch<TaskSummary>('/factory-tasks/summary'),

  my: (q: TaskListQuery = {}) =>
    apiFetch<ListResponse<FactoryTask>>(`/factory-tasks/my${buildQuery(q)}`),

  listProgress: (id: string) =>
    apiFetch<FactoryTaskProgress[]>(`/factory-tasks/${id}/progress`),

  listComments: (id: string) =>
    apiFetch<FactoryTaskComment[]>(`/factory-tasks/${id}/comments`),

  listActivities: (id: string) =>
    apiFetch<FactoryTaskActivity[]>(`/factory-tasks/${id}/activities`),

  people: (search?: string) =>
    apiFetch<UserRef[]>(`/factory-tasks/people${search ? `?search=${encodeURIComponent(search)}` : ''}`),
};
