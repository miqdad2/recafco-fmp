import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { incidentsApi } from '@/lib/incidents-api';
import type { IncidentDashboardData } from '@/lib/incidents-api';
import { authApi } from '@/lib/auth-api';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { ExecutiveModuleTitle } from '../../_components/executive-module-title';
import { ExecutiveKpiGrid } from '../../_components/executive-kpi-grid';
import { ExecutiveAttentionPanel } from '../../_components/executive-attention-panel';
import { ExecutiveQuickLinks } from '../../_components/executive-quick-links';
import { DashboardRecentTable } from '../../_components/dashboard-recent-table';

export const metadata: Metadata = { title: 'Incident Report — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-UI-07 — Executive Module Landing Page for Incident Report. Reuses the
 * exact same /incidents/dashboard data (incidentsApi.dashboard()) already
 * shown on the module's own operational dashboard — no new backend logic,
 * no fabricated figures. That operational dashboard stays untouched at its
 * own route; this page is the simplified senior-friendly front door the
 * Executive Dashboard's card and sidebar now link to.
 */
export default async function IncidentReportExecutivePage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult] = await Promise.allSettled([
    incidentsApi.dashboard(),
    authApi.me(accessToken),
  ]);

  const permissions: string[] =
    meResult.status === 'fulfilled' && meResult.value.ok ? meResult.value.data.permissions : [];
  if (!permissions.includes('incidents.read')) notFound();

  const data: IncidentDashboardData | null = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-6 lg:px-6">
      <ExecutiveModuleNav code="INCIDENT_REPORT" permissions={permissions} />

      <ExecutiveModuleTitle
        title="Incident Report"
        description="Report, investigate, and close out incidents and near-misses across the plant."
        icon={AlertTriangle}
        accent="incident"
      />

      {!data && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline — please try again shortly.
        </div>
      )}

      <section aria-labelledby="incidents-exec-kpi-heading" className="space-y-3">
        <h2 id="incidents-exec-kpi-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Summary
        </h2>
        <ExecutiveKpiGrid metrics={data?.metrics ?? {}} icon={AlertTriangle} />
      </section>

      <section aria-labelledby="incidents-exec-attention-heading" className="space-y-3">
        <h2 id="incidents-exec-attention-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Needs Attention
        </h2>
        <ExecutiveAttentionPanel
          available={data !== null}
          note="Not available — dashboard data could not be loaded."
          countItems={[{ label: 'incident(s) marked Critical and still open', value: data?.metrics.criticalOpen ?? 0, href: '/incidents?severity=CRITICAL' }]}
          emptyMessage="No incidents currently marked critical."
        />
      </section>

      <section aria-labelledby="incidents-exec-recent-heading" className="space-y-3">
        <h2 id="incidents-exec-recent-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Recent Activity
        </h2>
        <DashboardRecentTable items={data?.recent ?? []} baseHref="/incidents" emptyMessage="No recent incidents in scope." />
      </section>

      <section aria-labelledby="incidents-exec-quicklinks-heading" className="space-y-3">
        <h2 id="incidents-exec-quicklinks-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Quick Links
        </h2>
        <ExecutiveQuickLinks
          links={[
            { label: 'Operational Dashboard', href: '/incidents/dashboard' },
            { label: 'Open Incidents', href: '/incidents?status=open' },
            { label: 'Critical', href: '/incidents?severity=CRITICAL' },
          ]}
        />
      </section>

      <div className="pt-2">
        <Link
          href="/incidents"
          className="inline-flex h-12 items-center rounded-lg bg-accent px-6 text-base font-semibold text-accent-foreground transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
        >
          View Incidents
        </Link>
      </div>
    </div>
  );
}
