'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { StorageContractProgress } from '@/lib/storage-delivery-pieces-api';
import { searchStorageContractsLocally, selectedProjectDelivery } from '../_lib/storage-dashboard-helpers';

// ---------------------------------------------------------------------------
// FMP-UI-33 — the Storage Yard & Delivery dashboard's one client component.
// Mirrors ProductionContractSelector (FMP-UI-32) exactly: every contract's
// full piece breakdown is already in `contracts`, so selecting a different
// one is a plain state change — no fetch, no loading state, no server
// action.
// ---------------------------------------------------------------------------

interface StorageContractSelectorProps {
  contracts: StorageContractProgress[];
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

export function StorageContractSelector({ contracts, defaultContractId }: StorageContractSelectorProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(defaultContractId);

  const results = searchStorageContractsLocally(contracts, query);
  const selected = contracts.find((c) => c.contractId === selectedId) ?? null;
  const progress = selected ? selectedProjectDelivery(selected) : null;

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
        <p className="mt-3 text-sm text-text-muted">No pieces ready for storage or delivery yet.</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-text-muted">Contract No.</dt><dd className="font-medium text-text-primary">{selected.referenceNumber}</dd></div>
            <div><dt className="text-xs text-text-muted">Project Name</dt><dd className="truncate font-medium text-text-primary">{selected.projectName}</dd></div>
            <div><dt className="text-xs text-text-muted">Job Order</dt><dd className="font-medium text-text-primary">{selected.jobOrder ?? '—'}</dd></div>
            <div><dt className="text-xs text-text-muted">Ready for Store</dt><dd className="font-medium text-text-primary">{selected.readyForStore}</dd></div>
            <div><dt className="text-xs text-text-muted">In Store</dt><dd className="font-medium text-text-primary">{selected.inStore}</dd></div>
            <div><dt className="text-xs text-text-muted">Delivered</dt><dd className="font-medium text-text-primary">{selected.delivered}</dd></div>
            <div><dt className="text-xs text-text-muted">Hold / Rejected</dt><dd className="font-medium text-text-primary">{selected.onHold + selected.rejected}</dd></div>
            <div><dt className="text-xs text-text-muted">Last Updated</dt><dd className="font-medium text-text-primary">{selected.lastUpdatedAt.slice(0, 10)}</dd></div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/storage-delivery/pieces?contractId=${selected.contractId}`}
              className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
            >
              Open Piece Delivery
            </Link>
            <Link
              href={`/contracts/${selected.contractId}`}
              className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
            >
              View Contract
            </Link>
          </div>

          {/* Selected Project Delivery */}
          <div className="mt-5 border-t border-border pt-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Selected Project Delivery</h3>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:max-w-sm">
              <FlowTile label="Ready for Store" value={selected.readyForStore} />
              <FlowTile label="In Store" value={selected.inStore} />
              <FlowTile label="Delivered" value={selected.delivered} />
            </div>
            {progress && (
              <div className="mt-3 space-y-0.5 text-sm text-text-secondary">
                <p>Delivered: <span className="font-semibold text-text-primary">{progress.delivered} of {progress.total}</span></p>
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
