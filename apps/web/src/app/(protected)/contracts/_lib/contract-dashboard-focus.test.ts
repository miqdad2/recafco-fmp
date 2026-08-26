import { describe, it, expect } from 'vitest';
import { buildTodaysFocusSegments } from './contract-dashboard-focus';
import type { ManagerDashboardSummary } from '@/lib/contracts-api';

function summary(overrides: Partial<ManagerDashboardSummary>): ManagerDashboardSummary {
  return {
    activeContracts: 0,
    draftContracts: 0,
    contractsAwaitingActivation: 0,
    overdueWorkflowTasks: 0,
    openIssues: 0,
    openClaims: 0,
    outstandingPayments: 0,
    pendingCloseoutRequests: 0,
    dueThisWeek: 0,
    ...overrides,
  };
}

describe('buildTodaysFocusSegments', () => {
  it('returns an empty list when summary is undefined', () => {
    expect(buildTodaysFocusSegments(undefined)).toEqual([]);
  });

  it('returns an empty list when every count is zero', () => {
    expect(buildTodaysFocusSegments(summary({}))).toEqual([]);
  });

  it('builds the example sentence segments in order: closeout, overdue, issues, claims', () => {
    const segments = buildTodaysFocusSegments(
      summary({ pendingCloseoutRequests: 2, overdueWorkflowTasks: 1, openIssues: 3, openClaims: 4 }),
    );
    expect(segments).toEqual([
      '2 closeout requests waiting review',
      '1 overdue workflow task',
      '3 open issues',
      '4 open claims',
    ]);
  });

  it('uses singular phrasing for a count of 1', () => {
    const segments = buildTodaysFocusSegments(
      summary({ pendingCloseoutRequests: 1, overdueWorkflowTasks: 1, openIssues: 1, openClaims: 1 }),
    );
    expect(segments).toEqual([
      '1 closeout request waiting review',
      '1 overdue workflow task',
      '1 open issue',
      '1 open claim',
    ]);
  });

  it('omits zero-count segments', () => {
    expect(buildTodaysFocusSegments(summary({ overdueWorkflowTasks: 1 }))).toEqual(['1 overdue workflow task']);
  });
});
