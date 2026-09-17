// ---------------------------------------------------------------------------
// CM-71F — Pure, presentation-agnostic helpers for the Erection Workflow,
// Step 5 (Erection Start) screen. Dependency-free so it can be unit tested
// directly, matching contract-erection-delivery-start-helpers.ts /
// contract-erection-schedule-helpers.ts.
// ---------------------------------------------------------------------------

import type {
  ContractErectionStartStatus,
  ContractErectionStartChecklistStatus,
} from '@/lib/contracts-api';

export const ERECTION_START_STATUS_LABELS: Record<ContractErectionStartStatus, string> = {
  DRAFT: 'Draft',
  STARTED: 'Started',
  HOLD: 'Hold',
  RETURNED: 'Returned',
};

export const ERECTION_START_STATUS_BADGE_CLASSES: Record<ContractErectionStartStatus, string> = {
  DRAFT: 'bg-surface-secondary text-text-muted',
  STARTED: 'bg-success-light text-success',
  HOLD: 'bg-warning-light text-warning',
  RETURNED: 'bg-error-light text-error',
};

/** "Ready to Start" badge classes — computed frontend-only state, matching every earlier step's own READY_TO_X_BADGE_CLASSES precedent. */
export const READY_TO_START_BADGE_CLASSES = 'bg-warning-light text-warning';

export const ERECTION_START_CHECKLIST_STATUS_LABELS: Record<ContractErectionStartChecklistStatus, string> = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  NOT_APPLICABLE: 'Not Applicable',
};

export const ERECTION_START_CHECKLIST_STATUS_BADGE_CLASSES: Record<ContractErectionStartChecklistStatus, string> = {
  PENDING: 'bg-surface-secondary text-text-muted',
  COMPLETED: 'bg-success-light text-success',
  NOT_APPLICABLE: 'bg-surface-secondary text-text-secondary',
};

/** The 10 default Manpower / Work Activity trades this unit's own task specifies — matches DEFAULT_MANPOWER_TRADES on the backend exactly. */
export const ERECTION_START_DEFAULT_MANPOWER_TRADES = [
  'Rigger', 'Mason', 'Welder', 'Foreman', 'Helper', 'Carpenter', 'Steel Fixer', 'Crane Operator', 'Trailer Driver', 'Other',
] as const;

/** The fixed 10-item pre-erection checklist this unit's own task specifies — matches CONTRACT_ERECTION_START_CHECKLIST_ITEMS on the backend exactly. */
export const ERECTION_START_CHECKLIST_ITEMS = [
  'Method Statement Reviewed',
  'Erection Schedule Reviewed',
  'Delivery Confirmed',
  'Site Access Confirmed',
  'Crane / Trailer Arranged',
  'Tools & Tackles Checked',
  'Manpower Available',
  'Pre-Erection Meeting Conducted',
  'Weather Acceptable',
  'Work Area Ready',
] as const;

/** Suggested equipment types — a plain option list, never a validated enum, since a site can type its own value. */
export const ERECTION_START_EQUIPMENT_TYPE_OPTIONS = ['Crane', 'Trailer', 'Rental Equipment', 'Tools & Tackles', 'Other'] as const;

/** Suggested crane capacities — a plain option list for the Description / Capacity field, never a validated enum. */
export const ERECTION_START_CRANE_CAPACITY_OPTIONS = ['30 T', '50 T', '60 T', '80 T', '100 T', 'Other'] as const;

export interface ErectionStartFormValidationInput {
  workLocationYard: string;
  erectionCrewTeam: string;
  supervisor: string;
  scopeOfWorkToday: string;
}

/**
 * Every required-field rule from this unit's own task that applies on
 * EVERY save (Save Draft included) — Work Location/Yard, Erection Crew/
 * Team, Supervisor, and Scope of Work Today are real non-nullable database
 * columns (same reasoning as Steps 1/3/4). Actual Start Date/Time and the
 * manpower-row requirement are deliberately NOT checked here — they only
 * apply to Confirm Erection Start (see validateConfirmRequirements below),
 * matching this unit's own "Confirm ... Requires at least" wording.
 */
export function validateErectionStartFormValues(input: ErectionStartFormValidationInput): string[] {
  const errors: string[] = [];

  if (!input.workLocationYard.trim()) errors.push('Work Location / Yard is required.');
  if (!input.erectionCrewTeam.trim()) errors.push('Erection Crew / Team is required.');
  if (!input.supervisor.trim()) errors.push('Supervisor is required.');
  if (!input.scopeOfWorkToday.trim()) errors.push('Scope of Work Today is required.');

  return errors;
}

/** Server-side floor mirrored client-side: Hold/Return require Comments (see assertCommentsPresentForHoldOrReturn in contract-erection-start.service.ts). */
export function validateErectionStartHoldOrReturnComments(comments: string): string[] {
  return comments.trim() ? [] : ['Comments are required to place erection start on Hold or Return it.'];
}

export interface ErectionStartManpowerFormRow {
  trade: string;
  plannedNos: string;
  actualDeployedNos: string;
  remarks: string;
}

/**
 * Confirm Erection Start's own stricter floor, mirrored client-side from
 * assertConfirmRequirementsMet on the backend: Actual Start Date/Time and
 * at least one manpower row with a positive Actual Deployed count. The
 * crane/trailer equipment requirement is deliberately NOT enforced here
 * either — this unit's own "if applicable" wording means it cannot be
 * reliably determined automatically.
 */
export function validateErectionStartConfirmRequirements(
  actualStartDateTime: string,
  manpowerRows: ErectionStartManpowerFormRow[],
): string[] {
  const errors: string[] = [];
  if (!actualStartDateTime.trim()) errors.push('Actual Start Date / Time is required to confirm Erection Start.');
  if (!manpowerRows.some((r) => Number(r.actualDeployedNos) > 0)) {
    errors.push('At least one manpower/work activity row must have Actual Deployed Nos. greater than 0.');
  }
  return errors;
}

/**
 * The approved design's "Ready to Start" badge state is never stored — it
 * is shown only for a DRAFT record whose required fields are all already
 * filled in, matching every earlier step's own computeDisplayStatus
 * precedent exactly.
 */
export function computeDisplayStatus(
  status: ContractErectionStartStatus | null,
  validationErrors: string[],
): { label: string; badgeClasses: string } {
  if (status === null) {
    return { label: 'Draft', badgeClasses: ERECTION_START_STATUS_BADGE_CLASSES.DRAFT };
  }
  if (status === 'DRAFT' && validationErrors.length === 0) {
    return { label: 'Ready to Start', badgeClasses: READY_TO_START_BADGE_CLASSES };
  }
  return { label: ERECTION_START_STATUS_LABELS[status], badgeClasses: ERECTION_START_STATUS_BADGE_CLASSES[status] };
}

export interface ResourcesSummaryPreviewInput {
  manpowerRows: { actualDeployedNos: string }[];
  equipmentRows: { equipmentType: string; assignedQty: string }[];
}

export interface ResourcesSummaryPreview {
  totalManpower: number;
  totalEquipment: number;
  craneAssigned: number;
  trailerAssigned: number;
}

/**
 * Client-side live preview mirroring computeResourcesSummary in
 * contract-erection-start.service.ts exactly — the real, authoritative
 * summary is always recomputed server-side on every read; this is only for
 * immediate on-screen feedback while editing manpower/equipment rows, per
 * this unit's own "Resources Summary must calculate from real rows"
 * instruction.
 */
export function computeResourcesSummaryPreview(input: ResourcesSummaryPreviewInput): ResourcesSummaryPreview {
  const totalManpower = input.manpowerRows.reduce((sum, r) => sum + (Number(r.actualDeployedNos) || 0), 0);
  const totalEquipment = input.equipmentRows.reduce((sum, r) => sum + (Number(r.assignedQty) || 0), 0);
  const craneAssigned = input.equipmentRows.filter((r) => r.equipmentType.toLowerCase().includes('crane')).length;
  const trailerAssigned = input.equipmentRows.filter((r) => r.equipmentType.toLowerCase().includes('trailer')).length;
  return { totalManpower, totalEquipment, craneAssigned, trailerAssigned };
}

/**
 * Step 5's own "Current Erection Step" contribution to the 7-step tracker:
 * Step 4 reads as completed once delivery has reached Started (matching
 * this unit's own "Step 4 Started" acceptance criterion); Step 5 itself is
 * "current" until it reaches Started.
 */
export function computeErectionStepTrackerCurrentStep(
  deliveryStartStatus: 'DRAFT' | 'STARTED' | 'HOLD' | 'RETURNED' | null,
  erectionStartStatus: ContractErectionStartStatus | null,
): number {
  if (deliveryStartStatus !== 'STARTED') return 4;
  if (erectionStartStatus === 'STARTED') return 6;
  return 5;
}
