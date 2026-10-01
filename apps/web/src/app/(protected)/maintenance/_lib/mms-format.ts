// FMP-MAINT-01/02/03 — pure display helpers for the live MMS dashboard. Type-only
// imports from '@/lib/mms-api' (which imports next/headers) so this file is
// safe for client components too.
import type { MmsLiveStatus, MmsNeedsAttentionItem } from '@/lib/mms-api';

/** Badge colors keyed by the RAW MMS status (chk_work_orders_status values plus legacy fallbacks). */
export function statusClasses(status: string): string {
  switch (status) {
    case 'Under Review':
    case 'Closure Requested':
      return 'bg-warning-light text-warning';
    case 'Waiting Materials':
    case 'Partially Issued':
    case 'Waiting for Parts':
    case 'Waiting for Purchase':
      return 'bg-secondary-accent-light text-secondary-accent';
    case 'In Progress':
      return 'bg-teal-light text-teal';
    case 'Approved':
    case 'Materials Issued':
    case 'Assigned':
      return 'bg-info-light text-info';
    case 'Closed':
      return 'bg-success-light text-success';
    default:
      return 'bg-surface-secondary text-text-muted';
  }
}

export function priorityClasses(priority: string | null): string {
  if (priority === 'Urgent') return 'bg-error-light text-error';
  if (priority === 'High') return 'bg-warning-light text-warning';
  return 'bg-surface-secondary text-text-secondary';
}

/**
 * MMS reason wording is shown as-is, except "Overdue": MMS has no due-date
 * field, so its overdue rule is "in-flight and start date/time has passed" —
 * labelled explicitly so nobody reads it as a missed deadline.
 */
export function reasonLabel(reason: string): string {
  return reason === 'Overdue' ? 'Past start time' : reason;
}

export function reasonClasses(reason: string): string {
  if (reason === 'Overdue' || reason === 'Urgent priority') return 'bg-error-light text-error';
  if (reason === 'High priority' || reason === 'Closure request pending') return 'bg-warning-light text-warning';
  if (reason === 'Waiting for parts') return 'bg-secondary-accent-light text-secondary-accent';
  return 'bg-surface-secondary text-text-secondary';
}

/** Header/strip status pill. Not-configured and not-enabled read the same to users ("MMS not configured"); the sync strip carries the specific reason. */
export const MMS_LIVE_STATUS_DISPLAY: Record<MmsLiveStatus, { label: string; dot: string; pill: string }> = {
  ONLINE: { label: 'Live from MMS', dot: 'bg-success', pill: 'bg-success-light text-success' },
  OFFLINE: { label: 'MMS offline', dot: 'bg-error', pill: 'bg-error-light text-error' },
  AUTH_ERROR: { label: 'MMS auth error', dot: 'bg-error', pill: 'bg-error-light text-error' },
  NOT_ENABLED: { label: 'MMS not configured', dot: 'bg-warning', pill: 'bg-warning-light text-warning' },
  NOT_CONFIGURED: { label: 'MMS not configured', dot: 'bg-warning', pill: 'bg-warning-light text-warning' },
  SCOPE_RESTRICTED: { label: 'Restricted', dot: 'bg-text-muted', pill: 'bg-surface-secondary text-text-secondary' },
};

/** Short status word for the sync strip. */
export const MMS_SYNC_STATUS_WORD: Record<MmsLiveStatus, string> = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  AUTH_ERROR: 'Authentication failed',
  NOT_ENABLED: 'Not configured',
  NOT_CONFIGURED: 'Not configured',
  SCOPE_RESTRICTED: 'Restricted',
};

/**
 * Real MMS job-card list filters (MMS app/(dashboard)/maintenance/work-orders
 * `?status=` tab keys). MMS has no exact "waiting for parts" or "past start
 * time" list view, so no link is offered for those — never a fake filter.
 */
export function mmsJobCardsUrl(mmsBaseUrl: string, tab: 'Active' | 'ClosureRequested'): string {
  return `${mmsBaseUrl.replace(/\/+$/, '')}/maintenance/work-orders?status=${tab}`;
}

/** MMS reason → how many of the shown attention items carry it, in MMS's own weight order. */
const REASON_ORDER = ['Overdue', 'Urgent priority', 'High priority', 'Closure request pending', 'Waiting for parts', 'Unassigned'];

export function summarizeReasons(items: Pick<MmsNeedsAttentionItem, 'reasons'>[]): { reason: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) for (const r of new Set(item.reasons)) counts.set(r, (counts.get(r) ?? 0) + 1);
  const rank = (r: string): number => {
    const i = REASON_ORDER.indexOf(r);
    return i === -1 ? REASON_ORDER.length : i;
  };
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => rank(a.reason) - rank(b.reason) || a.reason.localeCompare(b.reason));
}

export function formatSyncTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** "5 min ago" style relative time against a fixed `now` (server render time). */
export function formatRelative(iso: string | null, now: number): string {
  if (!iso) return '—';
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '—';
  const min = Math.round((now - time) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
