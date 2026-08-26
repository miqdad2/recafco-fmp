import Link from 'next/link';
import type { StaffTaskRow } from '@/lib/contracts-api';
import { StaffTaskStatusBadge, StaffTaskPriorityBadge } from './staff-task-badges';

interface Props {
  tasks: StaffTaskRow[];
  /** Today's date as YYYY-MM-DD, for the "due today" highlight — passed in from page.tsx so this stays a pure render of already-known state. */
  todayIso: string;
  /** CM-48 — caps visible rows for the single-window dashboard layout; a "View My Tasks" link replaces the rest. Omit (or leave undefined) to show every task, unchanged from CM-47 — no other caller passes this. */
  limit?: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'No due date';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const HIGH_PRIORITIES = ['HIGH', 'CRITICAL'];

/**
 * CM-47/CM-48 — task-first card list for the Staff Dashboard's "My Assigned
 * Tasks" section. Same StaffTaskRow data as before — Contract ID (via
 * counterpartyName, CM-47's own dashboard-service addition) is shown
 * alongside the existing contract reference/title — row-per-task cards
 * with overdue/due-today/high-priority highlighted, and Update Task as the
 * one clear action per row. CM-48 added an optional `limit` so the
 * dashboard's single-window layout can cap visible rows (the full,
 * unlimited list still renders on /contracts/workflow?mode=my-tasks).
 */
export function StaffTaskTable({ tasks, todayIso, limit }: Props): React.JSX.Element {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center">
        <p className="text-sm text-text-secondary">No assigned tasks.</p>
        <p className="text-xs text-text-muted mt-1">
          When a manager assigns you a workflow task, it will appear here with its due date and priority.
        </p>
      </div>
    );
  }

  const visibleTasks = limit !== undefined ? tasks.slice(0, limit) : tasks;
  const remaining = tasks.length - visibleTasks.length;

  return (
    <div className="space-y-2">
      {visibleTasks.map((t) => {
        const isDueToday = t.dueDate === todayIso && t.status !== 'COMPLETED';
        const isHighPriority = HIGH_PRIORITIES.includes(t.priority);
        const highlighted = t.isOverdue || isDueToday;
        return (
          <div
            key={t.id}
            className={[
              'flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5',
              t.isOverdue ? 'border-danger/40 bg-danger-light/20' : isDueToday ? 'border-warning/40 bg-warning-light/20' : 'border-border bg-surface',
            ].join(' ')}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary truncate" title={t.taskName}>{t.taskName}</p>
              <p className="text-xs text-text-muted mt-0.5 truncate">
                <span className="font-mono">{t.contractReference}</span> · {t.contractTitle} · {t.counterpartyName}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">{t.team.replace(/_/g, ' ')}</p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <StaffTaskStatusBadge status={t.status} />
              <StaffTaskPriorityBadge priority={t.priority} />
              {highlighted && (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${t.isOverdue ? 'bg-danger text-white' : 'bg-warning text-white'}`}>
                  {t.isOverdue ? 'Overdue' : 'Due Today'}
                </span>
              )}
              <span className={`text-xs whitespace-nowrap ${t.isOverdue ? 'text-danger font-medium' : isHighPriority ? 'text-warning font-medium' : 'text-text-secondary'}`}>
                {formatDate(t.dueDate)}
              </span>
              <Link
                href={`/contracts/workflow?mode=my-tasks&taskId=${t.id}`}
                className="inline-flex items-center rounded-md bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-focus"
              >
                Update Task
              </Link>
            </div>
          </div>
        );
      })}

      {remaining > 0 && (
        <Link
          href="/contracts/workflow?mode=my-tasks"
          className="block text-center text-xs font-medium text-accent hover:underline py-1"
        >
          View My Tasks — {remaining} more
        </Link>
      )}
    </div>
  );
}
