import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import {
  ContractDashboardService,
  computeContractDashboardType,
  buildWorkflowOverview,
  buildManagerAttentionItems,
  sortAttentionItems,
  computeManagerSummary,
  computeManagerFinancials,
  buildTopDelayedContracts,
  buildTopValueContracts,
  countClaimsByStatus,
  computeManagerInsights,
  computeStaffSummary,
  buildStaffTaskRows,
  buildStaffRecentUpdates,
  type DashboardContractRow,
  type ManagerAttentionItem,
  type DashboardTaskRow,
  type DashboardIssueRow,
  type DashboardClaimRow,
  type DashboardPaymentRow,
  type DashboardCloseoutRequestRow,
} from './contract-dashboard.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { ContractsService } from './contracts.service';
import type { ContractScheduleService } from './contract-schedule.service';

const TODAY = new Date('2026-08-24T00:00:00Z');

function makeContract(overrides: Partial<DashboardContractRow> = {}): DashboardContractRow {
  return {
    id: 'contract-1',
    referenceNumber: 'CONTRACT-2026-000001',
    title: 'Test Contract',
    status: 'ACTIVE',
    createdAt: new Date('2026-08-01'),
    endDate: null,
    forecastCompletionDate: null,
    counterpartyName: 'Acme Co',
    jobOrder: null,
    contractValue: null,
    originalContractValue: null,
    ...overrides,
  };
}

function makeTask(overrides: Partial<DashboardTaskRow> = {}): DashboardTaskRow {
  return {
    id: 'task-1',
    contractId: 'contract-1',
    taskKey: 'technical_drawing_received',
    taskName: 'Submit Drawing',
    team: 'TECHNICAL',
    status: 'NOT_STARTED',
    priority: 'MEDIUM',
    dueDate: null,
    responsibleUserId: null,
    lastActivityAt: new Date('2026-08-20'),
    ...overrides,
  };
}

function makeIssue(overrides: Partial<DashboardIssueRow> = {}): DashboardIssueRow {
  return {
    id: 'issue-1', contractId: 'contract-1', title: 'Site access blocked', status: 'OPEN', priority: 'HIGH', dueDate: null,
    ...overrides,
  };
}

function makeClaim(overrides: Partial<DashboardClaimRow> = {}): DashboardClaimRow {
  return {
    id: 'claim-1', contractId: 'contract-1', claimTitle: 'Delay claim', status: 'SUBMITTED', dueDate: null,
    submittedValue: '1000.000', approvedValue: null,
    ...overrides,
  };
}

function makePayment(overrides: Partial<DashboardPaymentRow> = {}): DashboardPaymentRow {
  return {
    id: 'payment-1', contractId: 'contract-1', paymentNo: 'PAY-001', invoiceNumber: null, status: 'SUBMITTED', dueDate: null,
    submittedAmount: '5000.000', certifiedAmount: null, paidAmount: null,
    ...overrides,
  };
}

function makeCloseout(overrides: Partial<DashboardCloseoutRequestRow> = {}): DashboardCloseoutRequestRow {
  return {
    id: 'closeout-1', contractId: 'contract-1', requestNo: 'CONTRACT-2026-000001-CLO-01', status: 'SUBMITTED',
    requestedAt: new Date('2026-08-20'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeContractDashboardType
// ---------------------------------------------------------------------------

describe('computeContractDashboardType', () => {
  it('returns MANAGER when actor has contracts.update', () => {
    expect(computeContractDashboardType(['contracts.read', 'contracts.update'])).toBe('MANAGER');
  });

  it('returns MANAGER when actor has contracts.close (even without contracts.update)', () => {
    expect(computeContractDashboardType(['contracts.read', 'contracts.close'])).toBe('MANAGER');
  });

  it('returns STAFF when actor has contracts.workflow_update but not contracts.update/close', () => {
    expect(computeContractDashboardType(['contracts.read', 'contracts.comment', 'contracts.workflow_update'])).toBe('STAFF');
  });

  it('returns STAFF for a plain read-only actor (e.g. Viewer) as the safe default', () => {
    expect(computeContractDashboardType(['contracts.read', 'contracts.comment'])).toBe('STAFF');
  });

  it('CONTRACT_MANAGEMENT_USER (legacy) permission set resolves to MANAGER', () => {
    expect(computeContractDashboardType([
      'contracts.read', 'contracts.create', 'contracts.update', 'contracts.activate',
      'contracts.terminate', 'contracts.close', 'contracts.comment',
    ])).toBe('MANAGER');
  });
});

// ---------------------------------------------------------------------------
// buildWorkflowOverview
// ---------------------------------------------------------------------------

describe('buildWorkflowOverview', () => {
  it('groups tasks by team and computes open/unassigned/overdue/completed independently', () => {
    const tasks = [
      makeTask({ id: 't1', team: 'TECHNICAL', status: 'NOT_STARTED', responsibleUserId: null }),
      makeTask({ id: 't2', team: 'TECHNICAL', status: 'COMPLETED', responsibleUserId: 'user-1' }),
      makeTask({ id: 't3', team: 'PRODUCTION', status: 'IN_PROGRESS', responsibleUserId: 'user-1', dueDate: new Date('2026-08-01') }),
    ];
    const overview = buildWorkflowOverview(tasks, TODAY);

    const technical = overview.find((o) => o.team === 'TECHNICAL')!;
    expect(technical.openTasks).toBe(1);
    expect(technical.unassignedTasks).toBe(1);
    expect(technical.completedTasks).toBe(1);

    const production = overview.find((o) => o.team === 'PRODUCTION')!;
    expect(production.overdueTasks).toBe(1);

    const erection = overview.find((o) => o.team === 'ERECTION')!;
    expect(erection.openTasks).toBe(0);
    expect(erection.unassignedTasks).toBe(0);
  });

  it('returns all 4 teams even with zero tasks', () => {
    const overview = buildWorkflowOverview([], TODAY);
    expect(overview.map((o) => o.team)).toEqual(['TECHNICAL', 'PRODUCTION', 'ERECTION', 'QS_COMMERCIAL']);
    expect(overview.every((o) => o.openTasks === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildManagerAttentionItems
// ---------------------------------------------------------------------------

describe('buildManagerAttentionItems', () => {
  it('emits ACTIVATE_CONTRACT for draft contracts', () => {
    const items = buildManagerAttentionItems({
      contracts: [makeContract({ status: 'DRAFT' })], tasks: [], issues: [], claims: [], payments: [], closeoutRequests: [], today: TODAY,
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.actionType).toBe('ACTIVATE_CONTRACT');
    expect(items[0]!.actionUrl).toBe('/contracts/contract-1');
  });

  it('emits one ASSIGN_TASKS item per contract, aggregating the unassigned task count', () => {
    const items = buildManagerAttentionItems({
      contracts: [makeContract()],
      tasks: [
        makeTask({ id: 't1', responsibleUserId: null }),
        makeTask({ id: 't2', responsibleUserId: null }),
        makeTask({ id: 't3', responsibleUserId: 'user-1' }),
      ],
      issues: [], claims: [], payments: [], closeoutRequests: [], today: TODAY,
    });
    const assignItems = items.filter((i) => i.actionType === 'ASSIGN_TASKS');
    expect(assignItems).toHaveLength(1);
    expect(assignItems[0]!.description).toBe('2 unassigned workflow tasks');
  });

  it('does not count a COMPLETED unassigned task as needing assignment', () => {
    const items = buildManagerAttentionItems({
      contracts: [makeContract()],
      tasks: [makeTask({ responsibleUserId: null, status: 'COMPLETED' })],
      issues: [], claims: [], payments: [], closeoutRequests: [], today: TODAY,
    });
    expect(items.filter((i) => i.actionType === 'ASSIGN_TASKS')).toHaveLength(0);
  });

  it('emits OVERDUE_TASK per overdue task with overdueDays computed', () => {
    const items = buildManagerAttentionItems({
      contracts: [makeContract()],
      tasks: [makeTask({ dueDate: new Date('2026-08-14'), status: 'IN_PROGRESS' })],
      issues: [], claims: [], payments: [], closeoutRequests: [], today: TODAY,
    });
    const overdue = items.find((i) => i.actionType === 'OVERDUE_TASK');
    expect(overdue).toBeDefined();
    expect(overdue!.isOverdue).toBe(true);
    expect(overdue!.overdueDays).toBe(10);
  });

  it('emits OPEN_ISSUE only for non-final HIGH/CRITICAL issues, not MEDIUM/LOW', () => {
    const items = buildManagerAttentionItems({
      contracts: [makeContract()],
      tasks: [],
      issues: [
        makeIssue({ id: 'i1', priority: 'CRITICAL', status: 'OPEN' }),
        makeIssue({ id: 'i2', priority: 'MEDIUM', status: 'OPEN' }),
        makeIssue({ id: 'i3', priority: 'HIGH', status: 'CLOSED' }),
      ],
      claims: [], payments: [], closeoutRequests: [], today: TODAY,
    });
    const issueItems = items.filter((i) => i.actionType === 'OPEN_ISSUE');
    expect(issueItems).toHaveLength(1);
    expect(issueItems[0]!.description).toBe('Site access blocked');
  });

  it('emits OPEN_CLAIM for any non-final claim regardless of priority', () => {
    const items = buildManagerAttentionItems({
      contracts: [makeContract()], tasks: [], issues: [],
      claims: [makeClaim({ status: 'SUBMITTED' }), makeClaim({ id: 'claim-2', status: 'SETTLED' })],
      payments: [], closeoutRequests: [], today: TODAY,
    });
    expect(items.filter((i) => i.actionType === 'OPEN_CLAIM')).toHaveLength(1);
  });

  it('emits OUTSTANDING_PAYMENT only when outstanding amount > 0 and not final, HIGH priority when overdue', () => {
    const items = buildManagerAttentionItems({
      contracts: [makeContract()], tasks: [], issues: [], claims: [],
      payments: [
        makePayment({ id: 'p1', submittedAmount: '1000.000', certifiedAmount: '1000.000', paidAmount: '1000.000', status: 'PAID' }),
        makePayment({ id: 'p2', submittedAmount: '2000.000', dueDate: new Date('2026-08-01'), status: 'SUBMITTED' }),
      ],
      closeoutRequests: [], today: TODAY,
    });
    const paymentItems = items.filter((i) => i.actionType === 'OUTSTANDING_PAYMENT');
    expect(paymentItems).toHaveLength(1);
    expect(paymentItems[0]!.priority).toBe('HIGH');
  });

  it('emits CLOSEOUT_REVIEW only for SUBMITTED/UNDER_REVIEW requests', () => {
    const items = buildManagerAttentionItems({
      contracts: [makeContract()], tasks: [], issues: [], claims: [], payments: [],
      closeoutRequests: [makeCloseout({ status: 'SUBMITTED' }), makeCloseout({ id: 'c2', status: 'APPROVED' })],
      today: TODAY,
    });
    expect(items.filter((i) => i.actionType === 'CLOSEOUT_REVIEW')).toHaveLength(1);
  });

  it('emits CONTRACT_ENDING_SOON for active contracts ending within 30 days, not for DRAFT/CLOSED', () => {
    const items = buildManagerAttentionItems({
      contracts: [
        makeContract({ id: 'c1', status: 'ACTIVE', endDate: new Date('2026-09-01') }),
        makeContract({ id: 'c2', status: 'DRAFT', endDate: new Date('2026-09-01') }),
        makeContract({ id: 'c3', status: 'ACTIVE', endDate: new Date('2027-01-01') }),
      ],
      tasks: [], issues: [], claims: [], payments: [], closeoutRequests: [], today: TODAY,
    });
    const endingSoon = items.filter((i) => i.actionType === 'CONTRACT_ENDING_SOON');
    expect(endingSoon.map((i) => i.contractId)).toEqual(['c1']);
  });

  it('skips items whose contract is not in the candidate set (defensive — should not happen in practice)', () => {
    const items = buildManagerAttentionItems({
      contracts: [],
      tasks: [makeTask()],
      issues: [], claims: [], payments: [], closeoutRequests: [], today: TODAY,
    });
    expect(items).toHaveLength(0);
  });
});

describe('sortAttentionItems', () => {
  it('sorts HIGH before MEDIUM before LOW', () => {
    const items = [
      { key: 'a', priority: 'LOW' as const, actionType: 'CONTRACT_ENDING_SOON' as const, contractId: 'c', contractReference: 'r', contractTitle: 't', description: 'd', date: null, isOverdue: false, overdueDays: null, actionUrl: '/', actionLabel: 'x' },
      { key: 'b', priority: 'HIGH' as const, actionType: 'OVERDUE_TASK' as const, contractId: 'c', contractReference: 'r', contractTitle: 't', description: 'd', date: null, isOverdue: false, overdueDays: null, actionUrl: '/', actionLabel: 'x' },
      { key: 'c', priority: 'MEDIUM' as const, actionType: 'OPEN_CLAIM' as const, contractId: 'c', contractReference: 'r', contractTitle: 't', description: 'd', date: null, isOverdue: false, overdueDays: null, actionUrl: '/', actionLabel: 'x' },
    ];
    expect(sortAttentionItems(items).map((i) => i.key)).toEqual(['b', 'c', 'a']);
  });

  it('within the same priority, sorts by date ascending, nulls last', () => {
    const items = [
      { key: 'a', priority: 'HIGH' as const, actionType: 'OVERDUE_TASK' as const, contractId: 'c', contractReference: 'r', contractTitle: 't', description: 'd', date: null, isOverdue: false, overdueDays: null, actionUrl: '/', actionLabel: 'x' },
      { key: 'b', priority: 'HIGH' as const, actionType: 'OVERDUE_TASK' as const, contractId: 'c', contractReference: 'r', contractTitle: 't', description: 'd', date: '2026-08-01', isOverdue: false, overdueDays: null, actionUrl: '/', actionLabel: 'x' },
      { key: 'c', priority: 'HIGH' as const, actionType: 'OVERDUE_TASK' as const, contractId: 'c', contractReference: 'r', contractTitle: 't', description: 'd', date: '2026-07-01', isOverdue: false, overdueDays: null, actionUrl: '/', actionLabel: 'x' },
    ];
    expect(sortAttentionItems(items).map((i) => i.key)).toEqual(['c', 'b', 'a']);
  });
});

// ---------------------------------------------------------------------------
// computeManagerSummary
// ---------------------------------------------------------------------------

describe('computeManagerSummary', () => {
  it('computes draft/active/awaiting-activation counts, mirroring draft for awaiting-activation', () => {
    const summary = computeManagerSummary({
      contracts: [makeContract({ id: 'c1', status: 'DRAFT' }), makeContract({ id: 'c2', status: 'ACTIVE' }), makeContract({ id: 'c3', status: 'ACTIVE' })],
      tasks: [], issues: [], claims: [], payments: [], closeoutRequests: [], dueThisWeek: 4, today: TODAY,
    });
    expect(summary.draftContracts).toBe(1);
    expect(summary.activeContracts).toBe(2);
    expect(summary.contractsAwaitingActivation).toBe(summary.draftContracts);
    expect(summary.dueThisWeek).toBe(4);
  });

  it('reuses computeIssueSummary/computeClaimSummary for openIssues/openClaims', () => {
    const summary = computeManagerSummary({
      contracts: [], tasks: [],
      issues: [makeIssue({ status: 'OPEN' }), makeIssue({ id: 'i2', status: 'CLOSED' })],
      claims: [makeClaim({ status: 'SUBMITTED' }), makeClaim({ id: 'cl2', status: 'SETTLED' })],
      payments: [], closeoutRequests: [], dueThisWeek: 0, today: TODAY,
    });
    expect(summary.openIssues).toBe(1);
    expect(summary.openClaims).toBe(1);
  });

  it('counts pendingCloseoutRequests as SUBMITTED/UNDER_REVIEW only', () => {
    const summary = computeManagerSummary({
      contracts: [], tasks: [], issues: [], claims: [], payments: [],
      closeoutRequests: [makeCloseout({ status: 'UNDER_REVIEW' }), makeCloseout({ id: 'c2', status: 'CLOSED' })],
      dueThisWeek: 0, today: TODAY,
    });
    expect(summary.pendingCloseoutRequests).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// CM-54 — computeManagerFinancials / top-5 lists / claims-by-status / insights
// ---------------------------------------------------------------------------

function makeAttentionItem(overrides: Partial<ManagerAttentionItem> = {}): ManagerAttentionItem {
  return {
    key: 'k1', priority: 'HIGH', actionType: 'OVERDUE_TASK', contractId: 'contract-1',
    contractReference: 'CONTRACT-2026-000001', contractTitle: 'Test Contract',
    description: 'desc', date: null, isOverdue: false, overdueDays: null,
    actionUrl: '/contracts/contract-1', actionLabel: 'View',
    ...overrides,
  };
}

describe('computeManagerFinancials', () => {
  it('sums contractValue/originalContractValue across contracts, treating missing values as 0', () => {
    const f = computeManagerFinancials({
      contracts: [
        makeContract({ id: 'c1', contractValue: '1000.000', originalContractValue: '900.000' }),
        makeContract({ id: 'c2', contractValue: '500.000', originalContractValue: null }),
      ],
      payments: [], claims: [], today: TODAY,
    });
    expect(f.contractValueTotal).toBe(1500);
    expect(f.originalContractValueTotal).toBe(900);
  });

  it('reuses computePaymentSummary for submitted/paid/outstanding/overduePayments', () => {
    const f = computeManagerFinancials({
      contracts: [],
      payments: [
        makePayment({ id: 'p1', submittedAmount: '1000.000', paidAmount: '400.000', status: 'SUBMITTED', dueDate: new Date('2026-08-01') }),
      ],
      claims: [], today: TODAY,
    });
    expect(f.submittedTotal).toBe(1000);
    expect(f.paidTotal).toBe(400);
    expect(f.outstandingTotal).toBe(600);
    expect(f.overduePayments).toBe(1);
  });

  it('openClaimsValue only counts non-final claims, excluding APPROVED/REJECTED/SETTLED/CLOSED/CANCELLED', () => {
    const f = computeManagerFinancials({
      contracts: [],
      payments: [],
      claims: [
        makeClaim({ id: 'cl1', status: 'SUBMITTED', submittedValue: '1000.000', approvedValue: null }),
        makeClaim({ id: 'cl2', status: 'SETTLED', submittedValue: '5000.000', approvedValue: '5000.000' }),
      ],
      today: TODAY,
    });
    expect(f.openClaimsValue).toBe(1000);
  });
});

describe('buildTopDelayedContracts', () => {
  it('ranks contracts by the largest overdueDays among their overdue attention items', () => {
    const contracts = [makeContract({ id: 'c1' }), makeContract({ id: 'c2', referenceNumber: 'CONTRACT-2026-000002', title: 'Second' })];
    const items = [
      makeAttentionItem({ contractId: 'c1', isOverdue: true, overdueDays: 5 }),
      makeAttentionItem({ contractId: 'c1', isOverdue: true, overdueDays: 12 }),
      makeAttentionItem({ contractId: 'c2', isOverdue: true, overdueDays: 20 }),
      makeAttentionItem({ contractId: 'c2', isOverdue: false, overdueDays: null }),
    ];
    const result = buildTopDelayedContracts(items, contracts);
    expect(result).toEqual([
      { contractId: 'c2', contractReference: 'CONTRACT-2026-000002', jobOrderLabel: 'CONTRACT-2026-000002', projectName: 'Second', delayDays: 20 },
      { contractId: 'c1', contractReference: 'CONTRACT-2026-000001', jobOrderLabel: 'CONTRACT-2026-000001', projectName: 'Test Contract', delayDays: 12 },
    ]);
  });

  it('falls back to referenceNumber for jobOrderLabel when jobOrder is null, uses jobOrder when set', () => {
    const contracts = [makeContract({ id: 'c1', jobOrder: 'JO-100' })];
    const items = [makeAttentionItem({ contractId: 'c1', isOverdue: true, overdueDays: 3 })];
    expect(buildTopDelayedContracts(items, contracts)[0]!.jobOrderLabel).toBe('JO-100');
  });

  it('excludes contracts with no overdue attention items', () => {
    const contracts = [makeContract({ id: 'c1' })];
    const items = [makeAttentionItem({ contractId: 'c1', isOverdue: false, overdueDays: null })];
    expect(buildTopDelayedContracts(items, contracts)).toEqual([]);
  });
});

describe('buildTopValueContracts', () => {
  it('sorts by contractValue descending and excludes contracts with no value', () => {
    const contracts = [
      makeContract({ id: 'c1', contractValue: '500.000' }),
      makeContract({ id: 'c2', contractValue: '2000.000', referenceNumber: 'CONTRACT-2026-000002', title: 'Big' }),
      makeContract({ id: 'c3', contractValue: null }),
    ];
    const result = buildTopValueContracts(contracts);
    expect(result.map((r) => r.contractId)).toEqual(['c2', 'c1']);
    expect(result[0]).toEqual({ contractId: 'c2', contractReference: 'CONTRACT-2026-000002', jobOrderLabel: 'CONTRACT-2026-000002', projectName: 'Big', value: 2000 });
  });

  it('caps at 5 results', () => {
    const contracts = Array.from({ length: 8 }, (_, i) => makeContract({ id: `c${i}`, contractValue: `${i + 1}.000` }));
    expect(buildTopValueContracts(contracts)).toHaveLength(5);
  });
});

describe('countClaimsByStatus', () => {
  it('excludes PARTIALLY_APPROVED but keeps every other real status', () => {
    const claims = [
      makeClaim({ id: 'cl1', status: 'DRAFT' }),
      makeClaim({ id: 'cl2', status: 'PARTIALLY_APPROVED' }),
      makeClaim({ id: 'cl3', status: 'SETTLED' }),
      makeClaim({ id: 'cl4', status: 'SETTLED' }),
    ];
    const result = countClaimsByStatus(claims);
    expect(result).toContainEqual({ status: 'DRAFT', count: 1 });
    expect(result).toContainEqual({ status: 'SETTLED', count: 2 });
    expect(result.find((r) => r.status === 'PARTIALLY_APPROVED')).toBeUndefined();
  });
});

describe('computeManagerInsights', () => {
  it('counts criticalProjectContracts as distinct contracts with a HIGH priority attention item', () => {
    const contracts = [makeContract({ id: 'c1' }), makeContract({ id: 'c2', referenceNumber: 'CONTRACT-2026-000002' })];
    const items = [
      makeAttentionItem({ contractId: 'c1', priority: 'HIGH' }),
      makeAttentionItem({ contractId: 'c1', priority: 'HIGH', key: 'k2' }),
      makeAttentionItem({ contractId: 'c2', priority: 'MEDIUM', key: 'k3' }),
    ];
    const insights = computeManagerInsights({ contracts, tasks: [], claims: [], payments: [], sortedAttentionItems: items, today: TODAY });
    expect(insights.criticalProjectContracts).toBe(1);
  });

  it('counts overdueWorkflowTasksContracts as distinct contracts, not distinct tasks', () => {
    const contracts = [makeContract({ id: 'c1' })];
    const tasks = [
      makeTask({ id: 't1', contractId: 'c1', dueDate: new Date('2026-08-01') }),
      makeTask({ id: 't2', contractId: 'c1', dueDate: new Date('2026-08-02') }),
    ];
    const insights = computeManagerInsights({ contracts, tasks, claims: [], payments: [], sortedAttentionItems: [], today: TODAY });
    expect(insights.overdueWorkflowTasksContracts).toBe(1);
  });

  it('contractsClosingSoon only counts ACTIVE contracts with end/forecast date within the next 60 days', () => {
    const contracts = [
      makeContract({ id: 'c1', status: 'ACTIVE', endDate: new Date('2026-09-10') }), // 17 days out
      makeContract({ id: 'c2', status: 'ACTIVE', endDate: new Date('2026-12-01') }), // too far
      makeContract({ id: 'c3', status: 'ACTIVE', endDate: new Date('2026-08-01') }), // already past
      makeContract({ id: 'c4', status: 'DRAFT', endDate: new Date('2026-09-10') }), // not active
    ];
    const insights = computeManagerInsights({ contracts, tasks: [], claims: [], payments: [], sortedAttentionItems: [], today: TODAY });
    expect(insights.contractsClosingSoon).toBe(1);
  });

  it('claimsWithActionDue reuses computeClaimSummary.overdueClaims', () => {
    const claims = [makeClaim({ id: 'cl1', status: 'SUBMITTED', dueDate: new Date('2026-08-01') })];
    const insights = computeManagerInsights({ contracts: [], tasks: [], claims, payments: [], sortedAttentionItems: [], today: TODAY });
    expect(insights.claimsWithActionDue).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeStaffSummary / buildStaffTaskRows
// ---------------------------------------------------------------------------

describe('computeStaffSummary', () => {
  it('computes open/in-progress/overdue/completed and distinct active-contract count', () => {
    const contractStatusById = new Map([['contract-1', 'ACTIVE'], ['contract-2', 'DRAFT']]);
    const tasks = [
      makeTask({ id: 't1', contractId: 'contract-1', status: 'IN_PROGRESS' }),
      makeTask({ id: 't2', contractId: 'contract-1', status: 'COMPLETED' }),
      makeTask({ id: 't3', contractId: 'contract-2', status: 'NOT_STARTED', dueDate: new Date('2026-08-01') }),
    ];
    const summary = computeStaffSummary(tasks, contractStatusById, 3, TODAY);
    expect(summary.myOpenTasks).toBe(2);
    expect(summary.myInProgressTasks).toBe(1);
    expect(summary.myOverdueTasks).toBe(1);
    expect(summary.completedTasks).toBe(1);
    expect(summary.myActiveContracts).toBe(1);
    expect(summary.dueThisWeek).toBe(3);
  });
});

describe('buildStaffTaskRows', () => {
  it('maps tasks to rows sorted by due date ascending, nulls last', () => {
    const contractsById = new Map([['contract-1', makeContract()]]);
    const rows = buildStaffTaskRows([
      makeTask({ id: 't1', dueDate: null }),
      makeTask({ id: 't2', dueDate: new Date('2026-08-25') }),
      makeTask({ id: 't3', dueDate: new Date('2026-08-20') }),
    ], contractsById, TODAY);
    expect(rows.map((r) => r.id)).toEqual(['t3', 't2', 't1']);
    expect(rows[0]!.contractReference).toBe('CONTRACT-2026-000001');
    expect(rows[0]!.counterpartyName).toBe('Acme Co');
    expect(rows[0]!.actionUrl).toBe('/contracts/contract-1/workflow');
  });

  it('passes taskKey through unchanged — CM-71H.4, the stable identifier the frontend keys guided-erection routing off', () => {
    const contractsById = new Map([['contract-1', makeContract()]]);
    const rows = buildStaffTaskRows([makeTask({ taskKey: 'erection_method_statement_issued' })], contractsById, TODAY);
    expect(rows[0]!.taskKey).toBe('erection_method_statement_issued');
  });

  it('skips a task whose contract is missing from the candidate map', () => {
    const rows = buildStaffTaskRows([makeTask({ contractId: 'unknown' })], new Map(), TODAY);
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildStaffRecentUpdates
// ---------------------------------------------------------------------------

describe('buildStaffRecentUpdates', () => {
  it('merges task/comment/attachment activity, sorted newest first, capped at 10', () => {
    const contractsById = new Map([['contract-1', makeContract()]]);
    const myTasks = [makeTask({ id: 't1', lastActivityAt: new Date('2026-08-20T00:00:00Z') })];
    const comments = [{ id: 'cm1', taskId: 't1', createdAt: new Date('2026-08-22T00:00:00Z') }];
    const attachments = [{ id: 'a1', taskId: 't1', originalFileName: 'drawing.pdf', createdAt: new Date('2026-08-21T00:00:00Z') }];

    const updates = buildStaffRecentUpdates({ myTasks, comments, attachments, contractsById });
    expect(updates.map((u) => u.type)).toEqual(['COMMENT', 'ATTACHMENT', 'STATUS_UPDATE']);
    expect(updates[0]!.description).toBe('Comment added');
    expect(updates[1]!.description).toBe('Attachment uploaded — drawing.pdf');
  });

  it('ignores comments/attachments for tasks not in myTasks', () => {
    const contractsById = new Map([['contract-1', makeContract()]]);
    const updates = buildStaffRecentUpdates({
      myTasks: [makeTask({ id: 't1' })],
      comments: [{ id: 'cm1', taskId: 'not-mine', createdAt: new Date() }],
      attachments: [],
      contractsById,
    });
    expect(updates.filter((u) => u.type === 'COMMENT')).toHaveLength(0);
  });

  it('caps the merged list at 10 entries', () => {
    const contractsById = new Map([['contract-1', makeContract()]]);
    const myTasks = [makeTask({ id: 't1' })];
    const comments = Array.from({ length: 15 }, (_, i) => ({
      id: `cm${i}`, taskId: 't1', createdAt: new Date(2026, 7, i + 1),
    }));
    const updates = buildStaffRecentUpdates({ myTasks, comments, attachments: [], contractsById });
    expect(updates).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// ContractDashboardService (class) — mocked DB/deptAccess/contractsService/scheduleService
// ---------------------------------------------------------------------------

const mockContractFindMany = vi.fn();
const mockWorkflowTaskFindMany = vi.fn();
const mockIssueFindMany = vi.fn();
const mockClaimFindMany = vi.fn();
const mockPaymentFindMany = vi.fn();
const mockCloseoutRequestFindMany = vi.fn();
const mockCommentFindMany = vi.fn();
const mockAttachmentFindMany = vi.fn();

const mockClient = {
  contract: { findMany: mockContractFindMany },
  contractWorkflowTask: { findMany: mockWorkflowTaskFindMany },
  contractIssue: { findMany: mockIssueFindMany },
  contractClaim: { findMany: mockClaimFindMany },
  contractPayment: { findMany: mockPaymentFindMany },
  contractCloseoutRequest: { findMany: mockCloseoutRequestFindMany },
  contractWorkflowTaskComment: { findMany: mockCommentFindMany },
  contractWorkflowTaskAttachment: { findMany: mockAttachmentFindMany },
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockBuildDeptFilter = vi.fn().mockResolvedValue(null);
const mockDeptAccess = { buildDeptFilter: mockBuildDeptFilter } as unknown as DepartmentAccessService;

const BASE_DASHBOARD = {
  scope: { type: 'ALL_DEPARTMENTS', departmentNames: [] },
  metrics: { totalDraft: 0, totalActive: 0, totalExpiring: 0, totalExpired: 0, totalTerminated: 0, totalClosed: 0, totalCancelled: 0 },
  recent: [],
};
const mockGetBaseDashboard = vi.fn().mockResolvedValue(BASE_DASHBOARD);
const mockContractsService = { getDashboard: mockGetBaseDashboard } as unknown as ContractsService;

const mockScheduleFindAll = vi.fn().mockResolvedValue({
  items: [], total: 0, page: 1, pageSize: 15,
  totalPages: 0,
  summary: { totalItems: 0, upcomingThisWeek: 0, dueToday: 0, overdueItems: 0, workflowDue: 0, paymentDue: 0, issueClaimDue: 0, contractsEndingSoon: 0 },
});
const mockScheduleService = { findAll: mockScheduleFindAll } as unknown as ContractScheduleService;

const ACTOR_MANAGER: AuthUser = {
  id: 'user-manager-1', username: 'manager', displayName: 'Manager', roleId: 'role-manager',
  roleCode: 'CONTRACT_MANAGER', roleName: 'Contract Manager', mustChangePassword: false, isActive: true,
  sessionId: 'session-1', departmentId: null,
  permissions: ['contracts.read', 'contracts.update', 'contracts.close'],
};

const ACTOR_STAFF: AuthUser = {
  ...ACTOR_MANAGER, id: 'user-staff-1', username: 'staff', roleCode: 'CONTRACT_STAFF', roleName: 'Contract Staff',
  permissions: ['contracts.read', 'contracts.comment', 'contracts.workflow_update'],
};

let service: ContractDashboardService;

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildDeptFilter.mockResolvedValue(null);
  mockGetBaseDashboard.mockResolvedValue(BASE_DASHBOARD);
  mockContractFindMany.mockResolvedValue([]);
  mockWorkflowTaskFindMany.mockResolvedValue([]);
  mockIssueFindMany.mockResolvedValue([]);
  mockClaimFindMany.mockResolvedValue([]);
  mockPaymentFindMany.mockResolvedValue([]);
  mockCloseoutRequestFindMany.mockResolvedValue([]);
  mockCommentFindMany.mockResolvedValue([]);
  mockAttachmentFindMany.mockResolvedValue([]);
  mockScheduleFindAll.mockResolvedValue({
    items: [], total: 0, page: 1, pageSize: 15,
    totalPages: 0,
    summary: { totalItems: 0, upcomingThisWeek: 2, dueToday: 0, overdueItems: 0, workflowDue: 0, paymentDue: 0, issueClaimDue: 0, contractsEndingSoon: 0 },
  });
  service = new ContractDashboardService(mockDb, mockDeptAccess, mockContractsService, mockScheduleService);
});

describe('ContractDashboardService.getDashboard', () => {
  it('rejects actors without contracts.read', async () => {
    const noReadActor: AuthUser = { ...ACTOR_STAFF, permissions: [] };
    await expect(service.getDashboard(noReadActor)).rejects.toThrow(ForbiddenException);
  });

  it('returns dashboardType MANAGER with a manager payload for a manager actor', async () => {
    mockContractFindMany.mockResolvedValue([makeContract()]);
    mockWorkflowTaskFindMany.mockResolvedValue([]);
    mockIssueFindMany.mockResolvedValue([]);
    mockClaimFindMany.mockResolvedValue([]);
    mockPaymentFindMany.mockResolvedValue([]);
    mockCloseoutRequestFindMany.mockResolvedValue([]);

    const result = await service.getDashboard(ACTOR_MANAGER);

    expect(result.dashboardType).toBe('MANAGER');
    expect(result.manager).toBeDefined();
    expect(result.staff).toBeUndefined();
    expect(result.scope).toEqual(BASE_DASHBOARD.scope);
    expect(result.manager!.summary.dueThisWeek).toBe(2);
  });

  it('populates manager.insights with real financial totals end-to-end', async () => {
    mockContractFindMany.mockResolvedValue([makeContract({ contractValue: '10000.000', originalContractValue: '9000.000' })]);
    mockWorkflowTaskFindMany.mockResolvedValue([]);
    mockIssueFindMany.mockResolvedValue([]);
    mockClaimFindMany.mockResolvedValue([]);
    mockPaymentFindMany.mockResolvedValue([
      makePayment({ submittedAmount: '2000.000', paidAmount: '500.000' }),
    ]);
    mockCloseoutRequestFindMany.mockResolvedValue([]);

    const result = await service.getDashboard(ACTOR_MANAGER);

    expect(result.manager!.insights.financials.contractValueTotal).toBe(10000);
    expect(result.manager!.insights.financials.originalContractValueTotal).toBe(9000);
    expect(result.manager!.insights.financials.submittedTotal).toBe(2000);
    expect(result.manager!.insights.financials.paidTotal).toBe(500);
    expect(result.manager!.insights.topValueContracts).toHaveLength(1);
  });

  it('returns dashboardType STAFF with a staff payload for a staff actor', async () => {
    mockContractFindMany.mockResolvedValue([makeContract()]);
    mockWorkflowTaskFindMany.mockResolvedValue([makeTask({ responsibleUserId: ACTOR_STAFF.id })]);

    const result = await service.getDashboard(ACTOR_STAFF);

    expect(result.dashboardType).toBe('STAFF');
    expect(result.staff).toBeDefined();
    expect(result.manager).toBeUndefined();
  });

  it('applies the department filter to the candidate-contract query', async () => {
    mockBuildDeptFilter.mockResolvedValue({ in: ['dept-1'] });
    mockContractFindMany.mockResolvedValue([]);

    await service.getDashboard(ACTOR_MANAGER);

    const callArgs = mockContractFindMany.mock.calls[0]![0];
    expect(callArgs.where).toEqual({ status: { not: 'CANCELLED' }, departmentId: { in: ['dept-1'] } });
  });

  it('CM-69H — excludes CANCELLED contracts from the candidate-contract query even with no department filter', async () => {
    mockContractFindMany.mockResolvedValue([]);

    await service.getDashboard(ACTOR_MANAGER);

    const callArgs = mockContractFindMany.mock.calls[0]![0];
    expect(callArgs.where).toEqual({ status: { not: 'CANCELLED' } });
  });

  it('staff query filters workflow tasks to contractId in candidates AND responsibleUserId = actor.id', async () => {
    mockContractFindMany.mockResolvedValue([makeContract()]);
    mockWorkflowTaskFindMany.mockResolvedValue([]);

    await service.getDashboard(ACTOR_STAFF);

    const callArgs = mockWorkflowTaskFindMany.mock.calls[0]![0];
    expect(callArgs.where.responsibleUserId).toBe(ACTOR_STAFF.id);
    expect(callArgs.where.contractId).toEqual({ in: ['contract-1'] });
  });

  it('does not query per-contract sub-tables when there are zero candidate contracts (manager)', async () => {
    mockContractFindMany.mockResolvedValue([]);

    const result = await service.getDashboard(ACTOR_MANAGER);

    expect(mockWorkflowTaskFindMany).not.toHaveBeenCalled();
    expect(result.manager!.attentionItems).toEqual([]);
    expect(result.manager!.workflowOverview).toHaveLength(4);
  });

  it('does not query workflow tasks when there are zero candidate contracts (staff)', async () => {
    mockContractFindMany.mockResolvedValue([]);

    const result = await service.getDashboard(ACTOR_STAFF);

    expect(mockWorkflowTaskFindMany).not.toHaveBeenCalled();
    expect(result.staff!.assignedTasks).toEqual([]);
  });

  it('skips fetching comments/attachments when the staff actor has zero assigned tasks', async () => {
    mockContractFindMany.mockResolvedValue([makeContract()]);
    mockWorkflowTaskFindMany.mockResolvedValue([]);

    await service.getDashboard(ACTOR_STAFF);

    expect(mockCommentFindMany).not.toHaveBeenCalled();
    expect(mockAttachmentFindMany).not.toHaveBeenCalled();
  });
});
