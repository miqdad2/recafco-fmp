import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@recafco/database';
import { OperationsSourceService } from './operations-source.service';
import type { DatabaseService } from '../database/database.service';
import type { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';

const tx = {
  operationsSourceProject: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  operationsProjectLinkEvent: { create: vi.fn() },
  contractActivity: { create: vi.fn() },
  operationsFactoryMapping: { upsert: vi.fn(), delete: vi.fn() },
  securityAuditEvent: { create: vi.fn() },
  $queryRaw: vi.fn(),
};
const client = {
  operationsSourceProject: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  operationsProgressSnapshot: { findUnique: vi.fn(), findMany: vi.fn() },
  operationsSourceStatus: { findUnique: vi.fn() },
  operationsFactoryMapping: { findUnique: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
  contract: { findUnique: vi.fn(), findMany: vi.fn() },
  plant: { findUnique: vi.fn() },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
};
const deptAccess = {
  assertCanAccessDepartment: vi.fn(),
  buildDeptFilter: vi.fn(),
};
const service = new OperationsSourceService({ getClient: () => client } as unknown as DatabaseService, deptAccess as unknown as DepartmentAccessService);

const ACTOR: AuthUser = {
  id: 'u1', username: 'm', displayName: 'Manager', roleId: 'r', roleCode: 'CONTRACT_MANAGER', roleName: 'Contract Manager',
  permissions: ['contracts.read', 'contracts.operations_link'], isActive: true, mustChangePassword: false, sessionId: 's', departmentId: 'd1',
};

const CONTRACT = { id: 'c1', referenceNumber: 'CONTRACT-2026-000100', title: '[TEST] New Al Sabah Hospital', jobOrder: '92/25', plantId: null, departmentId: 'd1', status: 'ACTIVE' };

function liveStatus(): Record<string, unknown> {
  return { id: 'default', connectionState: 'OK', circuitOpenUntil: null, lastMessage: null, workerHeartbeatAt: new Date(), pollIntervalSeconds: 60 };
}

function projectRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'p1', sourceProjectId: 'shapoorji-2025-92', sourceCode: null, jobOrderNormalized: null, factoryCode: null, sourceName: null,
    contractId: null, linkMethod: null, linkedAt: null, linkedByName: null, syncEnabled: true, lastGeneratedAt: null, lastAttemptAt: null,
    lastSuccessAt: null, lastOutcome: null, lastErrorMessage: null, consecutiveFailures: 0, refreshRequestedAt: null, currentSnapshotId: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  deptAccess.assertCanAccessDepartment.mockResolvedValue(undefined);
  deptAccess.buildDeptFilter.mockResolvedValue(null);
  client.contract.findUnique.mockResolvedValue(CONTRACT);
  client.operationsSourceStatus.findUnique.mockResolvedValue(liveStatus());
  client.operationsFactoryMapping.findUnique.mockResolvedValue(null);
  client.operationsFactoryMapping.findMany.mockResolvedValue([]);
  tx.$queryRaw.mockResolvedValue([]);
  client.operationsSourceProject.findMany.mockResolvedValue([]);
  client.operationsProgressSnapshot.findMany.mockResolvedValue([]);
});

describe('contract access', () => {
  it('applies the contract department scope before returning any progress', async () => {
    deptAccess.assertCanAccessDepartment.mockRejectedValue(new ForbiddenException({ code: 'DEPARTMENT_ACCESS_DENIED' }));
    await expect(service.getContractProgress('c1', ACTOR)).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.operationsSourceProject.findUnique).not.toHaveBeenCalled();
  });
  it('404s an unknown contract', async () => {
    client.contract.findUnique.mockResolvedValue(null);
    await expect(service.getContractProgress('nope', ACTOR)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('returns an unlinked view for a contract without a link', async () => {
    const v = await service.getContractProgress('c1', ACTOR);
    expect(v.linked).toBe(false);
    expect(v.monitoringState).toBe('NOT_LINKED');
    expect(client.operationsProgressSnapshot.findMany).not.toHaveBeenCalled();
  });
  it('only ever looks up the project linked to THIS contract (project isolation)', async () => {
    await service.getContractProgress('c1', ACTOR);
    expect(client.operationsSourceProject.findMany.mock.calls[0]![0].where).toEqual({ contractId: { in: ['c1'] } });
  });
});

describe('requestRefresh', () => {
  it('queues one request', async () => {
    client.operationsSourceProject.findUnique.mockResolvedValue(projectRow({ contractId: 'c1' }));
    client.$executeRaw.mockResolvedValue(1);
    expect((await service.requestRefresh('c1', ACTOR)).status).toBe('QUEUED');
  });
  it('reuses a request that is already waiting instead of adding another', async () => {
    client.operationsSourceProject.findUnique.mockResolvedValue(
      projectRow({ contractId: 'c1', refreshRequestedAt: new Date(), lastAttemptAt: new Date(Date.now() - 60_000) }),
    );
    client.$executeRaw.mockResolvedValue(0);
    expect((await service.requestRefresh('c1', ACTOR)).status).toBe('ALREADY_QUEUED');
  });
  it('throttles when the project was just checked', async () => {
    client.operationsSourceProject.findUnique.mockResolvedValue(projectRow({ contractId: 'c1', lastAttemptAt: new Date() }));
    client.$executeRaw.mockResolvedValue(0);
    expect((await service.requestRefresh('c1', ACTOR)).status).toBe('TOO_SOON');
  });
  it('does not queue anything while live sync is inactive', async () => {
    client.operationsSourceProject.findUnique.mockResolvedValue(projectRow({ contractId: 'c1' }));
    client.operationsSourceStatus.findUnique.mockResolvedValue({ ...liveStatus(), connectionState: 'NOT_CONFIGURED' });
    const r = await service.requestRefresh('c1', ACTOR);
    expect(r.status).toBe('NOT_ACTIVE');
    expect(client.$executeRaw).not.toHaveBeenCalled();
  });
  it('says so when the contract is not linked', async () => {
    client.operationsSourceProject.findUnique.mockResolvedValue(null);
    expect((await service.requestRefresh('c1', ACTOR)).status).toBe('NOT_LINKED');
  });
});

describe('linkProject', () => {
  it('links, records an audit event and a contract activity', async () => {
    tx.operationsSourceProject.findUnique.mockResolvedValueOnce({ id: 'p1', sourceProjectId: 'shapoorji-2025-92', contractId: null }).mockResolvedValueOnce(null);
    const r = await service.linkProject(ACTOR, 'p1', { contractId: 'c1', reason: 'Registered from source metadata' });
    expect(r).toEqual({ id: 'p1', contractId: 'c1', changed: true });
    expect(tx.operationsSourceProject.update.mock.calls[0]![0].data).toMatchObject({ contractId: 'c1', linkMethod: 'MANUAL', linkedByUserId: 'u1' });
    expect(tx.operationsProjectLinkEvent.create.mock.calls[0]![0].data).toMatchObject({ action: 'LINKED', newContractId: 'c1', actorUserId: 'u1' });
    expect(tx.contractActivity.create).toHaveBeenCalledTimes(1);
  });

  it('is idempotent when the same link already exists', async () => {
    tx.operationsSourceProject.findUnique.mockResolvedValueOnce({ id: 'p1', sourceProjectId: 'x', contractId: 'c1' });
    const r = await service.linkProject(ACTOR, 'p1', { contractId: 'c1' });
    expect(r.changed).toBe(false);
    expect(tx.operationsSourceProject.update).not.toHaveBeenCalled();
    expect(tx.operationsProjectLinkEvent.create).not.toHaveBeenCalled();
  });

  it('refuses a contract that is already linked to a different source project', async () => {
    tx.operationsSourceProject.findUnique.mockResolvedValueOnce({ id: 'p1', sourceProjectId: 'a', contractId: null }).mockResolvedValueOnce({ id: 'p2', sourceProjectId: 'other' });
    await expect(service.linkProject(ACTOR, 'p1', { contractId: 'c1' })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.operationsSourceProject.update).not.toHaveBeenCalled();
  });

  it('requires a reason to CHANGE an existing link, and audits both contracts', async () => {
    tx.operationsSourceProject.findUnique.mockResolvedValue({ id: 'p1', sourceProjectId: 'a', contractId: 'c-old' });
    await expect(service.linkProject(ACTOR, 'p1', { contractId: 'c1' })).rejects.toBeInstanceOf(BadRequestException);

    tx.operationsSourceProject.findUnique.mockReset();
    tx.operationsSourceProject.findUnique.mockResolvedValueOnce({ id: 'p1', sourceProjectId: 'a', contractId: 'c-old' }).mockResolvedValueOnce(null);
    await service.linkProject(ACTOR, 'p1', { contractId: 'c1', reason: 'Wrong contract picked' });
    expect(tx.operationsProjectLinkEvent.create.mock.calls[0]![0].data).toMatchObject({ action: 'RELINKED', previousContractId: 'c-old', newContractId: 'c1', reason: 'Wrong contract picked' });
    expect(tx.contractActivity.create).toHaveBeenCalledTimes(2);
  });

  it('turns a unique-index race into a conflict', async () => {
    tx.operationsSourceProject.findUnique.mockResolvedValueOnce({ id: 'p1', sourceProjectId: 'a', contractId: null }).mockResolvedValueOnce(null);
    tx.operationsSourceProject.update.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
    await expect(service.linkProject(ACTOR, 'p1', { contractId: 'c1', reason: 'by hand' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('will not link a cancelled contract', async () => {
    client.contract.findUnique.mockResolvedValue({ ...CONTRACT, status: 'CANCELLED' });
    await expect(service.linkProject(ACTOR, 'p1', { contractId: 'c1' })).rejects.toMatchObject({ response: { code: 'CONTRACT_CANCELLED' } });
  });

  it('respects the contract department scope', async () => {
    deptAccess.assertCanAccessDepartment.mockRejectedValue(new ForbiddenException({ code: 'DEPARTMENT_ACCESS_DENIED' }));
    await expect(service.linkProject(ACTOR, 'p1', { contractId: 'c1' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.$transaction).not.toHaveBeenCalled();
  });
});

describe('unlinkProject', () => {
  it('clears the link, keeps the stored snapshots, and audits with the reason', async () => {
    client.operationsSourceProject.findUnique.mockResolvedValue({ contractId: 'c1' });
    tx.operationsSourceProject.findUnique.mockResolvedValue({ id: 'p1', sourceProjectId: 'a', contractId: 'c1' });
    await service.unlinkProject(ACTOR, 'p1', { reason: 'Linked in error' });
    expect(tx.operationsSourceProject.update.mock.calls[0]![0].data).toMatchObject({ contractId: null, linkMethod: null });
    expect(tx.operationsProjectLinkEvent.create.mock.calls[0]![0].data).toMatchObject({ action: 'UNLINKED', previousContractId: 'c1', reason: 'Linked in error' });
  });
  it('rejects unlinking something that is not linked', async () => {
    client.operationsSourceProject.findUnique.mockResolvedValue({ contractId: null });
    tx.operationsSourceProject.findUnique.mockResolvedValue({ id: 'p1', sourceProjectId: 'a', contractId: null });
    await expect(service.unlinkProject(ACTOR, 'p1', { reason: 'x' })).rejects.toMatchObject({ response: { code: 'NOT_LINKED' } });
  });
});

describe('registerProject', () => {
  it('creates once and is idempotent for a known id', async () => {
    client.operationsSourceProject.findUnique.mockResolvedValueOnce(null);
    tx.operationsSourceProject.create.mockResolvedValue({ id: 'p1' });
    const first = await service.registerProject(ACTOR, { sourceProjectId: 'shapoorji-2025-92' });
    expect(first).toEqual({ id: 'p1', created: true });
    expect(tx.operationsProjectLinkEvent.create.mock.calls[0]![0].data.action).toBe('REGISTERED');

    client.operationsSourceProject.findUnique.mockResolvedValueOnce({ id: 'p1' });
    const second = await service.registerProject(ACTOR, { sourceProjectId: 'shapoorji-2025-92' });
    expect(second).toEqual({ id: 'p1', created: false });
  });
});

describe('listProjects', () => {
  const contracts = [
    { id: 'c1', referenceNumber: 'C-1', title: '[TEST] New Al Sabah Hospital', counterpartyName: 'X', jobOrder: '92/25', status: 'ACTIVE', plantId: 'pl1', departmentId: 'd1', operationsSourceProject: null },
    { id: 'c2', referenceNumber: 'C-2', title: 'Hidden contract', counterpartyName: 'Y', jobOrder: '77/25', status: 'ACTIVE', plantId: null, departmentId: 'd2', operationsSourceProject: null },
  ];
  beforeEach(() => {
    client.contract.findMany.mockResolvedValue(contracts);
    client.operationsFactoryMapping.findMany.mockResolvedValue([{ id: 'm1', factoryCode: 'PC', plantId: 'pl1', plant: { id: 'pl1', code: 'PLANT', name: 'Plant' } }]);
  });

  it('groups projects into linked, suggested, conflicts and awaiting, and states that discovery is manual', async () => {
    client.operationsSourceProject.findMany.mockResolvedValue([
      projectRow({ id: 'a', sourceProjectId: 'linked-1', contractId: 'c1' }),
      projectRow({ id: 'b', sourceProjectId: 'auto-1', jobOrderNormalized: '92/25', factoryCode: 'PC' }),
      projectRow({ id: 'c', sourceProjectId: 'nothing-yet' }),
    ]);
    const o = await service.listProjects(ACTOR);
    expect(o.linked.map((p) => p.sourceProjectId)).toEqual(['linked-1']);
    expect(o.suggested.map((p) => p.project.sourceProjectId)).toEqual(['auto-1']);
    expect(o.awaiting.map((p) => p.project.sourceProjectId)).toEqual(['nothing-yet']);
    expect(o.discovery.automatic).toBe(false);
    expect(o.discovery.reason).toMatch(/project list/i);
  });

  it('reports two source projects with the same identity as a conflict', async () => {
    client.operationsSourceProject.findMany.mockResolvedValue([
      projectRow({ id: 'b', sourceProjectId: 'dup-1', jobOrderNormalized: '92/25', factoryCode: 'PC' }),
      projectRow({ id: 'c', sourceProjectId: 'dup-2', jobOrderNormalized: '92/25', factoryCode: 'PC' }),
    ]);
    const o = await service.listProjects(ACTOR);
    expect(o.conflicts).toHaveLength(2);
    expect(o.suggested).toHaveLength(0);
  });

  it('never reveals contracts outside the viewer’s department scope', async () => {
    deptAccess.buildDeptFilter.mockResolvedValue({ in: ['d1'] });
    client.operationsSourceProject.findMany.mockResolvedValue([
      projectRow({ id: 'a', sourceProjectId: 'hidden-link', contractId: 'c2' }),
      projectRow({ id: 'b', sourceProjectId: 'wants-hidden', jobOrderNormalized: '77/25', factoryCode: null }),
    ]);
    const o = await service.listProjects(ACTOR);
    expect(o.linked).toHaveLength(0);
    expect(JSON.stringify(o)).not.toContain('Hidden contract');
    expect(o.suggested).toHaveLength(0);
  });

  it('lists factory codes the source reported that have no plant mapping', async () => {
    client.operationsSourceProject.findMany.mockResolvedValue([projectRow({ id: 'b', sourceProjectId: 'hc-1', jobOrderNormalized: '5/26', factoryCode: 'HC' })]);
    expect((await service.listProjects(ACTOR)).unmappedFactories).toEqual(['HC']);
  });
});

describe('factory mapping', () => {
  it('normalizes the code, upserts and audits', async () => {
    client.plant.findUnique.mockResolvedValue({ id: 'pl1', isActive: true });
    tx.operationsFactoryMapping.upsert.mockResolvedValue({ id: 'm1' });
    await service.setFactoryMapping(ACTOR, { factoryCode: ' pc ', plantId: 'pl1' });
    expect(tx.operationsFactoryMapping.upsert.mock.calls[0]![0].where).toEqual({ factoryCode: 'PC' });
    expect(tx.securityAuditEvent.create.mock.calls[0]![0].data.event).toBe('operations_factory_mapping_set');
  });
  it('rejects an unknown plant', async () => {
    client.plant.findUnique.mockResolvedValue(null);
    await expect(service.setFactoryMapping(ACTOR, { factoryCode: 'PC', plantId: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });
});


describe('shared monitoring resolver (list, overview and tabs)', () => {
  const live = { id: 'sn1', origin: 'LIVE', generatedAt: new Date(), retrievedAt: new Date(), total: 100, issued: 90, produced: 60, delivered: 40, installed: 20, pendingInputs: 5, reviewRequiredFlag: null, reviewRequiredRaw: null, sourceNotes: [], flags: [], changes: [], groupBy: 'building', columns: 'x' };
  function linked(contractId: string, sourceProjectId: string, over: Record<string, unknown> = {}): Record<string, unknown> {
    return projectRow({ id: 'p-' + contractId, contractId, sourceProjectId, sourceCode: '92/25', jobOrderNormalized: '92/25', factoryCode: 'PC', lastSuccessAt: new Date(), lastAttemptAt: new Date(), lastGeneratedAt: new Date(), lastOutcome: 'ACCEPTED', currentSnapshotId: 'sn1', ...over });
  }
  beforeEach(() => {
    client.contract.findMany.mockResolvedValue([
      { id: 'c1', jobOrder: '92/25', plantId: null, departmentId: 'd1' },
      { id: 'c2', jobOrder: null, plantId: null, departmentId: 'd2' },
      { id: 'c3', jobOrder: null, plantId: null, departmentId: null },
    ]);
  });

  it('resolves a whole page with ONE project query and ONE snapshot query', async () => {
    client.operationsSourceProject.findMany.mockResolvedValue([linked('c1', 'shapoorji-2025-92')]);
    client.operationsProgressSnapshot.findMany.mockResolvedValue([live]);
    const out = await service.monitoringSummaries(['c1', 'c2', 'c3'], ACTOR);
    expect(client.operationsSourceProject.findMany).toHaveBeenCalledTimes(1);
    expect(client.operationsProgressSnapshot.findMany).toHaveBeenCalledTimes(1);
    expect(out['c1']).toMatchObject({ monitoringState: 'UPDATED', snapshotId: 'sn1', totals: { total: 100, installed: 20 } });
    expect(out['c3']).toMatchObject({ monitoringState: 'NOT_LINKED', totals: null });
  });

  it('the summary and the detailed view agree for the same contract', async () => {
    client.operationsSourceProject.findMany.mockResolvedValue([linked('c1', 'shapoorji-2025-92')]);
    client.operationsProgressSnapshot.findMany.mockResolvedValue([live]);
    const summary = (await service.monitoringSummaries(['c1'], ACTOR))['c1']!;
    const view = await service.getContractProgress('c1', ACTOR);
    expect(summary.totals).toEqual(view.data?.totals);
    expect(summary.snapshotId).toBe(view.snapshotId);
    expect(summary.monitoringState).toBe(view.monitoringState);
    expect(summary.lastSuccessfulRetrievalAt).toBe(view.data?.lastSuccessfulRetrievalAt);
  });

  it('silently drops contracts outside the viewer department scope', async () => {
    deptAccess.buildDeptFilter.mockResolvedValue({ in: ['d1'] });
    const out = await service.monitoringSummaries(['c1', 'c2', 'c3'], ACTOR);
    expect(Object.keys(out).sort()).toEqual(['c1', 'c3']);
  });

  it('a linked contract with no snapshot is waiting for the first update, never zeros', async () => {
    client.operationsSourceProject.findMany.mockResolvedValue([linked('c1', 'shapoorji-2025-92', { currentSnapshotId: null, lastSuccessAt: null, lastOutcome: null })]);
    const s = (await service.monitoringSummaries(['c1'], ACTOR))['c1']!;
    expect(s.monitoringState).toBe('WAITING_FIRST_UPDATE');
    expect(s.totals).toBeNull();
  });

  it('keeps the last figures and says delayed after a failure', async () => {
    client.operationsSourceProject.findMany.mockResolvedValue([linked('c1', 'shapoorji-2025-92', { lastOutcome: 'TIMEOUT', lastErrorMessage: 'The source did not answer in time.' })]);
    client.operationsProgressSnapshot.findMany.mockResolvedValue([live]);
    const s = (await service.monitoringSummaries(['c1'], ACTOR))['c1']!;
    expect(s).toMatchObject({ monitoringState: 'DELAYED', delayed: true, delayedReason: 'The source did not answer in time.', totals: { produced: 60 } });
  });

  it('demonstration data is invisible unless demonstration is explicitly allowed (production safety)', async () => {
    client.operationsSourceProject.findMany.mockResolvedValue([linked('c1', 'demo-shapoorji-2025-92', { currentSnapshotId: 'snd' })]);
    client.operationsProgressSnapshot.findMany.mockResolvedValue([{ ...live, id: 'snd', origin: 'FIXTURE' }]);
    const prev = { n: process.env['NODE_ENV'], d: process.env['OPERATIONS_DEMO_ENABLED'] };
    try {
      process.env['OPERATIONS_DEMO_ENABLED'] = 'true';
      process.env['NODE_ENV'] = 'production';
      const blocked = (await service.monitoringSummaries(['c1'], ACTOR))['c1']!;
      expect(blocked.monitoringState).toBe('NOT_LINKED');
      expect(blocked.totals).toBeNull();
      process.env['NODE_ENV'] = 'development';
      const allowed = (await service.monitoringSummaries(['c1'], ACTOR))['c1']!;
      expect(allowed).toMatchObject({ monitoringState: 'DEMONSTRATION', demonstration: true });
      delete process.env['OPERATIONS_DEMO_ENABLED'];
      const off = (await service.monitoringSummaries(['c1'], ACTOR))['c1']!;
      expect(off.monitoringState).toBe('NOT_LINKED');
    } finally {
      if (prev.n === undefined) delete process.env['NODE_ENV']; else process.env['NODE_ENV'] = prev.n;
      if (prev.d === undefined) delete process.env['OPERATIONS_DEMO_ENABLED']; else process.env['OPERATIONS_DEMO_ENABLED'] = prev.d;
    }
  });

  it('fingerprints change when the snapshot or retrieval time changes and not otherwise', async () => {
    const t1 = new Date('2026-10-22T10:00:00Z');
    client.operationsSourceProject.findMany.mockResolvedValue([linked('c1', 'shapoorji-2025-92', { lastSuccessAt: t1 })]);
    client.operationsProgressSnapshot.findMany.mockResolvedValue([live]);
    const a = (await service.monitoringFingerprints(['c1'], ACTOR))['c1'];
    const a2 = (await service.monitoringFingerprints(['c1'], ACTOR))['c1'];
    client.operationsProgressSnapshot.findMany.mockResolvedValue([{ ...live, id: 'sn2' }]);
    client.operationsSourceProject.findMany.mockResolvedValue([linked('c1', 'shapoorji-2025-92', { lastSuccessAt: t1, currentSnapshotId: 'sn2' })]);
    const b = (await service.monitoringFingerprints(['c1'], ACTOR))['c1'];
    expect(a).toBe(a2);
    expect(a).not.toBe(b);
  });
});


describe('manual link vs automatic matching (unset plant)', () => {
  const DRAFT = { id: 'c1', referenceNumber: 'CONTRACT-2026-000900', title: 'Draft', jobOrder: '92/25', plantId: null, departmentId: 'd1', status: 'DRAFT' };
  beforeEach(() => {
    client.contract.findUnique.mockResolvedValue(DRAFT);
    client.operationsFactoryMapping.findUnique.mockResolvedValue(null);
  });

  it('an explicit link with the plant UNSET is allowed when a reason is given, and the plant is never assigned', async () => {
    tx.operationsSourceProject.findUnique
      .mockResolvedValueOnce({ id: 'p1', sourceProjectId: 'shapoorji-2025-92', contractId: null, jobOrderNormalized: '92/25', factoryCode: 'PC', excludedReason: null })
      .mockResolvedValueOnce(null);
    const r = await service.linkProject(ACTOR, 'p1', { contractId: 'c1', reason: 'Registered from source metadata; plant not yet created' });
    expect(r.changed).toBe(true);
    const data = tx.operationsSourceProject.update.mock.calls[0]![0].data;
    expect(data).toMatchObject({ contractId: 'c1', linkMethod: 'MANUAL', linkedByUserId: 'u1' });
    expect(JSON.stringify(data)).not.toMatch(/plant/i);
    expect(tx.operationsProjectLinkEvent.create.mock.calls[0]![0].data).toMatchObject({
      action: 'LINKED',
      reason: 'Registered from source metadata; plant not yet created',
      details: expect.objectContaining({ automaticBasis: false, plantSet: false, mappedFactory: null }),
    });
  });

  it('without a reason the same link is refused (REASON_REQUIRED) and nothing is written', async () => {
    tx.operationsSourceProject.findUnique.mockResolvedValueOnce({ id: 'p1', sourceProjectId: 'shapoorji-2025-92', contractId: null, jobOrderNormalized: '92/25', factoryCode: 'PC', excludedReason: null });
    await expect(service.linkProject(ACTOR, 'p1', { contractId: 'c1' })).rejects.toMatchObject({ response: { code: 'REASON_REQUIRED' } });
    expect(tx.operationsSourceProject.update).not.toHaveBeenCalled();
    expect(tx.operationsProjectLinkEvent.create).not.toHaveBeenCalled();
  });

  it('a project whose identity is not known yet also needs a reason', async () => {
    client.contract.findUnique.mockResolvedValue({ ...DRAFT, plantId: 'pl1' });
    client.operationsFactoryMapping.findUnique.mockResolvedValue({ factoryCode: 'PC' });
    tx.operationsSourceProject.findUnique.mockResolvedValueOnce({ id: 'p1', sourceProjectId: 'x', contractId: null, jobOrderNormalized: null, factoryCode: null, excludedReason: null });
    await expect(service.linkProject(ACTOR, 'p1', { contractId: 'c1' })).rejects.toMatchObject({ response: { code: 'REASON_REQUIRED' } });
  });

  it('a confirmed job-order + mapped-factory match needs no reason (the automatic basis holds)', async () => {
    client.contract.findUnique.mockResolvedValue({ ...DRAFT, plantId: 'pl1' });
    client.operationsFactoryMapping.findUnique.mockResolvedValue({ factoryCode: 'PC' });
    tx.operationsSourceProject.findUnique
      .mockResolvedValueOnce({ id: 'p1', sourceProjectId: 'shapoorji-2025-92', contractId: null, jobOrderNormalized: '92/25', factoryCode: 'PC', excludedReason: null })
      .mockResolvedValueOnce(null);
    await service.linkProject(ACTOR, 'p1', { contractId: 'c1' });
    expect(tx.operationsProjectLinkEvent.create.mock.calls[0]![0].data.details).toMatchObject({ automaticBasis: true });
  });

  it('a different mapped factory is not an automatic basis either', async () => {
    client.contract.findUnique.mockResolvedValue({ ...DRAFT, plantId: 'pl2' });
    client.operationsFactoryMapping.findUnique.mockResolvedValue({ factoryCode: 'HC' });
    tx.operationsSourceProject.findUnique.mockResolvedValueOnce({ id: 'p1', sourceProjectId: 'x', contractId: null, jobOrderNormalized: '92/25', factoryCode: 'PC', excludedReason: null });
    await expect(service.linkProject(ACTOR, 'p1', { contractId: 'c1' })).rejects.toMatchObject({ response: { code: 'REASON_REQUIRED' } });
  });

  it('the guards that protect everything else still apply to a reasoned manual link', async () => {
    // excluded project
    tx.operationsSourceProject.findUnique.mockResolvedValueOnce({ id: 'b29', sourceProjectId: 'project_b29b21f0f3fb', contractId: null, jobOrderNormalized: '1', factoryCode: 'PC', excludedReason: 'CONFIGURED_EXCLUSION' });
    await expect(service.linkProject(ACTOR, 'b29', { contractId: 'c1', reason: 'x' })).rejects.toMatchObject({ response: { code: 'PROJECT_EXCLUDED' } });
    // one-to-one
    tx.operationsSourceProject.findUnique
      .mockResolvedValueOnce({ id: 'p1', sourceProjectId: 'a', contractId: null, jobOrderNormalized: null, factoryCode: null, excludedReason: null })
      .mockResolvedValueOnce({ id: 'p2', sourceProjectId: 'other' });
    await expect(service.linkProject(ACTOR, 'p1', { contractId: 'c1', reason: 'x' })).rejects.toBeInstanceOf(ConflictException);
    // department scope
    deptAccess.assertCanAccessDepartment.mockRejectedValueOnce(new ForbiddenException({ code: 'DEPARTMENT_ACCESS_DENIED' }));
    await expect(service.linkProject(ACTOR, 'p1', { contractId: 'c1', reason: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
