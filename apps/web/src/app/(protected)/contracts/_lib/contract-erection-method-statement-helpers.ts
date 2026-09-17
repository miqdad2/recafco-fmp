// ---------------------------------------------------------------------------
// CM-71A — Pure, presentation-agnostic helpers for the Erection Workflow,
// Step 1 (Issue Erection Method Statement) screen. Dependency-free so it can
// be unit tested directly, matching contract-variation-helpers.ts /
// contract-production-helpers.ts.
// ---------------------------------------------------------------------------

import type { ContractErectionMethodStatementStatus } from '@/lib/contracts-api';

export const ERECTION_METHOD_STATEMENT_STATUS_LABELS: Record<ContractErectionMethodStatementStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED_FOR_APPROVAL: 'Submitted for Approval',
  ISSUED: 'Issued',
};

export const ERECTION_METHOD_STATEMENT_STATUS_BADGE_CLASSES: Record<ContractErectionMethodStatementStatus, string> = {
  DRAFT: 'bg-surface-secondary text-text-muted',
  SUBMITTED_FOR_APPROVAL: 'bg-info-light text-info',
  ISSUED: 'bg-success-light text-success',
};

/** "Ready to Issue" badge classes — computed frontend-only state, see badgeLabelFor() below. */
export const READY_TO_ISSUE_BADGE_CLASSES = 'bg-warning-light text-warning';

// ---------------------------------------------------------------------------
// The 7-step Erection Workflow tracker. Only Step 1 has a real screen in
// this unit — steps 2-7 are shown read-only/pending, per the approved
// design's own "show the full 7-step progress tracker as read-only/
// navigation-style UI" instruction. Purely presentational; no backend model
// tracks overall workflow progress today.
// ---------------------------------------------------------------------------

export interface ErectionWorkflowStep {
  step: number;
  label: string;
}

export const ERECTION_WORKFLOW_STEPS: ErectionWorkflowStep[] = [
  { step: 1, label: 'Issue Erection Method Statement' },
  // CM-71C — exact wording correction: "Erection Method Statement
  // Approval", never "Method Statement Approval" or "Erection Statement
  // Approval" (both explicitly disallowed by that unit's own task).
  { step: 2, label: 'Erection Method Statement Approval' },
  { step: 3, label: 'Issue Erection Schedule' },
  { step: 4, label: 'Delivery Start' },
  { step: 5, label: 'Erection Start' },
  { step: 6, label: 'Erection Checklist' },
  { step: 7, label: 'Payment Issued' },
];

export interface ErectionMethodStatementFormValidationInput {
  plannedIssueDate: string;
  methodStatementRefNo: string;
  jobOrderNo: string;
  workLocationYard: string;
  preparedBy: string;
  departmentArea: string;
  scopeDescription: string;
}

/**
 * Every required-field rule from this unit's own task, run entirely
 * client-side before the form ever reaches the server. Returns an empty
 * array when the form is valid.
 */
export function validateErectionMethodStatementFormValues(input: ErectionMethodStatementFormValidationInput): string[] {
  const errors: string[] = [];

  if (!input.plannedIssueDate.trim()) errors.push('Planned Issue Date is required.');
  if (!input.methodStatementRefNo.trim()) errors.push('Method Statement Ref. No. is required.');
  if (!input.jobOrderNo.trim()) errors.push('Job Order No. is required.');
  if (!input.workLocationYard.trim()) errors.push('Work Location / Yard is required.');
  if (!input.preparedBy.trim()) errors.push('Prepared By is required.');
  // CM-71H.4 — visible wording only ("Responsible Department / Team"); the underlying field/input name (departmentArea) is unchanged.
  if (!input.departmentArea.trim()) errors.push('Responsible Department / Team is required.');
  if (!input.scopeDescription.trim()) errors.push('Scope / Description is required.');

  return errors;
}

/**
 * The approved design's 4th badge state ("Ready to Issue") is never stored —
 * it is shown only for a DRAFT record whose required fields are all already
 * filled in (i.e. it would pass validateErectionMethodStatementFormValues()
 * right now), distinguishing "just started" Draft from "complete, about to
 * be issued" Draft without inventing a database status no server-side
 * transition ever writes.
 */
export function computeDisplayStatus(
  status: ContractErectionMethodStatementStatus | null,
  validationErrors: string[],
): { label: string; badgeClasses: string } {
  if (status === null) {
    return { label: 'Draft', badgeClasses: ERECTION_METHOD_STATEMENT_STATUS_BADGE_CLASSES.DRAFT };
  }
  if (status === 'DRAFT' && validationErrors.length === 0) {
    return { label: 'Ready to Issue', badgeClasses: READY_TO_ISSUE_BADGE_CLASSES };
  }
  return { label: ERECTION_METHOD_STATEMENT_STATUS_LABELS[status], badgeClasses: ERECTION_METHOD_STATEMENT_STATUS_BADGE_CLASSES[status] };
}
