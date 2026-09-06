import { describe, it, expect } from 'vitest';
import {
  DOCUMENT_OBLIGATION_CATEGORY_LABELS,
  DOCUMENT_OBLIGATION_STATUS_LABELS,
  DOCUMENT_OBLIGATION_CATEGORY_OPTIONS,
  DOCUMENT_OBLIGATION_STATUS_OPTIONS,
  DOCUMENT_OBLIGATION_CATEGORY_FILTER_OPTIONS,
  DOCUMENT_OBLIGATION_STATUS_FILTER_OPTIONS,
  formatDaysRemaining,
  validateDocumentObligationFormValues,
  type DocumentObligationFormValidationInput,
} from './contract-document-obligation-helpers';

describe('DOCUMENT_OBLIGATION_CATEGORY_LABELS', () => {
  it('maps every real category to its manager-facing label', () => {
    expect(DOCUMENT_OBLIGATION_CATEGORY_LABELS.PERFORMANCE_BOND).toBe('Performance Bond');
    expect(DOCUMENT_OBLIGATION_CATEGORY_LABELS.INSURANCE).toBe('Insurance');
    expect(DOCUMENT_OBLIGATION_CATEGORY_LABELS.GUARANTEE).toBe('Guarantee');
    expect(DOCUMENT_OBLIGATION_CATEGORY_LABELS.TAX_STATUTORY).toBe('Tax / Statutory');
    expect(DOCUMENT_OBLIGATION_CATEGORY_LABELS.TECHNICAL_SUBMISSION).toBe('Technical Submission');
    expect(DOCUMENT_OBLIGATION_CATEGORY_LABELS.APPROVAL_DOCUMENT).toBe('Approval Document');
    expect(DOCUMENT_OBLIGATION_CATEGORY_LABELS.HEALTH_SAFETY).toBe('Health & Safety');
    expect(DOCUMENT_OBLIGATION_CATEGORY_LABELS.OTHER).toBe('Other');
  });

  it('never uses SAP/account/external-system wording', () => {
    for (const label of Object.values(DOCUMENT_OBLIGATION_CATEGORY_LABELS)) {
      expect(label).not.toMatch(/sap|account module|external/i);
    }
  });
});

describe('DOCUMENT_OBLIGATION_STATUS_LABELS', () => {
  it('maps every real status to its manager-facing label', () => {
    expect(DOCUMENT_OBLIGATION_STATUS_LABELS.PENDING).toBe('Pending');
    expect(DOCUMENT_OBLIGATION_STATUS_LABELS.SUBMITTED).toBe('Submitted');
    expect(DOCUMENT_OBLIGATION_STATUS_LABELS.EXPIRING_SOON).toBe('Expiring Soon');
    expect(DOCUMENT_OBLIGATION_STATUS_LABELS.EXPIRED_OVERDUE).toBe('Expired / Overdue');
    expect(DOCUMENT_OBLIGATION_STATUS_LABELS.NOT_REQUIRED).toBe('Not Required');
    expect(DOCUMENT_OBLIGATION_STATUS_LABELS.CANCELLED).toBe('Cancelled');
  });
});

describe('DOCUMENT_OBLIGATION_CATEGORY_OPTIONS / DOCUMENT_OBLIGATION_STATUS_OPTIONS', () => {
  it('have exactly the real enum values, no "All" entry', () => {
    expect(DOCUMENT_OBLIGATION_CATEGORY_OPTIONS).toHaveLength(8);
    expect(DOCUMENT_OBLIGATION_STATUS_OPTIONS).toHaveLength(6);
  });
});

describe('filter option lists', () => {
  it('include an "All Categories"/"All Status" option plus every real value', () => {
    expect(DOCUMENT_OBLIGATION_CATEGORY_FILTER_OPTIONS[0]).toEqual({ value: '', label: 'All Categories' });
    expect(DOCUMENT_OBLIGATION_CATEGORY_FILTER_OPTIONS).toHaveLength(9);
    expect(DOCUMENT_OBLIGATION_STATUS_FILTER_OPTIONS[0]).toEqual({ value: '', label: 'All Status' });
    expect(DOCUMENT_OBLIGATION_STATUS_FILTER_OPTIONS).toHaveLength(7);
  });
});

describe('formatDaysRemaining', () => {
  it('shows a negative number honestly for an overdue item', () => {
    expect(formatDaysRemaining(-15)).toBe('-15');
  });

  it('shows a positive number for a not-yet-due item', () => {
    expect(formatDaysRemaining(18)).toBe('18');
  });

  it('shows 0 on the due date itself', () => {
    expect(formatDaysRemaining(0)).toBe('0');
  });

  it('shows "—" when there is no date at all (never a fabricated number)', () => {
    expect(formatDaysRemaining(undefined)).toBe('—');
  });
});

describe('validateDocumentObligationFormValues', () => {
  function makeInput(overrides: Partial<DocumentObligationFormValidationInput> = {}): DocumentObligationFormValidationInput {
    return { title: 'Performance Bond', submissionDate: '', expiryDate: '', ...overrides };
  }

  it('a title-only item is valid (Required/Submission/Expiry Date are all optional)', () => {
    expect(validateDocumentObligationFormValues(makeInput())).toEqual([]);
  });

  it('requires Document / Obligation', () => {
    expect(validateDocumentObligationFormValues(makeInput({ title: '  ' }))).toContain('Document / Obligation is required.');
  });

  it('rejects an Expiry Date before the Submission Date', () => {
    const errors = validateDocumentObligationFormValues(makeInput({ submissionDate: '2026-08-10', expiryDate: '2026-08-05' }));
    expect(errors).toContain('Expiry Date cannot be before Submission Date.');
  });

  it('accepts an Expiry Date equal to the Submission Date', () => {
    const errors = validateDocumentObligationFormValues(makeInput({ submissionDate: '2026-08-10', expiryDate: '2026-08-10' }));
    expect(errors).not.toContain('Expiry Date cannot be before Submission Date.');
  });

  it('never rejects a Submission Date before the Required Date — documents can be submitted early (no such rule exists)', () => {
    // Required Date isn't even part of this validation input — confirming
    // the function has no rule connecting it to Submission Date at all.
    expect(validateDocumentObligationFormValues(makeInput({ submissionDate: '2020-01-01' }))).toEqual([]);
  });

  describe('CM-70E — test data scenarios', () => {
    it('Signed Contract Agreement: Required Date + Submission Date, no Expiry Date', () => {
      expect(validateDocumentObligationFormValues({
        title: 'Signed Contract Agreement', submissionDate: '2026-01-10', expiryDate: '',
      })).toEqual([]);
    });

    it('Performance Bond: Required Date, no Submission Date yet, Expiry Date', () => {
      expect(validateDocumentObligationFormValues({
        title: 'Performance Bond', submissionDate: '', expiryDate: '2027-01-15',
      })).toEqual([]);
    });

    it('Insurance Certificate: Required Date + Submission Date + Expiry Date', () => {
      expect(validateDocumentObligationFormValues({
        title: 'Insurance Certificate', submissionDate: '2026-02-01', expiryDate: '2027-02-01',
      })).toEqual([]);
    });

    it('Final Invoice: Required Date only, no Submission Date, no Expiry Date', () => {
      expect(validateDocumentObligationFormValues({ title: 'Final Invoice', submissionDate: '', expiryDate: '' })).toEqual([]);
    });

    it('Warranty Document: Required Date, no Submission Date, Expiry Date', () => {
      expect(validateDocumentObligationFormValues({
        title: 'Warranty Document', submissionDate: '', expiryDate: '2028-01-01',
      })).toEqual([]);
    });
  });
});
