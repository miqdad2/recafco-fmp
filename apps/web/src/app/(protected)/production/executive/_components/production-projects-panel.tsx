'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { ProductionContractProgress } from '@/lib/production-pieces-api';
import {
  PRODUCTION_PROJECT_FILTERS,
  countProductionProjectsByFilter,
  filterProductionProjects,
  selectedProjectProduction,
} from '../_lib/production-dashboard-helpers';
import type { ProductionProjectFilter } from '../_lib/production-dashboard-helpers';

// ---------------------------------------------------------------------------
// FMP-PROD-01 — the Production overview's one client component: the
// Projects / Job Orders list (quick filters + search) and the preview of the
// selected project. Every project's element counts are already in
// `contracts`, so filtering and selecting are plain state changes — no fetch.
// Status updates are NOT done here; "Open Production Work" goes to the work
// page, which enforces who may update what.
// ---------------------------------------------------------------------------

interface ProductionProjectsPanelProps {
  contracts: ProductionContractProgress[];
  defaultContractId: string | null;
}

const primaryBtn =
  'inline-flex h-8 items-center whitespace-nowrap rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2';
const secondaryBtn =
  'inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2';

function PreviewTile({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="rounded-lg bg-surface-secondary px-2 py-2 text-center">
      <p className="text-lg font-bold text-text-primary">{value}</p>
      <p className="text-[11px] text-text-secondary">{label}</p>
    </div>
  );
}

export function ProductionProjectsPanel({ contracts, defaultContractId }: ProductionProjectsPanelProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProductionProjectFilter>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(defaultContractId);

  const counts = countProductionProjectsByFilter(contracts);
  const rows = filterProductionProjects(contracts, query, filter);
  const selected = contracts.find((c) => c.contractId === selectedId) ?? null;
  const progress = selected ? selectedProjectProduction(selected) : null;

  return (
    <div className="space-y-4">
      <section aria-labelledby="production-projects-heading" className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <h2 id="production-projects-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Projects / Job Orders
        </h2>

        <div className="relative mt-2 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search job order, contract no, project name, or client"
            aria-label="Search projects"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Quick filters">
          {PRODUCTION_PROJECT_FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.value)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-focus ${
                  active ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-surface text-text-secondary hover:bg-surface-secondary'
                }`}
              >
                {f.label}
                <span className={active ? 'opacity-80' : 'text-text-muted'}>{counts[f.value]}</span>
              </button>
            );
          })}
        </div>

        {contracts.length === 0 ? (
          <div className="mt-4 rounded-lg border border-border p-6 text-center">
            <p className="text-sm text-text-muted">No elements released to Production yet.</p>
            <p className="mt-0.5 text-xs text-text-muted">Elements appear here after Technical releases them to Production.</p>
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border p-6 text-center text-sm text-text-muted">No projects match your search or filter.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Job Order / Contract</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Project</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Client</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">Ready Elements</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">In Production</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">Produced</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">Hold / Rejected</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Last Updated</th>
                  <th className="px-3 py-2"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c) => {
                  const isSelected = c.contractId === selectedId;
                  return (
                    <tr key={c.contractId} className={isSelected ? 'bg-surface-secondary/70' : 'hover:bg-surface-secondary/60'}>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setSelectedId(c.contractId)}
                          aria-pressed={isSelected}
                          title="Show preview"
                          className="font-mono text-xs font-medium text-text-primary underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-focus"
                        >
                          {c.jobOrder ?? c.referenceNumber}
                        </button>
                        {c.jobOrder && <p className="font-mono text-[11px] text-text-muted">{c.referenceNumber}</p>}
                      </td>
                      <td className="px-3 py-2 text-text-primary">{c.projectName}</td>
                      <td className="px-3 py-2 text-text-secondary">{c.clientName}</td>
                      <td className="px-3 py-2 text-right font-semibold text-text-primary">{c.readyForProduction}</td>
                      <td className="px-3 py-2 text-right font-semibold text-text-primary">{c.inProduction}</td>
                      <td className="px-3 py-2 text-right font-semibold text-text-primary">{c.produced}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${c.onHold + c.rejected > 0 ? 'text-warning' : 'text-text-muted'}`}>
                        {c.onHold + c.rejected}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-text-secondary">{c.lastUpdatedAt.slice(0, 10)}</td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/production/pieces?contractId=${c.contractId}`} className={primaryBtn}>
                          Open Production Work
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

      {selected && progress && (
        <section aria-labelledby="production-selected-heading" className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <h2 id="production-selected-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Selected Project Production
          </h2>
          <p className="mt-1 text-sm font-medium text-text-primary">
            {selected.projectName} <span className="font-normal text-text-muted">· {selected.jobOrder ?? selected.referenceNumber}</span>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-md sm:grid-cols-4">
            <PreviewTile label="Ready" value={selected.readyForProduction} />
            <PreviewTile label="In Production" value={selected.inProduction} />
            <PreviewTile label="Produced" value={selected.produced} />
            <PreviewTile label="Remaining" value={progress.remaining} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/production/pieces?contractId=${selected.contractId}`}
              className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
            >
              Open Production Work
            </Link>
            <Link href={`/contracts/${selected.contractId}`} className={secondaryBtn}>
              View Contract
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
