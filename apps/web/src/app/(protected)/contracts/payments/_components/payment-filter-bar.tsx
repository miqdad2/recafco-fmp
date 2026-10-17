'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, SlidersHorizontal, ChevronDown, X } from 'lucide-react';
import type { OrgRef, ContractPerson } from '@/lib/contracts-api';
import {
  QUICK_VIEW_OPTIONS,
  WORKFLOW_STATUS_OPTIONS,
  deriveQuickView,
  deriveWorkflowStatus,
  hasAdvancedFilters,
  quickViewToParams,
  type PaymentQuickView,
} from '../_lib/payment-register-helpers';

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

const inputCls =
  'w-full h-10 rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const labelCls = 'block text-xs font-medium text-text-secondary mb-1';

const FIELD_NAMES = [
  'search',
  'contractId',
  'company',
  'departmentId',
  'ownerUserId',
  'invoiceDateFrom',
  'invoiceDateTo',
  'dueDateFrom',
  'dueDateTo',
] as const;

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
  const router = useRouter();
  const view = deriveQuickView(status, overdueOnly);
  const workflowStatus = deriveWorkflowStatus(status);
  const applied: Record<string, string | undefined> = {
    search, contractId, company, departmentId, ownerUserId, invoiceDateFrom, invoiceDateTo, dueDateFrom, dueDateTo,
  };
  const [advancedOpen, setAdvancedOpen] = useState(hasAdvancedFilters(applied, workflowStatus));

  function go(params: URLSearchParams): void {
    const s = params.toString();
    router.push(s ? `/contracts/payments?${s}` : '/contracts/payments');
  }

  // Quick filters / the Payment Status select keep every other APPLIED filter
  // and only swap the status params, so they filter immediately with no extra click.
  function selectView(next: PaymentQuickView): void {
    const q = new URLSearchParams();
    for (const k of FIELD_NAMES) {
      const v = applied[k];
      if (v) q.set(k, v);
    }
    const p = quickViewToParams(next);
    if (p.status) q.set('status', p.status);
    if (p.overdueOnly) q.set('overdueOnly', p.overdueOnly);
    go(q);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = new URLSearchParams();
    for (const k of FIELD_NAMES) {
      const v = String(fd.get(k) ?? '').trim();
      if (v) q.set(k, v);
    }
    const chosenView = String(fd.get('view') ?? 'all') as PaymentQuickView;
    const workflow = String(fd.get('workflowStatus') ?? '');
    // A specific workflow status (Advanced) wins over a quick view, matching
    // the original single `status` param.
    if (workflow) {
      q.set('status', workflow);
    } else {
      const p = quickViewToParams(chosenView);
      if (p.status) q.set('status', p.status);
      if (p.overdueOnly) q.set('overdueOnly', p.overdueOnly);
    }
    go(q);
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-4 print:hidden">
      <form key={JSON.stringify([applied, status, overdueOnly])} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto] gap-3 items-end">
          <div>
            <label htmlFor="search" className={labelCls}>Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <input
                id="search"
                name="search"
                type="search"
                defaultValue={search}
                placeholder="Search invoice no, payment no, contract, project or client"
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="contractId" className={labelCls}>Contract / Job Order</label>
            <select id="contractId" name="contractId" defaultValue={contractId ?? ''} className={inputCls}>
              <option value="">All contracts</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>{c.referenceNumber} — {c.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="view" className={labelCls}>Payment Status</label>
            <select id="view" name="view" defaultValue={view} className={inputCls}>
              {QUICK_VIEW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.value === 'all' ? 'All statuses' : o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Search
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Quick filters" className="flex flex-wrap items-center gap-2">
            {QUICK_VIEW_OPTIONS.map((o) => {
              const selected = o.value === view;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => selectView(o.value)}
                  aria-pressed={selected}
                  className={`inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-focus ${
                    selected
                      ? 'border-accent bg-accent text-white'
                      : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              aria-expanded={advancedOpen}
              aria-controls="payment-advanced-filters"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-primary hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-focus"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Advanced Filters
              <ChevronDown className={`size-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => router.push('/contracts/payments')}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
              >
                <X className="size-4" aria-hidden="true" />
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Always rendered (hidden when collapsed) so the form still submits the applied advanced values. */}
        <div
          id="payment-advanced-filters"
          hidden={!advancedOpen}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-border pt-4"
        >
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

          <div>
            <label htmlFor="company" className={labelCls}>Company / Client</label>
            <input
              id="company"
              name="company"
              type="search"
              defaultValue={company}
              placeholder="Client or company name"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="workflowStatus" className={labelCls}>Workflow Status</label>
            <select id="workflowStatus" name="workflowStatus" defaultValue={workflowStatus} className={inputCls}>
              {WORKFLOW_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <span className={labelCls}>Invoice Date Range</span>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" name="invoiceDateFrom" defaultValue={invoiceDateFrom} className={inputCls} aria-label="Invoice date from" />
              <input type="date" name="invoiceDateTo" defaultValue={invoiceDateTo} className={inputCls} aria-label="Invoice date to" />
            </div>
          </div>

          <div className="sm:col-span-2">
            <span className={labelCls}>Due Date Range</span>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" name="dueDateFrom" defaultValue={dueDateFrom} className={inputCls} aria-label="Due date from" />
              <input type="date" name="dueDateTo" defaultValue={dueDateTo} className={inputCls} aria-label="Due date to" />
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
