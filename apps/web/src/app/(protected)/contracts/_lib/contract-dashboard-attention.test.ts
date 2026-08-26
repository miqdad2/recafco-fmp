import { describe, it, expect } from 'vitest';
import { buildAttentionRows, ATTENTION_ROW_CAP } from './contract-dashboard-attention';
import type { ManagerAttentionItem, ManagerDashboardSummary, TeamWorkflowOverview } from '@/lib/contracts-api';

function item(overrides: Partial<ManagerAttentionItem>): ManagerAttentionItem {
  return {
    key: 'k1',
    priority: 'HIGH',
    actionType: 'OPEN_ISSUE',
    contractId: 'c1',
    contractReference: 'CT-001',
    contractTitle: 'Test Contract',
    description: 'An open issue',
    date: '2026-08-01',
    isOverdue: false,
    overdueDays: null,
    actionUrl: '/contracts/issues',
    actionLabel: 'View Issue',
    ...overrides,
  };
}

const emptySummary: ManagerDashboardSummary = {
  activeContracts: 0,
  draftContracts: 0,
  contractsAwaitingActivation: 0,
  overdueWorkflowTasks: 0,
  openIssues: 0,
  openClaims: 0,
  outstandingPayments: 0,
  pendingCloseoutRequests: 0,
  dueThisWeek: 0,
};

describe('buildAttentionRows', () => {
  it('returns an empty list when there is nothing to show', () => {
    expect(buildAttentionRows([], emptySummary, [])).toEqual([]);
  });

  it('groups ACTIVATE_CONTRACT items into a single row using the accurate summary count', () => {
    const items = Array.from({ length: 17 }, (_, i) =>
      item({ key: `draft-${i}`, actionType: 'ACTIVATE_CONTRACT', priority: 'MEDIUM' }),
    );
    const rows = buildAttentionRows(items, { ...emptySummary, contractsAwaitingActivation: 17 }, []);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row?.key).toBe('GROUP:ACTIVATE_CONTRACT');
    expect(row?.contractLabel).toBe('17 draft contracts');
    expect(row?.description).toBe('Draft contracts awaiting activation');
    expect(row?.actionUrl).toBe('/contracts?status=DRAFT');
    expect(row?.actionLabel).toBe('View Draft Contracts');
    expect(row?.contractHref).toBeNull();
  });

  it('uses singular phrasing for a single draft contract', () => {
    const rows = buildAttentionRows([], { ...emptySummary, contractsAwaitingActivation: 1 }, []);
    expect(rows[0]?.contractLabel).toBe('1 draft contract');
  });

  it('groups ASSIGN_TASKS items using the accurate workflowOverview task total and per-contract row count', () => {
    const items = [
      item({ key: 'a1', actionType: 'ASSIGN_TASKS', contractId: 'c1' }),
      item({ key: 'a2', actionType: 'ASSIGN_TASKS', contractId: 'c2' }),
    ];
    const overview: TeamWorkflowOverview[] = [
      { team: 'TECHNICAL', openTasks: 10, unassignedTasks: 12, overdueTasks: 0, completedTasks: 0 },
      { team: 'PRODUCTION', openTasks: 10, unassignedTasks: 8, overdueTasks: 0, completedTasks: 0 },
    ];
    const rows = buildAttentionRows(items, emptySummary, overview);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row?.key).toBe('GROUP:ASSIGN_TASKS');
    expect(row?.description).toBe('20 unassigned workflow tasks across 2 contracts');
    expect(row?.actionUrl).toBe('/contracts/workflow?mode=assignment');
    expect(row?.actionLabel).toBe('Assign Tasks');
  });

  it('orders rows urgent-first: closeout > overdue task > issue > claim > payment > ending-soon > assign-tasks > activate-contract', () => {
    const items: ManagerAttentionItem[] = [
      item({ key: 'activate', actionType: 'ACTIVATE_CONTRACT', priority: 'MEDIUM' }),
      item({ key: 'ending', actionType: 'CONTRACT_ENDING_SOON', priority: 'LOW' }),
      item({ key: 'payment', actionType: 'OUTSTANDING_PAYMENT', priority: 'MEDIUM' }),
      item({ key: 'claim', actionType: 'OPEN_CLAIM', priority: 'MEDIUM' }),
      item({ key: 'issue', actionType: 'OPEN_ISSUE', priority: 'HIGH' }),
      item({ key: 'overdue', actionType: 'OVERDUE_TASK', priority: 'HIGH' }),
      item({ key: 'closeout', actionType: 'CLOSEOUT_REVIEW', priority: 'HIGH' }),
      item({ key: 'assign', actionType: 'ASSIGN_TASKS', priority: 'HIGH' }),
    ];
    const rows = buildAttentionRows(
      items,
      { ...emptySummary, contractsAwaitingActivation: 1 },
      [{ team: 'TECHNICAL', openTasks: 1, unassignedTasks: 1, overdueTasks: 0, completedTasks: 0 }],
    );
    expect(rows.map((r) => r.key)).toEqual([
      'closeout',
      'overdue',
      'issue',
      'claim',
      'payment',
      'ending',
      'GROUP:ASSIGN_TASKS',
      'GROUP:ACTIVATE_CONTRACT',
    ]);
  });

  it('sorts same-type rows by date ascending, with null dates last', () => {
    const items = [
      item({ key: 'issue-late', actionType: 'OPEN_ISSUE', date: '2026-09-01' }),
      item({ key: 'issue-none', actionType: 'OPEN_ISSUE', date: null }),
      item({ key: 'issue-early', actionType: 'OPEN_ISSUE', date: '2026-08-01' }),
    ];
    const rows = buildAttentionRows(items, emptySummary, []);
    expect(rows.map((r) => r.key)).toEqual(['issue-early', 'issue-late', 'issue-none']);
  });

  it('does not group and does not cap — capping to ATTENTION_ROW_CAP is the caller responsibility', () => {
    const items = Array.from({ length: 8 }, (_, i) => item({ key: `issue-${i}`, actionType: 'OPEN_ISSUE' }));
    const rows = buildAttentionRows(items, emptySummary, []);
    expect(rows).toHaveLength(8);
    expect(ATTENTION_ROW_CAP).toBe(5);
  });
});
