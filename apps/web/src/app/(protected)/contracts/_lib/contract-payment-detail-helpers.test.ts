import { describe, it, expect } from 'vitest';
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_FILTER_OPTIONS,
  findNextDuePayment,
  PAYMENT_TERM_OPTIONS,
  PAYMENT_TERM_OTHER,
  resolvePaymentTermSelection,
  resolvePaymentTermValue,
  computeRemainingAmount,
  suggestPaymentStatus,
  validatePaymentFormValues,
  type PaymentFormValidationInput,
} from './contract-payment-detail-helpers';

describe('PAYMENT_STATUS_LABELS', () => {
  it('maps every real backend status to a manager-friendly label', () => {
    expect(PAYMENT_STATUS_LABELS.DRAFT).toBe('Pending');
    expect(PAYMENT_STATUS_LABELS.SUBMITTED).toBe('Submitted');
    expect(PAYMENT_STATUS_LABELS.CERTIFIED).toBe('Certified');
    expect(PAYMENT_STATUS_LABELS.PARTIALLY_PAID).toBe('Partially Received');
    expect(PAYMENT_STATUS_LABELS.PAID).toBe('Received');
    expect(PAYMENT_STATUS_LABELS.OVERDUE).toBe('Overdue');
    expect(PAYMENT_STATUS_LABELS.CANCELLED).toBe('Cancelled');
  });
});

describe('PAYMENT_STATUS_FILTER_OPTIONS', () => {
  it('includes an "All Status" option plus every real status', () => {
    expect(PAYMENT_STATUS_FILTER_OPTIONS[0]).toEqual({ value: '', label: 'All Status' });
    expect(PAYMENT_STATUS_FILTER_OPTIONS).toHaveLength(8);
  });
});

describe('findNextDuePayment', () => {
  it('returns the soonest-due payment among not-Received/not-Cancelled candidates', () => {
    const payments = [
      { status: 'SUBMITTED' as const, dueDate: '2026-09-20' },
      { status: 'DRAFT' as const, dueDate: '2026-09-05' },
      { status: 'PARTIALLY_PAID' as const, dueDate: '2026-09-15' },
    ];
    expect(findNextDuePayment(payments)?.dueDate).toBe('2026-09-05');
  });

  it('ignores Received (PAID) and Cancelled payments even if their due date is soonest', () => {
    const payments = [
      { status: 'PAID' as const, dueDate: '2026-09-01' },
      { status: 'CANCELLED' as const, dueDate: '2026-09-02' },
      { status: 'SUBMITTED' as const, dueDate: '2026-09-20' },
    ];
    expect(findNextDuePayment(payments)?.dueDate).toBe('2026-09-20');
  });

  it('ignores candidates with no dueDate at all', () => {
    const payments = [
      { status: 'SUBMITTED' as const },
      { status: 'DRAFT' as const, dueDate: '2026-09-10' },
    ];
    expect(findNextDuePayment(payments)?.dueDate).toBe('2026-09-10');
  });

  it('returns null when there is no upcoming payment', () => {
    const payments = [
      { status: 'PAID' as const, dueDate: '2026-09-01' },
      { status: 'CANCELLED' as const, dueDate: '2026-09-02' },
    ];
    expect(findNextDuePayment(payments)).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(findNextDuePayment([])).toBeNull();
  });
});

describe('resolvePaymentTermSelection / resolvePaymentTermValue', () => {
  it('preselects the matching fixed option for a real stored value', () => {
    expect(resolvePaymentTermSelection('Advance Payment')).toEqual({ choice: 'Advance Payment', other: '' });
  });

  it('CM-70A — treats an unset paymentTerm as "Other" with an empty free-text value', () => {
    expect(resolvePaymentTermSelection(undefined)).toEqual({ choice: PAYMENT_TERM_OTHER, other: '' });
  });

  it('CM-70A — preserves a legacy free-text value that matches no fixed option as "Other", never discarding it', () => {
    expect(resolvePaymentTermSelection('Net 30')).toEqual({ choice: PAYMENT_TERM_OTHER, other: 'Net 30' });
  });

  it('resolves the final submitted string from a fixed choice', () => {
    expect(resolvePaymentTermValue('Final Payment', '')).toBe('Final Payment');
  });

  it('resolves the final submitted string from the free-text "Other" value, trimmed', () => {
    expect(resolvePaymentTermValue(PAYMENT_TERM_OTHER, '  Net 45  ')).toBe('Net 45');
  });

  it('every fixed option round-trips through resolvePaymentTermSelection unchanged', () => {
    for (const option of PAYMENT_TERM_OPTIONS) {
      expect(resolvePaymentTermSelection(option)).toEqual({ choice: option, other: '' });
    }
  });
});

describe('computeRemainingAmount', () => {
  it('Invoice 8500, Received 8500 → Remaining 0', () => {
    expect(computeRemainingAmount(8500, 8500)).toBe(0);
  });

  it('Invoice 34000, Received 10000 → Remaining 24000', () => {
    expect(computeRemainingAmount(34000, 10000)).toBe(24000);
  });

  it('Invoice 25500, Received 0 → Remaining 25500', () => {
    expect(computeRemainingAmount(25500, 0)).toBe(25500);
  });

  it('treats a null/NaN Received Amount as 0', () => {
    expect(computeRemainingAmount(1000, null)).toBe(1000);
  });

  it('returns null when there is no real Invoice Amount yet', () => {
    expect(computeRemainingAmount(null, 500)).toBeNull();
  });

  it('rounds to 3 decimal places', () => {
    expect(computeRemainingAmount(100.1234, 0)).toBe(100.123);
  });
});

describe('suggestPaymentStatus', () => {
  it('returns null with no real Invoice Amount yet', () => {
    expect(suggestPaymentStatus(null, null)).toBeNull();
    expect(suggestPaymentStatus(0, 0)).toBeNull();
  });

  it('Received Amount = 0 → DRAFT (Pending)', () => {
    expect(suggestPaymentStatus(8500, 0)).toBe('DRAFT');
    expect(suggestPaymentStatus(8500, null)).toBe('DRAFT');
  });

  it('0 < Received Amount < Invoice Amount → PARTIALLY_PAID', () => {
    expect(suggestPaymentStatus(34000, 10000)).toBe('PARTIALLY_PAID');
  });

  it('Received Amount = Invoice Amount → PAID (Fully Paid)', () => {
    expect(suggestPaymentStatus(8500, 8500)).toBe('PAID');
  });

  it('Received Amount > Invoice Amount still resolves to PAID here — validatePaymentFormValues is what blocks it as an error', () => {
    expect(suggestPaymentStatus(8500, 9000)).toBe('PAID');
  });
});

describe('validatePaymentFormValues', () => {
  function makeInput(overrides: Partial<PaymentFormValidationInput> = {}): PaymentFormValidationInput {
    return {
      invoiceNumber: 'INV-001',
      invoiceDate: '2026-09-01',
      dueDate: '2026-09-15',
      paidDate: '',
      invoiceAmount: '8500',
      receivedAmount: '0',
      status: 'DRAFT',
      ...overrides,
    };
  }

  it('A — Advance Payment fully paid: Invoice 8500, Received 8500, status PAID, Received On set → valid', () => {
    const errors = validatePaymentFormValues(makeInput({ receivedAmount: '8500', status: 'PAID', paidDate: '2026-09-10' }));
    expect(errors).toEqual([]);
  });

  it('B — Partial payment: Invoice 34000, Received 10000, status PARTIALLY_PAID, Received On set → valid', () => {
    const errors = validatePaymentFormValues(
      makeInput({ invoiceAmount: '34000', receivedAmount: '10000', status: 'PARTIALLY_PAID', paidDate: '2026-09-10' }),
    );
    expect(errors).toEqual([]);
  });

  it('C — Pending payment: Invoice 25500, Received 0, status DRAFT, Received On empty → valid', () => {
    const errors = validatePaymentFormValues(makeInput({ invoiceAmount: '25500', receivedAmount: '0', status: 'DRAFT' }));
    expect(errors).toEqual([]);
  });

  it('D — overpayment (Invoice 8500, Received 9000) is rejected', () => {
    const errors = validatePaymentFormValues(makeInput({ receivedAmount: '9000', status: 'PAID', paidDate: '2026-09-10' }));
    expect(errors).toContain('Received Amount cannot exceed Invoice Amount.');
  });

  it('E — status Fully Paid but Received Amount less than Invoice Amount is rejected', () => {
    const errors = validatePaymentFormValues(makeInput({ receivedAmount: '5000', status: 'PAID', paidDate: '2026-09-10' }));
    expect(errors).toContain('Status is Fully Paid but Received Amount does not equal Invoice Amount.');
  });

  it('rejects status Pending with a non-zero Received Amount', () => {
    const errors = validatePaymentFormValues(makeInput({ receivedAmount: '100', status: 'DRAFT' }));
    expect(errors).toContain('Status is Pending but Received Amount is not 0.');
  });

  it('rejects status Partially Paid with Received Amount = 0', () => {
    const errors = validatePaymentFormValues(makeInput({ receivedAmount: '0', status: 'PARTIALLY_PAID' }));
    expect(errors).toContain('Status is Partially Paid but Received Amount must be greater than 0 and less than Invoice Amount.');
  });

  it('rejects status Partially Paid with Received Amount >= Invoice Amount', () => {
    const errors = validatePaymentFormValues(makeInput({ receivedAmount: '8500', status: 'PARTIALLY_PAID' }));
    expect(errors).toContain('Status is Partially Paid but Received Amount must be greater than 0 and less than Invoice Amount.');
  });

  it('requires Invoice Number, Invoice Date, and Payment Due Date', () => {
    const errors = validatePaymentFormValues(makeInput({ invoiceNumber: '', invoiceDate: '', dueDate: '' }));
    expect(errors).toContain('Invoice Number is required.');
    expect(errors).toContain('Invoice Date is required.');
    expect(errors).toContain('Payment Due Date is required.');
  });

  it('requires a real, positive Invoice Amount', () => {
    expect(validatePaymentFormValues(makeInput({ invoiceAmount: '' }))).toContain('Invoice Amount is required and must be greater than 0.');
    expect(validatePaymentFormValues(makeInput({ invoiceAmount: '0' }))).toContain('Invoice Amount is required and must be greater than 0.');
  });

  it('rejects a negative Received Amount', () => {
    const errors = validatePaymentFormValues(makeInput({ receivedAmount: '-50' }));
    expect(errors).toContain('Received Amount cannot be negative.');
  });

  it('requires Received On once Received Amount > 0, even if status has not caught up yet', () => {
    const errors = validatePaymentFormValues(makeInput({ receivedAmount: '4000', status: 'PARTIALLY_PAID', paidDate: '' }));
    expect(errors).toContain('Received On is required once a payment has been received.');
  });

  it('does not require Received On when Received Amount is 0 and status is Pending', () => {
    const errors = validatePaymentFormValues(makeInput({ receivedAmount: '0', status: 'DRAFT', paidDate: '' }));
    expect(errors).not.toContain('Received On is required once a payment has been received.');
  });

  it('a real payment with no amounts at all reports both amount errors, not a false status-mismatch error', () => {
    const errors = validatePaymentFormValues(makeInput({ invoiceAmount: '', receivedAmount: '' }));
    expect(errors).toContain('Invoice Amount is required and must be greater than 0.');
    expect(errors).toContain('Received Amount is required.');
    expect(errors.some((e) => e.includes('Fully Paid') || e.includes('Pending') || e.includes('Partially Paid'))).toBe(false);
  });
});
