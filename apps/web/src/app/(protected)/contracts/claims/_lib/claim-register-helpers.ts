// ---------------------------------------------------------------------------
// FMP-CLAIM-01 — Pure helpers for the simplified Claim Log.
// Quick filters are a view over the EXISTING list query params (`status`,
// `overdueOnly`). "Overdue" stays a derived condition (due date passed and
// status not Settled/Closed/Cancelled/Rejected) — never a stored status.
// There is no stored "Open" status (the summary's Open Claims count is every
// non-final claim), so there is deliberately no Open chip: `status` takes a
// single value and cannot express it without a backend change.
// ---------------------------------------------------------------------------

export type ClaimQuickView = 'all' | 'underReview' | 'approved' | 'overdue' | 'closed';

export const QUICK_VIEW_OPTIONS: { value: ClaimQuickView; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'underReview', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'closed', label: 'Closed' },
];

const VIEW_STATUS: Partial<Record<ClaimQuickView, string>> = {
  underReview: 'UNDER_REVIEW',
  approved: 'APPROVED',
  closed: 'CLOSED',
};

/** Stored statuses with no quick view — selectable under Advanced Filters. */
export const OTHER_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Any other status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_NEGOTIATION', label: 'Under Negotiation' },
  { value: 'PARTIALLY_APPROVED', label: 'Partially Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SETTLED', label: 'Settled' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const OTHER_STATUS_VALUES = OTHER_STATUS_OPTIONS.map((o) => o.value).filter(Boolean);

export function deriveQuickView(status: string | undefined, overdueOnly: boolean): ClaimQuickView {
  if (overdueOnly) return status ? 'all' : 'overdue';
  if (!status) return 'all';
  const hit = (Object.keys(VIEW_STATUS) as ClaimQuickView[]).find((v) => VIEW_STATUS[v] === status);
  return hit ?? 'all';
}

export function deriveOtherStatus(status: string | undefined): string {
  return status && OTHER_STATUS_VALUES.includes(status) ? status : '';
}

export function quickViewToParams(view: ClaimQuickView): { status?: string; overdueOnly?: 'true' } {
  if (view === 'overdue') return { overdueOnly: 'true' };
  const status = VIEW_STATUS[view];
  return status ? { status } : {};
}

const ADVANCED_KEYS = [
  'claimType', 'responsibleUserId', 'departmentId',
  'claimDateFrom', 'claimDateTo', 'dueDateFrom', 'dueDateTo',
] as const;

export function hasAdvancedFilters(values: Record<string, string | undefined>, otherStatus: string): boolean {
  return otherStatus !== '' || ADVANCED_KEYS.some((k) => Boolean(values[k]));
}

export function formatShowingRange(page: number, pageSize: number, shown: number, total: number): string {
  if (total === 0 || shown === 0) return 'Showing 0 of 0 claims';
  const from = (page - 1) * pageSize + 1;
  const to = from + shown - 1;
  return `Showing ${from}–${to} of ${total} claim${total === 1 ? '' : 's'}`;
}

/** Only when the API reports overdue days. */
export function overdueLabel(overdueDays: number | null): string | null {
  if (overdueDays === null || overdueDays <= 0) return null;
  return `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`;
}

export function formatDays(days: number | undefined): string {
  if (days === undefined || days === null) return '—';
  return `${days} day${days === 1 ? '' : 's'}`;
}

export interface ClaimAmountInput {
  claimType: string;
  submittedValue?: string | undefined;
  approvedValue?: string | undefined;
  eotClaimedDays?: number | undefined;
  eotApprovedDays?: number | undefined;
}

export interface ClaimAmountCell {
  /** 'days' for Extension of Time claims, 'money' for everything else — never mixed in one figure. */
  kind: 'days' | 'money';
  claimed: string | undefined;
  approved: string | undefined;
  /** Raw EOT days on a non-EOT claim (e.g. Delay) — shown as a separate note, never as money. */
  extraDaysClaimed?: number;
  extraDaysApproved?: number;
}

/**
 * Which figure a claim's Claimed / Approved columns show. EOT claims show days;
 * every other claim type shows its value. A zero is shown as zero — never
 * interpreted as a rejection (that is the status's job).
 */
export function claimAmountCell(c: ClaimAmountInput): ClaimAmountCell {
  if (c.claimType === 'EXTENSION_OF_TIME') {
    return {
      kind: 'days',
      claimed: c.eotClaimedDays === undefined ? undefined : String(c.eotClaimedDays),
      approved: c.eotApprovedDays === undefined ? undefined : String(c.eotApprovedDays),
    };
  }
  return {
    kind: 'money',
    claimed: c.submittedValue,
    approved: c.approvedValue,
    ...(c.eotClaimedDays !== undefined && c.eotClaimedDays !== null ? { extraDaysClaimed: c.eotClaimedDays } : {}),
    ...(c.eotApprovedDays !== undefined && c.eotApprovedDays !== null ? { extraDaysApproved: c.eotApprovedDays } : {}),
  };
}
