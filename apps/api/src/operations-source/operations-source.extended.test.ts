import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnprocessableEntityException } from '@nestjs/common';
import { buildConnectionView, buildProgressView, type ConnectionView, type ProjectRow, type SnapshotRow } from './operations-source.view';
import { OperationsSourceService } from './operations-source.service';
import type { DatabaseService } from '../database/database.service';
import type { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';

const NOW = new Date('2026-10-22T12:00:00.000Z');
const ago = (ms: number): Date => new Date(NOW.getTime() - ms);

const project = (over: Partial<ProjectRow> = {}): ProjectRow => ({
  id: 'p1', sourceProjectId: 'shapoorji-2025-92', sourceCode: '92/25', jobOrderNormalized: '92/25', factoryCode: 'PC', sourceName: 'Shapoorji · New Sabah Hospital',
  contractId: 'c1', linkMethod: 'AUTOMATIC', linkedAt: ago(3_600_000), linkedByName: 'System', syncEnabled: true, lastGeneratedAt: ago(40_000), lastAttemptAt: ago(30_000),
  lastSuccessAt: ago(30_000), lastOutcome: 'ACCEPTED', lastErrorMessage: null, consecutiveFailures: 0, refreshRequestedAt: null, excludedReason: null, missingFromListSince: null, ...over,
});

/** Mirrors the CAPTURED real report for 92/25 (22 Oct 2026). */
const MEASURES = {
  drawings: 764, balance_produce: 508, balance_deliver: 1098, stock: 590, scheduled: 0, cast_volume: 4719.547, missing_cast_volume: 3, missing_concrete: 2727,
  issued_pct: 1, produced_pct: 0.8137147048038137, balance_produce_pct: 0.18628529519618628, delivered_pct: 0.5973597359735974, balance_deliver_pct: 0.40264026402640263, installed_pct: 0.5544554455445545,
  total_volume: 5384.408, missing_total_volume: 204, produced_volume: 4719.547, missing_produced_volume: 3, delivered_volume: 3587.466, missing_delivered_volume: 1, installed_volume: 3364.101, missing_installed_volume: 1,
  total_area: 7988.982, missing_total_area: 1751, produced_area: 7642.482, missing_produced_area: 1287, total_length: 6763.68, missing_total_length: 1751,
};

const snapshot = (over: Partial<SnapshotRow> = {}): SnapshotRow => ({
  id: 's1', origin: 'LIVE', generatedAt: ago(60_000), retrievedAt: ago(50_000), total: 2727, issued: 2727, produced: 2219, delivered: 1629, installed: 1512, pendingInputs: 1979,
  reviewRequiredFlag: false, reviewRequiredRaw: false, sourceNotes: ['Status quantities cover current approved requirements.'], flags: [], changes: [], groupBy: 'building', columns: 'total,issued,produced,delivered,installed',
  measures: MEASURES,
  breakdown: { groupField: 'building', rows: [{ label: 'Main building / area', values: { stock: 590, balance_produce: 508 } }], truncated: false },
  historical: { produced: 2219, delivered: 1629, installed: 1512, factory_stock: 590, cast_volume: 4687.351, unallocated_produced: 0, held: 0, surplus: 0, rejected: 0 },
  reviewNotes: [], conflictMarksCount: 0, ...over,
});

const live = (): ConnectionView => buildConnectionView({ connectionState: 'OK', circuitOpenUntil: null, lastMessage: null, workerHeartbeatAt: ago(5_000), pollIntervalSeconds: 60, authMode: 'password', discoveryEnabled: true }, NOW);
const view = (over: { project?: ProjectRow | null; snapshot?: SnapshotRow | null } = {}) =>
  buildProgressView({ contractId: 'c1', project: over.project === undefined ? project() : over.project, snapshot: over.snapshot === undefined ? snapshot() : over.snapshot, contract: { jobOrder: '92/25', factoryCode: 'PC' }, connection: live(), now: NOW });

describe('richer report in the shared view', () => {
  it('exposes balances, stock, source percentages, quantities, history and breakdown exactly as stored', () => {
    const d = view().data!;
    expect(d.totals).toEqual({ total: 2727, issued: 2727, produced: 2219, delivered: 1629, installed: 1512, pendingInputs: 1979 });
    expect(d.measures['balance_produce']).toBe(508);
    expect(d.measures['stock']).toBe(590);
    expect(d.measures['produced_pct']).toBeCloseTo(0.8137, 4);
    expect(d.measures['total_volume']).toBe(5384.408);
    expect(d.measures['missing_total_area']).toBe(1751);
    expect(d.breakdown?.rows[0]?.label).toBe('Main building / area');
  });

  it('keeps current and historical cast volume separate and says they differ, without reconciling', () => {
    const v = view();
    expect(v.data?.measures['cast_volume']).toBe(4719.547);
    expect(v.data?.historical?.['cast_volume']).toBe(4687.351);
    const w = v.warnings.find((x) => x.code === 'HISTORICAL_DIFFERS');
    expect(w?.severity).toBe('info');
    expect(w?.message).toMatch(/4,719\.547/);
    expect(w?.message).toMatch(/4,687\.351/);
    expect(w?.message).toMatch(/not reconciled/);
  });

  it('shows missing-measurement counts as a visible warning and never as zero', () => {
    const w = view().warnings.find((x) => x.code === 'MEASUREMENT_GAPS');
    expect(w?.severity).toBe('warning');
    expect(w?.message).toMatch(/204 pieces have no known volume/);
    expect(w?.message).toMatch(/1,751 pieces have no known area/);
    expect(w?.message).toMatch(/2,727 pieces have no concrete details/);
    expect(w?.message).toMatch(/unknown is not counted as zero/);
  });

  it('field availability reflects what the snapshot really carries', () => {
    const f = view().fieldAvailability;
    expect([f.balanceProduce, f.balanceDeliver, f.stock, f.sourcePercentages, f.volume, f.area, f.length, f.historical, f.breakdown]).toEqual(Array(9).fill('SUPPLIED'));
    expect(f.drawingCounts).toBe('NOT_SUPPLIED'); // the source does not say what "drawings" means
    expect(f.activityTime).toBe('NOT_SUPPLIED');
  });

  it('an older snapshot without the richer figures shows them as NOT supplied, never zero', () => {
    const v = view({ snapshot: snapshot({ measures: null, breakdown: null, historical: null, reviewNotes: [], conflictMarksCount: null }) });
    expect(v.data?.measures).toEqual({});
    expect(v.data?.breakdown).toBeNull();
    expect(v.data?.historical).toBeNull();
    const f = v.fieldAvailability;
    expect([f.balanceProduce, f.stock, f.volume, f.historical, f.breakdown]).toEqual(Array(5).fill('NOT_SUPPLIED'));
    expect(v.warnings.map((w) => w.code)).not.toContain('MEASUREMENT_GAPS');
  });

  it('a supplied zero (scheduled) stays data', () => {
    expect(view().data?.measures['scheduled']).toBe(0);
  });

  it('surfaces conflict marks and the source review notes', () => {
    const v = view({ snapshot: snapshot({ conflictMarksCount: 2, reviewNotes: ['Mark A-12 needs review'] }) });
    expect(v.warnings.find((w) => w.code === 'CONFLICT_MARKS')?.message).toMatch(/2 conflicting marks/);
    expect(v.warnings.find((w) => w.code === 'SOURCE_REVIEW_NOTE')?.message).toBe('Mark A-12 needs review');
  });

  it('ignores malformed stored JSON instead of failing', () => {
    const v = view({ snapshot: snapshot({ measures: { a: 'x', b: 2 }, breakdown: { rows: 'no' }, historical: [1, 2] }) });
    expect(v.data?.measures).toEqual({ b: 2 });
    expect(v.data?.breakdown).toBeNull();
    expect(v.data?.historical).toBeNull();
  });

  it('warns when a linked project is now excluded or has dropped out of the source list, and keeps the figures', () => {
    const excluded = view({ project: project({ excludedReason: 'TRAINING' }) });
    expect(excluded.warnings.map((w) => w.code)).toContain('PROJECT_EXCLUDED');
    expect(excluded.data).not.toBeNull();
    const missing = view({ project: project({ missingFromListSince: ago(86_400_000) }) });
    expect(missing.warnings.find((w) => w.code === 'MISSING_FROM_SOURCE_LIST')?.message).toMatch(/link and the last accepted figures are kept/);
  });
});

describe('connection reports how the worker signs in and the discovery state', () => {
  it('demo sign-in is reported', () => {
    const c = buildConnectionView({ connectionState: 'OK', circuitOpenUntil: null, lastMessage: 'Automatic updates are running through the source’s demo sign-in, which depends on its demo access staying available.', workerHeartbeatAt: ago(5_000), pollIntervalSeconds: 60, authMode: 'demo', discoveryEnabled: true, lastDiscoveryAt: ago(60_000), lastDiscoveryOutcome: 'ACCEPTED', lastDiscoveryMessage: '421 projects listed', lastDiscoveryProjectCount: 421 }, NOW);
    expect(c.authMode).toBe('demo');
    expect(c.message).toMatch(/demo access/);
    expect(c.discovery).toMatchObject({ enabled: true, outcome: 'ACCEPTED', projectCount: 421 });
  });
  it('defaults are explicit when nothing has reported', () => {
    expect(buildConnectionView(null, NOW)).toMatchObject({ authMode: null, discovery: { enabled: false, lastAt: null } });
  });
});

// ---------------------------------------------------------------------------
// Service: exclusions in the links overview and the link guard
// ---------------------------------------------------------------------------

const client = {
  operationsSourceProject: { findMany: vi.fn(), findUnique: vi.fn() },
  operationsProgressSnapshot: { findMany: vi.fn() },
  operationsSourceStatus: { findUnique: vi.fn() },
  operationsFactoryMapping: { findMany: vi.fn(), findUnique: vi.fn() },
  contract: { findUnique: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
};
const tx = { operationsSourceProject: { findUnique: vi.fn(), update: vi.fn() }, operationsProjectLinkEvent: { create: vi.fn() }, contractActivity: { create: vi.fn() }, $queryRaw: vi.fn() };
const deptAccess = { assertCanAccessDepartment: vi.fn(), buildDeptFilter: vi.fn() };
const service = new OperationsSourceService({ getClient: () => client } as unknown as DatabaseService, deptAccess as unknown as DepartmentAccessService);
const ACTOR: AuthUser = { id: 'u1', username: 'm', displayName: 'Manager', roleId: 'r', roleCode: 'CONTRACT_MANAGER', roleName: 'CM', permissions: ['contracts.read', 'contracts.operations_link'], isActive: true, mustChangePassword: false, sessionId: 's', departmentId: 'd1' };

function row(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'x', sourceProjectId: 'x', sourceCode: null, jobOrderNormalized: null, factoryCode: null, sourceName: null, contractId: null, linkMethod: null, linkedAt: null, linkedByName: null, syncEnabled: true, lastGeneratedAt: null, lastAttemptAt: null, lastSuccessAt: null, lastOutcome: null, lastErrorMessage: null, consecutiveFailures: 0, refreshRequestedAt: null, currentSnapshotId: null, excludedReason: null, missingFromListSince: null, ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  deptAccess.assertCanAccessDepartment.mockResolvedValue(undefined);
  deptAccess.buildDeptFilter.mockResolvedValue(null);
  client.operationsSourceStatus.findUnique.mockResolvedValue({ id: 'default', connectionState: 'OK', circuitOpenUntil: null, lastMessage: null, workerHeartbeatAt: new Date(), pollIntervalSeconds: 60 });
  client.operationsFactoryMapping.findMany.mockResolvedValue([{ id: 'm1', factoryCode: 'PC', plantId: 'pl1', plant: { id: 'pl1', code: 'P', name: 'Plant' } }]);
  client.contract.findMany.mockResolvedValue([{ id: 'c1', referenceNumber: 'C-1', title: 'Hospital', counterpartyName: 'X', jobOrder: '0001', status: 'ACTIVE', plantId: 'pl1', departmentId: 'd1', operationsSourceProject: null }]);
  client.contract.findUnique.mockResolvedValue({ id: 'c1', referenceNumber: 'C-1', title: 'T', jobOrder: '0001', plantId: 'pl1', departmentId: 'd1', status: 'ACTIVE' });
  client.$transaction.mockImplementation(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx));
  tx.$queryRaw.mockResolvedValue([]);
});

describe('exclusions in the links overview', () => {
  it('a test project with a perfect job-order + factory match is NEVER suggested, linked or counted as ambiguity', async () => {
    client.operationsSourceProject.findMany.mockResolvedValue([
      row({ id: 'b29', sourceProjectId: 'project_b29b21f0f3fb', jobOrderNormalized: '1', factoryCode: 'PC', excludedReason: 'CONFIGURED_EXCLUSION' }),
      row({ id: 'real', sourceProjectId: 'real-1', jobOrderNormalized: '1', factoryCode: 'PC' }),
    ]);
    const o = await service.listProjects(ACTOR);
    expect(o.excluded.map((p) => p.sourceProjectId)).toEqual(['project_b29b21f0f3fb']);
    // the real project is the unique match: suggested (auto-linkable), not a conflict caused by the excluded one
    expect(o.suggested.map((p) => p.project.sourceProjectId)).toEqual(['real-1']);
    expect(o.conflicts).toHaveLength(0);
    expect(o.awaiting.map((p) => p.project.sourceProjectId)).not.toContain('project_b29b21f0f3fb');
  });

  it('training projects are listed as excluded, not as awaiting a contract', async () => {
    client.operationsSourceProject.findMany.mockResolvedValue([row({ id: 't', sourceProjectId: 'project_8671d24f243d', excludedReason: 'TRAINING' })]);
    const o = await service.listProjects(ACTOR);
    expect(o.excluded[0]?.excludedReason).toBe('TRAINING');
    expect(o.awaiting).toHaveLength(0);
  });

  it('refuses to link an excluded project, even by a person', async () => {
    tx.operationsSourceProject.findUnique.mockResolvedValue({ id: 'b29', sourceProjectId: 'project_b29b21f0f3fb', contractId: null, excludedReason: 'CONFIGURED_EXCLUSION' });
    await expect(service.linkProject(ACTOR, 'b29', { contractId: 'c1' })).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(tx.operationsSourceProject.update).not.toHaveBeenCalled();
  });
});

describe('retrieval provenance: demo sign-in', () => {
  it('a LIVE snapshot retrieved through the demo sign-in says so, with the dependency', () => {
    const v = view({ snapshot: snapshot({ authMode: 'demo' }) });
    expect(v.data?.retrievedVia).toBe('demo');
    const w = v.warnings.find((x) => x.code === 'DEMO_SIGN_IN');
    expect(w?.severity).toBe('warning');
    expect(w?.message).toMatch(/demo sign-in/);
    expect(w?.message).toMatch(/depend on the source keeping its demo access/);
  });
  it('a dedicated-account snapshot, or one without provenance, carries no such notice', () => {
    expect(view({ snapshot: snapshot({ authMode: 'password' }) }).warnings.map((w) => w.code)).not.toContain('DEMO_SIGN_IN');
    expect(view({ snapshot: snapshot() }).data?.retrievedVia).toBeNull();
  });
});
