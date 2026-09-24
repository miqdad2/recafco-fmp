import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { tasksApi } from '@/lib/factory-tasks-api';
import type { TaskDashboardData } from '@/lib/factory-tasks-api';
import { authApi } from '@/lib/auth-api';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { ExecutiveModuleTitle } from '../../_components/executive-module-title';
import { ExecutiveKpiGrid } from '../../_components/executive-kpi-grid';
import { ExecutiveAttentionPanel } from '../../_components/executive-attention-panel';
import { ExecutiveQuickLinks } from '../../_components/executive-quick-links';
import { DashboardRecentTable } from '../../_components/dashboard-recent-table';

export const metadata: Metadata = { title: 'Task Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-UI-07 — Executive Module Landing Page for Task Management. Reuses the
 * exact same /factory-tasks/dashboard data (tasksApi.dashboard()) already
 * shown on the module's own operational dashboard, which stays untouched at
 * its own route — no new backend logic.
 */
export default async function FactoryTasksExecutivePage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult] = await Promise.allSettled([
    tasksApi.dashboard(),
    authApi.me(accessToken),
  ]);

  const permissions: string[] =
    meResult.status === 'fulfilled' && meResult.value.ok ? meResult.value.data.permissions : [];
  if (!permissions.includes('tasks.read')) notFound();

  const data: TaskDashboardData | null = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-6 lg:px-6">
      <ExecutiveModuleNav code="FACTORY_TASKS" permissions={permissions} />

      <ExecutiveModuleTitle
        title="Task Management"
        description="Factory tasks, assignments, and due work across departments."
        icon={ClipboardList}
        accent="tasks"
      />

      {!data && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline — please try again shortly.
        </div>
      )}

      <section aria-labelledby="tasks-exec-kpi-heading" className="space-y-3">
        <h2 id="tasks-exec-kpi-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Summary
        </h2>
        <ExecutiveKpiGrid metrics={data?.metrics ?? {}} icon={ClipboardList} />
      </section>

      <section aria-labelledby="tasks-exec-attention-heading" className="space-y-3">
        <h2 id="tasks-exec-attention-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Needs Attention
        </h2>
        <ExecutiveAttentionPanel
          available={data !== null}
          note="Not available — dashboard data could not be loaded."
          countItems={[
            { label: 'task(s) Overdue', value: data?.metrics.overdueTasks ?? 0, href: '/factory-tasks?overdue=true' },
            { label: 'task(s) Blocked', value: data?.metrics.blockedTasks ?? 0, href: '/factory-tasks?status=BLOCKED' },
          ]}
          emptyMessage="No overdue or blocked tasks right now."
        />
      </section>

      <section aria-labelledby="tasks-exec-recent-heading" className="space-y-3">
        <h2 id="tasks-exec-recent-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Recent Activity
        </h2>
        <DashboardRecentTable items={data?.recent ?? []} baseHref="/factory-tasks" emptyMessage="No recent tasks in scope." />
      </section>

      <section aria-labelledby="tasks-exec-quicklinks-heading" className="space-y-3">
        <h2 id="tasks-exec-quicklinks-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Quick Links
        </h2>
        <ExecutiveQuickLinks
          links={[
            { label: 'Operational Dashboard', href: '/factory-tasks/dashboard' },
            { label: 'Active Tasks', href: '/factory-tasks?status=active' },
            { label: 'Overdue', href: '/factory-tasks?overdue=true' },
            { label: 'My Tasks', href: '/factory-tasks/my' },
          ]}
        />
      </section>

      <div className="pt-2">
        <Link
          href="/factory-tasks"
          className="inline-flex h-12 items-center rounded-lg bg-accent px-6 text-base font-semibold text-accent-foreground transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
        >
          View Tasks
        </Link>
      </div>
    </div>
  );
}
