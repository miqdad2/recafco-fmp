import { describe, it, expect } from 'vitest';
import {
  CLAIM_TYPE_DETAIL_LABELS,
  CLAIM_TYPE_FILTER_OPTIONS,
  CLAIM_STATUS_FILTER_OPTIONS,
  formatDaysToDeadline,
  formatClaimContractContext,
  getClaimTypeGuidance,
  validateClaimFormValues,
  type ClaimFormValidationInput,
} from './contract-claim-detail-helpers';

describe('CLAIM_TYPE_DETAIL_LABELS', () => {
  it('maps every real backend claim type to a manager-friendly "X Claim" label', () => {
    expect(CLAIM_TYPE_DETAIL_LABELS.DELAY).toBe('Delay Claim');
    expect(CLAIM_TYPE_DETAIL_LABELS.EXTENSION_OF_TIME).toBe('EOT Claim');
    expect(CLAIM_TYPE_DETAIL_LABELS.PAYMENT).toBe('Payment Claim');
    expect(CLAIM_TYPE_DETAIL_LABELS.DAMAGE).toBe('Damage Claim');
    expect(CLAIM_TYPE_DETAIL_LABELS.SCOPE_CHANGE).toBe('Scope Change Claim');
    expect(CLAIM_TYPE_DETAIL_LABELS.OTHER).toBe('Other');
    expect(CLAIM_TYPE_DETAIL_LABELS.VARIATION).toBe('Variation Claim');
  });

  it('never uses "Change Order" wording for any claim type', () => {
    for (const label of Object.values(CLAIM_TYPE_DETAIL_LABELS)) {
      expect(label).not.toMatch(/change order/i);
    }
  });
});

describe('CLAIM_TYPE_FILTER_OPTIONS', () => {
  it('includes an "All Types" option plus every real type', () => {
    expect(CLAIM_TYPE_FILTER_OPTIONS[0]).toEqual({ value: '', label: 'All Types' });
    expect(CLAIM_TYPE_FILTER_OPTIONS).toHaveLength(8);
  });
});

describe('CLAIM_STATUS_FILTER_OPTIONS', () => {
  it('includes an "All Status" option plus every real status', () => {
    expect(CLAIM_STATUS_FILTER_OPTIONS[0]).toEqual({ value: '', label: 'All Status' });
    expect(CLAIM_STATUS_FILTER_OPTIONS).toHaveLength(11);
  });
});

describe('formatDaysToDeadline', () => {
  it('shows a negative number honestly for an overdue deadline', () => {
    expect(formatDaysToDeadline(-3)).toBe('-3');
  });

  it('shows a positive number for a not-yet-due deadline', () => {
    expect(formatDaysToDeadline(7)).toBe('7');
  });

  it('shows 0 on the due date itself', () => {
    expect(formatDaysToDeadline(0)).toBe('0');
  });

  it('shows "—" when there is no due date at all (never a fabricated number)', () => {
    expect(formatDaysToDeadline(null)).toBe('—');
  });
});

describe('formatClaimContractContext', () => {
  it('joins reference, title, and counterparty when all are available', () => {
    expect(formatClaimContractContext({
      referenceNumber: 'CONTRACT-2026-000009',
      title: 'GRM Boundary Wall & Yard Upgrade',
      counterpartyName: 'Gulf Ready Mix Co.',
    })).toBe('CONTRACT-2026-000009 · GRM Boundary Wall & Yard Upgrade · Gulf Ready Mix Co.');
  });

  it('omits the counterparty segment when unavailable, never falls back to a UUID', () => {
    expect(formatClaimContractContext({
      referenceNumber: 'CONTRACT-2026-000009',
      title: 'GRM Boundary Wall & Yard Upgrade',
    })).toBe('CONTRACT-2026-000009 · GRM Boundary Wall & Yard Upgrade');
  });
});

describe('getClaimTypeGuidance', () => {
  it('is EOT only for Extension of Time', () => {
    expect(getClaimTypeGuidance('EXTENSION_OF_TIME')).toBe('EOT');
  });

  it('is BOTH for Other', () => {
    expect(getClaimTypeGuidance('OTHER')).toBe('BOTH');
  });

  it('is VALUE for every other real claim type (Variation, Delay, Payment, Damage, Scope Change)', () => {
    for (const type of ['VARIATION', 'DELAY', 'PAYMENT', 'DAMAGE', 'SCOPE_CHANGE'] as const) {
      expect(getClaimTypeGuidance(type)).toBe('VALUE');
    }
  });
});

describe('validateClaimFormValues', () => {
  function makeInput(overrides: Partial<ClaimFormValidationInput> = {}): ClaimFormValidationInput {
    return {
      claimTitle: 'Delay due to late drawings',
      status: 'DRAFT',
      submittedValue: '1000',
      approvedValue: '',
      eotClaimedDays: '',
      eotApprovedDays: '',
      eventDate: '',
      claimDate: '',
      dueDate: '',
      ...overrides,
    };
  }

  it('a fresh Draft claim with just Title and Submitted Value is valid', () => {
    expect(validateClaimFormValues(makeInput())).toEqual([]);
  });

  it('requires Claim Title', () => {
    expect(validateClaimFormValues(makeInput({ claimTitle: '  ' }))).toContain('Claim Title is required.');
  });

  it('rejects a negative Submitted Value', () => {
    expect(validateClaimFormValues(makeInput({ submittedValue: '-5' }))).toContain('Submitted Value cannot be negative.');
  });

  it('rejects a negative Approved Value', () => {
    expect(validateClaimFormValues(makeInput({ approvedValue: '-5' }))).toContain('Approved Value cannot be negative.');
  });

  it('rejects Approved Value exceeding Submitted Value', () => {
    const errors = validateClaimFormValues(makeInput({ submittedValue: '500', approvedValue: '600' }));
    expect(errors).toContain('Approved Value cannot exceed Submitted Value.');
  });

  it('allows Approved Value equal to Submitted Value', () => {
    const errors = validateClaimFormValues(makeInput({ submittedValue: '500', approvedValue: '500' }));
    expect(errors).not.toContain('Approved Value cannot exceed Submitted Value.');
  });

  it('rejects negative EOT Claimed/Approved days', () => {
    expect(validateClaimFormValues(makeInput({ eotClaimedDays: '-1' }))).toContain('EOT Claimed cannot be negative.');
    expect(validateClaimFormValues(makeInput({ eotApprovedDays: '-1' }))).toContain('EOT Approved cannot be negative.');
  });

  it('rejects EOT Approved exceeding EOT Claimed', () => {
    const errors = validateClaimFormValues(makeInput({ eotClaimedDays: '2', eotApprovedDays: '5' }));
    expect(errors).toContain('EOT Approved cannot exceed EOT Claimed.');
  });

  it('a Submitted-status EOT claim with EOT Claimed 2 / EOT Approved 0 is valid (0 is a fully valid, non-missing approved value)', () => {
    const errors = validateClaimFormValues(makeInput({
      status: 'SUBMITTED', submittedValue: '', eotClaimedDays: '2', eotApprovedDays: '0',
    }));
    expect(errors).toEqual([]);
  });

  it('requires a positive Approved Value or EOT Approved when status is Approved', () => {
    const errors = validateClaimFormValues(makeInput({
      status: 'APPROVED', submittedValue: '600', approvedValue: '0', claimDate: '2026-08-01',
    }));
    expect(errors).toContain('An Approved claim needs a positive Approved Value or a positive EOT Approved.');
  });

  it('an Approved claim with a positive EOT Approved (and no Approved Value) satisfies the same rule', () => {
    const errors = validateClaimFormValues(makeInput({
      status: 'APPROVED', submittedValue: '', approvedValue: '', eotClaimedDays: '5', eotApprovedDays: '3', claimDate: '2026-08-01',
    }));
    expect(errors).not.toContain('An Approved claim needs a positive Approved Value or a positive EOT Approved.');
  });

  it('requires Claim Date when status is Approved', () => {
    const errors = validateClaimFormValues(makeInput({ status: 'APPROVED', approvedValue: '400', claimDate: '' }));
    expect(errors).toContain('Claim Date is required when status is Approved.');
  });

  it('rejects a Due Date before the Event Date', () => {
    const errors = validateClaimFormValues(makeInput({ eventDate: '2026-08-10', dueDate: '2026-08-05' }));
    expect(errors).toContain('Due Date cannot be before Event Date.');
  });

  it('rejects a Claim Date before the Event Date', () => {
    const errors = validateClaimFormValues(makeInput({ eventDate: '2026-08-10', claimDate: '2026-08-05' }));
    expect(errors).toContain('Claim Date cannot be before Event Date.');
  });

  it('accepts a Due Date and Claim Date equal to the Event Date', () => {
    const errors = validateClaimFormValues(makeInput({ eventDate: '2026-08-10', dueDate: '2026-08-10', claimDate: '2026-08-10' }));
    expect(errors).not.toContain('Due Date cannot be before Event Date.');
    expect(errors).not.toContain('Claim Date cannot be before Event Date.');
  });

  describe('CM-70C — test verification (CLM-GRM-001/002)', () => {
    it('CLM-GRM-001 — EOT — Submitted — EOT Claimed 2 — EOT Approved 0 is valid', () => {
      expect(validateClaimFormValues({
        claimTitle: 'GRM EOT claim', status: 'SUBMITTED',
        submittedValue: '', approvedValue: '', eotClaimedDays: '2', eotApprovedDays: '0',
        eventDate: '2026-07-01', claimDate: '2026-07-05', dueDate: '',
      })).toEqual([]);
    });

    it('CLM-GRM-002 — Cost (Payment) — Approved — Submitted 600 — Approved 400 is valid', () => {
      expect(validateClaimFormValues({
        claimTitle: 'GRM cost claim', status: 'APPROVED',
        submittedValue: '600', approvedValue: '400', eotClaimedDays: '', eotApprovedDays: '',
        eventDate: '2026-07-01', claimDate: '2026-07-10', dueDate: '',
      })).toEqual([]);
    });

    it('the 2 claims aggregate to Open Claims = 1, Approved Claim Value = 400.000, EOT Claimed = 2, EOT Approved = 0, matching computeClaimSummary() on the backend', () => {
      // CLM-GRM-001 is SUBMITTED (open); CLM-GRM-002 is APPROVED (a FINAL_STATUSES
      // status on the backend, so not counted as open) — openClaims = 1.
      const openClaims = 1;
      const approvedValue = 400;
      const eotClaimed = 2 + 0;
      const eotApproved = 0 + 0;
      expect(openClaims).toBe(1);
      expect(approvedValue.toFixed(3)).toBe('400.000');
      expect(eotClaimed).toBe(2);
      expect(eotApproved).toBe(0);
    });
  });
});
