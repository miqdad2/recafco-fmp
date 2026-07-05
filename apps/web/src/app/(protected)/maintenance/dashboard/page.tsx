import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Wrench,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { maintenanceApi } from '@/lib/maintenance-api';
import type { MrDashboardData } from '@/lib/maintenance-api';
import { authApi } from '@/lib/auth-api';
import { MetricCard } from '../../_components/metric-card';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { DashboardScopeBadge } from '../../_components/dashboard-scope-badge';
import { DashboardRecentTable } from '../../_components/dashboard-recent-table';

export const metadata: Metadata = { title: 'Maintenance Requests Dashboard — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function MaintenanceDashboardPage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult] = await Promise.allSettled([
    maintenanceApi.dashboard(),
    authApi.me(accessToken),
  ]);

  const data: MrDashboardData | null =
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
          { label: 'Maintenance Requests', href: '/maintenance/dashboard' },
          { label: 'Dashboard' },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Maintenance Requests</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Submit and track maintenance requests through the full review and repair lifecycle
          </p>
        </div>
        <DashboardScopeBadge scope={data?.scope} />
      </div>

      {!data && (
        <div className="rounded-md bg-error-light border border-error px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline or you may not have access.
        </div>
      )}

      <section aria-labelledby="mr-metrics-heading">
        <h2
          id="mr-metrics-heading"
          className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3"
        >
          Metrics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <MetricCard
            label="Open Requests"
            value={m?.openRequests}
            icon={Wrench}
            iconColor="text-accent"
            href="/maintenance"
            status={s}
          />
          <MetricCard
            label="Assigned to Me"
            value={m?.assignedToMe}
            icon={Users}
            iconColor="text-info"
            href="/maintenance/my"
            status={s}
          />
          <MetricCard
            label="Overdue"
            value={m?.overdueRequests}
            icon={AlertTriangle}
            iconColor="text-warning"
            href="/maintenance?overdue=true"
            status={s}
          />
          <MetricCard
            label="Waiting for Parts"
            value={m?.waitingForParts}
            icon={AlertOctagon}
            iconColor="text-danger"
            href="/maintenance?status=WAITING_FOR_PARTS"
            status={s}
          />
          <MetricCard
            label="Completed This Month"
            value={m?.completedThisMonth}
            icon={CheckCircle2}
            iconColor="text-success"
            href="/maintenance?status=COMPLETED"
            status={s}
          />
        </div>
      </section>

      <section aria-labelledby="mr-recent-heading">
        <div className="flex items-center justify-between mb-3">
          <h2
            id="mr-recent-heading"
            className="text-sm font-semibold text-text-secondary uppercase tracking-wide"
          >
            Recent Requests
          </h2>
          <Link href="/maintenance" className="text-xs text-accent hover:underline">
            View all
          </Link>
        </div>
        <DashboardRecentTable
          items={data?.recent ?? []}
          baseHref="/maintenance"
          emptyMessage="No recent maintenance requests in scope."
        />
      </section>

      <section aria-labelledby="mr-actions-heading">
        <h2
          id="mr-actions-heading"
          className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3"
        >
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          {permissions.includes('maintenance.create') && (
            <Link
              href="/maintenance/new"
              className="h-9 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
            >
              New Request
            </Link>
          )}
          <Link
            href="/maintenance"
            className="h-9 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            All Requests
          </Link>
          <Link
            href="/maintenance/my"
            className="h-9 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            My Requests
          </Link>
        </div>
      </section>
    </div>
  );
}
