'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { ProductionContractProgress } from '@/lib/production-pieces-api';
import { searchProductionContractsLocally, selectedProjectProduction } from '../_lib/production-dashboard-helpers';

// ---------------------------------------------------------------------------
// FMP-UI-32 — the Production & Planning dashboard's one client component.
// Simpler than the equivalent on the Contract Management/Technical
// dashboards (FMP-UI-29/31): every contract's full piece breakdown is
// already in `contracts` (one read-only query server-side already covers
// all of it), so selecting a different contract is a plain state change —
// no fetch, no loading state, no server action.
// ---------------------------------------------------------------------------

interface ProductionContractSelectorProps {
  contracts: ProductionContractProgress[];
  defaultContractId: string | null;
}

function FlowTile({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="rounded-lg bg-surface-secondary px-2 py-2 text-center">
      <p className="text-lg font-bold text-text-primary">{value}</p>
      <p className="text-[11px] text-text-secondary">{label}</p>
    </div>
  );
}

export function ProductionContractSelector({ contracts, defaultContractId }: ProductionContractSelectorProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(defaultContractId);

  const results = searchProductionContractsLocally(contracts, query);
  const selected = contracts.find((c) => c.contractId === selectedId) ?? null;
  const progress = selected ? selectedProjectProduction(selected) : null;

  function selectContract(id: string): void {
    setSelectedId(id);
    setQuery('');
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Select Contract / Project</h2>
      <div className="relative mt-2 max-w-md">
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
            {results.length === 0 ? (
              <p className="px-3 py-2 text-sm text-text-muted">No contracts match &ldquo;{query}&rdquo;.</p>
            ) : (
              <ul className="max-h-64 overflow-y-auto divide-y divide-border">
                {results.slice(0, 8).map((c) => (
                  <li key={c.contractId}>
                    <button
                      type="button"
                      onClick={() => selectContract(c.contractId)}
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      <span className="font-medium text-text-primary">{c.projectName}</span>
                      <span className="text-xs text-text-muted">{c.jobOrder ?? c.referenceNumber}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {!selected ? (
        <p className="mt-3 text-sm text-text-muted">No pieces ready for production yet.</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-text-muted">Contract No.</dt><dd className="font-medium text-text-primary">{selected.referenceNumber}</dd></div>
            <div><dt className="text-xs text-text-muted">Project Name</dt><dd className="truncate font-medium text-text-primary">{selected.projectName}</dd></div>
            <div><dt className="text-xs text-text-muted">Job Order</dt><dd className="font-medium text-text-primary">{selected.jobOrder ?? '—'}</dd></div>
            <div><dt className="text-xs text-text-muted">Ready for Production</dt><dd className="font-medium text-text-primary">{selected.readyForProduction}</dd></div>
            <div><dt className="text-xs text-text-muted">In Production</dt><dd className="font-medium text-text-primary">{selected.inProduction}</dd></div>
            <div><dt className="text-xs text-text-muted">Produced</dt><dd className="font-medium text-text-primary">{selected.produced}</dd></div>
            <div><dt className="text-xs text-text-muted">Hold / Rejected</dt><dd className="font-medium text-text-primary">{selected.onHold + selected.rejected}</dd></div>
            <div><dt className="text-xs text-text-muted">Last Updated</dt><dd className="font-medium text-text-primary">{selected.lastUpdatedAt.slice(0, 10)}</dd></div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/production/pieces?contractId=${selected.contractId}`}
              className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
            >
              Open Piece Production
            </Link>
            <Link
              href={`/contracts/${selected.contractId}`}
              className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
            >
              View Contract
            </Link>
          </div>

          {/* Selected Project Production */}
          <div className="mt-5 border-t border-border pt-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Selected Project Production</h3>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:max-w-sm">
              <FlowTile label="Ready" value={selected.readyForProduction} />
              <FlowTile label="In Production" value={selected.inProduction} />
              <FlowTile label="Produced" value={selected.produced} />
            </div>
            {progress && (
              <div className="mt-3 space-y-0.5 text-sm text-text-secondary">
                <p>Produced: <span className="font-semibold text-text-primary">{progress.produced} of {progress.total}</span></p>
                <p>Remaining: <span className="font-semibold text-text-primary">{progress.remaining}</span></p>
                {progress.holdOrRejected > 0 && (
                  <p>Hold / Rejected: <span className="font-semibold text-warning">{progress.holdOrRejected}</span></p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
