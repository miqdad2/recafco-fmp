import { normalizeJobOrder, type FieldChange, type SnapshotFlag } from '@recafco/shared';
import { isDemoSourceProjectId } from './demo-guard';

// ---------------------------------------------------------------------------
// FMP-OPS-01 — read models for the Operations progress screens. Pure functions:
// they turn ACCEPTED LOCAL rows into what the web app shows. Nothing here (or
// anywhere on the read path) calls the external source.
// ---------------------------------------------------------------------------

export type WarningSeverity = 'info' | 'warning' | 'critical';

export interface ProgressWarning {
  code: string;
  severity: WarningSeverity;
  message: string;
}

export type ConnectionStateValue = 'NOT_CONFIGURED' | 'OK' | 'DEGRADED' | 'AUTH_FAILED' | 'PAUSED';

/** Project discovery state as the worker last reported it. */
export interface DiscoveryView {
  enabled: boolean;
  lastAt: string | null;
  outcome: string | null;
  message: string | null;
  projectCount: number | null;
}

export interface ConnectionView {
  /** 'demo' = signed in through the source's demo sign-in: it depends on that demo access staying available. */
  authMode: 'password' | 'demo' | null;
  discovery: DiscoveryView;
  state: ConnectionStateValue | 'UNKNOWN';
  /** True only when the worker is making (or may make) live calls. */
  liveSyncActive: boolean;
  message: string;
  pollIntervalSeconds: number | null;
  workerHeartbeatAt: string | null;
  /** The worker has not reported recently (not running, or crashed). */
  workerStale: boolean;
  circuitOpenUntil: string | null;
}

export interface StatusRow {
  connectionState: ConnectionStateValue;
  circuitOpenUntil: Date | null;
  lastMessage: string | null;
  workerHeartbeatAt: Date | null;
  pollIntervalSeconds: number | null;
  authMode?: string | null;
  discoveryEnabled?: boolean;
  lastDiscoveryAt?: Date | null;
  lastDiscoveryOutcome?: string | null;
  lastDiscoveryMessage?: string | null;
  lastDiscoveryProjectCount?: number | null;
}

/** The worker writes its heartbeat at least every 30 s; three misses means it is not running. */
export const WORKER_STALE_AFTER_MS = 120_000;
export const DEFAULT_POLL_SECONDS = 60;

export function buildConnectionView(row: StatusRow | null, now: Date): ConnectionView {
  if (row === null) {
    return {
      authMode: null,
      discovery: { enabled: false, lastAt: null, outcome: null, message: null, projectCount: null },
      state: 'UNKNOWN',
      liveSyncActive: false,
      message: 'Background synchronization has not reported yet. Live data is not being updated.',
      pollIntervalSeconds: null,
      workerHeartbeatAt: null,
      workerStale: true,
      circuitOpenUntil: null,
    };
  }
  const stale = row.workerHeartbeatAt === null || now.getTime() - row.workerHeartbeatAt.getTime() > WORKER_STALE_AFTER_MS;
  const active = row.connectionState !== 'NOT_CONFIGURED' && !stale;
  const message = stale
    ? 'Background synchronization is not reporting. Figures are not being updated.'
    : (row.lastMessage ?? connectionDefaultMessage(row.connectionState));
  return {
    authMode: row.authMode === 'demo' ? 'demo' : row.authMode === 'password' ? 'password' : null,
    discovery: {
      enabled: row.discoveryEnabled === true,
      lastAt: row.lastDiscoveryAt ? row.lastDiscoveryAt.toISOString() : null,
      outcome: row.lastDiscoveryOutcome ?? null,
      message: row.lastDiscoveryMessage ?? null,
      projectCount: row.lastDiscoveryProjectCount ?? null,
    },
    state: row.connectionState,
    liveSyncActive: active,
    message,
    pollIntervalSeconds: row.pollIntervalSeconds,
    workerHeartbeatAt: row.workerHeartbeatAt ? row.workerHeartbeatAt.toISOString() : null,
    workerStale: stale,
    circuitOpenUntil: row.circuitOpenUntil && row.circuitOpenUntil > now ? row.circuitOpenUntil.toISOString() : null,
  };
}

function connectionDefaultMessage(state: ConnectionStateValue): string {
  switch (state) {
    case 'OK':
      return 'Automatic updates are running.';
    case 'DEGRADED':
      return 'Some recent updates failed. Previous figures are shown as stale.';
    case 'AUTH_FAILED':
      return 'The source rejected the integration account. Updates are paused.';
    case 'PAUSED':
      return 'The source is failing repeatedly. Updates are paused and will resume automatically.';
    case 'NOT_CONFIGURED':
      return 'Live synchronization is not active.';
  }
}

export interface ProjectRow {
  id: string;
  sourceProjectId: string;
  sourceCode: string | null;
  jobOrderNormalized: string | null;
  factoryCode: string | null;
  sourceName: string | null;
  contractId: string | null;
  linkMethod: 'MANUAL' | 'AUTOMATIC' | null;
  linkedAt: Date | null;
  linkedByName: string | null;
  syncEnabled: boolean;
  lastGeneratedAt: Date | null;
  lastAttemptAt: Date | null;
  lastSuccessAt: Date | null;
  lastOutcome: string | null;
  lastErrorMessage: string | null;
  consecutiveFailures: number;
  refreshRequestedAt: Date | null;
  /** Why the project is kept out of linking/sync (training, configured test project, ...). null = eligible. */
  excludedReason?: string | null;
  /** Set when the source's project list stopped including it. The link is kept. */
  missingFromListSince?: Date | null;
}

export interface SnapshotRow {
  id: string;
  origin: 'LIVE' | 'FIXTURE';
  generatedAt: Date;
  retrievedAt: Date;
  total: number;
  issued: number;
  produced: number;
  delivered: number;
  installed: number;
  pendingInputs: number;
  reviewRequiredFlag: boolean | null;
  reviewRequiredRaw: unknown;
  sourceNotes: unknown;
  flags: unknown;
  changes: unknown;
  groupBy: string;
  columns: string;
  measures?: unknown;
  breakdown?: unknown;
  historical?: unknown;
  reviewNotes?: unknown;
  conflictMarksCount?: number | null;
  authMode?: string | null;
}

export interface ContractFacts {
  jobOrder: string | null;
  /** Factory code of the contract's plant via the explicit mapping; null when unmapped. */
  factoryCode: string | null;
}

export interface IdentityCheck {
  status: 'MATCHES' | 'MISMATCH' | 'UNKNOWN';
  message: string;
}

export function checkIdentity(project: Pick<ProjectRow, 'jobOrderNormalized' | 'factoryCode'>, contract: ContractFacts): IdentityCheck {
  const contractJo = normalizeJobOrder(contract.jobOrder);
  if (project.jobOrderNormalized === null) {
    return { status: 'UNKNOWN', message: 'The source has not reported this project’s job order yet.' };
  }
  if (contractJo === null) {
    return { status: 'UNKNOWN', message: 'The contract has no job order to compare with the source.' };
  }
  if (contractJo !== project.jobOrderNormalized) {
    return {
      status: 'MISMATCH',
      message: `The source job order (${project.jobOrderNormalized}) differs from the contract job order (${contractJo}). Check that this link is correct.`,
    };
  }
  if (project.factoryCode !== null && contract.factoryCode !== null && project.factoryCode !== contract.factoryCode) {
    return {
      status: 'MISMATCH',
      message: `The source factory (${project.factoryCode}) differs from the contract’s factory (${contract.factoryCode}). Check that this link is correct.`,
    };
  }
  if (project.factoryCode === null || contract.factoryCode === null) {
    return { status: 'UNKNOWN', message: 'Job order matches; the factory could not be compared.' };
  }
  return { status: 'MATCHES', message: 'Job order and factory match.' };
}

const FAILURE_OUTCOMES = new Set(['AUTH_FAILED', 'FORBIDDEN', 'NOT_FOUND', 'RATE_LIMITED', 'TIMEOUT', 'NETWORK_ERROR', 'SOURCE_ERROR', 'REJECTED_INVALID']);

export interface StaleInfo {
  stale: boolean;
  reason: string | null;
}

export function computeStaleness(project: ProjectRow, connection: ConnectionView, now: Date, opts: { ignoreAge?: boolean } = {}): StaleInfo {
  if (project.lastSuccessAt === null) return { stale: true, reason: 'No successful retrieval yet.' };
  const poll = connection.pollIntervalSeconds ?? DEFAULT_POLL_SECONDS;
  const staleAfterMs = Math.max(poll * 3 * 1000, 180_000);
  const age = now.getTime() - project.lastSuccessAt.getTime();
  if (project.lastOutcome !== null && FAILURE_OUTCOMES.has(project.lastOutcome)) {
    return { stale: true, reason: project.lastErrorMessage ?? 'The latest update failed.' };
  }
  if (!connection.liveSyncActive) return { stale: true, reason: connection.message };
  if (!opts.ignoreAge && age > staleAfterMs) return { stale: true, reason: 'No recent successful update.' };
  return { stale: false, reason: null };
}

function asFlags(v: unknown): SnapshotFlag[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (f): f is SnapshotFlag =>
      typeof f === 'object' && f !== null && typeof (f as SnapshotFlag).code === 'string' && typeof (f as SnapshotFlag).message === 'string',
  );
}

function numberMap(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (typeof x === 'number' && Number.isFinite(x)) out[k] = x;
  }
  return out;
}

export function asMeasures(v: unknown): Record<string, number> {
  return numberMap(v);
}

export function asHistorical(v: unknown): Record<string, number> | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  return numberMap(v);
}

export function asBreakdown(v: unknown): ProgressData['breakdown'] {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as { groupField?: unknown; rows?: unknown; truncated?: unknown };
  if (typeof r.groupField !== 'string' || !Array.isArray(r.rows)) return null;
  const rows = r.rows
    .filter((x): x is { label: string; values: unknown } => typeof x === 'object' && x !== null && typeof (x as { label?: unknown }).label === 'string')
    .map((x) => ({ label: x.label, values: numberMap(x.values) }));
  return { groupField: r.groupField, rows, truncated: r.truncated === true };
}

function asStringsImpl(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function asChanges(v: unknown): FieldChange[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (c): c is FieldChange => typeof c === 'object' && c !== null && typeof (c as FieldChange).field === 'string' && typeof (c as FieldChange).from === 'number' && typeof (c as FieldChange).to === 'number',
  );
}

export interface ProgressData {
  origin: 'LIVE' | 'FIXTURE';
  /** Project-level aggregate from `totals`, used once. Never a sum of rows. */
  totals: { total: number; issued: number; produced: number; delivered: number; installed: number; pendingInputs: number };
  /** When the source generated the newest accepted response. NOT the last activity time. */
  sourceGeneratedAt: string | null;
  /** When these figures last CHANGED (generation time of the current snapshot). */
  figuresChangedAt: string;
  /** Last time FMP successfully retrieved and accepted a response. */
  lastSuccessfulRetrievalAt: string | null;
  lastAttemptAt: string | null;
  /** The source provides no activity time in the documented response. */
  sourceActivityAt: null;
  reviewRequired: boolean | null;
  sourceNotes: string[];
  filterScope: { groupBy: string; columns: string };
  /**
   * Optional richer figures straight from the source's project-level `totals`: only supplied-and-valid keys are
   * present (a missing key is "not supplied", never 0). Percentages are the SOURCE's ("of GA requirement").
   */
  measures: Record<string, number>;
  /** `rows` — a breakdown by building. NEVER added to the totals. */
  breakdown: { groupField: string; rows: { label: string; values: Record<string, number> }[]; truncated: boolean } | null;
  /** Whole-project physical history. Separate from the current figures; not reconciled with them. */
  historical: Record<string, number> | null;
  reviewNotes: string[];
  conflictMarksCount: number | null;
  /** How the accepted snapshot was retrieved. 'demo' = the source's demo sign-in (depends on its demo access). */
  retrievedVia: 'password' | 'demo' | null;
}

/**
 * One word for the contract's operational connection. It is separate from the contract's commercial status
 * (DRAFT/ACTIVE/...), which it never changes.
 */
export type MonitoringState = 'NOT_LINKED' | 'WAITING_FIRST_UPDATE' | 'UPDATED' | 'DELAYED' | 'DEMONSTRATION';

export type FieldAvailabilityValue = 'SUPPLIED' | 'NOT_SUPPLIED';

/** Which documented fields the accepted snapshot actually carries. Anything else is never invented. */
export interface FieldAvailability {
  total: FieldAvailabilityValue;
  issued: FieldAvailabilityValue;
  produced: FieldAvailabilityValue;
  delivered: FieldAvailabilityValue;
  installed: FieldAvailabilityValue;
  pendingInputs: FieldAvailabilityValue;
  /** Optional richer figures: SUPPLIED only when the accepted snapshot actually carries them. */
  balanceProduce: FieldAvailabilityValue;
  balanceDeliver: FieldAvailabilityValue;
  stock: FieldAvailabilityValue;
  sourcePercentages: FieldAvailabilityValue;
  volume: FieldAvailabilityValue;
  area: FieldAvailabilityValue;
  length: FieldAvailabilityValue;
  historical: FieldAvailabilityValue;
  breakdown: FieldAvailabilityValue;
  /** The source does not label what its "drawings" figure means, so no drawing count is shown. */
  drawingCounts: FieldAvailabilityValue;
  castingSchedule: FieldAvailabilityValue;
  storageFigures: FieldAvailabilityValue;
  rejectedQuantities: FieldAvailabilityValue;
  boqProgress: FieldAvailabilityValue;
  activityTime: FieldAvailabilityValue;
}

export interface ProgressView {
  contractId: string;
  monitoringState: MonitoringState;
  /** Identity of the accepted snapshot these figures come from (null when none). */
  snapshotId: string | null;
  fieldAvailability: FieldAvailability;
  connection: ConnectionView;
  linked: boolean;
  source: null | {
    /** FMP’s own row id for the project (used by the link-management endpoints). */
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
  stale: StaleInfo;
  warnings: ProgressWarning[];
  refresh: { pending: boolean; requestedAt: string | null };
}

/** Connection shown for demonstration projects: simulated, never the real worker's state. */
export function buildDemoConnection(): ConnectionView {
  return {
    authMode: null,
    discovery: { enabled: false, lastAt: null, outcome: null, message: null, projectCount: null },
    state: 'OK',
    liveSyncActive: true,
    message: 'Demonstration data — live source not connected.',
    pollIntervalSeconds: null,
    workerHeartbeatAt: null,
    workerStale: false,
    circuitOpenUntil: null,
  };
}

function availabilityFor(hasData: boolean, measures: Record<string, number> = {}, historical = false, breakdown = false): FieldAvailability {
  const s: FieldAvailabilityValue = hasData ? 'SUPPLIED' : 'NOT_SUPPLIED';
  const has = (...keys: string[]): FieldAvailabilityValue => (hasData && keys.some((k) => k in measures) ? 'SUPPLIED' : 'NOT_SUPPLIED');
  return {
    total: s, issued: s, produced: s, delivered: s, installed: s, pendingInputs: s,
    balanceProduce: has('balance_produce'), balanceDeliver: has('balance_deliver'), stock: has('stock'),
    sourcePercentages: has('issued_pct', 'produced_pct', 'delivered_pct', 'installed_pct'),
    volume: has('total_volume', 'produced_volume'), area: has('total_area', 'produced_area'), length: has('total_length', 'produced_length'),
    historical: hasData && historical ? 'SUPPLIED' : 'NOT_SUPPLIED', breakdown: hasData && breakdown ? 'SUPPLIED' : 'NOT_SUPPLIED',
    drawingCounts: 'NOT_SUPPLIED', castingSchedule: 'NOT_SUPPLIED', storageFigures: 'NOT_SUPPLIED',
    rejectedQuantities: 'NOT_SUPPLIED', boqProgress: 'NOT_SUPPLIED', activityTime: 'NOT_SUPPLIED',
  };
}

export function buildProgressView(input: {
  contractId: string;
  project: ProjectRow | null;
  snapshot: SnapshotRow | null;
  contract: ContractFacts;
  connection: ConnectionView;
  now: Date;
  /** Whether demonstration data may exist at all (development only). Defaults to false = production-safe. */
  demoAllowed?: boolean;
}): ProgressView {
  const { contractId, contract, now } = input;
  const demoAllowed = input.demoAllowed ?? false;
  let project = input.project;
  let snapshot = input.snapshot;
  // Production safety: a demonstration project or fixture snapshot is invisible unless demonstration is allowed.
  if (project !== null && isDemoSourceProjectId(project.sourceProjectId) && !demoAllowed) project = null;
  if (snapshot !== null && snapshot.origin === 'FIXTURE' && !demoAllowed) snapshot = null;
  const isDemo = project !== null && isDemoSourceProjectId(project.sourceProjectId);
  const connection = isDemo ? buildDemoConnection() : input.connection;
  const warnings: ProgressWarning[] = [];

  if (project === null) {
    return {
      contractId,
      monitoringState: 'NOT_LINKED',
      snapshotId: null,
      fieldAvailability: availabilityFor(false),
      connection,
      linked: false,
      source: null,
      data: null,
      stale: { stale: true, reason: 'This contract is not linked to an Operations project.' },
      warnings: [],
      refresh: { pending: false, requestedAt: null },
    };
  }

  const identityCheck = checkIdentity(project, contract);
  const stale = computeStaleness(project, connection, now, { ignoreAge: isDemo });

  let data: ProgressData | null = null;
  if (snapshot !== null) {
    data = {
      origin: snapshot.origin,
      totals: {
        total: snapshot.total,
        issued: snapshot.issued,
        produced: snapshot.produced,
        delivered: snapshot.delivered,
        installed: snapshot.installed,
        pendingInputs: snapshot.pendingInputs,
      },
      sourceGeneratedAt: (project.lastGeneratedAt ?? snapshot.generatedAt).toISOString(),
      figuresChangedAt: snapshot.generatedAt.toISOString(),
      lastSuccessfulRetrievalAt: project.lastSuccessAt ? project.lastSuccessAt.toISOString() : null,
      lastAttemptAt: project.lastAttemptAt ? project.lastAttemptAt.toISOString() : null,
      sourceActivityAt: null,
      reviewRequired: snapshot.reviewRequiredFlag,
      sourceNotes: asStrings(snapshot.sourceNotes),
      filterScope: { groupBy: snapshot.groupBy, columns: snapshot.columns },
      measures: asMeasures(snapshot.measures),
      breakdown: asBreakdown(snapshot.breakdown),
      historical: asHistorical(snapshot.historical),
      reviewNotes: asStrings(snapshot.reviewNotes),
      conflictMarksCount: typeof snapshot.conflictMarksCount === 'number' ? snapshot.conflictMarksCount : null,
      retrievedVia: snapshot.authMode === 'demo' ? 'demo' : snapshot.authMode === 'password' ? 'password' : null,
    };
  }

  if (snapshot?.origin === 'FIXTURE') {
    warnings.push({ code: 'FIXTURE_DATA', severity: 'critical', message: 'Demonstration data — live source not connected.' });
  }
  if (data === null) {
    warnings.push({
      code: 'NO_DATA_YET',
      severity: 'warning',
      message: connection.liveSyncActive
        ? 'Linked, but no figures have been retrieved from the source yet.'
        : 'No figures have been retrieved from the source. Live synchronization is not active.',
    });
  } else if (stale.stale) {
    warnings.push({
      code: 'STALE_DATA',
      severity: 'warning',
      message: `These are the last accepted figures, not a fresh update. ${stale.reason ?? ''}`.trim(),
    });
  }
  if (!connection.liveSyncActive && data !== null) {
    warnings.push({ code: 'SYNC_NOT_ACTIVE', severity: 'warning', message: connection.message });
  }
  if (identityCheck.status === 'MISMATCH') {
    warnings.push({ code: 'IDENTITY_MISMATCH', severity: 'warning', message: identityCheck.message });
  }
  if (data !== null && data.totals.pendingInputs > 0) {
    warnings.push({
      code: 'PENDING_INPUTS',
      severity: 'warning',
      message: `${data.totals.pendingInputs.toLocaleString('en-US')} pieces have outstanding earlier-stage input details. Progress counts may change once these are completed.`,
    });
  }
  if (data !== null && data.reviewRequired === true) {
    warnings.push({ code: 'REVIEW_REQUIRED', severity: 'warning', message: 'The source marks this project as needing review.' });
  }
  if (data !== null && data.retrievedVia === 'demo' && snapshot?.origin === 'LIVE') {
    warnings.push({
      code: 'DEMO_SIGN_IN',
      severity: 'warning',
      message: 'These figures were retrieved through the source’s demo sign-in, not a dedicated integration account. They depend on the source keeping its demo access available.',
    });
  }
  if (data !== null) {
    const m = data.measures;
    const gaps: string[] = [];
    const add = (key: string, what: string): void => {
      const n = m[key];
      if (typeof n === 'number' && n > 0) gaps.push(`${n.toLocaleString('en-US')} pieces ${what}`);
    };
    add('missing_total_volume', 'have no known volume');
    add('missing_total_area', 'have no known area');
    add('missing_total_length', 'have no known length');
    add('missing_cast_volume', 'have no cast volume');
    add('missing_concrete', 'have no concrete details');
    if (gaps.length > 0) {
      warnings.push({
        code: 'MEASUREMENT_GAPS',
        severity: 'warning',
        message: `Measurements are incomplete in the source: ${gaps.join('; ')}. Volume, area and length cover only pieces with a known measurement; unknown is not counted as zero.`,
      });
    }
    if (data.conflictMarksCount !== null && data.conflictMarksCount > 0) {
      warnings.push({ code: 'CONFLICT_MARKS', severity: 'warning', message: `The source reports ${data.conflictMarksCount} conflicting mark${data.conflictMarksCount === 1 ? '' : 's'} that need review before their figures can be relied on.` });
    }
    for (const note of data.reviewNotes.slice(0, 5)) warnings.push({ code: 'SOURCE_REVIEW_NOTE', severity: 'warning', message: note });
    const cur = m['cast_volume'];
    const hist = data.historical?.['cast_volume'];
    if (typeof cur === 'number' && typeof hist === 'number' && cur !== hist) {
      warnings.push({
        code: 'HISTORICAL_DIFFERS',
        severity: 'info',
        message: `Current cast volume (${cur.toLocaleString('en-US')} m³) and whole-project history (${hist.toLocaleString('en-US')} m³) differ. Both are shown as supplied and are not reconciled: history keeps quantities of requirements that were later withdrawn.`,
      });
    }
  }
  if (project.excludedReason) {
    warnings.push({ code: 'PROJECT_EXCLUDED', severity: 'warning', message: 'The source marks this project as training or test, so it is excluded from synchronization. The link is kept.' });
  }
  if (project.missingFromListSince) {
    warnings.push({ code: 'MISSING_FROM_SOURCE_LIST', severity: 'info', message: 'The source’s project list no longer includes this project. The link and the last accepted figures are kept.' });
  }
  if (snapshot !== null) {
    for (const f of asFlags(snapshot.flags)) {
      warnings.push({ code: f.code, severity: f.severity === 'warning' ? 'warning' : 'info', message: f.message });
    }
  }
  if (data !== null) {
    warnings.push({
      code: 'DETAIL_NOT_SUPPLIED',
      severity: 'info',
      message:
        'BOQ progress, measurement links, schedule delay and commercial approval are not supplied by the source. Piece counts are not converted into completion percentages.',
    });
  }

  const monitoringState: MonitoringState = isDemo ? 'DEMONSTRATION' : data === null ? 'WAITING_FIRST_UPDATE' : stale.stale ? 'DELAYED' : 'UPDATED';

  return {
    contractId,
    monitoringState,
    snapshotId: snapshot ? snapshot.id : null,
    fieldAvailability: availabilityFor(data !== null, data?.measures ?? {}, data?.historical != null, (data?.breakdown?.rows.length ?? 0) > 0),
    connection,
    linked: true,
    source: {
      projectId: project.id,
      sourceProjectId: project.sourceProjectId,
      jobOrder: project.sourceCode,
      factory: project.factoryCode,
      name: project.sourceName,
      linkMethod: project.linkMethod,
      linkedAt: project.linkedAt ? project.linkedAt.toISOString() : null,
      linkedByName: project.linkedByName,
      identityCheck,
      syncEnabled: project.syncEnabled,
    },
    data,
    stale,
    warnings,
    refresh: {
      pending:
        project.refreshRequestedAt !== null && (project.lastAttemptAt === null || project.refreshRequestedAt > project.lastAttemptAt),
      requestedAt: project.refreshRequestedAt ? project.refreshRequestedAt.toISOString() : null,
    },
  };
}

/**
 * Compact form of the SAME resolved view, for the Contract List. Because it is derived from ProgressView, the list,
 * the Overview and the four tabs can never disagree about a contract.
 */
export interface ProgressSummary {
  contractId: string;
  monitoringState: MonitoringState;
  snapshotId: string | null;
  sourceProjectId: string | null;
  demonstration: boolean;
  /** Last accepted figures are shown but the latest update failed or is overdue. */
  delayed: boolean;
  delayedReason: string | null;
  totals: ProgressData['totals'] | null;
  lastSuccessfulRetrievalAt: string | null;
  sourceGeneratedAt: string | null;
  warningCount: number;
  /** How the accepted snapshot was retrieved ('demo' = the source's demo sign-in, which depends on its demo access). */
  retrievedVia: 'password' | 'demo' | null;
}

export function summarizeProgress(view: ProgressView): ProgressSummary {
  return {
    contractId: view.contractId,
    monitoringState: view.monitoringState,
    snapshotId: view.snapshotId,
    sourceProjectId: view.source ? view.source.sourceProjectId : null,
    demonstration: view.monitoringState === 'DEMONSTRATION',
    delayed: view.linked && view.stale.stale && view.data !== null,
    delayedReason: view.linked && view.data !== null && view.stale.stale ? view.stale.reason : null,
    totals: view.data ? view.data.totals : null,
    lastSuccessfulRetrievalAt: view.data ? view.data.lastSuccessfulRetrievalAt : null,
    sourceGeneratedAt: view.data ? view.data.sourceGeneratedAt : null,
    warningCount: view.warnings.filter((w) => w.severity !== 'info').length,
    retrievedVia: view.data ? view.data.retrievedVia : null,
  };
}

/** Changes whenever anything a viewer can see about this contract's operational data changes. */
export function fingerprintOf(view: ProgressView): string {
  return [
    view.monitoringState,
    view.snapshotId ?? '-',
    view.data?.lastSuccessfulRetrievalAt ?? '-',
    view.stale.stale ? 'stale' : 'fresh',
    view.source?.sourceProjectId ?? '-',
  ].join('|');
}

const asStrings = asStringsImpl;
