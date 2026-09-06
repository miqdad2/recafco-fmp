// ---------------------------------------------------------------------------
// CM-63 — Pure, presentation-agnostic helpers for the Contract Detail
// Documents & Obligations tab. Not linked to SAP or any external system —
// `status` is always a plain manual dropdown value, set only by a manager;
// this file contains no auto-status-override logic (the KPI strip's
// Expiring Soon / Expired-Overdue derivation lives on the backend,
// contract-document-obligations.service.ts, documented there). Labels here
// are purely display re-labelings of the real backend enums — the stored
// value/DTOs are never renamed.
// Dependency-free so it can be unit tested directly, matching
// contract-risk-helpers.ts / contract-variation-helpers.ts.
// ---------------------------------------------------------------------------

import type { ContractDocumentObligationCategory, ContractDocumentObligationStatus } from '@/lib/contracts-api';

export const DOCUMENT_OBLIGATION_CATEGORY_LABELS: Record<ContractDocumentObligationCategory, string> = {
  PERFORMANCE_BOND: 'Performance Bond',
  INSURANCE: 'Insurance',
  GUARANTEE: 'Guarantee',
  TAX_STATUTORY: 'Tax / Statutory',
  TECHNICAL_SUBMISSION: 'Technical Submission',
  APPROVAL_DOCUMENT: 'Approval Document',
  HEALTH_SAFETY: 'Health & Safety',
  OTHER: 'Other',
};

export const DOCUMENT_OBLIGATION_CATEGORY_BADGE_CLASSES: Record<ContractDocumentObligationCategory, string> = {
  PERFORMANCE_BOND: 'bg-success-light text-success',
  INSURANCE: 'bg-accent-light text-accent',
  GUARANTEE: 'bg-teal-light text-teal',
  TAX_STATUTORY: 'bg-warning-light text-warning',
  TECHNICAL_SUBMISSION: 'bg-info-light text-info',
  APPROVAL_DOCUMENT: 'bg-team-production-light text-team-production',
  HEALTH_SAFETY: 'bg-error-light text-error',
  OTHER: 'bg-surface-secondary text-text-muted',
};

export const DOCUMENT_OBLIGATION_STATUS_LABELS: Record<ContractDocumentObligationStatus, string> = {
  PENDING: 'Pending',
  SUBMITTED: 'Submitted',
  EXPIRING_SOON: 'Expiring Soon',
  EXPIRED_OVERDUE: 'Expired / Overdue',
  NOT_REQUIRED: 'Not Required',
  CANCELLED: 'Cancelled',
};

/** Submitted green, Pending amber, Expiring Soon purple, Expired / Overdue red, Not Required/Cancelled gray. */
export const DOCUMENT_OBLIGATION_STATUS_BADGE_CLASSES: Record<ContractDocumentObligationStatus, string> = {
  PENDING: 'bg-warning-light text-warning',
  SUBMITTED: 'bg-success-light text-success',
  EXPIRING_SOON: 'bg-accent-light text-accent',
  EXPIRED_OVERDUE: 'bg-error-light text-error',
  NOT_REQUIRED: 'bg-surface-secondary text-text-muted',
  CANCELLED: 'bg-surface-secondary text-text-muted',
};

export interface DocumentObligationFilterOption {
  value: string;
  label: string;
}

export const DOCUMENT_OBLIGATION_CATEGORY_OPTIONS: { value: ContractDocumentObligationCategory; label: string }[] = [
  { value: 'PERFORMANCE_BOND', label: 'Performance Bond' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'GUARANTEE', label: 'Guarantee' },
  { value: 'TAX_STATUTORY', label: 'Tax / Statutory' },
  { value: 'TECHNICAL_SUBMISSION', label: 'Technical Submission' },
  { value: 'APPROVAL_DOCUMENT', label: 'Approval Document' },
  { value: 'HEALTH_SAFETY', label: 'Health & Safety' },
  { value: 'OTHER', label: 'Other' },
];

export const DOCUMENT_OBLIGATION_CATEGORY_FILTER_OPTIONS: DocumentObligationFilterOption[] = [
  { value: '', label: 'All Categories' },
  ...DOCUMENT_OBLIGATION_CATEGORY_OPTIONS,
];

export const DOCUMENT_OBLIGATION_STATUS_OPTIONS: { value: ContractDocumentObligationStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'EXPIRING_SOON', label: 'Expiring Soon' },
  { value: 'EXPIRED_OVERDUE', label: 'Expired / Overdue' },
  { value: 'NOT_REQUIRED', label: 'Not Required' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const DOCUMENT_OBLIGATION_STATUS_FILTER_OPTIONS: DocumentObligationFilterOption[] = [
  { value: '', label: 'All Status' },
  ...DOCUMENT_OBLIGATION_STATUS_OPTIONS,
];

/**
 * Display text for the "Days Remaining" column, real signed value from
 * item.daysRemaining — "—" only when the item has no effective expiry date
 * at all (never a fabricated number).
 */
export function formatDaysRemaining(days: number | undefined): string {
  if (days === undefined) return '—';
  return String(days);
}

// ---------------------------------------------------------------------------
// CM-70E — Add/Edit Document modal validation. Pure, dependency-free (no
// React) so it's directly unit-testable, matching contract-claim-detail-helpers.ts
// / contract-issue-detail-helpers.ts / contract-variation-helpers.ts. Audit
// found no backend cross-field date rule beyond the two below — Submission
// Date is deliberately never required to be on/after Required Date (a
// document can be submitted early), matching this unit's own instruction.
// ---------------------------------------------------------------------------

export interface DocumentObligationFormValidationInput {
  title: string;
  submissionDate: string;
  expiryDate: string;
}

/**
 * Every required-field and cross-field rule from this unit's own task, run
 * entirely client-side before the form ever reaches the server. Returns an
 * empty array when the form is valid.
 */
export function validateDocumentObligationFormValues(input: DocumentObligationFormValidationInput): string[] {
  const errors: string[] = [];

  if (!input.title.trim()) {
    errors.push('Document / Obligation is required.');
  }

  if (input.submissionDate.trim() && input.expiryDate.trim() && input.expiryDate < input.submissionDate) {
    errors.push('Expiry Date cannot be before Submission Date.');
  }

  return errors;
}
