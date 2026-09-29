import { describe, it, expect } from 'vitest';
import {
  ERECTION_ATTENTION_LABELS,
  ERECTION_WORKFLOW_STEP_ORDER,
  ERECTION_WORKFLOW_STEP_LABELS,
  computeErectionWorkflowStepKey,
  summarizeErectionWorkflowSteps,
  selectErectionNeedsAttention,
  erectionNextActionLabel,
  ERECTION_NEXT_ACTION_LABELS,
} from './contract-erection-dashboard-helpers';
import type { ErectionWorkQueueRow } from '@/lib/contracts-api';

const BASE_ROW: ErectionWorkQueueRow = {
  contractId: 'c1',
  contractReference: 'CONTRACT-2026-000004',
  jobOrderNo: 'JO-004/26',
  projectName: 'GRM Boundary Wall & Yard Upgrade',
  client: 'Gulf Ready Mix Co.',
  contractStatus: 'ACTIVE',
  lifecycleStatus: 'ACTIVE',
  methodStatementStatus: 'DRAFT',
  approvalStatus: 'NOT_STARTED',
  scheduleStatus: 'NOT_STARTED',
  plannedIssueDate: '2026-09-18',
  scheduleStartDate: null,
  scheduleEndDate: null,
  deliveryStartStatus: 'NOT_STARTED',
  deliveryWindowStart: null,
  deliveryWindowEnd: null,
  erectionStartStatus: 'NOT_STARTED',
  actualStartDateTime: null,
  checklistStatus: 'NOT_STARTED',
  workLocationYard: 'Site - Boundary Wall Zone A',
  responsibleTeam: 'Contracts Department',
  currentErectionStep: 'Issue Erection Method Statement',
  attention: 'NEEDS_PLANNING',
  lastUpdated: '2026-09-13T00:00:00.000Z',
  hasMethodStatement: true,
  nextAction: { label: 'View / Continue', href: '/contracts/c1/workflow/erection/method-statement' },
  assignedToUserId: null,
  assignedToName: null,
  assignedDepartment: null,
  assignmentStatus: null,
  viewerActionMode: 'ACT',
  assignmentSource: 'NONE',
};

describe('ERECTION_ATTENTION_LABELS', () => {
  it('covers every real attention bucket', () => {
    expect(ERECTION_ATTENTION_LABELS.OVERDUE).toBe('Overdue');
    expect(ERECTION_ATTENTION_LABELS.AWAITING_APPROVAL).toBe('Awaiting Approval');
    expect(ERECTION_ATTENTION_LABELS.ON_TRACK).toBe('On Track');
    expect(ERECTION_ATTENTION_LABELS.NEEDS_PLANNING).toBe('Needs Planning');
  });
});

describe('computeErectionWorkflowStepKey', () => {
  it('is METHOD_STATEMENT when the statement is not started or still draft', () => {
    expect(computeErectionWorkflowStepKey({ ...BASE_ROW, methodStatementStatus: 'NOT_STARTED' })).toBe('METHOD_STATEMENT');
    expect(computeErectionWorkflowStepKey({ ...BASE_ROW, methodStatementStatus: 'DRAFT' })).toBe('METHOD_STATEMENT');
  });

  it('is APPROVAL once the statement is submitted/issued but approval is not yet APPROVED', () => {
    expect(
      computeErectionWorkflowStepKey({
        ...BASE_ROW, methodStatementStatus: 'SUBMITTED_FOR_APPROVAL', approvalStatus: 'PENDING_APPROVAL',
      }),
    ).toBe('APPROVAL');
    expect(
      computeErectionWorkflowStepKey({
        ...BASE_ROW, methodStatementStatus: 'ISSUED', approvalStatus: 'REVISION_REQUESTED',
      }),
    ).toBe('APPROVAL');
  });

  it('is SCHEDULE once approved but the schedule is not yet ISSUED', () => {
    expect(
      computeErectionWorkflowStepKey({
        ...BASE_ROW, methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'DRAFT',
      }),
    ).toBe('SCHEDULE');
  });

  it('is DELIVERY once scheduled but delivery has not STARTED', () => {
    expect(
      computeErectionWorkflowStepKey({
        ...BASE_ROW, methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'ISSUED', deliveryStartStatus: 'DRAFT',
      }),
    ).toBe('DELIVERY');
  });

  it('is ERECTION_START once delivery started but erection has not STARTED', () => {
    expect(
      computeErectionWorkflowStepKey({
        ...BASE_ROW,
        methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'ISSUED',
        deliveryStartStatus: 'STARTED', erectionStartStatus: 'DRAFT',
      }),
    ).toBe('ERECTION_START');
  });

  it('is CHECKLIST once erection started but the checklist is not submitted/verified', () => {
    expect(
      computeErectionWorkflowStepKey({
        ...BASE_ROW,
        methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'ISSUED',
        deliveryStartStatus: 'STARTED', erectionStartStatus: 'STARTED', checklistStatus: 'DRAFT',
      }),
    ).toBe('CHECKLIST');
  });

  it('is PAYMENT once every real gate has cleared', () => {
    expect(
      computeErectionWorkflowStepKey({
        ...BASE_ROW,
        methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'ISSUED',
        deliveryStartStatus: 'STARTED', erectionStartStatus: 'STARTED', checklistStatus: 'VERIFIED',
      }),
    ).toBe('PAYMENT');
    expect(
      computeErectionWorkflowStepKey({
        ...BASE_ROW,
        methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'ISSUED',
        deliveryStartStatus: 'STARTED', erectionStartStatus: 'STARTED', checklistStatus: 'SUBMITTED_FOR_VERIFICATION',
      }),
    ).toBe('PAYMENT');
  });
});

describe('summarizeErectionWorkflowSteps', () => {
  it('returns all 7 steps in order, even for an empty work queue', () => {
    const summary = summarizeErectionWorkflowSteps([]);
    expect(summary.map((s) => s.step)).toEqual(ERECTION_WORKFLOW_STEP_ORDER);
    expect(summary.every((s) => s.count === 0)).toBe(true);
  });

  it('tallies real counts per step, never fabricating a number', () => {
    const rows: ErectionWorkQueueRow[] = [
      { ...BASE_ROW, contractId: 'c1', methodStatementStatus: 'DRAFT' }, // METHOD_STATEMENT
      { ...BASE_ROW, contractId: 'c2', methodStatementStatus: 'NOT_STARTED' }, // METHOD_STATEMENT
      {
        ...BASE_ROW, contractId: 'c3', methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED',
        scheduleStatus: 'ISSUED', deliveryStartStatus: 'STARTED', erectionStartStatus: 'STARTED', checklistStatus: 'VERIFIED',
      }, // PAYMENT
    ];
    const summary = summarizeErectionWorkflowSteps(rows);
    const byStep = Object.fromEntries(summary.map((s) => [s.step, s]));
    expect(byStep['METHOD_STATEMENT']!.count).toBe(2);
    expect(byStep['METHOD_STATEMENT']!.statusText).toBe('Pending');
    expect(byStep['APPROVAL']!.count).toBe(0);
    expect(byStep['APPROVAL']!.statusText).toBe('None pending');
    expect(byStep['PAYMENT']!.count).toBe(0);
    expect(byStep['PAYMENT']!.statusText).toBe('Not built yet');
  });

  it('labels every step with a human-readable name', () => {
    for (const step of ERECTION_WORKFLOW_STEP_ORDER) {
      expect(ERECTION_WORKFLOW_STEP_LABELS[step]).toMatch(/[A-Za-z]/);
    }
  });

  it('uses "In progress" wording for ERECTION_START specifically, "Pending" for every other real step', () => {
    const rows: ErectionWorkQueueRow[] = [
      {
        ...BASE_ROW, contractId: 'c1',
        methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'ISSUED',
        deliveryStartStatus: 'STARTED', erectionStartStatus: 'DRAFT',
      }, // ERECTION_START
    ];
    const summary = summarizeErectionWorkflowSteps(rows);
    const byStep = Object.fromEntries(summary.map((s) => [s.step, s]));
    expect(byStep['ERECTION_START']!.count).toBe(1);
    expect(byStep['ERECTION_START']!.statusText).toBe('In progress');
    expect(byStep['METHOD_STATEMENT']!.statusText).toBe('None pending');
  });
});

describe('selectErectionNeedsAttention', () => {
  it('excludes ON_TRACK rows', () => {
    const rows: ErectionWorkQueueRow[] = [
      { ...BASE_ROW, contractId: 'c1', attention: 'ON_TRACK' },
      { ...BASE_ROW, contractId: 'c2', attention: 'OVERDUE' },
      { ...BASE_ROW, contractId: 'c3', attention: 'AWAITING_APPROVAL' },
      { ...BASE_ROW, contractId: 'c4', attention: 'NEEDS_PLANNING' },
    ];
    const result = selectErectionNeedsAttention(rows);
    expect(result.map((r) => r.contractId)).toEqual(['c2', 'c3', 'c4']);
  });

  it('returns an empty array when every contract is on track', () => {
    expect(selectErectionNeedsAttention([{ ...BASE_ROW, attention: 'ON_TRACK' }])).toEqual([]);
  });
});

describe('erectionNextActionLabel', () => {
  it('returns the fixed actionable phrase for whichever step the contract is currently on', () => {
    expect(erectionNextActionLabel({ ...BASE_ROW, methodStatementStatus: 'DRAFT' })).toBe('Open Method Statement Step');
    expect(
      erectionNextActionLabel({ ...BASE_ROW, methodStatementStatus: 'SUBMITTED_FOR_APPROVAL', approvalStatus: 'PENDING_APPROVAL' }),
    ).toBe('Review Approval Step');
    expect(
      erectionNextActionLabel({
        ...BASE_ROW, methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'DRAFT',
      }),
    ).toBe('Open Schedule Step');
    expect(
      erectionNextActionLabel({
        ...BASE_ROW, methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'ISSUED', deliveryStartStatus: 'DRAFT',
      }),
    ).toBe('Confirm Delivery Step');
    expect(
      erectionNextActionLabel({
        ...BASE_ROW,
        methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'ISSUED',
        deliveryStartStatus: 'STARTED', erectionStartStatus: 'DRAFT',
      }),
    ).toBe('Confirm Erection Start');
    expect(
      erectionNextActionLabel({
        ...BASE_ROW,
        methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'ISSUED',
        deliveryStartStatus: 'STARTED', erectionStartStatus: 'STARTED', checklistStatus: 'DRAFT',
      }),
    ).toBe('Open Checklist Step');
    expect(
      erectionNextActionLabel({
        ...BASE_ROW,
        methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'ISSUED',
        deliveryStartStatus: 'STARTED', erectionStartStatus: 'STARTED', checklistStatus: 'VERIFIED',
      }),
    ).toBe('Payment not built yet');
  });

  it('never varies by viewer mode — the same objective phrase regardless of who is looking', () => {
    const actRow: ErectionWorkQueueRow = { ...BASE_ROW, methodStatementStatus: 'DRAFT', viewerActionMode: 'ACT' };
    const monitorRow: ErectionWorkQueueRow = { ...BASE_ROW, methodStatementStatus: 'DRAFT', viewerActionMode: 'MONITOR' };
    const readOnlyRow: ErectionWorkQueueRow = { ...BASE_ROW, methodStatementStatus: 'DRAFT', viewerActionMode: 'READ_ONLY' };
    expect(erectionNextActionLabel(actRow)).toBe('Open Method Statement Step');
    expect(erectionNextActionLabel(monitorRow)).toBe('Open Method Statement Step');
    expect(erectionNextActionLabel(readOnlyRow)).toBe('Open Method Statement Step');
  });

  it('covers every step key with a real phrase', () => {
    for (const step of ERECTION_WORKFLOW_STEP_ORDER) {
      expect(ERECTION_NEXT_ACTION_LABELS[step]).toMatch(/[A-Za-z]/);
    }
  });
});
