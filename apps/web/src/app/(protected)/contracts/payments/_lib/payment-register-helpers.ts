// ---------------------------------------------------------------------------
// FMP-PAY-01 — Pure helpers for the simplified Contract Payments register.
// Quick filters are a presentation layer over the EXISTING list query params
// (`status`, `overdueOnly`) so URLs, CSV export and the API contract are
// unchanged. "Overdue" uses the backend's own rule (due date passed and not
// Paid/Cancelled), never a status the UI invents.
// ---------------------------------------------------------------------------

export type PaymentQuickView = 'all' | 'partial' | 'paid' | 'overdue';

export const QUICK_VIEW_OPTIONS: { value: PaymentQuickView; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'partial', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

/** Stored lifecycle statuses that have no quick-view equivalent. */
export const WORKFLOW_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Any workflow status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'CERTIFIED', label: 'Certified' },
  { value: 'OVERDUE', label: 'Overdue (recorded status)' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

/** Which quick view the current URL params correspond to ('all' when none). */
export function deriveQuickView(status: string | undefined, overdueOnly: boolean): PaymentQuickView {
  if (overdueOnly && !status) return 'overdue';
  if (status === 'PARTIALLY_PAID' && !overdueOnly) return 'partial';
  if (status === 'PAID' && !overdueOnly) return 'paid';
  if (!status && !overdueOnly) return 'all';
  return 'all';
}

/** Workflow-status value for the Advanced select (empty when a quick view owns `status`). */
export function deriveWorkflowStatus(status: string | undefined): string {
  if (!status || status === 'PARTIALLY_PAID' || status === 'PAID') return '';
  return status;
}

/** Translate a quick view into the existing query params. */
export function quickViewToParams(view: PaymentQuickView): { status?: string; overdueOnly?: 'true' } {
  switch (view) {
    case 'partial':
      return { status: 'PARTIALLY_PAID' };
    case 'paid':
      return { status: 'PAID' };
    case 'overdue':
      return { overdueOnly: 'true' };
    default:
      return {};
  }
}

const ADVANCED_KEYS = [
  'departmentId',
  'ownerUserId',
  'company',
  'invoiceDateFrom',
  'invoiceDateTo',
  'dueDateFrom',
  'dueDateTo',
] as const;

/** True when any Advanced Filters field (or a workflow status) is active — used to auto-expand the section. */
export function hasAdvancedFilters(values: Record<string, string | undefined>, workflowStatus: string): boolean {
  return workflowStatus !== '' || ADVANCED_KEYS.some((k) => Boolean(values[k]));
}

/** "Showing 1–25 of 250 payments" from real returned totals. */
export function formatShowingRange(page: number, pageSize: number, shown: number, total: number): string {
  if (total === 0 || shown === 0) return 'Showing 0 of 0 payments';
  const from = (page - 1) * pageSize + 1;
  const to = from + shown - 1;
  return `Showing ${from}–${to} of ${total} payment${total === 1 ? '' : 's'}`;
}

/**
 * Outstanding-balance hint shown beside the lifecycle badge. Returns null
 * unless the data supports it: never fabricates "overdue" without a due date.
 */
export function overdueLabel(overdueDays: number | null): string | null {
  if (overdueDays === null || overdueDays <= 0) return null;
  return `Overdue ${overdueDays} day${overdueDays === 1 ? '' : 's'}`;
}

/** "Unpaid" only when an amount is owed and nothing has been paid yet, on a live (non-cancelled, non-paid) record. */
export function isUnpaid(p: { status: string; paidAmount?: string; outstandingAmount: string | null }): boolean {
  if (p.status === 'PAID' || p.status === 'CANCELLED' || p.status === 'PARTIALLY_PAID') return false;
  const out = p.outstandingAmount === null ? NaN : parseFloat(p.outstandingAmount);
  if (isNaN(out) || out <= 0) return false;
  const paid = p.paidAmount ? parseFloat(p.paidAmount) : 0;
  return !(paid > 0);
}
