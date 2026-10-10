import type { ProductionTaskSummary } from './contract-overview-helpers';

/**
 * FMP-CONTRACT-07 — presentation-only helpers for the shared Contract
 * Overview (every allowed user sees it, not just managers). Nothing here
 * reads or changes business data; it only decides which wording / tone /
 * empty state the existing, already-fetched numbers should be shown with.
 */

// ---------------------------------------------------------------------------
// Attention Required — warning only when there is something to attend to.
// ---------------------------------------------------------------------------

export const ATTENTION_EMPTY_MESSAGE = 'No open items require attention.';

export type AttentionTone = 'warning' | 'neutral';

export function attentionTone(itemCount: number): AttentionTone {
  return itemCount > 0 ? 'warning' : 'neutral';
}

// ---------------------------------------------------------------------------
// Zero-data cards
// ---------------------------------------------------------------------------

export const PAYMENT_EMPTY_MESSAGE = 'No payment entries yet.';
export const PRODUCTION_EMPTY_MESSAGE = 'Production has not started yet.';
export const DOCUMENTS_EMPTY_MESSAGE = 'No attachments or pending obligations.';
export const PROGRESS_EMPTY_MESSAGE = 'No progress recorded yet.';

function isZeroAmount(value: string | undefined): boolean {
  if (value === undefined || value === '') return true;
  const n = parseFloat(value);
  return Number.isNaN(n) || n === 0;
}

export function isPaymentStatementEmpty(data: {
  totalInvoices: number;
  totalSubmitted: string;
  totalPaid: string;
  totalOutstanding: string;
  overdueValue: string;
}): boolean {
  return (
    data.totalInvoices === 0 &&
    isZeroAmount(data.totalSubmitted) &&
    isZeroAmount(data.totalPaid) &&
    isZeroAmount(data.totalOutstanding) &&
    isZeroAmount(data.overdueValue)
  );
}

export function isProductionSummaryEmpty(summary: ProductionTaskSummary): boolean {
  return summary.total === 0 && summary.completed === 0 && summary.inProgress === 0 && summary.pending === 0 && summary.overdue === 0;
}

/** Pending Obligations has no backing data (always "—"), so only the attachment count decides. */
export function isDocumentsSummaryEmpty(totalAttachments: number): boolean {
  return totalAttachments === 0;
}

export function isAllProgressZero(percents: readonly number[]): boolean {
  return percents.every((p) => p === 0);
}

// ---------------------------------------------------------------------------
// Schedule Status badge (distinct from Contract Status). Uses the existing
// Contract.scheduleStatus values/labels; empty stays neutral ("—").
// ---------------------------------------------------------------------------

const SCHEDULE_BADGE_TONE: Record<string, string> = {
  IN_PROGRESS: 'bg-info/10 text-info border border-info/30',
  ON_TRACK: 'bg-success/10 text-success border border-success/30',
  AHEAD_OF_SCHEDULE: 'bg-success/10 text-success border border-success/30',
  DELAYED: 'bg-warning/10 text-warning border border-warning/30',
  COMPLETED: 'bg-success/10 text-success border border-success/30',
};

/** Badge classes for a set Schedule Status: Delayed = warning, Completed/On Track = positive. */
export function scheduleBadgeClass(value: string): string {
  return SCHEDULE_BADGE_TONE[value] ?? 'bg-surface-secondary text-text-secondary border border-border';
}

// ---------------------------------------------------------------------------
// Role-neutral wording: the section titles the Overview is allowed to use.
// ---------------------------------------------------------------------------

export const OVERVIEW_SECTION_TITLES = [
  'Contract Summary',
  'Scope of Work',
  'Payment Terms',
  'Progress Summary',
  'Attention Required',
  'Payment Statement Summary',
  'Production Summary',
  'Documents & Obligations',
] as const;

/** Phrases that frame the shared Overview as management-only; must never appear in its components. */
export const MANAGER_ONLY_WORDING = ['Executive summary', 'Management overview', 'Manager action center'] as const;

// ---------------------------------------------------------------------------
// FMP-CONTRACT-08 — final polish
// ---------------------------------------------------------------------------

/** Attention card title: only "Attention Required" when there is something to attend to. */
export function attentionTitle(itemCount: number): string {
  return itemCount > 0 ? 'Attention Required' : 'No Attention Required';
}

/** One-line status for the Production Summary, matching the actual task state. */
export function productionStatusMessage(summary: ProductionTaskSummary): string {
  if (summary.total === 0) return PRODUCTION_EMPTY_MESSAGE;
  if (summary.completed === summary.total) return 'Production tasks completed.';
  if (summary.inProgress > 0) return 'Production is in progress.';
  if (summary.completed > 0 && summary.pending > 0) return 'Production activity has started.';
  return 'Production tasks are pending.';
}

export type SummaryFieldKey =
  | 'projectName'
  | 'companyName'
  | 'jobOrder'
  | 'contractStatus'
  | 'daysRemaining'
  | 'currentValue'
  | 'date'
  | 'quotation'
  | 'projectNumber'
  | 'contractManager'
  | 'scheduleStatus';

export interface SummaryField {
  key: SummaryFieldKey;
  label: string;
}

/**
 * Contract Summary layout: row 1 = key facts, row 2 = key status, row 3 =
 * secondary details. Every pre-existing field appears exactly once.
 */
export const CONTRACT_SUMMARY_LAYOUT: { keyFacts: SummaryField[]; keyStatus: SummaryField[]; secondary: SummaryField[] } = {
  keyFacts: [
    { key: 'projectName', label: 'Project Name' },
    { key: 'companyName', label: 'Company Name' },
    { key: 'jobOrder', label: 'Job Order' },
  ],
  keyStatus: [
    { key: 'contractStatus', label: 'Contract Status' },
    { key: 'daysRemaining', label: 'Days Remaining' },
    { key: 'currentValue', label: 'Current Contract Value' },
  ],
  secondary: [
    { key: 'date', label: 'Date' },
    { key: 'quotation', label: 'Quotation #' },
    { key: 'projectNumber', label: 'Project Number' },
    { key: 'contractManager', label: 'Contract Manager' },
    { key: 'scheduleStatus', label: 'Schedule Status' },
  ],
};
