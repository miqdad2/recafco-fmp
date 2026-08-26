import { describe, it, expect } from 'vitest';
import { computeStaffFocusedCounts, pickNextTask } from './staff-dashboard-focus';
import type { StaffTaskRow } from '@/lib/contracts-api';

const TODAY = '2026-08-25';

function task(overrides: Partial<StaffTaskRow>): StaffTaskRow {
  return {
    id: 'task-1',
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
});
