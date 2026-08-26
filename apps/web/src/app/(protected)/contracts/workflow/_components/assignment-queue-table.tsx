'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ContractPerson, WorkflowAssignmentQueueItem } from '@/lib/contracts-api';
import { WorkflowTaskStatusBadge } from './workflow-task-status-badge';
import { WorkflowTaskPriorityBadge } from './workflow-task-priority-badge';
import { AssignTaskModal } from './assign-task-modal';

interface Props {
  items: WorkflowAssignmentQueueItem[];
  people: ContractPerson[];
  truncated: boolean;
}

const TEAM_LABELS: Record<string, string> = {
  TECHNICAL: 'Technical',
  PRODUCTION: 'Production',
  ERECTION: 'Erection',
  QS_COMMERCIAL: 'QS / Commercial',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const COLUMNS = [
  'Contract ID', 'Contract Name', 'Company / Client', 'Team', 'Task Name',
  'Current Status', 'Responsible', 'Due Date', 'Priority', 'Action',
];

/**
 * CM-40 — the Assignment Queue's core list. `items` arrive already scoped
 * (department access + contract/task filters applied server-side) and
 * already excludes anything with a responsibleUserId. Assigning a task opens
 * AssignTaskModal, which calls router.refresh() on success — the parent
 * server component then re-fetches, so an assigned task naturally drops out
 * of this list and the summary cards above update, with no local state
 * bookkeeping needed here beyond which modal is open.
 */
export function AssignmentQueueTable({ items, people, truncated }: Props): React.JSX.Element {
  const [openItem, setOpenItem] = useState<WorkflowAssignmentQueueItem | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-secondary">No unassigned tasks in your scope.</p>
        <p className="text-xs text-text-muted mt-1">
          Every workflow task in your department scope currently has a responsible person assigned.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] divide-y divide-border text-xs">
            <thead className="border-b-2 border-border-strong">
              <tr className="bg-surface-secondary">
                {COLUMNS.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {items.map((item) => (
                <tr key={item.taskId}>
                  <td className="px-3 py-1.5 whitespace-nowrap align-top">
                    <Link href={`/contracts/workflow?contractId=${item.contractId}`} className="font-mono text-accent hover:underline">
                      {item.contractReference}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 max-w-[180px] truncate align-top" title={item.contractTitle}>{item.contractTitle}</td>
                  <td className="px-3 py-1.5 max-w-[150px] truncate align-top" title={item.counterpartyName}>{item.counterpartyName}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap align-top">{TEAM_LABELS[item.team] ?? item.team}</td>
                  <td className="px-3 py-1.5 max-w-[200px] truncate align-top" title={item.taskName}>{item.taskName}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap align-top"><WorkflowTaskStatusBadge status={item.status} /></td>
                  <td className="px-3 py-1.5 whitespace-nowrap align-top text-text-muted italic">Unassigned</td>
                  <td className="px-3 py-1.5 whitespace-nowrap align-top">{formatDate(item.dueDate)}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap align-top"><WorkflowTaskPriorityBadge priority={item.priority} /></td>
                  <td className="px-3 py-1.5 whitespace-nowrap align-top">
                    <button
                      type="button"
                      onClick={() => setOpenItem(item)}
                      className="inline-flex items-center rounded-md bg-accent/10 px-2.5 py-1 font-semibold text-accent hover:bg-accent/20"
                    >
                      Assign
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {truncated && (
          <div className="border-t border-border bg-surface-secondary px-3 py-2 text-[11px] text-text-muted">
            Showing the first {items.length} unassigned tasks. Narrow the filters above to see more specific results.
          </div>
        )}
      </div>

      {openItem && (
        <AssignTaskModal
          item={openItem}
          people={people}
          onClose={() => setOpenItem(null)}
          onAssigned={() => setOpenItem(null)}
        />
      )}
    </>
  );
}
