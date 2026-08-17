import Link from 'next/link';
import type { OrgRef, ContractPerson } from '@/lib/contracts-api';

interface Props {
  search: string | undefined;
  lifecycleStatus: string | undefined;
  departmentId: string | undefined;
  ownerUserId: string | undefined;
  departments: OrgRef[];
  people: ContractPerson[];
  hasActiveFilters: boolean;
}

const LIFECYCLE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRING', label: 'Expiring Soon' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'CLOSED', label: 'Closed' },
];

export function ContractFilterBar({
  search,
  lifecycleStatus,
  departmentId,
  ownerUserId,
  departments,
  people,
  hasActiveFilters,
}: Props): React.JSX.Element {
  return (
    <form method="GET" action="/contracts" className="rounded-lg border border-border bg-surface p-4 mb-6 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label htmlFor="search" className="block text-xs font-medium text-text-secondary mb-1">
            Search
          </label>
          <input
            id="search"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Contract reference or contract name…"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div>
          <label htmlFor="lifecycleStatus" className="block text-xs font-medium text-text-secondary mb-1">
            Contract Status
          </label>
          <select
            id="lifecycleStatus"
            name="lifecycleStatus"
            defaultValue={lifecycleStatus ?? ''}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {LIFECYCLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="departmentId" className="block text-xs font-medium text-text-secondary mb-1">
            Department
          </label>
          <select
            id="departmentId"
            name="departmentId"
            defaultValue={departmentId ?? ''}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
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
            <option value="">All managers</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
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
