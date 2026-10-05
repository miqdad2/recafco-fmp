// FMP-MAINT-01/02/03 — pure display helpers for the live MMS dashboard. Type-only
// imports from '@/lib/mms-api' (which imports next/headers) so this file is
// safe for client components too.
import type { MmsLinks, MmsLiveStatus, MmsNeedsAttentionItem, MmsVehicleExpiryAlert } from '@/lib/mms-api';

// ── FMP-MAINT-04 — executive summary helpers ─────────────────────────────────

export const SECTION_NOT_AVAILABLE = 'Not available from MMS live API yet';

/** Real MMS routes — the same list the FMP API uses; only needed here when the FMP API itself is unreachable. */
const MMS_ROUTES: MmsLinks = {
  dashboard: '/dashboard',
  jobCards: '/maintenance/work-orders',
  materialsRequests: '/store/parts-requests',
  inventory: '/store/offline-inventory',
  assets: '/assets',
  vehicles: '/assets/vehicles',
  workerActivity: '/maintenance/assignments',
  dailyActivity: '/maintenance/daily-activity',
};

export function fallbackMmsLinks(mmsBaseUrl: string): MmsLinks {
  const base = mmsBaseUrl.replace(/\/+$/, '');
  const prefix = (path: string): string => `${base}${path}`;
  return {
    dashboard: prefix(MMS_ROUTES.dashboard),
    jobCards: prefix(MMS_ROUTES.jobCards),
    materialsRequests: prefix(MMS_ROUTES.materialsRequests),
    inventory: prefix(MMS_ROUTES.inventory),
    assets: prefix(MMS_ROUTES.assets),
    vehicles: prefix(MMS_ROUTES.vehicles),
    workerActivity: prefix(MMS_ROUTES.workerActivity),
    dailyActivity: prefix(MMS_ROUTES.dailyActivity),
  };
}

/** KWD has three decimals. null (MMS sent no cost figure) is an em dash, never 0. */
export function formatKwd(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KWD`;
}

export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} h`;
}

export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

const ATTENTION_TYPES: Record<string, { label: string; classes: string }> = {
  closure_request: { label: 'Closure request', classes: 'bg-warning-light text-warning' },
  vehicle_expiry: { label: 'Vehicle expiry', classes: 'bg-error-light text-error' },
  overdue_job: { label: 'Past start time', classes: 'bg-error-light text-error' },
  waiting_materials: { label: 'Waiting materials', classes: 'bg-secondary-accent-light text-secondary-accent' },
  low_stock: { label: 'Low stock', classes: 'bg-warning-light text-warning' },
  unassigned_job: { label: 'Unassigned job', classes: 'bg-info-light text-info' },
  priority_job: { label: 'Priority job', classes: 'bg-warning-light text-warning' },
};

/** MMS manager-attention `type` → display label; an unknown type is shown readably, never dropped. */
export function attentionTypeLabel(type: string): string {
  const known = ATTENTION_TYPES[type];
  if (known) return known.label;
  const words = type.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function attentionTypeClasses(type: string): string {
  return ATTENTION_TYPES[type]?.classes ?? 'bg-surface-secondary text-text-secondary';
}

/** "Expired 12 days ago" / "Expires today" / "Expires in 5 days". */
export function vehicleExpiryText(alert: Pick<MmsVehicleExpiryAlert, 'daysRemaining' | 'overdueDays'>): string {
  const plural = (n: number): string => `${n} day${n === 1 ? '' : 's'}`;
  if (alert.overdueDays > 0) return `Expired ${plural(alert.overdueDays)} ago`;
  if (alert.daysRemaining === null) return 'Expiring';
  if (alert.daysRemaining <= 0) return 'Expires today';
  return `Expires in ${plural(alert.daysRemaining)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** YYYY-MM-DD → "29 Sep 2025". Pure string work: no timezone drift, no locale-data differences between server and browser. */
export function formatDateOnly(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const month = m ? MONTHS[m - 1] : undefined;
  if (!y || !d || !month) return isoDate;
  return `${String(d).padStart(2, '0')} ${month} ${y}`;
}

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
