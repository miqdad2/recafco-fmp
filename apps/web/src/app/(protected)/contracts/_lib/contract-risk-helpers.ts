// ---------------------------------------------------------------------------
// CM-62 — Pure, presentation-agnostic helpers for the Contract Detail Risk
// Assessment tab. Not an ISO risk-scoring system: riskEvaluation and
// residualRisk are both plain manual dropdown values, never auto-calculated
// — this file contains no scoring/numeric-risk logic (the KPI strip's
// Average Residual Risk mapping lives on the backend, contract-risks.service.ts,
// documented there). Labels here are purely display re-labelings of the
// real backend enums — the stored value/DTOs are never renamed.
// Dependency-free so it can be unit tested directly, matching
// contract-variation-helpers.ts / contract-claim-detail-helpers.ts.
// ---------------------------------------------------------------------------

import type { ContractRiskLevel, ContractRiskResponse, ContractRiskStatus } from '@/lib/contracts-api';

export const RISK_LEVEL_LABELS: Record<ContractRiskLevel, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

/** Used for both Risk Evaluation and Residual Risk badges — same real level scale, escalating green→amber→red→solid red. */
export const RISK_LEVEL_BADGE_CLASSES: Record<ContractRiskLevel, string> = {
  LOW: 'bg-success-light text-success',
  MEDIUM: 'bg-warning-light text-warning',
  HIGH: 'bg-error-light text-error',
  CRITICAL: 'bg-error text-white',
};

export const RISK_RESPONSE_LABELS: Record<ContractRiskResponse, string> = {
  MITIGATE: 'Mitigate',
  ACCEPT: 'Accept',
  AVOID: 'Avoid',
  TRANSFER: 'Transfer',
};

/** Mitigate blue, Accept gray, Avoid red, Transfer purple. */
export const RISK_RESPONSE_BADGE_CLASSES: Record<ContractRiskResponse, string> = {
  MITIGATE: 'bg-info-light text-info',
  ACCEPT: 'bg-surface-secondary text-text-muted',
  AVOID: 'bg-error-light text-error',
  TRANSFER: 'bg-accent-light text-accent',
};

export const RISK_STATUS_LABELS: Record<ContractRiskStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  MITIGATED: 'Mitigated',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

export const RISK_STATUS_BADGE_CLASSES: Record<ContractRiskStatus, string> = {
  OPEN: 'bg-warning-light text-warning',
  IN_PROGRESS: 'bg-info-light text-info',
  MITIGATED: 'bg-success-light text-success',
  CLOSED: 'bg-success-light text-success',
  CANCELLED: 'bg-surface-secondary text-text-muted',
};

export interface RiskFilterOption {
  value: string;
  label: string;
}

export const RISK_LEVEL_OPTIONS: { value: ContractRiskLevel; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

export const RISK_LEVEL_FILTER_OPTIONS: RiskFilterOption[] = [{ value: '', label: 'All' }, ...RISK_LEVEL_OPTIONS];

export const RISK_RESPONSE_OPTIONS: { value: ContractRiskResponse; label: string }[] = [
  { value: 'MITIGATE', label: 'Mitigate' },
  { value: 'ACCEPT', label: 'Accept' },
  { value: 'AVOID', label: 'Avoid' },
  { value: 'TRANSFER', label: 'Transfer' },
];

export const RISK_RESPONSE_FILTER_OPTIONS: RiskFilterOption[] = [{ value: '', label: 'All' }, ...RISK_RESPONSE_OPTIONS];

export const RISK_STATUS_OPTIONS: { value: ContractRiskStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'MITIGATED', label: 'Mitigated' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const RISK_STATUS_FILTER_OPTIONS: RiskFilterOption[] = [{ value: '', label: 'All Status' }, ...RISK_STATUS_OPTIONS];

/**
 * Display text for the "Action Due Date" column's days indicator, real
 * signed value from risk.daysToDeadline — "—" only when the risk has no
 * action due date at all (never a fabricated number).
 */
export function formatDaysToDeadline(days: number | undefined): string {
  if (days === undefined) return '—';
  return String(days);
}
