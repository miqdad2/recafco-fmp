import type { Contract } from '@/lib/contracts-api';
import { buildReasons, reached } from '../executive/_lib/project-overview-helpers';
import type { ProjectProgress } from '../executive/_lib/project-overview-helpers';

// ---------------------------------------------------------------------------
// FMP-UI-40 — pure helpers for the simplified Contract List. Display only:
// every value comes from fields the contract list and the BOQ progress
// endpoint already return, and no permission rule lives here.
// ---------------------------------------------------------------------------

/** The "View" filter. The blank value is the existing default (everything except Cancelled). */
export const VIEW_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Active / Current' },
  { value: 'CLOSED', label: 'Completed / Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'ALL', label: 'All' },
];

const OTHER_VIEW_LABELS: Record<string, string> = {
  ACTIVE: 'Active only',
  DRAFT: 'Draft only',
  EXPIRING: 'Expiring soon',
  EXPIRED: 'Expired',
  TERMINATED: 'Terminated',
};

/**
 * The View choices for the current URL. Links from other screens can carry another
 * value (for example `lifecycleStatus=ACTIVE` from the dashboard); it is kept as an
 * extra choice so the filter keeps working and the dropdown shows what is applied.
 */
export function viewOptionsFor(current: string | undefined): { value: string; label: string }[] {
  if (!current || VIEW_OPTIONS.some((o) => o.value === current)) return VIEW_OPTIONS;
  return [...VIEW_OPTIONS, { value: current, label: OTHER_VIEW_LABELS[current] ?? current }];
}

// --- Dates ------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function formatShortDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export interface TimelineInfo {
  start: string | null;
  due: string | null;
  /** "25 days left" / "Due today" / "Overdue by 3 days"; null when there is no date or the contract is finished. */
  remaining: { text: string; tone: 'neutral' | 'warning' | 'error' } | null;
}

const FINISHED = new Set(['CLOSED', 'CANCELLED', 'TERMINATED']);

/** Forecast completion first, the contract end date as a fallback (same order as the Days Remaining filter). */
export function timelineInfo(
  c: Pick<Contract, 'status' | 'startDate' | 'forecastCompletionDate' | 'endDate'>,
  now: Date = new Date(),
): TimelineInfo {
  const dueIso = c.forecastCompletionDate ?? c.endDate;
  const info: TimelineInfo = { start: formatShortDate(c.startDate), due: formatShortDate(dueIso), remaining: null };
  if (!dueIso || FINISHED.has(c.status)) return info;
  const due = new Date(dueIso);
  if (Number.isNaN(due.getTime())) return info;
  const days = Math.round((utcDay(due) - utcDay(now)) / DAY_MS);
  const plural = (n: number): string => `${n} day${n === 1 ? '' : 's'}`;
  if (days < 0) info.remaining = { text: `Overdue by ${plural(-days)}`, tone: 'error' };
  else if (days === 0) info.remaining = { text: 'Due today', tone: 'warning' };
  else info.remaining = { text: `${plural(days)} left`, tone: days <= 30 ? 'warning' : 'neutral' };
  return info;
}

// --- Progress ---------------------------------------------------------------

export interface BarInfo {
  text: string;
  /** null = no bar to draw. */
  percent: number | null;
}

/** BOQ column: "0 / 30 completed" with a bar; plain words when there is nothing to count. */
export function boqBar(p: ProjectProgress | null): BarInfo {
  if (p === null) return { text: '—', percent: null };
  if (!p.hasItems) return { text: 'No BOQ', percent: null };
  if (p.generated > 0 && p.completed >= p.generated) return { text: 'Completed', percent: 100 };
  if (p.generated === 0) return { text: p.confirmed === 0 ? 'Not confirmed yet' : 'Pieces not generated', percent: null };
  return { text: `${p.completed} / ${p.generated} completed`, percent: Math.round((p.completed / p.generated) * 100) };
}

/** Payment column: the percentage with a bar, "Not started" at 0, "—" when unknown. */
export function paymentBar(percent: number | undefined): BarInfo {
  if (percent === undefined || percent === null || Number.isNaN(percent)) return { text: '—', percent: null };
  if (percent <= 0) return { text: 'Not started', percent: null };
  return { text: `${Math.round(percent)}%`, percent: Math.min(100, Math.round(percent)) };
}

// --- Needs Attention --------------------------------------------------------

/** Plain reasons a contract needs a look; empty = nothing to flag. Finished contracts are never flagged. */
export function attentionReasons(
  c: Pick<Contract, 'status' | 'openClaimsCount' | 'effectiveScheduleStatus' | 'startDate' | 'forecastCompletionDate' | 'endDate'>,
  now: Date = new Date(),
): string[] {
  if (c.status !== 'DRAFT' && c.status !== 'ACTIVE') return [];
  const reasons: string[] = [];
  if (c.status === 'DRAFT') reasons.push('Waiting for approval');
  if ((c.openClaimsCount ?? 0) > 0) reasons.push(`${c.openClaimsCount} open claim${c.openClaimsCount === 1 ? '' : 's'}`);
  if (c.effectiveScheduleStatus === 'DELAYED') reasons.push('Delayed');
  if (timelineInfo(c, now).remaining?.tone === 'error') reasons.push('Past due date');
  return reasons;
}

export function countNeedingAttention(contracts: Parameters<typeof attentionReasons>[0][], now: Date = new Date()): number {
  return contracts.filter((c) => attentionReasons(c, now).length > 0).length;
}

// --- Status -----------------------------------------------------------------

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Draft', cls: 'bg-surface-secondary text-text-secondary border border-border' },
  ACTIVE: { label: 'Active', cls: 'bg-success/10 text-success border border-success/30' },
  CLOSED: { label: 'Closed', cls: 'bg-surface-secondary text-text-muted border border-border' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-surface-secondary text-text-muted border border-border' },
  TERMINATED: { label: 'Terminated', cls: 'bg-error/10 text-error border border-error/30' },
};

export function statusBadge(status: string): { label: string; cls: string } {
  return STATUS_BADGE[status] ?? { label: status.charAt(0) + status.slice(1).toLowerCase(), cls: STATUS_BADGE['DRAFT']!.cls };
}

/** "Showing 1 to 25 of 60 contracts". */
export function countLabel(shown: number, page: number | undefined, pageSize: number | undefined, total: number | undefined): string {
  if (page === undefined || pageSize === undefined || total === undefined || total <= 0) {
    return `Showing ${shown} contract${shown === 1 ? '' : 's'}`;
  }
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(from + shown - 1, total);
  return `Showing ${from} to ${to} of ${total} contracts`;
}

// --- Status filter ----------------------------------------------------------

/**
 * The Status filter. These are the real contract statuses; there is no separate
 * "pending approval" status in the system — a Draft is what waits for approval —
 * so that choice searches the same Draft contracts.
 */
export const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

/** The stored status to ask the API for, or undefined for "All Status" / an unknown value. */
export function statusApiValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value === 'PENDING_APPROVAL') return 'DRAFT';
  return STATUS_OPTIONS.some((o) => o.value === value) ? value : undefined;
}

// --- Days Remaining filter --------------------------------------------------

export const DAYS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'DUE_30', label: 'Due Soon' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'THIS_MONTH', label: 'This Month' },
  { value: 'NEXT_3_MONTHS', label: 'Next 3 Months' },
];

/** Keeps an older link value (for example the 60-day filter) working as an extra choice. */
export function daysOptionsFor(current: string | undefined): { value: string; label: string }[] {
  if (!current || DAYS_OPTIONS.some((o) => o.value === current)) return DAYS_OPTIONS;
  return [...DAYS_OPTIONS, { value: current, label: current === 'DUE_60' ? 'Due in 60 days' : current }];
}

/** This Month / Next 3 Months have no API filter, so the page applies them to the loaded contracts. */
export function isDateWindowFilter(value: string | undefined): value is 'THIS_MONTH' | 'NEXT_3_MONTHS' {
  return value === 'THIS_MONTH' || value === 'NEXT_3_MONTHS';
}

export function matchesDueWindow(
  c: Pick<Contract, 'status' | 'forecastCompletionDate' | 'endDate'>,
  window: 'THIS_MONTH' | 'NEXT_3_MONTHS',
  now: Date = new Date(),
): boolean {
  if (FINISHED.has(c.status)) return false;
  const iso = c.forecastCompletionDate ?? c.endDate;
  if (!iso) return false;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return false;
  if (window === 'THIS_MONTH') {
    return due.getUTCFullYear() === now.getUTCFullYear() && due.getUTCMonth() === now.getUTCMonth();
  }
  const today = utcDay(now);
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, now.getUTCDate());
  const dueDay = utcDay(due);
  return dueDay >= today && dueDay <= end;
}

// --- Quick filters (applied to the contracts on the page) -------------------

export type QuickFilter = 'ALL' | 'ACTIVE' | 'ATTENTION' | 'BOQ_NOT_CONFIRMED' | 'PRODUCTION_NOT_STARTED' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETED';

export const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'ATTENTION', label: 'Needs Attention' },
  { key: 'BOQ_NOT_CONFIRMED', label: 'BOQ Not Confirmed' },
  { key: 'PRODUCTION_NOT_STARTED', label: 'Production Not Started' },
  { key: 'DUE_SOON', label: 'Due Soon' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'COMPLETED', label: 'Completed' },
];

export function matchesQuickFilter(
  c: Parameters<typeof attentionReasons>[0],
  progress: ProjectProgress | null,
  filter: QuickFilter,
  now: Date = new Date(),
): boolean {
  switch (filter) {
    case 'ALL': return true;
    case 'ACTIVE': return c.status === 'ACTIVE';
    case 'ATTENTION': return attentionReasons(c, now).length > 0;
    case 'BOQ_NOT_CONFIRMED':
      return buildReasons({ status: c.status, openClaims: 0, progress }).some((r) => r.key === 'BOQ_NOT_CONFIRMED');
    case 'PRODUCTION_NOT_STARTED':
      return buildReasons({ status: c.status, openClaims: 0, progress }).some((r) => r.key === 'PRODUCTION_NOT_STARTED');
    case 'DUE_SOON': {
      const r = timelineInfo(c, now).remaining;
      return r !== null && r.tone === 'warning';
    }
    case 'OVERDUE': return timelineInfo(c, now).remaining?.tone === 'error';
    case 'COMPLETED':
      return c.status === 'CLOSED' || (!!progress && progress.generated > 0 && progress.completed >= progress.generated);
  }
}

// --- Project Progress (stage summary) ----------------------------------------

export interface StageInfo {
  label: 'Technical' | 'Production' | 'Delivery' | 'Erection';
  text: 'Not started' | 'In progress' | 'Done' | '—';
}

function stageState(done: number, total: number): StageInfo['text'] {
  if (total === 0) return '—';
  if (done <= 0) return 'Not started';
  return done >= total ? 'Done' : 'In progress';
}

/** One plain line per stage. "—" when there is nothing to judge (no BOQ, no pieces yet, or not loaded). */
export function projectStages(p: ProjectProgress | null, status: string): StageInfo[] {
  const none: StageInfo[] = [
    { label: 'Technical', text: '—' }, { label: 'Production', text: '—' }, { label: 'Delivery', text: '—' }, { label: 'Erection', text: '—' },
  ];
  if (p === null || !p.hasItems || status === 'CANCELLED') return none;
  const r = reached(p);
  const technical: StageInfo['text'] = p.confirmed === 0 ? 'Not started' : p.generated >= p.confirmed ? 'Done' : 'In progress';
  return [
    { label: 'Technical', text: technical },
    { label: 'Production', text: stageState(r.produced, p.generated) === 'Not started' && r.productionStarted > 0 ? 'In progress' : stageState(r.produced, p.generated) },
    { label: 'Delivery', text: stageState(r.delivered, p.generated) },
    { label: 'Erection', text: stageState(r.erected, p.generated) },
  ];
}
