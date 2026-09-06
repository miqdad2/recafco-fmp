// ---------------------------------------------------------------------------
// CM-65 — Pure, presentation-agnostic helpers for the Contract Detail Issue
// Log tab. Issue Log tracks a problem that has ALREADY happened and needs
// follow-up until resolved — never confused with Risk Assessment (future/
// potential risk). Dependency-free so it can be unit tested directly,
// matching contract-risk-helpers.ts / contract-document-obligation-helpers.ts.
// ---------------------------------------------------------------------------

import type { ContractIssuePriority, ContractIssueStatus } from '@/lib/contracts-api';

/**
 * The real backend category list (`CONTRACT_ISSUE_CATEGORIES` in
 * contract-ui-helpers.ts / create-contract-issue.dto.ts) has exactly 9
 * values, plain-string-validated (not a DB enum) — see CM-30. This unit's
 * approved design calls for 9 preferred manager-facing labels, which also
 * happens to be 9 — every real value maps to exactly one preferred label,
 * no category invented or dropped:
 *   Commercial  -> "Variation"        (a variation cost disagreement is a
 *                                       commercial dispute — matches this
 *                                       unit's own "Variation cost
 *                                       disagreement" example issue)
 *   Production  -> "Quality"          (a quality/test-report issue in this
 *                                       factory-manufacturing context is
 *                                       tracked under Production)
 *   Erection    -> "Site / Erection"
 *   Client      -> "Client Approval"
 *   Technical / Delivery / Document / Payment / Other -> unchanged
 * This is a display relabeling only — the stored `category` string on
 * ContractIssue and the real backend validation list are both untouched.
 */
export const ISSUE_CATEGORY_LABELS: Record<string, string> = {
  Payment: 'Payment',
  Document: 'Document',
  Delivery: 'Delivery',
  Technical: 'Technical',
  Erection: 'Site / Erection',
  Client: 'Client Approval',
  Commercial: 'Variation',
  Production: 'Quality',
  Other: 'Other',
};

export const ISSUE_CATEGORY_VALUES = Object.keys(ISSUE_CATEGORY_LABELS);

export function issueCategoryLabel(category: string | undefined): string {
  if (!category) return '—';
  return ISSUE_CATEGORY_LABELS[category] ?? category;
}

export const ISSUE_PRIORITY_LABELS: Record<ContractIssuePriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

/** Same escalation pattern as RISK_LEVEL_BADGE_CLASSES: gray -> amber -> red -> solid red. */
export const ISSUE_PRIORITY_BADGE_CLASSES: Record<ContractIssuePriority, string> = {
  LOW: 'bg-surface-secondary text-text-secondary',
  MEDIUM: 'bg-warning-light text-warning',
  HIGH: 'bg-error-light text-error',
  CRITICAL: 'bg-error text-white',
};

export const ISSUE_STATUS_LABELS: Record<ContractIssueStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  WAITING_RESPONSE: 'Waiting Response',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

/** Waiting Response uses `team-production` (real indigo) for a genuine purple — never this theme's `accent` token, which is RECAFCO brand red and reads as an error state (see CM-64C). */
export const ISSUE_STATUS_BADGE_CLASSES: Record<ContractIssueStatus, string> = {
  OPEN: 'bg-warning-light text-warning',
  IN_PROGRESS: 'bg-info-light text-info',
  WAITING_RESPONSE: 'bg-team-production-light text-team-production',
  RESOLVED: 'bg-success-light text-success',
  CLOSED: 'bg-surface-secondary text-text-muted',
  CANCELLED: 'bg-surface-secondary text-text-muted line-through',
};

export interface IssueFilterOption {
  value: string;
  label: string;
}

export const ISSUE_CATEGORY_FILTER_OPTIONS: IssueFilterOption[] = [
  { value: '', label: 'All Categories' },
  ...ISSUE_CATEGORY_VALUES.map((value) => ({ value, label: ISSUE_CATEGORY_LABELS[value]! })),
];

export const ISSUE_PRIORITY_FILTER_OPTIONS: IssueFilterOption[] = [
  { value: '', label: 'All Priorities' },
  ...(Object.keys(ISSUE_PRIORITY_LABELS) as ContractIssuePriority[]).map((value) => ({ value, label: ISSUE_PRIORITY_LABELS[value] })),
];

export const ISSUE_STATUS_FILTER_OPTIONS: IssueFilterOption[] = [
  { value: '', label: 'All Status' },
  ...(Object.keys(ISSUE_STATUS_LABELS) as ContractIssueStatus[]).map((value) => ({ value, label: ISSUE_STATUS_LABELS[value] })),
];

interface ActionDueDateFields {
  dueDate: string | undefined;
  status: ContractIssueStatus;
}

const RESOLVED_LIKE_STATUSES: ContractIssueStatus[] = ['RESOLVED', 'CLOSED', 'CANCELLED'];

/**
 * Signed days until Action Due Date (negative once past due); null when
 * there is no dueDate at all — never a fabricated number. Computed purely
 * client-side from the real dueDate string already on ContractIssue (the
 * backend's own `overdueDays`/`isOverdue` only cover the "already overdue"
 * case, not a future "days remaining" count needed for the amber "due
 * soon" state below).
 */
export function computeIssueDaysRemaining(dueDate: string | undefined, today: Date = new Date()): number | null {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T00:00:00Z`);
  const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return Math.round((due.getTime() - utcToday.getTime()) / (1000 * 60 * 60 * 24));
}

/** Within 30 days (inclusive), on an issue not already resolved/closed/cancelled — same 30-day window already established for Risk Assessment / Documents & Obligations. */
export function computeIssueIsDueSoon(fields: ActionDueDateFields, today: Date = new Date()): boolean {
  if (RESOLVED_LIKE_STATUSES.includes(fields.status)) return false;
  const days = computeIssueDaysRemaining(fields.dueDate, today);
  return days !== null && days >= 0 && days <= 30;
}

export function formatIssueDaysRemaining(days: number | null): string {
  if (days === null) return '—';
  return String(days);
}

// ---------------------------------------------------------------------------
// CM-70D — Add/Edit Issue modal UX: readable contract context, status-driven
// field requiredness, and pre-submit validation. Pure, dependency-free (no
// React) so they're directly unit-testable, matching
// contract-claim-detail-helpers.ts / contract-variation-helpers.ts /
// contract-production-helpers.ts. Backend's computeIssueSummary()
// (contract-issues.service.ts) and both issue DTOs are unchanged — these are
// frontend-only additions per this unit's own "prefer frontend/UI-validation
// only" instruction.
// ---------------------------------------------------------------------------

export interface IssueContractContext {
  referenceNumber: string;
  title: string;
  counterpartyName?: string;
}

/**
 * "CONTRACT-2026-000009 · GRM Boundary Wall & Yard Upgrade · Gulf Ready Mix
 * Co." — the readable contract identity shown in the Add/Edit Issue modal
 * instead of the raw contract UUID. Omits the counterparty segment only
 * when genuinely unavailable; never falls back to a UUID.
 */
export function formatIssueContractContext(contract: IssueContractContext): string {
  const parts = [contract.referenceNumber, contract.title];
  if (contract.counterpartyName) parts.push(contract.counterpartyName);
  return parts.join(' · ');
}

const RESPONSIBLE_PERSON_REQUIRED_STATUSES: ContractIssueStatus[] = ['OPEN', 'IN_PROGRESS'];
const ACTION_DUE_DATE_REQUIRED_STATUSES: ContractIssueStatus[] = ['OPEN', 'IN_PROGRESS'];
const RESOLUTION_REQUIRED_STATUSES: ContractIssueStatus[] = ['RESOLVED', 'CLOSED'];

/** Responsible Person is only required while the issue still needs active follow-up (Open/In Progress) — a Waiting Response/Resolved/Closed/Cancelled issue can legitimately have no one currently assigned. */
export function isResponsiblePersonRequired(status: ContractIssueStatus): boolean {
  return RESPONSIBLE_PERSON_REQUIRED_STATUSES.includes(status);
}

/** Action Due Date is only required while the issue is still actively being worked (Open/In Progress) — matches isResponsiblePersonRequired's own set. */
export function isActionDueDateRequired(status: ContractIssueStatus): boolean {
  return ACTION_DUE_DATE_REQUIRED_STATUSES.includes(status);
}

/** A Resolved/Closed issue needs a real resolution note or remarks — otherwise the log has no record of how/why it was closed. */
export function isResolutionRequired(status: ContractIssueStatus): boolean {
  return RESOLUTION_REQUIRED_STATUSES.includes(status);
}

export interface IssueFormValidationInput {
  title: string;
  status: ContractIssueStatus;
  responsibleUserId: string;
  raisedDate: string;
  dueDate: string;
  resolution: string;
  remarks: string;
}

/**
 * Every required-field and cross-field rule from this unit's own task, run
 * entirely client-side before the form ever reaches the server. Returns an
 * empty array when the form is valid. Category is deliberately never
 * required here — the backend DTO (create-contract-issue.dto.ts) already
 * leaves `category` fully optional (`@IsOptional`), confirmed during audit,
 * so this doesn't invent a stricter rule than the real backend enforces.
 */
export function validateIssueFormValues(input: IssueFormValidationInput): string[] {
  const errors: string[] = [];

  if (!input.title.trim()) {
    errors.push('Issue Title is required.');
  }

  if (isResponsiblePersonRequired(input.status) && !input.responsibleUserId.trim()) {
    errors.push('Responsible Person is required when status is Open or In Progress.');
  }

  if (isActionDueDateRequired(input.status) && !input.dueDate.trim()) {
    errors.push('Action Due Date is required when status is Open or In Progress.');
  }

  if (input.raisedDate.trim() && input.dueDate.trim() && input.dueDate < input.raisedDate) {
    errors.push('Action Due Date cannot be before Issue Raised Date.');
  }

  if (isResolutionRequired(input.status) && !input.resolution.trim() && !input.remarks.trim()) {
    errors.push('A Resolved or Closed issue needs a Resolution note or Remarks.');
  }

  return errors;
}
