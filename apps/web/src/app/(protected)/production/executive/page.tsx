import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Factory } from 'lucide-react';
import { productionApi } from '@/lib/production-api';
import type { ProductionDashboardData } from '@/lib/production-api';
import { authApi } from '@/lib/auth-api';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { ExecutiveModuleTitle } from '../../_components/executive-module-title';
import { ExecutiveKpiGrid } from '../../_components/executive-kpi-grid';
import { ExecutiveAttentionPanel } from '../../_components/executive-attention-panel';
import { ExecutiveQuickLinks } from '../../_components/executive-quick-links';
import { DashboardRecentTable } from '../../_components/dashboard-recent-table';

export const metadata: Metadata = { title: 'Production Planning — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-UI-07 — Executive Module Landing Page for Production Planning. Reuses
 * the exact same /production/dashboard data (productionApi.dashboard())
 * already shown on the module's own operational dashboard, which stays
 * untouched at its own route. No "delayed"/"at risk" order state exists yet
 * in the production data model, so Needs Attention says so honestly instead
 * of guessing.
 */
export default async function ProductionExecutivePage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult] = await Promise.allSettled([
    productionApi.dashboard(),
    authApi.me(accessToken),
  ]);

  const permissions: string[] =
    meResult.status === 'fulfilled' && meResult.value.ok ? meResult.value.data.permissions : [];
  if (!permissions.includes('production.read')) notFound();

  const data: ProductionDashboardData | null = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-6 lg:px-6">
      <ExecutiveModuleNav code="PRODUCTION_DASHBOARD" permissions={permissions} />

      <ExecutiveModuleTitle
        title="Production Planning"
        description="Production orders, schedules, and shop-floor readiness."
        icon={Factory}
        accent="production"
      />

      {!data && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline — please try again shortly.
        </div>
      )}

      <section aria-labelledby="production-exec-kpi-heading" className="space-y-3">
        <h2 id="production-exec-kpi-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Summary
        </h2>
        <ExecutiveKpiGrid metrics={data?.metrics ?? {}} icon={Factory} />
      </section>

      <section aria-labelledby="production-exec-attention-heading" className="space-y-3">
        <h2 id="production-exec-attention-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Needs Attention
        </h2>
        <ExecutiveAttentionPanel
          available={false}
          note="Not available yet — Production Planning does not yet track a delayed or at-risk order state."
        />
      </section>

      <section aria-labelledby="production-exec-recent-heading" className="space-y-3">
        <h2 id="production-exec-recent-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Recent Activity
        </h2>
        <DashboardRecentTable items={data?.recent ?? []} baseHref="/production" emptyMessage="No recent production orders in scope." />
      </section>

      <section aria-labelledby="production-exec-quicklinks-heading" className="space-y-3">
        <h2 id="production-exec-quicklinks-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Quick Links
        </h2>
        <ExecutiveQuickLinks
          links={[
            { label: 'Operational Dashboard', href: '/production/dashboard' },
            { label: 'Scheduled', href: '/production?status=SCHEDULED' },
            { label: 'In Progress', href: '/production?status=IN_PROGRESS' },
            { label: 'Paused', href: '/production?status=PAUSED' },
          ]}
        />
      </section>

      <div className="pt-2">
        <Link
          href="/production"
          className="inline-flex h-12 items-center rounded-lg bg-accent px-6 text-base font-semibold text-accent-foreground transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
        >
          View Production Orders
        </Link>
      </div>
    </div>
  );
}
