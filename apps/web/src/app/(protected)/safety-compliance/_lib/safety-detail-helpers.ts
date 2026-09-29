import type { InspectionStatus } from '../../../../lib/safety-api';

/**
 * FMP-UI-21D — the short action label shown in the Inspection Summary
 * card's own "Next Step:" grid row (e.g. "Next Step: Schedule Inspection",
 * per the brief's own header example). Deliberately short — the FULL
 * explanatory sentence is `computeInspectionNextStep()` below, shown
 * separately in its own highlighted callout box, mirroring the same
 * short-label-plus-long-sentence split `computeTaskNextActionText()` /
 * `computeTaskNextStepGuidance()` already established for Factory Tasks
 * (FMP-UI-20G). Each label names only a REAL action this page's own
 * `SafetyInspectionTransitions` panel can actually perform for that
 * status — never a fabricated one.
 */
export function computeInspectionNextStepLabel(status: InspectionStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Schedule Inspection';
    case 'SCHEDULED':
      return 'Complete Inspection';
    case 'IN_PROGRESS':
      return 'Complete Inspection';
    case 'COMPLETED':
      return 'Review Findings';
    case 'CLOSED':
      return 'Reopen if Needed';
    case 'CANCELLED':
      return 'No Action Needed';
  }
}

/**
 * FMP-UI-21D — the Safety Inspection Detail page's Next Step callout. One
 * honest, plain-English sentence per real status, matching the exact
 * wording the brief itself specifies for DRAFT/SCHEDULED/COMPLETED; the
 * remaining statuses (IN_PROGRESS/CLOSED/CANCELLED) get an honest
 * extension in the same voice, each naming only a REAL next action this
 * page's own Available Actions panel can actually perform — never a
 * fabricated workflow step.
 */
export function computeInspectionNextStep(status: InspectionStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'This inspection is still in draft. Schedule it once inspector and date are confirmed.';
    case 'SCHEDULED':
      return 'This inspection is scheduled. Complete it after inspection is performed.';
    case 'IN_PROGRESS':
      return 'This inspection is in progress. Complete it once the on-site check is finished.';
    case 'COMPLETED':
      return 'Inspection completed. Review findings and corrective actions.';
    case 'CLOSED':
      return 'This inspection is closed. Reopen it if further action is needed.';
    case 'CANCELLED':
      return 'This inspection was cancelled. No further action is expected.';
  }
}

/**
 * FMP-UI-21D — human-readable labels for the Activity timeline's real event
 * keys (as logged to `safetyInspectionActivity` by `safety.service.ts`;
 * see that file's own `event:` literals — never the separate cross-module
 * `SAFETY_*`-prefixed audit-log events, which this page's own
 * `listActivities()` call never reads). Replaces raw
 * "INSPECTION_CREATED → DRAFT"-style keys with a real sentence.
 */
const ACTIVITY_EVENT_LABELS: Record<string, string> = {
  INSPECTION_CREATED: 'Inspection created',
  INSPECTION_SCHEDULED: 'Inspection scheduled',
  INSPECTION_STARTED: 'Inspection started',
  INSPECTION_COMPLETED: 'Inspection completed',
  INSPECTION_CLOSED: 'Inspection closed',
  INSPECTION_CANCELLED: 'Inspection cancelled',
  INSPECTION_REOPENED: 'Inspection reopened',
  FINDING_CREATED: 'Finding recorded',
  FINDING_ASSIGNED: 'Finding assigned',
  FINDING_ACTION_REQUIRED: 'Action required on finding',
  FINDING_RESOLVED: 'Finding resolved',
  FINDING_VERIFIED: 'Finding verified',
  FINDING_CLOSED: 'Finding closed',
  FINDING_REOPENED: 'Finding reopened',
  COMMENT_ADDED: 'Comment added',
};

/** Falls back to a Title Case version of the raw key for any event this map doesn't yet know about — never a raw UPPER_SNAKE string. */
export function formatActivityEventLabel(event: string): string {
  return ACTIVITY_EVENT_LABELS[event] ?? toTitleCase(event);
}

/** "IN_PROGRESS" → "In Progress". Used for both activity status lines and the Details panel. */
export function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(' ');
}
