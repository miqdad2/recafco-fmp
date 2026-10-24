import { cookies } from 'next/headers';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// FMP-OPS-01 — Operations source API client (server side only). Types mirror
// apps/api/src/operations-source/. Every figure here is ACCEPTED LOCAL data the
// background worker stored; opening a screen never waits on the external system.
// ---------------------------------------------------------------------------

export type WarningSeverity = 'info' | 'warning' | 'critical';

export interface ProgressWarning {
  code: string;
  severity: WarningSeverity;
  message: string;
}

export interface DiscoveryView {
  enabled: boolean;
  lastAt: string | null;
  outcome: string | null;
  message: string | null;
  projectCount: number | null;
}

export interface ConnectionView {
  /** 'demo' = the worker signs in through the source's demo sign-in, which depends on its demo access. */
  authMode: 'password' | 'demo' | null;
  discovery: DiscoveryView;
  state: 'NOT_CONFIGURED' | 'OK' | 'DEGRADED' | 'AUTH_FAILED' | 'PAUSED' | 'UNKNOWN';
  liveSyncActive: boolean;
  message: string;
  pollIntervalSeconds: number | null;
  workerHeartbeatAt: string | null;
  workerStale: boolean;
  circuitOpenUntil: string | null;
}

export interface OperationsTotals {
  total: number;
  issued: number;
  produced: number;
  delivered: number;
  installed: number;
  pendingInputs: number;
}

export interface ProgressData {
  origin: 'LIVE' | 'FIXTURE';
  totals: OperationsTotals;
  sourceGeneratedAt: string | null;
  figuresChangedAt: string;
  lastSuccessfulRetrievalAt: string | null;
  lastAttemptAt: string | null;
  sourceActivityAt: null;
  reviewRequired: boolean | null;
  sourceNotes: string[];
  filterScope: { groupBy: string; columns: string };
  /** Optional richer figures: only supplied keys are present. A missing key means "Not supplied by source". */
  measures: Record<string, number>;
  /** Breakdown by building. Never added to the project figures. */
  breakdown: { groupField: string; rows: { label: string; values: Record<string, number> }[]; truncated: boolean } | null;
  /** Whole-project physical history, separate from the current figures. */
  historical: Record<string, number> | null;
  reviewNotes: string[];
  conflictMarksCount: number | null;
  retrievedVia: 'password' | 'demo' | null;
}

export interface IdentityCheck {
  status: 'MATCHES' | 'MISMATCH' | 'UNKNOWN';
  message: string;
}

/** The contract's operational connection. Separate from (and never changes) its commercial status. */
export type MonitoringState = 'NOT_LINKED' | 'WAITING_FIRST_UPDATE' | 'UPDATED' | 'DELAYED' | 'DEMONSTRATION';

export type FieldAvailabilityValue = 'SUPPLIED' | 'NOT_SUPPLIED';

export interface FieldAvailability {
  total: FieldAvailabilityValue;
  issued: FieldAvailabilityValue;
  produced: FieldAvailabilityValue;
  delivered: FieldAvailabilityValue;
  installed: FieldAvailabilityValue;
  pendingInputs: FieldAvailabilityValue;
  balanceProduce: FieldAvailabilityValue;
  balanceDeliver: FieldAvailabilityValue;
  stock: FieldAvailabilityValue;
  sourcePercentages: FieldAvailabilityValue;
  volume: FieldAvailabilityValue;
  area: FieldAvailabilityValue;
  length: FieldAvailabilityValue;
  historical: FieldAvailabilityValue;
  breakdown: FieldAvailabilityValue;
  drawingCounts: FieldAvailabilityValue;
  castingSchedule: FieldAvailabilityValue;
  storageFigures: FieldAvailabilityValue;
  rejectedQuantities: FieldAvailabilityValue;
  boqProgress: FieldAvailabilityValue;
  activityTime: FieldAvailabilityValue;
}

/** Compact form of the same resolved view (Contract List). */
export interface ProgressSummary {
  contractId: string;
  monitoringState: MonitoringState;
  snapshotId: string | null;
  sourceProjectId: string | null;
  demonstration: boolean;
  delayed: boolean;
  delayedReason: string | null;
  totals: OperationsTotals | null;
  lastSuccessfulRetrievalAt: string | null;
  sourceGeneratedAt: string | null;
  warningCount: number;
  retrievedVia: 'password' | 'demo' | null;
}

export interface ProgressView {
  contractId: string;
  monitoringState: MonitoringState;
  snapshotId: string | null;
  fieldAvailability: FieldAvailability;
  connection: ConnectionView;
  linked: boolean;
  source: null | {
    projectId: string;
    sourceProjectId: string;
    jobOrder: string | null;
    factory: string | null;
    name: string | null;
    linkMethod: 'MANUAL' | 'AUTOMATIC' | null;
    linkedAt: string | null;
    linkedByName: string | null;
    identityCheck: IdentityCheck;
    syncEnabled: boolean;
  };
  data: ProgressData | null;
  stale: { stale: boolean; reason: string | null };
  warnings: ProgressWarning[];
  refresh: { pending: boolean; requestedAt: string | null };
}

export interface FieldChange {
  field: keyof OperationsTotals;
  from: number;
  to: number;
}

export interface HistoryEntry {
  id: string;
  origin: 'LIVE' | 'FIXTURE';
  sourceGeneratedAt: string;
  retrievedAt: string;
  totals: OperationsTotals;
  changes: FieldChange[];
  flags: { code: string; severity: string; message: string }[];
}

export interface ProjectListItem {
  id: string;
  sourceProjectId: string;
  jobOrder: string | null;
  factory: string | null;
  name: string | null;
  contract: { id: string; referenceNumber: string; title: string } | null;
  linkMethod: 'MANUAL' | 'AUTOMATIC' | null;
  linkedAt: string | null;
  linkedByName: string | null;
  lastSuccessfulRetrievalAt: string | null;
  sourceGeneratedAt: string | null;
  lastOutcome: string | null;
  lastErrorMessage: string | null;
  stale: boolean;
  hasData: boolean;
  syncEnabled: boolean;
  excludedReason: string | null;
  missingFromListSince: string | null;
}

export interface MatchCandidate {
  contractId: string;
  referenceNumber: string;
  title: string;
  strength: 'RELIABLE' | 'POSSIBLE';
  reasons: string[];
  blockers: string[];
}

export interface ProjectMatchItem {
  project: ProjectListItem;
  state: 'LINKED' | 'AUTO_LINKABLE' | 'SUGGESTED' | 'CONFLICT' | 'AWAITING';
  summary: string;
  candidates: MatchCandidate[];
}

export interface ProjectsOverview {
  connection: ConnectionView;
  linked: ProjectListItem[];
  suggested: ProjectMatchItem[];
  conflicts: ProjectMatchItem[];
  awaiting: ProjectMatchItem[];
  excluded: ProjectListItem[];
  factoryMappings: { id: string; factoryCode: string; plant: { id: string; code: string; name: string } }[];
  unmappedFactories: string[];
  discovery: { automatic: boolean; reason: string };
}

export type RefreshStatus = 'QUEUED' | 'ALREADY_QUEUED' | 'TOO_SOON' | 'NOT_ACTIVE' | 'NOT_LINKED';
export interface RefreshResult {
  status: RefreshStatus;
  message: string;
}

/** Result shape shared by the screens' server actions. */
export interface OperationsActionResult {
  error: string | null;
  message?: string;
}

interface Envelope<T> {
  data: T | null;
  error: { message?: string } | null;
}

async function apiFetch<T>(path: string): Promise<T> {
  let authHeader: Record<string, string> = {};
  try {
    const token = (await cookies()).get('recafco_access')?.value;
    if (token) authHeader = { Authorization: `Bearer ${token}` };
  } catch {
    // Not in a request context.
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeader },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  const body = (await res.json()) as Envelope<T>;
  if (!res.ok || body.error !== null || body.data === null) {
    throw new Error(body.error?.message ?? `HTTP ${res.status}`);
  }
  return body.data;
}

export const operationsApi = {
  contractProgress: (contractId: string): Promise<ProgressView> =>
    apiFetch<ProgressView>(`/contracts/${encodeURIComponent(contractId)}/operations-progress`),
  contractHistory: (contractId: string, limit = 15): Promise<HistoryEntry[]> =>
    apiFetch<HistoryEntry[]>(`/contracts/${encodeURIComponent(contractId)}/operations-progress/history?limit=${limit}`),
  projects: (): Promise<ProjectsOverview> => apiFetch<ProjectsOverview>('/operations-source/projects'),
  /** One call for a whole Contract List page; contracts the viewer cannot see are simply absent. */
  monitoring: (contractIds: string[]): Promise<Record<string, ProgressSummary>> =>
    contractIds.length === 0
      ? Promise.resolve({})
      : apiFetch<Record<string, ProgressSummary>>(`/operations-source/monitoring?ids=${contractIds.map(encodeURIComponent).join(',')}`),
  fingerprint: (contractIds: string[]): Promise<Record<string, string>> =>
    apiFetch<Record<string, string>>(`/operations-source/monitoring/fingerprint?ids=${contractIds.map(encodeURIComponent).join(',')}`),
};
