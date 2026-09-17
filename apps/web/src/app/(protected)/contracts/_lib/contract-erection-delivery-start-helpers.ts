// ---------------------------------------------------------------------------
// CM-71E — Pure, presentation-agnostic helpers for the Erection Workflow,
// Step 4 (Delivery Start) screen. Dependency-free so it can be unit tested
// directly, matching contract-erection-schedule-helpers.ts /
// contract-erection-method-statement-helpers.ts.
// ---------------------------------------------------------------------------

import type {
  ContractErectionDeliveryStartStatus,
  ContractErectionDeliveryItemStatus,
  ContractErectionDeliveryDocumentStatus,
} from '@/lib/contracts-api';

export const ERECTION_DELIVERY_START_STATUS_LABELS: Record<ContractErectionDeliveryStartStatus, string> = {
  DRAFT: 'Draft',
  STARTED: 'Started',
  HOLD: 'Hold',
  RETURNED: 'Returned',
};

export const ERECTION_DELIVERY_START_STATUS_BADGE_CLASSES: Record<ContractErectionDeliveryStartStatus, string> = {
  DRAFT: 'bg-surface-secondary text-text-muted',
  STARTED: 'bg-success-light text-success',
  HOLD: 'bg-warning-light text-warning',
  RETURNED: 'bg-error-light text-error',
};

/** "Ready to Start" badge classes — computed frontend-only state, matching Steps 1/3's own READY_TO_ISSUE_BADGE_CLASSES precedent. */
export const READY_TO_START_BADGE_CLASSES = 'bg-warning-light text-warning';

export const ERECTION_DELIVERY_ITEM_STATUS_LABELS: Record<ContractErectionDeliveryItemStatus, string> = {
  READY_TO_DISPATCH: 'Ready to Dispatch',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
  HOLD: 'Hold',
};

export const ERECTION_DELIVERY_ITEM_STATUS_BADGE_CLASSES: Record<ContractErectionDeliveryItemStatus, string> = {
  READY_TO_DISPATCH: 'bg-surface-secondary text-text-secondary',
  DISPATCHED: 'bg-info-light text-info',
  DELIVERED: 'bg-success-light text-success',
  HOLD: 'bg-warning-light text-warning',
};

export const ERECTION_DELIVERY_DOCUMENT_STATUS_LABELS: Record<ContractErectionDeliveryDocumentStatus, string> = {
  PENDING: 'Pending',
  ATTACHED: 'Attached',
  NOT_REQUIRED: 'Not Required',
};

export const ERECTION_DELIVERY_DOCUMENT_STATUS_BADGE_CLASSES: Record<ContractErectionDeliveryDocumentStatus, string> = {
  PENDING: 'bg-surface-secondary text-text-muted',
  ATTACHED: 'bg-success-light text-success',
  NOT_REQUIRED: 'bg-surface-secondary text-text-secondary',
};

/** The fixed 4-document checklist this unit's own task specifies — matches CONTRACT_ERECTION_DELIVERY_DOCUMENT_NAMES on the backend exactly. */
export const ERECTION_DELIVERY_DOCUMENT_NAMES = [
  'Packing List',
  'Material Test Certificates',
  'Delivery Note / Invoice',
  'Bill of Lading / LR',
] as const;

export interface ErectionDeliveryStartFormValidationInput {
  deliveryReferenceNo: string;
  deliveryDate: string;
  plannedDeliveryWindowStart: string;
  plannedDeliveryWindowEnd: string;
  transportMode: string;
  dispatchProductionSource: string;
  dispatchFromYard: string;
  deliveryToSiteLocation: string;
}

/**
 * Every required-field rule from this unit's own task, run entirely
 * client-side before the form ever reaches the server. Applied on every
 * save — Save Draft included — since every required field here is a real,
 * non-nullable database column (same reasoning as Steps 1/3's own
 * validation). Returns an empty array when the form is valid.
 */
export function validateErectionDeliveryStartFormValues(input: ErectionDeliveryStartFormValidationInput): string[] {
  const errors: string[] = [];

  if (!input.deliveryReferenceNo.trim()) errors.push('Delivery Reference No. is required.');
  if (!input.deliveryDate.trim()) errors.push('Delivery Date is required.');
  if (!input.plannedDeliveryWindowStart.trim()) errors.push('Planned Delivery Window Start is required.');
  if (!input.plannedDeliveryWindowEnd.trim()) errors.push('Planned Delivery Window End is required.');
  if (!input.transportMode.trim()) errors.push('Transport Mode is required.');
  if (!input.dispatchProductionSource.trim()) errors.push('Dispatch / Production Source is required.');
  if (!input.dispatchFromYard.trim()) errors.push('Dispatch From / Yard is required.');
  if (!input.deliveryToSiteLocation.trim()) errors.push('Delivery To Site / Location is required.');

  if (
    input.plannedDeliveryWindowStart.trim() &&
    input.plannedDeliveryWindowEnd.trim() &&
    new Date(input.plannedDeliveryWindowEnd) < new Date(input.plannedDeliveryWindowStart)
  ) {
    errors.push('Planned Delivery Window End cannot be before Planned Delivery Window Start.');
  }

  return errors;
}

/** Server-side floor mirrored client-side: Hold/Return require Comments (see assertCommentsPresentForHoldOrReturn in contract-erection-delivery-start.service.ts). */
export function validateErectionDeliveryStartHoldOrReturnComments(comments: string): string[] {
  return comments.trim() ? [] : ['Comments are required to place delivery on Hold or Return it.'];
}

export interface ErectionDeliveryItemFormRow {
  description: string;
  packageNo: string;
  weight: string;
  volume: string;
  quantity: string;
  status: ContractErectionDeliveryItemStatus;
}

/** Every item row must have a Description and a positive Quantity — the 2 real non-nullable columns. Weight/Volume/Package No. stay optional, matching the schema. */
export function validateErectionDeliveryItemRows(rows: ErectionDeliveryItemFormRow[]): string[] {
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const rowLabel = `Item ${index + 1}`;
    if (!row.description.trim()) errors.push(`${rowLabel}: Description is required.`);
    if (!row.quantity.trim() || Number(row.quantity) <= 0) errors.push(`${rowLabel}: Qty must be a positive number.`);
  });
  return errors;
}

/**
 * The approved design's "Ready to Start" badge state is never stored — it
 * is shown only for a DRAFT record whose required fields are all already
 * filled in, matching Steps 1/3's own computeDisplayStatus precedent
 * exactly.
 */
export function computeDisplayStatus(
  status: ContractErectionDeliveryStartStatus | null,
  validationErrors: string[],
): { label: string; badgeClasses: string } {
  if (status === null) {
    return { label: 'Draft', badgeClasses: ERECTION_DELIVERY_START_STATUS_BADGE_CLASSES.DRAFT };
  }
  if (status === 'DRAFT' && validationErrors.length === 0) {
    return { label: 'Ready to Start', badgeClasses: READY_TO_START_BADGE_CLASSES };
  }
  return { label: ERECTION_DELIVERY_START_STATUS_LABELS[status], badgeClasses: ERECTION_DELIVERY_START_STATUS_BADGE_CLASSES[status] };
}

export interface DeliveryTotalsPreviewInput {
  weight?: number | null;
  volume?: number | null;
  quantity: number;
}

export interface DeliveryTotalsPreview {
  totalPackages: number;
  totalWeight: number | null;
  totalVolume: number | null;
  totalItems: number;
}

/**
 * Client-side live preview mirroring computeDeliveryTotals in
 * contract-erection-delivery-start.service.ts exactly — the real,
 * authoritative totals are always recomputed server-side on save; this is
 * only for immediate on-screen feedback while editing item rows, per this
 * unit's own "Delivery summary must calculate from real item rows"
 * instruction.
 */
export function computeDeliveryTotalsPreview(items: DeliveryTotalsPreviewInput[]): DeliveryTotalsPreview {
  if (items.length === 0) {
    return { totalPackages: 0, totalWeight: null, totalVolume: null, totalItems: 0 };
  }
  return {
    totalPackages: items.length,
    totalWeight: items.reduce((sum, i) => sum + (i.weight ?? 0), 0),
    totalVolume: items.reduce((sum, i) => sum + (i.volume ?? 0), 0),
    totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
  };
}

/**
 * Step 4's own "Current Erection Step" contribution to the 7-step tracker:
 * Step 3 reads as completed once the schedule has been Issued (matching
 * this unit's own "Step 3 issued" acceptance criterion); Step 4 itself is
 * "current" until it reaches Started.
 */
export function computeErectionStepTrackerCurrentStep(
  scheduleStatus: 'DRAFT' | 'ISSUED' | 'HOLD' | 'RETURNED' | null,
  deliveryStartStatus: ContractErectionDeliveryStartStatus | null,
): number {
  if (scheduleStatus !== 'ISSUED') return 3;
  if (deliveryStartStatus === 'STARTED') return 5;
  return 4;
}
