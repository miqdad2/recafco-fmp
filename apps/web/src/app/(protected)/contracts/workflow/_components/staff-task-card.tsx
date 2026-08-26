import Link from 'next/link';
import type { StaffFlatTask } from '../../_lib/staff-task-grouping';
import { WorkflowTaskStatusBadge } from './workflow-task-status-badge';
import { WorkflowTaskPriorityBadge } from './workflow-task-priority-badge';

interface Props {
  task: StaffFlatTask;
  updateHref: string;
}

const TEAM_LABELS: Record<string, string> = {
  TECHNICAL: 'Technical',
  PRODUCTION: 'Production',
  ERECTION: 'Erection',
  QS_COMMERCIAL: 'QS / Commercial',
};

function formatDate(iso: string | undefined): string {
  if (!iso) return 'No due date';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** CM-45 — whole days between dueDate and today, for the "N days overdue" row text. Never negative (only called when isOverdue is already true). */
function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - due.getTime()) / 86_400_000));
}

/**
 * CM-44/CM-48C — one row in the Staff My Tasks list. Read-only context + a
 * single "Update Task" action — no manager fields, no reassignment.
 *
 * CM-48C — the whole card opens the focused task screen on click, not just
 * the Update Task button, via the "stretched link" technique: the task
 * name is a real `<Link>` whose `::after` pseudo-element is absolutely
 * positioned to cover the entire (`relative`) card, so clicking anywhere
 * on the card activates that link. The Update Task button stays a
 * separate, sibling `<Link>` — never nested inside the stretched one,
 * which would be invalid HTML — raised above the overlay with `relative
 * z-10` so it stays independently clickable. Both links point at the same
 * `updateHref` and are native anchors, so there is no click-handler/JS
 * involved and no risk of double navigation: clicking the button
 * navigates via the button's own href once, exactly like clicking
 * anywhere else on the card navigates via the stretched link once.
 */
export function StaffTaskCard({ task, updateHref }: Props): React.JSX.Element {
  return (
    <div className="group relative flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-3 transition-colors hover:border-accent/50 hover:bg-surface-secondary/50 focus-within:ring-2 focus-within:ring-focus">
      <div className="min-w-0 flex-1">
        <Link
          href={updateHref}
          className="text-sm font-medium text-text-primary truncate block after:content-[''] after:absolute after:inset-0 after:rounded-md focus:outline-none"
          title={task.taskName}
        >
          {task.taskName}
        </Link>
        <p className="text-xs text-text-muted mt-0.5">
          <span className="font-mono">{task.contractReference}</span> · {task.contractTitle} · {task.counterpartyName}
        </p>
        <p className="text-[11px] text-text-muted mt-0.5">{TEAM_LABELS[task.team] ?? task.team}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <WorkflowTaskStatusBadge status={task.status} />
        <WorkflowTaskPriorityBadge priority={task.priority} />
        <span className={`text-xs whitespace-nowrap ${task.isOverdue ? 'text-danger font-medium' : 'text-text-secondary'}`}>
          {task.isOverdue && task.dueDate
            ? `${formatDate(task.dueDate)} · ${daysOverdue(task.dueDate)} day${daysOverdue(task.dueDate) === 1 ? '' : 's'} overdue`
            : formatDate(task.dueDate)}
        </span>
        <Link
          href={updateHref}
          className="relative z-10 inline-flex items-center rounded-md bg-accent/10 px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Update Task
        </Link>
      </div>
    </div>
  );
}
