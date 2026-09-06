import { describe, it, expect } from 'vitest';
import {
  computeClosureStatus,
  computeChecklist,
  computeChecklistProgress,
  computeBlockingItems,
  sortBlockingItemsByPriority,
  humanizeStatus,
  blockingStatusTone,
  countRisksByBucket,
  countVariationsByBucket,
  computeFinalPaymentStatus,
  type ChecklistInput,
  type BlockingItemsInput,
  type BlockingItem,
} from './contract-closeout-detail-helpers';

describe('computeClosureStatus', () => {
  it('is CLOSED once the contract itself is closed', () => {
    expect(computeClosureStatus('CLOSED', 'CLOSED', true)).toBe('CLOSED');
  });

  it('uses the real latest request status when one exists', () => {
    expect(computeClosureStatus('ACTIVE', 'SUBMITTED', false)).toBe('SUBMITTED');
    expect(computeClosureStatus('ACTIVE', 'UNDER_REVIEW', false)).toBe('UNDER_REVIEW');
    expect(computeClosureStatus('ACTIVE', 'APPROVED', false)).toBe('APPROVED');
    expect(computeClosureStatus('ACTIVE', 'REJECTED', true)).toBe('REJECTED');
  });

  it('falls back to Ready/Not Ready from real checks only when no request exists', () => {
    expect(computeClosureStatus('ACTIVE', null, true)).toBe('READY');
    expect(computeClosureStatus('ACTIVE', null, false)).toBe('NOT_READY');
    expect(computeClosureStatus('ACTIVE', undefined, undefined)).toBe('NOT_READY');
  });
});

function baseChecklistInput(overrides: Partial<ChecklistInput> = {}): ChecklistInput {
  return {
    contractId: 'contract-1',
    workflowOpen: 0,
    workflowOverdue: 0,
    productionTasksTotal: 2,
    productionTasksOpen: 0,
    erectionTasksTotal: 0,
    erectionTasksOpen: 0,
    paymentsNonFinalCount: 0,
    claimsOpen: 0,
    risksOpen: 0,
    issuesOpen: 0,
    documentObligationsTotal: 3,
    documentObligationsPendingOrExpired: 0,
    closeoutAttachmentsCount: 1,
    hasActiveOrClosedRequest: true,
    latestRequestStatus: 'APPROVED',
    latestRequestApprovedAt: '2026-01-05T00:00:00Z',
    latestRequestApprovedBy: 'Jane Manager',
    ...overrides,
  };
}

describe('computeChecklist', () => {
  it('marks every real check completed when everything is clear', () => {
    const items = computeChecklist(baseChecklistInput());
    for (const item of items) {
      expect(item.status).not.toBe('BLOCKED');
    }
    expect(items.find((i) => i.key === 'workflow')?.status).toBe('COMPLETED');
    expect(items.find((i) => i.key === 'payments')?.status).toBe('COMPLETED');
    expect(items.find((i) => i.key === 'approval')?.status).toBe('COMPLETED');
    expect(items.find((i) => i.key === 'approval')?.responsible).toBe('Jane Manager');
    expect(items.find((i) => i.key === 'approval')?.completedDate).toBe('2026-01-05T00:00:00Z');
  });

  it('marks Delivery / Erection as Not Required when there are zero erection tasks', () => {
    const items = computeChecklist(baseChecklistInput({ erectionTasksTotal: 0 }));
    const erection = items.find((i) => i.key === 'erection');
    expect(erection?.status).toBe('NOT_REQUIRED');
    expect(erection?.required).toBe(false);
  });

  it('marks Delivery / Erection Pending when erection tasks exist and are open', () => {
    const items = computeChecklist(baseChecklistInput({ erectionTasksTotal: 3, erectionTasksOpen: 1 }));
    expect(items.find((i) => i.key === 'erection')?.status).toBe('PENDING');
  });

  it('marks Required documents submitted as Not Required when no document obligations are tracked', () => {
    const items = computeChecklist(baseChecklistInput({ documentObligationsTotal: 0, documentObligationsPendingOrExpired: 0 }));
    expect(items.find((i) => i.key === 'documents')?.status).toBe('NOT_REQUIRED');
  });

  it('marks Closeout attachments uploaded Pending when no request exists yet', () => {
    const items = computeChecklist(baseChecklistInput({ hasActiveOrClosedRequest: false, closeoutAttachmentsCount: 0, latestRequestStatus: null }));
    expect(items.find((i) => i.key === 'attachments')?.status).toBe('PENDING');
  });

  it('marks Closeout request approved Blocked when the latest request was rejected', () => {
    const items = computeChecklist(baseChecklistInput({ latestRequestStatus: 'REJECTED', latestRequestApprovedAt: null, latestRequestApprovedBy: null }));
    const approval = items.find((i) => i.key === 'approval');
    expect(approval?.status).toBe('BLOCKED');
    expect(approval?.responsible).toBe('—');
    expect(approval?.completedDate).toBeNull();
  });

  it('never invents a Responsible name or Completed Date for cross-module checks', () => {
    const items = computeChecklist(baseChecklistInput());
    for (const item of items) {
      if (item.key === 'approval') continue;
      expect(item.responsible).toBe('—');
      expect(item.completedDate).toBeNull();
    }
  });
});

describe('computeChecklistProgress', () => {
  it('computes completed / totalRequired as a rounded percent', () => {
    const items = computeChecklist(baseChecklistInput());
    const progress = computeChecklistProgress(items);
    expect(progress.percent).toBe(100);
    expect(progress.completed).toBe(progress.totalRequired);
  });

  it('excludes Not Required items from the required denominator', () => {
    const items = computeChecklist(baseChecklistInput({ erectionTasksTotal: 0, documentObligationsTotal: 0 }));
    const progress = computeChecklistProgress(items);
    expect(progress.notRequired).toBe(2);
    expect(progress.totalRequired).toBe(items.length - 2);
  });

  it('never divides by zero when nothing is required', () => {
    const items = [
      { key: 'a', label: 'A', required: false, status: 'NOT_REQUIRED' as const, responsible: '—', completedDate: null, actionHref: '/x' },
    ];
    expect(computeChecklistProgress(items).percent).toBe(0);
  });

  it('reflects a genuinely partial checklist honestly (no fake percentage)', () => {
    const items = computeChecklist(baseChecklistInput({ workflowOpen: 2, paymentsNonFinalCount: 1 }));
    const progress = computeChecklistProgress(items);
    expect(progress.percent).toBeLessThan(100);
    expect(progress.pending).toBeGreaterThan(0);
  });
});

function baseBlockingInput(overrides: Partial<BlockingItemsInput> = {}): BlockingItemsInput {
  return {
    contractId: 'contract-1',
    workflowTasks: [],
    payments: [],
    claims: [],
    risks: [],
    issues: [],
    documentObligations: [],
    latestRequestStatus: 'APPROVED',
    ...overrides,
  };
}

describe('computeBlockingItems', () => {
  it('returns no rows when every source is clear and a request is approved', () => {
    expect(computeBlockingItems(baseBlockingInput())).toHaveLength(0);
  });

  it('includes an open (not APPROVED/COMPLETED) workflow task as a real blocker', () => {
    const items = computeBlockingItems(baseBlockingInput({
      workflowTasks: [{ id: 't1', taskName: 'Delivery Note', status: 'IN_PROGRESS', priority: 'HIGH', dueDate: '2026-01-01', isOverdue: true }],
    }));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ source: 'Workflow', item: 'Delivery Note', priority: 'HIGH', status: 'IN_PROGRESS' });
  });

  it('excludes a COMPLETED/APPROVED workflow task', () => {
    const items = computeBlockingItems(baseBlockingInput({
      workflowTasks: [{ id: 't1', taskName: 'Delivery Note', status: 'COMPLETED', priority: 'LOW', dueDate: null, isOverdue: false }],
    }));
    expect(items).toHaveLength(0);
  });

  it('includes a non-final payment and excludes PAID/CANCELLED ones', () => {
    const items = computeBlockingItems(baseBlockingInput({
      payments: [
        { id: 'p1', paymentNo: 'PAY-01', status: 'OVERDUE', dueDate: '2026-01-01' },
        { id: 'p2', paymentNo: 'PAY-02', status: 'PAID', dueDate: '2026-01-01' },
      ],
    }));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ source: 'Payments', item: 'PAY-01', status: 'OVERDUE' });
  });

  it('includes an open claim and excludes SETTLED/CLOSED ones', () => {
    const items = computeBlockingItems(baseBlockingInput({
      claims: [
        { id: 'c1', claimTitle: 'Delay claim', status: 'UNDER_NEGOTIATION' },
        { id: 'c2', claimTitle: 'Old claim', status: 'SETTLED' },
      ],
    }));
    expect(items).toHaveLength(1);
    expect(items[0]?.item).toBe('Delay claim');
  });

  it('includes an unresolved risk and excludes MITIGATED/CLOSED/CANCELLED ones', () => {
    const items = computeBlockingItems(baseBlockingInput({
      risks: [
        { id: 'r1', description: 'Site access risk', status: 'OPEN', riskEvaluation: 'HIGH' },
        { id: 'r2', description: 'Old risk', status: 'MITIGATED', riskEvaluation: 'LOW' },
      ],
    }));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ source: 'Risk Assessment', item: 'Site access risk', priority: 'HIGH' });
  });

  it('includes an open issue and excludes CLOSED/CANCELLED ones', () => {
    const items = computeBlockingItems(baseBlockingInput({
      issues: [
        { id: 'i1', title: 'Client approval pending', status: 'WAITING_RESPONSE', priority: 'MEDIUM' },
        { id: 'i2', title: 'Old issue', status: 'CANCELLED', priority: 'LOW' },
      ],
    }));
    expect(items).toHaveLength(1);
    expect(items[0]?.item).toBe('Client approval pending');
  });

  it('includes pending/expired documents and excludes submitted/not-required ones', () => {
    const items = computeBlockingItems(baseBlockingInput({
      documentObligations: [
        { id: 'd1', title: 'Performance Bond', status: 'EXPIRED_OVERDUE' },
        { id: 'd2', title: 'Insurance', status: 'SUBMITTED' },
      ],
    }));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ source: 'Documents & Obligations', item: 'Performance Bond', status: 'EXPIRED_OVERDUE' });
  });

  it('includes a Closeout Approval Missing row when no request exists', () => {
    const items = computeBlockingItems(baseBlockingInput({ latestRequestStatus: null }));
    expect(items).toHaveLength(1);
    expect(items[0]?.source).toBe('Closeout');
    expect(items[0]?.item).toBe('Closeout approval missing');
  });

  it('includes a rejected-request blocker row with the real rejected status', () => {
    const items = computeBlockingItems(baseBlockingInput({ latestRequestStatus: 'REJECTED' }));
    expect(items).toHaveLength(1);
    expect(items[0]?.item).toBe('Closeout request was rejected');
  });

  it('does not add a Closeout row when a request is SUBMITTED/UNDER_REVIEW/APPROVED', () => {
    expect(computeBlockingItems(baseBlockingInput({ latestRequestStatus: 'SUBMITTED' })).find((i) => i.source === 'Closeout')).toBeUndefined();
    expect(computeBlockingItems(baseBlockingInput({ latestRequestStatus: 'UNDER_REVIEW' })).find((i) => i.source === 'Closeout')).toBeUndefined();
  });
});

function item(source: BlockingItem['source'], priority: string): BlockingItem {
  return { source, item: `${source}-item`, priority, actionRequired: 'x', actionDueDate: null, status: 'OPEN', actionHref: '/x' };
}

describe('sortBlockingItemsByPriority', () => {
  it('sorts CRITICAL > HIGH > MEDIUM > LOW', () => {
    const items = [item('Workflow', 'LOW'), item('Workflow', 'CRITICAL'), item('Workflow', 'MEDIUM'), item('Workflow', 'HIGH')];
    expect(sortBlockingItemsByPriority(items).map((i) => i.priority)).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
  });

  it('ranks items with no real priority ("—") lowest, never fabricating one', () => {
    const items = [item('Payments', '—'), item('Workflow', 'LOW'), item('Risk Assessment', 'HIGH')];
    expect(sortBlockingItemsByPriority(items).map((i) => i.priority)).toEqual(['HIGH', 'LOW', '—']);
  });

  it('does not mutate the input array', () => {
    const items = [item('Workflow', 'LOW'), item('Workflow', 'HIGH')];
    const original = [...items];
    sortBlockingItemsByPriority(items);
    expect(items).toEqual(original);
  });
});

describe('humanizeStatus', () => {
  it.each([
    ['NOT_STARTED', 'Not Started'],
    ['IN_PROGRESS', 'In Progress'],
    ['SUBMITTED', 'Submitted'],
    ['UNDER_REVIEW', 'Under Review'],
    ['APPROVED', 'Approved'],
    ['COMPLETED', 'Completed'],
    ['ON_HOLD', 'On Hold'],
    ['EXPIRED_OVERDUE', 'Expired Overdue'],
    ['WAITING_RESPONSE', 'Waiting Response'],
    ['PARTIALLY_APPROVED', 'Partially Approved'],
  ])('converts the real stored value %s to %s', (raw, expected) => {
    expect(humanizeStatus(raw)).toBe(expected);
  });
});

describe('blockingStatusTone', () => {
  it.each([
    ['OVERDUE', 'error'],
    ['REJECTED', 'error'],
    ['EXPIRED_OVERDUE', 'error'],
    ['NOT_STARTED', 'neutral'],
    ['DRAFT', 'neutral'],
    ['PENDING', 'neutral'],
    ['IN_PROGRESS', 'warning'],
    ['UNDER_REVIEW', 'warning'],
    ['SUBMITTED', 'warning'],
    ['ON_HOLD', 'warning'],
    ['OPEN', 'warning'],
  ])('buckets the real status %s as %s', (status, tone) => {
    expect(blockingStatusTone(status)).toBe(tone);
  });
});

describe('countRisksByBucket', () => {
  it('buckets real risk statuses honestly', () => {
    const result = countRisksByBucket([
      { status: 'OPEN' }, { status: 'IN_PROGRESS' }, { status: 'MITIGATED' }, { status: 'CLOSED' }, { status: 'CANCELLED' },
    ]);
    expect(result).toEqual({ open: 2, mitigated: 1, closedOrCancelled: 2 });
  });
});

describe('countVariationsByBucket', () => {
  it('buckets real variation statuses honestly', () => {
    const result = countVariationsByBucket([
      { status: 'APPROVED' }, { status: 'SUBMITTED' }, { status: 'PENDING_APPROVAL' }, { status: 'DRAFT' }, { status: 'REJECTED' },
    ]);
    expect(result).toEqual({ approved: 1, pending: 2 });
  });
});

describe('computeFinalPaymentStatus', () => {
  it('is Fully Paid only when no non-final payments remain', () => {
    expect(computeFinalPaymentStatus(0)).toBe('Fully Paid');
  });

  it('is Outstanding when any non-final payments remain', () => {
    expect(computeFinalPaymentStatus(2)).toBe('Outstanding');
  });
});
