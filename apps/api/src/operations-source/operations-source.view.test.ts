import { describe, it, expect } from 'vitest';
import {
  fingerprintOf,
  summarizeProgress,
  buildConnectionView,
  buildProgressView,
  checkIdentity,
  computeStaleness,
  type ConnectionView,
  type ProjectRow,
  type SnapshotRow,
  type StatusRow,
} from './operations-source.view';

const NOW = new Date('2026-10-21T10:30:00.000Z');
const ago = (ms: number): Date => new Date(NOW.getTime() - ms);

const status = (over: Partial<StatusRow> = {}): StatusRow => ({
  connectionState: 'OK',
  circuitOpenUntil: null,
  lastMessage: null,
  workerHeartbeatAt: ago(10_000),
  pollIntervalSeconds: 60,
  ...over,
});

const project = (over: Partial<ProjectRow> = {}): ProjectRow => ({
  id: 'p1',
  sourceProjectId: 'shapoorji-2025-92',
  sourceCode: '92/25',
  jobOrderNormalized: '92/25',
  factoryCode: 'PC',
  sourceName: 'Shapoorji · New Sabah Hospital',
  contractId: 'c1',
  linkMethod: 'MANUAL',
  linkedAt: ago(3_600_000),
  linkedByName: 'Manager',
  syncEnabled: true,
  lastGeneratedAt: ago(40_000),
  lastAttemptAt: ago(30_000),
  lastSuccessAt: ago(30_000),
  lastOutcome: 'UNCHANGED',
  lastErrorMessage: null,
  consecutiveFailures: 0,
  refreshRequestedAt: null,
  ...over,
});

const snapshot = (over: Partial<SnapshotRow> = {}): SnapshotRow => ({
  id: 's1',
  origin: 'LIVE',
  generatedAt: ago(600_000),
  retrievedAt: ago(590_000),
  total: 2727,
  issued: 2727,
  produced: 2219,
  delivered: 1610,
  installed: 1482,
  pendingInputs: 1966,
  reviewRequiredFlag: null,
  reviewRequiredRaw: null,
  sourceNotes: [],
  flags: [],
  changes: [],
  groupBy: 'building',
  columns: 'total,issued,produced,delivered,installed',
  ...over,
});

const live = (): ConnectionView => buildConnectionView(status(), NOW);
const contract = { jobOrder: 'JO-0092/25', factoryCode: 'PC' };

describe('buildConnectionView', () => {
  it('has no row => unknown and not live', () => {
    const v = buildConnectionView(null, NOW);
    expect(v.liveSyncActive).toBe(false);
    expect(v.workerStale).toBe(true);
  });
  it('NOT_CONFIGURED is never live', () => {
    const v = buildConnectionView(status({ connectionState: 'NOT_CONFIGURED', lastMessage: 'not enabled' }), NOW);
    expect(v.liveSyncActive).toBe(false);
    expect(v.message).toBe('not enabled');
  });
  it('a silent worker means not live even if the last state was OK', () => {
    const v = buildConnectionView(status({ workerHeartbeatAt: ago(10 * 60_000) }), NOW);
    expect(v.liveSyncActive).toBe(false);
    expect(v.workerStale).toBe(true);
    expect(v.message).toMatch(/not reporting/);
  });
  it('a healthy worker is live', () => {
    expect(live().liveSyncActive).toBe(true);
  });
});

describe('computeStaleness', () => {
  it('is fresh after a recent success on a live connection', () => {
    expect(computeStaleness(project(), live(), NOW).stale).toBe(false);
  });
  it('is stale when the latest attempt failed, with the reason', () => {
    const s = computeStaleness(project({ lastOutcome: 'TIMEOUT', lastErrorMessage: 'The source did not answer in time.' }), live(), NOW);
    expect(s).toEqual({ stale: true, reason: 'The source did not answer in time.' });
  });
  it('is stale when no success happened for several poll intervals', () => {
    expect(computeStaleness(project({ lastSuccessAt: ago(10 * 60_000) }), live(), NOW).stale).toBe(true);
  });
  it('is stale when live sync is not active', () => {
    expect(computeStaleness(project(), buildConnectionView(status({ connectionState: 'NOT_CONFIGURED' }), NOW), NOW).stale).toBe(true);
  });
  it('an ignored OLDER response is not a failure', () => {
    expect(computeStaleness(project({ lastOutcome: 'REJECTED_OLDER' }), live(), NOW).stale).toBe(false);
  });
});

describe('checkIdentity', () => {
  it('matches across formatting', () => {
    expect(checkIdentity({ jobOrderNormalized: '92/25', factoryCode: 'PC' }, contract).status).toBe('MATCHES');
  });
  it('flags a different job order or factory', () => {
    expect(checkIdentity({ jobOrderNormalized: '93/25', factoryCode: 'PC' }, contract).status).toBe('MISMATCH');
    expect(checkIdentity({ jobOrderNormalized: '92/25', factoryCode: 'HC' }, contract).status).toBe('MISMATCH');
  });
  it('is unknown (not a mismatch) when something is missing', () => {
    expect(checkIdentity({ jobOrderNormalized: null, factoryCode: null }, contract).status).toBe('UNKNOWN');
    expect(checkIdentity({ jobOrderNormalized: '92/25', factoryCode: 'PC' }, { jobOrder: null, factoryCode: 'PC' }).status).toBe('UNKNOWN');
    expect(checkIdentity({ jobOrderNormalized: '92/25', factoryCode: 'PC' }, { jobOrder: '92/25', factoryCode: null }).status).toBe('UNKNOWN');
  });
});

describe('buildProgressView', () => {
  const view = (over: { project?: ProjectRow | null; snapshot?: SnapshotRow | null; connection?: ConnectionView; demoAllowed?: boolean } = {}) =>
    buildProgressView({
      contractId: 'c1',
      project: over.project === undefined ? project() : over.project,
      snapshot: over.snapshot === undefined ? snapshot() : over.snapshot,
      contract,
      connection: over.connection ?? live(),
      now: NOW,
      demoAllowed: over.demoAllowed ?? true,
    });

  it('an unlinked contract has no source and no data', () => {
    const v = view({ project: null, snapshot: null });
    expect(v.linked).toBe(false);
    expect(v.data).toBeNull();
    expect(v.source).toBeNull();
  });

  it('keeps the three time concepts separate and provides no activity time', () => {
    const v = view();
    expect(v.data?.sourceGeneratedAt).toBe(ago(40_000).toISOString());
    expect(v.data?.lastSuccessfulRetrievalAt).toBe(ago(30_000).toISOString());
    expect(v.data?.figuresChangedAt).toBe(ago(600_000).toISOString());
    expect(v.data?.sourceActivityAt).toBeNull();
  });

  it('exposes the totals unchanged and adds no combined completion figure', () => {
    const v = view();
    expect(v.data?.totals).toEqual({ total: 2727, issued: 2727, produced: 2219, delivered: 1610, installed: 1482, pendingInputs: 1966 });
    // No derived completion/percentage field of any kind is offered to the screens.
    expect(Object.keys(v.data ?? {}).join(' ')).not.toMatch(/complet|percent|progress|overall/i);
    expect(Object.keys(v.data?.totals ?? {})).toEqual(['total', 'issued', 'produced', 'delivered', 'installed', 'pendingInputs']);
  });

  it('always keeps the pending-input warning visible, with the count', () => {
    const w = view().warnings.find((x) => x.code === 'PENDING_INPUTS');
    expect(w?.severity).toBe('warning');
    expect(w?.message).toMatch(/1,966/);
  });

  it('says plainly that BOQ/measurement/schedule/commercial detail is not supplied', () => {
    expect(view().warnings.find((x) => x.code === 'DETAIL_NOT_SUPPLIED')?.message).toMatch(/not supplied by the source/);
  });

  it('marks fixture data as critical so it can never pass as live', () => {
    const w = view({ snapshot: snapshot({ origin: 'FIXTURE' }) }).warnings.find((x) => x.code === 'FIXTURE_DATA');
    expect(w?.severity).toBe('critical');
    expect(w?.message).toBe('Demonstration data — live source not connected.');
  });

  it('linked but never retrieved: no figures and an honest message', () => {
    const v = view({ project: project({ lastSuccessAt: null, lastGeneratedAt: null, lastAttemptAt: null, lastOutcome: null }), snapshot: null });
    expect(v.data).toBeNull();
    expect(v.warnings.map((w) => w.code)).toContain('NO_DATA_YET');
  });

  it('keeps the last figures but marks them stale after a failure', () => {
    const v = view({ project: project({ lastOutcome: 'NETWORK_ERROR', lastErrorMessage: 'Cannot reach the source (connection refused).' }) });
    expect(v.data?.totals.produced).toBe(2219);
    expect(v.stale.stale).toBe(true);
    expect(v.warnings.find((w) => w.code === 'STALE_DATA')?.message).toMatch(/Cannot reach the source/);
  });

  it('with live sync inactive, still shows last accepted data with a warning', () => {
    const v = view({ connection: buildConnectionView(status({ connectionState: 'NOT_CONFIGURED' }), NOW) });
    expect(v.data).not.toBeNull();
    expect(v.warnings.map((w) => w.code)).toContain('SYNC_NOT_ACTIVE');
  });

  it('surfaces source review flags and snapshot change flags', () => {
    const v = view({
      snapshot: snapshot({
        reviewRequiredFlag: true,
        flags: [{ code: 'FIGURE_DECREASED', severity: 'info', message: 'Lower than the previous update' }],
      }),
    });
    const codes = v.warnings.map((w) => w.code);
    expect(codes).toContain('REVIEW_REQUIRED');
    expect(codes).toContain('FIGURE_DECREASED');
  });

  it('reports a pending refresh only when it is newer than the last attempt', () => {
    expect(view({ project: project({ refreshRequestedAt: ago(5_000) }) }).refresh.pending).toBe(true);
    expect(view({ project: project({ refreshRequestedAt: ago(60_000) }) }).refresh.pending).toBe(false);
  });
});


describe('monitoring state (the five operational states)', () => {
  const view = (over: Partial<Parameters<typeof buildProgressView>[0]>) =>
    buildProgressView({ contractId: 'c1', project: project(), snapshot: snapshot(), contract, connection: live(), now: NOW, demoAllowed: true, ...over });

  it('NOT_LINKED has no data and no snapshot identity', () => {
    const v = view({ project: null, snapshot: null });
    expect(v.monitoringState).toBe('NOT_LINKED');
    expect(v.data).toBeNull();
    expect(v.snapshotId).toBeNull();
    expect(v.fieldAvailability.total).toBe('NOT_SUPPLIED');
  });
  it('WAITING_FIRST_UPDATE when linked without a snapshot', () => {
    expect(view({ project: project({ lastSuccessAt: null }), snapshot: null }).monitoringState).toBe('WAITING_FIRST_UPDATE');
  });
  it('UPDATED when fresh, with the snapshot identity and supplied fields', () => {
    const v = view({});
    expect(v.monitoringState).toBe('UPDATED');
    expect(v.snapshotId).toBe('s1');
    expect(v.fieldAvailability.produced).toBe('SUPPLIED');
  });
  it('DELAYED keeps the figures when the latest update failed', () => {
    const v = view({ project: project({ lastOutcome: 'NETWORK_ERROR', lastErrorMessage: 'Cannot reach the source.' }) });
    expect(v.monitoringState).toBe('DELAYED');
    expect(v.data?.totals.produced).toBe(2219);
  });
  it('fields the source does not document are always NOT_SUPPLIED', () => {
    const f = view({}).fieldAvailability;
    for (const k of ['drawingCounts', 'castingSchedule', 'storageFigures', 'rejectedQuantities', 'boqProgress', 'activityTime'] as const) expect(f[k]).toBe('NOT_SUPPLIED');
  });
  it('DEMONSTRATION for a demo project, with its own simulated connection and no age-based staleness', () => {
    const demo = project({ sourceProjectId: 'demo-shapoorji-2025-92', lastSuccessAt: ago(3_600_000), lastOutcome: 'ACCEPTED' });
    const v = view({ project: demo, snapshot: snapshot({ origin: 'FIXTURE' }), connection: buildConnectionView(null, NOW) });
    expect(v.monitoringState).toBe('DEMONSTRATION');
    expect(v.stale.stale).toBe(false);
    expect(v.connection.message).toMatch(/Demonstration data/);
  });
  it('a demo outage is stale but keeps the demo figures', () => {
    const demo = project({ sourceProjectId: 'demo-x', lastOutcome: 'NETWORK_ERROR', lastErrorMessage: 'Simulated outage.' });
    const v = view({ project: demo, snapshot: snapshot({ origin: 'FIXTURE' }) });
    expect(v.monitoringState).toBe('DEMONSTRATION');
    expect(v.stale.stale).toBe(true);
    expect(v.data).not.toBeNull();
  });
  it('production safety: demo project and fixture snapshots are hidden when demonstration is not allowed', () => {
    const demo = project({ sourceProjectId: 'demo-x' });
    expect(view({ project: demo, snapshot: snapshot({ origin: 'FIXTURE' }), demoAllowed: false }).monitoringState).toBe('NOT_LINKED');
    expect(view({ snapshot: snapshot({ origin: 'FIXTURE' }), demoAllowed: false }).data).toBeNull();
  });
  it('defaults to production-safe when demoAllowed is not passed', () => {
    const v = buildProgressView({ contractId: 'c1', project: project({ sourceProjectId: 'demo-x' }), snapshot: snapshot({ origin: 'FIXTURE' }), contract, connection: live(), now: NOW });
    expect(v.monitoringState).toBe('NOT_LINKED');
  });
});

describe('summarizeProgress / fingerprintOf', () => {
  it('summary mirrors the view', () => {
    const v = buildProgressView({ contractId: 'c1', project: project(), snapshot: snapshot(), contract, connection: live(), now: NOW });
    const s = summarizeProgress(v);
    expect(s.totals).toEqual(v.data?.totals);
    expect(s.monitoringState).toBe(v.monitoringState);
    expect(s.delayed).toBe(false);
  });
  it('fingerprint changes with snapshot, retrieval time and freshness', () => {
    const base = buildProgressView({ contractId: 'c1', project: project(), snapshot: snapshot(), contract, connection: live(), now: NOW });
    const newer = buildProgressView({ contractId: 'c1', project: project({ lastSuccessAt: ago(1000) }), snapshot: snapshot(), contract, connection: live(), now: NOW });
    const other = buildProgressView({ contractId: 'c1', project: project(), snapshot: snapshot({ id: 's2' }), contract, connection: live(), now: NOW });
    expect(fingerprintOf(base)).not.toBe(fingerprintOf(newer));
    expect(fingerprintOf(base)).not.toBe(fingerprintOf(other));
    expect(fingerprintOf(base)).toBe(fingerprintOf(base));
  });
});
