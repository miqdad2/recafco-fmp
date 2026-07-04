import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, UnprocessableEntityException, ConflictException } from '@nestjs/common';
import { ContractStatus } from '@recafco/database';
import { ContractsService, getDerivedLifecycleStatus, buildListWhere } from './contracts.service';
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

const mockTx = {
  contract: {
    updateMany: mockTxContractUpdateMany,
    create: mockTxContractCreate,
    findUniqueOrThrow: mockTxContractFindUniqueOrThrow,
    findUnique: mockTxContractFindUnique,
  },
  contractActivity: { create: mockTxActivityCreate },
  contractComment: { create: mockTxCommentCreate },
};

// ---------------------------------------------------------------------------
// Client mocks
// ---------------------------------------------------------------------------

const mockContractFindUnique = vi.fn();
const mockContractFindMany = vi.fn();
const mockContractCount = vi.fn();
const mockCommentFindMany = vi.fn();
const mockActivityFindMany = vi.fn();
const mockUserFindMany = vi.fn();
const mockDepartmentFindMany = vi.fn();
const mockPlantFindMany = vi.fn();
const mockLocationFindMany = vi.fn();
const mockTransaction = vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

const mockClient = {
  contract: {
    findUnique: mockContractFindUnique,
    findMany: mockContractFindMany,
    count: mockContractCount,
  },
  contractComment: { findMany: mockCommentFindMany },
  contractActivity: { findMany: mockActivityFindMany },
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
  getScope: vi.fn(),
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
    contractValue: null,
    currency: null,
    startDate: null,
    endDate: null,
    renewalNoticeDate: null,
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
  it('empty query returns empty where', () => {
    const where = buildListWhere({});
    expect(where).toEqual({});
  });

  it('status filter sets status', () => {
    const where = buildListWhere({ status: 'ACTIVE' });
    expect(where['status']).toBe('ACTIVE');
  });

  it('lifecycleStatus=EXPIRING translates to date conditions', () => {
    const where = buildListWhere({ lifecycleStatus: 'EXPIRING' });
    expect(where['status']).toBe(ContractStatus.ACTIVE);
    expect(where['renewalNoticeDate']).toBeDefined();
    expect(where['OR']).toBeDefined();
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

  it('search adds OR ilike on title and referenceNumber', () => {
    const where = buildListWhere({ search: 'foo' });
    expect(Array.isArray(where['OR'])).toBe(true);
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
    const contracts = [makeContract({ status: ContractStatus.DRAFT }), makeContract({ id: 'c-2', status: ContractStatus.ACTIVE })];
    mockContractFindMany.mockResolvedValue(contracts);
    mockContractCount.mockResolvedValue(2);

    const result = await service.findAll({ page: 1, pageSize: 10 }, ACTOR_VIEWER);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.lifecycleStatus).toBe('DRAFT');
    expect(result.items[1]!.lifecycleStatus).toBe('ACTIVE');
    expect(result.total).toBe(2);
    expect(result.totalPages).toBe(1);
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

  it('returns all 6 counts', async () => {
    mockContractCount
      .mockResolvedValueOnce(5)   // DRAFT
      .mockResolvedValueOnce(10)  // ACTIVE
      .mockResolvedValueOnce(2)   // EXPIRING
      .mockResolvedValueOnce(1)   // EXPIRED
      .mockResolvedValueOnce(3)   // TERMINATED
      .mockResolvedValueOnce(7);  // CLOSED

    const result = await service.getSummary(ACTOR_VIEWER);
    expect(result.totalDraft).toBe(5);
    expect(result.totalActive).toBe(10);
    expect(result.totalExpiring).toBe(2);
    expect(result.totalExpired).toBe(1);
    expect(result.totalTerminated).toBe(3);
    expect(result.totalClosed).toBe(7);
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

  it('returns activities ordered ascending', async () => {
    mockContractFindUnique.mockResolvedValue(makeContract());
    const activities = [{ id: 'a1', event: 'created' }];
    mockActivityFindMany.mockResolvedValue(activities);

    const result = await service.listActivities('id-1', ACTOR_VIEWER);
    expect(result).toHaveLength(1);
    expect(mockActivityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: 'asc' }] }),
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
