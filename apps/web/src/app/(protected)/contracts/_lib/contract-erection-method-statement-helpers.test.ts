import { describe, it, expect } from 'vitest';
import {
  ERECTION_METHOD_STATEMENT_STATUS_LABELS,
  ERECTION_WORKFLOW_STEPS,
  validateErectionMethodStatementFormValues,
  computeDisplayStatus,
  type ErectionMethodStatementFormValidationInput,
} from './contract-erection-method-statement-helpers';

const VALID_INPUT: ErectionMethodStatementFormValidationInput = {
  plannedIssueDate: '2026-09-18',
  methodStatementRefNo: 'EMS-GRM-001',
  jobOrderNo: 'JO-004/26',
  workLocationYard: 'Site - Boundary Wall Zone A',
  preparedBy: 'Site Engineer',
  departmentArea: 'Site - Erection',
  scopeDescription: 'Covers the erection sequence, manpower, equipment and safety controls.',
};

describe('ERECTION_METHOD_STATEMENT_STATUS_LABELS', () => {
  it('maps every real backend status to its manager-facing label', () => {
    expect(ERECTION_METHOD_STATEMENT_STATUS_LABELS.DRAFT).toBe('Draft');
    expect(ERECTION_METHOD_STATEMENT_STATUS_LABELS.SUBMITTED_FOR_APPROVAL).toBe('Submitted for Approval');
    expect(ERECTION_METHOD_STATEMENT_STATUS_LABELS.ISSUED).toBe('Issued');
  });
});

describe('ERECTION_WORKFLOW_STEPS', () => {
  it('has exactly 7 steps in the approved order, Step 1 first', () => {
    expect(ERECTION_WORKFLOW_STEPS).toHaveLength(7);
    expect(ERECTION_WORKFLOW_STEPS[0]).toEqual({ step: 1, label: 'Issue Erection Method Statement' });
    expect(ERECTION_WORKFLOW_STEPS[6]).toEqual({ step: 7, label: 'Payment Issued' });
  });

  it('uses "Issue Erection Method Statement", never "Issued of Erection Method Statement"', () => {
    expect(ERECTION_WORKFLOW_STEPS[0]?.label).toBe('Issue Erection Method Statement');
  });
});

describe('validateErectionMethodStatementFormValues', () => {
  it('returns no errors when every required field is filled in', () => {
    expect(validateErectionMethodStatementFormValues(VALID_INPUT)).toEqual([]);
  });

  it('requires Planned Issue Date', () => {
    const errors = validateErectionMethodStatementFormValues({ ...VALID_INPUT, plannedIssueDate: '' });
    expect(errors).toContain('Planned Issue Date is required.');
  });

  it('requires Method Statement Ref. No.', () => {
    const errors = validateErectionMethodStatementFormValues({ ...VALID_INPUT, methodStatementRefNo: '  ' });
    expect(errors).toContain('Method Statement Ref. No. is required.');
  });

  it('requires Job Order No. (the design correction replacing "Erection Package / Area")', () => {
    const errors = validateErectionMethodStatementFormValues({ ...VALID_INPUT, jobOrderNo: '' });
    expect(errors).toContain('Job Order No. is required.');
  });

  it('requires Work Location / Yard', () => {
    const errors = validateErectionMethodStatementFormValues({ ...VALID_INPUT, workLocationYard: '' });
    expect(errors).toContain('Work Location / Yard is required.');
  });

  it('requires Prepared By', () => {
    const errors = validateErectionMethodStatementFormValues({ ...VALID_INPUT, preparedBy: '' });
    expect(errors).toContain('Prepared By is required.');
  });

  it('requires Responsible Department / Team', () => {
    const errors = validateErectionMethodStatementFormValues({ ...VALID_INPUT, departmentArea: '' });
    expect(errors).toContain('Responsible Department / Team is required.');
  });

  it('requires Scope / Description', () => {
    const errors = validateErectionMethodStatementFormValues({ ...VALID_INPUT, scopeDescription: '   ' });
    expect(errors).toContain('Scope / Description is required.');
  });

  it('collects every missing required field, not just the first', () => {
    const errors = validateErectionMethodStatementFormValues({
      plannedIssueDate: '',
      methodStatementRefNo: '',
      jobOrderNo: '',
      workLocationYard: '',
      preparedBy: '',
      departmentArea: '',
      scopeDescription: '',
    });
    expect(errors).toHaveLength(7);
  });
});

describe('computeDisplayStatus', () => {
  it('shows "Draft" when no record has been created yet', () => {
    const result = computeDisplayStatus(null, []);
    expect(result.label).toBe('Draft');
  });

  it('shows "Ready to Issue" for a DRAFT record whose required fields are all already valid — a computed label, never a stored status', () => {
    const result = computeDisplayStatus('DRAFT', []);
    expect(result.label).toBe('Ready to Issue');
  });

  it('shows plain "Draft" for a DRAFT record still missing required fields', () => {
    const result = computeDisplayStatus('DRAFT', ['Scope / Description is required.']);
    expect(result.label).toBe('Draft');
  });

  it('shows the real stored label for SUBMITTED_FOR_APPROVAL regardless of validation state', () => {
    const result = computeDisplayStatus('SUBMITTED_FOR_APPROVAL', []);
    expect(result.label).toBe('Submitted for Approval');
  });

  it('shows the real stored label for ISSUED regardless of validation state', () => {
    const result = computeDisplayStatus('ISSUED', []);
    expect(result.label).toBe('Issued');
  });
});
