// ---------------------------------------------------------------------------
// CM-71C — Pure, presentation-agnostic helpers for the Erection Workflow,
// Step 2 (Erection Method Statement Approval) screen. Dependency-free so it
// can be unit tested directly, matching contract-erection-method-statement-helpers.ts.
// ---------------------------------------------------------------------------

import type {
  ContractErectionMethodStatementApprovalReviewStatus,
  ContractErectionMethodStatementApprovalDecision,
} from '@/lib/contracts-api';

export const ERECTION_METHOD_STATEMENT_APPROVAL_STATUS_LABELS: Record<ContractErectionMethodStatementApprovalReviewStatus, string> = {
  PENDING_APPROVAL: 'Pending Approval',
  DRAFT_REVIEW: 'Draft Review',
  APPROVED: 'Approved',
  REVISION_REQUESTED: 'Revision Requested',
  REJECTED: 'Rejected',
};

export const ERECTION_METHOD_STATEMENT_APPROVAL_STATUS_BADGE_CLASSES: Record<ContractErectionMethodStatementApprovalReviewStatus, string> = {
  PENDING_APPROVAL: 'bg-warning-light text-warning',
  DRAFT_REVIEW: 'bg-surface-secondary text-text-secondary',
  APPROVED: 'bg-success-light text-success',
  REVISION_REQUESTED: 'bg-warning-light text-warning',
  REJECTED: 'bg-error-light text-error',
};

export const ERECTION_METHOD_STATEMENT_APPROVAL_DECISION_LABELS: Record<ContractErectionMethodStatementApprovalDecision, string> = {
  APPROVE: 'Approve',
  REQUEST_REVISION: 'Request Revision',
  REJECT: 'Reject',
};

export const ERECTION_METHOD_STATEMENT_APPROVAL_PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

export interface ErectionMethodStatementApprovalDraftValidationInput {
  reviewRequiredBy: string;
  reviewingEngineer: string;
  reviewType: string;
}

/**
 * Save Draft has a genuinely lenient floor — every field on this table is a
 * real nullable database column (unlike CM-71A's own Step 1 form, where
 * every required column is non-nullable). Nothing is required to save a
 * partial draft; this function always returns an empty array today and
 * exists mainly so a future, real "at minimum, X" draft rule has an
 * obvious, already-tested home rather than being bolted on inline.
 */
export function validateErectionMethodStatementApprovalDraftValues(input: ErectionMethodStatementApprovalDraftValidationInput): string[] {
  void input;
  return [];
}

export interface ErectionMethodStatementApprovalFinalValidationInput {
  reviewRequiredBy: string;
  reviewingEngineer: string;
  reviewType: string;
  comments: string;
}

/**
 * Required-field floor for the 3 final-decision buttons (Approve & Forward /
 * Request Revision / Reject) — every field marked `*` in this unit's own
 * task. Comments is required by the task's own explicit "Requires comments"
 * rule for Request Revision/Reject, and by the general field list's own `*`
 * for Approve — applied uniformly to all 3 rather than only 2, since the
 * general field list marks Comments/Review Notes required with no carve-out
 * for Approve. Mirrored server-side (assertCommentsPresentForFinalDecision
 * in contract-erection-method-statement-approval.service.ts) as the real
 * enforcement floor — this is for visible, immediate client-side UX only.
 */
export function validateErectionMethodStatementApprovalFinalValues(input: ErectionMethodStatementApprovalFinalValidationInput): string[] {
  const errors: string[] = [];

  if (!input.reviewRequiredBy.trim()) errors.push('Review Required By is required.');
  if (!input.reviewingEngineer.trim()) errors.push('Reviewing Engineer is required.');
  if (!input.reviewType.trim()) errors.push('Review Type is required.');
  if (!input.comments.trim()) errors.push('Comments / Review Notes are required.');

  return errors;
}

/**
 * Step 2's own "Current Erection Step" contribution to the 7-step tracker:
 * Step 1 reads as completed once the method statement has left Draft
 * (Submitted for Approval or Issued — matching this unit's own "Step 1
 * appears completed when method statement is submitted/issued" acceptance
 * criterion); Step 2 itself is "current" until it reaches a real terminal
 * state (Approved/Rejected) — Revision Requested deliberately stays
 * "current" too, since the workflow has looped back to Step 2, not
 * advanced past it.
 */
export function computeErectionStepTrackerCurrentStep(
  methodStatementStatus: 'DRAFT' | 'SUBMITTED_FOR_APPROVAL' | 'ISSUED' | null,
  approvalReviewStatus: ContractErectionMethodStatementApprovalReviewStatus | null,
): number {
  const step1Complete = methodStatementStatus === 'SUBMITTED_FOR_APPROVAL' || methodStatementStatus === 'ISSUED';
  if (!step1Complete) return 1;
  if (approvalReviewStatus === 'APPROVED') return 3;
  return 2;
}
