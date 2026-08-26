import Link from 'next/link';
import type { OrgRef, ContractPerson } from '@/lib/contracts-api';
import { CONTRACT_CLAIM_TYPE_OPTIONS, CONTRACT_CLAIM_STATUS_OPTIONS } from '../../_lib/contract-ui-helpers';

interface ContractOption {
  id: string;
  referenceNumber: string;
  title: string;
}

interface Props {
  search: string | undefined;
  contractId: string | undefined;
  status: string | undefined;
  claimType: string | undefined;
  responsibleUserId: string | undefined;
  departmentId: string | undefined;
  claimDateFrom: string | undefined;
  claimDateTo: string | undefined;
  dueDateFrom: string | undefined;
  dueDateTo: string | undefined;
  overdueOnly: boolean;
  contracts: ContractOption[];
  departments: OrgRef[];
  people: ContractPerson[];
  hasActiveFilters: boolean;
}

const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const labelCls = 'block text-xs font-medium text-text-secondary mb-1';

export function ClaimFilterBar({
  search,
  contractId,
  status,
  claimType,
  responsibleUserId,
  departmentId,
  claimDateFrom,
  claimDateTo,
  dueDateFrom,
  dueDateTo,
  overdueOnly,
  contracts,
  departments,
  people,
  hasActiveFilters,
}: Props): React.JSX.Element {
  return (
    <form method="GET" action="/contracts/claims" className="rounded-lg border border-border bg-surface p-4 mb-6 space-y-3 print:hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label htmlFor="search" className={labelCls}>Search</label>
          <input
            id="search"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Claim no., title, contract…"
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
          <label htmlFor="status" className={labelCls}>Claim Status</label>
          <select id="status" name="status" defaultValue={status ?? ''} className={inputCls}>
            <option value="">All statuses</option>
            {CONTRACT_CLAIM_STATUS_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="claimType" className={labelCls}>Claim Type</label>
          <select id="claimType" name="claimType" defaultValue={claimType ?? ''} className={inputCls}>
            <option value="">All types</option>
            {CONTRACT_CLAIM_TYPE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
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
          <span className={labelCls}>Claim Date Range</span>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="claimDateFrom" defaultValue={claimDateFrom} className={inputCls} aria-label="Claim date from" />
            <input type="date" name="claimDateTo" defaultValue={claimDateTo} className={inputCls} aria-label="Claim date to" />
          </div>
        </div>

        <div className="sm:col-span-2 lg:col-span-2">
          <span className={labelCls}>Due Date Range</span>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="dueDateFrom" defaultValue={dueDateFrom} className={inputCls} aria-label="Due date from" />
            <input type="date" name="dueDateTo" defaultValue={dueDateTo} className={inputCls} aria-label="Due date to" />
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
          Overdue only
        </label>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Link
              href="/contracts/claims"
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
