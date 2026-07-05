import { cookies } from 'next/headers';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProductionOrderStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type ProductionEntryType = 'OUTPUT' | 'DOWNTIME' | 'ADJUSTMENT';

export interface ProductionLine {
  id: string;
  code: string;
  name: string;
  description?: string;
  plantId?: string;
  locationId?: string;
  capacity?: number;
  isActive: boolean;
  version: number;
  plant?: { id: string; name: string; code: string };
  location?: { id: string; name: string; code: string };
  createdAt: string;
  updatedAt: string;
}

export interface ProductionOrder {
  id: string;
  referenceNumber: string;
  title: string;
  description?: string;
  status: ProductionOrderStatus;
  version: number;
  productionLineId?: string;
  departmentId?: string;
  plantId?: string;
  productCode?: string;
  productName?: string;
  targetQuantity: number;
  unit: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  startedAt?: string;
  pausedAt?: string;
  pauseReason?: string;
  resumedAt?: string;
  completedAt?: string;
  completionNote?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  productionLine?: { id: string; code: string; name: string };
  department?: { id: string; name: string };
  plant?: { id: string; name: string };
  createdByUser: { id: string; displayName: string };
  supervisorUser?: { id: string; displayName: string };
  startedByUser?: { id: string; displayName: string };
  pausedByUser?: { id: string; displayName: string };
  resumedByUser?: { id: string; displayName: string };
  completedByUser?: { id: string; displayName: string };
  cancelledByUser?: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
}

export interface ProductionEntry {
  id: string;
  orderId: string;
  type: ProductionEntryType;
  authorUserId: string;
  authorName: string;
  quantityProduced?: number;
  quantityAccepted?: number;
  quantityRejected?: number;
  downtimeMinutes?: number;
  adjustmentQty?: number;
  note?: string;
  recordedAt: string;
  createdAt: string;
}

export interface ProductionComment {
  id: string;
  orderId: string;
  authorUser: { id: string; displayName: string };
  body: string;
  createdAt: string;
}

export interface ProductionActivity {
  id: string;
  orderId: string;
  actorUserId?: string;
  actorName?: string;
  event: string;
  previousStatus?: ProductionOrderStatus;
  newStatus?: ProductionOrderStatus;
  metadata?: unknown;
  createdAt: string;
}

export interface ProductionMetrics {
  totalProduced: number;
  totalAccepted: number;
  totalRejected: number;
  totalDowntimeMinutes: number;
  adjustmentTotal: number;
  effectiveProduced: number;
  completionPercentage: number;
  rejectionRate: number;
  remainingQuantity: number;
}

export interface ProductionSummary {
  totalDraft: number;
  totalScheduled: number;
  totalInProgress: number;
  totalPaused: number;
  totalCompleted: number;
  totalCancelled: number;
}

export type DashboardScopeType = 'OWN_DEPARTMENT' | 'SELECTED_DEPARTMENTS' | 'ALL_DEPARTMENTS';

export interface ProductionDashboardData {
  scope: { type: DashboardScopeType; departmentNames: string[] };
  metrics: {
    scheduledOrders: number;
    inProgressOrders: number;
    pausedOrders: number;
    completedThisMonth: number;
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

export interface OrgRef {
  id: string;
  name: string;
  code: string;
}

export interface LocationRef {
  id: string;
  name: string;
  code: string;
  plantId?: string;
}

export interface PersonRef {
  id: string;
  displayName: string;
  departmentId?: string;
}

export interface ActiveLineRef {
  id: string;
  code: string;
  name: string;
  plantId?: string;
  capacity?: number;
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
    // Not in a request context
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
// Query builders
// ---------------------------------------------------------------------------

interface OrderListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
  productionLineId?: string;
  departmentId?: string;
  plantId?: string;
  supervisorUserId?: string;
}

function buildQuery(q: OrderListQuery): string {
  const params = new URLSearchParams();
  if (q.page !== undefined) params.set('page', String(q.page));
  if (q.pageSize !== undefined) params.set('pageSize', String(q.pageSize));
  if (q.status) params.set('status', q.status);
  if (q.search) params.set('search', q.search);
  if (q.productionLineId) params.set('productionLineId', q.productionLineId);
  if (q.departmentId) params.set('departmentId', q.departmentId);
  if (q.plantId) params.set('plantId', q.plantId);
  if (q.supervisorUserId) params.set('supervisorUserId', q.supervisorUserId);
  const str = params.toString();
  return str ? `?${str}` : '';
}

// ---------------------------------------------------------------------------
// productionApi namespace
// ---------------------------------------------------------------------------

export const productionApi = {
  // Orders
  list: (params: OrderListQuery = {}) =>
    apiFetch<ListResponse<ProductionOrder>>(`/production${buildQuery(params)}`),

  get: (id: string) =>
    apiFetch<ProductionOrder>(`/production/${id}`),

  summary: () =>
    apiFetch<ProductionSummary>('/production/summary'),

  dashboard: () =>
    apiFetch<ProductionDashboardData>('/production/dashboard'),

  listEntries: (id: string) =>
    apiFetch<ProductionEntry[]>(`/production/${id}/entries`),

  getMetrics: (id: string) =>
    apiFetch<ProductionMetrics>(`/production/${id}/metrics`),

  listComments: (id: string) =>
    apiFetch<ProductionComment[]>(`/production/${id}/comments`),

  listActivities: (id: string) =>
    apiFetch<ProductionActivity[]>(`/production/${id}/activities`),

  // Org selectors
  departments: () =>
    apiFetch<OrgRef[]>('/production/departments'),

  plants: () =>
    apiFetch<OrgRef[]>('/production/plants'),

  people: () =>
    apiFetch<PersonRef[]>('/production/people'),

  locations: () =>
    apiFetch<LocationRef[]>('/production/locations'),

  activeLines: () =>
    apiFetch<ActiveLineRef[]>('/production/lines/active'),

  // Lines
  listLines: (params: { page?: number; pageSize?: number; isActive?: boolean; plantId?: string; search?: string } = {}) => {
    const p = new URLSearchParams();
    if (params.page !== undefined) p.set('page', String(params.page));
    if (params.pageSize !== undefined) p.set('pageSize', String(params.pageSize));
    if (params.isActive !== undefined) p.set('isActive', String(params.isActive));
    if (params.plantId) p.set('plantId', params.plantId);
    if (params.search) p.set('search', params.search);
    const qs = p.toString();
    return apiFetch<ListResponse<ProductionLine>>(`/production/lines${qs ? `?${qs}` : ''}`);
  },

  getLine: (id: string) =>
    apiFetch<ProductionLine>(`/production/lines/${id}`),
};
