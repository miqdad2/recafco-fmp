import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardList, ListTodo, Send, AlertTriangle, CalendarClock } from 'lucide-react';
import { tasksApi } from '@/lib/factory-tasks-api';
import type { TaskDashboardData, FactoryTask, TaskListQuery } from '@/lib/factory-tasks-api';
import { authApi } from '@/lib/auth-api';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { ExecutiveModuleTitle } from '../../_components/executive-module-title';
import { MetricCard } from '../../_components/metric-card';
import type { MetricStatus } from '../../_components/metric-card';
import {
  TASK_CONTROL_CENTER_TABS,
  getVisibleTaskControlCenterTabs,
  isValidTaskControlCenterTab,
} from '../_lib/task-control-center-helpers';
import type { TaskControlCenterTabKey } from '../_lib/task-control-center-helpers';
import { TaskControlCenterList } from '../_components/task-control-center-list';

export const metadata: Metadata = { title: 'Task Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

const PREVIEW_PAGE_SIZE = 8;

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
    : 'my';
  const activeTab = TASK_CONTROL_CENTER_TABS.find((t) => t.key === activeTabKey)!;

  const data: TaskDashboardData | null = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
  const canCreate = permissions.includes('tasks.create');
  const metricsStatus: MetricStatus = data ? 'ok' : 'unavailable';

  let previewTasks: FactoryTask[] = [];
  let previewError = false;
  try {
    const query: TaskListQuery = { pageSize: PREVIEW_PAGE_SIZE };
    const result =
      activeTabKey === 'my' ? await tasksApi.my(query) :
      activeTabKey === 'assigned-by-me' ? await tasksApi.assignedByMe(query) :
      activeTabKey === 'overdue' ? await tasksApi.list({ ...query, overdue: true }) :
      activeTabKey === 'completed' ? await tasksApi.list({ ...query, status: 'COMPLETED,CLOSED' }) :
      await tasksApi.list(query);
    previewTasks = result.items;
  } catch {
    previewError = true;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-6 lg:px-6">
      <ExecutiveModuleNav code="FACTORY_TASKS" permissions={permissions} />

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm lg:p-6">
        <ExecutiveModuleTitle
          title="Task Management"
          description="Create, assign, track, and close operational tasks across departments."
          icon={ClipboardList}
          accent="tasks"
          actions={
            canCreate ? (
              <Link
                href="/factory-tasks/new"
                className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
              >
                + New Task
              </Link>
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
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="My Open Tasks" value={data?.metrics.assignedToMe} icon={ListTodo} iconColor="text-info"
            href="/factory-tasks/my" status={metricsStatus}
          />
          <MetricCard
            label="Assigned by Me" value={data?.metrics.assignedByMe} icon={Send} iconColor="text-teal"
            href="/factory-tasks/assigned-by-me" status={metricsStatus}
          />
          <MetricCard
            label="Overdue" value={data?.metrics.overdueTasks} icon={AlertTriangle} iconColor="text-danger"
            href="/factory-tasks?overdue=true" status={metricsStatus}
          />
          <MetricCard
            label="Due Today" value={data?.metrics.dueToday} icon={CalendarClock} iconColor="text-warning"
            status={metricsStatus}
          />
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">Tasks</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {visibleTabs.map((tab) => (
            <Link
              key={tab.key}
              href={`/factory-tasks/executive?tab=${tab.key}`}
              aria-current={tab.key === activeTabKey ? 'page' : undefined}
              className={
                tab.key === activeTabKey
                  ? 'rounded-full border border-accent bg-accent px-3.5 py-1.5 text-sm font-semibold text-white transition-colors'
                  : 'rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary'
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
              emptyMessage={activeTab.emptyMessage}
            />
            {previewTasks.length > 0 && (
              <div className="mt-3">
                <Link href={activeTab.viewAllHref} className="text-sm font-medium text-accent hover:underline">
                  View all {activeTab.label.toLowerCase()} →
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
