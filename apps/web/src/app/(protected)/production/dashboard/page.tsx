import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Factory,
  Play,
  PauseCircle,
  CheckCircle2,
} from 'lucide-react';
import { productionApi } from '@/lib/production-api';
import type { ProductionDashboardData } from '@/lib/production-api';
import { authApi } from '@/lib/auth-api';
import { MetricCard } from '../../_components/metric-card';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { DashboardScopeBadge } from '../../_components/dashboard-scope-badge';
import { DashboardRecentTable } from '../../_components/dashboard-recent-table';

export const metadata: Metadata = { title: 'Production Dashboard — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function ProductionDashboardPage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult] = await Promise.allSettled([
    productionApi.dashboard(),
    authApi.me(accessToken),
  ]);

  const data: ProductionDashboardData | null =
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
          { label: 'Production', href: '/production/dashboard' },
          { label: 'Dashboard' },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Production Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Production orders and lines: Output, Downtime, and Adjustment entries with live KPI metrics
          </p>
        </div>
        <DashboardScopeBadge scope={data?.scope} />
      </div>

      {!data && (
        <div className="rounded-md bg-error-light border border-error px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline or you may not have access.
        </div>
      )}

      <section aria-labelledby="production-metrics-heading">
        <h2
          id="production-metrics-heading"
          className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3"
        >
          Metrics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Scheduled Orders"
            value={m?.scheduledOrders}
            icon={Factory}
            iconColor="text-info"
            href="/production?status=SCHEDULED"
            status={s}
          />
          <MetricCard
            label="In Progress"
            value={m?.inProgressOrders}
            icon={Play}
            iconColor="text-accent"
            href="/production?status=IN_PROGRESS"
            status={s}
          />
          <MetricCard
            label="Paused"
            value={m?.pausedOrders}
            icon={PauseCircle}
            iconColor="text-warning"
            href="/production?status=PAUSED"
            status={s}
          />
          <MetricCard
            label="Completed This Month"
            value={m?.completedThisMonth}
            icon={CheckCircle2}
            iconColor="text-success"
            href="/production?status=COMPLETED"
            status={s}
          />
        </div>
      </section>

      <section aria-labelledby="production-recent-heading">
        <div className="flex items-center justify-between mb-3">
          <h2
            id="production-recent-heading"
            className="text-sm font-semibold text-text-secondary uppercase tracking-wide"
          >
            Recent Orders
          </h2>
          <Link href="/production" className="text-xs text-accent hover:underline">
            View all
          </Link>
        </div>
        <DashboardRecentTable
          items={data?.recent ?? []}
          baseHref="/production"
          emptyMessage="No recent production orders in scope."
        />
      </section>

      <section aria-labelledby="production-actions-heading">
        <h2
          id="production-actions-heading"
          className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3"
        >
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          {permissions.includes('production.create') && (
            <Link
              href="/production/new"
              className="h-9 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
            >
              New Production Order
            </Link>
          )}
          <Link
            href="/production"
            className="h-9 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            All Orders
          </Link>
          {permissions.includes('production.lines.read') && (
            <Link
              href="/production/lines"
              className="h-9 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Production Lines
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
