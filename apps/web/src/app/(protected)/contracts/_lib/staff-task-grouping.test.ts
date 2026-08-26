import { describe, it, expect } from 'vitest';
import { groupStaffTasksByBucket, type StaffFlatTask } from './staff-task-grouping';

function task(overrides: Partial<StaffFlatTask>): StaffFlatTask {
  return {
    id: 'task-1',
    contractId: 'contract-1',
    contractReference: 'CONTRACT-2026-000001',
    contractTitle: 'Test Contract',
    counterpartyName: 'Acme Co',
    contractManagerName: 'Jane Manager',
    teamTasks: [],
    team: 'TECHNICAL',
    taskKey: 'technical_drawing_received',
    taskName: 'Drawing Received',
    sortOrder: 1,
    status: 'NOT_STARTED',
    priority: 'MEDIUM',
    lastActivityAt: '2026-08-01T00:00:00Z',
    attachmentsCount: 0,
    commentsCount: 0,
    isOverdue: false,
    createdByUser: { id: 'user-1', displayName: 'Manager' },
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

describe('groupStaffTasksByBucket', () => {
  it('returns 5 buckets, all empty, for no tasks', () => {
    const buckets = groupStaffTasksByBucket([]);
    expect(buckets.map((b) => b.key)).toEqual(['overdue', 'open', 'inProgress', 'submittedUnderReview', 'completed']);
    expect(buckets.every((b) => b.tasks.length === 0)).toBe(true);
  });

  it('overdue takes priority over its status bucket — a task never appears twice', () => {
    const t = task({ id: 't1', status: 'IN_PROGRESS', isOverdue: true });
    const buckets = groupStaffTasksByBucket([t]);
    const overdue = buckets.find((b) => b.key === 'overdue')!;
    const inProgress = buckets.find((b) => b.key === 'inProgress')!;
    expect(overdue.tasks.map((x) => x.id)).toEqual(['t1']);
    expect(inProgress.tasks).toHaveLength(0);
  });

  it('buckets NOT_STARTED into "My Open Tasks"', () => {
    const buckets = groupStaffTasksByBucket([task({ id: 't1', status: 'NOT_STARTED' })]);
    expect(buckets.find((b) => b.key === 'open')?.tasks.map((t) => t.id)).toEqual(['t1']);
  });

  it('buckets IN_PROGRESS, ON_HOLD, and REJECTED into "In Progress"', () => {
    const tasks = [
      task({ id: 't1', status: 'IN_PROGRESS' }),
      task({ id: 't2', status: 'ON_HOLD' }),
      task({ id: 't3', status: 'REJECTED' }),
    ];
    const bucket = groupStaffTasksByBucket(tasks).find((b) => b.key === 'inProgress')!;
    expect(bucket.tasks.map((t) => t.id).sort()).toEqual(['t1', 't2', 't3']);
  });

  it('buckets SUBMITTED and UNDER_REVIEW into "Submitted / Under Review"', () => {
    const tasks = [task({ id: 't1', status: 'SUBMITTED' }), task({ id: 't2', status: 'UNDER_REVIEW' })];
    const bucket = groupStaffTasksByBucket(tasks).find((b) => b.key === 'submittedUnderReview')!;
    expect(bucket.tasks.map((t) => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('buckets COMPLETED and APPROVED into "Completed"', () => {
    const tasks = [task({ id: 't1', status: 'COMPLETED' }), task({ id: 't2', status: 'APPROVED' })];
    const bucket = groupStaffTasksByBucket(tasks).find((b) => b.key === 'completed')!;
    expect(bucket.tasks.map((t) => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('a mixed set lands each task in exactly one bucket', () => {
    const tasks = [
      task({ id: 'overdue-1', status: 'IN_PROGRESS', isOverdue: true }),
      task({ id: 'open-1', status: 'NOT_STARTED' }),
      task({ id: 'progress-1', status: 'IN_PROGRESS' }),
      task({ id: 'review-1', status: 'UNDER_REVIEW' }),
      task({ id: 'done-1', status: 'COMPLETED' }),
    ];
    const buckets = groupStaffTasksByBucket(tasks);
    const totalBucketed = buckets.reduce((sum, b) => sum + b.tasks.length, 0);
    expect(totalBucketed).toBe(tasks.length);
  });
});
