import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, UnprocessableEntityException, ConflictException } from '@nestjs/common';
import { ContractStatus, DepartmentAccessScope } from '@recafco/database';
import {
  ContractsService, getDerivedLifecycleStatus, buildListWhere,
  computeEffectiveScheduleStatus, computeContractProgressPercent, computeContractPaymentProgressPercent,
} from './contracts.service';
import type { DatabaseService } from '../database/database.service';
import type { ContractsRefService } from './contracts-ref.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';

// ---------------------------------------------------------------------------
// Transaction mocks
// ---------------------------------------------------------------------------

const mockTxContractUpdateMany = vi.fn();
const mockTxContractCreate = vi.fn();
const mockTxContractFindUniqueOrThrow = vi.fn();
const mockTxContractFindUnique = vi.fn();
const mockTxActivityCreate = vi.fn();
const mockTxCommentCreate = vi.fn();
const mockTxSecurityAuditEventCreate = vi.fn();
const mockTxBoqItemCreateMany = vi.fn();
const mockTxBoqItemDeleteMany = vi.fn();

const mockTx = {
  contract: {
    updateMany: mockTxContractUpdateMany,
    create: mockTxContractCreate,
    findUniqueOrThrow: mockTxContractFindUniqueOrThrow,
    findUnique: mockTxContractFindUnique,
  },
  contractActivity: { create: mockTxActivityCreate },
  contractComment: { create: mockTxCommentCreate },
  contractBoqItem: { createMany: mockTxBoqItemCreateMany, deleteMany: mockTxBoqItemDeleteMany },
  securityAuditEvent: { create: mockTxSecurityAuditEventCreate },
};

// ---------------------------------------------------------------------------
// Client mocks
// ---------------------------------------------------------------------------

const mockContractFindUnique = vi.fn();
const mockContractFindMany = vi.fn();
const mockContractCount = vi.fn();
const mockContractAggregate = vi.fn();
const mockContractUpdate = vi.fn();
const mockContractClaimCount = vi.fn();
const mockActivityCreate = vi.fn();
const mockCommentFindMany = vi.fn();
const mockActivityFindMany = vi.fn();
const mockUserFindMany = vi.fn();
const mockDepartmentFindMany = vi.fn();
const mockPlantFindMany = vi.fn();
const mockLocationFindMany = vi.fn();
const mockGetScope = vi.fn();
const mockCloseoutRequestFindFirst = vi.fn();
const mockTransaction = vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

const mockClient = {
  contract: {
    findUnique: mockContractFindUnique,
    findMany: mockContractFindMany,
    count: mockContractCount,
    aggregate: mockContractAggregate,
    update: mockContractUpdate,
  },
  contractClaim: { count: mockContractClaimCount },
  contractComment: { findMany: mockCommentFindMany },
  contractActivity: { findMany: mockActivityFindMany, create: mockActivityCreate },
  contractCloseoutRequest: { findFirst: mockCloseoutRequestFindFirst },
  user: { findMany: mockUserFindMany },
  department: { findMany: mockDepartmentFindMany },
  plant: { findMany: mockPlantFindMany },
  location: { findMany: mockLocationFindMany },
  $transaction: mockTransaction,
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;
const mockRef = { nextRef: vi.fn().mockResolvedValue('CONTRACT-2026-000001') } as unknown as ContractsRefService;

const mockDeptAccess = {
  buildDeptFilter: vi.fn().mockResolvedValue(null),
  getScope: mockGetScope,
  canAccessDepartment: vi.fn().mockResolvedValue(true),
  assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined),
  canGrantScope: vi.fn().mockReturnValue(true),
  getUserModuleAccessConfig: vi.fn(),
  setUserModuleAccess: vi.fn(),
} as unknown as DepartmentAccessService;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR_VIEWER: AuthUser = {
  id: 'user-viewer-1',
  username: 'alice',
  displayName: 'Alice',
  roleId: 'role-viewer',
  roleCode: 'VIEWER',
  roleName: 'Viewer',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-1',
  departmentId: null,
  permissions: ['contracts.read', 'contracts.create', 'contracts.comment'],
};

const ACTOR_ADMIN: AuthUser = {
  id: 'user-admin-1',
  username: 'admin',
  displayName: 'Admin',
  roleId: 'role-admin',
  roleCode: 'ADMIN',
  roleName: 'Admin',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-2',
  departmentId: null,
  permissions: [
    'contracts.read', 'contracts.create', 'contracts.update',
    'contracts.activate', 'contracts.terminate', 'contracts.close',
    'contracts.comment', 'contracts.manage',
  ],
};

const ACTOR_OWN_DEPT: AuthUser = {
  id: 'user-cm-1',
  username: 'cmuser',
  displayName: 'Contract Management User',
  roleId: 'role-cm',
  roleCode: 'CONTRACT_MANAGEMENT_USER',
  roleName: 'Contract Management User',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-3',
  departmentId: 'dept-own-1',
  permissions: ['contracts.read', 'contracts.create', 'contracts.update', 'contracts.comment'],
};

function makeContract(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'contract-1',
    referenceNumber: 'CONTRACT-2026-000001',
    title: 'Test Contract',
    description: null,
    status: ContractStatus.DRAFT,
    version: 1,
    counterpartyName: 'Vendor Corp',
    counterpartyContact: null,
    jobOrder: null,
    contractDate: null,
    quotationNumber: null,
    projectNumber: null,
    scopeOfWork: null,
    paymentTerms: null,
    contractValue: null,
    currency: null,
    startDate: null,
    endDate: null,
    renewalNoticeDate: null,
    clientContactName: null,
    clientContactPhone: null,
    forecastCompletionDate: null,
    originalContractValue: null,
    originalCurrency: null,
    projectSiteLocation: null,
    scopeDescription: null,
    scopeExclusions: null,
    deliverables: null,
    milestones: null,
    scheduleSummary: null,
    quantitiesSpecifications: null,
    craneRequired: null,
    craneProvidedBy: null,
    estimatedCraneCapacity: null,
    ownerUserId: 'user-admin-1',
    departmentId: null,
    plantId: null,
    locationId: null,
    notes: null,
    createdByUserId: 'user-admin-1',
    activatedAt: null,
    activatedByUserId: null,
    terminatedAt: null,
    terminatedByUserId: null,
    terminationReason: null,
    closedAt: null,
    closedByUserId: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    ownerUser: { id: 'user-admin-1', displayName: 'Admin' },
    createdByUser: { id: 'user-admin-1', displayName: 'Admin' },
    activatedByUser: null,
    terminatedByUser: null,
    closedByUser: null,
    department: null,
    plant: null,
    location: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Unit under test
// ---------------------------------------------------------------------------

let service: ContractsService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new ContractsService(mockDb, mockRef, mockDeptAccess);
  // create() always re-fetches the full record via findUniqueOrThrow after the
  // initial insert (and after any BOQ items are created) — default it to a
  // sane contract so tests that don't care about the exact shape don't crash.
  // Tests that do care override this with their own .mockResolvedValue(...).
  mockTxContractFindUniqueOrThrow.mockResolvedValue(makeContract());
  // close() now requires an APPROVED closeout request (CM-33) — default one
  // present so existing close() tests (which are about version conflicts,
  // activity logging, etc., not the approval gate) keep passing unmodified.
  // The one test that specifically covers the gate overrides this to null.
  mockCloseoutRequestFindFirst.mockResolvedValue({ id: 'closeout-request-1' });
  // CM-55 — getSummary()'s two new aggregates; default to "no value/no claims"
  // so pre-existing getSummary tests that don't care about these new fields
  // keep passing unmodified.
  mockContractAggregate.mockResolvedValue({ _sum: { contractValue: null } });
  mockContractClaimCount.mockResolvedValue(0);
});

// ---------------------------------------------------------------------------
// getDerivedLifecycleStatus (pure function)
// ---------------------------------------------------------------------------

describe('getDerivedLifecycleStatus', () => {
  const past = new Date(Date.UTC(2020, 0, 1)); // 2020-01-01
  const future = new Date(Date.UTC(2099, 11, 31)); // 2099-12-31

  it('DRAFT → DRAFT', () => {
    expect(getDerivedLifecycleStatus({ status: ContractStatus.DRAFT, endDate: null, renewalNoticeDate: null })).toBe('DRAFT');
  });

  it('TERMINATED → TERMINATED', () => {
    expect(getDerivedLifecycleStatus({ status: ContractStatus.TERMINATED, endDate: null, renewalNoticeDate: null })).toBe('TERMINATED');
  });

  it('CLOSED → CLOSED', () => {
    expect(getDerivedLifecycleStatus({ status: ContractStatus.CLOSED, endDate: null, renewalNoticeDate: null })).toBe('CLOSED');
  });

  it('ACTIVE with no dates → ACTIVE', () => {
    expect(getDerivedLifecycleStatus({ status: ContractStatus.ACTIVE, endDate: null, renewalNoticeDate: null })).toBe('ACTIVE');
  });

  it('ACTIVE with future endDate → ACTIVE', () => {
    expect(getDerivedLifecycleStatus({ status: ContractStatus.ACTIVE, endDate: future, renewalNoticeDate: null })).toBe('ACTIVE');
  });

  it('ACTIVE with past endDate → EXPIRED', () => {
    expect(getDerivedLifecycleStatus({ status: ContractStatus.ACTIVE, endDate: past, renewalNoticeDate: null })).toBe('EXPIRED');
  });

  it('ACTIVE with renewalNoticeDate in past and future endDate → EXPIRING', () => {
    expect(getDerivedLifecycleStatus({ status: ContractStatus.ACTIVE, endDate: future, renewalNoticeDate: past })).toBe('EXPIRING');
  });

  it('ACTIVE with renewalNoticeDate in past and no endDate → EXPIRING', () => {
    expect(getDerivedLifecycleStatus({ status: ContractStatus.ACTIVE, endDate: null, renewalNoticeDate: past })).toBe('EXPIRING');
  });

  it('ACTIVE with future renewalNoticeDate and future endDate → ACTIVE', () => {
    expect(getDerivedLifecycleStatus({ status: ContractStatus.ACTIVE, endDate: future, renewalNoticeDate: future })).toBe('ACTIVE');
  });

  it('ACTIVE endDate expired takes precedence over renewalNoticeDate → EXPIRED', () => {
    // endDate in past means EXPIRED even if renewalNoticeDate is also in past
    expect(getDerivedLifecycleStatus({ status: ContractStatus.ACTIVE, endDate: past, renewalNoticeDate: past })).toBe('EXPIRED');
  });
});

// ---------------------------------------------------------------------------
// buildListWhere
// ---------------------------------------------------------------------------

describe('buildListWhere', () => {
  it('CM-69C — empty query (a fresh page load) excludes CANCELLED by default', () => {
    const where = buildListWhere({});
    expect(where).toEqual({ status: { not: ContractStatus.CANCELLED } });
  });

  it('CM-69C — lifecycleStatus=ALL is an explicit request for every status, CANCELLED included (no status filter at all)', () => {
    const where = buildListWhere({ lifecycleStatus: 'ALL' });
    expect(where['status']).toBeUndefined();
  });

  it('CM-69C — status=ALL is also an explicit request for every status, CANCELLED included', () => {
    const where = buildListWhere({ status: 'ALL' });
    expect(where['status']).toBeUndefined();
  });

  it('CM-69C — lifecycleStatus=CANCELLED shows only CANCELLED contracts', () => {
    const where = buildListWhere({ lifecycleStatus: 'CANCELLED' });
    expect(where['status']).toBe(ContractStatus.CANCELLED);
  });

  it('status filter sets status', () => {
    const where = buildListWhere({ status: 'ACTIVE' });
    expect(where['status']).toBe('ACTIVE');
  });

  it('lifecycleStatus=EXPIRING translates to date conditions', () => {
    const where = buildListWhere({ lifecycleStatus: 'EXPIRING' });
    expect(where['status']).toBe(ContractStatus.ACTIVE);
    expect(where['renewalNoticeDate']).toBeDefined();
    expect(where['AND']).toBeDefined();
    expect((where['AND'] as Record<string, unknown>[])[0]!['OR']).toBeDefined();
  });

  it('lifecycleStatus=EXPIRED translates to endDate < today', () => {
    const where = buildListWhere({ lifecycleStatus: 'EXPIRED' });
    expect(where['status']).toBe(ContractStatus.ACTIVE);
    expect(where['endDate']).toBeDefined();
  });

  it('lifecycleStatus overrides status filter', () => {
    const where = buildListWhere({ lifecycleStatus: 'EXPIRING', status: 'CLOSED' });
    expect(where['status']).toBe(ContractStatus.ACTIVE); // lifecycleStatus wins
  });

  it('search adds OR ilike on title, referenceNumber, jobOrder, counterpartyName', () => {
    const where = buildListWhere({ search: 'foo' });
    const and = where['AND'] as Record<string, unknown>[];
    expect(Array.isArray(and)).toBe(true);
    const searchOr = and[0]!['OR'] as Record<string, unknown>[];
    expect(Array.isArray(searchOr)).toBe(true);
    const fields = searchOr.map((c) => Object.keys(c)[0]);
    expect(fields).toEqual(['title', 'referenceNumber', 'jobOrder', 'counterpartyName']);
  });

  it('CM-69C — search alone (no explicit status filter) still excludes CANCELLED by default', () => {
    const where = buildListWhere({ search: 'test project' });
    expect(where['status']).toEqual({ not: ContractStatus.CANCELLED });
  });

  it('CM-69C — search combined with an explicit ALL status filter does include CANCELLED', () => {
    const where = buildListWhere({ search: 'test project', lifecycleStatus: 'ALL' });
    expect(where['status']).toBeUndefined();
  });

  it('lifecycleStatus=EXPIRING and search combine without clobbering each other', () => {
    const where = buildListWhere({ lifecycleStatus: 'EXPIRING', search: 'foo' });
    const and = where['AND'] as Record<string, unknown>[];
    expect(and).toHaveLength(2);
    expect(and[0]!['OR']).toBeDefined();
    expect(and[1]!['OR']).toBeDefined();
  });

  it('contractType filters on the real scopeOfWork JSONB flag', () => {
    const where = buildListWhere({ contractType: 'erection' });
    expect(where['scopeOfWork']).toEqual({ path: ['erection'], equals: true });
  });

  it('scheduleStatus=DELAYED matches only the explicit stored value (no null fallback)', () => {
    const where = buildListWhere({ scheduleStatus: 'DELAYED' });
    const and = where['AND'] as Record<string, unknown>[];
    expect(and[0]).toEqual({ scheduleStatus: 'DELAYED' });
  });

  it('scheduleStatus=IN_PROGRESS also matches contracts with scheduleStatus null and status not CLOSED', () => {
    const where = buildListWhere({ scheduleStatus: 'IN_PROGRESS' });
    const and = where['AND'] as Record<string, unknown>[];
    const or = and[0]!['OR'] as Record<string, unknown>[];
    expect(or).toContainEqual({ scheduleStatus: 'IN_PROGRESS' });
    expect(or).toContainEqual({ AND: [{ scheduleStatus: null }, { status: { not: ContractStatus.CLOSED } }] });
  });

  it('scheduleStatus=COMPLETED also matches contracts with scheduleStatus null and status CLOSED', () => {
    const where = buildListWhere({ scheduleStatus: 'COMPLETED' });
    const and = where['AND'] as Record<string, unknown>[];
    const or = and[0]!['OR'] as Record<string, unknown>[];
    expect(or).toContainEqual({ scheduleStatus: 'COMPLETED' });
    expect(or).toContainEqual({ AND: [{ scheduleStatus: null }, { status: ContractStatus.CLOSED }] });
  });

  it('daysRemaining=OVERDUE matches forecastCompletionDate < today, falling back to endDate when forecast is unset', () => {
    const where = buildListWhere({ daysRemaining: 'OVERDUE' });
    const and = where['AND'] as Record<string, unknown>[];
    const or = and[0]!['OR'] as Record<string, unknown>[];
    expect(or[0]).toHaveProperty('forecastCompletionDate');
    expect(or[1]).toEqual({ AND: [{ forecastCompletionDate: null }, { endDate: expect.objectContaining({ lt: expect.any(Date) }) }] });
  });

  it('daysRemaining=DUE_30 vs DUE_60 use different window widths', () => {
    const where30 = buildListWhere({ daysRemaining: 'DUE_30' });
    const where60 = buildListWhere({ daysRemaining: 'DUE_60' });
    const lte30 = ((where30['AND'] as Record<string, unknown>[])[0]!['OR'] as Record<string, unknown>[])[0]!['forecastCompletionDate'] as { lte: Date };
    const lte60 = ((where60['AND'] as Record<string, unknown>[])[0]!['OR'] as Record<string, unknown>[])[0]!['forecastCompletionDate'] as { lte: Date };
    expect(lte60.lte.getTime()).toBeGreaterThan(lte30.lte.getTime());
  });

  it('ownerUserId filter', () => {
    const where = buildListWhere({ ownerUserId: 'uuid-1' });
    expect(where['ownerUserId']).toBe('uuid-1');
  });

  it('departmentId filter', () => {
    const where = buildListWhere({ departmentId: 'dept-1' });
    expect(where['departmentId']).toBe('dept-1');
  });
});

// ---------------------------------------------------------------------------
// CM-55 — computeEffectiveScheduleStatus / computeContractProgressPercent /
// computeContractPaymentProgressPercent (pure functions)
// ---------------------------------------------------------------------------

describe('computeEffectiveScheduleStatus', () => {
  it('returns the stored value when set, regardless of lifecycle status', () => {
    expect(computeEffectiveScheduleStatus({ scheduleStatus: 'DELAYED', status: ContractStatus.ACTIVE })).toBe('DELAYED');
    expect(computeEffectiveScheduleStatus({ scheduleStatus: 'AHEAD_OF_SCHEDULE', status: ContractStatus.CLOSED })).toBe('AHEAD_OF_SCHEDULE');
  });

  it('defaults to IN_PROGRESS when unset and status is not CLOSED', () => {
    expect(computeEffectiveScheduleStatus({ scheduleStatus: null, status: ContractStatus.ACTIVE })).toBe('IN_PROGRESS');
    expect(computeEffectiveScheduleStatus({ scheduleStatus: null, status: ContractStatus.DRAFT })).toBe('IN_PROGRESS');
    expect(computeEffectiveScheduleStatus({ scheduleStatus: null, status: ContractStatus.TERMINATED })).toBe('IN_PROGRESS');
  });

  it('defaults to COMPLETED when unset and status is CLOSED', () => {
    expect(computeEffectiveScheduleStatus({ scheduleStatus: null, status: ContractStatus.CLOSED })).toBe('COMPLETED');
  });

  it('never infers DELAYED/ON_TRACK/AHEAD_OF_SCHEDULE from lifecycle alone', () => {
    for (const status of [ContractStatus.DRAFT, ContractStatus.ACTIVE, ContractStatus.TERMINATED, ContractStatus.CLOSED]) {
      const result = computeEffectiveScheduleStatus({ scheduleStatus: null, status });
      expect(['DELAYED', 'ON_TRACK', 'AHEAD_OF_SCHEDULE']).not.toContain(result);
    }
  });
});

describe('computeContractProgressPercent', () => {
  it('returns 0 for no tasks (not NaN)', () => {
    expect(computeContractProgressPercent([])).toBe(0);
  });

  it('computes completed/total as a rounded percent', () => {
    expect(computeContractProgressPercent([{ status: 'COMPLETED' }, { status: 'IN_PROGRESS' }, { status: 'NOT_STARTED' }, { status: 'COMPLETED' }])).toBe(50);
  });

  it('returns 100 when every task is completed', () => {
    expect(computeContractProgressPercent([{ status: 'COMPLETED' }, { status: 'COMPLETED' }])).toBe(100);
  });
});

describe('computeContractPaymentProgressPercent', () => {
  it('returns 0 when contractValue is null or zero (never divides by zero)', () => {
    expect(computeContractPaymentProgressPercent([{ paidAmount: '500.000' }], null)).toBe(0);
    expect(computeContractPaymentProgressPercent([{ paidAmount: '500.000' }], '0.000')).toBe(0);
  });

  it('computes total paid / current value as a rounded percent', () => {
    expect(computeContractPaymentProgressPercent([{ paidAmount: '250.000' }, { paidAmount: '250.000' }], '1000.000')).toBe(50);
  });

  it('returns 0 for a contract with a value but no payments yet', () => {
    expect(computeContractPaymentProgressPercent([], '1000.000')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe('ContractsService.create', () => {
  it('throws ForbiddenException without contracts.create permission', async () => {
    const noPerms: AuthUser = { ...ACTOR_VIEWER, permissions: ['contracts.read'] };
    await expect(service.create({ title: 'T', counterpartyName: 'V' }, noPerms)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when setting different owner without manage', async () => {
    await expect(
      service.create({ title: 'T', counterpartyName: 'V', ownerUserId: 'other-user' }, ACTOR_VIEWER),
    ).rejects.toThrow(ForbiddenException);
  });

  it('defaults ownerUserId to actor.id when not provided', async () => {
    const contract = makeContract();
    mockTxContractCreate.mockResolvedValue(contract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.create({ title: 'T', counterpartyName: 'V' }, ACTOR_VIEWER);

    const createCall = mockTxContractCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createCall.data['ownerUserId']).toBe(ACTOR_VIEWER.id);
  });

  it('allows admin to set different owner with manage permission', async () => {
    const contract = makeContract({ ownerUserId: 'other-user' });
    mockTxContractCreate.mockResolvedValue(contract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.create({ title: 'T', counterpartyName: 'V', ownerUserId: 'other-user' }, ACTOR_ADMIN);

    const createCall = mockTxContractCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createCall.data['ownerUserId']).toBe('other-user');
  });

  it('creates contract with DRAFT status and version=1', async () => {
    const contract = makeContract();
    mockTxContractCreate.mockResolvedValue(contract);
    mockTxActivityCreate.mockResolvedValue({});

    const result = await service.create({ title: 'T', counterpartyName: 'V' }, ACTOR_VIEWER);

    const createCall = mockTxContractCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createCall.data['status']).toBe(ContractStatus.DRAFT);
    expect(createCall.data['version']).toBe(1);
    expect(result.lifecycleStatus).toBe('DRAFT');
  });

  it('creates activity record with event=created and newStatus=DRAFT', async () => {
    const contract = makeContract();
    mockTxContractCreate.mockResolvedValue(contract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.create({ title: 'T', counterpartyName: 'V' }, ACTOR_VIEWER);

    const activityCall = mockTxActivityCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(activityCall.data['event']).toBe('created');
    expect(activityCall.data['newStatus']).toBe(ContractStatus.DRAFT);
  });

  it('calls ref.nextRef inside the transaction', async () => {
    const contract = makeContract();
    mockTxContractCreate.mockResolvedValue(contract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.create({ title: 'T', counterpartyName: 'V' }, ACTOR_VIEWER);

    expect(mockRef.nextRef).toHaveBeenCalledWith(mockTx, expect.any(Number));
  });

  it('writes a CONTRACT_CREATED security audit event', async () => {
    const contract = makeContract();
    mockTxContractCreate.mockResolvedValue(contract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.create({ title: 'T', counterpartyName: 'V', departmentId: 'dept-1' }, ACTOR_VIEWER);

    expect(mockTxSecurityAuditEventCreate).toHaveBeenCalledTimes(1);
    const auditCall = mockTxSecurityAuditEventCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(auditCall.data['event']).toBe('CONTRACT_CREATED');
    expect(auditCall.data['userId']).toBe(ACTOR_VIEWER.id);
    expect(auditCall.data['actorId']).toBe(ACTOR_VIEWER.id);
    expect(auditCall.data['metadata']).toMatchObject({ contractId: contract['id'], departmentId: 'dept-1' });
  });

  it('enforces department access scope on create', async () => {
    const contract = makeContract();
    mockTxContractCreate.mockResolvedValue(contract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.create({ title: 'T', counterpartyName: 'V', departmentId: 'dept-9' }, ACTOR_VIEWER);

    expect(mockDeptAccess.assertCanAccessDepartment).toHaveBeenCalledWith(
      ACTOR_VIEWER,
      'CONTRACTS_MANAGEMENT',
      'dept-9',
    );
  });

  it('auto-assigns actor.departmentId when scope is OWN_DEPARTMENT and no departmentId given', async () => {
    mockGetScope.mockResolvedValueOnce(DepartmentAccessScope.OWN_DEPARTMENT);
    const contract = makeContract({ departmentId: ACTOR_OWN_DEPT.departmentId });
    mockTxContractCreate.mockResolvedValue(contract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.create({ title: 'T', counterpartyName: 'V' }, ACTOR_OWN_DEPT);

    const createCall = mockTxContractCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createCall.data['departmentId']).toBe('dept-own-1');
    expect(mockDeptAccess.assertCanAccessDepartment).toHaveBeenCalledWith(
      ACTOR_OWN_DEPT,
      'CONTRACTS_MANAGEMENT',
      'dept-own-1',
    );
  });

  it('throws UnprocessableEntityException when OWN_DEPARTMENT actor has no department', async () => {
    mockGetScope.mockResolvedValueOnce(DepartmentAccessScope.OWN_DEPARTMENT);
    const noDeptActor: AuthUser = { ...ACTOR_OWN_DEPT, departmentId: null };

    await expect(service.create({ title: 'T', counterpartyName: 'V' }, noDeptActor)).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(mockTxContractCreate).not.toHaveBeenCalled();
  });

  it('does not auto-assign department when scope is ALL_DEPARTMENTS', async () => {
    mockGetScope.mockResolvedValueOnce(DepartmentAccessScope.ALL_DEPARTMENTS);
    const contract = makeContract();
    mockTxContractCreate.mockResolvedValue(contract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.create({ title: 'T', counterpartyName: 'V' }, ACTOR_ADMIN);

    const createCall = mockTxContractCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createCall.data['departmentId']).toBeUndefined();
  });

  it('explicit departmentId in dto takes precedence over auto-default (getScope not consulted)', async () => {
    const contract = makeContract({ departmentId: 'dept-explicit' });
    mockTxContractCreate.mockResolvedValue(contract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.create({ title: 'T', counterpartyName: 'V', departmentId: 'dept-explicit' }, ACTOR_OWN_DEPT);

    const createCall = mockTxContractCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createCall.data['departmentId']).toBe('dept-explicit');
    expect(mockGetScope).not.toHaveBeenCalled();
  });

  it('persists jobOrder, contractDate, quotationNumber, projectNumber, scopeOfWork, paymentTerms when provided', async () => {
    const contract = makeContract();
    mockTxContractCreate.mockResolvedValue(contract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.create(
      {
        title: 'T',
        counterpartyName: 'V',
        jobOrder: 'JO-100',
        contractDate: '2026-08-17',
        quotationNumber: 'Q-200',
        projectNumber: 'P-300',
        scopeOfWork: { shopDrawing: true, delivery: false },
        paymentTerms: { advance: true },
      },
      ACTOR_VIEWER,
    );

    const createCall = mockTxContractCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createCall.data['jobOrder']).toBe('JO-100');
    expect(createCall.data['contractDate']).toEqual(new Date('2026-08-17'));
    expect(createCall.data['quotationNumber']).toBe('Q-200');
    expect(createCall.data['projectNumber']).toBe('P-300');
    expect(createCall.data['scopeOfWork']).toEqual({ shopDrawing: true, delivery: false });
    expect(createCall.data['paymentTerms']).toEqual({ advance: true });
  });

  it('omits register fields from create data when not provided', async () => {
    const contract = makeContract();
    mockTxContractCreate.mockResolvedValue(contract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.create({ title: 'T', counterpartyName: 'V' }, ACTOR_VIEWER);

    const createCall = mockTxContractCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createCall.data['jobOrder']).toBeUndefined();
    expect(createCall.data['contractDate']).toBeUndefined();
    expect(createCall.data['scopeOfWork']).toBeUndefined();
    expect(createCall.data['paymentTerms']).toBeUndefined();
  });

  it('creates BOQ items and computes totalPrice from originalEstimatedQty × unitPrice', async () => {
    mockTxContractCreate.mockResolvedValue(makeContract());
    mockTxActivityCreate.mockResolvedValue({});

    await service.create(
      {
        title: 'T',
        counterpartyName: 'V',
        boqItems: [
          { description: 'Precast concrete panels', originalEstimatedQty: 100, unitPrice: 25.5, itemCode: 'PC-001' },
        ],
      },
      ACTOR_VIEWER,
    );

    const boqCall = mockTxBoqItemCreateMany.mock.calls[0]![0] as { data: Record<string, unknown>[] };
    expect(boqCall.data).toHaveLength(1);
    expect(boqCall.data[0]!['sortOrder']).toBe(1);
    expect(boqCall.data[0]!['itemCode']).toBe('PC-001');
    expect(boqCall.data[0]!['totalPrice']).toBe(2550);
  });

  it('CM-56 — persists invoiceQty on a BOQ item, and totalPrice is unaffected by it', async () => {
    mockTxContractCreate.mockResolvedValue(makeContract());
    mockTxActivityCreate.mockResolvedValue({});

    await service.create(
      {
        title: 'T',
        counterpartyName: 'V',
        boqItems: [
          { description: 'Precast concrete panels', originalEstimatedQty: 100, unitPrice: 25.5, invoiceQty: 40 },
        ],
      },
      ACTOR_VIEWER,
    );

    const boqCall = mockTxBoqItemCreateMany.mock.calls[0]![0] as { data: Record<string, unknown>[] };
    expect(boqCall.data[0]!['invoiceQty']).toBe(40);
    expect(boqCall.data[0]!['totalPrice']).toBe(2550);
  });

  it('CM-56 — omits invoiceQty from the create payload when not provided (stays unset, not forced to 0)', async () => {
    mockTxContractCreate.mockResolvedValue(makeContract());
    mockTxActivityCreate.mockResolvedValue({});

    await service.create(
      { title: 'T', counterpartyName: 'V', boqItems: [{ description: 'No invoice qty yet', unitPrice: 5 }] },
      ACTOR_VIEWER,
    );

    const boqCall = mockTxBoqItemCreateMany.mock.calls[0]![0] as { data: Record<string, unknown>[] };
    expect('invoiceQty' in boqCall.data[0]!).toBe(false);
  });

  it('CM-56D — persists drawingQty on a BOQ item, and totalPrice is unaffected by it', async () => {
    mockTxContractCreate.mockResolvedValue(makeContract());
    mockTxActivityCreate.mockResolvedValue({});

    await service.create(
      {
        title: 'T',
        counterpartyName: 'V',
        boqItems: [
          { description: 'Precast concrete panels', originalEstimatedQty: 100, unitPrice: 25.5, drawingQty: 90 },
        ],
      },
      ACTOR_VIEWER,
    );

    const boqCall = mockTxBoqItemCreateMany.mock.calls[0]![0] as { data: Record<string, unknown>[] };
    expect(boqCall.data[0]!['drawingQty']).toBe(90);
    expect(boqCall.data[0]!['totalPrice']).toBe(2550);
  });

  it('CM-56D — omits drawingQty from the create payload when not provided (stays unset, not forced to 0)', async () => {
    mockTxContractCreate.mockResolvedValue(makeContract());
    mockTxActivityCreate.mockResolvedValue({});

    await service.create(
      { title: 'T', counterpartyName: 'V', boqItems: [{ description: 'No drawing qty yet', unitPrice: 5 }] },
      ACTOR_VIEWER,
    );

    const boqCall = mockTxBoqItemCreateMany.mock.calls[0]![0] as { data: Record<string, unknown>[] };
    expect('drawingQty' in boqCall.data[0]!).toBe(false);
  });

  it('uses revisedQty over originalEstimatedQty for totalPrice when both provided', async () => {
    mockTxContractCreate.mockResolvedValue(makeContract());
    mockTxActivityCreate.mockResolvedValue({});

    await service.create(
      {
        title: 'T',
        counterpartyName: 'V',
        boqItems: [
          { description: 'Precast concrete panels', originalEstimatedQty: 100, revisedQty: 120, unitPrice: 25.5 },
        ],
      },
      ACTOR_VIEWER,
    );

    const boqCall = mockTxBoqItemCreateMany.mock.calls[0]![0] as { data: Record<string, unknown>[] };
    expect(boqCall.data[0]!['totalPrice']).toBe(3060);
  });

  it('sets totalPrice to null when quantity or unitPrice is missing', async () => {
    mockTxContractCreate.mockResolvedValue(makeContract());
    mockTxActivityCreate.mockResolvedValue({});

    await service.create(
      { title: 'T', counterpartyName: 'V', boqItems: [{ description: 'No price yet' }] },
      ACTOR_VIEWER,
    );

    const boqCall = mockTxBoqItemCreateMany.mock.calls[0]![0] as { data: Record<string, unknown>[] };
    expect(boqCall.data[0]!['totalPrice']).toBeNull();
  });

  it('recalculates contractValue as the sum of BOQ totalPrice values when BOQ items are provided', async () => {
    mockTxContractCreate.mockResolvedValue(makeContract());
    mockTxActivityCreate.mockResolvedValue({});

    await service.create(
      {
        title: 'T',
        counterpartyName: 'V',
        contractValue: 999999, // should be ignored/overridden — BOQ totals are the source of truth
        boqItems: [
          { description: 'Item A', originalEstimatedQty: 100, unitPrice: 25.5 },
          { description: 'Item B', originalEstimatedQty: 10, unitPrice: 2 },
        ],
      },
      ACTOR_VIEWER,
    );

    const createCall = mockTxContractCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createCall.data['contractValue']).toBe(2570);
    expect(createCall.data['currency']).toBe('KWD');
  });

  it('preserves manually-provided contractValue when no BOQ items are given', async () => {
    mockTxContractCreate.mockResolvedValue(makeContract());
    mockTxActivityCreate.mockResolvedValue({});

    await service.create({ title: 'T', counterpartyName: 'V', contractValue: 500 }, ACTOR_VIEWER);

    const createCall = mockTxContractCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createCall.data['contractValue']).toBe(500);
    expect(createCall.data['currency']).toBeUndefined();
    expect(mockTxBoqItemCreateMany).not.toHaveBeenCalled();
  });

  it('rejects duplicate BOQ item codes within the same contract', async () => {
    await expect(
      service.create(
        {
          title: 'T',
          counterpartyName: 'V',
          boqItems: [
            { description: 'Item A', itemCode: 'DUP-1' },
            { description: 'Item B', itemCode: 'DUP-1' },
          ],
        },
        ACTOR_VIEWER,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mockTxContractCreate).not.toHaveBeenCalled();
  });

  it('allows multiple BOQ items with no itemCode (nulls are not duplicates)', async () => {
    mockTxContractCreate.mockResolvedValue(makeContract());
    mockTxActivityCreate.mockResolvedValue({});

    await service.create(
      {
        title: 'T',
        counterpartyName: 'V',
        boqItems: [{ description: 'Item A' }, { description: 'Item B' }],
      },
      ACTOR_VIEWER,
    );

    const boqCall = mockTxBoqItemCreateMany.mock.calls[0]![0] as { data: Record<string, unknown>[] };
    expect(boqCall.data).toHaveLength(2);
  });

  it('rejects Ex-Factory selected together with Erection on create', async () => {
    await expect(
      service.create(
        { title: 'T', counterpartyName: 'V', scopeOfWork: { exFactory: true, erection: true } },
        ACTOR_VIEWER,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mockTxContractCreate).not.toHaveBeenCalled();
  });

  it('allows Delivery and Erection together when Ex-Factory is not selected', async () => {
    mockTxContractCreate.mockResolvedValue(makeContract());
    mockTxActivityCreate.mockResolvedValue({});

    await expect(
      service.create(
        { title: 'T', counterpartyName: 'V', scopeOfWork: { delivery: true, erection: true } },
        ACTOR_VIEWER,
      ),
    ).resolves.toBeDefined();
  });

  it('rejects Not Applicable selected together with an active scope option', async () => {
    await expect(
      service.create(
        { title: 'T', counterpartyName: 'V', scopeOfWork: { notApplicable: true, production: true } },
        ACTOR_VIEWER,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mockTxContractCreate).not.toHaveBeenCalled();
  });

  it('allows Not Applicable alone', async () => {
    mockTxContractCreate.mockResolvedValue(makeContract());
    mockTxActivityCreate.mockResolvedValue({});

    await expect(
      service.create({ title: 'T', counterpartyName: 'V', scopeOfWork: { notApplicable: true } }, ACTOR_VIEWER),
    ).resolves.toBeDefined();
  });

  it('rejects Other selected without otherDescription', async () => {
    await expect(
      service.create({ title: 'T', counterpartyName: 'V', scopeOfWork: { other: true } }, ACTOR_VIEWER),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mockTxContractCreate).not.toHaveBeenCalled();
  });

  it('allows Other selected with a non-empty otherDescription', async () => {
    mockTxContractCreate.mockResolvedValue(makeContract());
    mockTxActivityCreate.mockResolvedValue({});

    await expect(
      service.create(
        { title: 'T', counterpartyName: 'V', scopeOfWork: { other: true, otherDescription: 'Custom scope item' } },
        ACTOR_VIEWER,
      ),
    ).resolves.toBeDefined();
  });

  it('rejects crane fields when Erection is not selected', async () => {
    await expect(
      service.create(
        { title: 'T', counterpartyName: 'V', craneRequired: 'YES' },
        ACTOR_VIEWER,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mockTxContractCreate).not.toHaveBeenCalled();
  });

  it('allows crane fields when Erection is selected', async () => {
    mockTxContractCreate.mockResolvedValue(makeContract());
    mockTxActivityCreate.mockResolvedValue({});

    await expect(
      service.create(
        {
          title: 'T',
          counterpartyName: 'V',
          scopeOfWork: { erection: true },
          craneRequired: 'YES',
          craneProvidedBy: 'RECAFCO',
          estimatedCraneCapacity: '50 tons',
        },
        ACTOR_VIEWER,
      ),
    ).resolves.toBeDefined();
  });

  it('persists the new client/date/value/scope-detail/crane fields', async () => {
    mockTxContractCreate.mockResolvedValue(makeContract());
    mockTxActivityCreate.mockResolvedValue({});

    await service.create(
      {
        title: 'T',
        counterpartyName: 'V',
        clientContactName: 'Jane Client',
        clientContactPhone: '+965 1234 5678',
        forecastCompletionDate: '2026-12-01',
        projectSiteLocation: 'Kuwait City, Block 4',
        scopeDescription: 'Full precast supply and install',
        scopeExclusions: 'Excludes foundation works',
        deliverables: 'Shop drawings, panels, erection',
        milestones: 'M1: Design, M2: Production, M3: Erection',
        scheduleSummary: '6 months from award',
        quantitiesSpecifications: '500 m² precast, C40',
        scopeOfWork: { erection: true },
        craneRequired: 'NOT_DECIDED',
        craneProvidedBy: 'CLIENT',
        estimatedCraneCapacity: '25 tons',
      },
      ACTOR_VIEWER,
    );

    const createCall = mockTxContractCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createCall.data['clientContactName']).toBe('Jane Client');
    expect(createCall.data['clientContactPhone']).toBe('+965 1234 5678');
    expect(createCall.data['forecastCompletionDate']).toEqual(new Date('2026-12-01'));
    expect(createCall.data['projectSiteLocation']).toBe('Kuwait City, Block 4');
    expect(createCall.data['scopeDescription']).toBe('Full precast supply and install');
    expect(createCall.data['scopeExclusions']).toBe('Excludes foundation works');
    expect(createCall.data['deliverables']).toBe('Shop drawings, panels, erection');
    expect(createCall.data['milestones']).toBe('M1: Design, M2: Production, M3: Erection');
    expect(createCall.data['scheduleSummary']).toBe('6 months from award');
    expect(createCall.data['quantitiesSpecifications']).toBe('500 m² precast, C40');
    expect(createCall.data['craneRequired']).toBe('NOT_DECIDED');
    expect(createCall.data['craneProvidedBy']).toBe('CLIENT');
    expect(createCall.data['estimatedCraneCapacity']).toBe('25 tons');
  });

  it('defaults originalContractValue/originalCurrency to the initial contractValue/currency when not provided', async () => {
    mockTxContractCreate.mockResolvedValue(makeContract());
    mockTxActivityCreate.mockResolvedValue({});

    await service.create({ title: 'T', counterpartyName: 'V', contractValue: 1000, currency: 'KWD' }, ACTOR_VIEWER);

    const createCall = mockTxContractCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createCall.data['originalContractValue']).toBe(1000);
    expect(createCall.data['originalCurrency']).toBe('KWD');
  });

  it('uses an explicitly provided originalContractValue instead of defaulting', async () => {
    mockTxContractCreate.mockResolvedValue(makeContract());
    mockTxActivityCreate.mockResolvedValue({});

    await service.create(
      { title: 'T', counterpartyName: 'V', contractValue: 1000, originalContractValue: 1500 },
      ACTOR_VIEWER,
    );

    const createCall = mockTxContractCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createCall.data['contractValue']).toBe(1000);
    expect(createCall.data['originalContractValue']).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe('ContractsService.update', () => {
  it('throws ForbiddenException without contracts.update', async () => {
    await expect(service.update('id-1', { version: 1, title: 'New' }, ACTOR_VIEWER)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when changing owner without manage', async () => {
    const draftContract = makeContract();
    mockContractFindUnique.mockResolvedValue(draftContract);
    const noManage: AuthUser = { ...ACTOR_ADMIN, permissions: ['contracts.update', 'contracts.read'] };
    await expect(service.update('id-1', { version: 1, ownerUserId: 'other' }, noManage)).rejects.toThrow(ForbiddenException);
  });

  it('throws UnprocessableEntityException if contract is not DRAFT', async () => {
    const activeContract = makeContract({ status: ContractStatus.ACTIVE });
    mockContractFindUnique.mockResolvedValue(activeContract);
    await expect(service.update('id-1', { version: 1, title: 'New' }, ACTOR_ADMIN)).rejects.toThrow(UnprocessableEntityException);
  });

  it('throws ConflictException when client submits stale version', async () => {
    const draftContract = makeContract({ version: 3 });
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 0 });
    mockTxContractFindUnique.mockResolvedValue({ id: 'contract-1' });

    // Client submits version=1, DB is at version=3 → count=0 → 409
    await expect(service.update('id-1', { version: 1, title: 'New' }, ACTOR_ADMIN)).rejects.toThrow(ConflictException);
  });

  it('succeeds when submitted version matches DB version', async () => {
    const draftContract = makeContract({ version: 2 });
    const updatedContract = makeContract({ title: 'New Title', version: 3 });
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(updatedContract);
    mockTxActivityCreate.mockResolvedValue({});

    const result = await service.update('id-1', { version: 2, title: 'New Title' }, ACTOR_ADMIN);
    expect(result.title).toBe('New Title');
  });

  it('uses dto.version (not DB-fetched version) in updateMany WHERE clause', async () => {
    const draftContract = makeContract({ version: 5 });
    const updatedContract = makeContract({ version: 6 });
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(updatedContract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.update('id-1', { version: 5, title: 'T' }, ACTOR_ADMIN);

    const updateCall = mockTxContractUpdateMany.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(updateCall.where['version']).toBe(5);
  });

  it('increments version on successful update', async () => {
    const draftContract = makeContract({ version: 3 });
    const updatedContract = makeContract({ version: 4 });
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(updatedContract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.update('id-1', { version: 3, title: 'T' }, ACTOR_ADMIN);

    const updateCall = mockTxContractUpdateMany.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(updateCall.data['version']).toEqual({ increment: 1 });
  });

  it('two concurrent updates with same original version: second fails with 409', async () => {
    const draftContract = makeContract({ version: 2 });
    const updatedContract = makeContract({ version: 3 });

    // User A submits version=2 → succeeds
    mockContractFindUnique.mockResolvedValueOnce(draftContract);
    mockTxContractUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValueOnce(updatedContract);
    mockTxActivityCreate.mockResolvedValueOnce({});
    await service.update('id-1', { version: 2, title: 'User A' }, ACTOR_ADMIN);

    // User B also submits version=2 (DB is now at version=3) → conflict
    mockContractFindUnique.mockResolvedValueOnce(draftContract);
    mockTxContractUpdateMany.mockResolvedValueOnce({ count: 0 });
    mockTxContractFindUnique.mockResolvedValueOnce({ id: 'contract-1' });
    await expect(service.update('id-1', { version: 2, title: 'User B' }, ACTOR_ADMIN))
      .rejects.toThrow(ConflictException);
  });

  it('creates activity record with event=updated', async () => {
    const draftContract = makeContract();
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(draftContract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.update('id-1', { version: 1, title: 'New' }, ACTOR_ADMIN);

    const activityCall = mockTxActivityCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(activityCall.data['event']).toBe('updated');
  });

  it('throws NotFoundException when contract does not exist', async () => {
    mockContractFindUnique.mockResolvedValue(null);
    await expect(service.update('missing-id', { version: 1, title: 'New' }, ACTOR_ADMIN)).rejects.toThrow(NotFoundException);
  });

  it('persists jobOrder, contractDate, quotationNumber, projectNumber, scopeOfWork, paymentTerms when provided', async () => {
    const draftContract = makeContract();
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(draftContract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.update(
      'id-1',
      {
        version: 1,
        jobOrder: 'JO-100',
        contractDate: '2026-08-17',
        quotationNumber: 'Q-200',
        projectNumber: 'P-300',
        scopeOfWork: { production: true },
        paymentTerms: { retention: true },
      },
      ACTOR_ADMIN,
    );

    const updateCall = mockTxContractUpdateMany.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(updateCall.data['jobOrder']).toBe('JO-100');
    expect(updateCall.data['contractDate']).toEqual(new Date('2026-08-17'));
    expect(updateCall.data['quotationNumber']).toBe('Q-200');
    expect(updateCall.data['projectNumber']).toBe('P-300');
    expect(updateCall.data['scopeOfWork']).toEqual({ production: true });
    expect(updateCall.data['paymentTerms']).toEqual({ retention: true });
  });

  it('writes a CONTRACT_UPDATED security audit event with changed-field diff', async () => {
    const draftContract = makeContract({ title: 'Old Title', departmentId: 'dept-1' });
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(makeContract({ title: 'New Title', version: 2 }));
    mockTxActivityCreate.mockResolvedValue({});

    await service.update('id-1', { version: 1, title: 'New Title' }, ACTOR_ADMIN);

    expect(mockTxSecurityAuditEventCreate).toHaveBeenCalledTimes(1);
    const auditCall = mockTxSecurityAuditEventCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(auditCall.data['event']).toBe('CONTRACT_UPDATED');
    const metadata = auditCall.data['metadata'] as Record<string, unknown>;
    expect(metadata['changedFields']).toContain('title');
    expect((metadata['previousValues'] as Record<string, unknown>)['title']).toBe('Old Title');
    expect((metadata['newValues'] as Record<string, unknown>)['title']).toBe('New Title');
  });

  it('flags free-text field changes without duplicating their content in audit metadata', async () => {
    const draftContract = makeContract({ description: 'Old secret-ish notes' });
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(makeContract({ description: 'New description text', version: 2 }));
    mockTxActivityCreate.mockResolvedValue({});

    await service.update('id-1', { version: 1, description: 'New description text' }, ACTOR_ADMIN);

    const auditCall = mockTxSecurityAuditEventCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    const metadata = auditCall.data['metadata'] as Record<string, unknown>;
    expect(metadata['changedFields']).toContain('description');
    expect(JSON.stringify(metadata)).not.toContain('Old secret-ish notes');
    expect(JSON.stringify(metadata)).not.toContain('New description text');
  });

  it('enforces department access scope when departmentId changes on update', async () => {
    const draftContract = makeContract({ departmentId: 'dept-1' });
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(makeContract({ departmentId: 'dept-2', version: 2 }));
    mockTxActivityCreate.mockResolvedValue({});

    await service.update('id-1', { version: 1, departmentId: 'dept-2' }, ACTOR_ADMIN);

    expect(mockDeptAccess.assertCanAccessDepartment).toHaveBeenCalledWith(
      ACTOR_ADMIN,
      'CONTRACTS_MANAGEMENT',
      'dept-2',
    );
  });

  it('replaces the BOQ item set: deletes existing rows then creates the new set', async () => {
    const draftContract = makeContract();
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxActivityCreate.mockResolvedValue({});

    await service.update(
      'id-1',
      { version: 1, boqItems: [{ description: 'New item', originalEstimatedQty: 10, unitPrice: 5 }] },
      ACTOR_ADMIN,
    );

    expect(mockTxBoqItemDeleteMany).toHaveBeenCalledWith({ where: { contractId: 'id-1' } });
    const createCall = mockTxBoqItemCreateMany.mock.calls[0]![0] as { data: Record<string, unknown>[] };
    expect(createCall.data).toHaveLength(1);
    expect(createCall.data[0]!['sortOrder']).toBe(1);
    expect(createCall.data[0]!['totalPrice']).toBe(50);
  });

  it('CM-56 — persists invoiceQty when replacing the BOQ item set on update', async () => {
    const draftContract = makeContract();
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxActivityCreate.mockResolvedValue({});

    await service.update(
      'id-1',
      { version: 1, boqItems: [{ description: 'New item', originalEstimatedQty: 10, unitPrice: 5, invoiceQty: 3 }] },
      ACTOR_ADMIN,
    );

    const createCall = mockTxBoqItemCreateMany.mock.calls[0]![0] as { data: Record<string, unknown>[] };
    expect(createCall.data[0]!['invoiceQty']).toBe(3);
  });

  it('CM-56D — persists drawingQty when replacing the BOQ item set on update', async () => {
    const draftContract = makeContract();
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxActivityCreate.mockResolvedValue({});

    await service.update(
      'id-1',
      { version: 1, boqItems: [{ description: 'New item', originalEstimatedQty: 10, unitPrice: 5, drawingQty: 9 }] },
      ACTOR_ADMIN,
    );

    const createCall = mockTxBoqItemCreateMany.mock.calls[0]![0] as { data: Record<string, unknown>[] };
    expect(createCall.data[0]!['drawingQty']).toBe(9);
  });

  it('clears BOQ items when boqItems is an explicit empty array, preserving manual contractValue', async () => {
    const draftContract = makeContract();
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxActivityCreate.mockResolvedValue({});

    await service.update('id-1', { version: 1, boqItems: [], contractValue: 500 }, ACTOR_ADMIN);

    expect(mockTxBoqItemDeleteMany).toHaveBeenCalledWith({ where: { contractId: 'id-1' } });
    expect(mockTxBoqItemCreateMany).not.toHaveBeenCalled();
    const updateCall = mockTxContractUpdateMany.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(updateCall.data['contractValue']).toBe(500);
  });

  it('does not touch BOQ items when boqItems is omitted from the update', async () => {
    const draftContract = makeContract();
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxActivityCreate.mockResolvedValue({});

    await service.update('id-1', { version: 1, title: 'New Title' }, ACTOR_ADMIN);

    expect(mockTxBoqItemDeleteMany).not.toHaveBeenCalled();
    expect(mockTxBoqItemCreateMany).not.toHaveBeenCalled();
  });

  it('recalculates contractValue from BOQ totals and defaults currency to KWD', async () => {
    const draftContract = makeContract();
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxActivityCreate.mockResolvedValue({});

    await service.update(
      'id-1',
      {
        version: 1,
        contractValue: 999999, // should be overridden — BOQ totals are the source of truth
        boqItems: [{ description: 'Item A', originalEstimatedQty: 10, unitPrice: 5 }],
      },
      ACTOR_ADMIN,
    );

    const updateCall = mockTxContractUpdateMany.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(updateCall.data['contractValue']).toBe(50);
    expect(updateCall.data['currency']).toBe('KWD');
  });

  it('rejects duplicate BOQ item codes on update', async () => {
    const draftContract = makeContract();
    mockContractFindUnique.mockResolvedValue(draftContract);

    await expect(
      service.update(
        'id-1',
        {
          version: 1,
          boqItems: [
            { description: 'Item A', itemCode: 'DUP-1' },
            { description: 'Item B', itemCode: 'DUP-1' },
          ],
        },
        ACTOR_ADMIN,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mockTxContractUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects Ex-Factory selected together with Delivery on update', async () => {
    const draftContract = makeContract();
    mockContractFindUnique.mockResolvedValue(draftContract);

    await expect(
      service.update(
        'id-1',
        { version: 1, scopeOfWork: { exFactory: true, delivery: true } },
        ACTOR_ADMIN,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mockTxContractUpdateMany).not.toHaveBeenCalled();
  });

  it('allows Ex-Factory alone (no Delivery/Erection) on update', async () => {
    const draftContract = makeContract();
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxActivityCreate.mockResolvedValue({});

    await expect(
      service.update('id-1', { version: 1, scopeOfWork: { exFactory: true, delivery: false } }, ACTOR_ADMIN),
    ).resolves.toBeDefined();
  });

  it('rejects Not Applicable together with an active scope option on update', async () => {
    const draftContract = makeContract();
    mockContractFindUnique.mockResolvedValue(draftContract);

    await expect(
      service.update(
        'id-1',
        { version: 1, scopeOfWork: { notApplicable: true, shopDrawing: true } },
        ACTOR_ADMIN,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mockTxContractUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects Other selected without otherDescription on update', async () => {
    const draftContract = makeContract();
    mockContractFindUnique.mockResolvedValue(draftContract);

    await expect(
      service.update('id-1', { version: 1, scopeOfWork: { other: true } }, ACTOR_ADMIN),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mockTxContractUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects crane fields when the update does not select Erection and the contract has none stored', async () => {
    const draftContract = makeContract({ scopeOfWork: { erection: false } });
    mockContractFindUnique.mockResolvedValue(draftContract);

    await expect(
      service.update('id-1', { version: 1, craneRequired: 'YES' }, ACTOR_ADMIN),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mockTxContractUpdateMany).not.toHaveBeenCalled();
  });

  it('allows crane fields when the existing stored scope already has Erection selected', async () => {
    const draftContract = makeContract({ scopeOfWork: { erection: true } });
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxActivityCreate.mockResolvedValue({});

    // scopeOfWork itself is untouched by this update — only crane fields change —
    // so the effective erection state must come from the contract's existing scope.
    await expect(
      service.update('id-1', { version: 1, craneRequired: 'YES' }, ACTOR_ADMIN),
    ).resolves.toBeDefined();
  });

  it('rejects crane fields when this update turns Erection off, even if it was previously on', async () => {
    const draftContract = makeContract({ scopeOfWork: { erection: true } });
    mockContractFindUnique.mockResolvedValue(draftContract);

    await expect(
      service.update(
        'id-1',
        { version: 1, scopeOfWork: { erection: false }, craneRequired: 'YES' },
        ACTOR_ADMIN,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mockTxContractUpdateMany).not.toHaveBeenCalled();
  });

  it('persists the new client/date/value/scope-detail fields on update', async () => {
    const draftContract = makeContract();
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxActivityCreate.mockResolvedValue({});

    await service.update(
      'id-1',
      {
        version: 1,
        clientContactName: 'Jane Client',
        clientContactPhone: '+965 1234 5678',
        forecastCompletionDate: '2026-12-01',
        originalContractValue: 2000,
        originalCurrency: 'KWD',
        projectSiteLocation: 'Kuwait City',
      },
      ACTOR_ADMIN,
    );

    const updateCall = mockTxContractUpdateMany.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(updateCall.data['clientContactName']).toBe('Jane Client');
    expect(updateCall.data['clientContactPhone']).toBe('+965 1234 5678');
    expect(updateCall.data['forecastCompletionDate']).toEqual(new Date('2026-12-01'));
    expect(updateCall.data['originalContractValue']).toBe(2000);
    expect(updateCall.data['originalCurrency']).toBe('KWD');
    expect(updateCall.data['projectSiteLocation']).toBe('Kuwait City');
  });

  it('does not auto-default originalContractValue on update when omitted', async () => {
    const draftContract = makeContract();
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxActivityCreate.mockResolvedValue({});

    await service.update('id-1', { version: 1, contractValue: 5000 }, ACTOR_ADMIN);

    const updateCall = mockTxContractUpdateMany.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(updateCall.data['contractValue']).toBe(5000);
    expect(updateCall.data['originalContractValue']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// CM-55 — updateScheduleStatus (manager-facing schedule/progress status)
// ---------------------------------------------------------------------------

describe('ContractsService.updateScheduleStatus', () => {
  it('throws ForbiddenException without contracts.update', async () => {
    const noUpdate: AuthUser = { ...ACTOR_VIEWER, permissions: ['contracts.read'] };
    await expect(service.updateScheduleStatus('id-1', { scheduleStatus: 'DELAYED' }, noUpdate)).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when the contract does not exist', async () => {
    mockContractFindUnique.mockResolvedValue(null);
    await expect(service.updateScheduleStatus('missing', { scheduleStatus: 'DELAYED' }, ACTOR_ADMIN)).rejects.toThrow(NotFoundException);
  });

  it('enforces department access scope via findOneOrThrow', async () => {
    mockContractFindUnique.mockResolvedValue(makeContract({ departmentId: 'dept-other' }));
    (mockDeptAccess.assertCanAccessDepartment as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new ForbiddenException('scope'));

    await expect(service.updateScheduleStatus('id-1', { scheduleStatus: 'DELAYED' }, ACTOR_OWN_DEPT)).rejects.toThrow(ForbiddenException);
  });

  it('updates only scheduleStatus — never Contract.status/lifecycle', async () => {
    mockContractFindUnique.mockResolvedValue(makeContract({ status: ContractStatus.ACTIVE }));
    mockContractUpdate.mockResolvedValue(makeContract({ status: ContractStatus.ACTIVE, scheduleStatus: 'DELAYED' }));

    await service.updateScheduleStatus('id-1', { scheduleStatus: 'DELAYED' }, ACTOR_ADMIN);

    const call = mockContractUpdate.mock.calls[0]![0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    expect(call.where).toEqual({ id: 'id-1' });
    expect(call.data).toEqual({ scheduleStatus: 'DELAYED' });
  });

  it('does not require a version and never calls updateMany (no optimistic-concurrency coupling to lifecycle transitions)', async () => {
    mockContractFindUnique.mockResolvedValue(makeContract());
    mockContractUpdate.mockResolvedValue(makeContract({ scheduleStatus: 'ON_TRACK' }));

    await service.updateScheduleStatus('id-1', { scheduleStatus: 'ON_TRACK' }, ACTOR_ADMIN);

    expect(mockTxContractUpdateMany).not.toHaveBeenCalled();
    expect(mockContractUpdate).toHaveBeenCalledTimes(1);
  });

  it('logs a contractActivity entry with the previous and new schedule status', async () => {
    mockContractFindUnique.mockResolvedValue(makeContract({ scheduleStatus: 'ON_TRACK' }));
    mockContractUpdate.mockResolvedValue(makeContract({ scheduleStatus: 'DELAYED' }));

    await service.updateScheduleStatus('id-1', { scheduleStatus: 'DELAYED' }, ACTOR_ADMIN);

    const activityCall = mockActivityCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(activityCall.data['event']).toBe('schedule_status_updated');
    expect(activityCall.data['metadata']).toEqual({ previousScheduleStatus: 'ON_TRACK', newScheduleStatus: 'DELAYED' });
  });

  it('returns the updated contract with lifecycleStatus attached', async () => {
    mockContractFindUnique.mockResolvedValue(makeContract());
    mockContractUpdate.mockResolvedValue(makeContract({ status: ContractStatus.ACTIVE, scheduleStatus: 'AHEAD_OF_SCHEDULE' }));

    const result = await service.updateScheduleStatus('id-1', { scheduleStatus: 'AHEAD_OF_SCHEDULE' }, ACTOR_ADMIN);
    expect(result.lifecycleStatus).toBe('ACTIVE');
  });
});

// ---------------------------------------------------------------------------
// activate
// ---------------------------------------------------------------------------

describe('ContractsService.activate', () => {
  it('throws ForbiddenException without contracts.activate', async () => {
    await expect(service.activate('id-1', { version: 1 }, ACTOR_VIEWER)).rejects.toThrow(ForbiddenException);
  });

  it('transitions DRAFT → ACTIVE on correct version', async () => {
    const activeContract = makeContract({ status: ContractStatus.ACTIVE, version: 2 });
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(activeContract);
    mockTxActivityCreate.mockResolvedValue({});

    const result = await service.activate('id-1', { version: 1 }, ACTOR_ADMIN);
    expect(result.status).toBe(ContractStatus.ACTIVE);
    expect(result.lifecycleStatus).toBe('ACTIVE');
  });

  it('throws ConflictException on version mismatch', async () => {
    mockTxContractUpdateMany.mockResolvedValue({ count: 0 });
    mockTxContractFindUnique.mockResolvedValue({ id: 'id-1' }); // exists but wrong version

    await expect(service.activate('id-1', { version: 99 }, ACTOR_ADMIN)).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when contract does not exist', async () => {
    mockTxContractUpdateMany.mockResolvedValue({ count: 0 });
    mockTxContractFindUnique.mockResolvedValue(null); // not found

    await expect(service.activate('missing', { version: 1 }, ACTOR_ADMIN)).rejects.toThrow(NotFoundException);
  });

  it('creates activity record with previousStatus=DRAFT and newStatus=ACTIVE', async () => {
    const activeContract = makeContract({ status: ContractStatus.ACTIVE });
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(activeContract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.activate('id-1', { version: 1 }, ACTOR_ADMIN);

    const activityCall = mockTxActivityCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(activityCall.data['previousStatus']).toBe(ContractStatus.DRAFT);
    expect(activityCall.data['newStatus']).toBe(ContractStatus.ACTIVE);
  });

  it('writes a CONTRACT_ACTIVATED security audit event alongside the activity record', async () => {
    const activeContract = makeContract({ status: ContractStatus.ACTIVE });
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(activeContract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.activate('id-1', { version: 1 }, ACTOR_ADMIN);

    expect(mockTxActivityCreate).toHaveBeenCalledTimes(1);
    expect(mockTxSecurityAuditEventCreate).toHaveBeenCalledTimes(1);
    const auditCall = mockTxSecurityAuditEventCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(auditCall.data['event']).toBe('CONTRACT_ACTIVATED');
    expect(auditCall.data['actorId']).toBe(ACTOR_ADMIN.id);
    expect(auditCall.data['metadata']).toMatchObject({
      previousStatus: ContractStatus.DRAFT,
      newStatus: ContractStatus.ACTIVE,
    });
  });
});

// ---------------------------------------------------------------------------
// terminate
// ---------------------------------------------------------------------------

describe('ContractsService.terminate', () => {
  it('throws ForbiddenException without contracts.terminate', async () => {
    await expect(service.terminate('id-1', { reason: 'r', version: 1 }, ACTOR_VIEWER)).rejects.toThrow(ForbiddenException);
  });

  it('transitions ACTIVE → TERMINATED on correct version', async () => {
    const terminatedContract = makeContract({ status: ContractStatus.TERMINATED, terminationReason: 'Budget cut', version: 2 });
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(terminatedContract);
    mockTxActivityCreate.mockResolvedValue({});

    const result = await service.terminate('id-1', { reason: 'Budget cut', version: 1 }, ACTOR_ADMIN);
    expect(result.status).toBe(ContractStatus.TERMINATED);
  });

  it('throws ConflictException on version mismatch', async () => {
    mockTxContractUpdateMany.mockResolvedValue({ count: 0 });
    mockTxContractFindUnique.mockResolvedValue({ id: 'id-1' });

    await expect(service.terminate('id-1', { reason: 'r', version: 99 }, ACTOR_ADMIN)).rejects.toThrow(ConflictException);
  });

  it('stores terminationReason in updateMany data', async () => {
    const terminatedContract = makeContract({ status: ContractStatus.TERMINATED });
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(terminatedContract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.terminate('id-1', { reason: 'Budget cut', version: 1 }, ACTOR_ADMIN);

    const updateCall = mockTxContractUpdateMany.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(updateCall.data['terminationReason']).toBe('Budget cut');
  });

  it('creates activity record with previousStatus=ACTIVE and newStatus=TERMINATED', async () => {
    const terminatedContract = makeContract({ status: ContractStatus.TERMINATED });
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(terminatedContract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.terminate('id-1', { reason: 'r', version: 1 }, ACTOR_ADMIN);

    const activityCall = mockTxActivityCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(activityCall.data['previousStatus']).toBe(ContractStatus.ACTIVE);
    expect(activityCall.data['newStatus']).toBe(ContractStatus.TERMINATED);
  });

  it('writes a CONTRACT_TERMINATED security audit event including the reason', async () => {
    const terminatedContract = makeContract({ status: ContractStatus.TERMINATED });
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(terminatedContract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.terminate('id-1', { reason: 'Budget cut', version: 1 }, ACTOR_ADMIN);

    expect(mockTxSecurityAuditEventCreate).toHaveBeenCalledTimes(1);
    const auditCall = mockTxSecurityAuditEventCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(auditCall.data['event']).toBe('CONTRACT_TERMINATED');
    expect(auditCall.data['metadata']).toMatchObject({
      previousStatus: ContractStatus.ACTIVE,
      newStatus: ContractStatus.TERMINATED,
      reason: 'Budget cut',
    });
  });
});

// ---------------------------------------------------------------------------
// CM-69A — cancel (safe void, never a hard delete)
// ---------------------------------------------------------------------------

describe('ContractsService.cancel', () => {
  it('throws ForbiddenException without contracts.update or contracts.manage', async () => {
    const noPerm: AuthUser = { ...ACTOR_VIEWER, permissions: ['contracts.read'] };
    await expect(service.cancel('id-1', { reason: 'r', version: 1 }, noPerm)).rejects.toThrow(ForbiddenException);
  });

  it('allows an actor with only contracts.update (no contracts.manage)', async () => {
    const draftContract = makeContract({ status: ContractStatus.DRAFT });
    const cancelledContract = makeContract({ status: ContractStatus.CANCELLED, cancellationReason: 'Created for UAT testing', version: 2 });
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(cancelledContract);
    mockTxActivityCreate.mockResolvedValue({});

    const updateOnlyActor: AuthUser = { ...ACTOR_VIEWER, permissions: ['contracts.read', 'contracts.update'] };
    const result = await service.cancel('id-1', { reason: 'Created for UAT testing', version: 1 }, updateOnlyActor);
    expect(result.status).toBe(ContractStatus.CANCELLED);
  });

  it('enforces department scope via assertCanAccessDepartment before cancelling', async () => {
    const draftContract = makeContract({ status: ContractStatus.DRAFT, departmentId: 'dept-other' });
    mockContractFindUnique.mockResolvedValue(draftContract);
    (mockDeptAccess.assertCanAccessDepartment as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new ForbiddenException('scope'));

    await expect(service.cancel('id-1', { reason: 'r', version: 1 }, ACTOR_ADMIN)).rejects.toThrow(ForbiddenException);
    expect(mockTxContractUpdateMany).not.toHaveBeenCalled();
  });

  it('transitions DRAFT → CANCELLED on correct version', async () => {
    const draftContract = makeContract({ status: ContractStatus.DRAFT });
    const cancelledContract = makeContract({ status: ContractStatus.CANCELLED, version: 2 });
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(cancelledContract);
    mockTxActivityCreate.mockResolvedValue({});

    const result = await service.cancel('id-1', { reason: 'Wrong test draft', version: 1 }, ACTOR_ADMIN);
    expect(result.status).toBe(ContractStatus.CANCELLED);
  });

  it('transitions ACTIVE → CANCELLED on correct version', async () => {
    const activeContract = makeContract({ status: ContractStatus.ACTIVE });
    const cancelledContract = makeContract({ status: ContractStatus.CANCELLED, version: 2 });
    mockContractFindUnique.mockResolvedValue(activeContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(cancelledContract);
    mockTxActivityCreate.mockResolvedValue({});

    const result = await service.cancel('id-1', { reason: 'Wrongly activated', version: 1 }, ACTOR_ADMIN);
    expect(result.status).toBe(ContractStatus.CANCELLED);
  });

  it('rejects cancelling a TERMINATED contract (only DRAFT/ACTIVE are cancellable)', async () => {
    const terminatedContract = makeContract({ status: ContractStatus.TERMINATED });
    mockContractFindUnique.mockResolvedValue(terminatedContract);

    await expect(service.cancel('id-1', { reason: 'r', version: 1 }, ACTOR_ADMIN)).rejects.toThrow(ConflictException);
    expect(mockTxContractUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects cancelling a CLOSED contract (only DRAFT/ACTIVE are cancellable)', async () => {
    const closedContract = makeContract({ status: ContractStatus.CLOSED });
    mockContractFindUnique.mockResolvedValue(closedContract);

    await expect(service.cancel('id-1', { reason: 'r', version: 1 }, ACTOR_ADMIN)).rejects.toThrow(ConflictException);
    expect(mockTxContractUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects cancelling an already-CANCELLED contract', async () => {
    const cancelledContract = makeContract({ status: ContractStatus.CANCELLED });
    mockContractFindUnique.mockResolvedValue(cancelledContract);

    await expect(service.cancel('id-1', { reason: 'r', version: 1 }, ACTOR_ADMIN)).rejects.toThrow(ConflictException);
    expect(mockTxContractUpdateMany).not.toHaveBeenCalled();
  });

  it('throws ConflictException on version mismatch', async () => {
    const activeContract = makeContract({ status: ContractStatus.ACTIVE });
    mockContractFindUnique.mockResolvedValue(activeContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 0 });
    mockTxContractFindUnique.mockResolvedValue({ id: 'id-1' });

    await expect(service.cancel('id-1', { reason: 'r', version: 99 }, ACTOR_ADMIN)).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when the contract does not exist', async () => {
    mockContractFindUnique.mockResolvedValue(null);

    await expect(service.cancel('missing-id', { reason: 'r', version: 1 }, ACTOR_ADMIN)).rejects.toThrow(NotFoundException);
  });

  it('stores cancellationReason, cancelledAt, and cancelledByUserId in updateMany data', async () => {
    const activeContract = makeContract({ status: ContractStatus.ACTIVE });
    const cancelledContract = makeContract({ status: ContractStatus.CANCELLED });
    mockContractFindUnique.mockResolvedValue(activeContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(cancelledContract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.cancel('id-1', { reason: 'Created for UAT testing', version: 1 }, ACTOR_ADMIN);

    const updateCall = mockTxContractUpdateMany.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(updateCall.data['cancellationReason']).toBe('Created for UAT testing');
    expect(updateCall.data['cancelledByUserId']).toBe(ACTOR_ADMIN.id);
    expect(updateCall.data['cancelledAt']).toBeInstanceOf(Date);
  });

  it('creates an activity record with the real previousStatus and newStatus=CANCELLED', async () => {
    const activeContract = makeContract({ status: ContractStatus.ACTIVE });
    const cancelledContract = makeContract({ status: ContractStatus.CANCELLED });
    mockContractFindUnique.mockResolvedValue(activeContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(cancelledContract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.cancel('id-1', { reason: 'r', version: 1 }, ACTOR_ADMIN);

    const activityCall = mockTxActivityCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(activityCall.data['event']).toBe('cancelled');
    expect(activityCall.data['previousStatus']).toBe(ContractStatus.ACTIVE);
    expect(activityCall.data['newStatus']).toBe(ContractStatus.CANCELLED);
  });

  it('writes a CONTRACT_CANCELLED security audit event including the reason', async () => {
    const draftContract = makeContract({ status: ContractStatus.DRAFT });
    const cancelledContract = makeContract({ status: ContractStatus.CANCELLED });
    mockContractFindUnique.mockResolvedValue(draftContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(cancelledContract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.cancel('id-1', { reason: 'Created for UAT testing', version: 1 }, ACTOR_ADMIN);

    expect(mockTxSecurityAuditEventCreate).toHaveBeenCalledTimes(1);
    const auditCall = mockTxSecurityAuditEventCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(auditCall.data['event']).toBe('CONTRACT_CANCELLED');
    expect(auditCall.data['metadata']).toMatchObject({
      previousStatus: ContractStatus.DRAFT,
      newStatus: ContractStatus.CANCELLED,
      reason: 'Created for UAT testing',
    });
  });

  it('only ever updates the contract row itself — no delete, no related-record mutation', async () => {
    const activeContract = makeContract({ status: ContractStatus.ACTIVE });
    const cancelledContract = makeContract({ status: ContractStatus.CANCELLED });
    mockContractFindUnique.mockResolvedValue(activeContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(cancelledContract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.cancel('id-1', { reason: 'r', version: 1 }, ACTOR_ADMIN);

    expect(mockTxContractUpdateMany).toHaveBeenCalledTimes(1);
    const updateCall = mockTxContractUpdateMany.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(updateCall.data['status']).toBe(ContractStatus.CANCELLED);
  });
});

// ---------------------------------------------------------------------------
// close
// ---------------------------------------------------------------------------

describe('ContractsService.close', () => {
  it('throws ForbiddenException without contracts.close', async () => {
    await expect(service.close('id-1', { version: 1 }, ACTOR_VIEWER)).rejects.toThrow(ForbiddenException);
  });

  it('throws UnprocessableEntityException when closing a DRAFT contract', async () => {
    const draftContract = makeContract({ status: ContractStatus.DRAFT });
    mockContractFindUnique.mockResolvedValue(draftContract);

    await expect(service.close('id-1', { version: 1 }, ACTOR_ADMIN)).rejects.toThrow(UnprocessableEntityException);
  });

  it('throws UnprocessableEntityException when no APPROVED closeout request exists (CM-33 approval gate)', async () => {
    const activeContract = makeContract({ status: ContractStatus.ACTIVE });
    mockContractFindUnique.mockResolvedValue(activeContract);
    mockCloseoutRequestFindFirst.mockResolvedValue(null);

    await expect(service.close('id-1', { version: 1 }, ACTOR_ADMIN)).rejects.toThrow(UnprocessableEntityException);
    expect(mockTxContractUpdateMany).not.toHaveBeenCalled();
  });

  it('closes an ACTIVE contract on correct version', async () => {
    const activeContract = makeContract({ status: ContractStatus.ACTIVE });
    const closedContract = makeContract({ status: ContractStatus.CLOSED, version: 2 });
    mockContractFindUnique.mockResolvedValue(activeContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(closedContract);
    mockTxActivityCreate.mockResolvedValue({});

    const result = await service.close('id-1', { version: 1 }, ACTOR_ADMIN);
    expect(result.status).toBe(ContractStatus.CLOSED);
  });

  it('closes a TERMINATED contract on correct version', async () => {
    const terminatedContract = makeContract({ status: ContractStatus.TERMINATED, version: 3 });
    const closedContract = makeContract({ status: ContractStatus.CLOSED, version: 4 });
    mockContractFindUnique.mockResolvedValue(terminatedContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(closedContract);
    mockTxActivityCreate.mockResolvedValue({});

    const result = await service.close('id-1', { version: 3 }, ACTOR_ADMIN);
    expect(result.status).toBe(ContractStatus.CLOSED);
  });

  it('throws ConflictException on version mismatch when closing', async () => {
    const activeContract = makeContract({ status: ContractStatus.ACTIVE });
    mockContractFindUnique.mockResolvedValue(activeContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.close('id-1', { version: 99 }, ACTOR_ADMIN)).rejects.toThrow(ConflictException);
  });

  it('creates activity record with previousStatus and newStatus=CLOSED', async () => {
    const activeContract = makeContract({ status: ContractStatus.ACTIVE });
    const closedContract = makeContract({ status: ContractStatus.CLOSED });
    mockContractFindUnique.mockResolvedValue(activeContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(closedContract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.close('id-1', { version: 1 }, ACTOR_ADMIN);

    const activityCall = mockTxActivityCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(activityCall.data['previousStatus']).toBe(ContractStatus.ACTIVE);
    expect(activityCall.data['newStatus']).toBe(ContractStatus.CLOSED);
  });

  it('throws NotFoundException when contract does not exist', async () => {
    mockContractFindUnique.mockResolvedValue(null);
    await expect(service.close('missing', { version: 1 }, ACTOR_ADMIN)).rejects.toThrow(NotFoundException);
  });

  it('writes a CONTRACT_CLOSED security audit event', async () => {
    const activeContract = makeContract({ status: ContractStatus.ACTIVE });
    const closedContract = makeContract({ status: ContractStatus.CLOSED });
    mockContractFindUnique.mockResolvedValue(activeContract);
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxContractFindUniqueOrThrow.mockResolvedValue(closedContract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.close('id-1', { version: 1 }, ACTOR_ADMIN);

    expect(mockTxSecurityAuditEventCreate).toHaveBeenCalledTimes(1);
    const auditCall = mockTxSecurityAuditEventCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(auditCall.data['event']).toBe('CONTRACT_CLOSED');
    expect(auditCall.data['metadata']).toMatchObject({
      previousStatus: ContractStatus.ACTIVE,
      newStatus: ContractStatus.CLOSED,
    });
  });
});

// ---------------------------------------------------------------------------
// findOne
// ---------------------------------------------------------------------------

describe('ContractsService.findOne', () => {
  it('throws ForbiddenException without contracts.read', async () => {
    const noRead: AuthUser = { ...ACTOR_VIEWER, permissions: [] };
    await expect(service.findOne('id-1', noRead)).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when contract does not exist', async () => {
    mockContractFindUnique.mockResolvedValue(null);
    await expect(service.findOne('missing', ACTOR_VIEWER)).rejects.toThrow(NotFoundException);
  });

  it('returns contract with lifecycleStatus', async () => {
    const contract = makeContract({ status: ContractStatus.ACTIVE });
    mockContractFindUnique.mockResolvedValue(contract);

    const result = await service.findOne('id-1', ACTOR_VIEWER);
    expect(result.lifecycleStatus).toBe('ACTIVE');
  });

  it('attaches EXPIRED lifecycle when endDate is in the past', async () => {
    const past = new Date(Date.UTC(2020, 0, 1));
    const contract = makeContract({ status: ContractStatus.ACTIVE, endDate: past });
    mockContractFindUnique.mockResolvedValue(contract);

    const result = await service.findOne('id-1', ACTOR_VIEWER);
    expect(result.lifecycleStatus).toBe('EXPIRED');
  });
});

// ---------------------------------------------------------------------------
// findAll
// ---------------------------------------------------------------------------

describe('ContractsService.findAll', () => {
  it('throws ForbiddenException without contracts.read', async () => {
    const noRead: AuthUser = { ...ACTOR_VIEWER, permissions: [] };
    await expect(service.findAll({}, noRead)).rejects.toThrow(ForbiddenException);
  });

  it('returns paginated results with lifecycleStatus on each item', async () => {
    const contracts = [
      makeContract({ status: ContractStatus.DRAFT, workflowTasks: [], payments: [], _count: { claims: 0 } }),
      makeContract({ id: 'c-2', status: ContractStatus.ACTIVE, workflowTasks: [], payments: [], _count: { claims: 0 } }),
    ];
    mockContractFindMany.mockResolvedValue(contracts);
    mockContractCount.mockResolvedValue(2);

    const result = await service.findAll({ page: 1, pageSize: 10 }, ACTOR_VIEWER);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.lifecycleStatus).toBe('DRAFT');
    expect(result.items[1]!.lifecycleStatus).toBe('ACTIVE');
    expect(result.total).toBe(2);
    expect(result.totalPages).toBe(1);
  });

  it('computes progressPercent/paymentProgressPercent/openClaimsCount per row and strips the raw relations', async () => {
    const contracts = [
      makeContract({
        contractValue: '1000.000',
        workflowTasks: [{ status: 'COMPLETED' }, { status: 'IN_PROGRESS' }],
        payments: [{ paidAmount: '250.000' }],
        _count: { claims: 3 },
      }),
    ];
    mockContractFindMany.mockResolvedValue(contracts);
    mockContractCount.mockResolvedValue(1);

    const result = await service.findAll({}, ACTOR_VIEWER);
    const item = result.items[0]! as unknown as Record<string, unknown>;
    expect(item['progressPercent']).toBe(50);
    expect(item['paymentProgressPercent']).toBe(25);
    expect(item['openClaimsCount']).toBe(3);
    expect(item['workflowTasks']).toBeUndefined();
    expect(item['payments']).toBeUndefined();
    expect(item['_count']).toBeUndefined();
  });

  it('effectiveScheduleStatus defaults to IN_PROGRESS when unset and status is not CLOSED', async () => {
    const contracts = [makeContract({ status: ContractStatus.ACTIVE, scheduleStatus: null, workflowTasks: [], payments: [], _count: { claims: 0 } })];
    mockContractFindMany.mockResolvedValue(contracts);
    mockContractCount.mockResolvedValue(1);

    const result = await service.findAll({}, ACTOR_VIEWER);
    expect((result.items[0] as unknown as Record<string, unknown>)['effectiveScheduleStatus']).toBe('IN_PROGRESS');
  });

  it('computes totalPages correctly', async () => {
    mockContractFindMany.mockResolvedValue([]);
    mockContractCount.mockResolvedValue(51);

    const result = await service.findAll({ page: 1, pageSize: 25 }, ACTOR_VIEWER);
    expect(result.totalPages).toBe(3);
  });

  it('defaults page=1 and pageSize=25', async () => {
    mockContractFindMany.mockResolvedValue([]);
    mockContractCount.mockResolvedValue(0);

    const result = await service.findAll({}, ACTOR_VIEWER);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// getSummary
// ---------------------------------------------------------------------------

describe('ContractsService.getSummary', () => {
  it('throws ForbiddenException without contracts.read', async () => {
    const noRead: AuthUser = { ...ACTOR_VIEWER, permissions: [] };
    await expect(service.getSummary(noRead)).rejects.toThrow(ForbiddenException);
  });

  it('CM-69I — returns totalContracts/activeContracts scoped to the same default (CANCELLED-excluding) where as the table', async () => {
    mockContractCount
      .mockResolvedValueOnce(5)  // totalContracts
      .mockResolvedValueOnce(3); // activeContracts

    const result = await service.getSummary(ACTOR_VIEWER);
    expect(result.totalContracts).toBe(5);
    expect(result.activeContracts).toBe(3);

    const totalCountArgs = mockContractCount.mock.calls[0]![0];
    expect(totalCountArgs.where).toEqual({ status: { not: 'CANCELLED' } });
  });

  it('CM-69I — activeContracts ANDs an ACTIVE condition onto the current filtered scope, never clobbering an explicit lifecycleStatus filter', async () => {
    mockContractCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    await service.getSummary(ACTOR_VIEWER, { lifecycleStatus: 'DRAFT' });

    const activeCountArgs = mockContractCount.mock.calls[1]![0];
    expect(activeCountArgs.where).toEqual({ AND: [{ status: 'DRAFT' }, { status: 'ACTIVE' }] });
  });

  it('CM-69I — lifecycleStatus=ALL includes CANCELLED (no status filter at all)', async () => {
    mockContractCount.mockResolvedValueOnce(9).mockResolvedValueOnce(2);

    await service.getSummary(ACTOR_VIEWER, { lifecycleStatus: 'ALL' });

    const totalCountArgs = mockContractCount.mock.calls[0]![0];
    expect(totalCountArgs.where).toEqual({});
  });

  it('CM-69I — passes search through to the same buildListWhere() the table uses', async () => {
    mockContractCount.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    await service.getSummary(ACTOR_VIEWER, { search: 'Acme' });

    const totalCountArgs = mockContractCount.mock.calls[0]![0];
    expect(totalCountArgs.where.AND?.[0]?.OR).toBeDefined();
  });

  it('returns totalContractValue as a 3-decimal string sum, and totalOpenClaims', async () => {
    mockContractAggregate.mockResolvedValue({ _sum: { contractValue: '125000.500' } });
    mockContractClaimCount.mockResolvedValue(4);

    const result = await service.getSummary(ACTOR_VIEWER);
    expect(result.totalContractValue).toBe('125000.500');
    expect(result.totalOpenClaims).toBe(4);
  });

  it('totalContractValue defaults to "0.000" when the sum is null (no contracts have a value)', async () => {
    mockContractAggregate.mockResolvedValue({ _sum: { contractValue: null } });

    const result = await service.getSummary(ACTOR_VIEWER);
    expect(result.totalContractValue).toBe('0.000');
  });

  it('scopes totalOpenClaims to the same filtered+department where as everything else', async () => {
    (mockDeptAccess.buildDeptFilter as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ in: ['dept-1'] });

    await service.getSummary(ACTOR_OWN_DEPT);

    const claimCountArgs = mockContractClaimCount.mock.calls[0]![0];
    expect(claimCountArgs.where.contract).toEqual({ status: { not: 'CANCELLED' }, departmentId: { in: ['dept-1'] } });
  });
});

// ---------------------------------------------------------------------------
// addComment
// ---------------------------------------------------------------------------

describe('ContractsService.addComment', () => {
  it('throws ForbiddenException without contracts.comment', async () => {
    const noComment: AuthUser = { ...ACTOR_VIEWER, permissions: ['contracts.read'] };
    await expect(service.addComment('id-1', { body: 'hi' }, noComment)).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when contract does not exist', async () => {
    mockContractFindUnique.mockResolvedValue(null);
    await expect(service.addComment('missing', { body: 'hi' }, ACTOR_VIEWER)).rejects.toThrow(NotFoundException);
  });

  it('creates comment and activity record', async () => {
    const contract = makeContract();
    const comment = { id: 'comment-1', contractId: 'id-1', body: 'hi', createdAt: new Date(), authorUser: { id: 'user-1', displayName: 'Alice' } };
    mockContractFindUnique.mockResolvedValue(contract);
    mockTxCommentCreate.mockResolvedValue(comment);
    mockTxActivityCreate.mockResolvedValue({});

    await service.addComment('id-1', { body: 'hi' }, ACTOR_VIEWER);

    expect(mockTxCommentCreate).toHaveBeenCalledTimes(1);
    expect(mockTxActivityCreate).toHaveBeenCalledTimes(1);
    const activityCall = mockTxActivityCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(activityCall.data['event']).toBe('comment_added');
  });

  it('writes a CONTRACT_COMMENT_ADDED security audit event without duplicating the comment body', async () => {
    const contract = makeContract();
    const comment = { id: 'comment-1', contractId: 'id-1', body: 'a private note', createdAt: new Date(), authorUser: { id: 'user-1', displayName: 'Alice' } };
    mockContractFindUnique.mockResolvedValue(contract);
    mockTxCommentCreate.mockResolvedValue(comment);
    mockTxActivityCreate.mockResolvedValue({});

    await service.addComment('id-1', { body: 'a private note' }, ACTOR_VIEWER);

    expect(mockTxSecurityAuditEventCreate).toHaveBeenCalledTimes(1);
    const auditCall = mockTxSecurityAuditEventCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(auditCall.data['event']).toBe('CONTRACT_COMMENT_ADDED');
    expect(JSON.stringify(auditCall.data['metadata'])).not.toContain('a private note');
  });
});

// ---------------------------------------------------------------------------
// Security audit metadata safety
// ---------------------------------------------------------------------------

describe('ContractsService security audit metadata safety', () => {
  it('never includes password, token, or secret keys in any audit metadata payload', async () => {
    const contract = makeContract();
    mockTxContractCreate.mockResolvedValue(contract);
    mockTxActivityCreate.mockResolvedValue({});

    await service.create({ title: 'T', counterpartyName: 'V' }, ACTOR_VIEWER);

    const auditCall = mockTxSecurityAuditEventCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    const serialized = JSON.stringify(auditCall.data).toLowerCase();
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('stack');
  });
});

// ---------------------------------------------------------------------------
// listComments
// ---------------------------------------------------------------------------

describe('ContractsService.listComments', () => {
  it('throws ForbiddenException without contracts.read', async () => {
    const noRead: AuthUser = { ...ACTOR_VIEWER, permissions: [] };
    await expect(service.listComments('id-1', noRead)).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when contract does not exist', async () => {
    mockContractFindUnique.mockResolvedValue(null);
    await expect(service.listComments('missing', ACTOR_VIEWER)).rejects.toThrow(NotFoundException);
  });

  it('returns comments ordered ascending', async () => {
    mockContractFindUnique.mockResolvedValue(makeContract());
    const comments = [{ id: 'c1', body: 'first' }, { id: 'c2', body: 'second' }];
    mockCommentFindMany.mockResolvedValue(comments);

    const result = await service.listComments('id-1', ACTOR_VIEWER);
    expect(result).toHaveLength(2);
    expect(mockCommentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: 'asc' }] }),
    );
  });
});

// ---------------------------------------------------------------------------
// listActivities
// ---------------------------------------------------------------------------

describe('ContractsService.listActivities', () => {
  it('throws ForbiddenException without contracts.read', async () => {
    const noRead: AuthUser = { ...ACTOR_VIEWER, permissions: [] };
    await expect(service.listActivities('id-1', noRead)).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when contract does not exist', async () => {
    mockContractFindUnique.mockResolvedValue(null);
    await expect(service.listActivities('missing', ACTOR_VIEWER)).rejects.toThrow(NotFoundException);
  });

  it('returns activities ordered newest first (CM-66 — Activity / Audit History tab requirement)', async () => {
    mockContractFindUnique.mockResolvedValue(makeContract());
    const activities = [{ id: 'a1', event: 'created' }];
    mockActivityFindMany.mockResolvedValue(activities);

    const result = await service.listActivities('id-1', ACTOR_VIEWER);
    expect(result).toHaveLength(1);
    expect(mockActivityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: 'desc' }] }),
    );
  });
});

// ---------------------------------------------------------------------------
// listPeople
// ---------------------------------------------------------------------------

describe('ContractsService.listPeople', () => {
  it('throws ForbiddenException without contracts.read', async () => {
    const noRead: AuthUser = { ...ACTOR_VIEWER, permissions: [] };
    await expect(service.listPeople(noRead)).rejects.toThrow(ForbiddenException);
  });

  it('returns active users ordered by displayName', async () => {
    const users = [{ id: 'u1', displayName: 'Alice', departmentId: null }];
    mockUserFindMany.mockResolvedValue(users);

    const result = await service.listPeople(ACTOR_VIEWER);
    expect(result).toHaveLength(1);
    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: [{ displayName: 'asc' }],
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// listDepartments
// ---------------------------------------------------------------------------

describe('ContractsService.listDepartments', () => {
  it('throws ForbiddenException without contracts.read', async () => {
    const noRead: AuthUser = { ...ACTOR_VIEWER, permissions: [] };
    await expect(service.listDepartments(noRead)).rejects.toThrow(ForbiddenException);
  });

  it('returns active departments ordered by name', async () => {
    const depts = [{ id: 'd1', name: 'Alpha Dept', code: 'ALPHA' }];
    mockDepartmentFindMany.mockResolvedValue(depts);

    const result = await service.listDepartments(ACTOR_VIEWER);
    expect(result).toHaveLength(1);
    expect(mockDepartmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true }, orderBy: [{ name: 'asc' }] }),
    );
  });
});

// ---------------------------------------------------------------------------
// listPlants
// ---------------------------------------------------------------------------

describe('ContractsService.listPlants', () => {
  it('throws ForbiddenException without contracts.read', async () => {
    const noRead: AuthUser = { ...ACTOR_VIEWER, permissions: [] };
    await expect(service.listPlants(noRead)).rejects.toThrow(ForbiddenException);
  });

  it('returns active plants ordered by name', async () => {
    const plantsData = [{ id: 'p1', name: 'Plant Alpha', code: 'PA' }];
    mockPlantFindMany.mockResolvedValue(plantsData);

    const result = await service.listPlants(ACTOR_VIEWER);
    expect(result).toHaveLength(1);
    expect(mockPlantFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true }, orderBy: [{ name: 'asc' }] }),
    );
  });
});

// ---------------------------------------------------------------------------
// listLocations
// ---------------------------------------------------------------------------

describe('ContractsService.listLocations', () => {
  it('throws ForbiddenException without contracts.read', async () => {
    const noRead: AuthUser = { ...ACTOR_VIEWER, permissions: [] };
    await expect(service.listLocations(noRead)).rejects.toThrow(ForbiddenException);
  });

  it('returns all active locations when no plantId filter', async () => {
    const locs = [{ id: 'l1', name: 'Gate 1', code: 'G1', plantId: null }];
    mockLocationFindMany.mockResolvedValue(locs);

    const result = await service.listLocations(ACTOR_VIEWER);
    expect(result).toHaveLength(1);
    expect(mockLocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it('filters by plantId when provided', async () => {
    mockLocationFindMany.mockResolvedValue([]);
    await service.listLocations(ACTOR_VIEWER, 'plant-123');
    expect(mockLocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, plantId: 'plant-123' } }),
    );
  });
});

// ---------------------------------------------------------------------------
// ContractsService.getDashboard
// ---------------------------------------------------------------------------

describe('ContractsService.getDashboard', () => {
  it('throws ForbiddenException without contracts.read', async () => {
    const noRead: AuthUser = { ...ACTOR_VIEWER, permissions: [] };
    await expect(service.getDashboard(noRead)).rejects.toThrow(ForbiddenException);
  });

  it('returns ALL_DEPARTMENTS scope and correct metrics when no dept filter', async () => {
    mockGetScope.mockResolvedValueOnce(DepartmentAccessScope.ALL_DEPARTMENTS);
    mockContractCount
      .mockResolvedValueOnce(3)  // totalDraft
      .mockResolvedValueOnce(10) // totalActive
      .mockResolvedValueOnce(2)  // totalExpiring
      .mockResolvedValueOnce(1)  // totalExpired
      .mockResolvedValueOnce(4)  // totalTerminated
      .mockResolvedValueOnce(5)  // totalClosed
      .mockResolvedValueOnce(6); // totalCancelled
    mockContractFindMany.mockResolvedValueOnce([
      { id: 'c-r1', referenceNumber: 'CONTRACT-001', title: 'Vendor A', status: 'ACTIVE', updatedAt: new Date('2026-07-01T07:00:00Z') },
    ]);

    const result = await service.getDashboard(ACTOR_VIEWER);

    expect(result.scope.type).toBe(DepartmentAccessScope.ALL_DEPARTMENTS);
    expect(result.scope.departmentNames).toEqual([]);
    expect(result.metrics.totalDraft).toBe(3);
    expect(result.metrics.totalActive).toBe(10);
    expect(result.metrics.totalExpiring).toBe(2);
    expect(result.metrics.totalExpired).toBe(1);
    expect(result.metrics.totalTerminated).toBe(4);
    expect(result.metrics.totalClosed).toBe(5);
    expect(result.metrics.totalCancelled).toBe(6);
    expect(result.recent).toHaveLength(1);
    expect(result.recent[0]?.referenceNumber).toBe('CONTRACT-001');
    expect(result.recent[0]?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
