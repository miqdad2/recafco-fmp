import { describe, it, expect } from 'vitest';
import {
  ERECTION_START_STATUS_LABELS,
  ERECTION_START_CHECKLIST_STATUS_LABELS,
  ERECTION_START_DEFAULT_MANPOWER_TRADES,
  ERECTION_START_CHECKLIST_ITEMS,
  validateErectionStartFormValues,
  validateErectionStartHoldOrReturnComments,
  validateErectionStartConfirmRequirements,
  computeDisplayStatus,
  computeResourcesSummaryPreview,
  computeErectionStepTrackerCurrentStep,
  type ErectionStartFormValidationInput,
  type ErectionStartManpowerFormRow,
} from './contract-erection-start-helpers';

const VALID_INPUT: ErectionStartFormValidationInput = {
  workLocationYard: 'GRM Site - Boundary Wall Zone A',
  erectionCrewTeam: 'Erection Crew A',
  supervisor: 'Site Supervisor',
  scopeOfWorkToday: 'Start erection of precast boundary wall panels in Zone A.',
};

describe('ERECTION_START_STATUS_LABELS', () => {
  it('maps every real backend status to its manager-facing label', () => {
    expect(ERECTION_START_STATUS_LABELS.DRAFT).toBe('Draft');
    expect(ERECTION_START_STATUS_LABELS.STARTED).toBe('Started');
    expect(ERECTION_START_STATUS_LABELS.HOLD).toBe('Hold');
    expect(ERECTION_START_STATUS_LABELS.RETURNED).toBe('Returned');
  });
});

describe('ERECTION_START_CHECKLIST_STATUS_LABELS / ERECTION_START_CHECKLIST_ITEMS / ERECTION_START_DEFAULT_MANPOWER_TRADES', () => {
  it('covers all 3 real checklist statuses', () => {
    expect(ERECTION_START_CHECKLIST_STATUS_LABELS.PENDING).toBe('Pending');
    expect(ERECTION_START_CHECKLIST_STATUS_LABELS.COMPLETED).toBe('Completed');
    expect(ERECTION_START_CHECKLIST_STATUS_LABELS.NOT_APPLICABLE).toBe('Not Applicable');
  });

  it('has exactly the 10 checklist items this unit specifies, in order', () => {
    expect(ERECTION_START_CHECKLIST_ITEMS).toEqual([
      'Method Statement Reviewed', 'Erection Schedule Reviewed', 'Delivery Confirmed', 'Site Access Confirmed',
      'Crane / Trailer Arranged', 'Tools & Tackles Checked', 'Manpower Available', 'Pre-Erection Meeting Conducted',
      'Weather Acceptable', 'Work Area Ready',
    ]);
  });

  it('has exactly the 10 default manpower trades this unit specifies, in order', () => {
    expect(ERECTION_START_DEFAULT_MANPOWER_TRADES).toEqual([
      'Rigger', 'Mason', 'Welder', 'Foreman', 'Helper', 'Carpenter', 'Steel Fixer', 'Crane Operator', 'Trailer Driver', 'Other',
    ]);
  });
});

describe('validateErectionStartFormValues', () => {
  it('returns no errors when every required field is filled in', () => {
    expect(validateErectionStartFormValues(VALID_INPUT)).toEqual([]);
  });

  it('requires Work Location / Yard', () => {
    expect(validateErectionStartFormValues({ ...VALID_INPUT, workLocationYard: '' })).toContain('Work Location / Yard is required.');
  });

  it('requires Erection Crew / Team', () => {
    expect(validateErectionStartFormValues({ ...VALID_INPUT, erectionCrewTeam: '  ' })).toContain('Erection Crew / Team is required.');
  });

  it('requires Supervisor', () => {
    expect(validateErectionStartFormValues({ ...VALID_INPUT, supervisor: '' })).toContain('Supervisor is required.');
  });

  it('requires Scope of Work Today', () => {
    expect(validateErectionStartFormValues({ ...VALID_INPUT, scopeOfWorkToday: '' })).toContain('Scope of Work Today is required.');
  });

  it('collects every missing required field, not just the first', () => {
    const errors = validateErectionStartFormValues({ workLocationYard: '', erectionCrewTeam: '', supervisor: '', scopeOfWorkToday: '' });
    expect(errors).toHaveLength(4);
  });
});

describe('validateErectionStartHoldOrReturnComments', () => {
  it('requires comments', () => {
    expect(validateErectionStartHoldOrReturnComments('')).toContain('Comments are required to place erection start on Hold or Return it.');
  });

  it('rejects whitespace-only comments', () => {
    expect(validateErectionStartHoldOrReturnComments('   ')).toHaveLength(1);
  });

  it('accepts real comments text', () => {
    expect(validateErectionStartHoldOrReturnComments('Crane arrival delayed.')).toEqual([]);
  });
});

describe('validateErectionStartConfirmRequirements', () => {
  const zeroRow: ErectionStartManpowerFormRow = { trade: 'Rigger', plannedNos: '2', actualDeployedNos: '0', remarks: '' };
  const positiveRow: ErectionStartManpowerFormRow = { trade: 'Mason', plannedNos: '3', actualDeployedNos: '3', remarks: '' };

  it('requires Actual Start Date / Time', () => {
    expect(validateErectionStartConfirmRequirements('', [positiveRow])).toContain('Actual Start Date / Time is required to confirm Erection Start.');
  });

  it('requires at least one manpower row with a positive Actual Deployed count', () => {
    expect(validateErectionStartConfirmRequirements('2026-11-01T08:30', [zeroRow])).toContain(
      'At least one manpower/work activity row must have Actual Deployed Nos. greater than 0.',
    );
    expect(validateErectionStartConfirmRequirements('2026-11-01T08:30', [])).toContain(
      'At least one manpower/work activity row must have Actual Deployed Nos. greater than 0.',
    );
  });

  it('returns no errors when both requirements are met', () => {
    expect(validateErectionStartConfirmRequirements('2026-11-01T08:30', [zeroRow, positiveRow])).toEqual([]);
  });
});

describe('computeDisplayStatus', () => {
  it('shows "Draft" when no record has been created yet', () => {
    expect(computeDisplayStatus(null, []).label).toBe('Draft');
  });

  it('shows "Ready to Start" for a DRAFT record whose required fields are all already valid — a computed label, never a stored status', () => {
    expect(computeDisplayStatus('DRAFT', []).label).toBe('Ready to Start');
  });

  it('shows plain "Draft" for a DRAFT record still missing required fields', () => {
    expect(computeDisplayStatus('DRAFT', ['Supervisor is required.']).label).toBe('Draft');
  });

  it('shows the real stored label for STARTED regardless of validation state', () => {
    expect(computeDisplayStatus('STARTED', []).label).toBe('Started');
  });

  it('shows the real stored label for HOLD', () => {
    expect(computeDisplayStatus('HOLD', []).label).toBe('Hold');
  });

  it('shows the real stored label for RETURNED', () => {
    expect(computeDisplayStatus('RETURNED', []).label).toBe('Returned');
  });
});

describe('computeResourcesSummaryPreview', () => {
  it('returns all-zero for empty rows — never fabricates a total', () => {
    expect(computeResourcesSummaryPreview({ manpowerRows: [], equipmentRows: [] })).toEqual({
      totalManpower: 0, totalEquipment: 0, craneAssigned: 0, trailerAssigned: 0,
    });
  });

  it('matches the unit demo data exactly', () => {
    const manpowerRows = [
      { actualDeployedNos: '1' }, { actualDeployedNos: '2' }, { actualDeployedNos: '3' }, { actualDeployedNos: '1' },
      { actualDeployedNos: '6' }, { actualDeployedNos: '2' }, { actualDeployedNos: '2' }, { actualDeployedNos: '1' },
      { actualDeployedNos: '1' }, { actualDeployedNos: '0' },
    ];
    const equipmentRows = [
      { equipmentType: 'Crane', assignedQty: '1' },
      { equipmentType: 'Trailer', assignedQty: '1' },
      { equipmentType: 'Tools & Tackles', assignedQty: '1' },
      { equipmentType: 'Rental Equipment', assignedQty: '1' },
    ];
    expect(computeResourcesSummaryPreview({ manpowerRows, equipmentRows })).toEqual({
      totalManpower: 19, totalEquipment: 4, craneAssigned: 1, trailerAssigned: 1,
    });
  });

  it('matches Crane/Trailer case-insensitively by substring, since equipmentType is free text', () => {
    const equipmentRows = [
      { equipmentType: '50T Mobile Crane', assignedQty: '1' },
      { equipmentType: 'flatbed trailer', assignedQty: '2' },
      { equipmentType: 'Manlift', assignedQty: '1' },
    ];
    expect(computeResourcesSummaryPreview({ manpowerRows: [], equipmentRows })).toEqual({
      totalManpower: 0, totalEquipment: 4, craneAssigned: 1, trailerAssigned: 1,
    });
  });
});

describe('computeErectionStepTrackerCurrentStep', () => {
  it('stays on Step 4 until delivery reaches Started', () => {
    expect(computeErectionStepTrackerCurrentStep(null, null)).toBe(4);
    expect(computeErectionStepTrackerCurrentStep('DRAFT', null)).toBe(4);
    expect(computeErectionStepTrackerCurrentStep('HOLD', null)).toBe(4);
  });

  it('moves to Step 5 once delivery is Started and erection has not Started yet', () => {
    expect(computeErectionStepTrackerCurrentStep('STARTED', null)).toBe(5);
    expect(computeErectionStepTrackerCurrentStep('STARTED', 'DRAFT')).toBe(5);
    expect(computeErectionStepTrackerCurrentStep('STARTED', 'HOLD')).toBe(5);
  });

  it('moves to Step 6 once erection has Started', () => {
    expect(computeErectionStepTrackerCurrentStep('STARTED', 'STARTED')).toBe(6);
  });
});
