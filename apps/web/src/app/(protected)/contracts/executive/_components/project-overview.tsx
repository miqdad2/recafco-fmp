'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, Search, X } from 'lucide-react';
import { searchContractsForDashboardAction, getContractBoqProgressForDashboardAction } from '../../actions';
import { RefreshButton } from '../../../technical/_components/refresh-button';
import {
  FILTER_CHIPS,
  boqProgressText,
  buildAttentionPanelRows,
  buildProjectRow,
  filterRows,
  reached,
  rowActions,
  selectedProgressMessage,
  stageText,
  statusLabel,
  summarizeProgress,
} from '../_lib/project-overview-helpers';
import type { ProjectFilter, ProjectRow, ReasonKey } from '../_lib/project-overview-helpers';

// ---------------------------------------------------------------------------
// FMP-UI-38 — the one client component on the common Contract Management
// overview. It owns the search text, the filter chip, the Needs Attention
// filter and which contract is selected; the header, the four summary cards
// and Overall BOQ Progress are plain server-rendered content around it.
// Read-only: nothing here writes anything, and every action link is gated by
// a permission the user already has (see rowActions()).
// ---------------------------------------------------------------------------

interface Props {
  rows: ProjectRow[];
  permissions: string[];
  /** Outstanding payments across the contracts the user can see; null when not available. */
  paymentsPending: number | null;
  /** Overall BOQ Progress card (server-rendered), shown beside the selected contract. */
  overall: React.ReactNode;
}

const TONE_TEXT = { error: 'text-error', warning: 'text-warning', neutral: 'text-text-secondary' } as const;
const thCls = 'bg-surface-secondary px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary';

function FlowTile({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="rounded-lg bg-surface-secondary px-2 py-2 text-center">
      <p className="text-lg font-bold text-text-primary">{value}</p>
      <p className="text-[11px] text-text-secondary">{label}</p>
    </div>
  );
}

export function ProjectOverview({ rows: initialRows, permissions, paymentsPending, overall }: Props): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProjectFilter>('ALL');
  const [reason, setReason] = useState<ReasonKey | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Contracts found by searching that are not among the latest ones loaded with the page.
  const [extraRows, setExtraRows] = useState<ProjectRow[]>([]);
  const [searching, setSearching] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setExtraRows([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchContractsForDashboardAction(q)
        .then(async (found) => {
          const known = new Set(initialRows.map((r) => r.id));
          const extras = found.filter((f) => !known.has(f.id));
          const built = await Promise.all(
            extras.map(async (f) =>
              buildProjectRow({
                id: f.id,
                referenceNumber: f.referenceNumber,
                title: f.title,
                status: f.status,
                client: f.client,
                jobOrder: f.jobOrder ?? null,
                openClaims: f.openClaims,
                progress: summarizeProgress(await getContractBoqProgressForDashboardAction(f.id)),
              }),
            ),
          );
          if (!cancelled) setExtraRows(built);
        })
        .catch(() => {
          if (!cancelled) setExtraRows([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, initialRows]);

  const allRows = useMemo(() => [...initialRows, ...extraRows], [initialRows, extraRows]);
  const visibleRows = useMemo(
    () => [
      ...filterRows(initialRows, { query, filter, reason }),
      // Found by the server's own search (it also matches fields not shown here), so the text is not re-checked.
      ...filterRows(extraRows, { query: '', filter, reason }),
    ],
    [initialRows, extraRows, query, filter, reason],
  );
  const attentionRows = useMemo(() => buildAttentionPanelRows(initialRows, paymentsPending), [initialRows, paymentsPending]);
  const selected = allRows.find((r) => r.id === selectedId) ?? null;
  const reasonLabel = attentionRows.find((a) => a.reason === reason)?.label ?? null;

  function select(id: string): void {
    setSelectedId(id);
    // Bring the preview into view without jumping the page around on small screens.
    setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
  }

  const totals = selected?.progress ?? null;
  const message = selected ? selectedProgressMessage(totals) : null;

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {/* Find Contract / Project */}
        <section aria-labelledby="find-heading" className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <h2 id="find-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Find Contract / Project</h2>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contract no, project name, job order, or client"
              aria-label="Search contract or project"
              className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter contracts">
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip.key}
                type="button"
                aria-pressed={filter === chip.key}
                onClick={() => setFilter(chip.key)}
                className={[
                  'rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-focus',
                  filter === chip.key
                    ? 'border-accent bg-accent text-accent-foreground'
                    : 'border-border bg-surface text-text-secondary hover:bg-surface-secondary',
                ].join(' ')}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </section>

        {/* Row 4 — Contracts / Projects (about 70%) beside Needs Attention (about 30%) */}
        <div className="grid gap-4 lg:grid-cols-[7fr_3fr] lg:items-stretch">
        <section aria-labelledby="projects-heading" className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="projects-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Contracts / Projects</h2>
            <div className="flex items-center gap-3 text-xs">
              {reason && reasonLabel && (
                <button
                  type="button"
                  onClick={() => setReason(null)}
                  className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/5 px-2.5 py-1 font-medium text-accent hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  {reasonLabel}
                  <X className="size-3" aria-hidden="true" />
                  <span className="sr-only">Clear</span>
                </button>
              )}
              <Link href="/contracts" className="font-medium text-accent hover:underline">View all contracts</Link>
              <RefreshButton />
            </div>
          </div>

          {visibleRows.length === 0 ? (
            <div className="flex-1 rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
              {searching ? 'Searching…' : query.trim() || filter !== 'ALL' || reason ? 'No contracts match. Try a different search or filter.' : 'No contracts to show yet.'}
            </div>
          ) : (
            <div className="max-h-[24rem] flex-1 overflow-auto rounded-lg border border-border bg-surface">
              <table className="w-full min-w-[56rem] text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-border">
                    <th className={thCls}>Contract / Project</th>
                    <th className={thCls}>Client / Job Order</th>
                    <th className={thCls}>Current Status</th>
                    <th className={thCls}>BOQ Progress</th>
                    <th className={thCls}>Production</th>
                    <th className={thCls}>Delivery</th>
                    <th className={thCls}>Erection</th>
                    <th className={thCls}>Attention</th>
                    <th className={`${thCls} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const r = row.progress ? reached(row.progress) : null;
                    const actions = rowActions(row, permissions);
                    const shown = row.reasons.slice(0, 2);
                    return (
                      <tr key={row.id} className={['border-b border-border align-top last:border-b-0', selectedId === row.id ? 'bg-surface-secondary' : ''].join(' ')}>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => select(row.id)}
                            aria-label={`Select ${row.title}`}
                            className="block max-w-[18rem] rounded text-left transition-colors hover:text-accent focus:outline-none focus:ring-1 focus:ring-focus"
                          >
                            <span className="line-clamp-2 font-medium leading-snug text-text-primary" title={row.title}>{row.title}</span>
                            <span className="block font-mono text-[11px] text-text-muted">{row.referenceNumber}</span>
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <span className="block max-w-[12rem] truncate text-text-primary" title={row.client}>{row.client || '—'}</span>
                          <span className="block text-xs text-text-muted">{row.jobOrder ? `Job Order ${row.jobOrder}` : '—'}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-block whitespace-nowrap rounded border border-border bg-surface-secondary px-2 py-0.5 text-xs font-medium text-text-secondary">
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-text-secondary">{boqProgressText(row.progress)}</td>
                        <td className="px-3 py-2 text-text-secondary">{stageText(r?.produced ?? 0, row.progress)}</td>
                        <td className="px-3 py-2 text-text-secondary">{stageText(r?.delivered ?? 0, row.progress)}</td>
                        <td className="px-3 py-2 text-text-secondary">{stageText(r?.erected ?? 0, row.progress)}</td>
                        <td className="px-3 py-2">
                          {shown.length === 0 ? (
                            <span className="text-text-muted">—</span>
                          ) : (
                            <ul className="space-y-0.5">
                              {shown.map((x) => (
                                <li key={x.key} className={`text-xs font-medium ${x.kind === 'attention' ? 'text-warning' : 'text-text-secondary'}`}>{x.label}</li>
                              ))}
                              {row.reasons.length > shown.length && (
                                <li className="text-xs text-text-muted" title={row.reasons.slice(2).map((x) => x.label).join(', ')}>+{row.reasons.length - shown.length} more</li>
                              )}
                            </ul>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center justify-end gap-3 text-xs font-semibold">
                            {actions.primary.map((a) => (
                              <Link key={a.key} href={a.href} className="text-accent hover:underline focus:outline-none focus:ring-1 focus:ring-focus">{a.label}</Link>
                            ))}
                            {actions.more.length > 0 && (
                              <details>
                                <summary className="cursor-pointer list-none font-medium text-text-muted hover:text-text-secondary" aria-label={`More actions for ${row.title}`}>More</summary>
                                <div className="mt-1 flex flex-col items-end gap-1 font-normal">
                                  {actions.more.map((a) => (
                                    <Link key={a.key} href={a.href} className="text-text-primary hover:text-accent hover:underline">{a.label}</Link>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

      {/* Needs Attention — one panel; a row filters the table to the contracts behind it */}
      <aside aria-labelledby="attention-heading" className="space-y-2 flex flex-col gap-2">
        <h2 id="attention-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Needs Attention</h2>
        <div className="flex-1 rounded-xl border border-border bg-surface p-2 shadow-sm">
          <ul className="flex h-full flex-col divide-y divide-border">
            {attentionRows.map((row) => {
              const isAlert = row.tone !== 'neutral' && (row.value ?? 0) > 0;
              const active = row.reason !== null && reason === row.reason;
              const content = (
                <>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-text-secondary">
                    {isAlert ? (
                      <AlertTriangle className={`size-3.5 ${row.tone === 'error' ? 'text-error' : 'text-warning'}`} aria-hidden="true" />
                    ) : (
                      (row.value ?? 0) === 0 && row.value !== null && <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />
                    )}
                    {row.label}
                  </span>
                  <span className={`text-lg font-bold ${isAlert ? TONE_TEXT[row.tone] : 'text-text-secondary'}`}>{row.value ?? '—'}</span>
                </>
              );
              const cls = `flex h-full min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus ${active ? 'bg-surface-secondary ring-1 ring-accent/40' : ''}`;
              return (
                <li key={row.label} className="flex-1">
                  {row.href ? (
                    <Link href={row.href} className={cls}>{content}</Link>
                  ) : (
                    <button type="button" aria-pressed={active} onClick={() => setReason(active ? null : row.reason)} className={cls}>{content}</button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <p className="px-1 text-xs text-text-muted">Counts are for the newest contracts in the list. Select a row to show those contracts.</p>
      </aside>
        </div>

        {/* Row 5 — Selected Contract beside Overall BOQ Progress */}
        <div className="grid gap-4 lg:grid-cols-[11fr_9fr] lg:items-stretch">
        <section ref={previewRef} aria-labelledby="selected-heading" className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <h2 id="selected-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Selected Contract</h2>
          {!selected ? (
            <p className="mt-2 text-sm text-text-muted">Select a contract to see project progress.</p>
          ) : (
            <>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-text-muted">Contract No</dt>
                  <dd className="font-medium text-text-primary">{selected.referenceNumber}</dd>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <dt className="text-xs text-text-muted">Project Name</dt>
                  <dd className="truncate font-medium text-text-primary" title={selected.title}>{selected.title}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Client</dt>
                  <dd className="truncate font-medium text-text-primary">{selected.client || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Job Order</dt>
                  <dd className="font-medium text-text-primary">{selected.jobOrder ?? '—'}</dd>
                </div>
              </dl>

              {message ? (
                <p className="mt-3 text-sm text-text-muted">{message}</p>
              ) : totals ? (
                <div className="mt-3 flex flex-wrap items-stretch gap-1.5" aria-label="Progress: Confirmed, Generated, Produced, Delivered, Erected, Completed">
                  {[
                    ['Confirmed', totals.confirmed],
                    ['Generated', totals.generated],
                    ['Produced', totals.produced],
                    ['Delivered', totals.delivered],
                    ['Erected', totals.erected],
                    ['Completed', totals.completed],
                  ].map(([label, value], i, list) => (
                    <div key={label as string} className="flex items-center gap-1.5">
                      <div className="w-[5.5rem]"><FlowTile label={label as string} value={value as number} /></div>
                      {i < list.length - 1 && <ArrowRight className="hidden size-3.5 text-text-muted sm:block" aria-hidden="true" />}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/contracts/${selected.id}`}
                  className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
                >
                  Open Contract
                </Link>
                <Link
                  href={`/contracts/${selected.id}/boq-progress`}
                  className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
                >
                  Open BOQ Progress
                </Link>
              </div>
            </>
          )}
        </section>
        {overall}
        </div>
      </div>
    </div>
  );
}
