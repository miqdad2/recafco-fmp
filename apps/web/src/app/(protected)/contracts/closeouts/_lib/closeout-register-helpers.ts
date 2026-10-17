// ---------------------------------------------------------------------------
// FMP-CLOSEOUT-01 — Pure helpers for the simplified Closeout Requests page.
// Quick filters are a view over the EXISTING list query params (`status`,
// `pendingOnly`). "Pending Review" is the backend's own `pendingOnly` (Submitted
// + Under Review) — a filter, never a stored status. Approved and Closed stay
// separate stored statuses.
// ---------------------------------------------------------------------------

export type CloseoutQuickView = 'all' | 'pending' | 'approved' | 'rejected' | 'closed';

export const QUICK_VIEW_OPTIONS: { value: CloseoutQuickView; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'closed', label: 'Closed' },
];

const VIEW_STATUS: Partial<Record<CloseoutQuickView, string>> = {
  approved: 'APPROVED',
  rejected: 'REJECTED',
  closed: 'CLOSED',
};

/** Stored statuses with no quick view — selectable under Advanced Filters. */
export const OTHER_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Any other status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const OTHER_STATUS_VALUES = OTHER_STATUS_OPTIONS.map((o) => o.value).filter(Boolean);

export function deriveQuickView(status: string | undefined, pendingOnly: boolean): CloseoutQuickView {
  if (pendingOnly) return status ? 'all' : 'pending';
  if (!status) return 'all';
  const hit = (Object.keys(VIEW_STATUS) as CloseoutQuickView[]).find((v) => VIEW_STATUS[v] === status);
  return hit ?? 'all';
}

export function deriveOtherStatus(status: string | undefined): string {
  return status && OTHER_STATUS_VALUES.includes(status) ? status : '';
}

export function quickViewToParams(view: CloseoutQuickView): { status?: string; pendingOnly?: 'true' } {
  if (view === 'pending') return { pendingOnly: 'true' };
  const status = VIEW_STATUS[view];
  return status ? { status } : {};
}

const ADVANCED_KEYS = [
  'departmentId', 'requestedByUserId', 'reviewedByUserId',
  'requestedDateFrom', 'requestedDateTo', 'reviewedDateFrom', 'reviewedDateTo',
  'approvedDateFrom', 'approvedDateTo',
] as const;

export function hasAdvancedFilters(values: Record<string, string | undefined>, otherStatus: string): boolean {
  return otherStatus !== '' || ADVANCED_KEYS.some((k) => Boolean(values[k]));
}

export function formatShowingRange(page: number, pageSize: number, shown: number, total: number): string {
  if (total === 0 || shown === 0) return 'Showing 0 of 0 requests';
  const from = (page - 1) * pageSize + 1;
  const to = from + shown - 1;
  return `Showing ${from}–${to} of ${total} request${total === 1 ? '' : 's'}`;
}
