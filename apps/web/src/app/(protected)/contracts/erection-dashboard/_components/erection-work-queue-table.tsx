'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ArrowUpRight } from 'lucide-react';
import type { ErectionWorkQueueRow } from '@/lib/contracts-api';
import { inputCls } from '../../_components/contract-form-fields';
import { ContractLifecycleBadge } from '../../_components/contract-lifecycle-badge';
import {
  ERECTION_METHOD_STATEMENT_FILTER_OPTIONS,
  ERECTION_ATTENTION_FILTER_OPTIONS,
  DEFAULT_ERECTION_WORK_QUEUE_FILTERS,
  matchesErectionWorkQueueFilters,
  type ErectionWorkQueueFilters,
} from '../../_lib/contract-erection-dashboard-helpers';
import { ErectionMethodStatementStatusBadge } from './erection-method-statement-status-badge';
import { ErectionScheduleStatusBadge } from './erection-schedule-status-badge';
import { ErectionDeliveryStartStatusBadge } from './erection-delivery-start-status-badge';
import { ErectionStartStatusBadge } from './erection-start-status-badge';
import { ErectionChecklistStatusBadge } from './erection-checklist-status-badge';
import { ErectionAttentionBadge } from './erection-attention-badge';
import { ErectionEmptyState } from './erection-empty-state';

interface Props {
  rows: ErectionWorkQueueRow[];
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * CM-71B — searchable/filterable work queue, client-side (the same "fetch
 * once server-side, filter in memory" pattern already used by this unit's
 * dashboard as a whole — the row count is bounded by DASHBOARD_CONTRACT_CAP,
 * the same cap the existing Contract Manager Dashboard already relies on).
 * Action button label/target follows this unit's own rule exactly: "View /
 * Continue" when a method statement already exists, "Start Method
 * Statement" when it doesn't — both ever only ever link to the CM-71A
 * screen, never a quick-edit inline (per this unit's "prefer links, avoid
 * dashboard quick-edit" instruction).
 */
export function ErectionWorkQueueTable({ rows }: Props): React.JSX.Element {
  const [filters, setFilters] = useState<ErectionWorkQueueFilters>(DEFAULT_ERECTION_WORK_QUEUE_FILTERS);

  const contractStatusOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) seen.add(r.contractStatus);
    return Array.from(seen).sort();
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => matchesErectionWorkQueueFilters(r, filters)), [rows, filters]);

  if (rows.length === 0) {
    return <ErectionEmptyState />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-muted" aria-hidden="true" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Search contract no, job order, project, client…"
            className={`${inputCls} pl-8`}
          />
        </div>
        <select
          value={filters.methodStatementStatus}
          onChange={(e) => setFilters((f) => ({ ...f, methodStatementStatus: e.target.value as ErectionWorkQueueFilters['methodStatementStatus'] }))}
          className={`${inputCls} w-auto`}
          aria-label="Method Statement Status filter"
        >
          {ERECTION_METHOD_STATEMENT_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.value ? o.label : 'Method Statement Status: All'}</option>
          ))}
        </select>
        <select
          value={filters.attention}
          onChange={(e) => setFilters((f) => ({ ...f, attention: e.target.value as ErectionWorkQueueFilters['attention'] }))}
          className={`${inputCls} w-auto`}
          aria-label="Attention filter"
        >
          {ERECTION_ATTENTION_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.value ? o.label : 'Attention: All'}</option>
          ))}
        </select>
        <select
          value={filters.contractStatus}
          onChange={(e) => setFilters((f) => ({ ...f, contractStatus: e.target.value }))}
          className={`${inputCls} w-auto`}
          aria-label="Contract Status filter"
        >
          <option value="">Contract Status: All</option>
          {contractStatusOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-secondary">No contracts match the current filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[2550px] divide-y divide-border text-xs">
            <thead className="border-b-2 border-border-strong">
              <tr className="bg-surface-secondary">
                {[
                  'Contract No.', 'Job Order No.', 'Project Name', 'Client', 'Contract Status', 'Method Statement Status',
                  'Planned Issue Date', 'Schedule Status', 'Planned Erection Start', 'Planned Erection End',
                  'Delivery Status', 'Delivery Window Start', 'Delivery Window End',
                  'Erection Start Status', 'Actual Start Date / Time', 'Checklist Status',
                  'Work Location / Yard', 'Responsible Department / Team', 'Assigned Erection Manager', 'Current Erection Step',
                  'Priority / Attention', 'Last Updated', 'Action',
                ].map((col) => (
                  <th key={col} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {filtered.map((r) => (
                <tr key={r.contractId}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link href={`/contracts/${r.contractId}`} className="font-mono text-accent hover:underline">{r.contractReference}</Link>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.jobOrderNo ?? '—'}</td>
                  <td className="px-3 py-2 max-w-50 truncate" title={r.projectName}>{r.projectName}</td>
                  <td className="px-3 py-2 max-w-40 truncate" title={r.client}>{r.client}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><ContractLifecycleBadge status={r.lifecycleStatus} /></td>
                  <td className="px-3 py-2 whitespace-nowrap"><ErectionMethodStatementStatusBadge status={r.methodStatementStatus} /></td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.plannedIssueDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><ErectionScheduleStatusBadge status={r.scheduleStatus} /></td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.scheduleStartDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.scheduleEndDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><ErectionDeliveryStartStatusBadge status={r.deliveryStartStatus} /></td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.deliveryWindowStart)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.deliveryWindowEnd)}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><ErectionStartStatusBadge status={r.erectionStartStatus} /></td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(r.actualStartDateTime)}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><ErectionChecklistStatusBadge status={r.checklistStatus} /></td>
                  <td className="px-3 py-2 max-w-40 truncate" title={r.workLocationYard ?? undefined}>{r.workLocationYard ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.responsibleTeam}</td>
                  {/* assignedToName is already the best available display name — real display name from the picked user when set, else the manual free-text fallback (see the dashboard service's own field mapping). */}
                  <td className="px-3 py-2 max-w-48">
                    <div className="truncate" title={r.assignedToName ?? undefined}>
                      {r.assignedToName ?? <span className="text-text-muted">Unassigned</span>}
                    </div>
                    {/* CM-71H.4 — a real task-level assignment exists but no formal ContractErectionWorkflowAssignment row yet: a gentle nudge, never a block (the contract already shows up correctly for whoever it's assigned to). */}
                    {r.assignmentSource === 'TASK_ASSIGNMENT_ONLY' && (
                      <Link
                        href={`/contracts/${r.contractId}/workflow`}
                        className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-warning hover:underline"
                        title="Assigned via individual tasks only — formalize with Assign Erection Workflow"
                      >
                        Assign whole workflow
                        <ArrowUpRight className="size-2.5 shrink-0" aria-hidden="true" />
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-45 truncate" title={r.currentErectionStep}>{r.currentErectionStep}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><ErectionAttentionBadge attention={r.attention} /></td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.lastUpdated)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.viewerActionMode === 'READ_ONLY' ? (
                      <span className="text-text-muted">Read Only</span>
                    ) : (
                      <Link
                        href={r.nextAction.href}
                        className="inline-flex items-center gap-1 text-accent hover:underline font-medium"
                      >
                        {r.viewerActionMode === 'MONITOR' ? 'View Status' : r.nextAction.label}
                        <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
