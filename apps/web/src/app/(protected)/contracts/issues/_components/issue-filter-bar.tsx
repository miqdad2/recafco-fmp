'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, SlidersHorizontal, ChevronDown, X } from 'lucide-react';
import type { OrgRef, ContractPerson } from '@/lib/contracts-api';
import { CONTRACT_ISSUE_CATEGORIES } from '../../_lib/contract-ui-helpers';
import {
  QUICK_VIEW_OPTIONS,
  OTHER_STATUS_OPTIONS,
  deriveQuickView,
  deriveOtherStatus,
  hasAdvancedFilters,
  quickViewToParams,
  type IssueQuickView,
} from '../_lib/issue-register-helpers';

interface ContractOption {
  id: string;
  referenceNumber: string;
  title: string;
}

interface Props {
  search: string | undefined;
  contractId: string | undefined;
  status: string | undefined;
  priority: string | undefined;
  category: string | undefined;
  responsibleUserId: string | undefined;
  departmentId: string | undefined;
  raisedDateFrom: string | undefined;
  raisedDateTo: string | undefined;
  dueDateFrom: string | undefined;
  dueDateTo: string | undefined;
  overdueOnly: boolean;
  contracts: ContractOption[];
  departments: OrgRef[];
  people: ContractPerson[];
  hasActiveFilters: boolean;
}

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All priorities' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

const inputCls =
  'w-full h-10 rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const labelCls = 'block text-xs font-medium text-text-secondary mb-1';

const FIELD_NAMES = [
  'search', 'contractId', 'priority', 'category', 'responsibleUserId', 'departmentId',
  'raisedDateFrom', 'raisedDateTo', 'dueDateFrom', 'dueDateTo',
] as const;

export function IssueFilterBar({
  search, contractId, status, priority, category, responsibleUserId, departmentId,
  raisedDateFrom, raisedDateTo, dueDateFrom, dueDateTo, overdueOnly,
  contracts, departments, people, hasActiveFilters,
}: Props): React.JSX.Element {
  const router = useRouter();
  const view = deriveQuickView(status, overdueOnly);
  const otherStatus = deriveOtherStatus(status);
  const applied: Record<string, string | undefined> = {
    search, contractId, priority, category, responsibleUserId, departmentId,
    raisedDateFrom, raisedDateTo, dueDateFrom, dueDateTo,
  };
  const [advancedOpen, setAdvancedOpen] = useState(hasAdvancedFilters(applied, otherStatus));

  function go(params: URLSearchParams): void {
    const s = params.toString();
    router.push(s ? `/contracts/issues?${s}` : '/contracts/issues');
  }

  // Quick filters keep every other APPLIED filter and only swap the status params.
  function selectView(next: IssueQuickView): void {
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
    const other = String(fd.get('otherStatus') ?? '');
    if (other) {
      q.set('status', other);
    } else {
      const p = quickViewToParams(String(fd.get('view') ?? 'all') as IssueQuickView);
      if (p.status) q.set('status', p.status);
      if (p.overdueOnly) q.set('overdueOnly', p.overdueOnly);
    }
    go(q);
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 print:hidden">
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
                placeholder="Search issue no, title, contract, project or client"
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
            <label htmlFor="view" className={labelCls}>Status</label>
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
              aria-controls="issue-advanced-filters"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-primary hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-focus"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Advanced Filters
              <ChevronDown className={`size-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => router.push('/contracts/issues')}
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
          id="issue-advanced-filters"
          hidden={!advancedOpen}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-border pt-4"
        >
          <div>
            <label htmlFor="priority" className={labelCls}>Priority</label>
            <select id="priority" name="priority" defaultValue={priority ?? ''} className={inputCls}>
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="category" className={labelCls}>Category</label>
            <select id="category" name="category" defaultValue={category ?? ''} className={inputCls}>
              <option value="">All categories</option>
              {CONTRACT_ISSUE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
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

          <div className="sm:col-span-2">
            <span className={labelCls}>Raised Date Range</span>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" name="raisedDateFrom" defaultValue={raisedDateFrom} className={inputCls} aria-label="Raised date from" />
              <input type="date" name="raisedDateTo" defaultValue={raisedDateTo} className={inputCls} aria-label="Raised date to" />
            </div>
          </div>

          <div className="sm:col-span-2">
            <span className={labelCls}>Due Date Range</span>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" name="dueDateFrom" defaultValue={dueDateFrom} className={inputCls} aria-label="Due date from" />
              <input type="date" name="dueDateTo" defaultValue={dueDateTo} className={inputCls} aria-label="Due date to" />
            </div>
          </div>

          <div>
            <label htmlFor="otherStatus" className={labelCls}>Other Status</label>
            <select id="otherStatus" name="otherStatus" defaultValue={otherStatus} className={inputCls}>
              {OTHER_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3 flex items-end justify-end">
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
