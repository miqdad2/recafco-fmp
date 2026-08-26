import { describe, it, expect } from 'vitest';
import { groupAssignmentQueueByContract, getContractQueueItems } from './assignment-queue-grouping';
import type { WorkflowAssignmentQueueItem } from '@/lib/contracts-api';

function item(overrides: Partial<WorkflowAssignmentQueueItem>): WorkflowAssignmentQueueItem {
  return {
    taskId: 'task-1',
    contractId: 'contract-1',
    contractReference: 'CONTRACT-2026-000001',
    contractTitle: 'Test Contract',
    counterpartyName: 'Acme Co',
    contractStatus: 'ACTIVE',
    ownerUser: { id: 'user-1', displayName: 'Manager' },
    team: 'TECHNICAL',
    taskName: 'Drawing Received',
    status: 'NOT_STARTED',
    priority: 'MEDIUM',
    dueDate: null,
    ...overrides,
  };
}

describe('groupAssignmentQueueByContract', () => {
  it('returns an empty list for no items', () => {
    expect(groupAssignmentQueueByContract([])).toEqual([]);
  });

  it('groups multiple tasks on the same contract into one row with an accurate count', () => {
    const items = [
      item({ taskId: 't1', team: 'TECHNICAL' }),
      item({ taskId: 't2', team: 'PRODUCTION' }),
      item({ taskId: 't3', team: 'TECHNICAL' }),
    ];
    const groups = groupAssignmentQueueByContract(items);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.unassignedCount).toBe(3);
    expect(groups[0]?.contractReference).toBe('CONTRACT-2026-000001');
  });

  it('lists distinct teams in board column order regardless of item order', () => {
    const items = [
      item({ taskId: 't1', team: 'QS_COMMERCIAL' }),
      item({ taskId: 't2', team: 'TECHNICAL' }),
      item({ taskId: 't3', team: 'ERECTION' }),
    ];
    const groups = groupAssignmentQueueByContract(items);
    expect(groups[0]?.teams).toEqual(['TECHNICAL', 'ERECTION', 'QS_COMMERCIAL']);
  });

  it('keeps separate contracts as separate groups', () => {
    const items = [
      item({ taskId: 't1', contractId: 'contract-1', contractReference: 'CONTRACT-1' }),
      item({ taskId: 't2', contractId: 'contract-2', contractReference: 'CONTRACT-2' }),
    ];
    const groups = groupAssignmentQueueByContract(items);
    expect(groups.map((g) => g.contractId).sort()).toEqual(['contract-1', 'contract-2']);
  });

  it('sorts by earliest unassigned-task due date ascending, contracts with no due dates last', () => {
    const items = [
      item({ taskId: 't1', contractId: 'c-none', contractReference: 'C-NONE', dueDate: null }),
      item({ taskId: 't2', contractId: 'c-later', contractReference: 'C-LATER', dueDate: '2026-09-10' }),
      item({ taskId: 't3', contractId: 'c-soon', contractReference: 'C-SOON', dueDate: '2026-08-25' }),
    ];
    const groups = groupAssignmentQueueByContract(items);
    expect(groups.map((g) => g.contractId)).toEqual(['c-soon', 'c-later', 'c-none']);
  });

  it('uses the earliest due date among a contract\'s several tasks', () => {
    const items = [
      item({ taskId: 't1', dueDate: '2026-09-10' }),
      item({ taskId: 't2', dueDate: '2026-08-01' }),
    ];
    const groups = groupAssignmentQueueByContract(items);
    expect(groups[0]?.earliestDueDate).toBe('2026-08-01');
  });
});

describe('getContractQueueItems', () => {
  it('returns only the items belonging to the given contract', () => {
    const items = [
      item({ taskId: 't1', contractId: 'contract-1' }),
      item({ taskId: 't2', contractId: 'contract-2' }),
      item({ taskId: 't3', contractId: 'contract-1' }),
    ];
    const result = getContractQueueItems(items, 'contract-1');
    expect(result.map((i) => i.taskId)).toEqual(['t1', 't3']);
  });

  it('returns an empty array when no items match', () => {
    expect(getContractQueueItems([item({})], 'unknown-contract')).toEqual([]);
  });
});
