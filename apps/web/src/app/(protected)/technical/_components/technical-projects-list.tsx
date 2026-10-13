'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, X, ArrowRight, AlertTriangle, CheckCircle2, FilePlus2, Layers, Sparkles } from 'lucide-react';
import {
  filterOverviewRows,
  filterRowsByQuickFilter,
  quickFilterCounts,
  OVERVIEW_FILTERS,
  OVERVIEW_STATUS_TONE,
  ATTENTION_FILTERS,
} from '../_lib/technical-overview-helpers';
import type { TechnicalOverviewRow, TechnicalOverviewStatus, ProductionReleaseStatus, OverviewFilter } from '../_lib/technical-overview-helpers';
import type { TechnicalAttentionRow } from '../_lib/technical-dashboard-selector-helpers';

// ---------------------------------------------------------------------------
// FMP-TECH-18 — the Technical Overview's main section. One client component
// owns search + the quick filter so the "Today's Technical Work" strip, the
// filter chips and the Needs Attention rows all narrow the same table. All
// filtering is local, over rows the server already built; the only link is
// "Open Technical Details" and nothing here updates data.
// ---------------------------------------------------------------------------

const TONE_CLASSES = {
  muted: 'bg-surface-secondary text-text-muted',
  info: 'bg-module-technical-light text-module-technical',
  warning: 'bg-warning-light text-warning',
  success: 'bg-success-light text-success',
} as const;

const PRODUCTION_CLASSES: Record<ProductionReleaseStatus, string> = {
  'Not ready': 'text-text-muted',
  'Waiting final drawings': 'text-warning',
  'Waiting release': 'text-warning',
  'Released': 'text-success',
};

function StatusBadge({ status }: { status: TechnicalOverviewStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[OVERVIEW_STATUS_TONE[status]]}`}>
      {status}
    </span>
  );
}

interface FocusItem {
  filter: OverviewFilter;
  label: string;
  icon: typeof Sparkles;
}
const FOCUS_ITEMS: FocusItem[] = [
  { filter: 'new', label: 'New Jobs', icon: Sparkles },
  { filter: 'needs-pieces', label: 'Confirm Elements', icon: Layers },
  { filter: 'needs-final', label: 'Add Final Drawings', icon: FilePlus2 },
];

export function TechnicalProjectsList({ rows, attentionRows }: { rows: TechnicalOverviewRow[]; attentionRows: TechnicalAttentionRow[] }): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<OverviewFilter>('all');
  const counts = quickFilterCounts(rows);
  const visible = filterRowsByQuickFilter(filterOverviewRows(rows, query), filter);
  const isFiltered = query.trim() !== '' || filter !== 'all';
  const allAttentionZero = attentionRows.every((r) => r.value === 0);

  function clearFilters(): void {
    setQuery('');
    setFilter('all');
  }

  return (
    <div className="space-y-4">
      {/* Today's Technical Work — clicking narrows the table below. */}
      <section aria-labelledby="technical-today-heading" className="rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
        <h2 id="technical-today-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Today&apos;s Technical Work</h2>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {FOCUS_ITEMS.map(({ filter: f, label, icon: Icon }) => {
            const active = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(active ? 'all' : f)}
                aria-pressed={active}
                className={`flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-focus ${
                  active ? 'border-accent bg-accent-light' : 'border-border bg-surface hover:bg-surface-secondary'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  <Icon className="size-4 text-text-secondary" aria-hidden="true" />
                  {label}
                </span>
                <span className="text-xl font-bold tabular-nums text-text-primary">{counts[f]}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[3fr_1fr]">
        <section aria-labelledby="technical-projects-heading" className="space-y-3">
          <h2 id="technical-projects-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Projects / Contracts
          </h2>

          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search job order, contract no, project name, or client"
                aria-label="Search projects or contracts"
                aria-describedby="technical-search-help"
                className="h-12 w-full rounded-lg border border-border bg-background pl-11 pr-11 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus"
              />
              {query !== '' && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-text-muted hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <p id="technical-search-help" className="mt-1 text-xs text-text-muted">Type to quickly find a project or job order.</p>
          </div>

          <div role="group" aria-label="Quick filters" className="flex flex-wrap gap-2">
            {OVERVIEW_FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  aria-pressed={active}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-focus ${
                    active ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-surface text-text-secondary hover:bg-surface-secondary'
                  }`}
                >
                  {f.label}
                  <span className={`tabular-nums ${active ? 'opacity-90' : 'text-text-muted'}`}>{counts[f.key]}</span>
                </button>
              );
            })}
          </div>

          {rows.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-10 text-center">
              <p className="text-base font-medium text-text-primary">No technical jobs found.</p>
              <p className="mt-1 text-sm text-text-secondary">Projects appear here once a contract has a job order.</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-8 text-center">
              <p className="text-base font-medium text-text-primary">No technical jobs found.</p>
              <p className="mt-1 text-sm text-text-secondary">Try another job order, contract no, project name, or clear filters.</p>
              {isFiltered && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="bg-surface-secondary text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-4 py-2.5">Job Order / Contract No</th>
                    <th className="px-4 py-2.5">Project / Client</th>
                    <th className="px-4 py-2.5">Technical Status</th>
                    <th className="px-4 py-2.5">Element Status</th>
                    <th className="px-4 py-2.5">Production Release</th>
                    <th className="px-4 py-2.5">Next Action</th>
                    <th className="px-4 py-2.5 text-right"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map(({ job, status, piecesText, production, nextAction }) => {
                    const isNew = status === 'Not Started';
                    return (
                      <tr key={job.contractId} className={isNew ? 'bg-module-technical-light/30 hover:bg-module-technical-light/50' : 'hover:bg-surface-secondary/60'}>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold leading-snug text-text-primary">{job.jobOrderNo ?? job.referenceNumber}</p>
                            {isNew && (
                              <span className="rounded bg-module-technical px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">New</span>
                            )}
                          </div>
                          {job.jobOrderNo && <p className="text-[11px] leading-snug text-text-muted">{job.referenceNumber}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium leading-snug text-text-primary">{job.projectName}</p>
                          <p className="text-[11px] leading-snug text-text-muted">{job.clientEmployer}</p>
                          {isNew && <p className="mt-0.5 text-[11px] font-medium text-module-technical">New job from Contract Management</p>}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={status} /></td>
                        <td className="px-4 py-3 text-text-secondary">{piecesText}</td>
                        <td className={`px-4 py-3 font-medium ${PRODUCTION_CLASSES[production]}`}>{production}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-text-primary">
                            {nextAction !== 'No action needed' && <ArrowRight className="size-3.5 text-accent" aria-hidden="true" />}
                            {nextAction}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/technical/jobs/${job.contractId}`}
                            className="inline-flex h-9 min-w-[10.5rem] items-center justify-center whitespace-nowrap rounded-md bg-accent px-3 text-xs font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
                          >
                            Open Technical Details
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="technical-attention-heading" className="space-y-3">
          <h2 id="technical-attention-heading" className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            Needs Attention
          </h2>
          {allAttentionZero ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-success/40 bg-success-light p-4 text-sm text-success">
              <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
              No urgent items.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface p-2 shadow-sm">
              <ul className="divide-y divide-border">
                {attentionRows.map((row) => {
                  const target = ATTENTION_FILTERS[row.label] ?? null;
                  const isAlert = row.value > 0;
                  const content = (
                    <>
                      <span className="flex items-center gap-1.5 text-sm font-medium text-text-secondary">
                        {isAlert && <AlertTriangle className="size-3.5 text-warning" aria-hidden="true" />}
                        {row.label}
                      </span>
                      <span className={`text-lg font-bold ${isAlert ? 'text-warning' : 'text-text-secondary'}`}>{row.value}</span>
                    </>
                  );
                  return (
                    <li key={row.label}>
                      {target ? (
                        <button
                          type="button"
                          onClick={() => setFilter(target)}
                          aria-pressed={filter === target}
                          title="Show these projects in the list"
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
                        >
                          {content}
                        </button>
                      ) : (
                        <div className="flex items-center justify-between gap-3 px-3 py-2.5">{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
