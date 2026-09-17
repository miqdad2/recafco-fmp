import { describe, it, expect } from 'vitest';
import {
  ERECTION_CHECKLIST_STATUS_LABELS,
  ERECTION_CHECKLIST_ITEM_STATUS_LABELS,
  ERECTION_CHECKLIST_TYPE_OPTIONS,
  ERECTION_CHECKLIST_DEFAULT_ITEMS,
  validateErectionChecklistFormValues,
  validateErectionChecklistHoldOrReturnComments,
  validateErectionChecklistSubmitRequirements,
  computeDisplayStatus,
  computeChecklistItemsSummaryPreview,
  computeErectionStepTrackerCurrentStep,
  type ErectionChecklistFormValidationInput,
} from './contract-erection-checklist-helpers';

const VALID_INPUT: ErectionChecklistFormValidationInput = {
  checklistRefNo: 'CL-GRM-001',
  checklistDate: '2026-11-02',
  checklistType: 'QA/QC Verification Checklist',
  preparedBy: 'Site Supervisor',
};

describe('ERECTION_CHECKLIST_STATUS_LABELS', () => {
  it('maps every real backend status to its manager-facing label', () => {
    expect(ERECTION_CHECKLIST_STATUS_LABELS.DRAFT).toBe('Draft');
    expect(ERECTION_CHECKLIST_STATUS_LABELS.SUBMITTED_FOR_VERIFICATION).toBe('Submitted for Verification');
    expect(ERECTION_CHECKLIST_STATUS_LABELS.VERIFIED).toBe('Verified');
    expect(ERECTION_CHECKLIST_STATUS_LABELS.HOLD).toBe('Hold');
    expect(ERECTION_CHECKLIST_STATUS_LABELS.RETURNED).toBe('Returned');
  });
});

describe('ERECTION_CHECKLIST_ITEM_STATUS_LABELS / ERECTION_CHECKLIST_TYPE_OPTIONS / ERECTION_CHECKLIST_DEFAULT_ITEMS', () => {
  it('covers all 4 real item statuses', () => {
    expect(ERECTION_CHECKLIST_ITEM_STATUS_LABELS.COMPLETED).toBe('Completed');
    expect(ERECTION_CHECKLIST_ITEM_STATUS_LABELS.IN_PROGRESS).toBe('In Progress');
    expect(ERECTION_CHECKLIST_ITEM_STATUS_LABELS.NOT_COMPLETED).toBe('Not Completed');
    expect(ERECTION_CHECKLIST_ITEM_STATUS_LABELS.NOT_APPLICABLE).toBe('Not Applicable');
  });

  it('has exactly the 5 checklist type options this unit specifies, in order', () => {
    expect(ERECTION_CHECKLIST_TYPE_OPTIONS).toEqual([
      'Pre-Payment Erection Checklist', 'QA/QC Verification Checklist', 'Client Acknowledgement Checklist',
      'Final Erection Checklist', 'Other',
    ]);
  });

  it('has exactly the 12 default checklist items this unit specifies, in order', () => {
    expect(ERECTION_CHECKLIST_DEFAULT_ITEMS).toHaveLength(12);
    expect(ERECTION_CHECKLIST_DEFAULT_ITEMS[0]).toBe('Approved Erection Method Statement Available');
    expect(ERECTION_CHECKLIST_DEFAULT_ITEMS[11]).toBe('Client / Consultant Acknowledgement Pending');
  });
});

describe('validateErectionChecklistFormValues', () => {
  it('returns no errors when every required field is filled in', () => {
    expect(validateErectionChecklistFormValues(VALID_INPUT)).toEqual([]);
  });

  it('requires Checklist Ref. No.', () => {
    expect(validateErectionChecklistFormValues({ ...VALID_INPUT, checklistRefNo: '' })).toContain('Checklist Ref. No. is required.');
  });

  it('requires Checklist Date', () => {
    expect(validateErectionChecklistFormValues({ ...VALID_INPUT, checklistDate: '' })).toContain('Checklist Date is required.');
  });

  it('requires Checklist Type', () => {
    expect(validateErectionChecklistFormValues({ ...VALID_INPUT, checklistType: '' })).toContain('Checklist Type is required.');
  });

  it('requires Prepared By', () => {
    expect(validateErectionChecklistFormValues({ ...VALID_INPUT, preparedBy: '  ' })).toContain('Prepared By is required.');
  });

  it('collects every missing required field, not just the first', () => {
    const errors = validateErectionChecklistFormValues({ checklistRefNo: '', checklistDate: '', checklistType: '', preparedBy: '' });
    expect(errors).toHaveLength(4);
  });
});

describe('validateErectionChecklistHoldOrReturnComments', () => {
  it('requires comments', () => {
    expect(validateErectionChecklistHoldOrReturnComments('')).toContain('Comments are required to place the checklist on Hold or Return it.');
  });

  it('rejects whitespace-only comments', () => {
    expect(validateErectionChecklistHoldOrReturnComments('   ')).toHaveLength(1);
  });

  it('accepts real comments text', () => {
    expect(validateErectionChecklistHoldOrReturnComments('Awaiting client acknowledgement.')).toEqual([]);
  });
});

describe('validateErectionChecklistSubmitRequirements', () => {
  it('requires at least one checklist item row', () => {
    expect(validateErectionChecklistSubmitRequirements(0)).toContain('At least one checklist item row is required to submit for verification.');
  });

  it('returns no errors once at least one row exists', () => {
    expect(validateErectionChecklistSubmitRequirements(1)).toEqual([]);
    expect(validateErectionChecklistSubmitRequirements(12)).toEqual([]);
  });
});

describe('computeDisplayStatus', () => {
  it('shows "Draft" when no record has been created yet', () => {
    expect(computeDisplayStatus(null, []).label).toBe('Draft');
  });

  it('shows "Ready for Verification" for a DRAFT record whose required fields are all already valid — a computed label, never a stored status', () => {
    expect(computeDisplayStatus('DRAFT', []).label).toBe('Ready for Verification');
  });

  it('shows plain "Draft" for a DRAFT record still missing required fields', () => {
    expect(computeDisplayStatus('DRAFT', ['Prepared By is required.']).label).toBe('Draft');
  });

  it('shows the real stored label for SUBMITTED_FOR_VERIFICATION regardless of validation state', () => {
    expect(computeDisplayStatus('SUBMITTED_FOR_VERIFICATION', []).label).toBe('Submitted for Verification');
  });

  it('shows the real stored label for VERIFIED', () => {
    expect(computeDisplayStatus('VERIFIED', []).label).toBe('Verified');
  });

  it('shows the real stored label for HOLD', () => {
    expect(computeDisplayStatus('HOLD', []).label).toBe('Hold');
  });

  it('shows the real stored label for RETURNED', () => {
    expect(computeDisplayStatus('RETURNED', []).label).toBe('Returned');
  });
});

describe('computeChecklistItemsSummaryPreview', () => {
  it('returns all-zero for an empty item list — never fabricates a total', () => {
    expect(computeChecklistItemsSummaryPreview([])).toEqual({ totalItems: 0, completed: 0, inProgress: 0, notCompleted: 0, notApplicable: 0 });
  });

  it('matches the unit demo data exactly (12 items: 10 Completed, 1 In Progress, 1 Not Completed)', () => {
    const items = [
      ...Array(10).fill({ status: 'COMPLETED' as const }),
      { status: 'IN_PROGRESS' as const },
      { status: 'NOT_COMPLETED' as const },
    ];
    expect(computeChecklistItemsSummaryPreview(items)).toEqual({ totalItems: 12, completed: 10, inProgress: 1, notCompleted: 1, notApplicable: 0 });
  });

  it('counts Not Applicable rows separately', () => {
    const items = [{ status: 'COMPLETED' as const }, { status: 'NOT_APPLICABLE' as const }, { status: 'NOT_APPLICABLE' as const }];
    expect(computeChecklistItemsSummaryPreview(items)).toEqual({ totalItems: 3, completed: 1, inProgress: 0, notCompleted: 0, notApplicable: 2 });
  });
});

describe('computeErectionStepTrackerCurrentStep', () => {
  it('stays on Step 5 until erection reaches Started', () => {
    expect(computeErectionStepTrackerCurrentStep(null, null)).toBe(5);
    expect(computeErectionStepTrackerCurrentStep('DRAFT', null)).toBe(5);
    expect(computeErectionStepTrackerCurrentStep('HOLD', null)).toBe(5);
  });

  it('moves to Step 6 once erection is Started and the checklist has not been submitted/verified yet', () => {
    expect(computeErectionStepTrackerCurrentStep('STARTED', null)).toBe(6);
    expect(computeErectionStepTrackerCurrentStep('STARTED', 'DRAFT')).toBe(6);
    expect(computeErectionStepTrackerCurrentStep('STARTED', 'HOLD')).toBe(6);
  });

  it('moves to Step 7 once the checklist has been Submitted for Verification or Verified', () => {
    expect(computeErectionStepTrackerCurrentStep('STARTED', 'SUBMITTED_FOR_VERIFICATION')).toBe(7);
    expect(computeErectionStepTrackerCurrentStep('STARTED', 'VERIFIED')).toBe(7);
  });
});
