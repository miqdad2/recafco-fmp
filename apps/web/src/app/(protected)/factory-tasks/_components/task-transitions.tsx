'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  openTaskAction,
  assignTaskAction,
  unassignTaskAction,
  startTaskAction,
  blockTaskAction,
  unblockTaskAction,
  completeTaskAction,
  closeTaskAction,
  reopenTaskAction,
  cancelTaskAction,
  updatePriorityAction,
} from '../actions';
import type { ActionResult } from '../actions';
import type { FactoryTask, UserRef } from '../../../../lib/factory-tasks-api';

type Panel = 'assign' | 'block' | 'complete' | 'reopen' | 'cancel' | 'priority' | null;

interface Props {
  task: FactoryTask;
  currentUserId: string;
  permissions: string[];
  people: UserRef[];
}

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

function Btn({
  children,
  onClick,
  disabled,
  variant = 'secondary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}): React.JSX.Element {
  const cls: Record<string, string> = {
    primary: 'bg-accent text-white hover:bg-accent/90',
    secondary: 'border border-border bg-surface-secondary text-text-secondary hover:border-border-strong hover:text-text-primary',
    danger: 'border border-danger bg-danger-light text-danger hover:bg-danger hover:text-white',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 disabled:cursor-not-allowed ${cls[variant]}`}
    >
      {children}
    </button>
  );
}

export function TaskTransitionsPanel({ task, currentUserId, permissions, people }: Props): React.JSX.Element {
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [assigneeId, setAssigneeId] = useState('');
  const [blockedReason, setBlockedReason] = useState('');
  const [completionSummary, setCompletionSummary] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [newPriority, setNewPriority] = useState<string>(task.priority);

  const has = (perm: string): boolean => permissions.includes(perm);
  const isAssignee = task.assignedToUserId === currentUserId;
  const isCreator = task.createdByUserId === currentUserId;
  const { status, id } = task;

  function openPanel(p: Panel): void {
    setActivePanel(p);
    setActionError(null);
  }

  function run(fn: () => Promise<ActionResult>): void {
    setActionError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setActionError(result.error);
    });
  }

  const buttons: React.JSX.Element[] = [];

  // DRAFT
  if (status === 'DRAFT') {
    if (isCreator || has('tasks.manage')) {
      buttons.push(
        <Link key="edit" href={`/factory-tasks/${id}/edit`}
          className="block w-full rounded-md border border-border bg-surface-secondary px-4 py-2 text-center text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Edit draft
        </Link>,
      );
      buttons.push(
        <Btn key="open" variant="primary" disabled={isPending} onClick={() => run(() => openTaskAction(id))}>
          Open task
        </Btn>,
      );
      buttons.push(
        <Btn key="cancel" variant="danger" onClick={() => openPanel(activePanel === 'cancel' ? null : 'cancel')}>
          Cancel task
        </Btn>,
      );
    }
  }

  // OPEN
  if (status === 'OPEN') {
    if (has('tasks.assign')) {
      buttons.push(
        <Btn key="assign" variant="primary" onClick={() => openPanel(activePanel === 'assign' ? null : 'assign')}>
          Assign
        </Btn>,
      );
    }
    if (has('tasks.update_own_draft') || has('tasks.manage')) {
      buttons.push(
        <Btn key="priority" variant="secondary" onClick={() => openPanel(activePanel === 'priority' ? null : 'priority')}>
          Change priority
        </Btn>,
      );
    }
    if (isCreator || has('tasks.manage')) {
      buttons.push(
        <Btn key="cancel" variant="danger" onClick={() => openPanel(activePanel === 'cancel' ? null : 'cancel')}>
          Cancel task
        </Btn>,
      );
    }
  }

  // ASSIGNED
  if (status === 'ASSIGNED') {
    if (isAssignee || has('tasks.start')) {
      buttons.push(
        <Btn key="start" variant="primary" disabled={isPending} onClick={() => run(() => startTaskAction(id))}>
          Start work
        </Btn>,
      );
    }
    if (has('tasks.assign')) {
      buttons.push(
        <Btn key="reassign" variant="secondary" onClick={() => openPanel(activePanel === 'assign' ? null : 'assign')}>
          Reassign
        </Btn>,
      );
      buttons.push(
        <Btn key="unassign" variant="secondary" disabled={isPending} onClick={() => run(() => unassignTaskAction(id))}>
          Unassign
        </Btn>,
      );
    }
    if (has('tasks.manage')) {
      buttons.push(
        <Btn key="cancel" variant="danger" onClick={() => openPanel(activePanel === 'cancel' ? null : 'cancel')}>
          Cancel task
        </Btn>,
      );
    }
  }

  // IN_PROGRESS
  if (status === 'IN_PROGRESS') {
    if (isAssignee || has('tasks.complete')) {
      buttons.push(
        <Btn key="complete" variant="primary" onClick={() => openPanel(activePanel === 'complete' ? null : 'complete')}>
          Complete task
        </Btn>,
      );
    }
    if (isAssignee || has('tasks.block')) {
      buttons.push(
        <Btn key="block" variant="secondary" onClick={() => openPanel(activePanel === 'block' ? null : 'block')}>
          Mark blocked
        </Btn>,
      );
    }
    if (has('tasks.assign')) {
      buttons.push(
        <Btn key="reassign" variant="secondary" onClick={() => openPanel(activePanel === 'assign' ? null : 'assign')}>
          Reassign
        </Btn>,
      );
    }
    if (has('tasks.manage')) {
      buttons.push(
        <Btn key="cancel" variant="danger" onClick={() => openPanel(activePanel === 'cancel' ? null : 'cancel')}>
          Cancel task
        </Btn>,
      );
    }
  }

  // BLOCKED
  if (status === 'BLOCKED') {
    if (isAssignee || has('tasks.block')) {
      buttons.push(
        <Btn key="unblock" variant="primary" disabled={isPending} onClick={() => run(() => unblockTaskAction(id))}>
          Unblock
        </Btn>,
      );
    }
    if (has('tasks.assign')) {
      buttons.push(
        <Btn key="reassign" variant="secondary" onClick={() => openPanel(activePanel === 'assign' ? null : 'assign')}>
          Reassign
        </Btn>,
      );
    }
    if (has('tasks.manage')) {
      buttons.push(
        <Btn key="cancel" variant="danger" onClick={() => openPanel(activePanel === 'cancel' ? null : 'cancel')}>
          Cancel task
        </Btn>,
      );
    }
  }

  // COMPLETED
  if (status === 'COMPLETED') {
    if (has('tasks.close')) {
      buttons.push(
        <Btn key="close" variant="primary" disabled={isPending} onClick={() => run(() => closeTaskAction(id))}>
          Close (accept completion)
        </Btn>,
      );
    }
    if (has('tasks.manage')) {
      buttons.push(
        <Btn key="reopen" variant="secondary" onClick={() => openPanel(activePanel === 'reopen' ? null : 'reopen')}>
          Reopen
        </Btn>,
      );
    }
  }

  // CLOSED or CANCELLED
  if (status === 'CLOSED' || status === 'CANCELLED') {
    if (has('tasks.manage')) {
      buttons.push(
        <Btn key="reopen" variant="secondary" onClick={() => openPanel(activePanel === 'reopen' ? null : 'reopen')}>
          Reopen task
        </Btn>,
      );
    }
  }

  if (buttons.length === 0) return <></>;

  return (
    <div className="space-y-3">
      <div className="space-y-2">{buttons}</div>

      {actionError && !activePanel && (
        <p role="alert" className="text-xs text-danger">{actionError}</p>
      )}

      {/* Assign panel */}
      {activePanel === 'assign' && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-medium text-text-primary">
            {status === 'OPEN' ? 'Assign task' : 'Reassign task'}
          </p>
          <div>
            <label htmlFor="assign-user" className="block text-xs font-medium text-text-secondary">
              Assignee
            </label>
            <select
              id="assign-user"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Select a person…</option>
              {people.map((u) => (
                <option key={u.id} value={u.id}>{u.displayName} (@{u.username})</option>
              ))}
            </select>
          </div>
          {actionError && <p role="alert" className="text-xs text-danger">{actionError}</p>}
          <div className="flex gap-2">
            <Btn variant="primary" disabled={isPending || !assigneeId}
              onClick={() => run(() => assignTaskAction(id, assigneeId))}
            >
              {isPending ? 'Assigning…' : 'Assign'}
            </Btn>
            <Btn variant="secondary" onClick={() => { openPanel(null); setAssigneeId(''); }}>
              Back
            </Btn>
          </div>
        </div>
      )}

      {/* Block panel */}
      {activePanel === 'block' && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-medium text-text-primary">Mark task blocked</p>
          <div>
            <label htmlFor="blocked-reason" className="block text-xs font-medium text-text-secondary">
              Reason <span aria-hidden="true" className="text-danger">*</span>
            </label>
            <textarea
              id="blocked-reason"
              rows={3}
              value={blockedReason}
              onChange={(e) => setBlockedReason(e.target.value)}
              maxLength={2000}
              placeholder="What is blocking progress?"
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          {actionError && <p role="alert" className="text-xs text-danger">{actionError}</p>}
          <div className="flex gap-2">
            <Btn variant="danger" disabled={isPending || !blockedReason.trim()}
              onClick={() => run(() => blockTaskAction(id, blockedReason.trim()))}
            >
              {isPending ? 'Saving…' : 'Confirm blocked'}
            </Btn>
            <Btn variant="secondary" onClick={() => { openPanel(null); setBlockedReason(''); }}>
              Back
            </Btn>
          </div>
        </div>
      )}

      {/* Complete panel */}
      {activePanel === 'complete' && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-medium text-text-primary">Complete task</p>
          <div>
            <label htmlFor="completion-summary" className="block text-xs font-medium text-text-secondary">
              Completion summary <span aria-hidden="true" className="text-danger">*</span>
            </label>
            <textarea
              id="completion-summary"
              rows={5}
              value={completionSummary}
              onChange={(e) => setCompletionSummary(e.target.value)}
              maxLength={4000}
              placeholder="Describe what was done and any relevant outcomes"
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          {actionError && <p role="alert" className="text-xs text-danger">{actionError}</p>}
          <div className="flex gap-2">
            <Btn variant="primary" disabled={isPending || completionSummary.trim().length < 1}
              onClick={() => run(() => completeTaskAction(id, completionSummary.trim()))}
            >
              {isPending ? 'Saving…' : 'Mark complete'}
            </Btn>
            <Btn variant="secondary" onClick={() => { openPanel(null); setCompletionSummary(''); }}>
              Back
            </Btn>
          </div>
        </div>
      )}

      {/* Reopen panel */}
      {activePanel === 'reopen' && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-medium text-text-primary">Reopen task</p>
          <div>
            <label htmlFor="reopen-reason" className="block text-xs font-medium text-text-secondary">
              Reason <span aria-hidden="true" className="text-danger">*</span>
            </label>
            <textarea
              id="reopen-reason"
              rows={2}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              maxLength={1000}
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          {actionError && <p role="alert" className="text-xs text-danger">{actionError}</p>}
          <div className="flex gap-2">
            <Btn variant="primary" disabled={isPending || !reopenReason.trim()}
              onClick={() => run(() => reopenTaskAction(id, reopenReason.trim()))}
            >
              {isPending ? 'Reopening…' : 'Confirm reopen'}
            </Btn>
            <Btn variant="secondary" onClick={() => { openPanel(null); setReopenReason(''); }}>
              Back
            </Btn>
          </div>
        </div>
      )}

      {/* Cancel panel */}
      {activePanel === 'cancel' && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-medium text-text-primary">Cancel task</p>
          <div>
            <label htmlFor="cancel-reason" className="block text-xs font-medium text-text-secondary">
              Reason <span aria-hidden="true" className="text-danger">*</span>
            </label>
            <textarea
              id="cancel-reason"
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              maxLength={1000}
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          {actionError && <p role="alert" className="text-xs text-danger">{actionError}</p>}
          <div className="flex gap-2">
            <Btn variant="danger" disabled={isPending || !cancelReason.trim()}
              onClick={() => run(() => cancelTaskAction(id, cancelReason.trim()))}
            >
              {isPending ? 'Cancelling…' : 'Confirm cancel'}
            </Btn>
            <Btn variant="secondary" onClick={() => { openPanel(null); setCancelReason(''); }}>
              Back
            </Btn>
          </div>
        </div>
      )}

      {/* Priority panel */}
      {activePanel === 'priority' && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-medium text-text-primary">Change priority</p>
          <div>
            <label htmlFor="new-priority" className="block text-xs font-medium text-text-secondary">
              Priority
            </label>
            <select
              id="new-priority"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          {actionError && <p role="alert" className="text-xs text-danger">{actionError}</p>}
          <div className="flex gap-2">
            <Btn variant="primary" disabled={isPending || newPriority === task.priority}
              onClick={() => run(() => updatePriorityAction(id, newPriority))}
            >
              {isPending ? 'Saving…' : 'Update priority'}
            </Btn>
            <Btn variant="secondary" onClick={() => { openPanel(null); setNewPriority(task.priority); }}>
              Back
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
