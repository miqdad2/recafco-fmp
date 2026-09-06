// ---------------------------------------------------------------------------
// CM-61 — Pure, presentation-agnostic helpers for the Contract Detail Claims
// tab. Claim type labels here are a manager-friendly re-labeling of the real
// ContractClaimType enum for THIS tab specifically ("Delay Claim", "EOT
// Claim", etc., per this unit's approved design) — deliberately a separate
// map from claims/_components/claim-type-badge.tsx's own labels (used by the
// module-level Claim Log, which keeps its original wording untouched). The
// stored enum value is never renamed either way. "VARIATION" is labeled
// "Variation Claim" (not part of the task's explicit list, which only gives
// 6 of the 7 real enum values) for consistency with the other "X Claim"
// labels — it is a claim TYPE category, not a link to an actual Variation /
// Change Order record, so this does not mix the two features together.
// Dependency-free so it can be unit tested directly, matching
// contract-payment-detail-helpers.ts / contract-production-helpers.ts /
// contract-variation-helpers.ts.
// ---------------------------------------------------------------------------

import type { ContractClaimType, ContractClaimStatus } from '@/lib/contracts-api';

export const CLAIM_TYPE_DETAIL_LABELS: Record<ContractClaimType, string> = {
  DELAY: 'Delay Claim',
  EXTENSION_OF_TIME: 'EOT Claim',
  PAYMENT: 'Payment Claim',
  DAMAGE: 'Damage Claim',
  SCOPE_CHANGE: 'Scope Change Claim',
  OTHER: 'Other',
  VARIATION: 'Variation Claim',
};

export interface ClaimFilterOption {
  value: string;
  label: string;
}

export const CLAIM_TYPE_FILTER_OPTIONS: ClaimFilterOption[] = [
  { value: '', label: 'All Types' },
  { value: 'DELAY', label: 'Delay Claim' },
  { value: 'EXTENSION_OF_TIME', label: 'EOT Claim' },
  { value: 'PAYMENT', label: 'Payment Claim' },
  { value: 'DAMAGE', label: 'Damage Claim' },
  { value: 'SCOPE_CHANGE', label: 'Scope Change Claim' },
  { value: 'VARIATION', label: 'Variation Claim' },
  { value: 'OTHER', label: 'Other' },
];

export const CLAIM_STATUS_FILTER_OPTIONS: ClaimFilterOption[] = [
  { value: '', label: 'All Status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_NEGOTIATION', label: 'Under Negotiation' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PARTIALLY_APPROVED', label: 'Partially Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SETTLED', label: 'Settled' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

/**
 * Display text for the "Days to Deadline" table column, real signed value
 * from claim.daysToDeadline — "—" only when the claim has no due date at
 * all (never a fabricated number).
 */
export function formatDaysToDeadline(days: number | null): string {
  if (days === null) return '—';
  return String(days);
}

// ---------------------------------------------------------------------------
// CM-70C — Add/Edit Claim modal UX: readable contract context, claim-type
// guidance, and pre-submit validation. Pure, dependency-free (no React) so
// they're directly unit-testable, matching contract-payment-detail-helpers.ts
// / contract-production-helpers.ts / contract-variation-helpers.ts. Backend's
// computeClaimSummary() (contract-claims.service.ts) and both claim DTOs are
// unchanged — these are frontend-only additions per this unit's own "prefer
// frontend/UI-validation only" instruction.
// ---------------------------------------------------------------------------

export interface ClaimContractContext {
  referenceNumber: string;
  title: string;
  counterpartyName?: string;
}

/**
 * "CONTRACT-2026-000009 · GRM Boundary Wall & Yard Upgrade · Gulf Ready Mix
 * Co." — the readable contract identity shown in the Add/Edit Claim modal
 * instead of the raw contract UUID. Omits the counterparty segment only
 * when genuinely unavailable; never falls back to a UUID.
 */
export function formatClaimContractContext(contract: ClaimContractContext): string {
  const parts = [contract.referenceNumber, contract.title];
  if (contract.counterpartyName) parts.push(contract.counterpartyName);
  return parts.join(' · ');
}

/**
 * Which fields matter most for a given claim type — guidance copy only,
 * never hides a field. EXTENSION_OF_TIME is the only real enum value that is
 * purely time-based; every other real type (Variation, Delay, Payment,
 * Damage, Scope Change) is treated as the task's own "Cost" case — there is
 * no separate COST enum value in the real backend schema, and adding one
 * would need a migration, out of scope for a frontend-only unit. OTHER gets
 * neutral guidance covering both.
 */
export type ClaimTypeGuidance = 'EOT' | 'VALUE' | 'BOTH';

export function getClaimTypeGuidance(claimType: ContractClaimType): ClaimTypeGuidance {
  if (claimType === 'EXTENSION_OF_TIME') return 'EOT';
  if (claimType === 'OTHER') return 'BOTH';
  return 'VALUE';
}

export const CLAIM_TYPE_GUIDANCE_TEXT: Record<ClaimTypeGuidance, string> = {
  EOT: 'This is a time-based (EOT) claim — EOT Claimed/Approved days are the important fields here. Submitted/Approved Value can stay 0 if there is no cost impact.',
  VALUE: 'This is a cost-based claim — Submitted/Approved Value are the important fields here. EOT Claimed/Approved can stay 0 if there is no time impact.',
  BOTH: 'This claim type can involve both cost and time impact — fill in whichever of Submitted/Approved Value and EOT Claimed/Approved actually applies.',
};

export interface ClaimFormValidationInput {
  claimTitle: string;
  status: ContractClaimStatus;
  submittedValue: string;
  approvedValue: string;
  eotClaimedDays: string;
  eotApprovedDays: string;
  eventDate: string;
  claimDate: string;
  dueDate: string;
}

/**
 * Every required-field and cross-field rule from this unit's own task, run
 * entirely client-side before the form ever reaches the server. Returns an
 * empty array when the form is valid. Backend DTOs already enforce Submitted
 * Value/Approved Value/EOT days >= 0 independently (@Min(0)); this adds the
 * cross-field rules the DTOs deliberately don't have.
 */
export function validateClaimFormValues(input: ClaimFormValidationInput): string[] {
  const errors: string[] = [];

  if (!input.claimTitle.trim()) {
    errors.push('Claim Title is required.');
  }

  const submitted = input.submittedValue.trim() ? Number(input.submittedValue) : null;
  const approved = input.approvedValue.trim() ? Number(input.approvedValue) : null;
  const eotClaimed = input.eotClaimedDays.trim() ? Number(input.eotClaimedDays) : null;
  const eotApproved = input.eotApprovedDays.trim() ? Number(input.eotApprovedDays) : null;

  if (submitted !== null && submitted < 0) errors.push('Submitted Value cannot be negative.');
  if (approved !== null && approved < 0) errors.push('Approved Value cannot be negative.');
  if (submitted !== null && approved !== null && approved > submitted) {
    errors.push('Approved Value cannot exceed Submitted Value.');
  }

  if (eotClaimed !== null && eotClaimed < 0) errors.push('EOT Claimed cannot be negative.');
  if (eotApproved !== null && eotApproved < 0) errors.push('EOT Approved cannot be negative.');
  if (eotClaimed !== null && eotApproved !== null && eotApproved > eotClaimed) {
    errors.push('EOT Approved cannot exceed EOT Claimed.');
  }

  if (input.status === 'APPROVED') {
    const hasApprovedValue = (approved ?? 0) > 0;
    const hasApprovedEot = (eotApproved ?? 0) > 0;
    if (!hasApprovedValue && !hasApprovedEot) {
      errors.push('An Approved claim needs a positive Approved Value or a positive EOT Approved.');
    }
    if (!input.claimDate.trim()) {
      errors.push('Claim Date is required when status is Approved.');
    }
  }

  if (input.eventDate.trim() && input.dueDate.trim() && input.dueDate < input.eventDate) {
    errors.push('Due Date cannot be before Event Date.');
  }
  if (input.eventDate.trim() && input.claimDate.trim() && input.claimDate < input.eventDate) {
    errors.push('Claim Date cannot be before Event Date.');
  }

  return errors;
}
