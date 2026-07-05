import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FileText,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
} from 'lucide-react';
import { contractsApi } from '@/lib/contracts-api';
import type { ContractDashboardData } from '@/lib/contracts-api';
import { authApi } from '@/lib/auth-api';
import { MetricCard } from '../../_components/metric-card';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { DashboardScopeBadge } from '../../_components/dashboard-scope-badge';
import { DashboardRecentTable } from '../../_components/dashboard-recent-table';

export const metadata: Metadata = { title: 'Contracts Management Dashboard — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function ContractsDashboardPage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult] = await Promise.allSettled([
    contractsApi.dashboard(),
    authApi.me(accessToken),
  ]);

  const data: ContractDashboardData | null =
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
          { label: 'Contracts Management', href: '/contracts/dashboard' },
          { label: 'Dashboard' },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Contracts Management</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Vendor contract register with lifecycle tracking and approval workflow
          </p>
        </div>
        <DashboardScopeBadge scope={data?.scope} />
      </div>

      {!data && (
        <div className="rounded-md bg-error-light border border-error px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline or you may not have access.
        </div>
      )}

      <section aria-labelledby="contracts-metrics-heading">
        <h2
          id="contracts-metrics-heading"
          className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3"
        >
          Metrics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            label="Active"
            value={m?.totalActive}
            icon={FileText}
            iconColor="text-success"
            href="/contracts?lifecycleStatus=ACTIVE"
            status={s}
          />
          <MetricCard
            label="Expiring Soon"
            value={m?.totalExpiring}
            icon={AlertTriangle}
            iconColor="text-warning"
            href="/contracts?lifecycleStatus=EXPIRING"
            status={s}
          />
          <MetricCard
            label="Expired"
            value={m?.totalExpired}
            icon={AlertOctagon}
            iconColor="text-danger"
            href="/contracts?lifecycleStatus=EXPIRED"
            status={s}
          />
          <MetricCard
            label="Draft"
            value={m?.totalDraft}
            icon={FileText}
            iconColor="text-text-secondary"
            href="/contracts?status=DRAFT"
            status={s}
          />
          <MetricCard
            label="Terminated"
            value={m?.totalTerminated}
            icon={FileText}
            iconColor="text-error"
            href="/contracts?status=TERMINATED"
            status={s}
          />
          <MetricCard
            label="Closed"
            value={m?.totalClosed}
            icon={CheckCircle2}
            iconColor="text-text-muted"
            href="/contracts?status=CLOSED"
            status={s}
          />
        </div>
      </section>

      <section aria-labelledby="contracts-recent-heading">
        <div className="flex items-center justify-between mb-3">
          <h2
            id="contracts-recent-heading"
            className="text-sm font-semibold text-text-secondary uppercase tracking-wide"
          >
            Recent Contracts
          </h2>
          <Link href="/contracts" className="text-xs text-accent hover:underline">
            View all
          </Link>
        </div>
        <DashboardRecentTable
          items={data?.recent ?? []}
          baseHref="/contracts"
          emptyMessage="No recent contracts in scope."
        />
      </section>

      <section aria-labelledby="contracts-actions-heading">
        <h2
          id="contracts-actions-heading"
          className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3"
        >
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          {permissions.includes('contracts.create') && (
            <Link
              href="/contracts/new"
              className="h-9 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
            >
              New Contract
            </Link>
          )}
          <Link
            href="/contracts"
            className="h-9 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            All Contracts
          </Link>
        </div>
      </section>
    </div>
  );
}
