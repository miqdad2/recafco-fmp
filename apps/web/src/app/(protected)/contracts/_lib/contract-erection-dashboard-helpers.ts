// ---------------------------------------------------------------------------
// CM-71B — Pure, presentation-agnostic helpers for the Erection Manager
// Dashboard / Work Queue. Dependency-free so it can be unit tested directly,
// matching contract-erection-method-statement-helpers.ts / contract-variation-helpers.ts.
// All KPI/status computation itself lives server-side
// (contract-erection-dashboard.service.ts) — this file is display labels/
// classes plus pure client-side search/filter matching only.
// ---------------------------------------------------------------------------

import type {
  ErectionMethodStatementDisplayStatus,
  ErectionScheduleDisplayStatus,
  ErectionDeliveryStartDisplayStatus,
  ErectionStartDisplayStatus,
  ErectionChecklistDisplayStatus,
  ErectionAttentionStatus,
  ErectionWorkQueueRow,
} from '@/lib/contracts-api';

export const ERECTION_METHOD_STATEMENT_DISPLAY_LABELS: Record<ErectionMethodStatementDisplayStatus, string> = {
  NOT_STARTED: 'Not Started',
  DRAFT: 'Draft',
  SUBMITTED_FOR_APPROVAL: 'Submitted for Approval',
  ISSUED: 'Issued',
};

export const ERECTION_METHOD_STATEMENT_BADGE_CLASSES: Record<ErectionMethodStatementDisplayStatus, string> = {
  NOT_STARTED: 'bg-surface-secondary text-text-muted',
  DRAFT: 'bg-surface-secondary text-text-secondary',
  SUBMITTED_FOR_APPROVAL: 'bg-info-light text-info',
  ISSUED: 'bg-success-light text-success',
};

// CM-71D — Step 3's own schedule status, surfaced as its own work-queue
// column (never conflated with methodStatementStatus above).
export const ERECTION_SCHEDULE_DISPLAY_LABELS: Record<ErectionScheduleDisplayStatus, string> = {
  NOT_STARTED: 'Not Started',
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  HOLD: 'Hold',
  RETURNED: 'Returned',
};

export const ERECTION_SCHEDULE_BADGE_CLASSES: Record<ErectionScheduleDisplayStatus, string> = {
  NOT_STARTED: 'bg-surface-secondary text-text-muted',
  DRAFT: 'bg-surface-secondary text-text-secondary',
  ISSUED: 'bg-success-light text-success',
  HOLD: 'bg-warning-light text-warning',
  RETURNED: 'bg-error-light text-error',
};

// CM-71E — Step 4's own delivery-start status, surfaced as its own
// work-queue column (never conflated with scheduleStatus above).
export const ERECTION_DELIVERY_START_DISPLAY_LABELS: Record<ErectionDeliveryStartDisplayStatus, string> = {
  NOT_STARTED: 'Not Started',
  DRAFT: 'Draft',
  STARTED: 'Started',
  HOLD: 'Hold',
  RETURNED: 'Returned',
};

export const ERECTION_DELIVERY_START_BADGE_CLASSES: Record<ErectionDeliveryStartDisplayStatus, string> = {
  NOT_STARTED: 'bg-surface-secondary text-text-muted',
  DRAFT: 'bg-surface-secondary text-text-secondary',
  STARTED: 'bg-success-light text-success',
  HOLD: 'bg-warning-light text-warning',
  RETURNED: 'bg-error-light text-error',
};

// CM-71F — Step 5's own erection-start status, surfaced as its own
// work-queue column (never conflated with deliveryStartStatus above).
export const ERECTION_START_DISPLAY_LABELS: Record<ErectionStartDisplayStatus, string> = {
  NOT_STARTED: 'Not Started',
  DRAFT: 'Draft',
  STARTED: 'Started',
  HOLD: 'Hold',
  RETURNED: 'Returned',
};

export const ERECTION_START_BADGE_CLASSES: Record<ErectionStartDisplayStatus, string> = {
  NOT_STARTED: 'bg-surface-secondary text-text-muted',
  DRAFT: 'bg-surface-secondary text-text-secondary',
  STARTED: 'bg-success-light text-success',
  HOLD: 'bg-warning-light text-warning',
  RETURNED: 'bg-error-light text-error',
};

// CM-71G — Step 6's own erection-checklist status, surfaced as its own
// work-queue column (never conflated with erectionStartStatus above).
export const ERECTION_CHECKLIST_DISPLAY_LABELS: Record<ErectionChecklistDisplayStatus, string> = {
  NOT_STARTED: 'Not Started',
  DRAFT: 'Draft',
  SUBMITTED_FOR_VERIFICATION: 'Submitted for Verification',
  VERIFIED: 'Verified',
  HOLD: 'Hold',
  RETURNED: 'Returned',
};

export const ERECTION_CHECKLIST_BADGE_CLASSES: Record<ErectionChecklistDisplayStatus, string> = {
  NOT_STARTED: 'bg-surface-secondary text-text-muted',
  DRAFT: 'bg-surface-secondary text-text-secondary',
  SUBMITTED_FOR_VERIFICATION: 'bg-info-light text-info',
  VERIFIED: 'bg-success-light text-success',
  HOLD: 'bg-warning-light text-warning',
  RETURNED: 'bg-error-light text-error',
};

export const ERECTION_ATTENTION_LABELS: Record<ErectionAttentionStatus, string> = {
  OVERDUE: 'Overdue',
  AWAITING_APPROVAL: 'Awaiting Approval',
  ON_TRACK: 'On Track',
  NEEDS_PLANNING: 'Needs Planning',
};

export const ERECTION_ATTENTION_BADGE_CLASSES: Record<ErectionAttentionStatus, string> = {
  OVERDUE: 'bg-error-light text-error',
  AWAITING_APPROVAL: 'bg-warning-light text-warning',
  ON_TRACK: 'bg-success-light text-success',
  NEEDS_PLANNING: 'bg-surface-secondary text-text-muted',
};

export const ERECTION_METHOD_STATEMENT_FILTER_OPTIONS: { value: '' | ErectionMethodStatementDisplayStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED_FOR_APPROVAL', label: 'Submitted for Approval' },
  { value: 'ISSUED', label: 'Issued' },
];

export const ERECTION_ATTENTION_FILTER_OPTIONS: { value: '' | ErectionAttentionStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'AWAITING_APPROVAL', label: 'Awaiting Approval' },
  { value: 'ON_TRACK', label: 'On Track' },
  { value: 'NEEDS_PLANNING', label: 'Needs Planning' },
];

export interface ErectionWorkQueueFilters {
  search: string;
  methodStatementStatus: '' | ErectionMethodStatementDisplayStatus;
  attention: '' | ErectionAttentionStatus;
  contractStatus: string;
}

export const DEFAULT_ERECTION_WORK_QUEUE_FILTERS: ErectionWorkQueueFilters = {
  search: '',
  methodStatementStatus: '',
  attention: '',
  contractStatus: '',
};

/**
 * Search matches Contract No., Job Order No., Project Name, and Client — the
 * 4 fields this unit's own task names. Case-insensitive substring match, run
 * entirely client-side over the already-fetched work queue (small enough
 * dataset, same pattern as every other contract register's client-side
 * search).
 */
export function matchesErectionWorkQueueFilters(row: ErectionWorkQueueRow, filters: ErectionWorkQueueFilters): boolean {
  if (filters.methodStatementStatus && row.methodStatementStatus !== filters.methodStatementStatus) return false;
  if (filters.attention && row.attention !== filters.attention) return false;
  if (filters.contractStatus && row.contractStatus !== filters.contractStatus) return false;

  const search = filters.search.trim().toLowerCase();
  if (!search) return true;
  const haystack = [row.contractReference, row.jobOrderNo ?? '', row.projectName, row.client].join(' ').toLowerCase();
  return haystack.includes(search);
}
