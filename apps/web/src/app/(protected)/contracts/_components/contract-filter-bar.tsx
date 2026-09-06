import Link from 'next/link';
import type { ContractPerson } from '@/lib/contracts-api';
import { SCHEDULE_STATUS_OPTIONS, DAYS_REMAINING_FILTER_OPTIONS, SCOPE_OF_WORK_OPTIONS, LIFECYCLE_STATUS_FILTER_OPTIONS } from '../_lib/contract-ui-helpers';

interface Props {
  search: string | undefined;
  scheduleStatus: string | undefined;
  contractType: string | undefined;
  ownerUserId: string | undefined;
  daysRemaining: string | undefined;
  /** CM-69C — the real lifecycle status (DRAFT/ACTIVE/.../CANCELLED), not the "Contract Status" schedule dropdown below. Blank = normal working view (excludes Cancelled); 'ALL' shows everything for audit. */
  lifecycleStatus: string | undefined;
  people: ContractPerson[];
  hasActiveFilters: boolean;
}

// CM-55 — approved-design filter row: Search / Contract Status
// (manager-facing schedule status, NOT lifecycle status) / Contract Type
// (real scopeOfWork flags — no dedicated "type" field exists) / Contract
// Manager / Days Remaining / Reset. The Risk Rating filter from the
// approved screenshot is removed entirely per the change request; the old
// Department filter is dropped from this row too — not part of the
// approved design's required filter list, and department scope is already
// enforced server-side regardless of this UI.
export function ContractFilterBar({
  search, scheduleStatus, contractType, ownerUserId, daysRemaining, lifecycleStatus, people, hasActiveFilters,
}: Props): React.JSX.Element {
  return (
    <form method="GET" action="/contracts" className="rounded-lg border border-border bg-surface p-4 mb-6 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div>
          <label htmlFor="search" className="block text-xs font-medium text-text-secondary mb-1">
            Search
          </label>
          <input
            id="search"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Contract No, Name, Client, Package…"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div>
          <label htmlFor="lifecycleStatus" className="block text-xs font-medium text-text-secondary mb-1">
            Lifecycle Status
          </label>
          <select
            id="lifecycleStatus"
            name="lifecycleStatus"
            defaultValue={lifecycleStatus ?? ''}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">Default View (No Cancelled)</option>
            {LIFECYCLE_STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="scheduleStatus" className="block text-xs font-medium text-text-secondary mb-1">
            Contract Status
          </label>
          <select
            id="scheduleStatus"
            name="scheduleStatus"
            defaultValue={scheduleStatus ?? ''}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">All Status</option>
            {SCHEDULE_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="contractType" className="block text-xs font-medium text-text-secondary mb-1">
            Contract Type
          </label>
          <select
            id="contractType"
            name="contractType"
            defaultValue={contractType ?? ''}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">All Types</option>
            {SCOPE_OF_WORK_OPTIONS.filter((o) => o.key !== 'notApplicable').map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ownerUserId" className="block text-xs font-medium text-text-secondary mb-1">
            Contract Manager
          </label>
          <select
            id="ownerUserId"
            name="ownerUserId"
            defaultValue={ownerUserId ?? ''}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">All Managers</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="daysRemaining" className="block text-xs font-medium text-text-secondary mb-1">
            Days Remaining
          </label>
          <select
            id="daysRemaining"
            name="daysRemaining"
            defaultValue={daysRemaining ?? ''}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">All</option>
            {DAYS_REMAINING_FILTER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        {hasActiveFilters && (
          <Link
            href="/contracts"
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
    </form>
  );
}
