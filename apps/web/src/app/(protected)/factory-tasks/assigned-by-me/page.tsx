import Link from 'next/link';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { PageHeader } from '../../administration/_components/page-header';
import { TaskStatusBadge } from '../_components/task-status-badge';
import { TaskPriorityBadge } from '../_components/task-priority-badge';
import { tasksApi } from '../../../../lib/factory-tasks-api';
import type { TaskStatus, TaskPriority } from '../../../../lib/factory-tasks-api';

export const metadata: Metadata = { title: 'Assigned by Me — RECAFCO FMP' };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function isOverdue(dueAt: string | null, status: TaskStatus): boolean {
  if (!dueAt) return false;
  if (!(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED'] as TaskStatus[]).includes(status)) return false;
  return new Date(dueAt) < new Date();
}

/**
 * FMP-UI-20 — mirrors `factory-tasks/my/page.tsx` exactly (same layout,
 * same table shape), but for tasks the current user created/assigned to
 * others instead of tasks assigned TO them — the "Assigned by Me" tab's own
 * dedicated full-list page, one click away from the Task Control Center
 * (`factory-tasks/executive/page.tsx`). Backed by the new
 * `tasksApi.assignedByMe()` / `GET /factory-tasks/assigned-by-me` (mirrors
 * `/factory-tasks/my` server-side too — see factory-tasks.service.ts's
 * `findAssignedByMe()`) — real data, no new permission (still gated by the
 * same `tasks.read` every other task screen already requires).
 */
export default async function AssignedByMeTasksPage(): Promise<React.JSX.Element> {
  let tasks: Awaited<ReturnType<typeof tasksApi.assignedByMe>> | null = null;
  let error: string | null = null;

  try {
    tasks = await tasksApi.assignedByMe({ pageSize: 50, status: 'OPEN,ASSIGNED,IN_PROGRESS,BLOCKED' });
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load tasks';
  }

  return (
    <div className="min-h-full p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Factory Tasks Management', href: '/factory-tasks' },
          { label: 'Assigned by Me' },
        ]} />

        <div className="mb-6">
          <PageHeader
            title="Assigned by Me"
            description="Tasks you created and assigned to others."
          />
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-danger bg-danger-light px-4 py-3 text-sm text-danger mb-6">
            {error}
          </div>
        )}

        {tasks && tasks.items.length === 0 && (
          <div className="rounded-lg border border-border bg-surface py-16 text-center">
            <p className="text-sm text-text-muted">No tasks assigned by you.</p>
            <Link href="/factory-tasks/new" className="mt-2 inline-block text-sm text-accent hover:underline">
              Create a task
            </Link>
          </div>
        )}

        {tasks && tasks.items.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Due</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Assigned To</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Department</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {tasks.items.map((task) => {
                  const overdue = isOverdue(task.dueAt, task.status as TaskStatus);
                  return (
                    <tr key={task.id} className="hover:bg-surface-secondary/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/factory-tasks/${task.id}`}
                          className="font-mono text-xs text-accent hover:underline focus:outline-none focus:underline"
                        >
                          {task.referenceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 max-w-sm">
                        <Link
                          href={`/factory-tasks/${task.id}`}
                          className="text-text-primary hover:text-accent line-clamp-2 focus:outline-none focus:underline"
                        >
                          {task.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <TaskPriorityBadge priority={task.priority as TaskPriority} />
                      </td>
                      <td className="px-4 py-3">
                        <TaskStatusBadge status={task.status as TaskStatus} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {task.dueAt ? (
                          <span className={overdue ? 'text-danger font-medium' : 'text-text-secondary'}>
                            {formatDate(task.dueAt)}
                            {overdue && <span className="ml-1 text-xs">(overdue)</span>}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {task.assignedToUser?.displayName ?? <span className="text-text-muted">Not assigned</span>}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {task.responsibleDepartment?.name ?? <span className="text-text-muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
