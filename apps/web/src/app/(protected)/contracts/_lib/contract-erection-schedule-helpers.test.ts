import { describe, it, expect } from 'vitest';
import {
  ERECTION_SCHEDULE_STATUS_LABELS,
  validateErectionScheduleFormValues,
  validateErectionScheduleHoldOrReturnRemarks,
  computeDisplayStatus,
  computePlannedDurationDays,
  computeErectionStepTrackerCurrentStep,
  type ErectionScheduleFormValidationInput,
} from './contract-erection-schedule-helpers';

const VALID_INPUT: ErectionScheduleFormValidationInput = {
  scheduleReferenceNo: 'ESCH-GRM-001',
  scheduleDate: '2026-09-20',
  plannedStartDate: '2026-09-25',
  plannedEndDate: '2026-10-30',
  jobOrderNo: 'JO-004/26',
  erectionCrewTeam: 'Crew A',
  estimatedManpowerPlanned: '18',
  requiredEquipmentPlanned: '6',
  preparedBy: 'Site Engineer',
};

describe('ERECTION_SCHEDULE_STATUS_LABELS', () => {
  it('maps every real backend status to its manager-facing label', () => {
    expect(ERECTION_SCHEDULE_STATUS_LABELS.DRAFT).toBe('Draft');
    expect(ERECTION_SCHEDULE_STATUS_LABELS.ISSUED).toBe('Issued');
    expect(ERECTION_SCHEDULE_STATUS_LABELS.HOLD).toBe('Hold');
    expect(ERECTION_SCHEDULE_STATUS_LABELS.RETURNED).toBe('Returned');
  });
});

describe('validateErectionScheduleFormValues', () => {
  it('returns no errors when every required field is filled in', () => {
    expect(validateErectionScheduleFormValues(VALID_INPUT)).toEqual([]);
  });

  it('requires Schedule Reference No.', () => {
    const errors = validateErectionScheduleFormValues({ ...VALID_INPUT, scheduleReferenceNo: '' });
    expect(errors).toContain('Schedule Reference No. is required.');
  });

  it('requires Schedule Date', () => {
    const errors = validateErectionScheduleFormValues({ ...VALID_INPUT, scheduleDate: '' });
    expect(errors).toContain('Schedule Date is required.');
  });

  it('requires Planned Start Date', () => {
    const errors = validateErectionScheduleFormValues({ ...VALID_INPUT, plannedStartDate: '' });
    expect(errors).toContain('Planned Start Date is required.');
  });

  it('requires Planned End Date', () => {
    const errors = validateErectionScheduleFormValues({ ...VALID_INPUT, plannedEndDate: '' });
    expect(errors).toContain('Planned End Date is required.');
  });

  it('requires Job Order No. (the design correction replacing "Work Package / Area")', () => {
    const errors = validateErectionScheduleFormValues({ ...VALID_INPUT, jobOrderNo: '' });
    expect(errors).toContain('Job Order No. is required.');
  });

  it('requires Erection Crew/Team', () => {
    const errors = validateErectionScheduleFormValues({ ...VALID_INPUT, erectionCrewTeam: '  ' });
    expect(errors).toContain('Erection Crew/Team is required.');
  });

  it('requires Estimated Manpower Planned (the design correction replacing "Total Manpower Planned")', () => {
    const errors = validateErectionScheduleFormValues({ ...VALID_INPUT, estimatedManpowerPlanned: '' });
    expect(errors).toContain('Estimated Manpower Planned is required.');
  });

  it('requires Required Equipment Planned (the design correction replacing "Total Equipment Planned")', () => {
    const errors = validateErectionScheduleFormValues({ ...VALID_INPUT, requiredEquipmentPlanned: '' });
    expect(errors).toContain('Required Equipment Planned is required.');
  });

  it('requires Prepared By', () => {
    const errors = validateErectionScheduleFormValues({ ...VALID_INPUT, preparedBy: '' });
    expect(errors).toContain('Prepared By is required.');
  });

  it('rejects a Planned End Date before Planned Start Date', () => {
    const errors = validateErectionScheduleFormValues({ ...VALID_INPUT, plannedStartDate: '2026-10-30', plannedEndDate: '2026-09-25' });
    expect(errors).toContain('Planned End Date cannot be before Planned Start Date.');
  });

  it('collects every missing required field, not just the first', () => {
    const errors = validateErectionScheduleFormValues({
      scheduleReferenceNo: '', scheduleDate: '', plannedStartDate: '', plannedEndDate: '',
      jobOrderNo: '', erectionCrewTeam: '', estimatedManpowerPlanned: '', requiredEquipmentPlanned: '', preparedBy: '',
    });
    expect(errors).toHaveLength(9);
  });
});

describe('validateErectionScheduleHoldOrReturnRemarks', () => {
  it('requires Remarks', () => {
    expect(validateErectionScheduleHoldOrReturnRemarks('')).toContain('Remarks are required to place the schedule on Hold or Return it.');
  });

  it('rejects whitespace-only Remarks', () => {
    expect(validateErectionScheduleHoldOrReturnRemarks('   ')).toHaveLength(1);
  });

  it('accepts real Remarks text', () => {
    expect(validateErectionScheduleHoldOrReturnRemarks('Waiting on crane availability.')).toEqual([]);
  });
});

describe('computeDisplayStatus', () => {
  it('shows "Draft" when no record has been created yet', () => {
    expect(computeDisplayStatus(null, []).label).toBe('Draft');
  });

  it('shows "Ready to Issue" for a DRAFT record whose required fields are all already valid — a computed label, never a stored status', () => {
    expect(computeDisplayStatus('DRAFT', []).label).toBe('Ready to Issue');
  });

  it('shows plain "Draft" for a DRAFT record still missing required fields', () => {
    expect(computeDisplayStatus('DRAFT', ['Prepared By is required.']).label).toBe('Draft');
  });

  it('shows the real stored label for ISSUED regardless of validation state', () => {
    expect(computeDisplayStatus('ISSUED', []).label).toBe('Issued');
  });

  it('shows the real stored label for HOLD', () => {
    expect(computeDisplayStatus('HOLD', []).label).toBe('Hold');
  });

  it('shows the real stored label for RETURNED', () => {
    expect(computeDisplayStatus('RETURNED', []).label).toBe('Returned');
  });
});

describe('computePlannedDurationDays', () => {
  it('computes an inclusive day count between Planned Start and Planned End', () => {
    expect(computePlannedDurationDays('2026-09-25', '2026-09-25')).toBe(1);
    expect(computePlannedDurationDays('2026-09-25', '2026-09-26')).toBe(2);
    expect(computePlannedDurationDays('2026-09-25', '2026-10-30')).toBe(36);
  });

  it('returns null when either date is missing — never fabricates a duration', () => {
    expect(computePlannedDurationDays('', '2026-09-26')).toBeNull();
    expect(computePlannedDurationDays('2026-09-25', '')).toBeNull();
    expect(computePlannedDurationDays('', '')).toBeNull();
  });

  it('returns null for an invalid date string', () => {
    expect(computePlannedDurationDays('not-a-date', '2026-09-26')).toBeNull();
  });
});

describe('computeErectionStepTrackerCurrentStep', () => {
  it('stays on Step 2 until the approval reaches Approved', () => {
    expect(computeErectionStepTrackerCurrentStep(null, null)).toBe(2);
    expect(computeErectionStepTrackerCurrentStep('DRAFT_REVIEW', null)).toBe(2);
    expect(computeErectionStepTrackerCurrentStep('REVISION_REQUESTED', null)).toBe(2);
  });

  it('moves to Step 3 once approved and the schedule has not been issued yet', () => {
    expect(computeErectionStepTrackerCurrentStep('APPROVED', null)).toBe(3);
    expect(computeErectionStepTrackerCurrentStep('APPROVED', 'DRAFT')).toBe(3);
    expect(computeErectionStepTrackerCurrentStep('APPROVED', 'HOLD')).toBe(3);
  });

  it('moves to Step 4 once the schedule has been Issued', () => {
    expect(computeErectionStepTrackerCurrentStep('APPROVED', 'ISSUED')).toBe(4);
  });
});
