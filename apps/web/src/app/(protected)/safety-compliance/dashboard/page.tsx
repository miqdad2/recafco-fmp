import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Clock,
} from 'lucide-react';
import { safetyApi } from '@/lib/safety-api';
import type { SafetyDashboardData } from '@/lib/safety-api';
import { authApi } from '@/lib/auth-api';
import { MetricCard } from '../../_components/metric-card';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { DashboardScopeBadge } from '../../_components/dashboard-scope-badge';
import { DashboardRecentTable } from '../../_components/dashboard-recent-table';

export const metadata: Metadata = { title: 'Safety & Compliance Dashboard — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function SafetyDashboardPage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult] = await Promise.allSettled([
    safetyApi.dashboard(),
    authApi.me(accessToken),
  ]);

  const data: SafetyDashboardData | null =
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
          { label: 'Safety & Compliance', href: '/safety-compliance/dashboard' },
          { label: 'Dashboard' },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Safety & Compliance</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Safety inspections, findings tracking, and compliance lifecycle management
          </p>
        </div>
        <DashboardScopeBadge scope={data?.scope} />
      </div>

      {!data && (
        <div className="rounded-md bg-error-light border border-error px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline or you may not have access.
        </div>
      )}

      <section aria-labelledby="safety-metrics-heading">
        <h2
          id="safety-metrics-heading"
          className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3"
        >
          Metrics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <MetricCard
            label="Scheduled Inspections"
            value={m?.scheduledInspections}
            icon={ShieldCheck}
            iconColor="text-info"
            href="/safety-compliance?status=SCHEDULED"
            status={s}
          />
          <MetricCard
            label="In Progress"
            value={m?.inProgressInspections}
            icon={Clock}
            iconColor="text-warning"
            href="/safety-compliance?status=IN_PROGRESS"
            status={s}
          />
          <MetricCard
            label="Open Findings"
            value={m?.openFindings}
            icon={AlertTriangle}
            iconColor="text-accent"
            href="/safety-compliance"
            status={s}
          />
          <MetricCard
            label="Critical Findings"
            value={m?.criticalFindings}
            icon={AlertOctagon}
            iconColor="text-danger"
            href="/safety-compliance"
            status={s}
          />
          <MetricCard
            label="Overdue Findings"
            value={m?.overdueFindings}
            icon={AlertTriangle}
            iconColor="text-warning"
            href="/safety-compliance"
            status={s}
          />
        </div>
      </section>

      <section aria-labelledby="safety-recent-heading">
        <div className="flex items-center justify-between mb-3">
          <h2
            id="safety-recent-heading"
            className="text-sm font-semibold text-text-secondary uppercase tracking-wide"
          >
            Recent Inspections
          </h2>
          <Link href="/safety-compliance" className="text-xs text-accent hover:underline">
            View all
          </Link>
        </div>
        <DashboardRecentTable
          items={data?.recent ?? []}
          baseHref="/safety-compliance"
          emptyMessage="No recent inspections in scope."
        />
      </section>

      <section aria-labelledby="safety-actions-heading">
        <h2
          id="safety-actions-heading"
          className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3"
        >
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          {permissions.includes('safety.create') && (
            <Link
              href="/safety-compliance/new"
              className="h-9 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
            >
              New Inspection
            </Link>
          )}
          <Link
            href="/safety-compliance"
            className="h-9 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            All Inspections
          </Link>
        </div>
      </section>
    </div>
  );
}
