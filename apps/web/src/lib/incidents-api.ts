import { cookies } from 'next/headers';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'INVESTIGATION'
  | 'ACTION_REQUIRED'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELLED';
export type IncidentActionStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

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

export interface Incident {
  id: string;
  referenceNumber: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  occurredAt: string;
  immediateAction: string | null;
  reportedByUserId: string;
  reportedForUserId: string | null;
  affectedPlantId: string | null;
  affectedLocationId: string | null;
  affectedDepartmentId: string | null;
  assignedToUserId: string | null;
  reviewedByUserId: string | null;
  rootCause: string | null;
  investigationSummary: string | null;
  resolutionSummary: string | null;
  resolvedByUserId: string | null;
  closedByUserId: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reportedByUser: UserRef;
  reportedForUser: UserRef | null;
  affectedPlant: OrgRef | null;
  affectedLocation: OrgRef | null;
  affectedDept: OrgRef | null;
  assignedToUser: UserRef | null;
}

export interface IncidentAction {
  id: string;
  incidentId: string;
  title: string;
  description: string | null;
  status: IncidentActionStatus;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignedToUser: UserRef | null;
  completedByUser: UserRef | null;
  createdByUser: UserRef;
}

export interface IncidentComment {
  id: string;
  incidentId: string;
  body: string;
  createdAt: string;
  authorUser: UserRef;
}

export interface IncidentActivity {
  id: string;
  incidentId: string;
  actorUserId: string | null;
  actorName: string | null;
  event: string;
  previousStatus: IncidentStatus | null;
  newStatus: IncidentStatus | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/** FMP-INC-01 — Incident Evidence Attachments. */
export interface IncidentAttachment {
  id: string;
  incidentId: string;
  originalFileName: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedByUserId: string;
  createdAt: string;
  uploadedByUser: UserRef;
}

export interface IncidentSummary {
  totalOpen: number;
  criticalOpen: number;
  underInvestigation: number;
  resolvedThisMonth: number;
}

export type DashboardScopeType = 'OWN_DEPARTMENT' | 'SELECTED_DEPARTMENTS' | 'ALL_DEPARTMENTS';

export interface IncidentNeedsAttentionItem {
  id: string;
  referenceNumber: string;
  title: string;
  severity: IncidentSeverity;
  status: string;
  createdAt: string;
}

export interface IncidentDashboardData {
  scope: { type: DashboardScopeType; departmentNames: string[] };
  metrics: {
    totalOpen: number;
    criticalOpen: number;
    underInvestigation: number;
    resolvedThisMonth: number;
    closedTotal: number;
  };
  /** FMP-UI-22 — `severity`/`createdAt` added for the Incident Control Center's "Recent Incidents" section. */
  recent: { id: string; referenceNumber: string; title: string; severity: IncidentSeverity; status: string; updatedAt: string; createdAt: string }[];
  /** FMP-UI-22 — real critical/open incidents for the "Needs Attention" section (see incidents.service.ts's own getDashboard() doc comment). */
  needsAttention: IncidentNeedsAttentionItem[];
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

export interface IncidentApiError {
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
): Promise<{ data: T; error: null } | { data: null; error: IncidentApiError }> {
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

export interface IncidentListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  severity?: string;
  affectedPlantId?: string;
  affectedDepartmentId?: string;
  assignedToUserId?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildQuery(q: IncidentListQuery): string {
  const params = new URLSearchParams();
  if (q.page !== undefined) params.set('page', String(q.page));
  if (q.pageSize !== undefined) params.set('pageSize', String(q.pageSize));
  if (q.search) params.set('search', q.search);
  if (q.status) params.set('status', q.status);
  if (q.severity) params.set('severity', q.severity);
  if (q.affectedPlantId) params.set('affectedPlantId', q.affectedPlantId);
  if (q.affectedDepartmentId) params.set('affectedDepartmentId', q.affectedDepartmentId);
  if (q.assignedToUserId) params.set('assignedToUserId', q.assignedToUserId);
  if (q.dateFrom) params.set('dateFrom', q.dateFrom);
  if (q.dateTo) params.set('dateTo', q.dateTo);
  const str = params.toString();
  return str ? `?${str}` : '';
}

// ---------------------------------------------------------------------------
// incidents API namespace
// ---------------------------------------------------------------------------

export const incidentsApi = {
  list: (q: IncidentListQuery = {}) =>
    apiFetch<ListResponse<Incident>>(`/incidents${buildQuery(q)}`),

  get: (id: string) =>
    apiFetch<Incident>(`/incidents/${id}`),

  summary: () =>
    apiFetch<IncidentSummary>('/incidents/summary'),

  dashboard: () =>
    apiFetch<IncidentDashboardData>('/incidents/dashboard'),

  listComments: (id: string) =>
    apiFetch<IncidentComment[]>(`/incidents/${id}/comments`),

  listActivities: (id: string) =>
    apiFetch<IncidentActivity[]>(`/incidents/${id}/activities`),

  listActions: (id: string) =>
    apiFetch<IncidentAction[]>(`/incidents/${id}/actions`),

  people: (search?: string) =>
    apiFetch<UserRef[]>(`/incidents/people${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  // FMP-UI-22 — active departments/plants/locations for the Report Incident
  // form's own dropdowns, gated by `incidents.read` (the same permission
  // this whole module already requires) instead of the admin-only
  // `org.departments.read` / `org.plants.read` / `org.locations.read` that
  // `organizations-api.ts` requires — see incidents.service.ts's own doc
  // comment for the root cause this fixes.
  departments: () =>
    apiFetch<OrgRef[]>('/incidents/departments'),

  plants: () =>
    apiFetch<OrgRef[]>('/incidents/plants'),

  locations: () =>
    apiFetch<OrgRef[]>('/incidents/locations'),

  // FMP-INC-01 — real Incident Evidence Attachments. Upload/delete go
  // through `actions.ts` (multipart/DELETE, need `revalidatePath`), not
  // this JSON-only `apiFetch` namespace.
  listAttachments: (id: string) =>
    apiFetch<IncidentAttachment[]>(`/incidents/${id}/attachments`),
};
