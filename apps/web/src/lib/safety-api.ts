import { cookies } from 'next/headers';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type InspectionStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CLOSED'
  | 'CANCELLED';

export type FindingSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type FindingStatus =
  | 'OPEN'
  | 'ACTION_REQUIRED'
  | 'RESOLVED'
  | 'VERIFIED'
  | 'CLOSED';

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

export interface SafetyInspection {
  id: string;
  referenceNumber: string;
  title: string;
  summary: string | null;
  status: InspectionStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  completedByUserId: string | null;
  closedAt: string | null;
  closedByUserId: string | null;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  createdByUserId: string;
  inspectorUserId: string | null;
  departmentId: string | null;
  plantId: string | null;
  locationId: string | null;
  checklistSummary: string | null;
  conclusion: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUser: UserRef;
  inspector: UserRef | null;
  completedByUser: UserRef | null;
  closedByUser: UserRef | null;
  cancelledByUser: UserRef | null;
  department: OrgRef | null;
  plant: OrgRef | null;
  location: OrgRef | null;
}

export interface SafetyFinding {
  id: string;
  inspectionId: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  status: FindingStatus;
  assignedToUserId: string | null;
  dueAt: string | null;
  actionRequired: string | null;
  resolutionSummary: string | null;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  verifiedAt: string | null;
  verifiedByUserId: string | null;
  closedAt: string | null;
  closedByUserId: string | null;
  reopenedAt: string | null;
  reopenedByUserId: string | null;
  reopenReason: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  assignedToUser: UserRef | null;
  resolvedByUser: UserRef | null;
  verifiedByUser: UserRef | null;
  closedByUser: UserRef | null;
}

export interface InspectionComment {
  id: string;
  inspectionId: string;
  body: string;
  createdAt: string;
  authorUser: UserRef | null;
}

export interface InspectionActivity {
  id: string;
  inspectionId: string;
  actorUserId: string | null;
  actorName: string | null;
  event: string;
  previousStatus: InspectionStatus | null;
  newStatus: InspectionStatus | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface InspectionSummary {
  scheduledInspections: number;
  openFindings: number;
  criticalFindings: number;
  overdueFindings: number;
  inProgressInspections: number;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SafetyListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  departmentId?: string;
  plantId?: string;
  inspectorUserId?: string;
}

// ---------------------------------------------------------------------------
// Internal response types
// ---------------------------------------------------------------------------

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

export interface SafetyApiError {
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
): Promise<{ data: T; error: null } | { data: null; error: SafetyApiError }> {
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

function buildQuery(q: SafetyListQuery): string {
  const params = new URLSearchParams();
  if (q.page !== undefined) params.set('page', String(q.page));
  if (q.pageSize !== undefined) params.set('pageSize', String(q.pageSize));
  if (q.search) params.set('search', q.search);
  if (q.status) params.set('status', q.status);
  if (q.departmentId) params.set('departmentId', q.departmentId);
  if (q.plantId) params.set('plantId', q.plantId);
  if (q.inspectorUserId) params.set('inspectorUserId', q.inspectorUserId);
  const str = params.toString();
  return str ? `?${str}` : '';
}

// ---------------------------------------------------------------------------
// safetyApi namespace
// ---------------------------------------------------------------------------

export const safetyApi = {
  list: (q: SafetyListQuery = {}) =>
    apiFetch<ListResponse<SafetyInspection>>(`/safety-compliance${buildQuery(q)}`),

  get: (id: string) =>
    apiFetch<SafetyInspection>(`/safety-compliance/${id}`),

  summary: () =>
    apiFetch<InspectionSummary>('/safety-compliance/summary'),

  listFindings: (id: string) =>
    apiFetch<SafetyFinding[]>(`/safety-compliance/${id}/findings`),

  listComments: (id: string) =>
    apiFetch<InspectionComment[]>(`/safety-compliance/${id}/comments`),

  listActivities: (id: string) =>
    apiFetch<InspectionActivity[]>(`/safety-compliance/${id}/activities`),

  people: (search?: string) =>
    apiFetch<UserRef[]>(`/safety-compliance/people${search ? `?search=${encodeURIComponent(search)}` : ''}`),
};
