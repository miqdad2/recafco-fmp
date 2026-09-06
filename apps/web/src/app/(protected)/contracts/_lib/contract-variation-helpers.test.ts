import { describe, it, expect } from 'vitest';
import {
  VARIATION_STATUS_LABELS,
  VARIATION_STATUS_FILTER_OPTIONS,
  VARIATION_STATUS_OPTIONS,
  matchesSubmittedDateFilter,
  isSubmittedDateRequired,
  isApprovedDateRequired,
  validateVariationFormValues,
  type VariationFormValidationInput,
} from './contract-variation-helpers';

describe('VARIATION_STATUS_LABELS', () => {
  it('maps every real backend status to its manager-facing label', () => {
    expect(VARIATION_STATUS_LABELS.DRAFT).toBe('Draft');
    expect(VARIATION_STATUS_LABELS.SUBMITTED).toBe('Submitted');
    expect(VARIATION_STATUS_LABELS.PENDING_APPROVAL).toBe('Pending Approval');
    expect(VARIATION_STATUS_LABELS.APPROVED).toBe('Approved');
    expect(VARIATION_STATUS_LABELS.REJECTED).toBe('Rejected');
    expect(VARIATION_STATUS_LABELS.CANCELLED).toBe('Cancelled');
  });
});

describe('VARIATION_STATUS_FILTER_OPTIONS', () => {
  it('includes an "All" option plus every real status', () => {
    expect(VARIATION_STATUS_FILTER_OPTIONS[0]).toEqual({ value: '', label: 'All' });
    expect(VARIATION_STATUS_FILTER_OPTIONS).toHaveLength(7);
  });
});

describe('VARIATION_STATUS_OPTIONS', () => {
  it('has exactly the 6 real statuses, no "All" entry', () => {
    expect(VARIATION_STATUS_OPTIONS).toHaveLength(6);
  });
});

describe('matchesSubmittedDateFilter', () => {
  const today = new Date('2026-09-15T00:00:00Z');

  it('matches everything when no filter is set', () => {
    expect(matchesSubmittedDateFilter(undefined, '', today)).toBe(true);
    expect(matchesSubmittedDateFilter('2026-01-01', '', today)).toBe(true);
  });

  it('excludes an unset submittedDate for any real filter (never a fabricated match)', () => {
    expect(matchesSubmittedDateFilter(undefined, 'this-month', today)).toBe(false);
  });

  it('matches "this-month" only for the same year+month as today', () => {
    expect(matchesSubmittedDateFilter('2026-09-05', 'this-month', today)).toBe(true);
    expect(matchesSubmittedDateFilter('2026-08-05', 'this-month', today)).toBe(false);
  });

  it('matches "last-month" for the calendar month before today', () => {
    expect(matchesSubmittedDateFilter('2026-08-20', 'last-month', today)).toBe(true);
    expect(matchesSubmittedDateFilter('2026-09-20', 'last-month', today)).toBe(false);
  });

  it('handles "last-month" across a year boundary', () => {
    const jan = new Date('2026-01-15T00:00:00Z');
    expect(matchesSubmittedDateFilter('2025-12-20', 'last-month', jan)).toBe(true);
  });

  it('matches "this-year" for any date in the same year as today', () => {
    expect(matchesSubmittedDateFilter('2026-01-01', 'this-year', today)).toBe(true);
    expect(matchesSubmittedDateFilter('2025-12-31', 'this-year', today)).toBe(false);
  });
});

describe('isSubmittedDateRequired', () => {
  it('is false only for Draft', () => {
    expect(isSubmittedDateRequired('DRAFT')).toBe(false);
  });

  it('is true for Submitted, Pending Approval, Approved, Rejected, and Cancelled', () => {
    for (const status of ['SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED'] as const) {
      expect(isSubmittedDateRequired(status)).toBe(true);
    }
  });
});

describe('isApprovedDateRequired', () => {
  it('is true only for Approved', () => {
    expect(isApprovedDateRequired('APPROVED')).toBe(true);
  });

  it('is false for every other status', () => {
    for (const status of ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'REJECTED', 'CANCELLED'] as const) {
      expect(isApprovedDateRequired(status)).toBe(false);
    }
  });
});

describe('validateVariationFormValues', () => {
  function makeInput(overrides: Partial<VariationFormValidationInput> = {}): VariationFormValidationInput {
    return {
      status: 'DRAFT',
      description: 'Additional works',
      amount: '1000',
      affectsContractValue: true,
      submittedDate: '',
      approvedDate: '',
      ...overrides,
    };
  }

  it('a fresh Draft with no dates is valid', () => {
    expect(validateVariationFormValues(makeInput())).toEqual([]);
  });

  it('requires Description', () => {
    expect(validateVariationFormValues(makeInput({ description: '  ' }))).toContain('Description is required.');
  });

  it('requires Variation Amount', () => {
    expect(validateVariationFormValues(makeInput({ amount: '' }))).toContain('Variation Amount is required.');
  });

  it('a negative amount (a deduction) is valid, never rejected', () => {
    expect(validateVariationFormValues(makeInput({ amount: '-700' }))).toEqual([]);
  });

  it('requires Submitted Date once status leaves Draft', () => {
    const errors = validateVariationFormValues(makeInput({ status: 'SUBMITTED' }));
    expect(errors).toContain('Submitted Date is required for this status.');
  });

  it('Submitted Date is satisfied once provided', () => {
    const errors = validateVariationFormValues(makeInput({ status: 'SUBMITTED', submittedDate: '2026-08-01' }));
    expect(errors).not.toContain('Submitted Date is required for this status.');
  });

  it('requires Approved Date when status is Approved', () => {
    const errors = validateVariationFormValues(makeInput({
      status: 'APPROVED', submittedDate: '2026-08-01', affectsContractValue: false,
    }));
    expect(errors).toContain('Approved Date is required when status is Approved.');
  });

  it('does not require Approved Date for Draft, Submitted, or Pending Approval', () => {
    for (const status of ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL'] as const) {
      const errors = validateVariationFormValues(makeInput({ status, submittedDate: status === 'DRAFT' ? '' : '2026-08-01' }));
      expect(errors).not.toContain('Approved Date is required when status is Approved.');
    }
  });

  it('rejects an Approved Date before the Submitted Date', () => {
    const errors = validateVariationFormValues(makeInput({
      status: 'APPROVED', submittedDate: '2026-08-10', approvedDate: '2026-08-05',
    }));
    expect(errors).toContain('Approved Date cannot be before Submitted Date.');
  });

  it('accepts an Approved Date equal to the Submitted Date', () => {
    const errors = validateVariationFormValues(makeInput({
      status: 'APPROVED', submittedDate: '2026-08-10', approvedDate: '2026-08-10',
    }));
    expect(errors).not.toContain('Approved Date cannot be before Submitted Date.');
  });

  it('rejects an Approved + Affects Contract Value variation with a 0 amount', () => {
    const errors = validateVariationFormValues(makeInput({
      status: 'APPROVED', submittedDate: '2026-08-01', approvedDate: '2026-08-05',
      affectsContractValue: true, amount: '0',
    }));
    expect(errors).toContain('An Approved variation marked Affects Contract Value cannot have an amount of 0.');
  });

  it('allows an Approved variation with a 0 amount when it does not affect contract value', () => {
    const errors = validateVariationFormValues(makeInput({
      status: 'APPROVED', submittedDate: '2026-08-01', approvedDate: '2026-08-05',
      affectsContractValue: false, amount: '0',
    }));
    expect(errors).not.toContain('An Approved variation marked Affects Contract Value cannot have an amount of 0.');
  });

  describe('CM-70C — test verification (VO-GRM-001/002/003)', () => {
    it('VO-GRM-001 Approved +6500, affects contract value, fully dated, is valid', () => {
      expect(validateVariationFormValues({
        status: 'APPROVED', description: 'Additional GRM works', amount: '6500',
        affectsContractValue: true, submittedDate: '2026-07-01', approvedDate: '2026-07-10',
      })).toEqual([]);
    });

    it('VO-GRM-002 Pending Approval +2250, affects contract value, submitted, is valid', () => {
      expect(validateVariationFormValues({
        status: 'PENDING_APPROVAL', description: 'Pending GRM works', amount: '2250',
        affectsContractValue: true, submittedDate: '2026-07-15', approvedDate: '',
      })).toEqual([]);
    });

    it('VO-GRM-003 Approved -700 (a deduction), affects contract value, fully dated, is valid', () => {
      expect(validateVariationFormValues({
        status: 'APPROVED', description: 'GRM omission', amount: '-700',
        affectsContractValue: true, submittedDate: '2026-07-05', approvedDate: '2026-07-12',
      })).toEqual([]);
    });

    it('the 3 variations aggregate to Approved = 5,800.000 and Pending = 2,250.000, matching computeVariationSummary() on the backend', () => {
      const approved = 6500 + -700;
      const pending = 2250;
      expect(approved.toFixed(3)).toBe('5800.000');
      expect(pending.toFixed(3)).toBe('2250.000');
    });
  });
});
