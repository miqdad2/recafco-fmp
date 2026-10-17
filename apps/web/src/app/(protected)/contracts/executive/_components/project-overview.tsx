'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, FolderOpen, ListChecks, RotateCcw, Search, X } from 'lucide-react';
import { searchContractsForDashboardAction, getContractBoqProgressForDashboardAction } from '../../actions';
import { RefreshButton } from '../../../technical/_components/refresh-button';
import { BOQ_BUTTON_CLS, OPEN_BUTTON_CLS } from '../../_components/contract-row-actions';
import {
  FILTER_CHIPS,
  boqElementsText,
  buildAttentionPanelRows,
  buildProjectRow,
  filterRows,
  hasActiveFilters,
  projectCountText,
  reached,
  rowActions,
  selectedMetrics,
  selectedProgressMessage,
  stageCell,
  statusBadgeClass,
  statusLabel,
  summarizeProgress,
} from '../_lib/project-overview-helpers';
import type { ProjectFilter, ProjectRow, ReasonKey } from '../_lib/project-overview-helpers';

// ---------------------------------------------------------------------------
// FMP-UI-38 / 48 / 49 — the one client component on the Contract Management
// dashboard. On desktop it is laid out to fit the screen without page
// scrolling: search + filters, then the projects list beside Needs Attention
// (this row takes whatever height is left and each panel scrolls inside
// itself), then one compact BOQ Element Progress strip that shows the overall
// totals and — when a project is selected — that project's own stages.
// Below `lg` everything stacks and the page scrolls normally.
// Read-only: nothing here writes anything.
// ---------------------------------------------------------------------------

interface Props {
  rows: ProjectRow[];
  /** Outstanding payments across the contracts the user can see; null when not available. */
  paymentsPending: number | null;
  /** Overall BOQ Element Progress totals (all contracts the user can see); null = no progress yet. */
  overallTiles: { label: string; value: number }[] | null;
  overallNote: string | null;
  /** How many contracts exist in the user's scope (the page only loads the newest ones up front). */
  totalContracts: number;
}

const TONE_TEXT = { error: 'text-error', warning: 'text-warning', neutral: 'text-text-secondary' } as const;
const thCls = 'bg-surface-secondary px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary';

function RowButtons({ row }: { row: ProjectRow }): React.JSX.Element {
  return (
    <div className="flex flex-col items-start gap-1.5 2xl:flex-row 2xl:items-center">
      {rowActions(row).map((a) => (
        <Link
          key={a.key}
          href={a.href}
          title={a.title}
          aria-label={`${a.label} — ${row.title}`}
          className={`${a.key === 'boq' ? BOQ_BUTTON_CLS : OPEN_BUTTON_CLS} !h-7`}
        >
          {a.key === 'boq' ? <ListChecks className="size-3.5 shrink-0" aria-hidden="true" /> : <FolderOpen className="size-3.5 shrink-0" aria-hidden="true" />}
          {a.label}
        </Link>
      ))}
    </div>
  );
}

function StatusCell({ row }: { row: ProjectRow }): React.JSX.Element {
  const shown = row.reasons.slice(0, 1);
  return (
    <div className="space-y-0.5">
      <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}>
        {statusLabel(row.status)}
      </span>
      {shown.map((x) => (
        <p key={x.key} className={`truncate text-xs ${x.kind === 'attention' ? 'font-medium text-warning' : 'text-text-muted'}`}>{x.label}</p>
      ))}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number | null }): React.JSX.Element {
  return (
    <div className="rounded-lg bg-surface-secondary px-2.5 py-1.5">
      <p className={value === null ? 'text-sm font-medium leading-6 text-text-muted' : 'text-lg font-bold leading-6 text-text-primary'}>{value ?? 'Not available'}</p>
      <p className="text-xs leading-tight text-text-secondary">{label}</p>
    </div>
  );
}

export function ProjectOverview({ rows: initialRows, paymentsPending, overallTiles, overallNote, totalContracts }: Props): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProjectFilter>('ALL');
  const [reason, setReason] = useState<ReasonKey | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Contracts found by searching that are not among the latest ones loaded with the page.
  const [extraRows, setExtraRows] = useState<ProjectRow[]>([]);
  const [searching, setSearching] = useState(false);

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
  const filtersActive = hasActiveFilters(query, filter, reason);

  function reset(): void {
    setQuery('');
    setFilter('ALL');
    setReason(null);
  }

  /** Clicking anywhere on a row selects it — except on its own buttons / links, which do their own thing. */
  function onRowClick(e: React.MouseEvent, id: string): void {
    if ((e.target as HTMLElement).closest('a,button')) return;
    setSelectedId(id);
  }

  const totals = selected?.progress ?? null;
  const message = selected ? selectedProgressMessage(totals) : null;

  return (
    <div className="flex flex-col gap-2 lg:min-h-0 lg:flex-1">
      {/* Find Contract / Project — one compact card */}
      <section aria-labelledby="find-heading" className="shrink-0 rounded-xl border border-border bg-surface px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 id="find-heading" className="whitespace-nowrap text-sm font-semibold text-text-primary max-2xl:sr-only lg:max-2xl:sr-only">Find Contract / Project</h2>
          <div className="relative w-full min-w-0 md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contract no, project name, job order, or client"
              aria-label="Search contract or project"
              className="h-10 w-full rounded-lg border border-border-strong bg-background pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter contracts">
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip.key}
                type="button"
                aria-pressed={filter === chip.key}
                onClick={() => setFilter(chip.key)}
                className={[
                  'h-7 cursor-pointer rounded-full border px-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-focus',
                  filter === chip.key
                    ? 'border-accent bg-accent text-accent-foreground'
                    : 'border-border bg-surface text-text-secondary hover:bg-surface-secondary',
                ].join(' ')}
              >
                {chip.label}
              </button>
            ))}
            {filtersActive && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-accent hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-focus"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Contracts / Projects beside Needs Attention — this row takes the leftover height; each panel scrolls inside itself */}
      <div className="grid gap-2 lg:min-h-[13rem] lg:flex-1 lg:grid-cols-[minmax(0,1fr)_15rem] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_17rem] 2xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="projects-heading" className="flex min-h-0 min-w-0 flex-col gap-1.5">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-x-2">
              <h2 id="projects-heading" className="shrink-0 text-sm font-semibold uppercase tracking-wide text-text-secondary">Contracts / Projects</h2>
              <span className="min-w-0 truncate text-xs text-text-muted" aria-live="polite" title={projectCountText({ shown: visibleRows.length, loaded: initialRows.length, total: totalContracts, filtersActive, searching })}>
                {projectCountText({ shown: visibleRows.length, loaded: initialRows.length, total: totalContracts, filtersActive, searching })}
              </span>
              {reason && reasonLabel && (
                <button
                  type="button"
                  onClick={() => setReason(null)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-accent/40 bg-accent/5 px-2.5 py-0.5 text-xs font-medium text-accent hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  {reasonLabel}
                  <X className="size-3" aria-hidden="true" />
                  <span className="sr-only">Clear</span>
                </button>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs">
              <Link
                href="/contracts"
                className="inline-flex h-7 items-center rounded-md border border-border bg-surface px-3 font-semibold text-text-primary shadow-sm transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
              >
                View All Contracts
              </Link>
              <RefreshButton />
            </div>
          </div>

          {visibleRows.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
              {searching ? 'Searching…' : filtersActive ? 'No contracts match. Try a different search or filter.' : 'No contracts to show yet.'}
            </div>
          ) : (
            <>
              {/* Tablet / desktop: table, scrolling inside its own panel */}
              <div className="hidden max-h-[26rem] min-h-0 overflow-y-auto rounded-lg border border-border bg-surface md:block lg:max-h-none lg:flex-1">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col />
                    <col className="w-[8.5rem]" />
                    <col className="w-[9.5rem]" />
                    <col className="hidden w-[8rem] 2xl:table-column" />
                    <col className="hidden w-[9rem] 2xl:table-column" />
                    <col className="w-[9.5rem] 2xl:w-[15rem]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-border">
                      <th className={thCls}>Contract / Project</th>
                      <th className={thCls}>Status</th>
                      <th className={thCls}>BOQ Elements</th>
                      <th className={`${thCls} hidden 2xl:table-cell`}>Production</th>
                      <th className={`${thCls} hidden 2xl:table-cell`}>Delivery / Erection</th>
                      <th className={thCls}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const r = row.progress ? reached(row.progress) : null;
                      const boq = boqElementsText(row.progress);
                      const isSelected = selectedId === row.id;
                      return (
                        <tr
                          key={row.id}
                          onClick={(e) => onRowClick(e, row.id)}
                          aria-selected={isSelected}
                          title="Select to see this project's element progress"
                          className={[
                            'cursor-pointer border-b border-border align-top transition-colors last:border-b-0',
                            isSelected ? 'bg-accent/5 shadow-[inset_3px_0_0_var(--color-accent)]' : 'hover:bg-surface-secondary/60',
                          ].join(' ')}
                        >
                          <td className="px-3 py-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedId(row.id)}
                              aria-label={`Select ${row.title}`}
                              className="block w-full cursor-pointer rounded text-left focus:outline-none focus:ring-2 focus:ring-focus"
                            >
                              <span className="line-clamp-1 font-medium 2xl:line-clamp-2 leading-snug text-text-primary" title={row.title}>{row.title}</span>
                              <span className="block truncate font-mono text-xs text-text-muted">{row.referenceNumber}{row.jobOrder ? ` · JO ${row.jobOrder}` : ''}</span>
                              <span className="block truncate text-xs text-text-secondary" title={row.client}>{row.client || '—'}</span>
                            </button>
                          </td>
                          <td className="px-3 py-1.5"><StatusCell row={row} /></td>
                          <td className="px-3 py-1.5">
                            <span className="block whitespace-nowrap text-text-primary">{boq.primary}</span>
                            {boq.secondary && <span className="block whitespace-nowrap text-xs text-text-muted">{boq.secondary}</span>}
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-1.5 text-text-secondary 2xl:table-cell">{stageCell(r?.produced ?? 0, row.progress, 'produced')}</td>
                          <td className="hidden whitespace-nowrap px-3 py-1.5 text-text-secondary 2xl:table-cell">
                            <span className="block">{stageCell(r?.delivered ?? 0, row.progress, 'delivered')}</span>
                            <span className="block text-xs text-text-muted">{stageCell(r?.erected ?? 0, row.progress, 'erected')}</span>
                          </td>
                          <td className="px-3 py-1.5"><RowButtons row={row} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: one card per project */}
              <ul className="space-y-2 md:hidden">
                {visibleRows.map((row) => {
                  const boq = boqElementsText(row.progress);
                  const isSelected = selectedId === row.id;
                  return (
                    <li key={row.id} className={`rounded-lg border bg-surface p-3 ${isSelected ? 'border-accent bg-accent/5' : 'border-border'}`}>
                      <button type="button" onClick={() => setSelectedId(row.id)} aria-label={`Select ${row.title}`} className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-focus">
                        <span className="block font-medium leading-snug text-text-primary">{row.title}</span>
                        <span className="mt-0.5 block font-mono text-xs text-text-muted">{row.referenceNumber}{row.jobOrder ? ` · Job Order ${row.jobOrder}` : ''}</span>
                        <span className="block text-xs text-text-secondary">{row.client || '—'}</span>
                      </button>
                      <div className="mt-2"><StatusCell row={row} /></div>
                      <p className="mt-2 text-xs text-text-secondary">{boq.primary}{boq.secondary ? ` · ${boq.secondary}` : ''}</p>
                      <div className="mt-3"><RowButtons row={row} /></div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        {/* Needs Attention — compact; a tile with something to act on filters the list */}
        <aside aria-labelledby="attention-heading" className="flex min-h-0 flex-col gap-1.5">
          <h2 id="attention-heading" className="shrink-0 text-sm font-semibold uppercase tracking-wide text-text-secondary">Needs Attention</h2>
          <div className="min-h-0 overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-sm lg:flex-1">
            <ul className="divide-y divide-border">
              {attentionRows.map((row) => {
                const value = row.value ?? 0;
                const isAlert = row.tone !== 'neutral' && value > 0;
                const active = row.reason !== null && reason === row.reason;
                const actionable = row.value !== null && value > 0 && (row.href !== undefined || row.reason !== null);
                const content = (
                  <>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-text-secondary">
                      {isAlert ? (
                        <AlertTriangle className={`size-3.5 shrink-0 ${row.tone === 'error' ? 'text-error' : 'text-warning'}`} aria-hidden="true" />
                      ) : (
                        row.value === 0 && <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-hidden="true" />
                      )}
                      {row.label}
                    </span>
                    <span className={`text-base font-bold ${isAlert ? TONE_TEXT[row.tone] : value > 0 ? 'text-text-primary' : 'text-text-muted'}`}>{row.value ?? '—'}</span>
                  </>
                );
                const base = 'flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1 text-left';
                const interactive = `${base} cursor-pointer transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus ${active ? 'bg-surface-secondary ring-1 ring-accent/40' : ''}`;
                return (
                  <li key={row.label}>
                    {actionable && row.href ? (
                      <Link href={row.href} className={interactive}>{content}</Link>
                    ) : actionable ? (
                      <button type="button" aria-pressed={active} onClick={() => setReason(active ? null : row.reason)} className={interactive}>{content}</button>
                    ) : (
                      <div className={base}>{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="px-2.5 py-1.5 text-[11px] text-text-muted">Counts cover the newest {initialRows.length} contracts. Select one to list them.</p>
          </div>
        </aside>
      </div>

      {/* BOQ Element Progress — always visible; shows the selected project's own stages under the overall totals */}
      <section aria-labelledby="overall-boq-heading" className="shrink-0 space-y-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-sm">
        <div className="grid items-center gap-2 lg:grid-cols-[11rem_minmax(0,1fr)]">
          <div>
            <h2 id="overall-boq-heading" className="text-sm font-semibold text-text-primary">Overall BOQ Element Progress</h2>
            <p className="text-[11px] leading-tight text-text-muted">Elements at each stage now — not added together.{overallNote ? ` ${overallNote}` : ''}</p>
          </div>
          {overallTiles ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {overallTiles.map((t) => <Tile key={t.label} label={t.label} value={t.value} />)}
            </div>
          ) : (
            <p className="text-sm text-text-muted">No BOQ element progress yet. It appears after Technical confirms and generates elements.</p>
          )}
        </div>

        {selected && (
          <div className="grid items-center gap-2 border-t border-border pt-2 lg:grid-cols-[11rem_minmax(0,1fr)]">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-text-primary" title={selected.title}>{selected.title}</h2>
              <p className="truncate text-[11px] text-text-muted">
                {selected.jobOrder ? `Job Order ${selected.jobOrder} · ` : ''}<span className="font-mono">{selected.referenceNumber}</span>
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Link href={`/contracts/${selected.id}/boq-progress`} className={`${BOQ_BUTTON_CLS} !h-7 !px-2.5`} title="Open BOQ progress">
                  <ListChecks className="size-3.5 shrink-0" aria-hidden="true" />
                  View BOQ Progress
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label="Clear selected project"
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            {message ? (
              <p className="text-sm text-text-muted">{message}</p>
            ) : totals ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
                {selectedMetrics(totals).map((m) => <Tile key={m.key} label={m.label} value={m.value} />)}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
