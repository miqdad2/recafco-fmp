import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  AlertOctagon,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { incidentsApi } from '@/lib/incidents-api';
import type { IncidentDashboardData } from '@/lib/incidents-api';
import { authApi } from '@/lib/auth-api';
import { MetricCard } from '../../_components/metric-card';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { DashboardScopeBadge } from '../../_components/dashboard-scope-badge';
import { DashboardRecentTable } from '../../_components/dashboard-recent-table';

export const metadata: Metadata = { title: 'Incident Report Dashboard — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function IncidentsDashboardPage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult] = await Promise.allSettled([
    incidentsApi.dashboard(),
    authApi.me(accessToken),
  ]);

  const data: IncidentDashboardData | null =
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
          { label: 'Incident Report', href: '/incidents/dashboard' },
          { label: 'Dashboard' },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Incident Report</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Report and manage incidents, near-misses, and corrective actions
          </p>
        </div>
        <DashboardScopeBadge scope={data?.scope} />
      </div>

      {!data && (
        <div className="rounded-md bg-error-light border border-error px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline or you may not have access.
        </div>
      )}

      <section aria-labelledby="incidents-metrics-heading">
        <h2
          id="incidents-metrics-heading"
          className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3"
        >
          Metrics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Open Incidents"
            value={m?.totalOpen}
            icon={AlertTriangle}
            iconColor="text-warning"
            href="/incidents"
            status={s}
          />
          <MetricCard
            label="Critical Open"
            value={m?.criticalOpen}
            icon={AlertOctagon}
            iconColor="text-danger"
            href="/incidents?severity=CRITICAL"
            status={s}
          />
          <MetricCard
            label="Under Investigation"
            value={m?.underInvestigation}
            icon={Search}
            iconColor="text-info"
            href="/incidents?status=INVESTIGATION"
            status={s}
          />
          <MetricCard
            label="Resolved This Month"
            value={m?.resolvedThisMonth}
            icon={CheckCircle2}
            iconColor="text-success"
            href="/incidents?status=RESOLVED"
            status={s}
          />
        </div>
      </section>

      <section aria-labelledby="incidents-recent-heading">
        <div className="flex items-center justify-between mb-3">
          <h2
            id="incidents-recent-heading"
            className="text-sm font-semibold text-text-secondary uppercase tracking-wide"
          >
            Recent Incidents
          </h2>
          <Link href="/incidents" className="text-xs text-accent hover:underline">
            View all
          </Link>
        </div>
        <DashboardRecentTable
          items={data?.recent ?? []}
          baseHref="/incidents"
          emptyMessage="No recent incidents in scope."
        />
      </section>

      <section aria-labelledby="incidents-actions-heading">
        <h2
          id="incidents-actions-heading"
          className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3"
        >
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          {permissions.includes('incidents.create') && (
            <Link
              href="/incidents/new"
              className="h-9 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Report Incident
            </Link>
          )}
          <Link
            href="/incidents"
            className="h-9 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            All Incidents
          </Link>
        </div>
      </section>
    </div>
  );
}
