import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, AlertOctagon, Search, CheckCircle2, Archive } from 'lucide-react';
import { incidentsApi } from '@/lib/incidents-api';
import type { IncidentDashboardData } from '@/lib/incidents-api';
import { authApi } from '@/lib/auth-api';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { ExecutiveModuleTitle } from '../../_components/executive-module-title';
import { MetricCard } from '../../_components/metric-card';
import type { MetricStatus } from '../../_components/metric-card';
import { IncidentNeedsAttentionList } from '../_components/incident-needs-attention-list';
import { IncidentRecentList } from '../_components/incident-recent-list';

export const metadata: Metadata = { title: 'Incident Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-UI-22 — Incident Control Center. Replaces the old Executive Module
 * Landing Page for Incident Report (a generic Summary KPI grid + a
 * counts-only Needs Attention panel + Recent Activity + Quick Links + a
 * single "View Incidents" button — the same "current issue" already fixed
 * for Task Management (FMP-UI-20) and Safety & Compliance (FMP-UI-21):
 * it never clearly guided anyone to report an incident, see what needs
 * urgent attention, or find the latest reports) with a genuinely
 * operational hub, per this unit's own brief.
 *
 * Same route (`/incidents/executive`), same access rule (`incidents.read`),
 * same `incidentsApi.dashboard()` call as before — every number is real.
 *   - "+ Report Incident" (gated `incidents.create`, → `/incidents/new`)
 *     and "All Incidents" (→ `/incidents`) as prominent top actions.
 *   - 5 overview cards (Open Incidents / Critical Open / Under
 *     Investigation / Resolved This Month / Closed Total) from
 *     `data.metrics` — all 5 fields already existed on `getDashboard()`;
 *     Closed Total included since the brief allows it "if useful" and the
 *     figure was already computed and shown pre-FMP-UI-22.
 *   - Needs Attention now shows REAL per-incident records (reference,
 *     title, severity/status badges, reported date/time, "Open Incident")
 *     via the new `data.needsAttention` array — a minimal, additive query
 *     in `incidents.service.ts`'s `getDashboard()` (no schema change),
 *     matching the identical fix already made for Safety (FMP-UI-21).
 *     Scoped to critical-AND-open incidents only — Incidents have no
 *     due-date field of their own, so no "overdue incident" concept was
 *     invented.
 *   - Recent Activity replaced with "Recent Incidents" (max 3, via
 *     `data.recent`, extended with `severity`/`createdAt` — no new
 *     request).
 *   - Quick Links replaced with 2 non-duplicate filter shortcuts (Open
 *     Incidents / Critical) placed right next to the Recent Incidents
 *     heading — "+ Report Incident"/"All Incidents" are NOT repeated here
 *     since they're already the header's own actions, per this unit's own
 *     "avoid duplicate links" instruction.
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
  const canCreate = permissions.includes('incidents.create');
  const metricsStatus: MetricStatus = data ? 'ok' : 'unavailable';

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-6 lg:px-6">
      <ExecutiveModuleNav code="INCIDENT_REPORT" permissions={permissions} />

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm lg:p-6">
        <ExecutiveModuleTitle
          title="Incident Management"
          description="Report, investigate, track, and close incidents and near-misses."
          icon={AlertTriangle}
          accent="incident"
          actions={
            <>
              {canCreate && (
                <Link
                  href="/incidents/new"
                  className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  + Report Incident
                </Link>
              )}
              <Link
                href="/incidents"
                className="inline-flex items-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
              >
                All Incidents
              </Link>
            </>
          }
        />
      </div>

      {!data && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline — please try again shortly.
        </div>
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <MetricCard
            label="Open Incidents" value={data?.metrics.totalOpen} icon={AlertTriangle} iconColor="text-accent"
            href="/incidents?status=open" status={metricsStatus} dense
          />
          <MetricCard
            label="Critical Open" value={data?.metrics.criticalOpen} icon={AlertOctagon} iconColor="text-danger"
            href="/incidents?severity=CRITICAL" status={metricsStatus} dense
          />
          <MetricCard
            label="Under Investigation" value={data?.metrics.underInvestigation} icon={Search} iconColor="text-warning"
            href="/incidents?status=INVESTIGATION" status={metricsStatus} dense
          />
          <MetricCard
            label="Resolved This Month" value={data?.metrics.resolvedThisMonth} icon={CheckCircle2} iconColor="text-success"
            href="/incidents?status=RESOLVED" status={metricsStatus} dense
          />
          <MetricCard
            label="Closed Total" value={data?.metrics.closedTotal} icon={Archive} iconColor="text-text-secondary"
            href="/incidents?status=CLOSED" status={metricsStatus} dense
          />
        </div>
      </section>

      <section aria-labelledby="incidents-attention-heading" className="space-y-3">
        <h2 id="incidents-attention-heading" className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Needs Attention
        </h2>
        {data ? (
          <IncidentNeedsAttentionList items={data.needsAttention} />
        ) : (
          <div className="rounded-lg border border-border bg-surface-secondary p-4 text-sm text-text-muted">
            Not available — dashboard data could not be loaded.
          </div>
        )}
      </section>

      <section aria-labelledby="incidents-recent-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="incidents-recent-heading" className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Recent Incidents
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/incidents?status=open"
              className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              Open Incidents
            </Link>
            <Link
              href="/incidents?severity=CRITICAL"
              className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              Critical
            </Link>
          </div>
        </div>
        {data ? (
          <IncidentRecentList items={data.recent} canCreate={canCreate} />
        ) : (
          <div className="rounded-lg border border-border bg-surface-secondary p-4 text-sm text-text-muted">
            Not available — dashboard data could not be loaded.
          </div>
        )}
      </section>
    </div>
  );
}
