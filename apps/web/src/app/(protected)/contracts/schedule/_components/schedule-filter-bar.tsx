import Link from 'next/link';
import type { OrgRef, ContractPerson, ScheduleItemType } from '@/lib/contracts-api';
import { SCHEDULE_ITEM_TYPE_LABELS } from './schedule-item-type-badge';

interface ContractOption {
  id: string;
  referenceNumber: string;
  title: string;
}

interface Props {
  search: string | undefined;
  contractId: string | undefined;
  itemType: string | undefined;
  responsibleUserId: string | undefined;
  departmentId: string | undefined;
  dateFrom: string | undefined;
  dateTo: string | undefined;
  overdueOnly: boolean;
  upcomingOnly: boolean;
  contracts: ContractOption[];
  departments: OrgRef[];
  people: ContractPerson[];
  hasActiveFilters: boolean;
}

const ITEM_TYPE_OPTIONS = Object.entries(SCHEDULE_ITEM_TYPE_LABELS) as [ScheduleItemType, string][];

const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const labelCls = 'block text-xs font-medium text-text-secondary mb-1';

export function ScheduleFilterBar({
  search,
  contractId,
  itemType,
  responsibleUserId,
  departmentId,
  dateFrom,
  dateTo,
  overdueOnly,
  upcomingOnly,
  contracts,
  departments,
  people,
  hasActiveFilters,
}: Props): React.JSX.Element {
  return (
    <form method="GET" action="/contracts/schedule" className="rounded-lg border border-border bg-surface p-4 mb-6 space-y-3 print:hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label htmlFor="search" className={labelCls}>Search</label>
          <input
            id="search"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Contract, project or client…"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="contractId" className={labelCls}>Contract</label>
          <select id="contractId" name="contractId" defaultValue={contractId ?? ''} className={inputCls}>
            <option value="">All contracts</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>{c.referenceNumber} — {c.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="itemType" className={labelCls}>Item Type</label>
          <select id="itemType" name="itemType" defaultValue={itemType ?? ''} className={inputCls}>
            <option value="">All types</option>
            {ITEM_TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="responsibleUserId" className={labelCls}>Responsible Person</label>
          <select id="responsibleUserId" name="responsibleUserId" defaultValue={responsibleUserId ?? ''} className={inputCls}>
            <option value="">Anyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="departmentId" className={labelCls}>Department</label>
          <select id="departmentId" name="departmentId" defaultValue={departmentId ?? ''} className={inputCls}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2 lg:col-span-2">
          <span className={labelCls}>Date Range</span>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="dateFrom" defaultValue={dateFrom} className={inputCls} aria-label="Date from" />
            <input type="date" name="dateTo" defaultValue={dateTo} className={inputCls} aria-label="Date to" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              name="overdueOnly"
              value="true"
              defaultChecked={overdueOnly}
              className="rounded border-border text-accent focus:ring-accent"
            />
            Overdue only
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              name="upcomingOnly"
              value="true"
              defaultChecked={upcomingOnly}
              className="rounded border-border text-accent focus:ring-accent"
            />
            Upcoming only
          </label>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Link
              href="/contracts/schedule"
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
