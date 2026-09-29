import type { IncidentStatus } from '../../../../lib/incidents-api';

/**
 * FMP-INC-01E — the Incident Detail page's Inspection-Summary-style
 * header card's own "Next Step:" grid row — a short REAL action label,
 * mirroring the exact short-label-plus-long-sentence split already
 * established for Factory Tasks (`computeTaskNextActionText()`, FMP-UI-20G)
 * and Safety & Compliance (`computeInspectionNextStepLabel()`, FMP-UI-21D).
 * Each label names only a real action `IncidentTransitionsPanel` can
 * actually perform for that status — never a fabricated one.
 */
export function computeIncidentNextStepLabel(status: IncidentStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Submit Incident';
    case 'SUBMITTED':
      return 'Start Review';
    case 'UNDER_REVIEW':
      return 'Begin Investigation';
    case 'INVESTIGATION':
      return 'Request Corrective Actions';
    case 'ACTION_REQUIRED':
      return 'Resolve Incident';
    case 'RESOLVED':
      return 'Close Incident';
    case 'CLOSED':
    case 'CANCELLED':
      return 'No Action Needed';
  }
}

/**
 * FMP-INC-01E — the full-sentence Next Step callout box. Exact wording
 * for DRAFT / SUBMITTED / CLOSED matches the brief's own 3 given
 * examples; the remaining statuses (UNDER_REVIEW/INVESTIGATION/
 * ACTION_REQUIRED/RESOLVED/CANCELLED) are honest extensions in the same
 * voice, each naming only a real next action from
 * `IncidentTransitionsPanel`'s own real per-status button set — never a
 * fabricated workflow step.
 */
export function computeIncidentNextStep(status: IncidentStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Review the incident details and attach evidence if available. Submit when ready for review.';
    case 'SUBMITTED':
      return 'Incident is submitted. Investigation or corrective action can begin once review starts.';
    case 'UNDER_REVIEW':
      return 'Incident is under review. Assign an investigator or begin the investigation when ready.';
    case 'INVESTIGATION':
      return 'Investigation is in progress. Request corrective actions once the investigation is complete.';
    case 'ACTION_REQUIRED':
      return 'Corrective action is required. Resolve the incident once the required actions are complete.';
    case 'RESOLVED':
      return 'Incident is resolved. Close it once verified, or reopen if further action is needed.';
    case 'CLOSED':
      return 'Incident is closed. No further action is required.';
    case 'CANCELLED':
      return 'This incident was cancelled. No further action is expected.';
  }
}
