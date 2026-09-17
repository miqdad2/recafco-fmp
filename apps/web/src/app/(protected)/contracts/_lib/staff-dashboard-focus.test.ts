import { describe, it, expect } from 'vitest';
import { computeStaffFocusedCounts, pickNextTask, hasOnlyLockedOpenTasks } from './staff-dashboard-focus';
import type { StaffTaskRow } from '@/lib/contracts-api';

const TODAY = '2026-08-25';

function task(overrides: Partial<StaffTaskRow>): StaffTaskRow {
  return {
    id: 'task-1',
    taskKey: 'technical_drawing_received',
    taskName: 'Drawing Received',
    contractId: 'contract-1',
    contractReference: 'CONTRACT-2026-000001',
    contractTitle: 'Test Contract',
    counterpartyName: 'Acme Co',
    team: 'TECHNICAL',
    status: 'NOT_STARTED',
    dueDate: null,
    priority: 'MEDIUM',
    isOverdue: false,
    actionUrl: '/contracts/contract-1/workflow',
    ...overrides,
  };
}

describe('computeStaffFocusedCounts', () => {
  it('returns all zeros for no tasks', () => {
    expect(computeStaffFocusedCounts([], TODAY)).toEqual({
      dueToday: 0, overdue: 0, inProgress: 0, submittedWaitingReview: 0,
    });
  });

  it('counts due-today tasks, excluding completed ones', () => {
    const tasks = [
      task({ id: 't1', dueDate: TODAY, status: 'NOT_STARTED' }),
      task({ id: 't2', dueDate: TODAY, status: 'COMPLETED' }),
      task({ id: 't3', dueDate: '2026-08-26' }),
    ];
    expect(computeStaffFocusedCounts(tasks, TODAY).dueToday).toBe(1);
  });

  it('counts overdue tasks from the backend-computed isOverdue flag', () => {
    const tasks = [task({ id: 't1', isOverdue: true }), task({ id: 't2', isOverdue: false })];
    expect(computeStaffFocusedCounts(tasks, TODAY).overdue).toBe(1);
  });

  it('counts IN_PROGRESS tasks', () => {
    const tasks = [task({ id: 't1', status: 'IN_PROGRESS' }), task({ id: 't2', status: 'NOT_STARTED' })];
    expect(computeStaffFocusedCounts(tasks, TODAY).inProgress).toBe(1);
  });

  it('counts SUBMITTED and UNDER_REVIEW tasks as submittedWaitingReview', () => {
    const tasks = [
      task({ id: 't1', status: 'SUBMITTED' }),
      task({ id: 't2', status: 'UNDER_REVIEW' }),
      task({ id: 't3', status: 'APPROVED' }),
    ];
    expect(computeStaffFocusedCounts(tasks, TODAY).submittedWaitingReview).toBe(2);
  });
});

describe('pickNextTask', () => {
  it('returns undefined when there are no tasks', () => {
    expect(pickNextTask([], TODAY)).toBeUndefined();
  });

  it('returns undefined when every task is completed', () => {
    expect(pickNextTask([task({ status: 'COMPLETED' })], TODAY)).toBeUndefined();
  });

  it('prioritizes an overdue task over everything else', () => {
    const overdueTask = task({ id: 'overdue-1', isOverdue: true, dueDate: '2026-08-20' });
    const tasks = [
      task({ id: 'due-today-1', dueDate: TODAY }),
      task({ id: 'high-1', priority: 'CRITICAL', status: 'NOT_STARTED' }),
      overdueTask,
    ];
    expect(pickNextTask(tasks, TODAY)?.id).toBe('overdue-1');
  });

  it('falls back to a due-today task when nothing is overdue', () => {
    const dueTodayTask = task({ id: 'due-today-1', dueDate: TODAY });
    const tasks = [task({ id: 'in-progress-1', status: 'IN_PROGRESS' }), dueTodayTask];
    expect(pickNextTask(tasks, TODAY)?.id).toBe('due-today-1');
  });

  it('falls back to a high-priority not-started task when nothing is overdue or due today', () => {
    const highTask = task({ id: 'high-1', priority: 'HIGH', status: 'NOT_STARTED', dueDate: '2026-09-01' });
    const tasks = [task({ id: 'in-progress-1', status: 'IN_PROGRESS', dueDate: '2026-08-27' }), highTask];
    expect(pickNextTask(tasks, TODAY)?.id).toBe('high-1');
  });

  it('falls back to an in-progress task when nothing more urgent exists', () => {
    const inProgressTask = task({ id: 'in-progress-1', status: 'IN_PROGRESS', dueDate: '2026-08-27' });
    const tasks = [task({ id: 'not-started-1', status: 'NOT_STARTED', priority: 'LOW', dueDate: '2026-08-30' }), inProgressTask];
    expect(pickNextTask(tasks, TODAY)?.id).toBe('in-progress-1');
  });

  it('falls back to the earliest-due remaining task when no other bucket matches', () => {
    const tasks = [
      task({ id: 'later-1', status: 'NOT_STARTED', priority: 'LOW', dueDate: '2026-09-01' }),
      task({ id: 'earlier-1', status: 'NOT_STARTED', priority: 'LOW', dueDate: '2026-08-27' }),
    ];
    expect(pickNextTask(tasks, TODAY)?.id).toBe('earlier-1');
  });

  it('falls back to the first open task when nothing has a due date', () => {
    const tasks = [task({ id: 'no-date-1', status: 'NOT_STARTED', priority: 'LOW', dueDate: null })];
    expect(pickNextTask(tasks, TODAY)?.id).toBe('no-date-1');
  });

  // ---------------------------------------------------------------------
  // CM-71H.5 — a locked guided erection step is never picked as "Today's
  // Work," at any priority tier, even when it looks maximally urgent.
  // ---------------------------------------------------------------------

  it('never picks a locked guided step, even when it is overdue', () => {
    const lockedOverdue = task({ id: 'locked-1', isOverdue: true, guidedStepLocked: true });
    const normalTask = task({ id: 'normal-1', dueDate: '2026-09-01' });
    expect(pickNextTask([lockedOverdue, normalTask], TODAY)?.id).toBe('normal-1');
  });

  it('returns undefined when every open task is a locked guided step', () => {
    const tasks = [
      task({ id: 'locked-1', guidedStepLocked: true }),
      task({ id: 'locked-2', guidedStepLocked: true, isOverdue: true }),
    ];
    expect(pickNextTask(tasks, TODAY)).toBeUndefined();
  });

  it('falls through to an unlocked task when a locked one would otherwise win by priority', () => {
    const lockedDueToday = task({ id: 'locked-1', dueDate: TODAY, guidedStepLocked: true });
    const unlockedInProgress = task({ id: 'unlocked-1', status: 'IN_PROGRESS', dueDate: '2026-08-27' });
    expect(pickNextTask([lockedDueToday, unlockedInProgress], TODAY)?.id).toBe('unlocked-1');
  });
});

describe('hasOnlyLockedOpenTasks', () => {
  it('is false for an empty task list', () => {
    expect(hasOnlyLockedOpenTasks([])).toBe(false);
  });

  it('is false when every task is completed (no open work at all — a different empty state)', () => {
    expect(hasOnlyLockedOpenTasks([task({ status: 'COMPLETED', guidedStepLocked: true })])).toBe(false);
  });

  it('is true when the only open work is locked guided steps', () => {
    const tasks = [
      task({ id: 't1', guidedStepLocked: true }),
      task({ id: 't2', status: 'COMPLETED' }),
    ];
    expect(hasOnlyLockedOpenTasks(tasks)).toBe(true);
  });

  it('is false when at least one open task is actionable (not a locked guided step)', () => {
    const tasks = [
      task({ id: 't1', guidedStepLocked: true }),
      task({ id: 't2' }),
    ];
    expect(hasOnlyLockedOpenTasks(tasks)).toBe(false);
  });
});
