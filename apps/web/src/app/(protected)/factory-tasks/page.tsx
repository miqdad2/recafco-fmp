import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Breadcrumbs } from '../_components/breadcrumbs';
import { PageHeader } from '../administration/_components/page-header';
import { TaskStatusBadge } from './_components/task-status-badge';
import { TaskPriorityBadge } from './_components/task-priority-badge';
import { tasksApi } from '../../../lib/factory-tasks-api';
import type { TaskStatus, TaskPriority, TaskListQuery } from '../../../lib/factory-tasks-api';

type PageSearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = { title: 'Factory Tasks — RECAFCO FMP' };

const ACTIVE_STATUSES: TaskStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED'];

async function getUserPermissions(): Promise<string[]> {
  try {
    const store = await cookies();
    const token = store.get('recafco_access')?.value;
    if (!token) return [];
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
    return Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [];
  } catch {
    return [];
  }
}

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

interface PageProps {
  searchParams: Promise<PageSearchParams>;
}

export default async function FactoryTasksPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const permissions = await getUserPermissions();
  const canCreate = permissions.includes('tasks.create');

  const statusFilter = typeof params['status'] === 'string' ? params['status'] : undefined;
  const priorityFilter = typeof params['priority'] === 'string' ? params['priority'] : undefined;
  const search = typeof params['search'] === 'string' ? params['search'] : undefined;
  const dueFrom = typeof params['dueFrom'] === 'string' ? params['dueFrom'] : undefined;
  const dueTo = typeof params['dueTo'] === 'string' ? params['dueTo'] : undefined;
  const overdueRaw = typeof params['overdue'] === 'string' ? params['overdue'] : undefined;
  const overdueFilter = overdueRaw === 'true' ? true : overdueRaw === 'false' ? false : undefined;
  const page = typeof params['page'] === 'string' ? parseInt(params['page'], 10) : 1;

  let tasks: Awaited<ReturnType<typeof tasksApi.list>> | null = null;
  let error: string | null = null;

  try {
    const query: TaskListQuery = { page, pageSize: 25 };
    if (statusFilter === 'active') {
      query.status = ACTIVE_STATUSES.join(',');
    } else if (statusFilter) {
      query.status = statusFilter;
    }
    if (priorityFilter) query.priority = priorityFilter;
    if (search) query.search = search;
    if (dueFrom) query.dueFrom = dueFrom;
    if (dueTo) query.dueTo = dueTo;
    if (overdueFilter !== undefined) query.overdue = overdueFilter;
    tasks = await tasksApi.list(query);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load tasks';
  }

  const hasFilters = !!(statusFilter ?? priorityFilter ?? search ?? dueFrom ?? dueTo ?? overdueRaw);

  return (
    <div className="min-h-full p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs items={[{ label: 'Factory Tasks' }]} />

        <div className="mb-6">
          <PageHeader
            title="Factory Tasks"
            description="Manage and track operational tasks across all factory facilities."
            action={
              canCreate ? (
                <Link
                  href="/factory-tasks/new"
                  className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  New Task
                </Link>
              ) : undefined
            }
          />
        </div>

        {/* Quick filters */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/factory-tasks?status=active"
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${statusFilter === 'active' ? 'bg-accent text-white border-accent' : 'border-border bg-surface text-text-secondary hover:border-border-strong'}`}
          >
            Active
          </Link>
          <Link
            href="/factory-tasks?overdue=true"
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${overdueFilter === true ? 'bg-danger text-white border-danger' : 'border-border bg-surface text-text-secondary hover:border-border-strong'}`}
          >
            Overdue
          </Link>
          <Link
            href="/factory-tasks?status=BLOCKED"
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${statusFilter === 'BLOCKED' ? 'bg-danger-light text-danger border-danger' : 'border-border bg-surface text-text-secondary hover:border-border-strong'}`}
          >
            Blocked
          </Link>
          <Link
            href="/factory-tasks/my"
            className="rounded-full px-3 py-1 text-xs font-medium border border-border bg-surface text-text-secondary hover:border-border-strong transition-colors"
          >
            My tasks →
          </Link>
        </div>

        {/* Filters */}
        <form method="GET" className="mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label htmlFor="search-input" className="block text-xs font-medium text-text-secondary mb-1">Search</label>
            <input
              id="search-input"
              name="search"
              type="search"
              defaultValue={search}
              placeholder="Reference or title…"
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent w-48"
            />
          </div>
          <div>
            <label htmlFor="status-filter" className="block text-xs font-medium text-text-secondary mb-1">Status</label>
            <select
              id="status-filter"
              name="status"
              defaultValue={statusFilter ?? ''}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All statuses</option>
              <option value="active">Active (open / assigned / in-progress / blocked)</option>
              <option value="DRAFT">Draft</option>
              <option value="OPEN">Open</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="BLOCKED">Blocked</option>
              <option value="COMPLETED">Completed</option>
              <option value="CLOSED">Closed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <label htmlFor="priority-filter" className="block text-xs font-medium text-text-secondary mb-1">Priority</label>
            <select
              id="priority-filter"
              name="priority"
              defaultValue={priorityFilter ?? ''}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          <div>
            <label htmlFor="due-from" className="block text-xs font-medium text-text-secondary mb-1">Due from</label>
            <input id="due-from" name="dueFrom" type="date" defaultValue={dueFrom}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="due-to" className="block text-xs font-medium text-text-secondary mb-1">Due to</label>
            <input id="due-to" name="dueTo" type="date" defaultValue={dueTo}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-border bg-surface-secondary px-4 py-1.5 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Filter
          </button>
          {hasFilters && (
            <Link href="/factory-tasks" className="rounded-md px-3 py-1.5 text-sm text-text-muted hover:text-text-primary focus:outline-none">
              Clear
            </Link>
          )}
        </form>

        {/* Error */}
        {error && (
          <div role="alert" className="rounded-lg border border-danger bg-danger-light px-4 py-3 text-sm text-danger mb-6">
            {error}
          </div>
        )}

        {/* Empty state */}
        {tasks && tasks.items.length === 0 && (
          <div className="rounded-lg border border-border bg-surface py-16 text-center">
            <p className="text-sm text-text-muted">No tasks found.</p>
            {canCreate && (
              <Link href="/factory-tasks/new" className="mt-2 inline-block text-sm text-accent hover:underline">
                Create a task
              </Link>
            )}
          </div>
        )}

        {/* Table */}
        {tasks && tasks.items.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead className="bg-surface-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Reference</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Due</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Assigned to</th>
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
                        <td className="px-4 py-3 max-w-xs">
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
                          {task.assignedToUser?.displayName ?? <span className="text-text-muted">—</span>}
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

            {/* Pagination */}
            {tasks.pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
                <span>
                  Showing {(tasks.pagination.page - 1) * tasks.pagination.pageSize + 1}–
                  {Math.min(tasks.pagination.page * tasks.pagination.pageSize, tasks.pagination.total)} of{' '}
                  {tasks.pagination.total}
                </span>
                <div className="flex gap-2">
                  {tasks.pagination.page > 1 && (
                    <Link
                      href={{ query: { ...params, page: tasks.pagination.page - 1 } }}
                      className="rounded-md border border-border bg-surface px-3 py-1.5 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      Previous
                    </Link>
                  )}
                  {tasks.pagination.page < tasks.pagination.totalPages && (
                    <Link
                      href={{ query: { ...params, page: tasks.pagination.page + 1 } }}
                      className="rounded-md border border-border bg-surface px-3 py-1.5 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      Next
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
