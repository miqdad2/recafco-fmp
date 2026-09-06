import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import {
  ContractScheduleService,
  contractToScheduleItems,
  workflowTaskToScheduleItem,
  issueToScheduleItem,
  claimToScheduleItem,
  paymentToScheduleItem,
  closeoutRequestToScheduleItems,
  filterScheduleItems,
  sortScheduleItems,
  computeScheduleSummary,
  buildScheduleContractWhere,
} from './contract-schedule.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';

// ---------------------------------------------------------------------------
// Client mocks
// ---------------------------------------------------------------------------

const mockContractFindMany = vi.fn();
const mockContractFindUnique = vi.fn();
const mockWorkflowTaskFindMany = vi.fn();
const mockIssueFindMany = vi.fn();
const mockClaimFindMany = vi.fn();
const mockPaymentFindMany = vi.fn();
const mockCloseoutRequestFindMany = vi.fn();

const mockClient = {
  contract: { findMany: mockContractFindMany, findUnique: mockContractFindUnique },
  contractWorkflowTask: { findMany: mockWorkflowTaskFindMany },
  contractIssue: { findMany: mockIssueFindMany },
  contractClaim: { findMany: mockClaimFindMany },
  contractPayment: { findMany: mockPaymentFindMany },
  contractCloseoutRequest: { findMany: mockCloseoutRequestFindMany },
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

function makeContract(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'contract-1',
    referenceNumber: 'CONTRACT-2026-000001',
    title: 'Test Contract',
    counterpartyName: 'Acme Co',
    status: 'ACTIVE',
    startDate: null,
    endDate: null,
    forecastCompletionDate: null,
    departmentId: null,
    department: null,
    currency: 'KWD',
    ownerUser: { id: 'user-manager-1', displayName: 'Manager' },
    ...overrides,
  };
}

let service: ContractScheduleService;

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildDeptFilter.mockResolvedValue(null);
  mockAssertCanAccessDepartment.mockResolvedValue(undefined);
  service = new ContractScheduleService(mockDb, mockDeptAccess);
});

// ---------------------------------------------------------------------------
// contractToScheduleItems
// ---------------------------------------------------------------------------

describe('contractToScheduleItems', () => {
  const today = new Date('2026-08-20T00:00:00Z');

  it('emits no items when no dates are set', () => {
    expect(contractToScheduleItems(makeContract() as never, today)).toEqual([]);
  });

  it('emits CONTRACT_START, never overdue, even when in the past', () => {
    const items = contractToScheduleItems(makeContract({ startDate: new Date('2020-01-01') }) as never, today);
    expect(items).toHaveLength(1);
    expect(items[0]?.sourceType).toBe('CONTRACT_START');
    expect(items[0]?.isOverdue).toBe(false);
  });

  it('marks CONTRACT_END overdue when past and contract not CLOSED', () => {
    const items = contractToScheduleItems(makeContract({ endDate: new Date('2026-08-01'), status: 'ACTIVE' }) as never, today);
    const endItem = items.find((i) => i.sourceType === 'CONTRACT_END');
    expect(endItem?.isOverdue).toBe(true);
    expect(endItem?.overdueDays).toBe(19);
    expect(endItem?.status).toBe('Ended');
  });

  it('does NOT mark CONTRACT_END overdue when the contract is CLOSED (final status)', () => {
    const items = contractToScheduleItems(makeContract({ endDate: new Date('2026-08-01'), status: 'CLOSED' }) as never, today);
    const endItem = items.find((i) => i.sourceType === 'CONTRACT_END');
    expect(endItem?.isOverdue).toBe(false);
    expect(endItem?.status).toBe('Closed');
  });

  it('marks FORECAST_COMPLETION overdue when past and not CLOSED', () => {
    const items = contractToScheduleItems(makeContract({ forecastCompletionDate: new Date('2026-08-10') }) as never, today);
    const forecastItem = items.find((i) => i.sourceType === 'FORECAST_COMPLETION');
    expect(forecastItem?.isOverdue).toBe(true);
    expect(forecastItem?.status).toBe('Forecast Due');
  });

  it('emits all 3 items with correct actionUrl pointing to the contract overview', () => {
    const items = contractToScheduleItems(makeContract({
      startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), forecastCompletionDate: new Date('2026-11-01'),
    }) as never, today);
    expect(items).toHaveLength(3);
    for (const item of items) expect(item.actionUrl).toBe('/contracts/contract-1');
  });
});

// ---------------------------------------------------------------------------
// workflowTaskToScheduleItem / issueToScheduleItem / claimToScheduleItem / paymentToScheduleItem
// ---------------------------------------------------------------------------

describe('workflowTaskToScheduleItem', () => {
  const today = new Date('2026-08-20T00:00:00Z');
  const contract = makeContract() as never;

  it('returns null when the task has no dueDate (nothing to schedule)', () => {
    expect(workflowTaskToScheduleItem({ id: 't1', taskName: 'x', status: 'NOT_STARTED', priority: 'MEDIUM', dueDate: null, responsibleUser: null }, contract, today)).toBeNull();
  });

  it('reuses computeTaskIsOverdue: COMPLETED/APPROVED never overdue even with a past dueDate', () => {
    const item = workflowTaskToScheduleItem({ id: 't1', taskName: 'x', status: 'COMPLETED', priority: 'HIGH', dueDate: new Date('2020-01-01'), responsibleUser: null }, contract, today);
    expect(item?.isOverdue).toBe(false);
  });

  it('flags a NOT_STARTED task with a past dueDate as overdue, with actionUrl to the workflow tab', () => {
    const item = workflowTaskToScheduleItem({ id: 't1', taskName: 'Drawing Review', status: 'NOT_STARTED', priority: 'HIGH', dueDate: new Date('2026-08-10'), responsibleUser: { id: 'u1', displayName: 'Bob' } }, contract, today);
    expect(item?.isOverdue).toBe(true);
    expect(item?.overdueDays).toBe(10);
    expect(item?.actionUrl).toBe('/contracts/contract-1/workflow');
    expect(item?.priority).toBe('HIGH');
    expect(item?.responsibleUser).toEqual({ id: 'u1', displayName: 'Bob' });
  });
});

describe('issueToScheduleItem', () => {
  const today = new Date('2026-08-20T00:00:00Z');
  const contract = makeContract() as never;

  it('returns null without a dueDate', () => {
    expect(issueToScheduleItem({ id: 'i1', title: 'x', status: 'OPEN', priority: 'LOW', dueDate: null, responsibleUser: null }, contract, today)).toBeNull();
  });

  it('CLOSED issues are never overdue', () => {
    const item = issueToScheduleItem({ id: 'i1', title: 'x', status: 'CLOSED', priority: 'LOW', dueDate: new Date('2020-01-01'), responsibleUser: null }, contract, today);
    expect(item?.isOverdue).toBe(false);
  });

  it('OPEN issue with past dueDate is overdue, links to the issue log', () => {
    const item = issueToScheduleItem({ id: 'i1', title: 'Site access blocked', status: 'OPEN', priority: 'CRITICAL', dueDate: new Date('2026-08-01'), responsibleUser: null }, contract, today);
    expect(item?.isOverdue).toBe(true);
    expect(item?.actionUrl).toBe('/contracts/contract-1/issues');
  });
});

describe('claimToScheduleItem', () => {
  const today = new Date('2026-08-20T00:00:00Z');
  const contract = makeContract() as never;

  it('returns null without a dueDate', () => {
    expect(claimToScheduleItem({ id: 'c1', claimTitle: 'x', status: 'DRAFT', dueDate: null, responsibleUser: null, submittedValue: null, approvedValue: null }, contract, today)).toBeNull();
  });

  it('computes amount as outstanding value (submitted - approved) and links to claims', () => {
    const item = claimToScheduleItem({ id: 'c1', claimTitle: 'Delay claim', status: 'SUBMITTED', dueDate: new Date('2026-08-01'), responsibleUser: null, submittedValue: 1000, approvedValue: 300 }, contract, today);
    expect(item?.amount).toBe('700.000');
    expect(item?.currency).toBe('KWD');
    expect(item?.isOverdue).toBe(true);
    expect(item?.actionUrl).toBe('/contracts/contract-1/claims');
  });

  it('SETTLED/CLOSED/CANCELLED/REJECTED claims are never overdue', () => {
    for (const status of ['SETTLED', 'CLOSED', 'CANCELLED', 'REJECTED']) {
      const item = claimToScheduleItem({ id: 'c1', claimTitle: 'x', status, dueDate: new Date('2020-01-01'), responsibleUser: null, submittedValue: 100, approvedValue: 100 }, contract, today);
      expect(item?.isOverdue).toBe(false);
    }
  });
});

describe('paymentToScheduleItem', () => {
  const today = new Date('2026-08-20T00:00:00Z');
  const contract = makeContract() as never;

  it('returns null without a dueDate', () => {
    expect(paymentToScheduleItem({ id: 'p1', paymentNo: null, invoiceNumber: null, status: 'SUBMITTED', dueDate: null, submittedAmount: null, certifiedAmount: null, paidAmount: null }, contract, today)).toBeNull();
  });

  it('always has a null responsibleUser (payments have no responsible-user field)', () => {
    const item = paymentToScheduleItem({ id: 'p1', paymentNo: 'PAY-001', invoiceNumber: null, status: 'SUBMITTED', dueDate: new Date('2026-08-01'), submittedAmount: 500, certifiedAmount: null, paidAmount: 0 }, contract, today);
    expect(item?.responsibleUser).toBeNull();
    expect(item?.amount).toBe('500.000');
    expect(item?.actionUrl).toBe('/contracts/contract-1/payments');
  });

  it('PAID/CANCELLED payments are never overdue', () => {
    for (const status of ['PAID', 'CANCELLED']) {
      const item = paymentToScheduleItem({ id: 'p1', paymentNo: 'PAY-001', invoiceNumber: null, status, dueDate: new Date('2020-01-01'), submittedAmount: 500, certifiedAmount: null, paidAmount: 500 }, contract, today);
      expect(item?.isOverdue).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// closeoutRequestToScheduleItems
// ---------------------------------------------------------------------------

describe('closeoutRequestToScheduleItems', () => {
  const contract = makeContract() as never;

  it('always emits a CLOSEOUT_REQUEST item (requestedAt always set)', () => {
    const items = closeoutRequestToScheduleItems(
      { id: 'r1', requestNo: 'CLO-01', status: 'SUBMITTED', requestedAt: new Date('2026-08-01'), approvedAt: null, closedAt: null, requestedByUser: { id: 'u1', displayName: 'Bob' } },
      contract,
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.sourceType).toBe('CLOSEOUT_REQUEST');
  });

  it('emits approval and closed items only when those dates are set', () => {
    const items = closeoutRequestToScheduleItems(
      { id: 'r1', requestNo: 'CLO-01', status: 'CLOSED', requestedAt: new Date('2026-08-01'), approvedAt: new Date('2026-08-05'), closedAt: new Date('2026-08-10'), requestedByUser: { id: 'u1', displayName: 'Bob' } },
      contract,
    );
    expect(items.map((i) => i.sourceType)).toEqual(['CLOSEOUT_REQUEST', 'CLOSEOUT_APPROVAL', 'CLOSEOUT_CLOSED']);
  });

  it('closeout items are never overdue, even with very old dates (point-in-time markers, not due dates)', () => {
    const items = closeoutRequestToScheduleItems(
      { id: 'r1', requestNo: 'CLO-01', status: 'SUBMITTED', requestedAt: new Date('2020-01-01'), approvedAt: null, closedAt: null, requestedByUser: { id: 'u1', displayName: 'Bob' } },
      contract,
    );
    expect(items[0]?.isOverdue).toBe(false);
    expect(items[0]?.overdueDays).toBeNull();
  });

  it('links to the closeout tab', () => {
    const items = closeoutRequestToScheduleItems(
      { id: 'r1', requestNo: 'CLO-01', status: 'SUBMITTED', requestedAt: new Date('2026-08-01'), approvedAt: null, closedAt: null, requestedByUser: { id: 'u1', displayName: 'Bob' } },
      contract,
    );
    expect(items[0]?.actionUrl).toBe('/contracts/contract-1/closeout');
  });
});

// ---------------------------------------------------------------------------
// filterScheduleItems / sortScheduleItems
// ---------------------------------------------------------------------------

describe('filterScheduleItems', () => {
  const today = new Date('2026-08-20T00:00:00Z');
  function makeItem(overrides: Record<string, unknown> = {}) {
    return {
      id: 'x', sourceType: 'WORKFLOW_TASK', sourceId: 'x', contractId: 'c1', contractReference: 'R', contractTitle: 'T',
      companyName: 'Co', department: null, title: 'x', description: null, date: '2026-08-15', status: 'OPEN', priority: null,
      responsibleUser: null, amount: null, currency: null, isOverdue: false, overdueDays: null, actionUrl: '/x',
      ...overrides,
    } as never;
  }

  it('filters by itemType', () => {
    const items = [makeItem({ sourceType: 'WORKFLOW_TASK' }), makeItem({ sourceType: 'ISSUE_DUE' })];
    expect(filterScheduleItems(items, { itemType: 'ISSUE_DUE' } as never, today)).toHaveLength(1);
  });

  it('filters by responsibleUserId', () => {
    const items = [makeItem({ responsibleUser: { id: 'u1', displayName: 'A' } }), makeItem({ responsibleUser: { id: 'u2', displayName: 'B' } })];
    expect(filterScheduleItems(items, { responsibleUserId: 'u1' } as never, today)).toHaveLength(1);
  });

  it('filters by date range (inclusive)', () => {
    const items = [makeItem({ date: '2026-08-01' }), makeItem({ date: '2026-08-15' }), makeItem({ date: '2026-08-30' })];
    const filtered = filterScheduleItems(items, { dateFrom: '2026-08-10', dateTo: '2026-08-20' } as never, today);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.date).toBe('2026-08-15');
  });

  it('overdueOnly keeps only isOverdue items', () => {
    const items = [makeItem({ isOverdue: true }), makeItem({ isOverdue: false })];
    expect(filterScheduleItems(items, { overdueOnly: true } as never, today)).toHaveLength(1);
  });

  it('upcomingOnly keeps only items on/after today', () => {
    const items = [makeItem({ date: '2026-08-19' }), makeItem({ date: '2026-08-20' }), makeItem({ date: '2026-08-21' })];
    const filtered = filterScheduleItems(items, { upcomingOnly: true } as never, today);
    expect(filtered.map((i) => i.date)).toEqual(['2026-08-20', '2026-08-21']);
  });
});

describe('sortScheduleItems', () => {
  it('sorts ascending by date (most overdue first, naturally)', () => {
    const items = [{ date: '2026-08-20' }, { date: '2026-01-01' }, { date: '2026-12-31' }] as unknown as Parameters<typeof sortScheduleItems>[0];
    expect(sortScheduleItems(items).map((i) => i.date)).toEqual(['2026-01-01', '2026-08-20', '2026-12-31']);
  });
});

// ---------------------------------------------------------------------------
// computeScheduleSummary
// ---------------------------------------------------------------------------

describe('computeScheduleSummary', () => {
  const today = new Date('2026-08-20T00:00:00Z');
  function makeItem(overrides: Record<string, unknown> = {}) {
    return {
      id: 'x', sourceType: 'WORKFLOW_TASK', sourceId: 'x', contractId: 'c1', contractReference: 'R', contractTitle: 'T',
      companyName: 'Co', department: null, title: 'x', description: null, date: '2026-08-20', status: 'OPEN', priority: null,
      responsibleUser: null, amount: null, currency: null, isOverdue: false, overdueDays: null, actionUrl: '/x',
      ...overrides,
    } as never;
  }

  it('counts totals, dueToday, upcomingThisWeek, overdue, and per-type due counts', () => {
    const items = [
      makeItem({ sourceType: 'WORKFLOW_TASK', date: '2026-08-20' }), // due today
      makeItem({ sourceType: 'PAYMENT_DUE', date: '2026-08-22', isOverdue: false }), // upcoming this week
      makeItem({ sourceType: 'ISSUE_DUE', date: '2026-08-01', isOverdue: true }), // overdue
      makeItem({ sourceType: 'CLAIM_DUE', date: '2026-09-01', isOverdue: false }), // beyond the week
    ];
    const summary = computeScheduleSummary(items, today);
    expect(summary.totalItems).toBe(4);
    expect(summary.dueToday).toBe(1);
    expect(summary.upcomingThisWeek).toBe(2); // today's item + the 08-22 one both fall in [today, today+7]
    expect(summary.overdueItems).toBe(1);
    expect(summary.workflowDue).toBe(1);
    expect(summary.paymentDue).toBe(1);
    expect(summary.issueClaimDue).toBe(2);
  });

  it('counts distinct contracts ending soon from CONTRACT_END/FORECAST_COMPLETION items only', () => {
    const items = [
      makeItem({ sourceType: 'CONTRACT_END', contractId: 'c1', date: '2026-08-25', isOverdue: false }),
      makeItem({ sourceType: 'FORECAST_COMPLETION', contractId: 'c1', date: '2026-08-26', isOverdue: false }), // same contract, should not double count
      makeItem({ sourceType: 'CONTRACT_END', contractId: 'c2', date: '2026-08-01', isOverdue: true }),
      makeItem({ sourceType: 'WORKFLOW_TASK', contractId: 'c3', date: '2026-08-21', isOverdue: false }), // wrong type, excluded
    ];
    expect(computeScheduleSummary(items, today).contractsEndingSoon).toBe(2);
  });

  it('returns all-zero summary for an empty result set', () => {
    expect(computeScheduleSummary([], today)).toEqual({
      totalItems: 0, upcomingThisWeek: 0, dueToday: 0, overdueItems: 0,
      workflowDue: 0, paymentDue: 0, issueClaimDue: 0, contractsEndingSoon: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// buildScheduleContractWhere
// ---------------------------------------------------------------------------

describe('buildScheduleContractWhere', () => {
  it('excludes CANCELLED contracts even with no other filters', () => {
    expect(buildScheduleContractWhere({})).toEqual({ status: { not: 'CANCELLED' } });
  });

  it('filters by contractId directly (via id), still excluding CANCELLED', () => {
    expect(buildScheduleContractWhere({ contractId: 'contract-1' })).toEqual({
      status: { not: 'CANCELLED' },
      id: 'contract-1',
    });
  });

  it('filters by departmentId/ownerUserId via AND', () => {
    const where = buildScheduleContractWhere({ departmentId: 'dept-1', ownerUserId: 'user-1' });
    expect(where['AND']).toEqual([{ departmentId: 'dept-1' }, { ownerUserId: 'user-1' }]);
  });

  it('search matches contract reference/title/company', () => {
    const where = buildScheduleContractWhere({ search: 'acme' });
    expect(where['AND']).toEqual([
      {
        OR: [
          { referenceNumber: { contains: 'acme', mode: 'insensitive' } },
          { title: { contains: 'acme', mode: 'insensitive' } },
          { counterpartyName: { contains: 'acme', mode: 'insensitive' } },
        ],
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// ContractScheduleService.findAll / findAllForContract
// ---------------------------------------------------------------------------

describe('ContractScheduleService.findAll', () => {
  it('rejects actors without contracts.read', async () => {
    const noReadActor: AuthUser = { ...ACTOR_READ_ONLY, permissions: [] };
    await expect(service.findAll({}, noReadActor)).rejects.toThrow(ForbiddenException);
  });

  it('applies the department scope filter when the actor is not ALL_DEPARTMENTS', async () => {
    mockBuildDeptFilter.mockResolvedValue({ in: ['dept-1'] });
    mockContractFindMany.mockResolvedValue([]);

    await service.findAll({}, ACTOR_READ_ONLY);

    const callArgs = mockContractFindMany.mock.calls[0]![0];
    expect(callArgs.where['AND']).toContainEqual({ departmentId: { in: ['dept-1'] } });
  });

  it('aggregates items from all 5 sources plus contract dates, paginates, and summarizes over the full filtered set', async () => {
    mockContractFindMany.mockResolvedValue([makeContract({ startDate: new Date('2026-01-01') })]);
    mockWorkflowTaskFindMany.mockResolvedValue([{ id: 't1', contractId: 'contract-1', taskName: 'Task', status: 'NOT_STARTED', priority: 'MEDIUM', dueDate: new Date('2026-08-25'), responsibleUser: null }]);
    mockIssueFindMany.mockResolvedValue([{ id: 'i1', contractId: 'contract-1', title: 'Issue', status: 'OPEN', priority: 'LOW', dueDate: new Date('2026-08-26'), responsibleUser: null }]);
    mockClaimFindMany.mockResolvedValue([{ id: 'c1', contractId: 'contract-1', claimTitle: 'Claim', status: 'SUBMITTED', dueDate: new Date('2026-08-27'), responsibleUser: null, submittedValue: 100, approvedValue: 0 }]);
    mockPaymentFindMany.mockResolvedValue([{ id: 'p1', contractId: 'contract-1', paymentNo: 'PAY-01', invoiceNumber: null, status: 'SUBMITTED', dueDate: new Date('2026-08-28'), submittedAmount: 200, certifiedAmount: null, paidAmount: 0 }]);
    mockCloseoutRequestFindMany.mockResolvedValue([]);

    const result = await service.findAll({}, ACTOR_READ_ONLY);

    // 1 contract-start + 4 source items = 5
    expect(result.total).toBe(5);
    expect(result.summary.totalItems).toBe(5);
    expect(result.items).toHaveLength(5);
  });

  it('paginates the full filtered set', async () => {
    mockContractFindMany.mockResolvedValue([makeContract()]);
    mockWorkflowTaskFindMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, contractId: 'contract-1', taskName: `Task ${i}`, status: 'NOT_STARTED', priority: 'MEDIUM', dueDate: new Date(`2026-08-${10 + i}`), responsibleUser: null })),
    );
    mockIssueFindMany.mockResolvedValue([]);
    mockClaimFindMany.mockResolvedValue([]);
    mockPaymentFindMany.mockResolvedValue([]);
    mockCloseoutRequestFindMany.mockResolvedValue([]);

    const result = await service.findAll({ page: 1, pageSize: 2 }, ACTOR_READ_ONLY);

    expect(result.total).toBe(5);
    expect(result.items).toHaveLength(2);
    expect(result.totalPages).toBe(3);
  });
});

// CM-68A — the old ContractScheduleService.findAllForContract() tests were
// removed along with the method itself (see contract-schedule.service.ts) —
// its only real consumer (GET :id/schedule) now uses
// ContractSchedulePlanService.getScheduleDetail() instead. findAll()'s own
// tests above are unchanged.
