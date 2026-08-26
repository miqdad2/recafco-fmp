import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import {
  ContractClaimsService,
  buildClaimListWhere,
  computeOutstandingValue,
  computeClaimOverdueDays,
  computeClaimIsOverdue,
  computeClaimSummary,
  assertClaimValuesValid,
  assertClaimDatesValid,
  resolveClaimClosedDate,
} from './contract-claims.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';

// ---------------------------------------------------------------------------
// Client mocks
// ---------------------------------------------------------------------------

const mockClaimFindMany = vi.fn();
const mockClaimCount = vi.fn();
const mockClaimFindUnique = vi.fn();
const mockClaimCreate = vi.fn();
const mockClaimUpdate = vi.fn();
const mockContractFindUnique = vi.fn();
const mockUserFindUnique = vi.fn();

const mockClient = {
  contractClaim: {
    findMany: mockClaimFindMany,
    count: mockClaimCount,
    findUnique: mockClaimFindUnique,
    create: mockClaimCreate,
    update: mockClaimUpdate,
  },
  contract: { findUnique: mockContractFindUnique },
  user: { findUnique: mockUserFindUnique },
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockBuildDeptFilter = vi.fn().mockResolvedValue(null);
const mockAssertCanAccessDepartment = vi.fn().mockResolvedValue(undefined);

const mockDeptAccess = {
  buildDeptFilter: mockBuildDeptFilter,
  assertCanAccessDepartment: mockAssertCanAccessDepartment,
} as unknown as DepartmentAccessService;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR_READ_ONLY: AuthUser = {
  id: 'user-viewer-1',
  username: 'viewer',
  displayName: 'Viewer',
  roleId: 'role-viewer',
  roleCode: 'VIEWER',
  roleName: 'Viewer',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-1',
  departmentId: null,
  permissions: ['contracts.read'],
};

const ACTOR_UPDATE: AuthUser = {
  id: 'user-manager-1',
  username: 'manager',
  displayName: 'Manager',
  roleId: 'role-admin',
  roleCode: 'ADMIN',
  roleName: 'Admin',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-2',
  departmentId: null,
  permissions: ['contracts.read', 'contracts.update'],
};

function makeClaimRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'claim-1',
    contractId: 'contract-1',
    claimNo: 'CLM-001',
    claimTitle: 'Delay claim for drawing approval',
    claimType: 'DELAY',
    eventDate: new Date('2026-07-15'),
    claimDate: new Date('2026-08-01'),
    status: 'SUBMITTED',
    submittedValue: 1500,
    approvedValue: 500,
    eotClaimedDays: 10,
    eotApprovedDays: 3,
    responsibleUserId: null,
    nextAction: null,
    dueDate: new Date('2026-08-10'),
    closedDate: null,
    remarks: null,
    createdByUserId: 'user-manager-1',
    updatedByUserId: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    responsibleUser: null,
    createdByUser: { id: 'user-manager-1', displayName: 'Manager' },
    updatedByUser: null,
    contract: {
      id: 'contract-1',
      referenceNumber: 'CONTRACT-2026-000001',
      title: 'Test Contract',
      counterpartyName: 'Acme Co',
      contractValue: 100000,
      currency: 'KWD',
      ownerUser: { id: 'user-manager-1', displayName: 'Manager' },
      department: { id: 'dept-1', name: 'Engineering' },
    },
    ...overrides,
  };
}

let service: ContractClaimsService;

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildDeptFilter.mockResolvedValue(null);
  mockAssertCanAccessDepartment.mockResolvedValue(undefined);
  service = new ContractClaimsService(mockDb, mockDeptAccess);
});

// ---------------------------------------------------------------------------
// computeOutstandingValue
// ---------------------------------------------------------------------------

describe('computeOutstandingValue', () => {
  it('subtracts approvedValue from submittedValue', () => {
    expect(computeOutstandingValue({ submittedValue: 1500, approvedValue: 500 })).toBe(1000);
  });

  it('treats a missing approvedValue as zero', () => {
    expect(computeOutstandingValue({ submittedValue: 1500, approvedValue: null })).toBe(1500);
  });

  it('returns null when submittedValue is missing', () => {
    expect(computeOutstandingValue({ submittedValue: null, approvedValue: 500 })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeClaimOverdueDays / computeClaimIsOverdue
// ---------------------------------------------------------------------------

describe('computeClaimOverdueDays', () => {
  const today = new Date('2026-08-20T00:00:00Z');

  it('returns null for SETTLED/CLOSED/CANCELLED/REJECTED statuses', () => {
    expect(computeClaimOverdueDays({ dueDate: new Date('2026-08-01'), status: 'SETTLED' }, today)).toBeNull();
    expect(computeClaimOverdueDays({ dueDate: new Date('2026-08-01'), status: 'CLOSED' }, today)).toBeNull();
    expect(computeClaimOverdueDays({ dueDate: new Date('2026-08-01'), status: 'CANCELLED' }, today)).toBeNull();
    expect(computeClaimOverdueDays({ dueDate: new Date('2026-08-01'), status: 'REJECTED' }, today)).toBeNull();
  });

  it('can still be overdue when APPROVED (follow-up action not yet done)', () => {
    expect(computeClaimOverdueDays({ dueDate: new Date('2026-08-01'), status: 'APPROVED' }, today)).toBe(19);
  });

  it('returns null when dueDate is missing', () => {
    expect(computeClaimOverdueDays({ dueDate: null, status: 'SUBMITTED' }, today)).toBeNull();
  });

  it('returns null when dueDate is today or in the future', () => {
    expect(computeClaimOverdueDays({ dueDate: new Date('2026-08-25'), status: 'SUBMITTED' }, today)).toBeNull();
  });

  it('returns the day count when overdue and open', () => {
    expect(computeClaimOverdueDays({ dueDate: new Date('2026-08-10'), status: 'SUBMITTED' }, today)).toBe(10);
  });
});

describe('computeClaimIsOverdue', () => {
  it('mirrors computeClaimOverdueDays !== null', () => {
    const today = new Date('2026-08-20T00:00:00Z');
    expect(computeClaimIsOverdue({ dueDate: new Date('2026-08-10'), status: 'SUBMITTED' }, today)).toBe(true);
    expect(computeClaimIsOverdue({ dueDate: new Date('2026-08-10'), status: 'CLOSED' }, today)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeClaimSummary
// ---------------------------------------------------------------------------

describe('computeClaimSummary', () => {
  it('aggregates open/values/overdue/closed-or-settled', () => {
    const today = new Date('2026-08-20T00:00:00Z');
    const rows = [
      { status: 'SUBMITTED', submittedValue: 1000, approvedValue: 0, dueDate: new Date('2026-08-01') },
      { status: 'APPROVED', submittedValue: 2000, approvedValue: 1800, dueDate: new Date('2099-01-01') },
      { status: 'CLOSED', submittedValue: 500, approvedValue: 500, dueDate: new Date('2026-08-01') },
      { status: 'SETTLED', submittedValue: 300, approvedValue: 300, dueDate: null },
    ];
    const summary = computeClaimSummary(rows, today);
    expect(summary.openClaims).toBe(1); // only SUBMITTED — APPROVED/CLOSED/SETTLED are final
    expect(summary.totalSubmittedValue).toBe('3800.000');
    expect(summary.totalApprovedValue).toBe('2600.000');
    expect(summary.totalOutstandingValue).toBe('1200.000');
    expect(summary.overdueClaims).toBe(1); // only the SUBMITTED one with a past dueDate
    expect(summary.closedOrSettledClaims).toBe(2);
  });

  it('returns all-zero summary for an empty result set', () => {
    expect(computeClaimSummary([])).toEqual({
      openClaims: 0,
      totalSubmittedValue: '0.000',
      totalApprovedValue: '0.000',
      totalOutstandingValue: '0.000',
      overdueClaims: 0,
      closedOrSettledClaims: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// assertClaimValuesValid
// ---------------------------------------------------------------------------

describe('assertClaimValuesValid', () => {
  it('rejects approvedValue greater than submittedValue', () => {
    expect(() => assertClaimValuesValid({ submittedValue: 500, approvedValue: 600 })).toThrow(
      UnprocessableEntityException,
    );
  });

  it('allows approvedValue equal to submittedValue', () => {
    expect(() => assertClaimValuesValid({ submittedValue: 500, approvedValue: 500 })).not.toThrow();
  });

  it('allows missing values', () => {
    expect(() => assertClaimValuesValid({ submittedValue: undefined, approvedValue: null })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// assertClaimDatesValid
// ---------------------------------------------------------------------------

describe('assertClaimDatesValid', () => {
  it('rejects dueDate before claimDate', () => {
    expect(() =>
      assertClaimDatesValid({ claimDate: new Date('2026-08-10'), dueDate: new Date('2026-08-01') }),
    ).toThrow(UnprocessableEntityException);
  });

  it('allows dueDate on or after claimDate', () => {
    expect(() =>
      assertClaimDatesValid({ claimDate: new Date('2026-08-01'), dueDate: new Date('2026-08-10') }),
    ).not.toThrow();
  });

  it('allows missing dates', () => {
    expect(() => assertClaimDatesValid({ claimDate: null, dueDate: undefined })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// resolveClaimClosedDate
// ---------------------------------------------------------------------------

describe('resolveClaimClosedDate', () => {
  const today = new Date('2026-08-20T00:00:00Z');

  it('uses the explicit dto value when provided', () => {
    expect(resolveClaimClosedDate('CLOSED', '2026-08-15', null, today)).toEqual(new Date('2026-08-15'));
  });

  it('auto-sets to today when status becomes CLOSED with no existing closedDate', () => {
    expect(resolveClaimClosedDate('CLOSED', undefined, null, today)).toEqual(today);
  });

  it('auto-sets to today when status becomes SETTLED with no existing closedDate', () => {
    expect(resolveClaimClosedDate('SETTLED', undefined, null, today)).toEqual(today);
  });

  it('does not touch closedDate when one already exists', () => {
    expect(resolveClaimClosedDate('CLOSED', undefined, new Date('2026-08-01'), today)).toBeUndefined();
  });

  it('does not auto-set for REJECTED (not a resolution)', () => {
    expect(resolveClaimClosedDate('REJECTED', undefined, null, today)).toBeUndefined();
  });

  it('does not touch closedDate for a non-terminal status', () => {
    expect(resolveClaimClosedDate('UNDER_NEGOTIATION', undefined, null, today)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildClaimListWhere
// ---------------------------------------------------------------------------

describe('buildClaimListWhere', () => {
  it('returns an empty where for no filters', () => {
    expect(buildClaimListWhere({})).toEqual({});
  });

  it('filters by contractId directly', () => {
    expect(buildClaimListWhere({ contractId: 'contract-1' })).toEqual({ contractId: 'contract-1' });
  });

  it('filters by status/claimType via AND', () => {
    const where = buildClaimListWhere({ status: 'SUBMITTED', claimType: 'DELAY' });
    expect(where['AND']).toEqual([{ status: 'SUBMITTED' }, { claimType: 'DELAY' }]);
  });

  it('combines overdueOnly with an implicit not-final status filter', () => {
    const today = new Date('2026-08-20T00:00:00Z');
    const where = buildClaimListWhere({ overdueOnly: true }, today);
    expect(where['AND']).toEqual([
      { dueDate: { lt: today } },
      { status: { notIn: ['SETTLED', 'CLOSED', 'CANCELLED', 'REJECTED'] } },
    ]);
  });

  it('does not add the implicit status filter when an explicit status is also set', () => {
    const today = new Date('2026-08-20T00:00:00Z');
    const where = buildClaimListWhere({ overdueOnly: true, status: 'SUBMITTED' }, today);
    expect(where['AND']).toEqual([
      { status: 'SUBMITTED' },
      { dueDate: { lt: today } },
    ]);
  });

  it('search matches claimNo, claimTitle, contract reference/title/company', () => {
    const where = buildClaimListWhere({ search: 'delay' });
    expect(where['AND']).toEqual([
      {
        OR: [
          { claimNo: { contains: 'delay', mode: 'insensitive' } },
          { claimTitle: { contains: 'delay', mode: 'insensitive' } },
          { contract: { referenceNumber: { contains: 'delay', mode: 'insensitive' } } },
          { contract: { title: { contains: 'delay', mode: 'insensitive' } } },
          { contract: { counterpartyName: { contains: 'delay', mode: 'insensitive' } } },
        ],
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// ContractClaimsService.findAll
// ---------------------------------------------------------------------------

describe('ContractClaimsService.findAll', () => {
  it('rejects actors without contracts.read', async () => {
    const noReadActor: AuthUser = { ...ACTOR_READ_ONLY, permissions: [] };
    await expect(service.findAll({}, noReadActor)).rejects.toThrow(ForbiddenException);
  });

  it('applies the department scope filter when the actor is not ALL_DEPARTMENTS', async () => {
    mockBuildDeptFilter.mockResolvedValue({ in: ['dept-1'] });
    mockClaimFindMany.mockResolvedValue([]);
    mockClaimCount.mockResolvedValue(0);

    await service.findAll({}, ACTOR_READ_ONLY);

    const callArgs = mockClaimFindMany.mock.calls[0]![0];
    expect(callArgs.where['AND']).toContainEqual({ contract: { departmentId: { in: ['dept-1'] } } });
  });

  it('returns items with derived outstandingValue/overdueDays/isOverdue and a summary', async () => {
    mockClaimFindMany.mockResolvedValue([makeClaimRow()]);
    mockClaimCount.mockResolvedValue(1);

    const result = (await service.findAll({}, ACTOR_READ_ONLY)) as {
      items: { outstandingValue: string | null; overdueDays: number | null; isOverdue: boolean }[];
      summary: { openClaims: number };
    };

    expect(result.items[0]?.outstandingValue).toBe('1000.000');
    expect(result.items[0]?.isOverdue).toBe(true);
    expect(result.summary.openClaims).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ContractClaimsService.create
// ---------------------------------------------------------------------------

describe('ContractClaimsService.create', () => {
  it('rejects actors without contracts.update', async () => {
    await expect(
      service.create('contract-1', { claimTitle: 'x' } as never, ACTOR_READ_ONLY),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the contract does not exist', async () => {
    mockContractFindUnique.mockResolvedValue(null);
    await expect(service.create('missing', { claimTitle: 'x' } as never, ACTOR_UPDATE)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('asserts department access using the contract department', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: 'dept-1' });
    mockClaimFindUnique.mockResolvedValue(null);
    mockClaimCreate.mockResolvedValue(makeClaimRow());

    await service.create('contract-1', { claimTitle: 'Delay claim' } as never, ACTOR_UPDATE);

    expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_UPDATE, expect.anything(), 'dept-1');
  });

  it('leaves claimDate unset when not provided (never auto-defaults to today)', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: null });
    mockClaimFindUnique.mockResolvedValue(null);
    mockClaimCreate.mockResolvedValue(makeClaimRow());

    await service.create('contract-1', { claimTitle: 'x' } as never, ACTOR_UPDATE);

    const callArgs = mockClaimCreate.mock.calls[0]![0];
    expect(callArgs.data.claimDate).toBeUndefined();
  });

  it('accepts a past dueDate when claimDate is not provided', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: null });
    mockClaimFindUnique.mockResolvedValue(null);
    mockClaimCreate.mockResolvedValue(makeClaimRow());

    await expect(
      service.create('contract-1', { claimTitle: 'x', dueDate: '2020-01-01' } as never, ACTOR_UPDATE),
    ).resolves.toBeDefined();
  });

  it('rejects an invalid responsibleUserId on create', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: null });
    mockUserFindUnique.mockResolvedValue(null);

    await expect(
      service.create('contract-1', { claimTitle: 'x', responsibleUserId: 'bad-user' } as never, ACTOR_UPDATE),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects dueDate before claimDate', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: null });
    await expect(
      service.create(
        'contract-1',
        { claimTitle: 'x', claimDate: '2026-08-10', dueDate: '2026-08-01' } as never,
        ACTOR_UPDATE,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects approvedValue greater than submittedValue', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: null });
    await expect(
      service.create(
        'contract-1',
        { claimTitle: 'x', submittedValue: 500, approvedValue: 600 } as never,
        ACTOR_UPDATE,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects a duplicate claimNo within the same contract', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: null });
    mockClaimFindUnique.mockResolvedValue({ id: 'existing-claim' });

    await expect(
      service.create('contract-1', { claimTitle: 'x', claimNo: 'CLM-001' } as never, ACTOR_UPDATE),
    ).rejects.toThrow(ConflictException);
  });

  it('auto-sets closedDate when creating directly with status CLOSED', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: null });
    mockClaimFindUnique.mockResolvedValue(null);
    mockClaimCreate.mockResolvedValue(makeClaimRow({ status: 'CLOSED' }));

    await service.create('contract-1', { claimTitle: 'x', status: 'CLOSED' } as never, ACTOR_UPDATE);

    const callArgs = mockClaimCreate.mock.calls[0]![0];
    expect(callArgs.data.closedDate).toBeInstanceOf(Date);
  });

  it('creates the claim with createdByUserId set to the actor and default status DRAFT', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: null });
    mockClaimFindUnique.mockResolvedValue(null);
    mockClaimCreate.mockResolvedValue(makeClaimRow());

    await service.create('contract-1', { claimTitle: 'x', claimNo: 'CLM-002' } as never, ACTOR_UPDATE);

    const callArgs = mockClaimCreate.mock.calls[0]![0];
    expect(callArgs.data.createdByUserId).toBe(ACTOR_UPDATE.id);
    expect(callArgs.data.contractId).toBe('contract-1');
    expect(callArgs.data.status).toBeUndefined(); // left to the DB default (DRAFT) when not provided
  });
});

// ---------------------------------------------------------------------------
// ContractClaimsService.update
// ---------------------------------------------------------------------------

describe('ContractClaimsService.update', () => {
  it('rejects actors without contracts.update', async () => {
    await expect(service.update('claim-1', {}, ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the claim does not exist', async () => {
    mockClaimFindUnique.mockResolvedValue(null);
    await expect(service.update('missing', {}, ACTOR_UPDATE)).rejects.toThrow(NotFoundException);
  });

  it('rejects an invalid responsibleUserId', async () => {
    mockClaimFindUnique.mockResolvedValue({
      id: 'claim-1', contractId: 'contract-1', claimNo: 'CLM-001', status: 'SUBMITTED',
      claimDate: new Date('2026-08-01'), dueDate: null, closedDate: null,
      submittedValue: 1500, approvedValue: 500,
      contract: { departmentId: null },
    });
    mockUserFindUnique.mockResolvedValue(null);

    await expect(
      service.update('claim-1', { responsibleUserId: 'not-a-real-user' }, ACTOR_UPDATE),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('allows changing status to UNDER_NEGOTIATION with a responsible person, next action, and updated approved value', async () => {
    mockClaimFindUnique.mockResolvedValue({
      id: 'claim-1', contractId: 'contract-1', claimNo: 'CLM-001', status: 'SUBMITTED',
      claimDate: new Date('2026-08-01'), dueDate: null, closedDate: null,
      submittedValue: 1500, approvedValue: 500,
      contract: { departmentId: null },
    });
    mockUserFindUnique.mockResolvedValue({ id: 'user-2' });
    mockClaimUpdate.mockResolvedValue(
      makeClaimRow({ status: 'UNDER_NEGOTIATION', responsibleUserId: 'user-2', nextAction: 'Await client response', approvedValue: 800 }),
    );

    const result = (await service.update(
      'claim-1',
      { status: 'UNDER_NEGOTIATION', responsibleUserId: 'user-2', nextAction: 'Await client response', approvedValue: 800 },
      ACTOR_UPDATE,
    )) as { status: string; responsibleUserId: string; outstandingValue: string | null };

    expect(result.status).toBe('UNDER_NEGOTIATION');
    expect(result.responsibleUserId).toBe('user-2');
    expect(result.outstandingValue).toBe('700.000');
    const callArgs = mockClaimUpdate.mock.calls[0]![0];
    expect(callArgs.data.updatedByUserId).toBe(ACTOR_UPDATE.id);
  });

  it('rejects an updated approvedValue that exceeds the existing submittedValue', async () => {
    mockClaimFindUnique.mockResolvedValue({
      id: 'claim-1', contractId: 'contract-1', claimNo: 'CLM-001', status: 'SUBMITTED',
      claimDate: new Date('2026-08-01'), dueDate: null, closedDate: null,
      submittedValue: 1500, approvedValue: 500,
      contract: { departmentId: null },
    });

    await expect(
      service.update('claim-1', { approvedValue: 2000 }, ACTOR_UPDATE),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('auto-sets closedDate when status changes to SETTLED without an explicit closedDate', async () => {
    mockClaimFindUnique.mockResolvedValue({
      id: 'claim-1', contractId: 'contract-1', claimNo: 'CLM-001', status: 'APPROVED',
      claimDate: new Date('2026-08-01'), dueDate: null, closedDate: null,
      submittedValue: 1500, approvedValue: 1500,
      contract: { departmentId: null },
    });
    mockClaimUpdate.mockResolvedValue(makeClaimRow({ status: 'SETTLED', closedDate: new Date('2026-08-20') }));

    await service.update('claim-1', { status: 'SETTLED' }, ACTOR_UPDATE);

    const callArgs = mockClaimUpdate.mock.calls[0]![0];
    expect(callArgs.data.closedDate).toBeInstanceOf(Date);
    expect(callArgs.data.status).toBe('SETTLED');
  });

  it('rejects renaming claimNo to one already used by another claim on the same contract', async () => {
    mockClaimFindUnique
      .mockResolvedValueOnce({
        id: 'claim-1', contractId: 'contract-1', claimNo: 'CLM-001', status: 'SUBMITTED',
        claimDate: null, dueDate: null, closedDate: null,
        submittedValue: null, approvedValue: null,
        contract: { departmentId: null },
      })
      .mockResolvedValueOnce({ id: 'other-claim' });

    await expect(
      service.update('claim-1', { claimNo: 'CLM-002' }, ACTOR_UPDATE),
    ).rejects.toThrow(ConflictException);
  });

  it('validates dates against the merged effective values (existing claimDate + new dueDate)', async () => {
    mockClaimFindUnique.mockResolvedValue({
      id: 'claim-1', contractId: 'contract-1', claimNo: 'CLM-001', status: 'SUBMITTED',
      claimDate: new Date('2026-08-10'), dueDate: null, closedDate: null,
      submittedValue: null, approvedValue: null,
      contract: { departmentId: null },
    });

    await expect(
      service.update('claim-1', { dueDate: '2026-08-01' }, ACTOR_UPDATE),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});

// ---------------------------------------------------------------------------
// ContractClaimsService.close
// ---------------------------------------------------------------------------

describe('ContractClaimsService.close', () => {
  it('rejects actors without contracts.update', async () => {
    await expect(service.close('claim-1', undefined, ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the claim does not exist', async () => {
    mockClaimFindUnique.mockResolvedValue(null);
    await expect(service.close('missing', undefined, ACTOR_UPDATE)).rejects.toThrow(NotFoundException);
  });

  it('defaults to status CLOSED and sets closedDate to today when none exists', async () => {
    mockClaimFindUnique.mockResolvedValue({ id: 'claim-1', closedDate: null, contract: { departmentId: null } });
    mockClaimUpdate.mockResolvedValue(makeClaimRow({ status: 'CLOSED', closedDate: new Date('2026-08-20') }));

    const result = (await service.close('claim-1', undefined, ACTOR_UPDATE)) as { status: string };

    expect(result.status).toBe('CLOSED');
    const callArgs = mockClaimUpdate.mock.calls[0]![0];
    expect(callArgs.data.status).toBe('CLOSED');
    expect(callArgs.data.closedDate).toBeInstanceOf(Date);
    expect(callArgs.data.updatedByUserId).toBe(ACTOR_UPDATE.id);
  });

  it('honors an explicit SETTLED target status', async () => {
    mockClaimFindUnique.mockResolvedValue({ id: 'claim-1', closedDate: null, contract: { departmentId: null } });
    mockClaimUpdate.mockResolvedValue(makeClaimRow({ status: 'SETTLED', closedDate: new Date('2026-08-20') }));

    await service.close('claim-1', 'SETTLED', ACTOR_UPDATE);

    const callArgs = mockClaimUpdate.mock.calls[0]![0];
    expect(callArgs.data.status).toBe('SETTLED');
  });

  it('preserves an already-set closedDate rather than overwriting it', async () => {
    const existingClosedDate = new Date('2026-08-05');
    mockClaimFindUnique.mockResolvedValue({ id: 'claim-1', closedDate: existingClosedDate, contract: { departmentId: null } });
    mockClaimUpdate.mockResolvedValue(makeClaimRow({ status: 'CLOSED', closedDate: existingClosedDate }));

    await service.close('claim-1', undefined, ACTOR_UPDATE);

    const callArgs = mockClaimUpdate.mock.calls[0]![0];
    expect(callArgs.data.closedDate).toBe(existingClosedDate);
  });

  it('asserts department access using the parent contract department', async () => {
    mockClaimFindUnique.mockResolvedValue({ id: 'claim-1', closedDate: null, contract: { departmentId: 'dept-1' } });
    mockClaimUpdate.mockResolvedValue(makeClaimRow());

    await service.close('claim-1', undefined, ACTOR_UPDATE);

    expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_UPDATE, expect.anything(), 'dept-1');
  });
});
