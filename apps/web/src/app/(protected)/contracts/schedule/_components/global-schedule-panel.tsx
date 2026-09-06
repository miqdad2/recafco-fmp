'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, FileSearch, ArrowUpRight, FolderKanban } from 'lucide-react';
import type { ContractScheduleOverviewRow, ContractScheduleOverviewStatus } from '@/lib/contracts-api';
import { GlobalScheduleStatusBadge } from './global-schedule-status-badge';
import {
  TEAM_FILTER_OPTIONS,
  formatScheduleOverviewDate,
  formatOverviewDelayDays,
  overviewDelayDaysClassName,
  filterOverviewRows,
  type OverviewFilters,
  type DueFilter,
} from '../_lib/global-schedule-helpers';

interface Props {
  rows: ContractScheduleOverviewRow[];
  today: string;
}

const STATUS_OPTIONS: { value: ContractScheduleOverviewStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'On Track', label: 'On Track' },
  { value: 'Delayed', label: 'Delayed' },
  { value: 'Not Planned', label: 'Not Planned' },
  { value: 'Attention', label: 'Attention' },
  { value: 'Completed', label: 'Completed' },
];

const DUE_OPTIONS: { value: DueFilter | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'DUE_THIS_WEEK', label: 'Due This Week' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'NO_PLANNED_DATE', label: 'No Planned Date' },
];

const inputCls =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const filterLabelCls = 'text-[11px] font-medium text-text-muted uppercase tracking-wide';

const TABLE_COLUMNS = [
  'Contract', 'Client / Project', 'Current Stage', 'Next Milestone', 'Planned Finish',
  'Actual / Forecast Finish', 'Delay', 'Blocking Team', 'Schedule Status', 'Action',
];

/**
 * CM-68B — Global Contract Schedule Overview search/filter row + compact
 * table, one client component. Same bounded, client-side-filtered pattern
 * established for Risk Assessment/Production Status/Claims (fetched in full
 * server-side, capped at 1000 contracts, filtered instantly with no round
 * trip). Export reuses the app-wide server-export-route convention (own CSV
 * builder + /export route re-fetching and re-filtering with the same query
 * params), not a client Blob download, to stay consistent with every other
 * register page's export behavior.
 */
export function GlobalSchedulePanel({ rows, today }: Props): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ContractScheduleOverviewStatus | ''>('');
  const [team, setTeam] = useState<OverviewFilters['team']>('');
  const [due, setDue] = useState<DueFilter | ''>('');

  const filters: OverviewFilters = { search, status, team, due };

  const filteredRows = useMemo(() => filterOverviewRows(rows, filters, today), [rows, filters, today]);

  const hasActiveFilters = Boolean(search || status || team || due);
  const noContractHasAPlannedSchedule = rows.length > 0 && rows.every((r) => r.scheduleStatus === 'Not Planned');

  const exportUrl = useMemo(() => {
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    if (status) q.set('status', status);
    if (team) q.set('team', team);
    if (due) q.set('due', due);
    const qs = q.toString();
    return `/contracts/schedule/export${qs ? `?${qs}` : ''}`;
  }, [search, status, team, due]);

  return (
    <>
      <section className="rounded-lg border border-border bg-surface shadow-sm p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-56">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by contract, project, or client…"
              aria-label="Search by contract, project, or client"
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as ContractScheduleOverviewStatus | '')} aria-label="Schedule Status" className={`${inputCls} w-auto min-w-32`}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Team</span>
            <select value={team} onChange={(e) => setTeam(e.target.value as OverviewFilters['team'])} aria-label="Blocking Team" className={`${inputCls} w-auto min-w-36`}>
              <option value="">All teams</option>
              {TEAM_FILTER_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Due</span>
            <select value={due} onChange={(e) => setDue(e.target.value as DueFilter | '')} aria-label="Due" className={`${inputCls} w-auto min-w-36`}>
              {DUE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <a
              href={exportUrl}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
              title="Export the current filtered schedule overview as CSV (opens in Excel)"
            >
              <Download className="size-3.5 shrink-0" aria-hidden="true" />
              Export Excel
            </a>
          </div>
        </div>
      </section>

      <section>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-secondary/40 py-12 text-center">
            <FileSearch className="size-6 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium text-text-secondary mt-1">No active contracts found.</p>
          </div>
        ) : noContractHasAPlannedSchedule && !hasActiveFilters ? (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-secondary/40 py-12 text-center px-6">
            <FolderKanban className="size-6 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm font-semibold text-text-primary mt-1">No contract schedules created yet</p>
            <p className="text-xs text-text-secondary max-w-md">
              Create a planned schedule inside each contract. Once planned dates are added, this page will show on-track, delayed, due-this-week, and completed schedule status across all contracts.
            </p>
            <p className="text-xs text-text-muted">Open a contract, go to Schedule, then create the planned timeline.</p>
            <Link
              href="/contracts"
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Open Contract List
            </Link>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex items-center justify-center gap-2.5 rounded-lg border border-dashed border-border bg-surface-secondary/40 py-6">
            <FileSearch className="size-4 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm text-text-secondary">No contracts match the current search/filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm max-h-[70vh] overflow-y-auto">
            <table className="w-full min-w-300 divide-y divide-border text-xs">
              <thead className="border-b-2 border-border-strong sticky top-0 z-10">
                <tr className="bg-surface-secondary">
                  {TABLE_COLUMNS.map((col) => (
                    <th key={col} className="px-3 py-2.5 text-left font-bold uppercase tracking-wide text-text-primary whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {filteredRows.map((row) => (
                  <tr key={row.contractId} className="hover:bg-surface-secondary/50 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-text-primary">
                      {row.contractNumber}
                      {row.jobOrderNumber && <span className="block text-[11px] text-text-muted font-normal">{row.jobOrderNumber}</span>}
                    </td>
                    <td className="px-3 py-2 max-w-64">
                      <span className="block truncate" title={row.projectName}>{row.projectName}</span>
                      <span className="block truncate text-[11px] text-text-muted" title={row.clientName}>{row.clientName}</span>
                    </td>
                    <td className="px-3 py-2 max-w-40 truncate" title={row.currentStage}>{row.currentStage}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="block truncate max-w-36" title={row.nextMilestone}>{row.nextMilestone}</span>
                      {row.nextMilestoneDate && <span className="block text-[11px] text-text-muted">{formatScheduleOverviewDate(row.nextMilestoneDate)}</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatScheduleOverviewDate(row.plannedFinishDate)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatScheduleOverviewDate(row.actualOrForecastFinishDate)}</td>
                    <td className={`px-3 py-2 whitespace-nowrap font-medium ${overviewDelayDaysClassName(row.delayDays)}`}>{formatOverviewDelayDays(row.delayDays)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.blockingTeam}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><GlobalScheduleStatusBadge status={row.scheduleStatus} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Link
                        href={row.actionUrl}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-text-secondary hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus"
                      >
                        Open Schedule
                        <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
