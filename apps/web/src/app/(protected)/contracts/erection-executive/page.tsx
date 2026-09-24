import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { HardHat } from 'lucide-react';
import { contractsApi } from '@/lib/contracts-api';
import type { ErectionDashboardData } from '@/lib/contracts-api';
import { authApi } from '@/lib/auth-api';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { ExecutiveModuleTitle } from '../../_components/executive-module-title';
import { ExecutiveKpiGrid } from '../../_components/executive-kpi-grid';
import { ExecutiveAttentionPanel } from '../../_components/executive-attention-panel';
import { ExecutiveQuickLinks } from '../../_components/executive-quick-links';

export const metadata: Metadata = { title: 'Erection — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-UI-07 — Executive Module Landing Page for Erection. Reuses the exact
 * same /contracts/erection/dashboard data (contractsApi.erectionDashboard())
 * the module's own Erection Manager Dashboard already computes (CM-71B) —
 * that page, and the full erection workflow it drives, stays completely
 * untouched at its own route (/contracts/erection-dashboard). This is a
 * separate, simplified landing page, not a replacement, so the existing
 * erection workflow can never be affected by it. Recent Activity uses its
 * own row shape (event/actorName/createdAt, not the standard reference/
 * title/status shape the other modules share), so it's rendered inline
 * rather than through DashboardRecentTable.
 */
export default async function ErectionExecutivePage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult] = await Promise.allSettled([
    contractsApi.erectionDashboard(),
    authApi.me(accessToken),
  ]);

  const permissions: string[] =
    meResult.status === 'fulfilled' && meResult.value.ok ? meResult.value.data.permissions : [];
  if (!permissions.includes('contracts.read')) notFound();

  const data: ErectionDashboardData | null = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
  // paymentPendingAfterErectionAvailable is a fixed `false` boolean flag, not a metric — excluded from the KPI grid.
  const kpiMetrics = data
    ? {
        totalErectionContracts: data.kpis.totalErectionContracts,
        methodStatementPending: data.kpis.methodStatementPending,
        submittedForApproval: data.kpis.submittedForApproval,
        readyForErection: data.kpis.readyForErection,
        erectionInProgress: data.kpis.erectionInProgress,
        delayedAttentionRequired: data.kpis.delayedAttentionRequired,
        checklistPending: data.kpis.checklistPending,
      }
    : {};

  const attentionRecords = data?.overdueAttention.slice(0, 5).map((row) => ({
    id: row.contractId,
    label: `${row.projectName} (${row.contractReference})`,
    description: row.nextAction.label,
    href: row.nextAction.href,
  }));

  const recentActivity = data?.recentActivity.slice(0, 10) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-6 lg:px-6">
      <ExecutiveModuleNav code="ERECTION" permissions={permissions} />

      <ExecutiveModuleTitle
        title="Erection"
        description="Site erection schedules, method statements, and checklist workflow."
        icon={HardHat}
        accent="erection"
      />

      {!data && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline — please try again shortly.
        </div>
      )}

      <section aria-labelledby="erection-exec-kpi-heading" className="space-y-3">
        <h2 id="erection-exec-kpi-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Summary
        </h2>
        <ExecutiveKpiGrid metrics={kpiMetrics} icon={HardHat} />
      </section>

      <section aria-labelledby="erection-exec-attention-heading" className="space-y-3">
        <h2 id="erection-exec-attention-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Needs Attention
        </h2>
        <ExecutiveAttentionPanel
          available={data !== null}
          note="Not available — dashboard data could not be loaded."
          recordItems={attentionRecords}
          emptyMessage="Nothing currently needs attention."
        />
      </section>

      <section aria-labelledby="erection-exec-recent-heading" className="space-y-3">
        <h2 id="erection-exec-recent-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Recent Activity
        </h2>
        {recentActivity.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
            No recent erection activity in scope.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {recentActivity.map((row) => (
              <li key={row.id} className="px-4 py-2.5 text-sm">
                <Link href={`/contracts/${row.contractId}`} className="flex flex-wrap items-baseline justify-between gap-2 hover:text-accent">
                  <span className="text-text-primary">
                    <span className="font-mono text-xs text-text-muted">{row.contractReference}</span>{' '}
                    {row.event}
                  </span>
                  <span className="text-xs text-text-muted whitespace-nowrap">
                    {row.actorName ?? 'System'} · {row.createdAt.slice(0, 10)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="erection-exec-quicklinks-heading" className="space-y-3">
        <h2 id="erection-exec-quicklinks-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Quick Links
        </h2>
        <ExecutiveQuickLinks links={[{ label: 'My Tasks', href: '/contracts/workflow?mode=my-tasks' }]} />
      </section>

      <div className="pt-2">
        <Link
          href="/contracts/erection-dashboard"
          className="inline-flex h-12 items-center rounded-lg bg-accent px-6 text-base font-semibold text-accent-foreground transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
        >
          View Erection Work Queue
        </Link>
      </div>
    </div>
  );
}
