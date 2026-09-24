import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { safetyApi } from '@/lib/safety-api';
import type { SafetyDashboardData } from '@/lib/safety-api';
import { authApi } from '@/lib/auth-api';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { ExecutiveModuleTitle } from '../../_components/executive-module-title';
import { ExecutiveKpiGrid } from '../../_components/executive-kpi-grid';
import { ExecutiveAttentionPanel } from '../../_components/executive-attention-panel';
import { ExecutiveQuickLinks } from '../../_components/executive-quick-links';
import { DashboardRecentTable } from '../../_components/dashboard-recent-table';

export const metadata: Metadata = { title: 'Safety & Compliance — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-UI-07 — Executive Module Landing Page for Safety & Compliance. Reuses
 * the exact same /safety-compliance/dashboard data (safetyApi.dashboard())
 * already shown on the module's own operational dashboard, which stays
 * untouched at its own route — no new backend logic, no fabricated figures.
 */
export default async function SafetyComplianceExecutivePage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult] = await Promise.allSettled([
    safetyApi.dashboard(),
    authApi.me(accessToken),
  ]);

  const permissions: string[] =
    meResult.status === 'fulfilled' && meResult.value.ok ? meResult.value.data.permissions : [];
  if (!permissions.includes('safety.read')) notFound();

  const data: SafetyDashboardData | null = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-6 lg:px-6">
      <ExecutiveModuleNav code="SAFETY_COMPLIANCE" permissions={permissions} />

      <ExecutiveModuleTitle
        title="Safety & Compliance"
        description="Safety inspections, findings, and corrective actions across the plant."
        icon={ShieldCheck}
        accent="safety"
      />

      {!data && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline — please try again shortly.
        </div>
      )}

      <section aria-labelledby="safety-exec-kpi-heading" className="space-y-3">
        <h2 id="safety-exec-kpi-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Summary
        </h2>
        <ExecutiveKpiGrid metrics={data?.metrics ?? {}} icon={ShieldCheck} />
      </section>

      <section aria-labelledby="safety-exec-attention-heading" className="space-y-3">
        <h2 id="safety-exec-attention-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Needs Attention
        </h2>
        <ExecutiveAttentionPanel
          available={data !== null}
          note="Not available — dashboard data could not be loaded."
          countItems={[
            { label: 'finding(s) marked Critical', value: data?.metrics.criticalFindings ?? 0, href: '/safety-compliance' },
            { label: 'finding(s) Overdue', value: data?.metrics.overdueFindings ?? 0, href: '/safety-compliance' },
          ]}
          emptyMessage="No critical or overdue findings right now."
        />
      </section>

      <section aria-labelledby="safety-exec-recent-heading" className="space-y-3">
        <h2 id="safety-exec-recent-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Recent Activity
        </h2>
        <DashboardRecentTable items={data?.recent ?? []} baseHref="/safety-compliance" emptyMessage="No recent safety records in scope." />
      </section>

      <section aria-labelledby="safety-exec-quicklinks-heading" className="space-y-3">
        <h2 id="safety-exec-quicklinks-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Quick Links
        </h2>
        <ExecutiveQuickLinks
          links={[
            { label: 'Operational Dashboard', href: '/safety-compliance/dashboard' },
            { label: 'Scheduled', href: '/safety-compliance?status=SCHEDULED' },
            { label: 'In Progress', href: '/safety-compliance?status=IN_PROGRESS' },
            { label: 'Completed', href: '/safety-compliance?status=COMPLETED' },
          ]}
        />
      </section>

      <div className="pt-2">
        <Link
          href="/safety-compliance"
          className="inline-flex h-12 items-center rounded-lg bg-accent px-6 text-base font-semibold text-accent-foreground transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
        >
          View Safety Records
        </Link>
      </div>
    </div>
  );
}
