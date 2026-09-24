import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Ruler } from 'lucide-react';
import { platformApi } from '@/lib/platform-api';
import { authApi } from '@/lib/auth-api';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { ExecutiveModuleTitle } from '../../_components/executive-module-title';
import { ExecutiveKpiGrid } from '../../_components/executive-kpi-grid';
import { ExecutiveAttentionPanel } from '../../_components/executive-attention-panel';
import { ExecutiveQuickLinks } from '../../_components/executive-quick-links';

export const metadata: Metadata = { title: 'Technical — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-UI-07 — Executive Module Landing Page for Technical. Technical has no
 * dedicated dashboard service (FMP-UI-01's own note: "no existing dashboard
 * service" — its 4 metrics are computed inline in PlatformDashboardService
 * over real TECHNICAL-team ContractWorkflowTask rows) and still has no
 * per-record activity feed, so this page reuses the same platform dashboard
 * endpoint the Executive Dashboard's own Technical card already calls for
 * its KPIs, and says plainly that Needs Attention / Recent Activity are not
 * available yet rather than inventing them. Replaces the FMP-UI-01
 * placeholder at this same route — the real TECHNICAL-team tasks remain
 * viewable and actionable today via each contract's own Workflow board,
 * linked below.
 */
export default async function ContractTechnicalPage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult] = await Promise.allSettled([
    platformApi.dashboard(),
    authApi.me(accessToken),
  ]);

  const permissions: string[] =
    meResult.status === 'fulfilled' && meResult.value.ok ? meResult.value.data.permissions : [];
  if (!permissions.includes('contracts.read')) notFound();

  const technicalCard =
    dashboardResult.status === 'fulfilled'
      ? dashboardResult.value.cards.find((c) => c.code === 'TECHNICAL')
      : undefined;

  const kpiMetrics = technicalCard
    ? Object.fromEntries(technicalCard.metrics.map((m) => [m.label, m.value]))
    : {};

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-6 lg:px-6">
      <ExecutiveModuleNav code="TECHNICAL" permissions={permissions} />

      <ExecutiveModuleTitle
        title="Technical"
        description="Shop drawings, structural calculations, and technical approvals for active contracts."
        icon={Ruler}
        accent="technical"
      />

      {!technicalCard && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline — please try again shortly.
        </div>
      )}

      <section aria-labelledby="technical-exec-kpi-heading" className="space-y-3">
        <h2 id="technical-exec-kpi-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Summary
        </h2>
        <ExecutiveKpiGrid metrics={kpiMetrics} icon={Ruler} />
      </section>

      <section aria-labelledby="technical-exec-attention-heading" className="space-y-3">
        <h2 id="technical-exec-attention-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Needs Attention
        </h2>
        <ExecutiveAttentionPanel available={false} note="Not available yet — coming next for the Technical module." />
      </section>

      <section aria-labelledby="technical-exec-recent-heading" className="space-y-3">
        <h2 id="technical-exec-recent-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Recent Activity
        </h2>
        <div className="rounded-lg border border-border bg-surface-secondary p-4 text-sm text-text-muted">
          Not available yet — a dedicated Technical activity feed is coming next. Technical workflow tasks (Drawing
          Received, SD &amp; Calculation Submission, Getting Approval, FD Issuance) are already tracked per contract
          today — open the Workflow board below to view and update them.
        </div>
      </section>

      <section aria-labelledby="technical-exec-quicklinks-heading" className="space-y-3">
        <h2 id="technical-exec-quicklinks-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Quick Links
        </h2>
        <ExecutiveQuickLinks links={[{ label: 'Contract List', href: '/contracts' }]} />
      </section>

      <div className="pt-2">
        <Link
          href="/contracts/workflow?team=TECHNICAL"
          className="inline-flex h-12 items-center rounded-lg bg-accent px-6 text-base font-semibold text-accent-foreground transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
        >
          View Technical Workflow
        </Link>
      </div>
    </div>
  );
}
