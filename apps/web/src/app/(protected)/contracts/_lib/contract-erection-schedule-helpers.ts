// ---------------------------------------------------------------------------
// CM-71D — Pure, presentation-agnostic helpers for the Erection Workflow,
// Step 3 (Issue Erection Schedule) screen. Dependency-free so it can be unit
// tested directly, matching contract-erection-method-statement-helpers.ts /
// contract-erection-method-statement-approval-helpers.ts.
// ---------------------------------------------------------------------------

import type { ContractErectionScheduleStatus } from '@/lib/contracts-api';

export const ERECTION_SCHEDULE_STATUS_LABELS: Record<ContractErectionScheduleStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  HOLD: 'Hold',
  RETURNED: 'Returned',
};

export const ERECTION_SCHEDULE_STATUS_BADGE_CLASSES: Record<ContractErectionScheduleStatus, string> = {
  DRAFT: 'bg-surface-secondary text-text-muted',
  ISSUED: 'bg-success-light text-success',
  HOLD: 'bg-warning-light text-warning',
  RETURNED: 'bg-error-light text-error',
};

/** "Ready to Issue" badge classes — computed frontend-only state, matching Step 1's own READY_TO_ISSUE_BADGE_CLASSES precedent. */
export const READY_TO_ISSUE_BADGE_CLASSES = 'bg-warning-light text-warning';

export interface ErectionScheduleFormValidationInput {
  scheduleReferenceNo: string;
  scheduleDate: string;
  plannedStartDate: string;
  plannedEndDate: string;
  jobOrderNo: string;
  erectionCrewTeam: string;
  estimatedManpowerPlanned: string;
  requiredEquipmentPlanned: string;
  preparedBy: string;
}

/**
 * Every required-field rule from this unit's own task, run entirely
 * client-side before the form ever reaches the server. Applied on every
 * save — Save Draft included — since every required field here is a real,
 * non-nullable database column (same reasoning as Step 1's own
 * validateErectionMethodStatementFormValues; unlike Step 2, where every
 * field is genuinely nullable). Returns an empty array when the form is
 * valid.
 */
export function validateErectionScheduleFormValues(input: ErectionScheduleFormValidationInput): string[] {
  const errors: string[] = [];

  if (!input.scheduleReferenceNo.trim()) errors.push('Schedule Reference No. is required.');
  if (!input.scheduleDate.trim()) errors.push('Schedule Date is required.');
  if (!input.plannedStartDate.trim()) errors.push('Planned Start Date is required.');
  if (!input.plannedEndDate.trim()) errors.push('Planned End Date is required.');
  if (!input.jobOrderNo.trim()) errors.push('Job Order No. is required.');
  if (!input.erectionCrewTeam.trim()) errors.push('Erection Crew/Team is required.');
  if (!input.estimatedManpowerPlanned.trim()) errors.push('Estimated Manpower Planned is required.');
  if (!input.requiredEquipmentPlanned.trim()) errors.push('Required Equipment Planned is required.');
  if (!input.preparedBy.trim()) errors.push('Prepared By is required.');

  if (
    input.plannedStartDate.trim() &&
    input.plannedEndDate.trim() &&
    new Date(input.plannedEndDate) < new Date(input.plannedStartDate)
  ) {
    errors.push('Planned End Date cannot be before Planned Start Date.');
  }

  return errors;
}

/** Server-side floor mirrored client-side: Hold/Return require Remarks (see assertRemarksPresentForHoldOrReturn in contract-erection-schedule.service.ts). */
export function validateErectionScheduleHoldOrReturnRemarks(remarks: string): string[] {
  return remarks.trim() ? [] : ['Remarks are required to place the schedule on Hold or Return it.'];
}

/**
 * The approved design's "Ready to Issue" badge state is never stored — it is
 * shown only for a DRAFT record whose required fields are all already
 * filled in, matching Step 1's own computeDisplayStatus precedent exactly.
 */
export function computeDisplayStatus(
  status: ContractErectionScheduleStatus | null,
  validationErrors: string[],
): { label: string; badgeClasses: string } {
  if (status === null) {
    return { label: 'Draft', badgeClasses: ERECTION_SCHEDULE_STATUS_BADGE_CLASSES.DRAFT };
  }
  if (status === 'DRAFT' && validationErrors.length === 0) {
    return { label: 'Ready to Issue', badgeClasses: READY_TO_ISSUE_BADGE_CLASSES };
  }
  return { label: ERECTION_SCHEDULE_STATUS_LABELS[status], badgeClasses: ERECTION_SCHEDULE_STATUS_BADGE_CLASSES[status] };
}

/**
 * Planned Duration (days) between Planned Start and Planned End — computed,
 * never a stored/user-entered field. Returns null when either date is
 * missing or invalid, so the caller can render "—" honestly rather than 0.
 */
export function computePlannedDurationDays(plannedStartDate: string, plannedEndDate: string): number | null {
  if (!plannedStartDate.trim() || !plannedEndDate.trim()) return null;
  const start = new Date(plannedStartDate);
  const end = new Date(plannedEndDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Step 3's own "Current Erection Step" contribution to the 7-step tracker:
 * Step 2 reads as completed once the review has reached Approved (matching
 * this unit's own "Step 2 completed when approval approved" acceptance
 * criterion); Step 3 itself is "current" until the schedule is Issued.
 */
export function computeErectionStepTrackerCurrentStep(
  approvalReviewStatus: 'PENDING_APPROVAL' | 'DRAFT_REVIEW' | 'APPROVED' | 'REVISION_REQUESTED' | 'REJECTED' | null,
  scheduleStatus: ContractErectionScheduleStatus | null,
): number {
  if (approvalReviewStatus !== 'APPROVED') return 2;
  if (scheduleStatus === 'ISSUED') return 4;
  return 3;
}
