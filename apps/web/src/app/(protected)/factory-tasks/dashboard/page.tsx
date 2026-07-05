import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ClipboardList,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { tasksApi } from '@/lib/factory-tasks-api';
import type { TaskDashboardData } from '@/lib/factory-tasks-api';
import { authApi } from '@/lib/auth-api';
import { MetricCard } from '../../_components/metric-card';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { DashboardScopeBadge } from '../../_components/dashboard-scope-badge';
import { DashboardRecentTable } from '../../_components/dashboard-recent-table';

export const metadata: Metadata = { title: 'Factory Tasks Dashboard — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function FactoryTasksDashboardPage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult] = await Promise.allSettled([
    tasksApi.dashboard(),
    authApi.me(accessToken),
  ]);

  const data: TaskDashboardData | null =
    dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
  const permissions: string[] =
    meResult.status === 'fulfilled' && meResult.value.ok
      ? meResult.value.data.permissions
      : [];

  const m = data?.metrics;
  const s = data ? 'ok' : 'unavailable' as const;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <Breadcrumbs
        items={[
          { label: 'Factory Tasks', href: '/factory-tasks/dashboard' },
          { label: 'Dashboard' },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Factory Tasks</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Track and manage recurring operational tasks
          </p>
        </div>
        <DashboardScopeBadge scope={data?.scope} />
      </div>

      {!data && (
        <div className="rounded-md bg-error-light border border-error px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline or you may not have access.
        </div>
      )}

      <section aria-labelledby="tasks-metrics-heading">
        <h2
          id="tasks-metrics-heading"
          className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3"
        >
          Metrics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <MetricCard
            label="Open Tasks"
            value={m?.openTasks}
            icon={ClipboardList}
            iconColor="text-accent"
            href="/factory-tasks?status=active"
            status={s}
          />
          <MetricCard
            label="Assigned to Me"
            value={m?.assignedToMe}
            icon={Users}
            iconColor="text-info"
            href="/factory-tasks/my"
            status={s}
          />
          <MetricCard
            label="Overdue"
            value={m?.overdueTasks}
            icon={AlertTriangle}
            iconColor="text-warning"
            href="/factory-tasks?overdue=true"
            status={s}
          />
          <MetricCard
            label="Blocked"
            value={m?.blockedTasks}
            icon={AlertOctagon}
            iconColor="text-danger"
            href="/factory-tasks?status=BLOCKED"
            status={s}
          />
          <MetricCard
            label="Completed This Month"
            value={m?.completedThisMonth}
            icon={CheckCircle2}
            iconColor="text-success"
            href="/factory-tasks?status=COMPLETED"
            status={s}
          />
        </div>
      </section>

      <section aria-labelledby="tasks-recent-heading">
        <div className="flex items-center justify-between mb-3">
          <h2
            id="tasks-recent-heading"
            className="text-sm font-semibold text-text-secondary uppercase tracking-wide"
          >
            Recent Tasks
          </h2>
          <Link href="/factory-tasks" className="text-xs text-accent hover:underline">
            View all
          </Link>
        </div>
        <DashboardRecentTable
          items={data?.recent ?? []}
          baseHref="/factory-tasks"
          emptyMessage="No recent tasks in scope."
        />
      </section>

      <section aria-labelledby="tasks-actions-heading">
        <h2
          id="tasks-actions-heading"
          className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3"
        >
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          {permissions.includes('tasks.create') && (
            <Link
              href="/factory-tasks/new"
              className="h-9 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
            >
              New Task
            </Link>
          )}
          <Link
            href="/factory-tasks"
            className="h-9 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            All Tasks
          </Link>
          <Link
            href="/factory-tasks/my"
            className="h-9 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            My Tasks
          </Link>
        </div>
      </section>
    </div>
  );
}
