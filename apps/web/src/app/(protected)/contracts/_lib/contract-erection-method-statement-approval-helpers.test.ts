import { describe, it, expect } from 'vitest';
import {
  ERECTION_METHOD_STATEMENT_APPROVAL_STATUS_LABELS,
  ERECTION_METHOD_STATEMENT_APPROVAL_DECISION_LABELS,
  validateErectionMethodStatementApprovalDraftValues,
  validateErectionMethodStatementApprovalFinalValues,
  computeErectionStepTrackerCurrentStep,
} from './contract-erection-method-statement-approval-helpers';

describe('ERECTION_METHOD_STATEMENT_APPROVAL_STATUS_LABELS', () => {
  it('covers every real backend reviewStatus', () => {
    expect(ERECTION_METHOD_STATEMENT_APPROVAL_STATUS_LABELS.PENDING_APPROVAL).toBe('Pending Approval');
    expect(ERECTION_METHOD_STATEMENT_APPROVAL_STATUS_LABELS.DRAFT_REVIEW).toBe('Draft Review');
    expect(ERECTION_METHOD_STATEMENT_APPROVAL_STATUS_LABELS.APPROVED).toBe('Approved');
    expect(ERECTION_METHOD_STATEMENT_APPROVAL_STATUS_LABELS.REVISION_REQUESTED).toBe('Revision Requested');
    expect(ERECTION_METHOD_STATEMENT_APPROVAL_STATUS_LABELS.REJECTED).toBe('Rejected');
  });
});

describe('ERECTION_METHOD_STATEMENT_APPROVAL_DECISION_LABELS', () => {
  it('covers every real decision option, matching the wording in the approved design', () => {
    expect(ERECTION_METHOD_STATEMENT_APPROVAL_DECISION_LABELS.APPROVE).toBe('Approve');
    expect(ERECTION_METHOD_STATEMENT_APPROVAL_DECISION_LABELS.REQUEST_REVISION).toBe('Request Revision');
    expect(ERECTION_METHOD_STATEMENT_APPROVAL_DECISION_LABELS.REJECT).toBe('Reject');
  });
});

describe('validateErectionMethodStatementApprovalDraftValues', () => {
  it('never requires anything — every column here is a real nullable field, unlike Step 1', () => {
    expect(validateErectionMethodStatementApprovalDraftValues({ reviewRequiredBy: '', reviewingEngineer: '', reviewType: '' })).toEqual([]);
  });
});

describe('validateErectionMethodStatementApprovalFinalValues', () => {
  const VALID = {
    reviewRequiredBy: '2026-09-22',
    reviewingEngineer: 'QA/QC Engineer',
    reviewType: 'Technical & Safety Review',
    comments: 'Reviewed and acceptable.',
  };

  it('returns no errors when every required field is filled in', () => {
    expect(validateErectionMethodStatementApprovalFinalValues(VALID)).toEqual([]);
  });

  it('requires Review Required By', () => {
    expect(validateErectionMethodStatementApprovalFinalValues({ ...VALID, reviewRequiredBy: '' })).toContain('Review Required By is required.');
  });

  it('requires Reviewing Engineer', () => {
    expect(validateErectionMethodStatementApprovalFinalValues({ ...VALID, reviewingEngineer: '  ' })).toContain('Reviewing Engineer is required.');
  });

  it('requires Review Type', () => {
    expect(validateErectionMethodStatementApprovalFinalValues({ ...VALID, reviewType: '' })).toContain('Review Type is required.');
  });

  it('requires Comments / Review Notes — for Approve as well as Request Revision/Reject', () => {
    expect(validateErectionMethodStatementApprovalFinalValues({ ...VALID, comments: '   ' })).toContain('Comments / Review Notes are required.');
  });

  it('collects every missing required field, not just the first', () => {
    const errors = validateErectionMethodStatementApprovalFinalValues({ reviewRequiredBy: '', reviewingEngineer: '', reviewType: '', comments: '' });
    expect(errors).toHaveLength(4);
  });
});

describe('computeErectionStepTrackerCurrentStep', () => {
  it('stays on Step 1 while the method statement is still Draft', () => {
    expect(computeErectionStepTrackerCurrentStep('DRAFT', null)).toBe(1);
  });

  it('stays on Step 1 when no method statement exists at all', () => {
    expect(computeErectionStepTrackerCurrentStep(null, null)).toBe(1);
  });

  it('moves to Step 2 once Submitted for Approval, even with no review started yet', () => {
    expect(computeErectionStepTrackerCurrentStep('SUBMITTED_FOR_APPROVAL', null)).toBe(2);
  });

  it('moves to Step 2 once Issued, even with no review started yet', () => {
    expect(computeErectionStepTrackerCurrentStep('ISSUED', null)).toBe(2);
  });

  it('stays on Step 2 while the review is a Draft Review or Pending Approval', () => {
    expect(computeErectionStepTrackerCurrentStep('ISSUED', 'DRAFT_REVIEW')).toBe(2);
    expect(computeErectionStepTrackerCurrentStep('ISSUED', 'PENDING_APPROVAL')).toBe(2);
  });

  it('stays on Step 2 when Revision Requested — the workflow loops back, it does not advance', () => {
    expect(computeErectionStepTrackerCurrentStep('ISSUED', 'REVISION_REQUESTED')).toBe(2);
  });

  it('stays on Step 2 when Rejected', () => {
    expect(computeErectionStepTrackerCurrentStep('ISSUED', 'REJECTED')).toBe(2);
  });

  it('advances to Step 3 once Approved', () => {
    expect(computeErectionStepTrackerCurrentStep('ISSUED', 'APPROVED')).toBe(3);
  });
});
