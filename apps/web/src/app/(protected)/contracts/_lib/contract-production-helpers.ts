// ---------------------------------------------------------------------------
// CM-59 — Pure, presentation-agnostic helpers for the Contract Detail
// Production Status tab. Status labels are display-only re-labeling of the
// real ContractBoqProductionStatus enum — the stored value/DTOs are never
// renamed. The compute*() functions mirror the backend's own
// contract-boq-production.service.ts exactly (same formulas, same
// divide-by-zero-safe zero defaults) so the Add/Update Production modal can
// show a live preview before saving, without a round trip. Dependency-free
// so it can be unit tested directly, matching contract-payment-detail-helpers.ts.
// ---------------------------------------------------------------------------

import type { ContractBoqProductionStatus } from '@/lib/contracts-api';

export const PRODUCTION_STATUS_LABELS: Record<ContractBoqProductionStatus, string> = {
  NOT_STARTED: 'Not Started',
  IN_PRODUCTION: 'In Production',
  PARTIALLY_DELIVERED: 'Partially Delivered',
  COMPLETED: 'Completed',
  DELAYED: 'Delayed',
};

/** Not Started: gray, In Production: blue, Partially Delivered: purple, Completed: green, Delayed: red. */
export const PRODUCTION_STATUS_BADGE_CLASSES: Record<ContractBoqProductionStatus, string> = {
  NOT_STARTED: 'bg-surface-secondary text-text-muted',
  IN_PRODUCTION: 'bg-info-light text-info',
  PARTIALLY_DELIVERED: 'bg-team-production-light text-team-production',
  COMPLETED: 'bg-success-light text-success',
  DELAYED: 'bg-error-light text-error',
};

/** Progress bar fill color per status — same color intent as PRODUCTION_STATUS_BADGE_CLASSES, expressed as a solid `bg-*` class for a <div> bar rather than a `bg-*-light`/`text-*` badge pairing. */
export const PRODUCTION_STATUS_BAR_CLASSES: Record<ContractBoqProductionStatus, string> = {
  NOT_STARTED: 'bg-border-strong',
  IN_PRODUCTION: 'bg-info',
  PARTIALLY_DELIVERED: 'bg-team-production',
  COMPLETED: 'bg-success',
  DELAYED: 'bg-error',
};

export interface ProductionStatusFilterOption {
  value: string;
  label: string;
}

export const PRODUCTION_STATUS_FILTER_OPTIONS: ProductionStatusFilterOption[] = [
  { value: '', label: 'All' },
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'IN_PRODUCTION', label: 'In Production' },
  { value: 'PARTIALLY_DELIVERED', label: 'Partially Delivered' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'DELAYED', label: 'Delayed' },
];

export const PRODUCTION_STATUS_OPTIONS: { value: ContractBoqProductionStatus; label: string }[] = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'IN_PRODUCTION', label: 'In Production' },
  { value: 'PARTIALLY_DELIVERED', label: 'Partially Delivered' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'DELAYED', label: 'Delayed' },
];

/** Thousands-separated quantity display, up to 3 decimals (matches the Decimal(14,3) columns). */
export function formatQty(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

export function computeStockNotDelivered(produced: number, delivered: number): number {
  return produced - delivered;
}

export function computeRemainingToCast(total: number, produced: number): number {
  return total - produced;
}

/** Divide-by-zero safe: 0 when total <= 0. Matches computePercentOfTotal() on the backend. */
export function computePercentOfTotal(part: number, total: number): number {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

// ---------------------------------------------------------------------------
// CM-70B — Add/Update Production modal UX: status auto-suggestion and
// pre-submit validation. Pure, dependency-free (no React) so they're
// directly unit-testable, matching contract-payment-detail-helpers.ts's
// CM-70A pattern. The backend's own cross-field checks
// (assertProductionAmountsValid — delivered > produced, produced > totalQty)
// are the real, unchanged safety net; these are a faster, friendlier,
// client-side version of the same two rules plus the newer required-field
// checks the backend deliberately leaves optional.
// ---------------------------------------------------------------------------

export type AmountDerivedProductionStatus = 'NOT_STARTED' | 'IN_PRODUCTION' | 'PARTIALLY_DELIVERED' | 'COMPLETED';

/**
 * Live "as you type" suggestion for the 4 real amount-derived statuses.
 * DELAYED is deliberately never suggested here — it isn't derivable from
 * quantities alone (a real, manager-judged condition) and, like the Payment
 * modal's SUBMITTED/CERTIFIED/OVERDUE/CANCELLED, survives as a manual-only
 * choice. Returns null when there's no real positive Total Qty to compare
 * against (nothing to suggest from).
 */
export function suggestProductionStatus(totalQty: number, produced: number, delivered: number): AmountDerivedProductionStatus | null {
  if (totalQty <= 0) return null;
  if (produced <= 0) return 'NOT_STARTED';
  if (delivered >= totalQty) return 'COMPLETED';
  if (produced >= totalQty) return 'PARTIALLY_DELIVERED';
  return 'IN_PRODUCTION';
}

export interface ProductionFormValidationInput {
  totalQty: number;
  producedQty: string;
  deliveredQty: string;
}

/**
 * Every required-field and cross-field rule from this unit's own task, run
 * entirely client-side before the form ever reaches the server. Returns an
 * empty array when the form is valid.
 */
export function validateProductionFormValues(input: ProductionFormValidationInput): string[] {
  const errors: string[] = [];

  const produced = input.producedQty.trim() ? Number(input.producedQty) : null;
  const delivered = input.deliveredQty.trim() ? Number(input.deliveredQty) : null;
  const hasProduced = produced !== null && !isNaN(produced);
  const hasDelivered = delivered !== null && !isNaN(delivered);

  if (!hasProduced) {
    errors.push('Casted / Produced quantity is required.');
  } else if ((produced as number) < 0) {
    errors.push('Casted / Produced quantity cannot be negative.');
  } else if (input.totalQty > 0 && (produced as number) > input.totalQty) {
    errors.push('Casted / Produced quantity cannot exceed the item’s Total Qty.');
  }

  if (!hasDelivered) {
    errors.push('Delivered quantity is required.');
  } else if ((delivered as number) < 0) {
    errors.push('Delivered quantity cannot be negative.');
  }

  if (hasProduced && hasDelivered && (delivered as number) > (produced as number)) {
    errors.push('Delivered quantity cannot be more than casted/produced quantity.');
  }

  return errors;
}
