import Link from 'next/link';
import { DAYS_OPTIONS, STATUS_OPTIONS, daysOptionsFor, viewOptionsFor } from '../_lib/contract-list-view-helpers';

interface Props {
  search: string | undefined;
  /** The "View" choice (blank = everything except Cancelled; see viewOptionsFor()). */
  lifecycleStatus: string | undefined;
  /** The "Status" choice (a stored status, or Pending Approval). */
  status: string | undefined;
  daysRemaining: string | undefined;
  /**
   * Filters that no longer have a control here but may still arrive from a link
   * (Contract Type, Contract Manager, the older schedule status). They are carried
   * along as hidden fields so Apply Filters never drops them silently.
   */
  carried: { scheduleStatus?: string | undefined; contractType?: string | undefined; ownerUserId?: string | undefined };
  hasActiveFilters: boolean;
}

const labelCls = 'mb-1 block text-xs font-medium text-text-secondary';
const fieldCls =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

/**
 * FMP-UI-41 — the Contract List filter bar, reduced to what people use to find a
 * contract: Search (the widest field), View, Status, Days Remaining, Apply Filters
 * and Clear Filters. Contract Type and Contract Manager were removed from the bar.
 * Status and Days Remaining are the same query parameters the API already accepts
 * (see contracts/page.tsx for how each choice is mapped).
 */
export function ContractFilterBar({ search, lifecycleStatus, status, daysRemaining, carried, hasActiveFilters }: Props): React.JSX.Element {
  return (
    <form method="GET" action="/contracts" className="rounded-lg border border-border bg-surface p-3">
      {carried.scheduleStatus && <input type="hidden" name="scheduleStatus" value={carried.scheduleStatus} />}
      {carried.contractType && <input type="hidden" name="contractType" value={carried.contractType} />}
      {carried.ownerUserId && <input type="hidden" name="ownerUserId" value={carried.ownerUserId} />}

      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3 lg:grid-cols-[minmax(0,3fr)_repeat(3,minmax(0,1fr))_auto]">
        <div className="sm:col-span-3 lg:col-span-1">
          <label htmlFor="search" className={labelCls}>Search</label>
          <input
            id="search"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Search contract no, project name, job order, or client"
            className={fieldCls}
          />
        </div>

        <div>
          <label htmlFor="lifecycleStatus" className={labelCls}>View</label>
          <select id="lifecycleStatus" name="lifecycleStatus" defaultValue={lifecycleStatus ?? ''} className={fieldCls}>
            {viewOptionsFor(lifecycleStatus).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status" className={labelCls}>Status</label>
          <select id="status" name="status" defaultValue={status ?? ''} className={fieldCls}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="daysRemaining" className={labelCls}>Days Remaining</label>
          <select id="daysRemaining" name="daysRemaining" defaultValue={daysRemaining ?? ''} className={fieldCls}>
            {(daysRemaining ? daysOptionsFor(daysRemaining) : DAYS_OPTIONS).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 sm:col-span-3 lg:col-span-1">
          <button
            type="submit"
            className="h-10 whitespace-nowrap rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Apply Filters
          </button>
          {hasActiveFilters && (
            <Link
              href="/contracts"
              className="inline-flex h-10 items-center whitespace-nowrap rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Clear Filters
            </Link>
          )}
        </div>
      </div>
    </form>
  );
}
