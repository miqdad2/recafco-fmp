import Link from 'next/link';
import type { OrgRef, ContractPerson } from '@/lib/contracts-api';
import { CONTRACT_CLOSEOUT_STATUS_OPTIONS } from '../../_lib/contract-ui-helpers';

interface ContractOption {
  id: string;
  referenceNumber: string;
  title: string;
}

interface Props {
  search: string | undefined;
  contractId: string | undefined;
  status: string | undefined;
  requestedByUserId: string | undefined;
  reviewedByUserId: string | undefined;
  departmentId: string | undefined;
  requestedDateFrom: string | undefined;
  requestedDateTo: string | undefined;
  reviewedDateFrom: string | undefined;
  reviewedDateTo: string | undefined;
  approvedDateFrom: string | undefined;
  approvedDateTo: string | undefined;
  pendingOnly: boolean;
  contracts: ContractOption[];
  departments: OrgRef[];
  people: ContractPerson[];
  hasActiveFilters: boolean;
}

const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const labelCls = 'block text-xs font-medium text-text-secondary mb-1';

export function CloseoutFilterBar({
  search,
  contractId,
  status,
  requestedByUserId,
  reviewedByUserId,
  departmentId,
  requestedDateFrom,
  requestedDateTo,
  reviewedDateFrom,
  reviewedDateTo,
  approvedDateFrom,
  approvedDateTo,
  pendingOnly,
  contracts,
  departments,
  people,
  hasActiveFilters,
}: Props): React.JSX.Element {
  return (
    <form method="GET" action="/contracts/closeouts" className="rounded-lg border border-border bg-surface p-4 mb-6 space-y-3 print:hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label htmlFor="search" className={labelCls}>Search</label>
          <input
            id="search"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Request no., contract…"
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
          <label htmlFor="status" className={labelCls}>Closeout Status</label>
          <select id="status" name="status" defaultValue={status ?? ''} className={inputCls}>
            <option value="">All statuses</option>
            {CONTRACT_CLOSEOUT_STATUS_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
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

        <div>
          <label htmlFor="requestedByUserId" className={labelCls}>Requested By</label>
          <select id="requestedByUserId" name="requestedByUserId" defaultValue={requestedByUserId ?? ''} className={inputCls}>
            <option value="">Anyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="reviewedByUserId" className={labelCls}>Reviewed By</label>
          <select id="reviewedByUserId" name="reviewedByUserId" defaultValue={reviewedByUserId ?? ''} className={inputCls}>
            <option value="">Anyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2 lg:col-span-2">
          <span className={labelCls}>Requested Date Range</span>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="requestedDateFrom" defaultValue={requestedDateFrom} className={inputCls} aria-label="Requested date from" />
            <input type="date" name="requestedDateTo" defaultValue={requestedDateTo} className={inputCls} aria-label="Requested date to" />
          </div>
        </div>

        <div className="sm:col-span-2 lg:col-span-2">
          <span className={labelCls}>Reviewed Date Range</span>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="reviewedDateFrom" defaultValue={reviewedDateFrom} className={inputCls} aria-label="Reviewed date from" />
            <input type="date" name="reviewedDateTo" defaultValue={reviewedDateTo} className={inputCls} aria-label="Reviewed date to" />
          </div>
        </div>

        <div className="sm:col-span-2 lg:col-span-2">
          <span className={labelCls}>Approved Date Range</span>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="approvedDateFrom" defaultValue={approvedDateFrom} className={inputCls} aria-label="Approved date from" />
            <input type="date" name="approvedDateTo" defaultValue={approvedDateTo} className={inputCls} aria-label="Approved date to" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            name="pendingOnly"
            value="true"
            defaultChecked={pendingOnly}
            className="rounded border-border text-accent focus:ring-accent"
          />
          Pending review only
        </label>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Link
              href="/contracts/closeouts"
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
