import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import type { StaffTaskRow } from '@/lib/contracts-api';
import { StaffTaskStatusBadge, StaffTaskPriorityBadge } from './staff-task-badges';

interface Props {
  task: StaffTaskRow | undefined;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'No due date';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * CM-47/CM-48 — "Today's Work / Next Task" focus panel at the top-left of
 * the Contract Staff Dashboard's single-window layout. `task` is picked by
 * pickNextTask() in staff-dashboard-focus.ts (pure, unit-tested) from the
 * same, already-real assignedTasks list the summary cards and task list
 * below use — never a separately fetched or fabricated "urgent task"
 * concept. CM-48 shrank this from a taller banner to a compact card
 * (tighter padding, smaller title) so it doesn't dominate the left
 * column's height budget above My Assigned Tasks.
 */
export function StaffTodaysWorkPanel({ task }: Props): React.JSX.Element {
  if (!task) {
    return (
      <div className="rounded-lg border border-success/30 bg-success-light/40 px-4 py-3 text-center shrink-0">
        <CheckCircle2 className="size-5 mx-auto text-success mb-1" aria-hidden="true" />
        <p className="text-sm font-medium text-text-primary">No assigned work pending.</p>
        <p className="text-xs text-text-secondary mt-0.5">You are clear for now.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-3 shrink-0 ${task.isOverdue ? 'border-danger/40 bg-danger-light/30' : 'border-border bg-surface'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
        {task.isOverdue ? 'Overdue — Today\'s Work' : "Today's Work"}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text-primary">{task.taskName}</h2>
          <p className="text-xs text-text-secondary mt-0.5 truncate">
            <span className="font-mono">{task.contractReference}</span> · {task.contractTitle} · {task.counterpartyName}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <StaffTaskStatusBadge status={task.status} />
            <StaffTaskPriorityBadge priority={task.priority} />
            <span className={`text-xs font-medium ${task.isOverdue ? 'text-danger' : 'text-text-secondary'}`}>
              Due {formatDate(task.dueDate)}
            </span>
          </div>
        </div>
        <Link
          href={`/contracts/workflow?mode=my-tasks&taskId=${task.id}`}
          className="shrink-0 inline-flex items-center rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Update Task
        </Link>
      </div>
    </div>
  );
}
