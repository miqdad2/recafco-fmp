// ---------------------------------------------------------------------------
// FMP-ISSUE-01 — Pure helpers for the simplified Contract Issue Log.
// Quick filters are a view over the EXISTING list query params (`status`,
// `overdueOnly`); "Overdue" is the backend's own rule (due date passed and not
// Closed/Resolved/Cancelled). Nothing here defines a new status.
// ---------------------------------------------------------------------------

export type IssueQuickView = 'all' | 'open' | 'inProgress' | 'overdue' | 'resolved' | 'closed';

export const QUICK_VIEW_OPTIONS: { value: IssueQuickView; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'inProgress', label: 'In Progress' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const VIEW_STATUS: Partial<Record<IssueQuickView, string>> = {
  open: 'OPEN',
  inProgress: 'IN_PROGRESS',
  resolved: 'RESOLVED',
  closed: 'CLOSED',
};

/** Statuses with no quick view — selectable under Advanced Filters. */
export const OTHER_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Any other status' },
  { value: 'WAITING_RESPONSE', label: 'Waiting Response' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function deriveQuickView(status: string | undefined, overdueOnly: boolean): IssueQuickView {
  if (overdueOnly) return status ? 'all' : 'overdue';
  if (!status) return 'all';
  const hit = (Object.keys(VIEW_STATUS) as IssueQuickView[]).find((v) => VIEW_STATUS[v] === status);
  return hit ?? 'all';
}

export function deriveOtherStatus(status: string | undefined): string {
  return status === 'WAITING_RESPONSE' || status === 'CANCELLED' ? status : '';
}

export function quickViewToParams(view: IssueQuickView): { status?: string; overdueOnly?: 'true' } {
  if (view === 'overdue') return { overdueOnly: 'true' };
  const status = VIEW_STATUS[view];
  return status ? { status } : {};
}

const ADVANCED_KEYS = [
  'priority', 'category', 'responsibleUserId', 'departmentId',
  'raisedDateFrom', 'raisedDateTo', 'dueDateFrom', 'dueDateTo',
] as const;

export function hasAdvancedFilters(values: Record<string, string | undefined>, otherStatus: string): boolean {
  return otherStatus !== '' || ADVANCED_KEYS.some((k) => Boolean(values[k]));
}

export function formatShowingRange(page: number, pageSize: number, shown: number, total: number): string {
  if (total === 0 || shown === 0) return 'Showing 0 of 0 issues';
  const from = (page - 1) * pageSize + 1;
  const to = from + shown - 1;
  return `Showing ${from}–${to} of ${total} issue${total === 1 ? '' : 's'}`;
}

/** Only when the API reports overdue days (closed/resolved/cancelled and undated issues never get one). */
export function overdueLabel(overdueDays: number | null): string | null {
  if (overdueDays === null || overdueDays <= 0) return null;
  return `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`;
}
