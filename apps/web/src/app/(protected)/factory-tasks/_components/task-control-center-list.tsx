import Link from 'next/link';
import type { FactoryTask, TaskPriority, TaskStatus } from '@/lib/factory-tasks-api';
import { isTaskRowOverdue, computeTaskNextActionText, computeTaskQuickAction } from '../_lib/task-control-center-helpers';
import { closeTaskAction } from '../actions';
import { TaskStatusBadge } from './task-status-badge';
import { TaskPriorityBadge } from './task-priority-badge';

interface Props {
  tasks: FactoryTask[];
  currentUserId: string;
  permissions: string[];
  emptyMessage: string;
}

const SECONDARY_BUTTON_CLASS = 'inline-flex items-center justify-center rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-1';
const PRIMARY_BUTTON_CLASS = 'inline-flex items-center justify-center rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-1';

/**
 * A `<form action={...}>` target must itself be a recognized Server
 * Action reference — a plain wrapper calling `closeTaskAction` from this
 * (non-`'use server'`) file needs its own function-level `'use server'`
 * directive to qualify. `closeTaskAction`'s own `Promise<ActionResult>`
 * return isn't assignable to a form action's `void | Promise<void>`, so
 * this just discards it — on success `closeTaskAction` already calls
 * `redirect()` internally (which throws and propagates through the
 * `await` untouched); on failure the row simply stays as-is, same as any
 * other quick action's rare-failure behavior.
 */
async function closeTaskQuickAction(taskId: string): Promise<void> {
  'use server';
  await closeTaskAction(taskId);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * FMP-UI-20 — the Task Control Center's own compact preview table, shared by
 * all 5 tabs (My Tasks / Assigned by Me / All Tasks / Overdue / Completed).
 *
 * FMP-UI-20E — restructured per direct feedback that the row didn't clearly
 * separate assignment, status, and next action, and that "Assign task"
 * hidden as small text under "Open" could be missed:
 *   - Columns are now Task / Assignment / Department / Priority / Due Date /
 *     Status / Next Action / Actions (dropped "Created By" — not in the
 *     brief's own recommended column list, and the task detail page's own
 *     Assignment Details panel already covers it).
 *   - "Unassigned" → "Not assigned" (friendlier wording).
 *   - "Next Action" is now its OWN column of plain text
 *     (`computeTaskNextActionText`), separate from the Actions column's
 *     real buttons — no more conflating "what's next" with "what button do
 *     I click."
 *   - Actions now shows "Open Task" (secondary) plus, when applicable, ONE
 *     clearly visible PRIMARY button for the specific next action
 *     (`computeTaskQuickAction`) — Assign/Complete link to the task's own
 *     detail page (assigning needs a person picker, completing needs a
 *     summary — neither is a genuine single click); Close needs no extra
 *     input, so it's a REAL one-click `<form>` posting straight to the
 *     existing `closeTaskAction` — never a fake button that does nothing.
 */
export function TaskControlCenterList({ tasks, currentUserId, permissions, emptyMessage }: Props): React.JSX.Element {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface py-10 text-center">
        <p className="text-sm text-text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-245 border-collapse text-sm">
        <thead className="bg-surface-secondary">
          <tr>
            {['Task', 'Assignment', 'Department', 'Priority', 'Due Date', 'Status', 'Next Action', 'Actions'].map((col) => (
              <th key={col} className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {tasks.map((task) => {
            const overdue = isTaskRowOverdue(task.dueAt, task.status);
            const nextActionText = computeTaskNextActionText(task, currentUserId, permissions);
            const quickAction = computeTaskQuickAction(task, currentUserId, permissions);
            return (
              <tr key={task.id} className="hover:bg-surface-secondary/50 transition-colors">
                <td className="px-4 py-3 max-w-64">
                  <Link href={`/factory-tasks/${task.id}`} className="block font-mono text-xs text-accent hover:underline focus:outline-none focus:underline">
                    {task.referenceNumber}
                  </Link>
                  <Link href={`/factory-tasks/${task.id}`} className="font-medium text-text-primary hover:text-accent line-clamp-1 focus:outline-none focus:underline">
                    {task.title}
                  </Link>
                  {task.description && (
                    <p className="text-xs text-text-muted line-clamp-1" title={task.description}>{task.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                  {task.assignedToUser?.displayName ?? <span className="text-text-muted">Not assigned</span>}
                </td>
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                  {task.responsibleDepartment?.name ?? <span className="text-text-muted">—</span>}
                </td>
                <td className="px-4 py-3">
                  <TaskPriorityBadge priority={task.priority as TaskPriority} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {task.dueAt ? (
                    <span className={overdue ? 'font-medium text-danger' : 'text-text-secondary'}>
                      {formatDate(task.dueAt)}
                      {overdue && <span className="ml-1 text-xs">(overdue)</span>}
                    </span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <TaskStatusBadge status={task.status as TaskStatus} />
                </td>
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{nextActionText}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Link href={`/factory-tasks/${task.id}`} className={SECONDARY_BUTTON_CLASS}>
                      Open Task
                    </Link>
                    {quickAction?.type === 'close' ? (
                      <form action={closeTaskQuickAction.bind(null, task.id)}>
                        <button type="submit" className={PRIMARY_BUTTON_CLASS}>
                          {quickAction.label}
                        </button>
                      </form>
                    ) : quickAction ? (
                      <Link href={`/factory-tasks/${task.id}`} className={PRIMARY_BUTTON_CLASS}>
                        {quickAction.label}
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
