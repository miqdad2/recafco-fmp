import { describe, it, expect } from 'vitest';
import {
  computeTeamProgress,
  computeOverallProgress,
  computeProductionTaskSummary,
  computePaymentProgressPercent,
  buildAttentionItems,
  type OverviewWorkflowTask,
} from './contract-overview-helpers';

function task(team: string, status: string, isOverdue = false): OverviewWorkflowTask {
  return { team, status, isOverdue };
}

describe('computeTeamProgress', () => {
  it('computes completed/total/percent for one team, ignoring other teams', () => {
    const tasks = [
      task('TECHNICAL', 'COMPLETED'),
      task('TECHNICAL', 'COMPLETED'),
      task('TECHNICAL', 'IN_PROGRESS'),
      task('TECHNICAL', 'NOT_STARTED'),
      task('PRODUCTION', 'COMPLETED'),
    ];
    expect(computeTeamProgress(tasks, 'TECHNICAL')).toEqual({ completed: 2, total: 4, percent: 50 });
  });

  it('returns 0% (not NaN) when the team has no tasks yet', () => {
    expect(computeTeamProgress([], 'ERECTION')).toEqual({ completed: 0, total: 0, percent: 0 });
  });

  it('rounds the percentage', () => {
    const tasks = [task('ERECTION', 'COMPLETED'), task('ERECTION', 'NOT_STARTED'), task('ERECTION', 'NOT_STARTED')];
    // 1/3 = 33.33...% -> rounds to 33
    expect(computeTeamProgress(tasks, 'ERECTION').percent).toBe(33);
  });
});

describe('computeOverallProgress', () => {
  it('computes completed/total across every team combined', () => {
    const tasks = [
      task('TECHNICAL', 'COMPLETED'),
      task('PRODUCTION', 'COMPLETED'),
      task('ERECTION', 'NOT_STARTED'),
      task('QS_COMMERCIAL', 'IN_PROGRESS'),
    ];
    expect(computeOverallProgress(tasks)).toEqual({ completed: 2, total: 4, percent: 50 });
  });

  it('returns 0% (not NaN) when there are no tasks at all', () => {
    expect(computeOverallProgress([])).toEqual({ completed: 0, total: 0, percent: 0 });
  });
});

describe('computeProductionTaskSummary', () => {
  it('buckets PRODUCTION-team tasks into completed/inProgress/pending, and counts overdue separately', () => {
    const tasks = [
      task('PRODUCTION', 'COMPLETED'),
      task('PRODUCTION', 'IN_PROGRESS'),
      task('PRODUCTION', 'SUBMITTED'),
      task('PRODUCTION', 'UNDER_REVIEW'),
      task('PRODUCTION', 'APPROVED'),
      task('PRODUCTION', 'NOT_STARTED', true),
      task('PRODUCTION', 'ON_HOLD'),
      task('PRODUCTION', 'REJECTED'),
      task('TECHNICAL', 'COMPLETED'),
    ];
    const summary = computeProductionTaskSummary(tasks);
    expect(summary.total).toBe(8);
    expect(summary.completed).toBe(1);
    expect(summary.inProgress).toBe(4);
    expect(summary.pending).toBe(3);
    expect(summary.overdue).toBe(1);
  });

  it('returns all-zero for a contract with no production tasks', () => {
    expect(computeProductionTaskSummary([])).toEqual({ total: 0, completed: 0, inProgress: 0, pending: 0, overdue: 0 });
  });
});

describe('computePaymentProgressPercent', () => {
  it('computes received / current value × 100', () => {
    expect(computePaymentProgressPercent(2500, 10000)).toBe(25);
  });

  it('returns 0% when current value is 0 (never divides by zero)', () => {
    expect(computePaymentProgressPercent(2500, 0)).toBe(0);
  });

  it('returns 0% when current value is negative', () => {
    expect(computePaymentProgressPercent(2500, -100)).toBe(0);
  });
});

describe('buildAttentionItems', () => {
  const baseInput = {
    contractId: 'c1',
    overdueWorkflowTasks: 0,
    overduePayments: 0,
    openClaims: 0,
    openIssues: 0,
    pendingCloseoutStatus: null as 'SUBMITTED' | 'UNDER_REVIEW' | null,
    daysRemaining: null,
  };

  it('returns an empty list when nothing needs attention', () => {
    expect(buildAttentionItems(baseInput)).toEqual([]);
  });

  it('includes an overdue workflow tasks row with the correct href', () => {
    const items = buildAttentionItems({ ...baseInput, overdueWorkflowTasks: 3 });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ key: 'overdue-tasks', actionHref: '/contracts/c1/workflow', actionLabel: 'View Workflow' });
    expect(items[0]!.text).toMatch(/3 overdue workflow tasks/);
  });

  it('includes an overdue payments row (singular wording for 1)', () => {
    const items = buildAttentionItems({ ...baseInput, overduePayments: 1 });
    expect(items[0]!.text).toBe('1 overdue payment follow-up');
    expect(items[0]!.actionHref).toBe('/contracts/c1/payments');
  });

  it('includes open claims and open issues rows', () => {
    const items = buildAttentionItems({ ...baseInput, openClaims: 2, openIssues: 5 });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ key: 'open-claims', actionHref: '/contracts/c1/claims' });
    expect(items[1]).toMatchObject({ key: 'open-issues', actionHref: '/contracts/c1/issues' });
  });

  it('includes a pending closeout row only when a request is SUBMITTED or UNDER_REVIEW', () => {
    const submitted = buildAttentionItems({ ...baseInput, pendingCloseoutStatus: 'SUBMITTED' });
    expect(submitted[0]).toMatchObject({ key: 'pending-closeout', actionHref: '/contracts/c1/closeout' });
    expect(submitted[0]!.text).toMatch(/submitted/);

    const underReview = buildAttentionItems({ ...baseInput, pendingCloseoutStatus: 'UNDER_REVIEW' });
    expect(underReview[0]!.text).toMatch(/under review/);
  });

  it('includes a contract-overdue row when the days-remaining is overdue', () => {
    const items = buildAttentionItems({ ...baseInput, daysRemaining: { label: '5d overdue', overdue: true, dueSoon: false } });
    expect(items[0]).toMatchObject({ key: 'contract-overdue', severity: 'high', actionHref: '/contracts/c1/schedule' });
  });

  it('includes a closing-soon row (not overdue) when the days-remaining is due soon', () => {
    const items = buildAttentionItems({ ...baseInput, daysRemaining: { label: '10d', overdue: false, dueSoon: true } });
    expect(items[0]).toMatchObject({ key: 'contract-closing-soon', severity: 'low', actionHref: '/contracts/c1/schedule' });
  });

  it('never includes both contract-overdue and contract-closing-soon at once', () => {
    const items = buildAttentionItems({ ...baseInput, daysRemaining: { label: '5d overdue', overdue: true, dueSoon: false } });
    expect(items.filter((i) => i.key.startsWith('contract-'))).toHaveLength(1);
  });

  it('combines multiple real conditions in the documented order', () => {
    const items = buildAttentionItems({
      contractId: 'c1',
      overdueWorkflowTasks: 1,
      overduePayments: 1,
      openClaims: 1,
      openIssues: 1,
      pendingCloseoutStatus: 'SUBMITTED',
      daysRemaining: { label: '2d overdue', overdue: true, dueSoon: false },
    });
    expect(items.map((i) => i.key)).toEqual([
      'overdue-tasks', 'overdue-payments', 'open-claims', 'open-issues', 'pending-closeout', 'contract-overdue',
    ]);
  });
});
