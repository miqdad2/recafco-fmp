import type { FollowUpBucket, SalesActivityType, SalesStatus } from '@/lib/sales-api';

// ---------------------------------------------------------------------------
// FMP-SALES-01 — wording, colours and number/date formatting for the Sales screens.
// Plain words only (no CRM jargon). Colours never carry meaning alone: every badge
// also has a text label.
// ---------------------------------------------------------------------------

export const STATUS_LABELS: Record<SalesStatus, string> = {
  NEW_ENQUIRY: 'New',
  FOLLOW_UP: 'Follow-up Needed',
  QUOTATION_SENT: 'Quotation Sent',
  MEETING_DONE: 'Under Discussion',
  // Older enquiries may still carry "Contacted": it reads (and is filtered) as Under Discussion. It is no longer offered.
  CONTACTED: 'Under Discussion',
  WON: 'Confirmed',
  LOST: 'Not Proceeding',
};

/** The six statuses a manager can choose, in the order they are shown. Under Discussion is stored as MEETING_DONE. */
export const STATUS_ORDER: SalesStatus[] = ['NEW_ENQUIRY', 'FOLLOW_UP', 'QUOTATION_SENT', 'MEETING_DONE', 'WON', 'LOST'];

/** Filter value for each status pill (Under Discussion also covers the older Contacted value). */
export const STATUS_FILTER_VALUE: Record<SalesStatus, string> = {
  NEW_ENQUIRY: 'NEW_ENQUIRY',
  FOLLOW_UP: 'FOLLOW_UP',
  QUOTATION_SENT: 'QUOTATION_SENT',
  MEETING_DONE: 'MEETING_DONE,CONTACTED',
  CONTACTED: 'MEETING_DONE,CONTACTED',
  WON: 'WON',
  LOST: 'LOST',
};

/** Counts for the six shown statuses (Contacted is folded into Under Discussion). */
export function foldStatusCounts(counts: Record<string, number>): Record<SalesStatus, number> {
  return {
    NEW_ENQUIRY: counts['NEW_ENQUIRY'] ?? 0,
    FOLLOW_UP: counts['FOLLOW_UP'] ?? 0,
    QUOTATION_SENT: counts['QUOTATION_SENT'] ?? 0,
    MEETING_DONE: (counts['MEETING_DONE'] ?? 0) + (counts['CONTACTED'] ?? 0),
    CONTACTED: 0,
    WON: counts['WON'] ?? 0,
    LOST: counts['LOST'] ?? 0,
  };
}

/** Soft blue for active work, green for Confirmed, red for Not Proceeding. */
export const STATUS_BADGE: Record<SalesStatus, string> = {
  NEW_ENQUIRY: 'bg-blue-50 text-blue-800 border-blue-200',
  CONTACTED: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  MEETING_DONE: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  QUOTATION_SENT: 'bg-violet-50 text-violet-800 border-violet-200',
  FOLLOW_UP: 'bg-amber-50 text-amber-900 border-amber-300',
  WON: 'bg-green-50 text-green-800 border-green-300',
  LOST: 'bg-red-50 text-red-800 border-red-200',
};

export const BUCKET_LABELS: Record<FollowUpBucket, string> = {
  OVERDUE: 'Overdue',
  TODAY: 'Due Today',
  UPCOMING: 'Upcoming',
  COMPLETED: 'Completed',
  CANCELLED: 'Replaced',
};

/** Red overdue, amber today, blue upcoming, green completed. */
export const BUCKET_BADGE: Record<FollowUpBucket, string> = {
  OVERDUE: 'bg-red-50 text-red-800 border-red-300',
  TODAY: 'bg-amber-50 text-amber-900 border-amber-300',
  UPCOMING: 'bg-blue-50 text-blue-800 border-blue-200',
  COMPLETED: 'bg-green-50 text-green-800 border-green-300',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const ACTIVITY_LABELS: Record<SalesActivityType, string> = {
  OFFICE_MEETING: 'Office Meeting',
  PHONE_CALL: 'Phone Call',
  EMAIL: 'Email',
  CLIENT_VISIT: 'Client Visit',
  FOLLOW_UP: 'Follow-up',
  QUOTATION_UPDATE: 'Quotation Update',
  STATUS_CHANGE: 'Status Change',
  NOTE: 'Note',
  ENQUIRY_UPDATED: 'Details Updated',
};

/** What a manager can record by hand (status changes and edits record themselves). */
export const RECORDABLE_ACTIVITY: { value: SalesActivityType; label: string }[] = [
  { value: 'OFFICE_MEETING', label: 'Office Meeting' },
  { value: 'PHONE_CALL', label: 'Phone Call' },
  { value: 'CLIENT_VISIT', label: 'Client Visit' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'QUOTATION_UPDATE', label: 'Quotation Update' },
  { value: 'NOTE', label: 'Note' },
];

/** "KWD 125,000" / "KWD 125,000.500"; null means the value is not known - never shown as 0. */
export function formatKwd(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const whole = Number.isInteger(n);
  return `KWD ${n.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 3, maximumFractionDigits: 3 })}`;
}

export const NOT_ESTIMATED = 'Not estimated yet';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 2026-10-21 -> "21 Oct 2026" (a calendar date, so no time-zone shifting). */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return '—';
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** 2026-10 -> "October 2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return y && m ? `${names[m - 1]} ${y}` : month;
}

export function shortMonth(month: string): string {
  const m = Number(month.split('-')[1]);
  return MONTHS[m - 1] ?? month;
}

export function formatRate(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? 'N/A' : `${rate}%`;
}

/** Whole days between two YYYY-MM-DD dates (a - b). */
export function daysBetween(a: string, b: string): number {
  const utc = (s: string): number => {
    const [y = 0, m = 1, d = 1] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(a) - utc(b)) / 86_400_000);
}

/** "3 days overdue" / "Due today" / "In 5 days". */
export function dueText(bucket: FollowUpBucket, date: string, today: string): string {
  if (bucket === 'TODAY') return 'Due today';
  const diff = Math.abs(daysBetween(date, today));
  const days = `${diff} ${diff === 1 ? 'day' : 'days'}`;
  if (bucket === 'OVERDUE') return `${days} overdue`;
  if (bucket === 'UPCOMING') return `In ${days}`;
  return '';
}

/** Name of a status filter value ('open', 'FOLLOW_UP', 'MEETING_DONE,CONTACTED', …) for messages. */
export function statusFilterLabel(filter: string): string {
  if (!filter) return 'All';
  if (filter === 'open') return 'Active';
  const first = filter.split(',')[0] as SalesStatus;
  return STATUS_LABELS[first] ?? 'selected';
}
