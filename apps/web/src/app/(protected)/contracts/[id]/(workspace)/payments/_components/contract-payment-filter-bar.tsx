import Link from 'next/link';
import { PAYMENT_STATUS_FILTER_OPTIONS } from '../../../../_lib/contract-payment-detail-helpers';

interface Props {
  contractId: string;
  search: string | undefined;
  status: string | undefined;
  dateFrom: string | undefined;
  dateTo: string | undefined;
  overdueOnly: boolean;
  hasActiveFilters: boolean;
  /** CM-58B — page-level actions (Export Excel) rendered in this same bottom row, so they read as part of this card instead of a detached sibling element. */
  actions?: React.ReactNode;
}

const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const labelCls = 'block text-xs font-medium text-text-secondary mb-1';

/**
 * CM-58 — Contract Detail Payments tab, filter/search row. Deliberately
 * leaner than the module-level register's own PaymentFilterBar (no
 * Contract/Company/Department/Manager pickers — this page is already
 * scoped to one contract, so `contractId` is submitted as a fixed hidden
 * field, never a user-editable filter). "Date Range" filters by Invoice
 * Date specifically (the one real, unambiguous primary date on a payment
 * record) — labeled explicitly so it's never confused with Payment Due
 * Date, which has its own column but no separate range filter in this
 * unit.
 */
export function ContractPaymentFilterBar({
  contractId,
  search,
  status,
  dateFrom,
  dateTo,
  overdueOnly,
  hasActiveFilters,
  actions,
}: Props): React.JSX.Element {
  return (
    <form method="GET" action={`/contracts/${contractId}/payments`} className="rounded-lg border border-border bg-surface shadow-sm p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="lg:col-span-2">
          <label htmlFor="search" className={labelCls}>Search</label>
          <input
            id="search"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Search by payment no., invoice, remarks…"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="status" className={labelCls}>Payment Status</label>
          <select id="status" name="status" defaultValue={status ?? ''} className={inputCls}>
            {PAYMENT_STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <span className={labelCls}>Date Range (Invoice Date)</span>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="dateFrom" defaultValue={dateFrom} className={inputCls} aria-label="Invoice date from" />
            <input type="date" name="dateTo" defaultValue={dateTo} className={inputCls} aria-label="Invoice date to" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            name="overdueOnly"
            value="true"
            defaultChecked={overdueOnly}
            className="rounded border-border text-accent focus:ring-accent"
          />
          Overdue Only
        </label>

        <div className="flex items-center gap-2">
          {actions}
          {hasActiveFilters && (
            <Link
              href={`/contracts/${contractId}/payments`}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Reset Filters
            </Link>
          )}
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </form>
  );
}
