import type { ContractScheduleStageKey, ContractScheduleStageStatus } from '@/lib/contracts-api';

// ---------------------------------------------------------------------------
// CM-68A — Contract Detail Schedule (Planned vs Actual). Pure, dependency-
// free display helpers (matching the ../../_lib/root-dashboard-helpers.ts
// pattern) — all real backend-computed values (status/delay/source), never
// re-derived here.
// ---------------------------------------------------------------------------

export const SCHEDULE_STAGE_KEYS: ContractScheduleStageKey[] = [
  'CONTRACT_SIGN',
  'ADVANCE_PAYMENT',
  'DRAWING_APPROVAL',
  'ESTIMATION_SHEET',
  'CASTING_PRODUCTION',
  'DELIVERY',
  'ERECTION',
  'FINAL_CLOSEOUT',
];

export const STAGE_KEY_LABELS: Record<ContractScheduleStageKey, string> = {
  CONTRACT_SIGN: 'Contract Sign',
  ADVANCE_PAYMENT: 'Advance Payment Received',
  DRAWING_APPROVAL: 'Drawing Approval',
  ESTIMATION_SHEET: 'Estimation Sheet',
  CASTING_PRODUCTION: 'Casting / Production',
  DELIVERY: 'Delivery',
  ERECTION: 'Erection',
  FINAL_CLOSEOUT: 'Final Closeout',
};

export const STAGE_STATUS_LABELS: Record<ContractScheduleStageStatus, string> = {
  NOT_PLANNED: 'Not Planned',
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  DELAYED: 'Delayed',
  ON_TRACK: 'On Track',
  AHEAD: 'Ahead',
};

export const STAGE_STATUS_BADGE_CLASSES: Record<ContractScheduleStageStatus, string> = {
  NOT_PLANNED: 'bg-surface-secondary text-text-muted',
  NOT_STARTED: 'bg-surface-secondary text-text-secondary',
  IN_PROGRESS: 'bg-teal-light text-teal',
  COMPLETED: 'bg-success-light text-success',
  DELAYED: 'bg-error-light text-error',
  ON_TRACK: 'bg-info-light text-info',
  AHEAD: 'bg-success-light text-success',
};

export function formatScheduleDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Positive = late (red), negative = early (green), 0 = on time, null = "—". */
export function formatDelayDays(delayDays: number | null): string {
  if (delayDays === null) return '—';
  if (delayDays === 0) return 'On time';
  if (delayDays > 0) return `+${delayDays}d`;
  return `${delayDays}d`;
}

export function delayDaysClassName(delayDays: number | null): string {
  if (delayDays === null) return 'text-text-muted';
  if (delayDays > 0) return 'text-error';
  if (delayDays < 0) return 'text-success';
  return 'text-text-secondary';
}
