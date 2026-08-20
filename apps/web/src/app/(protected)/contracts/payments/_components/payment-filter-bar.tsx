import Link from 'next/link';
import type { OrgRef, ContractPerson } from '@/lib/contracts-api';

interface ContractOption {
  id: string;
  referenceNumber: string;
  title: string;
}

interface Props {
  search: string | undefined;
  contractId: string | undefined;
  company: string | undefined;
  status: string | undefined;
  departmentId: string | undefined;
  ownerUserId: string | undefined;
  invoiceDateFrom: string | undefined;
  invoiceDateTo: string | undefined;
  dueDateFrom: string | undefined;
  dueDateTo: string | undefined;
  overdueOnly: boolean;
  contracts: ContractOption[];
  departments: OrgRef[];
  people: ContractPerson[];
  hasActiveFilters: boolean;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'CERTIFIED', label: 'Certified' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const labelCls = 'block text-xs font-medium text-text-secondary mb-1';

export function PaymentFilterBar({
  search,
  contractId,
  company,
  status,
  departmentId,
  ownerUserId,
  invoiceDateFrom,
  invoiceDateTo,
  dueDateFrom,
  dueDateTo,
  overdueOnly,
  contracts,
  departments,
  people,
  hasActiveFilters,
}: Props): React.JSX.Element {
  return (
    <form method="GET" action="/contracts/payments" className="rounded-lg border border-border bg-surface p-4 mb-6 space-y-3 print:hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label htmlFor="search" className={labelCls}>Search</label>
          <input
            id="search"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Payment no., invoice #, contract…"
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
          <label htmlFor="company" className={labelCls}>Company / Client</label>
          <input
            id="company"
            name="company"
            type="search"
            defaultValue={company}
            placeholder="Client or company name…"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="status" className={labelCls}>Payment Status</label>
          <select id="status" name="status" defaultValue={status ?? ''} className={inputCls}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
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
          <label htmlFor="ownerUserId" className={labelCls}>Contract Manager</label>
          <select id="ownerUserId" name="ownerUserId" defaultValue={ownerUserId ?? ''} className={inputCls}>
            <option value="">All managers</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2 lg:col-span-2">
          <span className={labelCls}>Invoice Date Range</span>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="invoiceDateFrom" defaultValue={invoiceDateFrom} className={inputCls} aria-label="Invoice date from" />
            <input type="date" name="invoiceDateTo" defaultValue={invoiceDateTo} className={inputCls} aria-label="Invoice date to" />
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
              href="/contracts/payments"
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
