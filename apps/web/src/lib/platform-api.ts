import { cookies } from 'next/headers';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

export interface ApiErrorShape {
  code?: string;
  message?: string;
}

export interface ApiResponseShape<T> {
  data: T;
  error: ApiErrorShape | null;
}

export interface PlatformMetric {
  label: string;
  /** null means the metric cannot be honestly computed yet — render "Not available", never a fabricated number. */
  value: number | null;
}

export type PlatformModuleCode =
  | 'CONTRACTS_MANAGEMENT'
  | 'TECHNICAL'
  | 'ERECTION'
  | 'QA_QC'
  | 'STORAGE_DELIVERY'
  | 'SAFETY_COMPLIANCE'
  | 'INCIDENT_REPORT'
  | 'PRODUCTION_DASHBOARD'
  | 'MAINTENANCE_REQUESTS'
  | 'FACTORY_TASKS';

export interface PlatformModuleCard {
  code: PlatformModuleCode;
  title: string;
  description: string;
  route: string;
  metrics: PlatformMetric[];
}

export interface PlatformDashboardData {
  displayName: string;
  cards: PlatformModuleCard[];
}

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
  const body = (await res.json()) as ApiResponseShape<T>;
  if (!res.ok || body.error !== null) {
    throw new Error(body.error?.message ?? `API error ${res.status}`);
  }
  return body.data;
}

export const platformApi = {
  dashboard: () => apiFetch<PlatformDashboardData>('/platform/dashboard'),
};
