'use client';

import { useState } from 'react';
import type { FactoryTask, TaskPriority, TaskStatus, UserRef } from '@/lib/factory-tasks-api';
import { isTaskRowOverdue, getAssignedByLabel, computeTaskViewActions } from '../_lib/task-control-center-helpers';
import { TaskStatusBadge } from './task-status-badge';
import { TaskPriorityBadge } from './task-priority-badge';
import { TaskViewModal } from './task-view-modal';

interface Props {
  tasks: FactoryTask[];
  currentUserId: string;
  permissions: string[];
  /** Assignable people for the popup's Assign form (empty when the viewer cannot assign). */
  people: UserRef[];
  emptyMessage: string;
}

const SECONDARY_BUTTON_CLASS = 'inline-flex items-center justify-center rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-1';
const PRIMARY_BUTTON_CLASS = 'inline-flex items-center justify-center rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-1';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * FMP-TASK-03 — the shared task row list used by the Task Management
 * dashboard AND the Task List page. "View" opens the Task Details popup
 * (`TaskViewModal`); the full detail page stays one click away from there.
 * "Assign" shows only when the task is unassigned/open and the viewer holds
 * tasks.assign, and opens the same popup with its assign form showing.
 */
export function TaskControlCenterList({ tasks, currentUserId, permissions, people, emptyMessage }: Props): React.JSX.Element {
  const [selected, setSelected] = useState<{ task: FactoryTask; panel: 'assign' | null } | null>(null);

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface px-4 py-5 text-center">
        <p className="text-base text-text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {tasks.map((task) => {
          const overdue = isTaskRowOverdue(task.dueAt, task.status);
          const canAssign = computeTaskViewActions(task, currentUserId, permissions).assign && !task.assignedToUserId;
          return (
            <li
              key={task.id}
              className="grid gap-x-6 gap-y-2 px-4 py-3 transition-colors hover:bg-surface-secondary/60 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.6fr)] lg:items-center"
            >
              <div className="min-w-0">
                <p className="font-mono text-xs text-accent">{task.referenceNumber}</p>
                <button type="button" onClick={() => setSelected({ task, panel: null })} className="block max-w-full truncate text-left text-base font-semibold text-text-primary hover:text-accent focus:outline-none focus:underline">
                  {task.title}
                </button>
                {task.description && <p className="truncate text-sm text-text-muted" title={task.description}>{task.description}</p>}
              </div>

              <div className="min-w-0 space-y-0.5 text-[15px] text-text-secondary">
                <p className="truncate"><span className="text-text-muted">From: </span><span className="font-medium text-text-primary">{getAssignedByLabel(task)}</span></p>
                <p className="truncate"><span className="text-text-muted">To: </span>{task.assignedToUser?.displayName ?? <span className="text-text-muted">Not assigned</span>}</p>
                <p className="truncate text-sm text-text-muted">Department: {task.responsibleDepartment?.name ?? 'Not set'}</p>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:justify-end">
                <TaskPriorityBadge priority={task.priority as TaskPriority} />
                <TaskStatusBadge status={task.status as TaskStatus} />
                <span className={`text-sm ${overdue ? 'font-medium text-error' : 'text-text-secondary'}`}>
                  {task.dueAt ? `Due ${formatDate(task.dueAt)}${overdue ? ' (overdue)' : ''}` : 'No due date'}
                </span>
                <div className="flex items-center gap-2">
                  <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setSelected({ task, panel: null })}>View</button>
                  {canAssign && (
                    <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setSelected({ task, panel: 'assign' })}>Assign</button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {selected && (
        <TaskViewModal
          key={selected.task.id}
          task={selected.task}
          currentUserId={currentUserId}
          permissions={permissions}
          people={people}
          initialPanel={selected.panel}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
