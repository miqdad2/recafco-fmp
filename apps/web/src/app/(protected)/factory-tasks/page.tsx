import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Breadcrumbs } from '../_components/breadcrumbs';
import { PageHeader } from '../administration/_components/page-header';
import {
  TASK_CONTROL_CENTER_TABS,
  getVisibleTaskControlCenterTabs,
  isValidTaskControlCenterTab,
  isTaskUrgent,
  sortCompletedTasks,
  PENDING_STATUSES,
} from './_lib/task-control-center-helpers';
import type { TaskControlCenterTabKey } from './_lib/task-control-center-helpers';
import { NewTaskButton } from './_components/new-task-button';
import { TaskControlCenterList } from './_components/task-control-center-list';
import { authApi } from '../../../lib/auth-api';
import { TaskModuleNav } from './_components/task-module-nav';
import { tasksApi } from '../../../lib/factory-tasks-api';
import type { TaskStatus, TaskListQuery, UserRef } from '../../../lib/factory-tasks-api';

type PageSearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = { title: 'Task List — RECAFCO FMP' };

const ACTIVE_STATUSES: TaskStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED'];

/** Plain-word Status dropdown values to the real statuses behind them (no new statuses invented). */
const STATUS_FILTER_VALUES: Record<string, string> = {
  draft: 'DRAFT',
  open: 'OPEN,ASSIGNED',
  'in-progress': 'IN_PROGRESS,BLOCKED',
  completed: 'COMPLETED,CLOSED',
  cancelled: 'CANCELLED',
};

interface PageProps {
  searchParams: Promise<PageSearchParams>;
}

/**
 * FMP-UI-20I — this page had no clear way back to Task Management or the
 * Platform Dashboard, and repeated "Factory Tasks Management" as both the
 * breadcrumb and the title, per direct feedback. Added the same
 * `TaskModuleNav` row (Back to Task Management / Back to Platform
 * Dashboard / Previous / Switch module) the Task Detail page already has
 * (FMP-UI-20F–20H) — this page needed no task-specific data for it, so the
 * component (renamed from `TaskDetailNav`, see its own file) is reused
 * verbatim. Breadcrumb is now 3 levels ("Platform Dashboard > Task
 * Management > Task List", was 1 level: "Factory Tasks Management").
 * Title/subtitle changed to "Task List" / "View, filter, and open
 * operational tasks." (was "Factory Tasks Management" repeated as both
 * breadcrumb and title). "Assigned to" empty cell wording aligned with the
 * rest of the module ("Not assigned", was a bare "—"). No filter, search,
 * pagination, or table-action behavior changed.
 */
export default async function FactoryTasksPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const store = await cookies();
  const meResult = await authApi.me(store.get('recafco_access')?.value ?? '').catch(() => null);
  const permissions: string[] = meResult?.ok ? meResult.data.permissions : [];
  const currentUserId = meResult?.ok ? meResult.data.id : '';
  let people: UserRef[] = [];
  if (permissions.includes('tasks.assign')) {
    try { people = await tasksApi.people(); } catch { people = []; }
  }
  const canCreate = permissions.includes('tasks.create');

  const statusFilter = typeof params['status'] === 'string' ? params['status'] : undefined;
  const priorityFilter = typeof params['priority'] === 'string' ? params['priority'] : undefined;
  const search = typeof params['search'] === 'string' ? params['search'] : undefined;
  const dueFrom = typeof params['dueFrom'] === 'string' ? params['dueFrom'] : undefined;
  const dueTo = typeof params['dueTo'] === 'string' ? params['dueTo'] : undefined;
  const overdueRaw = typeof params['overdue'] === 'string' ? params['overdue'] : undefined;
  const overdueFilter = overdueRaw === 'true' ? true : overdueRaw === 'false' ? false : undefined;
  // FMP-UI-20 — "createdByUserId" passthrough for the Task Control Center's
  // "Assigned by Me" style links into this same full list (mirrors the
  // existing assignedToUserId="me" support the API already had).
  const createdByUserId = typeof params['createdByUserId'] === 'string' ? params['createdByUserId'] : undefined;
  const page = typeof params['page'] === 'string' ? parseInt(params['page'], 10) : 1;

  const tabParam = typeof params['tab'] === 'string' ? params['tab'] : undefined;
  const activeTabKey: TaskControlCenterTabKey = isValidTaskControlCenterTab(tabParam, permissions) ? tabParam : 'all';
  const activeTab = TASK_CONTROL_CENTER_TABS.find((t) => t.key === activeTabKey)!;

  let tasks: Awaited<ReturnType<typeof tasksApi.list>> | null = null;
  let error: string | null = null;

  try {
    const query: TaskListQuery = { page, pageSize: 25 };
    // The simple Status dropdown maps one plain word to the real status values behind it.
    if (statusFilter && STATUS_FILTER_VALUES[statusFilter]) {
      query.status = STATUS_FILTER_VALUES[statusFilter];
    } else if (statusFilter) {
      query.status = statusFilter; // older links such as ?status=COMPLETED,CLOSED still work
    } else if (activeTabKey === 'pending') {
      query.status = PENDING_STATUSES.join(',');
    } else if (activeTabKey === 'completed') {
      query.status = 'COMPLETED,CLOSED';
    }
    if (priorityFilter) query.priority = priorityFilter;
    if (search) query.search = search;
    if (dueFrom) query.dueFrom = dueFrom;
    if (dueTo) query.dueTo = dueTo;
    if (overdueFilter !== undefined) query.overdue = overdueFilter;
    if (createdByUserId) query.createdByUserId = createdByUserId;

    if (activeTabKey === 'urgent') {
      // No server-side urgent filter: scan the active tasks and apply the real rule here (no paging).
      const result = await tasksApi.list({ ...query, page: 1, pageSize: 100, status: query.status ?? ACTIVE_STATUSES.join(',') });
      const items = result.items.filter(isTaskUrgent);
      tasks = { items, pagination: { page: 1, pageSize: 100, total: items.length, totalPages: 1 } };
    } else if (activeTabKey === 'my') {
      tasks = await tasksApi.my(query);
    } else if (activeTabKey === 'assigned') {
      tasks = await tasksApi.assignedByMe(query);
    } else {
      tasks = await tasksApi.list(query);
    }
    if (activeTabKey === 'completed') {
      tasks = { ...tasks, items: sortCompletedTasks(tasks.items) };
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load tasks';
  }

  const hasFilters = !!(statusFilter ?? priorityFilter ?? search ?? dueFrom ?? dueTo ?? overdueRaw ?? createdByUserId);

  return (
    <div className="min-h-full px-4 py-4 lg:px-6">
      <div className="mx-auto w-full max-w-screen-2xl">
        <div className="space-y-3">
          <Breadcrumbs items={[
            { label: 'Platform Dashboard', href: '/dashboard' },
            { label: 'Task Management', href: '/factory-tasks/executive' },
            { label: 'Task List' },
          ]} className="mb-0" />
          <TaskModuleNav permissions={permissions} />
        </div>

        <div className="mb-4 mt-4">
          <PageHeader
            title="Task List"
            description="Search and view all tasks."
            action={
              canCreate ? (
                <NewTaskButton canAssign={permissions.includes('tasks.assign')} />
              ) : undefined
            }
          />
        </div>

        {/* Tabs - same names and order as the Task Management dashboard */}
        <div className="mb-3 flex flex-wrap gap-2">
          {getVisibleTaskControlCenterTabs(permissions).map((tab) => (
            <Link
              key={tab.key}
              href={`/factory-tasks?tab=${tab.key}`}
              aria-current={tab.key === activeTabKey ? 'page' : undefined}
              className={
                tab.key === activeTabKey
                  ? 'rounded-full border border-accent bg-accent px-4 py-2 text-base font-semibold text-white transition-colors'
                  : 'rounded-full border border-border bg-surface px-4 py-2 text-base font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary'
              }
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Filters - one simple row */}
        <form method="GET" className="mb-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="tab" value={activeTabKey} />
          <div>
            <label htmlFor="search-input" className="mb-1 block text-sm font-medium text-text-secondary">Search</label>
            <input
              id="search-input"
              name="search"
              type="search"
              defaultValue={search}
              placeholder="Task number or title"
              className="w-56 rounded-md border border-border bg-surface px-3 py-2 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="status-filter" className="mb-1 block text-sm font-medium text-text-secondary">Status</label>
            <select
              id="status-filter"
              name="status"
              defaultValue={statusFilter ?? ''}
              className="rounded-md border border-border bg-surface px-3 py-2 text-base text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Any status</option>
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label htmlFor="priority-filter" className="mb-1 block text-sm font-medium text-text-secondary">Priority</label>
            <select
              id="priority-filter"
              name="priority"
              defaultValue={priorityFilter ?? ''}
              className="rounded-md border border-border bg-surface px-3 py-2 text-base text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Any priority</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Normal</option>
            </select>
          </div>
          <div>
            <label htmlFor="due-from" className="mb-1 block text-sm font-medium text-text-secondary">Due from</label>
            <input id="due-from" name="dueFrom" type="date" defaultValue={dueFrom}
              className="rounded-md border border-border bg-surface px-3 py-2 text-base text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="due-to" className="mb-1 block text-sm font-medium text-text-secondary">Due to</label>
            <input id="due-to" name="dueTo" type="date" defaultValue={dueTo}
              className="rounded-md border border-border bg-surface px-3 py-2 text-base text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-accent px-5 py-2 text-base font-semibold text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Search
          </button>
          {hasFilters && (
            <Link href={`/factory-tasks?tab=${activeTabKey}`} className="rounded-md px-3 py-2 text-base text-text-muted hover:text-text-primary focus:outline-none">
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

        {/* Task rows */}
        {tasks && tasks.items.length > 0 && (
          <>
            <TaskControlCenterList
              tasks={tasks.items}
              currentUserId={currentUserId}
              permissions={permissions}
              people={people}
              emptyMessage={activeTab.emptyMessage}
            />

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
