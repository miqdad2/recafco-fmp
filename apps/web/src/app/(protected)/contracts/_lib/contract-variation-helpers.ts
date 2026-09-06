// ---------------------------------------------------------------------------
// CM-60 — Pure, presentation-agnostic helpers for the Contract Detail
// Variations / Change Orders tab. "Variation" is the real backend
// enum/field terminology — labels here are purely display, the stored
// value/DTOs are never renamed. Dependency-free so it can be unit tested
// directly, matching contract-payment-detail-helpers.ts / contract-production-helpers.ts.
// ---------------------------------------------------------------------------

import type { ContractVariationStatus } from '@/lib/contracts-api';

export const VARIATION_STATUS_LABELS: Record<ContractVariationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

/** Approved: green, Pending Approval: amber, Rejected: red, Cancelled: gray, Draft: muted, Submitted: blue — per this unit's approved design. */
export const VARIATION_STATUS_BADGE_CLASSES: Record<ContractVariationStatus, string> = {
  DRAFT: 'bg-surface-secondary text-text-muted',
  SUBMITTED: 'bg-info-light text-info',
  PENDING_APPROVAL: 'bg-warning-light text-warning',
  APPROVED: 'bg-success-light text-success',
  REJECTED: 'bg-error-light text-error',
  CANCELLED: 'bg-surface-secondary text-text-muted',
};

export interface VariationStatusFilterOption {
  value: string;
  label: string;
}

export const VARIATION_STATUS_FILTER_OPTIONS: VariationStatusFilterOption[] = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const VARIATION_STATUS_OPTIONS: { value: ContractVariationStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const AFFECTS_CONTRACT_VALUE_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

export type SubmittedDateFilter = '' | 'this-month' | 'last-month' | 'this-year';

export const SUBMITTED_DATE_FILTER_OPTIONS: { value: SubmittedDateFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'this-year', label: 'This Year' },
];

/**
 * Real month/year comparison against `today` (defaults to `new Date()`),
 * used by the client-side Submitted Date filter. `submittedDate` is an
 * ISO date string ("YYYY-MM-DD..."); returns false (excluded) when unset —
 * a variation with no submitted date can never honestly match a date filter.
 */
export function matchesSubmittedDateFilter(
  submittedDate: string | undefined,
  filter: SubmittedDateFilter,
  today: Date = new Date(),
): boolean {
  if (!filter) return true;
  if (!submittedDate) return false;

  const d = new Date(submittedDate);
  if (isNaN(d.getTime())) return false;

  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const todayY = today.getUTCFullYear();
  const todayM = today.getUTCMonth();

  if (filter === 'this-month') return y === todayY && m === todayM;
  if (filter === 'this-year') return y === todayY;
  if (filter === 'last-month') {
    const lastMonthDate = new Date(Date.UTC(todayY, todayM - 1, 1));
    return y === lastMonthDate.getUTCFullYear() && m === lastMonthDate.getUTCMonth();
  }
  return true;
}

// ---------------------------------------------------------------------------
// CM-70C — Add/Edit Variation modal UX: status-driven date requirements and
// pre-submit validation. Pure, dependency-free (no React) so they're directly
// unit-testable, matching contract-payment-detail-helpers.ts /
// contract-production-helpers.ts. The backend's create/update DTOs
// deliberately carry no cross-field rules today (status-vs-date
// requirements, approved-vs-submitted date ordering, approved+affects+
// amount!=0) — these are frontend-only additions per this unit's own
// "prefer frontend/UI validation only" instruction. computeVariationSummary()
// on the backend (contract-variations.service.ts) is unchanged and remains
// the sole source of truth for Approved/Pending Variations and Current
// Contract Value — nothing here recomputes or duplicates that logic.
// ---------------------------------------------------------------------------

const SUBMITTED_DATE_REQUIRED_STATUSES: ContractVariationStatus[] = [
  'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED',
];

/** Submitted Date is required once a variation has left Draft — Draft is the only status that can be genuinely dateless. */
export function isSubmittedDateRequired(status: ContractVariationStatus): boolean {
  return SUBMITTED_DATE_REQUIRED_STATUSES.includes(status);
}

/** Approved Date is only ever required when status is APPROVED — Draft/Submitted/Pending Approval never require it (an existing record can still carry a historical Approved Date without one being forced). */
export function isApprovedDateRequired(status: ContractVariationStatus): boolean {
  return status === 'APPROVED';
}

export interface VariationFormValidationInput {
  status: ContractVariationStatus;
  description: string;
  amount: string;
  affectsContractValue: boolean;
  submittedDate: string;
  approvedDate: string;
}

/**
 * Every required-field and cross-field rule from this unit's own task, run
 * entirely client-side before the form ever reaches the server. Returns an
 * empty array when the form is valid. Amount is deliberately never floored
 * at 0 — a negative amount is a real, valid deduction/omission.
 */
export function validateVariationFormValues(input: VariationFormValidationInput): string[] {
  const errors: string[] = [];

  if (!input.description.trim()) {
    errors.push('Description is required.');
  }

  const amountNum = input.amount.trim() ? Number(input.amount) : null;
  const hasAmount = amountNum !== null && !isNaN(amountNum);
  if (!hasAmount) {
    errors.push('Variation Amount is required.');
  }

  if (isSubmittedDateRequired(input.status) && !input.submittedDate.trim()) {
    errors.push('Submitted Date is required for this status.');
  }

  if (isApprovedDateRequired(input.status) && !input.approvedDate.trim()) {
    errors.push('Approved Date is required when status is Approved.');
  }

  if (input.submittedDate.trim() && input.approvedDate.trim() && input.approvedDate < input.submittedDate) {
    errors.push('Approved Date cannot be before Submitted Date.');
  }

  if (input.status === 'APPROVED' && input.affectsContractValue && hasAmount && amountNum === 0) {
    errors.push('An Approved variation marked Affects Contract Value cannot have an amount of 0.');
  }

  return errors;
}
