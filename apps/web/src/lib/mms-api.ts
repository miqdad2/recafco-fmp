import { cookies } from 'next/headers';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// FMP-MAINT-01/02 — typed client for FMP's read-only live MMS dashboard
// endpoint (GET /maintenance/dashboard/live). Runs server-side and calls the
// FMP API only; the FMP API calls MMS server-to-server, so the MMS
// integration key never reaches the browser. Mirrors
// technical-api.ts's apiFetchResult shape (same cookie auth, same errors).
// ---------------------------------------------------------------------------

export type MmsLiveStatus =
  | 'ONLINE'
  | 'OFFLINE'
  | 'NOT_CONFIGURED'
  | 'AUTH_ERROR'
  | 'NOT_ENABLED'
  | 'SCOPE_RESTRICTED';

export interface MmsSummary {
  openRequests: number;
  inProgress: number;
  waitingForParts: number;
  /** MMS rule: in-flight job cards whose start date/time has passed (MMS has no due-date field). */
  overdue: number;
  /** null = could not be mapped for this user (see assignedToMeNote) — never display as 0. */
  assignedToMe: number | null;
  completedThisMonth: number;
}

export interface MmsNeedsAttentionItem {
  id: string;
  ref: string;
  title: string;
  /** Raw MMS status. */
  status: string;
  /** MMS's own display wording. */
  statusLabel: string;
  priority: string | null;
  /** MMS reason wording, e.g. "Overdue", "Urgent priority", "Waiting for parts". */
  reasons: string[];
  updatedAt: string | null;
  /** MMS job card link (validated server-side to the MMS origin). */
  openUrl: string;
}

export interface MmsRecentRequestItem {
  id: string;
  ref: string;
  title: string;
  assetOrLocation: string | null;
  status: string;
  statusLabel: string;
  priority: string | null;
  assignedTo: string | null;
  updatedAt: string | null;
  openUrl: string;
}

export interface MmsLiveDashboard {
  status: MmsLiveStatus;
  message: string | null;
  mmsBaseUrl: string;
  /** Browser auto-refresh interval in seconds (server-configured, minimum 15). */
  refreshSeconds: number;
  /** MMS's generatedAt for the data shown (null when there is no data). */
  generatedAt: string | null;
  fetchedAt: string;
  cacheTtlSeconds: number | null;
  summary: MmsSummary | null;
  assignedToMeNote: string | null;
  needsAttention: MmsNeedsAttentionItem[];
  recentRequests: MmsRecentRequestItem[];
}

export interface MmsApiError {
  code: string;
  message: string;
  /** HTTP status (0 = network failure reaching the FMP API). */
  status: number;
}

interface ApiResponse<T> {
  data: T;
  error: null;
}

interface ApiErrorResponse {
  data: null;
  error: { code: string; message: string };
}

async function authHeader(): Promise<Record<string, string>> {
  try {
    const store = await cookies();
    const token = store.get('recafco_access')?.value;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function fetchMmsLiveDashboard(): Promise<
  { data: MmsLiveDashboard; error: null } | { data: null; error: MmsApiError }
> {
  try {
    const res = await fetch(`${API_BASE}/maintenance/dashboard/live`, {
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      cache: 'no-store',
    });
    const body = (await res.json()) as ApiResponse<MmsLiveDashboard> | ApiErrorResponse;
    if (!res.ok || body.error !== null) {
      const err = (body as ApiErrorResponse).error;
      return {
        data: null,
        error: { code: err?.code ?? 'API_ERROR', message: err?.message ?? `API error ${res.status}`, status: res.status },
      };
    }
    return { data: body.data, error: null };
  } catch (e) {
    return { data: null, error: { code: 'NETWORK_ERROR', message: e instanceof Error ? e.message : 'Network error', status: 0 } };
  }
}
