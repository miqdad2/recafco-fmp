import { cookies } from 'next/headers';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'TERMINATED' | 'CLOSED';
export type DerivedLifecycleStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'TERMINATED' | 'CLOSED';

export interface Contract {
  id: string;
  referenceNumber: string;
  title: string;
  description?: string;
  status: ContractStatus;
  lifecycleStatus: DerivedLifecycleStatus;
  version: number;
  counterpartyName: string;
  counterpartyContact?: string;
  contractValue?: string;
  currency?: string;
  startDate?: string;
  endDate?: string;
  renewalNoticeDate?: string;
  ownerUser: { id: string; displayName: string };
  department?: { id: string; name: string };
  plant?: { id: string; name: string };
  location?: { id: string; name: string };
  notes?: string;
  createdByUser: { id: string; displayName: string };
  activatedAt?: string;
  activatedByUser?: { id: string; displayName: string };
  terminatedAt?: string;
  terminatedByUser?: { id: string; displayName: string };
  terminationReason?: string;
  closedAt?: string;
  closedByUser?: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
}

export interface ContractComment {
  id: string;
  contractId: string;
  authorUser: { id: string; displayName: string };
  body: string;
  createdAt: string;
}

export interface ContractActivity {
  id: string;
  contractId: string;
  actorUserId?: string;
  actorName?: string;
  event: string;
  previousStatus?: ContractStatus;
  newStatus?: ContractStatus;
  metadata?: unknown;
  createdAt: string;
}

export interface ContractSummary {
  totalDraft: number;
  totalActive: number;
  totalExpiring: number;
  totalExpired: number;
  totalTerminated: number;
  totalClosed: number;
}

export type DashboardScopeType = 'OWN_DEPARTMENT' | 'SELECTED_DEPARTMENTS' | 'ALL_DEPARTMENTS';

export interface ContractDashboardData {
  scope: { type: DashboardScopeType; departmentNames: string[] };
  metrics: {
    totalDraft: number;
    totalActive: number;
    totalExpiring: number;
    totalExpired: number;
    totalTerminated: number;
    totalClosed: number;
  };
  recent: { id: string; referenceNumber: string; title: string; status: string; updatedAt: string }[];
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ContractPerson {
  id: string;
  displayName: string;
  departmentId?: string;
}

export interface OrgRef {
  id: string;
  name: string;
  code: string;
}

export interface LocationRef extends OrgRef {
  plantId?: string;
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

// ---------------------------------------------------------------------------
// apiFetch
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
    throw new Error(err?.message ?? `HTTP ${res.status}`);
  }
  return (body as ApiResponse<T>).data;
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

interface ContractListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  lifecycleStatus?: string;
  search?: string;
  ownerUserId?: string;
  departmentId?: string;
  plantId?: string;
}

function buildQuery(q: ContractListQuery): string {
  const params = new URLSearchParams();
  if (q.page !== undefined) params.set('page', String(q.page));
  if (q.pageSize !== undefined) params.set('pageSize', String(q.pageSize));
  if (q.status) params.set('status', q.status);
  if (q.lifecycleStatus) params.set('lifecycleStatus', q.lifecycleStatus);
  if (q.search) params.set('search', q.search);
  if (q.ownerUserId) params.set('ownerUserId', q.ownerUserId);
  if (q.departmentId) params.set('departmentId', q.departmentId);
  if (q.plantId) params.set('plantId', q.plantId);
  const str = params.toString();
  return str ? `?${str}` : '';
}

// ---------------------------------------------------------------------------
// contractsApi namespace
// ---------------------------------------------------------------------------

export const contractsApi = {
  list: (params: ContractListQuery = {}) =>
    apiFetch<ListResponse<Contract>>(`/contracts${buildQuery(params)}`),

  get: (id: string) =>
    apiFetch<Contract>(`/contracts/${id}`),

  summary: () =>
    apiFetch<ContractSummary>('/contracts/summary'),

  dashboard: () =>
    apiFetch<ContractDashboardData>('/contracts/dashboard'),

  listComments: (id: string) =>
    apiFetch<ContractComment[]>(`/contracts/${id}/comments`),

  listActivities: (id: string) =>
    apiFetch<ContractActivity[]>(`/contracts/${id}/activities`),

  people: () =>
    apiFetch<ContractPerson[]>('/contracts/people'),

  departments: () =>
    apiFetch<OrgRef[]>('/contracts/departments'),

  plants: () =>
    apiFetch<OrgRef[]>('/contracts/plants'),

  locations: (plantId?: string) =>
    apiFetch<LocationRef[]>(`/contracts/locations${plantId ? `?plantId=${encodeURIComponent(plantId)}` : ''}`),
};
