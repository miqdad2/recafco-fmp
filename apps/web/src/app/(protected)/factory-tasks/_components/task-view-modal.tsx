'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FactoryTask, TaskPriority, TaskStatus, UserRef } from '@/lib/factory-tasks-api';
import { assignTaskAction, completeTaskAction, openTaskAction, startTaskAction } from '../actions';
import type { ActionResult } from '../actions';
import { computeTaskViewActions, getAssignedByLabel, isTaskRowOverdue } from '../_lib/task-control-center-helpers';
import { TaskStatusBadge } from './task-status-badge';
import { TaskPriorityBadge } from './task-priority-badge';

interface Props {
  task: FactoryTask;
  currentUserId: string;
  permissions: string[];
  people: UserRef[];
  /** Start with the assign form already showing (the row's own "Assign" button). */
  initialPanel?: 'assign' | null;
  onClose: () => void;
}

const BTN = 'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50';
const PRIMARY = `${BTN} bg-accent text-white hover:bg-accent/90`;
const SECONDARY = `${BTN} border border-border bg-surface text-text-secondary hover:bg-surface-secondary hover:text-text-primary`;
const FIELD = 'mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-base text-text-primary">{children}</dd>
    </div>
  );
}

/**
 * FMP-TASK-03 — the simple "Task Details" popup opened by a row's View
 * button. Actions reuse the existing server actions untouched (they redirect
 * to the full task page on success, exactly as on that page).
 */
export function TaskViewModal({ task, currentUserId, permissions, people, initialPanel = null, onClose }: Props): React.JSX.Element {
  const [panel, setPanel] = useState<'assign' | 'complete' | null>(initialPanel);
  const [assigneeId, setAssigneeId] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const actions = computeTaskViewActions(task, currentUserId, permissions);
  const overdue = isTaskRowOverdue(task.dueAt, task.status);

  function run(fn: () => Promise<ActionResult>): void {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
      else { router.refresh(); onClose(); }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="task-view-title" className="max-h-full w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="task-view-title" className="text-lg font-semibold text-text-primary">Task Details</h2>
            <p className="font-mono text-sm text-accent">{task.referenceNumber}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className={SECONDARY}>Close</button>
        </div>

        <p className="mt-3 text-xl font-semibold text-text-primary">{task.title}</p>
        {task.description && <p className="mt-1 whitespace-pre-wrap text-base text-text-secondary">{task.description}</p>}

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Field label="From">{getAssignedByLabel(task)}</Field>
          <Field label="To">{task.assignedToUser?.displayName ?? <span className="text-text-muted">Not assigned</span>}</Field>
          <Field label="Department">{task.responsibleDepartment?.name ?? <span className="text-text-muted">Not set</span>}</Field>
          <Field label="Priority"><TaskPriorityBadge priority={task.priority as TaskPriority} /></Field>
          <Field label="Status"><TaskStatusBadge status={task.status as TaskStatus} /></Field>
          <Field label="Due">
            {task.dueAt ? <span className={overdue ? 'font-medium text-error' : ''}>{fmt(task.dueAt)}{overdue ? ' (overdue)' : ''}</span> : <span className="text-text-muted">No due date</span>}
          </Field>
          <Field label="Created">{fmt(task.createdAt)}</Field>
          <Field label="Last updated">{fmt(task.updatedAt)}</Field>
        </dl>

        {panel === 'assign' && (
          <div className="mt-4 rounded-lg border border-border p-4">
            <label htmlFor="view-assign-user" className="block text-sm font-medium text-text-secondary">Assign to</label>
            <select id="view-assign-user" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={FIELD}>
              <option value="">Select a person…</option>
              {people.map((u) => <option key={u.id} value={u.id}>{u.displayName} (@{u.username})</option>)}
            </select>
            <div className="mt-3 flex gap-2">
              <button type="button" className={PRIMARY} disabled={isPending || !assigneeId} onClick={() => run(() => assignTaskAction(task.id, assigneeId))}>
                {isPending ? 'Assigning…' : 'Assign Task'}
              </button>
              <button type="button" className={SECONDARY} onClick={() => setPanel(null)}>Back</button>
            </div>
          </div>
        )}

        {panel === 'complete' && (
          <div className="mt-4 rounded-lg border border-border p-4">
            <label htmlFor="view-summary" className="block text-sm font-medium text-text-secondary">What was done? (required)</label>
            <textarea id="view-summary" rows={3} maxLength={4000} value={summary} onChange={(e) => setSummary(e.target.value)} className={FIELD} />
            <div className="mt-3 flex gap-2">
              <button type="button" className={PRIMARY} disabled={isPending || !summary.trim()} onClick={() => run(() => completeTaskAction(task.id, summary.trim()))}>
                {isPending ? 'Saving…' : 'Mark Completed'}
              </button>
              <button type="button" className={SECONDARY} onClick={() => setPanel(null)}>Back</button>
            </div>
          </div>
        )}

        {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {actions.assign && panel !== 'assign' && (
            <button type="button" className={PRIMARY} onClick={() => { setError(null); setPanel('assign'); }}>Assign Task</button>
          )}
          {actions.start && (
            <button type="button" className={PRIMARY} disabled={isPending}
              onClick={() => run(() => (task.status === 'DRAFT' ? openTaskAction(task.id) : startTaskAction(task.id)))}>
              Start Work
            </button>
          )}
          {actions.complete && panel !== 'complete' && (
            <button type="button" className={PRIMARY} onClick={() => { setError(null); setPanel('complete'); }}>Mark Completed</button>
          )}
          <Link href={`/factory-tasks/${task.id}`} className={`${SECONDARY} sm:ml-auto`}>Open Full Page</Link>
        </div>
      </div>
    </div>
  );
}
