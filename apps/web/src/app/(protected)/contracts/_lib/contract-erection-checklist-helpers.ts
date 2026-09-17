// ---------------------------------------------------------------------------
// CM-71G — Pure, presentation-agnostic helpers for the Erection Workflow,
// Step 6 (Erection Checklist) screen. Dependency-free so it can be unit
// tested directly, matching contract-erection-start-helpers.ts /
// contract-erection-delivery-start-helpers.ts.
// ---------------------------------------------------------------------------

import type {
  ContractErectionChecklistStatus,
  ContractErectionChecklistItemStatus,
} from '@/lib/contracts-api';

export const ERECTION_CHECKLIST_STATUS_LABELS: Record<ContractErectionChecklistStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED_FOR_VERIFICATION: 'Submitted for Verification',
  VERIFIED: 'Verified',
  HOLD: 'Hold',
  RETURNED: 'Returned',
};

export const ERECTION_CHECKLIST_STATUS_BADGE_CLASSES: Record<ContractErectionChecklistStatus, string> = {
  DRAFT: 'bg-surface-secondary text-text-muted',
  SUBMITTED_FOR_VERIFICATION: 'bg-info-light text-info',
  VERIFIED: 'bg-success-light text-success',
  HOLD: 'bg-warning-light text-warning',
  RETURNED: 'bg-error-light text-error',
};

/** "Ready for Verification" badge classes — computed frontend-only state, matching every earlier step's own READY_TO_X_BADGE_CLASSES precedent. */
export const READY_FOR_VERIFICATION_BADGE_CLASSES = 'bg-warning-light text-warning';

export const ERECTION_CHECKLIST_ITEM_STATUS_LABELS: Record<ContractErectionChecklistItemStatus, string> = {
  COMPLETED: 'Completed',
  IN_PROGRESS: 'In Progress',
  NOT_COMPLETED: 'Not Completed',
  NOT_APPLICABLE: 'Not Applicable',
};

export const ERECTION_CHECKLIST_ITEM_STATUS_BADGE_CLASSES: Record<ContractErectionChecklistItemStatus, string> = {
  COMPLETED: 'bg-success-light text-success',
  IN_PROGRESS: 'bg-info-light text-info',
  NOT_COMPLETED: 'bg-error-light text-error',
  NOT_APPLICABLE: 'bg-surface-secondary text-text-secondary',
};

export const ERECTION_CHECKLIST_TYPE_OPTIONS = [
  'Pre-Payment Erection Checklist',
  'QA/QC Verification Checklist',
  'Client Acknowledgement Checklist',
  'Final Erection Checklist',
  'Other',
] as const;

/** The 12 default checklist items this unit's own task specifies — matches DEFAULT_CHECKLIST_ITEMS on the backend exactly. Unlike Step 4/5's own fixed lists, users may add/remove rows beyond these defaults. */
export const ERECTION_CHECKLIST_DEFAULT_ITEMS = [
  'Approved Erection Method Statement Available',
  'Approved Erection Schedule Available',
  'Delivery Start Confirmed',
  'Material Receiving & Inspection Completed',
  'Material Test Certificates Available',
  'Equipment / Tools Available on Site',
  'Crane / Trailer Arrangement Verified',
  'Manpower Deployment Verified',
  'Site Access / Work Area Ready',
  'Erection Alignment / Installation Check Completed',
  'Safety Induction & Toolbox Talk Conducted',
  'Client / Consultant Acknowledgement Pending',
] as const;

export interface ErectionChecklistFormValidationInput {
  checklistRefNo: string;
  checklistDate: string;
  checklistType: string;
  preparedBy: string;
}

/**
 * Every required-field rule from this unit's own task that applies on
 * EVERY save (Save Draft included) — Checklist Ref. No., Checklist Date,
 * Checklist Type, and Prepared By are real non-nullable database columns
 * (Job Order No. is also required but is read-only/auto-fetched, so it is
 * never user-editable and needs no client-side check here), matching every
 * earlier step's own validation split.
 */
export function validateErectionChecklistFormValues(input: ErectionChecklistFormValidationInput): string[] {
  const errors: string[] = [];

  if (!input.checklistRefNo.trim()) errors.push('Checklist Ref. No. is required.');
  if (!input.checklistDate.trim()) errors.push('Checklist Date is required.');
  if (!input.checklistType.trim()) errors.push('Checklist Type is required.');
  if (!input.preparedBy.trim()) errors.push('Prepared By is required.');

  return errors;
}

/** Server-side floor mirrored client-side: Hold/Return require Comments (see assertCommentsPresentForHoldOrReturn in contract-erection-checklist.service.ts). */
export function validateErectionChecklistHoldOrReturnComments(comments: string): string[] {
  return comments.trim() ? [] : ['Comments are required to place the checklist on Hold or Return it.'];
}

/**
 * Submit for Verification's own stricter floor, mirrored client-side from
 * assertSubmitRequirementsMet on the backend: at least one checklist item
 * row must exist.
 */
export function validateErectionChecklistSubmitRequirements(itemCount: number): string[] {
  return itemCount > 0 ? [] : ['At least one checklist item row is required to submit for verification.'];
}

/**
 * The approved design's "Ready for Verification" badge state is never
 * stored — it is shown only for a DRAFT record whose required fields are
 * all already filled in, matching every earlier step's own
 * computeDisplayStatus precedent exactly.
 */
export function computeDisplayStatus(
  status: ContractErectionChecklistStatus | null,
  validationErrors: string[],
): { label: string; badgeClasses: string } {
  if (status === null) {
    return { label: 'Draft', badgeClasses: ERECTION_CHECKLIST_STATUS_BADGE_CLASSES.DRAFT };
  }
  if (status === 'DRAFT' && validationErrors.length === 0) {
    return { label: 'Ready for Verification', badgeClasses: READY_FOR_VERIFICATION_BADGE_CLASSES };
  }
  return { label: ERECTION_CHECKLIST_STATUS_LABELS[status], badgeClasses: ERECTION_CHECKLIST_STATUS_BADGE_CLASSES[status] };
}

export interface ChecklistItemsSummaryPreview {
  totalItems: number;
  completed: number;
  inProgress: number;
  notCompleted: number;
  notApplicable: number;
}

/**
 * Client-side live preview mirroring computeChecklistItemsSummary in
 * contract-erection-checklist.service.ts exactly — the real, authoritative
 * summary is always recomputed server-side on every read; this is only for
 * immediate on-screen feedback while editing checklist item rows, per this
 * unit's own "Checklist summary must calculate from real checklist rows"
 * instruction.
 */
export function computeChecklistItemsSummaryPreview(items: { status: ContractErectionChecklistItemStatus }[]): ChecklistItemsSummaryPreview {
  return {
    totalItems: items.length,
    completed: items.filter((i) => i.status === 'COMPLETED').length,
    inProgress: items.filter((i) => i.status === 'IN_PROGRESS').length,
    notCompleted: items.filter((i) => i.status === 'NOT_COMPLETED').length,
    notApplicable: items.filter((i) => i.status === 'NOT_APPLICABLE').length,
  };
}

/**
 * Step 6's own "Current Erection Step" contribution to the 7-step tracker:
 * Step 5 reads as completed once erection has reached Started (matching
 * this unit's own "Step 5 Started" acceptance criterion); Step 6 itself is
 * "current" until it reaches Submitted for Verification or Verified.
 */
export function computeErectionStepTrackerCurrentStep(
  erectionStartStatus: 'DRAFT' | 'STARTED' | 'HOLD' | 'RETURNED' | null,
  checklistStatus: ContractErectionChecklistStatus | null,
): number {
  if (erectionStartStatus !== 'STARTED') return 5;
  if (checklistStatus === 'SUBMITTED_FOR_VERIFICATION' || checklistStatus === 'VERIFIED') return 7;
  return 6;
}
