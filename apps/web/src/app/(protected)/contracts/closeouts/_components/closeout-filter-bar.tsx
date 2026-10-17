'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, SlidersHorizontal, ChevronDown, X } from 'lucide-react';
import type { OrgRef, ContractPerson } from '@/lib/contracts-api';
import {
  QUICK_VIEW_OPTIONS,
  OTHER_STATUS_OPTIONS,
  deriveQuickView,
  deriveOtherStatus,
  hasAdvancedFilters,
  quickViewToParams,
  type CloseoutQuickView,
} from '../_lib/closeout-register-helpers';

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
  'w-full h-10 rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const labelCls = 'block text-xs font-medium text-text-secondary mb-1';

const FIELD_NAMES = [
  'search', 'contractId', 'departmentId', 'requestedByUserId', 'reviewedByUserId',
  'requestedDateFrom', 'requestedDateTo', 'reviewedDateFrom', 'reviewedDateTo',
  'approvedDateFrom', 'approvedDateTo',
] as const;

export function CloseoutFilterBar(props: Props): React.JSX.Element {
  const { search, contractId, status, requestedByUserId, reviewedByUserId, departmentId,
    requestedDateFrom, requestedDateTo, reviewedDateFrom, reviewedDateTo, approvedDateFrom, approvedDateTo,
    pendingOnly, contracts, departments, people, hasActiveFilters } = props;
  const router = useRouter();
  const view = deriveQuickView(status, pendingOnly);
  const otherStatus = deriveOtherStatus(status);
  const applied: Record<string, string | undefined> = {
    search, contractId, departmentId, requestedByUserId, reviewedByUserId,
    requestedDateFrom, requestedDateTo, reviewedDateFrom, reviewedDateTo, approvedDateFrom, approvedDateTo,
  };
  const [advancedOpen, setAdvancedOpen] = useState(hasAdvancedFilters(applied, otherStatus));

  function go(params: URLSearchParams): void {
    const s = params.toString();
    router.push(s ? `/contracts/closeouts?${s}` : '/contracts/closeouts');
  }

  function applyView(q: URLSearchParams, next: CloseoutQuickView): void {
    const p = quickViewToParams(next);
    if (p.status) q.set('status', p.status);
    if (p.pendingOnly) q.set('pendingOnly', p.pendingOnly);
  }

  // Quick filters keep every other APPLIED filter and only swap the status params.
  function selectView(next: CloseoutQuickView): void {
    const q = new URLSearchParams();
    for (const k of FIELD_NAMES) {
      const v = applied[k];
      if (v) q.set(k, v);
    }
    applyView(q, next);
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
    const other = String(fd.get('otherStatus') ?? '');
    if (other) q.set('status', other);
    else applyView(q, String(fd.get('view') ?? 'all') as CloseoutQuickView);
    go(q);
  }

  const range = (label: string, from: string, to: string, fromVal?: string, toVal?: string): React.JSX.Element => (
    <div className="sm:col-span-2 lg:col-span-1">
      <span className={labelCls}>{label}</span>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" name={from} defaultValue={fromVal} className={inputCls} aria-label={`${label} from`} />
        <input type="date" name={to} defaultValue={toVal} className={inputCls} aria-label={`${label} to`} />
      </div>
    </div>
  );

  return (
    <div className="rounded-lg border border-border bg-surface p-4 print:hidden">
      <form key={JSON.stringify([applied, status, pendingOnly])} onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="Search request no, contract no, project name or client"
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="contractId" className={labelCls}>Contract / Project</label>
            <select id="contractId" name="contractId" defaultValue={contractId ?? ''} className={inputCls}>
              <option value="">All contracts</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>{c.referenceNumber} — {c.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="view" className={labelCls}>Closeout Status</label>
            <select id="view" name="view" defaultValue={view} className={inputCls}>
              {QUICK_VIEW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.value === 'all' ? 'All statuses' : o.label}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Search
          </button>
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
              aria-controls="closeout-advanced-filters"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-primary hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-focus"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Advanced Filters
              <ChevronDown className={`size-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => router.push('/contracts/closeouts')}
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
          id="closeout-advanced-filters"
          hidden={!advancedOpen}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 border-t border-border pt-4"
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

          {range('Requested Date Range', 'requestedDateFrom', 'requestedDateTo', requestedDateFrom, requestedDateTo)}
          {range('Reviewed Date Range', 'reviewedDateFrom', 'reviewedDateTo', reviewedDateFrom, reviewedDateTo)}
          {range('Approved Date Range', 'approvedDateFrom', 'approvedDateTo', approvedDateFrom, approvedDateTo)}

          <div>
            <label htmlFor="otherStatus" className={labelCls}>Other Status</label>
            <select id="otherStatus" name="otherStatus" defaultValue={otherStatus} className={inputCls}>
              {OTHER_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 flex items-end justify-end">
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
