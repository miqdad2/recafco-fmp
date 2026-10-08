'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { BoqConfirmationItem } from '@/lib/technical-api';
import { searchContractsForDashboardAction, getContractBoqProgressForDashboardAction } from '../../actions';
import type { ContractSelectorResult } from '../../actions';
import { contractTotals } from '../../_lib/boq-progress-helpers';
import {
  selectedContractProgressState,
  buildSelectedContractIssues,
  formatBoqProgressForRow,
} from '../_lib/dashboard-selector-helpers';

// ---------------------------------------------------------------------------
// FMP-UI-29 — the one client component on this page. It owns the single
// piece of state every other part of the "selector" story shares: which
// contract is currently selected. Search results, a Recent Contracts row
// click, and the Selected Contract Progress card all read/write this same
// state — none of it navigates away by itself (per this unit's own "do not
// navigate away immediately" instruction); only the explicit "View Contract"
// / "View BOQ Progress" / per-row "View" links do.
//
// Overall BOQ Piece Progress, the KPI row, Needs Attention, and Today's
// Focus are plain server-rendered content on the page around this
// component — they need no client state, so they stay out of the browser
// bundle.
// ---------------------------------------------------------------------------

export interface SelectedContractBasics {
  id: string;
  referenceNumber: string;
  title: string;
  jobOrder?: string | undefined;
  status: string;
}

export interface RecentContractRow {
  id: string;
  referenceNumber: string;
  title: string;
  jobOrder?: string | undefined;
  status: string;
  updatedAt: string;
}

interface ContractDashboardLeftColumnProps {
  initialContract: SelectedContractBasics | null;
  initialBoqItems: BoqConfirmationItem[] | null;
  recentContracts: RecentContractRow[];
  /** Pre-fetched BOQ items for each of `recentContracts`, same order — lets a row click reuse data instead of re-fetching when possible. */
  recentContractsBoqItems: (BoqConfirmationItem[] | null)[];
}

function FlowTile({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="rounded-lg bg-surface-secondary px-2 py-2 text-center">
      <p className="text-lg font-bold text-text-primary">{value}</p>
      <p className="text-[11px] text-text-secondary">{label}</p>
    </div>
  );
}

export function ContractDashboardLeftColumn({
  initialContract,
  initialBoqItems,
  recentContracts,
  recentContractsBoqItems,
}: ContractDashboardLeftColumnProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContractSelectorResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SelectedContractBasics | null>(initialContract);
  const [boqItems, setBoqItems] = useState<BoqConfirmationItem[] | null>(initialBoqItems);
  const [loadingBoq, setLoadingBoq] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      searchContractsForDashboardAction(query)
        .then((found) => setResults(found))
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function selectBasics(basics: SelectedContractBasics, knownItems?: BoqConfirmationItem[] | null): void {
    setSelected(basics);
    setResults([]);
    setQuery('');
    if (knownItems !== undefined) {
      setBoqItems(knownItems);
      return;
    }
    setLoadingBoq(true);
    getContractBoqProgressForDashboardAction(basics.id)
      .then((items) => setBoqItems(items))
      .finally(() => setLoadingBoq(false));
  }

  function selectFromSearch(r: ContractSelectorResult): void {
    selectBasics({ id: r.id, referenceNumber: r.referenceNumber, title: r.title, jobOrder: r.jobOrder, status: r.status });
  }

  function selectFromRecentRow(row: RecentContractRow, index: number): void {
    // Reuse the already-fetched BOQ items for this row instead of re-fetching.
    selectBasics(
      { id: row.id, referenceNumber: row.referenceNumber, title: row.title, jobOrder: row.jobOrder, status: row.status },
      recentContractsBoqItems[index] ?? null,
    );
  }

  const totals = boqItems ? contractTotals(boqItems) : null;
  const stateMessage = selectedContractProgressState(boqItems);
  const issues = buildSelectedContractIssues(boqItems);

  return (
    <div className="space-y-4">
      {/* Contract / Project selector */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Select Contract / Project</h2>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contract no., job order, or project name"
            aria-label="Search contract or project"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus"
          />
          {query.trim().length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg">
              {searching ? (
                <p className="px-3 py-2 text-sm text-text-muted">Searching…</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-2 text-sm text-text-muted">No contracts match &ldquo;{query}&rdquo;.</p>
              ) : (
                <ul className="max-h-64 overflow-y-auto divide-y divide-border">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => selectFromSearch(r)}
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
                      >
                        <span className="font-medium text-text-primary">{r.title}</span>
                        <span className="text-xs text-text-muted">
                          {r.referenceNumber}{r.jobOrder ? ` · Job Order ${r.jobOrder}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {selected && (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-text-muted">Contract No.</dt>
              <dd className="font-medium text-text-primary">{selected.referenceNumber}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Project Name</dt>
              <dd className="truncate font-medium text-text-primary">{selected.title}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Job Order</dt>
              <dd className="font-medium text-text-primary">{selected.jobOrder ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Status</dt>
              <dd className="font-medium text-text-primary">{selected.status.replace(/_/g, ' ')}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* Selected Contract Progress */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Selected Contract Progress</h2>
        {!selected ? (
          <p className="mt-2 text-sm text-text-muted">Select a contract to view project progress.</p>
        ) : (
          <>
            <p className="mt-1 text-base font-semibold text-text-primary">
              {selected.referenceNumber} · {selected.title}
            </p>

            {loadingBoq ? (
              <p className="mt-3 text-sm text-text-muted">Loading progress…</p>
            ) : stateMessage ? (
              <p className="mt-3 text-sm text-text-muted">{stateMessage}</p>
            ) : totals ? (
              <>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  <FlowTile label="Confirmed" value={totals.confirmedPieces} />
                  <FlowTile label="Generated" value={totals.piecesGenerated} />
                  <FlowTile label="Produced" value={totals.produced} />
                  <FlowTile label="Delivered" value={totals.delivered} />
                  <FlowTile label="Erected" value={totals.erected} />
                  <FlowTile label="Completed" value={totals.completed} />
                </div>
                <p className="mt-2 text-sm text-text-secondary">
                  Completed: {totals.completed} of {totals.piecesGenerated}
                </p>
                {issues.length > 0 && (
                  <div className="mt-3 rounded-lg border border-warning/30 bg-warning-light p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-warning">Selected Contract Issues</p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-text-primary">
                      {issues.map((i) => (
                        <li key={i.text}>{i.text}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/contracts/${selected.id}`}
                className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
              >
                View Contract
              </Link>
              <Link
                href={`/contracts/${selected.id}/boq-progress`}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
              >
                View BOQ Progress
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Recent Contracts — max 5 rows; clicking a row selects it above, "View" opens the contract. */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Recent Contracts</h2>
          <Link href="/contracts" className="text-xs font-medium text-accent hover:underline">
            View all contracts
          </Link>
        </div>
        {recentContracts.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
            No recent contracts in scope.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Contract / Project</th>
                  <th className="hidden px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary sm:table-cell">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">BOQ Progress</th>
                  <th className="hidden px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary md:table-cell">Updated</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {recentContracts.map((row, i) => {
                  const boq = formatBoqProgressForRow(recentContractsBoqItems[i] ?? null);
                  const isSelected = selected?.id === row.id;
                  return (
                    <tr key={row.id} className={['border-b border-border last:border-b-0', isSelected ? 'bg-surface-secondary' : ''].join(' ')}>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => selectFromRecentRow(row, i)}
                          className="block w-full rounded text-left transition-colors hover:text-accent focus:outline-none focus:ring-1 focus:ring-focus"
                        >
                          <span className="block font-medium text-text-primary">{row.title}</span>
                          <span className="block font-mono text-xs text-text-muted">{row.referenceNumber}</span>
                        </button>
                      </td>
                      <td className="hidden px-3 py-2 sm:table-cell">
                        <span className="inline-block whitespace-nowrap rounded border border-border bg-surface-secondary px-2 py-0.5 text-xs font-medium text-text-secondary">
                          {row.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={boq.tone === 'warning' ? 'text-sm font-medium text-warning' : 'text-sm text-text-secondary'}>
                          {boq.text}
                        </span>
                      </td>
                      <td className="hidden px-3 py-2 text-xs text-text-muted md:table-cell">{row.updatedAt.slice(0, 10)}</td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/contracts/${row.id}`}
                          className="text-xs font-semibold text-accent hover:underline focus:outline-none focus:ring-1 focus:ring-focus"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
