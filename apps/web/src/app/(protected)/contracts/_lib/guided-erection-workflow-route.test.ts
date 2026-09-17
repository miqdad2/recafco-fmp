import { describe, it, expect } from 'vitest';
import {
  isGuidedErectionWorkflowTask,
  getGuidedErectionWorkflowRoute,
  getGuidedErectionTaskDisplayName,
} from './guided-erection-workflow-route';

const CONTRACT_ID = 'c1';

describe('getGuidedErectionWorkflowRoute', () => {
  it('routes Step 1 (Issue Erection Method Statement) by taskKey', () => {
    expect(getGuidedErectionWorkflowRoute({ taskKey: 'erection_method_statement_issued' }, CONTRACT_ID)).toEqual({
      href: '/contracts/c1/workflow/erection/method-statement',
      stepNumber: 1,
    });
  });

  it('routes Step 2 (Erection Method Statement Approval) by taskKey', () => {
    expect(getGuidedErectionWorkflowRoute({ taskKey: 'erection_statement_approval' }, CONTRACT_ID)).toEqual({
      href: '/contracts/c1/workflow/erection/method-statement/approval',
      stepNumber: 2,
    });
  });

  it('routes Step 3 (Issue Erection Schedule) by taskKey', () => {
    expect(getGuidedErectionWorkflowRoute({ taskKey: 'erection_schedule_issued' }, CONTRACT_ID)).toEqual({
      href: '/contracts/c1/workflow/erection/schedule',
      stepNumber: 3,
    });
  });

  it('routes Step 4 (Delivery Start) by taskKey', () => {
    expect(getGuidedErectionWorkflowRoute({ taskKey: 'erection_delivery_start' }, CONTRACT_ID)).toEqual({
      href: '/contracts/c1/workflow/erection/delivery-start',
      stepNumber: 4,
    });
  });

  it('routes Step 5 (Erection Start) by taskKey', () => {
    expect(getGuidedErectionWorkflowRoute({ taskKey: 'erection_start' }, CONTRACT_ID)).toEqual({
      href: '/contracts/c1/workflow/erection/start',
      stepNumber: 5,
    });
  });

  it('routes Step 6 (Erection Checklist) by taskKey', () => {
    expect(getGuidedErectionWorkflowRoute({ taskKey: 'erection_issue_checklist' }, CONTRACT_ID)).toEqual({
      href: '/contracts/c1/workflow/erection/checklist',
      stepNumber: 6,
    });
  });

  it('returns null for Payment Issued (Step 7 — no guided screen yet)', () => {
    expect(getGuidedErectionWorkflowRoute({ taskKey: 'qs_payment_issued' }, CONTRACT_ID)).toBeNull();
  });

  it('returns null for a non-erection task (e.g. a Technical-team task)', () => {
    expect(getGuidedErectionWorkflowRoute({ taskKey: 'technical_drawing_received' }, CONTRACT_ID)).toBeNull();
  });

  it('returns null for an unrecognized/missing taskKey with no matching title either', () => {
    expect(getGuidedErectionWorkflowRoute({ taskKey: 'some_unknown_key', taskName: 'Some Unknown Task' }, CONTRACT_ID)).toBeNull();
  });

  it('falls back to a normalized title match when taskKey is missing (old wording)', () => {
    expect(getGuidedErectionWorkflowRoute({ taskName: 'Issued of Erection Method Statement' }, CONTRACT_ID)).toEqual({
      href: '/contracts/c1/workflow/erection/method-statement',
      stepNumber: 1,
    });
  });

  it('falls back to a normalized title match when taskKey is missing (corrected wording)', () => {
    expect(getGuidedErectionWorkflowRoute({ taskName: 'Issue Erection Schedule' }, CONTRACT_ID)).toEqual({
      href: '/contracts/c1/workflow/erection/schedule',
      stepNumber: 3,
    });
  });

  it('title fallback is whitespace/case-insensitive', () => {
    expect(getGuidedErectionWorkflowRoute({ taskName: '  Delivery   START  ' }, CONTRACT_ID)).toEqual({
      href: '/contracts/c1/workflow/erection/delivery-start',
      stepNumber: 4,
    });
  });

  it('a real taskKey always wins over a mismatched taskName', () => {
    expect(getGuidedErectionWorkflowRoute({ taskKey: 'erection_start', taskName: 'Something Else Entirely' }, CONTRACT_ID)).toEqual({
      href: '/contracts/c1/workflow/erection/start',
      stepNumber: 5,
    });
  });

  it('builds the href using the given contractId', () => {
    expect(getGuidedErectionWorkflowRoute({ taskKey: 'erection_start' }, 'contract-xyz')?.href).toBe(
      '/contracts/contract-xyz/workflow/erection/start',
    );
  });
});

describe('isGuidedErectionWorkflowTask', () => {
  it('is true for every one of the 6 guided erection taskKeys', () => {
    const keys = [
      'erection_method_statement_issued', 'erection_statement_approval', 'erection_schedule_issued',
      'erection_delivery_start', 'erection_start', 'erection_issue_checklist',
    ];
    for (const taskKey of keys) {
      expect(isGuidedErectionWorkflowTask({ taskKey })).toBe(true);
    }
  });

  it('is false for Payment Issued and any non-erection task', () => {
    expect(isGuidedErectionWorkflowTask({ taskKey: 'qs_payment_issued' })).toBe(false);
    expect(isGuidedErectionWorkflowTask({ taskKey: 'production_start' })).toBe(false);
  });

  it('is false for an empty/unrecognized task', () => {
    expect(isGuidedErectionWorkflowTask({})).toBe(false);
  });
});

describe('getGuidedErectionTaskDisplayName', () => {
  it('corrects "Issued of Erection Method Statement" to "Issue Erection Method Statement"', () => {
    expect(getGuidedErectionTaskDisplayName({ taskKey: 'erection_method_statement_issued', taskName: 'Issued of Erection Method Statement' }))
      .toBe('Issue Erection Method Statement');
  });

  it('corrects "Issued Erection Schedule" to "Issue Erection Schedule"', () => {
    expect(getGuidedErectionTaskDisplayName({ taskKey: 'erection_schedule_issued', taskName: 'Issued Erection Schedule' }))
      .toBe('Issue Erection Schedule');
  });

  it('corrects "Issue Checklist" to "Erection Checklist"', () => {
    expect(getGuidedErectionTaskDisplayName({ taskKey: 'erection_issue_checklist', taskName: 'Issue Checklist' }))
      .toBe('Erection Checklist');
  });

  it('leaves a non-erection task name exactly as stored', () => {
    expect(getGuidedErectionTaskDisplayName({ taskKey: 'technical_drawing_received', taskName: 'Drawing Received' }))
      .toBe('Drawing Received');
  });

  it('leaves Payment Issued exactly as stored (no guided screen, no relabel)', () => {
    expect(getGuidedErectionTaskDisplayName({ taskKey: 'qs_payment_issued', taskName: 'Payment Issued' }))
      .toBe('Payment Issued');
  });
});
