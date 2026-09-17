'use client';

import Link from 'next/link';
import { Paperclip, MessageSquare, AlertTriangle, HardHat, ArrowUpRight } from 'lucide-react';
import type { ContractWorkflowTask } from '@/lib/contracts-api';
import { getGuidedErectionWorkflowRoute, getGuidedErectionTaskDisplayName } from '../../_lib/guided-erection-workflow-route';
import { WorkflowTaskStatusBadge } from './workflow-task-status-badge';
import { WorkflowTaskPriorityBadge } from './workflow-task-priority-badge';

interface Props {
  task: ContractWorkflowTask;
  onOpen: (task: ContractWorkflowTask) => void;
}

const SUBMITTED_LIKE_STATUSES = ['SUBMITTED', 'UNDER_REVIEW'];

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatRelativeActivity(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

/**
 * CM-53 — a single subtle left-border accent communicates the card's state
 * at a glance without turning the board into a wall of color ("keep it
 * simple and not too colorful" per the spec). Priority order (most urgent
 * wins when more than one applies): overdue (backend-computed `isOverdue`,
 * never re-derived) > rejected/on hold > completed/approved > submitted/
 * under review > unassigned > everything else (not started/in progress,
 * assigned, on schedule).
 */
function cardAccentCls(task: ContractWorkflowTask): string {
  if (task.isOverdue) return 'border-l-4 border-l-danger';
  if (task.status === 'REJECTED' || task.status === 'ON_HOLD') return 'border-l-4 border-l-warning';
  if (task.status === 'COMPLETED' || task.status === 'APPROVED') return 'border-l-4 border-l-success';
  if (SUBMITTED_LIKE_STATUSES.includes(task.status)) return 'border-l-4 border-l-info';
  if (!task.responsibleUserId) return 'border-l-4 border-l-text-muted';
  return 'border-l-4 border-l-transparent';
}

/**
 * CM-53 — best-available real submitted/completed timestamp, never invented.
 * `completedDate` is a stored field, used verbatim for COMPLETED tasks.
 * Neither this task type nor the schema has a distinct `submittedAt` column,
 * so a SUBMITTED/UNDER_REVIEW task falls back to `lastActivityAt` (the same
 * backend-computed value already used for the "Xh ago" activity line) per
 * the spec's own documented fallback rule — labeled "Submitted", not implying
 * an exact submission instant that isn't actually stored.
 */
function submissionLine(task: ContractWorkflowTask): string | null {
  if (task.status === 'COMPLETED' && task.completedDate) {
    return `Completed: ${formatDate(task.completedDate)}`;
  }
  if (SUBMITTED_LIKE_STATUSES.includes(task.status)) {
    return `Submitted: ${formatDateTime(task.lastActivityAt)}`;
  }
  return null;
}

/**
 * CM-71H.2 — a task with a dedicated CM-71A-G guided screen (detected via
 * getGuidedErectionWorkflowRoute, keyed off the stable taskKey) opens that
 * screen directly (a real navigation `<Link>`) instead of the generic
 * WorkflowTaskDrawer — "Open Workflow"/"Continue Workflow" replaces the
 * plain click-to-open-drawer affordance. Every other task (including
 * Payment Issued, the one ERECTION task with no guided screen yet) is
 * completely unchanged — still a `<button>` that opens the generic drawer
 * via onOpen. Viewing is never blocked here: this only changes WHERE the
 * click navigates, not who can click it — the guided screen's own read/
 * write gating (unchanged by this unit) decides what the viewer can do
 * once there.
 */
export function WorkflowTaskCard({ task, onOpen }: Props): React.JSX.Element {
  const submission = submissionLine(task);
  const guided = getGuidedErectionWorkflowRoute(task, task.contractId);
  const displayName = getGuidedErectionTaskDisplayName(task);

  const cardBodyCls = `block w-full text-left rounded-md border border-border ${cardAccentCls(task)} bg-surface-secondary/40 p-2.5 space-y-1.5 hover:border-accent hover:bg-surface focus:outline-none focus:ring-2 focus:ring-focus`;

  const cardContent = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-text-primary">{displayName}</span>
        {task.isOverdue && (
          <span className="shrink-0 inline-flex items-center gap-0.5 text-error" title="Overdue">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <WorkflowTaskStatusBadge status={task.status} />
        <WorkflowTaskPriorityBadge priority={task.priority} />
        {guided && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            <HardHat className="size-2.5 shrink-0" aria-hidden="true" />
            Guided Workflow · Step {guided.stepNumber}
          </span>
        )}
      </div>

      <p className="text-[11px] text-text-muted">
        {task.responsibleUser?.displayName ?? 'Unassigned'} · {task.dueDate ? `Due ${formatDate(task.dueDate)}` : 'No due date'}
      </p>

      {submission && <p className="text-[11px] text-text-secondary">{submission}</p>}

      <div className="flex items-center justify-between pt-1 border-t border-border/60">
        <div className="flex items-center gap-3 text-[11px] text-text-muted">
          <span className="inline-flex items-center gap-1" title={`${task.attachmentsCount} attachment(s)`}>
            <Paperclip className="size-3" aria-hidden="true" />
            {task.attachmentsCount}
          </span>
          <span className="inline-flex items-center gap-1" title={`${task.commentsCount} comment(s)`}>
            <MessageSquare className="size-3" aria-hidden="true" />
            {task.commentsCount}
          </span>
        </div>
        {guided ? (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-accent">
            {task.status === 'NOT_STARTED' ? 'Open Workflow' : 'Continue Workflow'}
            <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
          </span>
        ) : (
          <span className="text-[10px] text-text-muted">{formatRelativeActivity(task.lastActivityAt)}</span>
        )}
      </div>
    </>
  );

  if (guided) {
    return (
      <Link href={guided.href} className={cardBodyCls}>
        {cardContent}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => onOpen(task)} className={cardBodyCls}>
      {cardContent}
    </button>
  );
}
