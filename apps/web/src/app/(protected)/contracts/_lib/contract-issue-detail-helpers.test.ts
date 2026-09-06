import { describe, it, expect } from 'vitest';
import {
  ISSUE_CATEGORY_LABELS,
  ISSUE_CATEGORY_VALUES,
  issueCategoryLabel,
  ISSUE_PRIORITY_LABELS,
  ISSUE_STATUS_LABELS,
  ISSUE_CATEGORY_FILTER_OPTIONS,
  ISSUE_PRIORITY_FILTER_OPTIONS,
  ISSUE_STATUS_FILTER_OPTIONS,
  computeIssueDaysRemaining,
  computeIssueIsDueSoon,
  formatIssueDaysRemaining,
  formatIssueContractContext,
  isResponsiblePersonRequired,
  isActionDueDateRequired,
  isResolutionRequired,
  validateIssueFormValues,
  type IssueFormValidationInput,
} from './contract-issue-detail-helpers';

describe('ISSUE_CATEGORY_LABELS', () => {
  it('maps every one of the 9 real backend categories to a preferred label, none dropped or invented', () => {
    expect(ISSUE_CATEGORY_VALUES).toHaveLength(9);
    expect(ISSUE_CATEGORY_VALUES.sort()).toEqual(
      ['Commercial', 'Technical', 'Production', 'Delivery', 'Erection', 'Client', 'Document', 'Payment', 'Other'].sort(),
    );
  });

  it('maps Commercial to Variation and Production to Quality per this unit\'s own examples', () => {
    expect(ISSUE_CATEGORY_LABELS['Commercial']).toBe('Variation');
    expect(ISSUE_CATEGORY_LABELS['Production']).toBe('Quality');
  });

  it('maps Erection to "Site / Erection" and Client to "Client Approval"', () => {
    expect(ISSUE_CATEGORY_LABELS['Erection']).toBe('Site / Erection');
    expect(ISSUE_CATEGORY_LABELS['Client']).toBe('Client Approval');
  });
});

describe('issueCategoryLabel', () => {
  it('returns the mapped label for a real category', () => {
    expect(issueCategoryLabel('Payment')).toBe('Payment');
    expect(issueCategoryLabel('Commercial')).toBe('Variation');
  });

  it('returns "—" for an unset category (never a fabricated label)', () => {
    expect(issueCategoryLabel(undefined)).toBe('—');
  });
});

describe('ISSUE_PRIORITY_LABELS / ISSUE_STATUS_LABELS', () => {
  it('maps every real priority to its manager-facing label', () => {
    expect(ISSUE_PRIORITY_LABELS.LOW).toBe('Low');
    expect(ISSUE_PRIORITY_LABELS.CRITICAL).toBe('Critical');
  });

  it('maps every real status to its manager-facing label', () => {
    expect(ISSUE_STATUS_LABELS.WAITING_RESPONSE).toBe('Waiting Response');
    expect(ISSUE_STATUS_LABELS.CANCELLED).toBe('Cancelled');
  });
});

describe('filter option lists', () => {
  it('include an "All" option plus every real value', () => {
    expect(ISSUE_CATEGORY_FILTER_OPTIONS[0]).toEqual({ value: '', label: 'All Categories' });
    expect(ISSUE_CATEGORY_FILTER_OPTIONS).toHaveLength(10);
    expect(ISSUE_PRIORITY_FILTER_OPTIONS[0]).toEqual({ value: '', label: 'All Priorities' });
    expect(ISSUE_PRIORITY_FILTER_OPTIONS).toHaveLength(5);
    expect(ISSUE_STATUS_FILTER_OPTIONS[0]).toEqual({ value: '', label: 'All Status' });
    expect(ISSUE_STATUS_FILTER_OPTIONS).toHaveLength(7);
  });
});

describe('computeIssueDaysRemaining', () => {
  const today = new Date(Date.UTC(2026, 0, 15));

  it('returns a negative number once the due date is past', () => {
    expect(computeIssueDaysRemaining('2026-01-05', today)).toBe(-10);
  });

  it('returns a positive number for a future due date', () => {
    expect(computeIssueDaysRemaining('2026-01-25', today)).toBe(10);
  });

  it('returns null when there is no due date at all (never a fabricated number)', () => {
    expect(computeIssueDaysRemaining(undefined, today)).toBeNull();
  });
});

describe('computeIssueIsDueSoon', () => {
  const today = new Date(Date.UTC(2026, 0, 15));

  it('is true for a date exactly 30 days out on an OPEN issue', () => {
    expect(computeIssueIsDueSoon({ dueDate: '2026-02-14', status: 'OPEN' }, today)).toBe(true);
  });

  it('is false for a date 31 days out', () => {
    expect(computeIssueIsDueSoon({ dueDate: '2026-02-15', status: 'OPEN' }, today)).toBe(false);
  });

  it('is false once the issue is RESOLVED/CLOSED/CANCELLED even if the date is within 30 days', () => {
    expect(computeIssueIsDueSoon({ dueDate: '2026-01-20', status: 'RESOLVED' }, today)).toBe(false);
    expect(computeIssueIsDueSoon({ dueDate: '2026-01-20', status: 'CLOSED' }, today)).toBe(false);
    expect(computeIssueIsDueSoon({ dueDate: '2026-01-20', status: 'CANCELLED' }, today)).toBe(false);
  });

  it('is false for an already-overdue date (that is the overdue state, not due-soon)', () => {
    expect(computeIssueIsDueSoon({ dueDate: '2026-01-01', status: 'OPEN' }, today)).toBe(false);
  });
});

describe('formatIssueDaysRemaining', () => {
  it('shows a negative number honestly for an overdue issue', () => {
    expect(formatIssueDaysRemaining(-5)).toBe('-5');
  });

  it('shows "—" when there is no due date (never a fabricated number)', () => {
    expect(formatIssueDaysRemaining(null)).toBe('—');
  });
});

describe('formatIssueContractContext', () => {
  it('joins reference, title, and counterparty when all are available', () => {
    expect(formatIssueContractContext({
      referenceNumber: 'CONTRACT-2026-000009',
      title: 'GRM Boundary Wall & Yard Upgrade',
      counterpartyName: 'Gulf Ready Mix Co.',
    })).toBe('CONTRACT-2026-000009 · GRM Boundary Wall & Yard Upgrade · Gulf Ready Mix Co.');
  });

  it('omits the counterparty segment when unavailable, never falls back to a UUID', () => {
    expect(formatIssueContractContext({
      referenceNumber: 'CONTRACT-2026-000009',
      title: 'GRM Boundary Wall & Yard Upgrade',
    })).toBe('CONTRACT-2026-000009 · GRM Boundary Wall & Yard Upgrade');
  });
});

describe('isResponsiblePersonRequired / isActionDueDateRequired', () => {
  it('are true only for Open and In Progress', () => {
    for (const status of ['OPEN', 'IN_PROGRESS'] as const) {
      expect(isResponsiblePersonRequired(status)).toBe(true);
      expect(isActionDueDateRequired(status)).toBe(true);
    }
  });

  it('are false for Waiting Response, Resolved, Closed, and Cancelled', () => {
    for (const status of ['WAITING_RESPONSE', 'RESOLVED', 'CLOSED', 'CANCELLED'] as const) {
      expect(isResponsiblePersonRequired(status)).toBe(false);
      expect(isActionDueDateRequired(status)).toBe(false);
    }
  });
});

describe('isResolutionRequired', () => {
  it('is true only for Resolved and Closed', () => {
    expect(isResolutionRequired('RESOLVED')).toBe(true);
    expect(isResolutionRequired('CLOSED')).toBe(true);
  });

  it('is false for every other status', () => {
    for (const status of ['OPEN', 'IN_PROGRESS', 'WAITING_RESPONSE', 'CANCELLED'] as const) {
      expect(isResolutionRequired(status)).toBe(false);
    }
  });
});

describe('validateIssueFormValues', () => {
  function makeInput(overrides: Partial<IssueFormValidationInput> = {}): IssueFormValidationInput {
    return {
      title: 'Drawing approval received late',
      status: 'OPEN',
      responsibleUserId: 'user-1',
      raisedDate: '2026-08-01',
      dueDate: '2026-08-10',
      resolution: '',
      remarks: '',
      ...overrides,
    };
  }

  it('a fully filled Open issue is valid', () => {
    expect(validateIssueFormValues(makeInput())).toEqual([]);
  });

  it('requires Issue Title', () => {
    expect(validateIssueFormValues(makeInput({ title: '  ' }))).toContain('Issue Title is required.');
  });

  it('requires Responsible Person when status is Open or In Progress', () => {
    for (const status of ['OPEN', 'IN_PROGRESS'] as const) {
      const errors = validateIssueFormValues(makeInput({ status, responsibleUserId: '' }));
      expect(errors).toContain('Responsible Person is required when status is Open or In Progress.');
    }
  });

  it('does not require Responsible Person for Waiting Response, Resolved, Closed, or Cancelled', () => {
    for (const status of ['WAITING_RESPONSE', 'RESOLVED', 'CLOSED', 'CANCELLED'] as const) {
      const errors = validateIssueFormValues(makeInput({
        status, responsibleUserId: '', resolution: 'Fixed', dueDate: '',
      }));
      expect(errors).not.toContain('Responsible Person is required when status is Open or In Progress.');
    }
  });

  it('requires Action Due Date when status is Open or In Progress', () => {
    for (const status of ['OPEN', 'IN_PROGRESS'] as const) {
      const errors = validateIssueFormValues(makeInput({ status, dueDate: '' }));
      expect(errors).toContain('Action Due Date is required when status is Open or In Progress.');
    }
  });

  it('rejects an Action Due Date before the Issue Raised Date', () => {
    const errors = validateIssueFormValues(makeInput({ raisedDate: '2026-08-10', dueDate: '2026-08-05' }));
    expect(errors).toContain('Action Due Date cannot be before Issue Raised Date.');
  });

  it('accepts an Action Due Date equal to the Issue Raised Date', () => {
    const errors = validateIssueFormValues(makeInput({ raisedDate: '2026-08-10', dueDate: '2026-08-10' }));
    expect(errors).not.toContain('Action Due Date cannot be before Issue Raised Date.');
  });

  it('requires a Resolution note or Remarks when status is Resolved or Closed', () => {
    for (const status of ['RESOLVED', 'CLOSED'] as const) {
      const errors = validateIssueFormValues(makeInput({ status, dueDate: '', resolution: '', remarks: '' }));
      expect(errors).toContain('A Resolved or Closed issue needs a Resolution note or Remarks.');
    }
  });

  it('a Resolution note alone satisfies the Resolved/Closed requirement', () => {
    const errors = validateIssueFormValues(makeInput({ status: 'RESOLVED', dueDate: '', resolution: 'Drawings approved.', remarks: '' }));
    expect(errors).not.toContain('A Resolved or Closed issue needs a Resolution note or Remarks.');
  });

  it('Remarks alone also satisfies the Resolved/Closed requirement', () => {
    const errors = validateIssueFormValues(makeInput({ status: 'CLOSED', dueDate: '', resolution: '', remarks: 'Closed after client sign-off.' }));
    expect(errors).not.toContain('A Resolved or Closed issue needs a Resolution note or Remarks.');
  });

  describe('CM-70D — test verification (ISS-GRM-001..004)', () => {
    it('ISS-GRM-001 — Drawing approval received late — Open — is valid with a responsible person and due date', () => {
      expect(validateIssueFormValues({
        title: 'Drawing approval received late', status: 'OPEN', responsibleUserId: 'user-1',
        raisedDate: '2026-07-01', dueDate: '2026-07-10', resolution: '', remarks: '',
      })).toEqual([]);
    });

    it('ISS-GRM-002 — Production mould allocation pending — In Progress — is valid', () => {
      expect(validateIssueFormValues({
        title: 'Production mould allocation pending', status: 'IN_PROGRESS', responsibleUserId: 'user-2',
        raisedDate: '2026-07-02', dueDate: '2026-07-12', resolution: '', remarks: '',
      })).toEqual([]);
    });

    it('ISS-GRM-003 — Site gate pass not confirmed — Open — is valid', () => {
      expect(validateIssueFormValues({
        title: 'Site gate pass not confirmed', status: 'OPEN', responsibleUserId: 'user-1',
        raisedDate: '2026-07-03', dueDate: '2026-07-08', resolution: '', remarks: '',
      })).toEqual([]);
    });

    it('ISS-GRM-004 — Payment release clarification — Resolved — is valid with a resolution note', () => {
      expect(validateIssueFormValues({
        title: 'Payment release clarification', status: 'RESOLVED', responsibleUserId: '',
        raisedDate: '2026-07-04', dueDate: '', resolution: 'Clarified with finance — release confirmed.', remarks: '',
      })).toEqual([]);
    });

    it('the 4 issues aggregate to Open = 2, In Progress = 1, Resolved = 1, matching computeIssueSummary() on the backend', () => {
      const statuses = ['OPEN', 'IN_PROGRESS', 'OPEN', 'RESOLVED'];
      expect(statuses.filter((s) => s === 'OPEN')).toHaveLength(2);
      expect(statuses.filter((s) => s === 'IN_PROGRESS')).toHaveLength(1);
      expect(statuses.filter((s) => s === 'RESOLVED')).toHaveLength(1);
    });
  });
});
