import Link from 'next/link';
import { CheckCircle2, Clock, Lock } from 'lucide-react';
import type { StaffTaskRow } from '@/lib/contracts-api';
import { getGuidedErectionWorkflowRoute, getGuidedErectionTaskDisplayName, getGuidedErectionWaitingLabel } from '../../_lib/guided-erection-workflow-route';
import { StaffTaskStatusBadge, StaffTaskPriorityBadge } from './staff-task-badges';

interface Props {
  task: StaffTaskRow | undefined;
  /** CM-71H.5 — true when the actor has real open work, but all of it is a locked future guided erection step (see hasOnlyLockedOpenTasks) — a distinct empty state from "no work assigned at all." */
  hasOnlyLockedWork?: boolean;
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
export function StaffTodaysWorkPanel({ task, hasOnlyLockedWork = false }: Props): React.JSX.Element {
  if (!task) {
    // CM-71H.5 — distinct from "You are clear for now": real open work
    // exists, it just isn't actionable yet (every one of it is a locked
    // future guided erection step) — never silently show the same
    // "nothing pending" message for two different real situations.
    if (hasOnlyLockedWork) {
      return (
        <div className="rounded-lg border border-border bg-surface-secondary/40 px-4 py-3 text-center shrink-0">
          <Lock className="size-5 mx-auto text-text-muted mb-1" aria-hidden="true" />
          <p className="text-sm font-medium text-text-primary">No erection action available right now.</p>
          <p className="text-xs text-text-secondary mt-0.5">Your upcoming erection steps are locked until earlier steps are complete.</p>
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-success/30 bg-success-light/40 px-4 py-3 text-center shrink-0">
        <CheckCircle2 className="size-5 mx-auto text-success mb-1" aria-hidden="true" />
        <p className="text-sm font-medium text-text-primary">No assigned work pending.</p>
        <p className="text-xs text-text-secondary mt-0.5">You are clear for now.</p>
      </div>
    );
  }

  // CM-71H.4/CM-71H.7 — same guided-erection treatment as My Tasks/My
  // Assigned Tasks (one source of truth, see staff-task-table.tsx's own
  // comment). pickNextTask() never selects a not-yet-actionable step, but
  // this stays consistent with the other two surfaces in case that ever
  // changes.
  const guided = getGuidedErectionWorkflowRoute(task, task.contractId);
  const isWaiting = task.guidedStepLocked === true;
  const waitingLabel = isWaiting ? getGuidedErectionWaitingLabel(task) : null;
  const href = guided?.href ?? `/contracts/workflow?mode=my-tasks&taskId=${task.id}`;
  const displayName = getGuidedErectionTaskDisplayName(task);
  const buttonLabel = isWaiting ? 'View Status' : guided ? (task.status === 'NOT_STARTED' ? 'Open Workflow' : 'Continue Workflow') : 'Update Task';

  return (
    <div className={`rounded-lg border p-3 shrink-0 ${task.isOverdue ? 'border-error/40 bg-error-light/30' : 'border-border bg-surface'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
        {task.isOverdue ? 'Overdue — Today\'s Work' : "Today's Work"}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text-primary">{displayName}</h2>
          <p className="text-xs text-text-secondary mt-0.5 truncate">
            <span className="font-mono">{task.contractReference}</span> · {task.contractTitle} · {task.counterpartyName}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <StaffTaskStatusBadge status={task.status} />
            <StaffTaskPriorityBadge priority={task.priority} />
            <span className={`text-xs font-medium ${task.isOverdue ? 'text-error' : 'text-text-secondary'}`}>
              Due {formatDate(task.dueDate)}
            </span>
            {waitingLabel && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-surface-secondary px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                <Clock className="size-2.5 shrink-0" aria-hidden="true" />
                {waitingLabel}
              </span>
            )}
          </div>
        </div>
        <Link
          href={href}
          className="shrink-0 inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
        >
          {buttonLabel}
        </Link>
      </div>
    </div>
  );
}
