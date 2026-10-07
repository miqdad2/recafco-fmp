import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardList, ListTodo, Send, AlertTriangle, CalendarClock, CheckCircle2 } from 'lucide-react';
import { tasksApi } from '@/lib/factory-tasks-api';
import type { TaskDashboardData, FactoryTask, TaskListQuery, UserRef } from '@/lib/factory-tasks-api';
import { authApi } from '@/lib/auth-api';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { ExecutiveModuleTitle } from '../../_components/executive-module-title';
import { TaskOverviewCard } from '../_components/task-overview-card';
import {
  TASK_CONTROL_CENTER_TABS,
  getVisibleTaskControlCenterTabs,
  isValidTaskControlCenterTab,
  isTaskUrgent,
  sortCompletedTasks,
  PENDING_STATUSES,
} from '../_lib/task-control-center-helpers';
import type { TaskControlCenterTabKey } from '../_lib/task-control-center-helpers';
import { NewTaskButton } from '../_components/new-task-button';
import { TaskControlCenterList } from '../_components/task-control-center-list';

export const metadata: Metadata = { title: 'Task Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

const PREVIEW_PAGE_SIZE = 5;
const URGENT_SCAN_SIZE = 100;
const COMPLETED_SCAN_SIZE = 50;
const ACTIVE_STATUSES = 'OPEN,ASSIGNED,IN_PROGRESS,BLOCKED';

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

/**
 * FMP-UI-20 — Task Control Center. Replaces the old Executive Module Landing
 * Page for Task Management (a generic Summary KPI grid + Needs Attention +
 * Recent Activity + Quick Links + a single "View Tasks" button — the exact
 * "current issue" reported: it never clearly guided anyone to create,
 * assign, track, or close a task) with a genuinely operational hub, per
 * this unit's own "Task Control Center" brief.
 *
 * Same route (`/factory-tasks/executive`), same access rule (`tasks.read`),
 * same `tasksApi.dashboard()` call as before — every number is real. New:
 *   - A prominent "+ New Task" button (`ExecutiveModuleTitle`'s own
 *     `actions` slot) linking to the existing, already-fully-working
 *     `/factory-tasks/new` create form — no new form was built; that page
 *     already covers title/description/priority/department/plant/due date/
 *     incident link. Assigning a person happens as a deliberate SEPARATE
 *     step after a task is opened (the task-transitions.tsx "Assign" panel)
 *     — that is the real workflow this app already has (tasks are created
 *     as DRAFT, unassigned), so this page does not add a fake "assign on
 *     create" field.
 *   - 4 overview cards (My Open Tasks / Assigned by Me / Overdue / Due
 *     Today) from `data.metrics` — `assignedByMe` is a new real metric
 *     added to `getDashboard()` (factory-tasks.service.ts), mirroring
 *     `assignedToMe` exactly but keyed on createdByUserId.
 *   - 5 tabs (My Tasks / Assigned by Me / All Tasks / Overdue / Completed).
 *     "All Tasks" is hidden unless the viewer holds `tasks.manage` — the
 *     one existing permission already used for broader task oversight —
 *     never a new permission (see task-control-center-helpers.ts). Each
 *     tab renders a real top-8 preview (`TaskControlCenterList`) of the
 *     SAME data its own existing dedicated page shows, with a "View all"
 *     link to that exact page — never a second, different list.
 * Recent Activity and the old Quick Links are removed entirely (their job —
 * "get to the right task list" — is now the tabs themselves, not a
 * separate, duplicating section).
 */
export default async function FactoryTasksExecutivePage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult] = await Promise.allSettled([
    tasksApi.dashboard(),
    authApi.me(accessToken),
  ]);

  const permissions: string[] =
    meResult.status === 'fulfilled' && meResult.value.ok ? meResult.value.data.permissions : [];
  if (!permissions.includes('tasks.read')) notFound();
  const currentUserId = meResult.status === 'fulfilled' && meResult.value.ok ? meResult.value.data.id : '';

  const visibleTabs = getVisibleTaskControlCenterTabs(permissions);
  const requestedTab = params.tab;
  const activeTabKey: TaskControlCenterTabKey = isValidTaskControlCenterTab(requestedTab, permissions)
    ? requestedTab
    : 'all';
  const activeTab = TASK_CONTROL_CENTER_TABS.find((t) => t.key === activeTabKey)!;

  const data: TaskDashboardData | null = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
  const canCreate = permissions.includes('tasks.create');

  // Assignable people for the View popup's Assign form — only fetched for viewers who can assign.
  let people: UserRef[] = [];
  if (permissions.includes('tasks.assign')) {
    try { people = await tasksApi.people(); } catch { people = []; }
  }

  let previewTasks: FactoryTask[] = [];
  // Total tasks matching the selected tab, so the header can say "latest 5 of 7".
  let previewTotal = 0;
  let previewError = false;
  try {
    const query: TaskListQuery = { pageSize: PREVIEW_PAGE_SIZE };
    if (activeTabKey === 'urgent') {
      // No server-side "urgent" filter exists: fetch the active population and apply the real rule here.
      const result = await tasksApi.list({ pageSize: URGENT_SCAN_SIZE, status: ACTIVE_STATUSES });
      const urgent = result.items.filter(isTaskUrgent);
      previewTotal = urgent.length;
      previewTasks = urgent.slice(0, PREVIEW_PAGE_SIZE);
    } else if (activeTabKey === 'completed') {
      const result = await tasksApi.list({ pageSize: COMPLETED_SCAN_SIZE, status: 'COMPLETED,CLOSED' });
      previewTotal = result.pagination.total;
      previewTasks = sortCompletedTasks(result.items).slice(0, PREVIEW_PAGE_SIZE);
    } else {
      const result =
        activeTabKey === 'my' ? await tasksApi.my(query) :
        activeTabKey === 'assigned' ? await tasksApi.assignedByMe(query) :
        activeTabKey === 'pending' ? await tasksApi.list({ ...query, status: PENDING_STATUSES.join(',') }) :
        await tasksApi.list(query);
      previewTotal = result.pagination.total;
      previewTasks = result.items;
    }
  } catch {
    previewError = true;
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-4 px-4 py-4 lg:px-6">
      <ExecutiveModuleNav code="FACTORY_TASKS" permissions={permissions} />

      <div className="rounded-xl border border-border bg-surface px-5 py-4 shadow-sm">
        <ExecutiveModuleTitle
          title="Task Management"
          description="Create, assign, track, and close operational tasks across departments."
          icon={ClipboardList}
          accent="tasks"
          actions={
            canCreate ? (
              <NewTaskButton canAssign={permissions.includes('tasks.assign')} />
            ) : undefined
          }
        />
      </div>

      {!data && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline — please try again shortly.
        </div>
      )}

      <section>
        <h2 className="sr-only">Overview</h2>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          <TaskOverviewCard label="All Open Tasks" value={data?.metrics.openTasks} icon={ClipboardList} iconColor="text-accent" href="/factory-tasks/executive?tab=pending" />
          <TaskOverviewCard label="My Tasks" value={data?.metrics.assignedToMe} icon={ListTodo} iconColor="text-info" href="/factory-tasks/executive?tab=my" />
          <TaskOverviewCard label="Tasks I Assigned" value={data?.metrics.assignedByMe} icon={Send} iconColor="text-teal" href="/factory-tasks/executive?tab=assigned" />
          <TaskOverviewCard label="Urgent / Overdue" value={data?.metrics.overdueTasks} icon={AlertTriangle} iconColor="text-danger" href="/factory-tasks/executive?tab=urgent" />
          <TaskOverviewCard label="Due Today" value={data?.metrics.dueToday} icon={CalendarClock} iconColor="text-warning" href="/factory-tasks/executive?tab=urgent" />
          <TaskOverviewCard label="Completed This Month" value={data?.metrics.completedThisMonth} icon={CheckCircle2} iconColor="text-success" href="/factory-tasks/executive?tab=completed" />
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-lg font-semibold text-text-primary">Recent Tasks</h2>
            {!previewError && previewTotal > PREVIEW_PAGE_SIZE && (
              <p className="text-sm text-text-secondary">Showing latest {PREVIEW_PAGE_SIZE} of {previewTotal} tasks</p>
            )}
          </div>
          <Link
            href={activeTab.viewAllHref}
            className="inline-flex items-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary shadow-sm transition-colors hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            View All Tasks
          </Link>
        </div>
        <div className="mb-2 flex flex-wrap gap-2">
          {visibleTabs.map((tab) => (
            <Link
              key={tab.key}
              href={`/factory-tasks/executive?tab=${tab.key}`}
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

        {previewError ? (
          <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
            Could not load {activeTab.label.toLowerCase()}. The API may be offline — please try again shortly.
          </div>
        ) : (
          <>
            <TaskControlCenterList
              tasks={previewTasks}
              currentUserId={currentUserId}
              permissions={permissions}
              people={people}
              emptyMessage={activeTab.emptyMessage}
            />
          </>
        )}
      </section>
    </div>
  );
}
