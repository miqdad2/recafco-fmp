import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import {
  ContractIssuesService,
  buildIssueListWhere,
  computeIssueOverdueDays,
  computeIssueIsOverdue,
  computeIssueSummary,
  assertIssueDatesValid,
  resolveClosedDate,
} from './contract-issues.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';

// ---------------------------------------------------------------------------
// Client mocks
// ---------------------------------------------------------------------------

const mockIssueFindMany = vi.fn();
const mockIssueCount = vi.fn();
const mockIssueFindUnique = vi.fn();
const mockIssueCreate = vi.fn();
const mockIssueUpdate = vi.fn();
const mockContractFindUnique = vi.fn();
const mockUserFindUnique = vi.fn();

const mockClient = {
  contractIssue: {
    findMany: mockIssueFindMany,
    count: mockIssueCount,
    findUnique: mockIssueFindUnique,
    create: mockIssueCreate,
    update: mockIssueUpdate,
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

function makeIssueRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'issue-1',
    contractId: 'contract-1',
    issueNo: 'ISS-001',
    title: 'Drawing approval delay',
    description: null,
    category: 'Technical',
    priority: 'HIGH',
    status: 'OPEN',
    responsibleUserId: null,
    raisedDate: new Date('2026-08-01'),
    dueDate: new Date('2026-08-10'),
    closedDate: null,
    resolution: null,
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
      ownerUser: { id: 'user-manager-1', displayName: 'Manager' },
      department: { id: 'dept-1', name: 'Engineering' },
    },
    ...overrides,
  };
}

let service: ContractIssuesService;

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildDeptFilter.mockResolvedValue(null);
  mockAssertCanAccessDepartment.mockResolvedValue(undefined);
  service = new ContractIssuesService(mockDb, mockDeptAccess);
});

// ---------------------------------------------------------------------------
// computeIssueOverdueDays / computeIssueIsOverdue
// ---------------------------------------------------------------------------

describe('computeIssueOverdueDays', () => {
  const today = new Date('2026-08-20T00:00:00Z');

  it('returns null for CLOSED/RESOLVED/CANCELLED statuses', () => {
    expect(computeIssueOverdueDays({ dueDate: new Date('2026-08-01'), status: 'CLOSED' }, today)).toBeNull();
    expect(computeIssueOverdueDays({ dueDate: new Date('2026-08-01'), status: 'RESOLVED' }, today)).toBeNull();
    expect(computeIssueOverdueDays({ dueDate: new Date('2026-08-01'), status: 'CANCELLED' }, today)).toBeNull();
  });

  it('returns null when dueDate is missing', () => {
    expect(computeIssueOverdueDays({ dueDate: null, status: 'OPEN' }, today)).toBeNull();
  });

  it('returns null when dueDate is today or in the future', () => {
    expect(computeIssueOverdueDays({ dueDate: new Date('2026-08-25'), status: 'OPEN' }, today)).toBeNull();
  });

  it('returns the day count when overdue and open', () => {
    expect(computeIssueOverdueDays({ dueDate: new Date('2026-08-10'), status: 'OPEN' }, today)).toBe(10);
  });
});

describe('computeIssueIsOverdue', () => {
  it('mirrors computeIssueOverdueDays !== null', () => {
    const today = new Date('2026-08-20T00:00:00Z');
    expect(computeIssueIsOverdue({ dueDate: new Date('2026-08-10'), status: 'OPEN' }, today)).toBe(true);
    expect(computeIssueIsOverdue({ dueDate: new Date('2026-08-10'), status: 'CLOSED' }, today)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeIssueSummary
// ---------------------------------------------------------------------------

describe('computeIssueSummary', () => {
  it('aggregates totals, open, in-progress, high/critical, overdue, closed', () => {
    const today = new Date('2026-08-20T00:00:00Z');
    const rows = [
      { status: 'OPEN', priority: 'HIGH', dueDate: new Date('2026-08-01') },
      { status: 'IN_PROGRESS', priority: 'CRITICAL', dueDate: new Date('2099-01-01') },
      { status: 'CLOSED', priority: 'LOW', dueDate: new Date('2026-08-01') },
      { status: 'OPEN', priority: 'MEDIUM', dueDate: null },
    ];
    const summary = computeIssueSummary(rows, today);
    expect(summary.totalIssues).toBe(4);
    expect(summary.openIssues).toBe(2);
    expect(summary.inProgressIssues).toBe(1);
    expect(summary.highCriticalIssues).toBe(2);
    expect(summary.overdueIssues).toBe(1); // only the OPEN one with a past dueDate
    expect(summary.closedIssues).toBe(1);
  });

  it('returns all-zero summary for an empty result set', () => {
    expect(computeIssueSummary([])).toEqual({
      totalIssues: 0,
      openIssues: 0,
      inProgressIssues: 0,
      highCriticalIssues: 0,
      overdueIssues: 0,
      closedIssues: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// assertIssueDatesValid
// ---------------------------------------------------------------------------

describe('assertIssueDatesValid', () => {
  it('rejects dueDate before raisedDate', () => {
    expect(() =>
      assertIssueDatesValid({ raisedDate: new Date('2026-08-10'), dueDate: new Date('2026-08-01') }),
    ).toThrow(UnprocessableEntityException);
  });

  it('allows dueDate on or after raisedDate', () => {
    expect(() =>
      assertIssueDatesValid({ raisedDate: new Date('2026-08-01'), dueDate: new Date('2026-08-10') }),
    ).not.toThrow();
  });

  it('allows missing dates', () => {
    expect(() => assertIssueDatesValid({ raisedDate: null, dueDate: undefined })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// resolveClosedDate
// ---------------------------------------------------------------------------

describe('resolveClosedDate', () => {
  const today = new Date('2026-08-20T00:00:00Z');

  it('uses the explicit dto value when provided', () => {
    expect(resolveClosedDate('CLOSED', '2026-08-15', null, today)).toEqual(new Date('2026-08-15'));
  });

  it('auto-sets to today when status becomes CLOSED with no existing closedDate', () => {
    expect(resolveClosedDate('CLOSED', undefined, null, today)).toEqual(today);
  });

  it('auto-sets to today when status becomes RESOLVED with no existing closedDate', () => {
    expect(resolveClosedDate('RESOLVED', undefined, null, today)).toEqual(today);
  });

  it('does not touch closedDate when one already exists', () => {
    expect(resolveClosedDate('CLOSED', undefined, new Date('2026-08-01'), today)).toBeUndefined();
  });

  it('does not auto-set for CANCELLED (not a resolution)', () => {
    expect(resolveClosedDate('CANCELLED', undefined, null, today)).toBeUndefined();
  });

  it('does not touch closedDate for a non-terminal status', () => {
    expect(resolveClosedDate('IN_PROGRESS', undefined, null, today)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildIssueListWhere
// ---------------------------------------------------------------------------

describe('buildIssueListWhere', () => {
  it('returns an empty where for no filters', () => {
    expect(buildIssueListWhere({})).toEqual({});
  });

  it('filters by contractId directly', () => {
    expect(buildIssueListWhere({ contractId: 'contract-1' })).toEqual({ contractId: 'contract-1' });
  });

  it('filters by status/priority/category via AND', () => {
    const where = buildIssueListWhere({ status: 'OPEN', priority: 'HIGH', category: 'Technical' });
    expect(where['AND']).toEqual([
      { status: 'OPEN' },
      { priority: 'HIGH' },
      { category: 'Technical' },
    ]);
  });

  it('combines overdueOnly with an implicit not-closed status filter', () => {
    const today = new Date('2026-08-20T00:00:00Z');
    const where = buildIssueListWhere({ overdueOnly: true }, today);
    expect(where['AND']).toEqual([
      { dueDate: { lt: today } },
      { status: { notIn: ['CLOSED', 'RESOLVED', 'CANCELLED'] } },
    ]);
  });

  it('does not add the implicit status filter when an explicit status is also set', () => {
    const today = new Date('2026-08-20T00:00:00Z');
    const where = buildIssueListWhere({ overdueOnly: true, status: 'OPEN' }, today);
    expect(where['AND']).toEqual([
      { status: 'OPEN' },
      { dueDate: { lt: today } },
    ]);
  });

  it('search matches issueNo, title, contract reference/title/company', () => {
    const where = buildIssueListWhere({ search: 'delay' });
    expect(where['AND']).toEqual([
      {
        OR: [
          { issueNo: { contains: 'delay', mode: 'insensitive' } },
          { title: { contains: 'delay', mode: 'insensitive' } },
          { contract: { referenceNumber: { contains: 'delay', mode: 'insensitive' } } },
          { contract: { title: { contains: 'delay', mode: 'insensitive' } } },
          { contract: { counterpartyName: { contains: 'delay', mode: 'insensitive' } } },
        ],
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// ContractIssuesService.findAll
// ---------------------------------------------------------------------------

describe('ContractIssuesService.findAll', () => {
  it('rejects actors without contracts.read', async () => {
    const noReadActor: AuthUser = { ...ACTOR_READ_ONLY, permissions: [] };
    await expect(service.findAll({}, noReadActor)).rejects.toThrow(ForbiddenException);
  });

  it('applies the department scope filter when the actor is not ALL_DEPARTMENTS', async () => {
    mockBuildDeptFilter.mockResolvedValue({ in: ['dept-1'] });
    mockIssueFindMany.mockResolvedValue([]);
    mockIssueCount.mockResolvedValue(0);

    await service.findAll({}, ACTOR_READ_ONLY);

    const callArgs = mockIssueFindMany.mock.calls[0]![0];
    expect(callArgs.where['AND']).toContainEqual({ contract: { departmentId: { in: ['dept-1'] } } });
  });

  it('returns items with derived overdueDays/isOverdue and a summary', async () => {
    mockIssueFindMany.mockResolvedValue([makeIssueRow()]);
    mockIssueCount.mockResolvedValue(1);

    const result = await service.findAll({}, ACTOR_READ_ONLY) as {
      items: { overdueDays: number | null; isOverdue: boolean }[];
      summary: { totalIssues: number };
    };

    expect(result.items[0]?.isOverdue).toBe(true);
    expect(result.summary.totalIssues).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ContractIssuesService.create
// ---------------------------------------------------------------------------

describe('ContractIssuesService.create', () => {
  it('rejects actors without contracts.update', async () => {
    await expect(service.create('contract-1', { title: 'x' } as never, ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the contract does not exist', async () => {
    mockContractFindUnique.mockResolvedValue(null);
    await expect(service.create('missing', { title: 'x' } as never, ACTOR_UPDATE)).rejects.toThrow(NotFoundException);
  });

  it('asserts department access using the contract department', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: 'dept-1' });
    mockIssueFindUnique.mockResolvedValue(null);
    mockIssueCreate.mockResolvedValue(makeIssueRow());

    await service.create('contract-1', { title: 'Drawing approval delay' } as never, ACTOR_UPDATE);

    expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_UPDATE, expect.anything(), 'dept-1');
  });

  it('leaves raisedDate unset when not provided (never auto-defaults to today)', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: null });
    mockIssueFindUnique.mockResolvedValue(null);
    mockIssueCreate.mockResolvedValue(makeIssueRow());

    await service.create('contract-1', { title: 'x' } as never, ACTOR_UPDATE);

    const callArgs = mockIssueCreate.mock.calls[0]![0];
    expect(callArgs.data.raisedDate).toBeUndefined();
  });

  it('accepts a past dueDate when raisedDate is not provided', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: null });
    mockIssueFindUnique.mockResolvedValue(null);
    mockIssueCreate.mockResolvedValue(makeIssueRow());

    await expect(
      service.create('contract-1', { title: 'x', dueDate: '2020-01-01' } as never, ACTOR_UPDATE),
    ).resolves.toBeDefined();
  });

  it('rejects an invalid responsibleUserId on create', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: null });
    mockUserFindUnique.mockResolvedValue(null);

    await expect(
      service.create('contract-1', { title: 'x', responsibleUserId: 'bad-user' } as never, ACTOR_UPDATE),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects dueDate before raisedDate', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: null });
    await expect(
      service.create('contract-1', { title: 'x', raisedDate: '2026-08-10', dueDate: '2026-08-01' } as never, ACTOR_UPDATE),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects a duplicate issueNo within the same contract', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: null });
    mockIssueFindUnique.mockResolvedValue({ id: 'existing-issue' });

    await expect(
      service.create('contract-1', { title: 'x', issueNo: 'ISS-001' } as never, ACTOR_UPDATE),
    ).rejects.toThrow(ConflictException);
  });

  it('auto-sets closedDate when creating directly with status CLOSED', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: null });
    mockIssueFindUnique.mockResolvedValue(null);
    mockIssueCreate.mockResolvedValue(makeIssueRow({ status: 'CLOSED' }));

    await service.create('contract-1', { title: 'x', status: 'CLOSED' } as never, ACTOR_UPDATE);

    const callArgs = mockIssueCreate.mock.calls[0]![0];
    expect(callArgs.data.closedDate).toBeInstanceOf(Date);
  });

  it('creates the issue with createdByUserId set to the actor', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: null });
    mockIssueFindUnique.mockResolvedValue(null);
    mockIssueCreate.mockResolvedValue(makeIssueRow());

    await service.create('contract-1', { title: 'x', issueNo: 'ISS-002' } as never, ACTOR_UPDATE);

    const callArgs = mockIssueCreate.mock.calls[0]![0];
    expect(callArgs.data.createdByUserId).toBe(ACTOR_UPDATE.id);
    expect(callArgs.data.contractId).toBe('contract-1');
  });
});

// ---------------------------------------------------------------------------
// ContractIssuesService.update
// ---------------------------------------------------------------------------

describe('ContractIssuesService.update', () => {
  it('rejects actors without contracts.update', async () => {
    await expect(service.update('issue-1', {}, ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the issue does not exist', async () => {
    mockIssueFindUnique.mockResolvedValue(null);
    await expect(service.update('missing', {}, ACTOR_UPDATE)).rejects.toThrow(NotFoundException);
  });

  it('rejects an invalid responsibleUserId', async () => {
    mockIssueFindUnique.mockResolvedValue({
      id: 'issue-1', contractId: 'contract-1', issueNo: 'ISS-001', status: 'OPEN',
      raisedDate: new Date('2026-08-01'), dueDate: null, closedDate: null,
      contract: { departmentId: null },
    });
    mockUserFindUnique.mockResolvedValue(null);

    await expect(
      service.update('issue-1', { responsibleUserId: 'not-a-real-user' }, ACTOR_UPDATE),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('allows changing status to IN_PROGRESS with a responsible person and remarks', async () => {
    mockIssueFindUnique.mockResolvedValue({
      id: 'issue-1', contractId: 'contract-1', issueNo: 'ISS-001', status: 'OPEN',
      raisedDate: new Date('2026-08-01'), dueDate: null, closedDate: null,
      contract: { departmentId: null },
    });
    mockUserFindUnique.mockResolvedValue({ id: 'user-2' });
    mockIssueUpdate.mockResolvedValue(makeIssueRow({ status: 'IN_PROGRESS', responsibleUserId: 'user-2', remarks: 'note' }));

    const result = await service.update(
      'issue-1',
      { status: 'IN_PROGRESS', responsibleUserId: 'user-2', remarks: 'note' },
      ACTOR_UPDATE,
    ) as { status: string; responsibleUserId: string };

    expect(result.status).toBe('IN_PROGRESS');
    expect(result.responsibleUserId).toBe('user-2');
    const callArgs = mockIssueUpdate.mock.calls[0]![0];
    expect(callArgs.data.updatedByUserId).toBe(ACTOR_UPDATE.id);
  });

  it('auto-sets closedDate when status changes to CLOSED without an explicit closedDate', async () => {
    mockIssueFindUnique.mockResolvedValue({
      id: 'issue-1', contractId: 'contract-1', issueNo: 'ISS-001', status: 'OPEN',
      raisedDate: new Date('2026-08-01'), dueDate: null, closedDate: null,
      contract: { departmentId: null },
    });
    mockIssueUpdate.mockResolvedValue(makeIssueRow({ status: 'CLOSED', closedDate: new Date('2026-08-20') }));

    await service.update('issue-1', { status: 'CLOSED' }, ACTOR_UPDATE);

    const callArgs = mockIssueUpdate.mock.calls[0]![0];
    expect(callArgs.data.closedDate).toBeInstanceOf(Date);
    expect(callArgs.data.status).toBe('CLOSED');
  });

  it('rejects renaming issueNo to one already used by another issue on the same contract', async () => {
    mockIssueFindUnique
      .mockResolvedValueOnce({
        id: 'issue-1', contractId: 'contract-1', issueNo: 'ISS-001', status: 'OPEN',
        raisedDate: null, dueDate: null, closedDate: null,
        contract: { departmentId: null },
      })
      .mockResolvedValueOnce({ id: 'other-issue' });

    await expect(
      service.update('issue-1', { issueNo: 'ISS-002' }, ACTOR_UPDATE),
    ).rejects.toThrow(ConflictException);
  });

  it('validates dates against the merged effective values (existing raisedDate + new dueDate)', async () => {
    mockIssueFindUnique.mockResolvedValue({
      id: 'issue-1', contractId: 'contract-1', issueNo: 'ISS-001', status: 'OPEN',
      raisedDate: new Date('2026-08-10'), dueDate: null, closedDate: null,
      contract: { departmentId: null },
    });

    await expect(
      service.update('issue-1', { dueDate: '2026-08-01' }, ACTOR_UPDATE),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});

// ---------------------------------------------------------------------------
// ContractIssuesService.close
// ---------------------------------------------------------------------------

describe('ContractIssuesService.close', () => {
  it('rejects actors without contracts.update', async () => {
    await expect(service.close('issue-1', ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the issue does not exist', async () => {
    mockIssueFindUnique.mockResolvedValue(null);
    await expect(service.close('missing', ACTOR_UPDATE)).rejects.toThrow(NotFoundException);
  });

  it('sets status CLOSED and defaults closedDate to today when none exists', async () => {
    mockIssueFindUnique.mockResolvedValue({ id: 'issue-1', closedDate: null, contract: { departmentId: null } });
    mockIssueUpdate.mockResolvedValue(makeIssueRow({ status: 'CLOSED', closedDate: new Date('2026-08-20') }));

    const result = await service.close('issue-1', ACTOR_UPDATE) as { status: string };

    expect(result.status).toBe('CLOSED');
    const callArgs = mockIssueUpdate.mock.calls[0]![0];
    expect(callArgs.data.status).toBe('CLOSED');
    expect(callArgs.data.closedDate).toBeInstanceOf(Date);
    expect(callArgs.data.updatedByUserId).toBe(ACTOR_UPDATE.id);
  });

  it('preserves an already-set closedDate rather than overwriting it', async () => {
    const existingClosedDate = new Date('2026-08-05');
    mockIssueFindUnique.mockResolvedValue({ id: 'issue-1', closedDate: existingClosedDate, contract: { departmentId: null } });
    mockIssueUpdate.mockResolvedValue(makeIssueRow({ status: 'CLOSED', closedDate: existingClosedDate }));

    await service.close('issue-1', ACTOR_UPDATE);

    const callArgs = mockIssueUpdate.mock.calls[0]![0];
    expect(callArgs.data.closedDate).toBe(existingClosedDate);
  });

  it('asserts department access using the parent contract department', async () => {
    mockIssueFindUnique.mockResolvedValue({ id: 'issue-1', closedDate: null, contract: { departmentId: 'dept-1' } });
    mockIssueUpdate.mockResolvedValue(makeIssueRow());

    await service.close('issue-1', ACTOR_UPDATE);

    expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_UPDATE, expect.anything(), 'dept-1');
  });
});
