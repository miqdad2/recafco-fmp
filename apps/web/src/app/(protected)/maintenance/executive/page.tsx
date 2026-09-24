import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { maintenanceApi } from '@/lib/maintenance-api';
import type { MrDashboardData } from '@/lib/maintenance-api';
import { authApi } from '@/lib/auth-api';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { ExecutiveModuleTitle } from '../../_components/executive-module-title';
import { ExecutiveKpiGrid } from '../../_components/executive-kpi-grid';
import { ExecutiveAttentionPanel } from '../../_components/executive-attention-panel';
import { ExecutiveQuickLinks } from '../../_components/executive-quick-links';
import { DashboardRecentTable } from '../../_components/dashboard-recent-table';

export const metadata: Metadata = { title: 'Maintenance Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-UI-07 — Executive Module Landing Page for Maintenance Management.
 * Reuses the exact same /maintenance/dashboard data (maintenanceApi.
 * dashboard()) already shown on the module's own operational dashboard,
 * which stays untouched at its own route — no new backend logic.
 */
export default async function MaintenanceExecutivePage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult] = await Promise.allSettled([
    maintenanceApi.dashboard(),
    authApi.me(accessToken),
  ]);

  const permissions: string[] =
    meResult.status === 'fulfilled' && meResult.value.ok ? meResult.value.data.permissions : [];
  if (!permissions.includes('maintenance.read')) notFound();

  const data: MrDashboardData | null = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-6 lg:px-6">
      <ExecutiveModuleNav code="MAINTENANCE_REQUESTS" permissions={permissions} />

      <ExecutiveModuleTitle
        title="Maintenance Management"
        description="Maintenance requests, work orders, and parts availability."
        icon={Wrench}
        accent="maintenance"
      />

      {!data && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline — please try again shortly.
        </div>
      )}

      <section aria-labelledby="maintenance-exec-kpi-heading" className="space-y-3">
        <h2 id="maintenance-exec-kpi-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Summary
        </h2>
        <ExecutiveKpiGrid metrics={data?.metrics ?? {}} icon={Wrench} />
      </section>

      <section aria-labelledby="maintenance-exec-attention-heading" className="space-y-3">
        <h2 id="maintenance-exec-attention-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Needs Attention
        </h2>
        <ExecutiveAttentionPanel
          available={data !== null}
          note="Not available — dashboard data could not be loaded."
          countItems={[
            { label: 'request(s) Overdue', value: data?.metrics.overdueRequests ?? 0, href: '/maintenance?overdue=true' },
            { label: 'request(s) Waiting for Parts', value: data?.metrics.waitingForParts ?? 0, href: '/maintenance?status=WAITING_FOR_PARTS' },
          ]}
          emptyMessage="No overdue requests or parts delays right now."
        />
      </section>

      <section aria-labelledby="maintenance-exec-recent-heading" className="space-y-3">
        <h2 id="maintenance-exec-recent-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Recent Activity
        </h2>
        <DashboardRecentTable items={data?.recent ?? []} baseHref="/maintenance" emptyMessage="No recent maintenance requests in scope." />
      </section>

      <section aria-labelledby="maintenance-exec-quicklinks-heading" className="space-y-3">
        <h2 id="maintenance-exec-quicklinks-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Quick Links
        </h2>
        <ExecutiveQuickLinks
          links={[
            { label: 'Operational Dashboard', href: '/maintenance/dashboard' },
            { label: 'Waiting for Parts', href: '/maintenance?status=WAITING_FOR_PARTS' },
            { label: 'Overdue Maintenance', href: '/maintenance?overdue=true' },
          ]}
        />
      </section>

      <div className="pt-2">
        <Link
          href="/maintenance"
          className="inline-flex h-12 items-center rounded-lg bg-accent px-6 text-base font-semibold text-accent-foreground transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
        >
          View Maintenance Requests
        </Link>
      </div>
    </div>
  );
}
