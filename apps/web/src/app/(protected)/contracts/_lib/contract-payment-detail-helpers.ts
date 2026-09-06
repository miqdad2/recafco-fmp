// ---------------------------------------------------------------------------
// CM-58 — Pure, presentation-agnostic helpers for the Contract Detail
// Payments tab approved-design rebuild. Manager-friendly status labels are
// display-only re-labeling of the real ContractPaymentStatus enum — the
// stored value/DTOs are never renamed. Dependency-free so it can be unit
// tested directly, matching contract-ui-helpers.ts / contract-overview-helpers.ts.
// ---------------------------------------------------------------------------

import type { ContractPaymentStatus } from '@/lib/contracts-api';

/**
 * Manager-friendly labels for the real backend enum. DRAFT→"Pending" and
 * PAID→"Received"/PARTIALLY_PAID→"Partially Received" per this unit's task;
 * CERTIFIED is kept as its own distinct label (not merged into "Submitted")
 * since it is a real, separate workflow state — collapsing it would hide
 * real information, not just relabel it.
 */
export const PAYMENT_STATUS_LABELS: Record<ContractPaymentStatus, string> = {
  DRAFT: 'Pending',
  SUBMITTED: 'Submitted',
  CERTIFIED: 'Certified',
  PARTIALLY_PAID: 'Partially Received',
  PAID: 'Received',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
};

/** Received: green, Submitted: blue, Pending: amber, Partially Received: purple, Overdue: red, Cancelled: gray, Certified: teal. */
export const PAYMENT_STATUS_BADGE_CLASSES: Record<ContractPaymentStatus, string> = {
  DRAFT: 'bg-warning-light text-warning',
  SUBMITTED: 'bg-info-light text-info',
  CERTIFIED: 'bg-teal-light text-teal',
  PARTIALLY_PAID: 'bg-team-production-light text-team-production',
  PAID: 'bg-success-light text-success',
  OVERDUE: 'bg-error-light text-error',
  CANCELLED: 'bg-surface-secondary text-text-muted',
};

export interface PaymentStatusFilterOption {
  value: string;
  label: string;
}

export const PAYMENT_STATUS_FILTER_OPTIONS: PaymentStatusFilterOption[] = [
  { value: '', label: 'All Status' },
  { value: 'DRAFT', label: 'Pending' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'CERTIFIED', label: 'Certified' },
  { value: 'PARTIALLY_PAID', label: 'Partially Received' },
  { value: 'PAID', label: 'Received' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export interface NextDuePaymentCandidate {
  status: ContractPaymentStatus;
  dueDate?: string;
}

/**
 * The soonest-due payment that is not yet Received or Cancelled — used for
 * the "Next Due Payment" KPI. Returns null when there is no such payment
 * (never a fabricated "next due" value).
 */
export function findNextDuePayment<T extends NextDuePaymentCandidate>(payments: T[]): T | null {
  const candidates = payments.filter((p) => p.status !== 'PAID' && p.status !== 'CANCELLED' && p.dueDate);
  if (candidates.length === 0) return null;
  return candidates.reduce((soonest, p) => (p.dueDate! < soonest.dueDate! ? p : soonest));
}

// ---------------------------------------------------------------------------
// CM-70A — Add/Edit Payment modal UX: Payment Term dropdown, live Remaining
// Amount, auto-suggested status, and pre-submit validation. All pure,
// dependency-free functions (no React) so they're directly unit-testable —
// the modal component only calls these, never re-derives the rules inline.
// ---------------------------------------------------------------------------

/** Fixed, real Payment Term options a manager actually uses — "Other" always keeps a free-text fallback so the backend's real, unchanged text column never loses expressiveness. */
export const PAYMENT_TERM_OPTIONS = [
  'Advance Payment',
  'Production Interim Payment',
  'Delivery Payment',
  'Erection Payment',
  'Final Payment',
  'Retention Release',
] as const;
export type PaymentTermOption = (typeof PAYMENT_TERM_OPTIONS)[number];
export const PAYMENT_TERM_OTHER = 'Other';

/**
 * Splits a real, already-stored free-text `paymentTerm` into the dropdown
 * selection to preselect plus the "Other" free-text value to preselect —
 * never silently discards existing data. A legacy value that doesn't match
 * one of the fixed options (e.g. "Net 30") is treated as "Other" with that
 * exact text preserved, so editing an old payment never loses it.
 */
export function resolvePaymentTermSelection(paymentTerm: string | undefined): { choice: PaymentTermOption | typeof PAYMENT_TERM_OTHER; other: string } {
  if (!paymentTerm) return { choice: PAYMENT_TERM_OTHER, other: '' };
  const match = PAYMENT_TERM_OPTIONS.find((o) => o === paymentTerm);
  if (match) return { choice: match, other: '' };
  return { choice: PAYMENT_TERM_OTHER, other: paymentTerm };
}

/** The one real string that gets submitted as `paymentTerm` — the backend column is unchanged free text either way. */
export function resolvePaymentTermValue(choice: string, other: string): string {
  return choice === PAYMENT_TERM_OTHER ? other.trim() : choice;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Invoice Amount − Received Amount. Null when Invoice Amount isn't a real positive number yet (nothing to calculate from). */
export function computeRemainingAmount(invoiceAmount: number | null, receivedAmount: number | null): number | null {
  if (invoiceAmount === null || isNaN(invoiceAmount)) return null;
  return round3(invoiceAmount - (receivedAmount !== null && !isNaN(receivedAmount) ? receivedAmount : 0));
}

export type AmountDerivedPaymentStatus = 'DRAFT' | 'PARTIALLY_PAID' | 'PAID';

/**
 * Live "as you type" suggestion for the 3 real amount-derived statuses —
 * DRAFT ("Pending"), PARTIALLY_PAID, PAID ("Received"). Returns null when
 * there's no real Invoice Amount yet (nothing to suggest from). Deliberately
 * does NOT flag overpayment itself (received > invoice) — that is
 * `validatePaymentFormValues`'s job, a real, visible, blocking error rather
 * than a silently "corrected" status; this function still returns 'PAID'
 * for an overpaid combination so the UI has *something* sane to show while
 * the user is mid-edit, before they've necessarily hit Save.
 */
export function suggestPaymentStatus(invoiceAmount: number | null, receivedAmount: number | null): AmountDerivedPaymentStatus | null {
  if (invoiceAmount === null || isNaN(invoiceAmount) || invoiceAmount <= 0) return null;
  const received = receivedAmount !== null && !isNaN(receivedAmount) ? receivedAmount : 0;
  if (received <= 0) return 'DRAFT';
  if (received < invoiceAmount) return 'PARTIALLY_PAID';
  return 'PAID';
}

export interface PaymentFormValidationInput {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paidDate: string;
  invoiceAmount: string;
  receivedAmount: string;
  status: ContractPaymentStatus;
}

/**
 * Every required-field and amount/status-consistency rule from this unit's
 * own task, run entirely client-side before the form ever reaches the
 * server — the backend's own `assertPaymentAmountsValid` (paidAmount vs.
 * certifiedAmount ?? submittedAmount) still applies underneath as the real
 * safety net; this is purely a faster, friendlier, more specific version of
 * the same "received cannot exceed invoice" rule plus the newer
 * status-consistency rules the backend has no opinion on. Returns an empty
 * array when the form is valid.
 */
export function validatePaymentFormValues(input: PaymentFormValidationInput): string[] {
  const errors: string[] = [];

  if (!input.invoiceNumber.trim()) errors.push('Invoice Number is required.');
  if (!input.invoiceDate.trim()) errors.push('Invoice Date is required.');
  if (!input.dueDate.trim()) errors.push('Payment Due Date is required.');

  const invoiceAmount = input.invoiceAmount.trim() ? Number(input.invoiceAmount) : null;
  const receivedAmount = input.receivedAmount.trim() ? Number(input.receivedAmount) : null;
  const hasInvoiceAmount = invoiceAmount !== null && !isNaN(invoiceAmount);
  const hasReceivedAmount = receivedAmount !== null && !isNaN(receivedAmount);

  if (!hasInvoiceAmount || (invoiceAmount as number) <= 0) {
    errors.push('Invoice Amount is required and must be greater than 0.');
  }
  if (!hasReceivedAmount) {
    errors.push('Received Amount is required.');
  } else if ((receivedAmount as number) < 0) {
    errors.push('Received Amount cannot be negative.');
  }

  if (hasInvoiceAmount && hasReceivedAmount && (receivedAmount as number) > (invoiceAmount as number)) {
    errors.push('Received Amount cannot exceed Invoice Amount.');
  }

  const receivedIsPositive = hasReceivedAmount && (receivedAmount as number) > 0;
  const statusImpliesReceived = input.status === 'PARTIALLY_PAID' || input.status === 'PAID';
  if ((receivedIsPositive || statusImpliesReceived) && !input.paidDate.trim()) {
    errors.push('Received On is required once a payment has been received.');
  }

  if (hasInvoiceAmount && hasReceivedAmount) {
    if (input.status === 'PAID' && round3(receivedAmount as number) !== round3(invoiceAmount as number)) {
      errors.push('Status is Fully Paid but Received Amount does not equal Invoice Amount.');
    }
    if (input.status === 'DRAFT' && (receivedAmount as number) !== 0) {
      errors.push('Status is Pending but Received Amount is not 0.');
    }
    if (input.status === 'PARTIALLY_PAID' && ((receivedAmount as number) <= 0 || (receivedAmount as number) >= (invoiceAmount as number))) {
      errors.push('Status is Partially Paid but Received Amount must be greater than 0 and less than Invoice Amount.');
    }
  }

  return errors;
}
