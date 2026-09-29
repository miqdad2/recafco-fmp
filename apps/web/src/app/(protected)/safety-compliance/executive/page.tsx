import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck,
  ClipboardCheck,
  Clock,
  AlertTriangle,
  AlertOctagon,
  CalendarClock,
  CheckCircle2,
} from 'lucide-react';
import { safetyApi } from '@/lib/safety-api';
import type { SafetyDashboardData } from '@/lib/safety-api';
import { authApi } from '@/lib/auth-api';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { ExecutiveModuleTitle } from '../../_components/executive-module-title';
import { MetricCard } from '../../_components/metric-card';
import type { MetricStatus } from '../../_components/metric-card';
import { SafetyNeedsAttentionList } from '../_components/safety-needs-attention-list';
import { SafetyLatestRecordsList } from '../_components/safety-latest-records-list';

export const metadata: Metadata = { title: 'Safety & Compliance — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-UI-21 — Safety Control Center. Replaces the old Executive Module
 * Landing Page for Safety & Compliance (a generic Summary KPI grid + a
 * counts-only Needs Attention panel + Recent Activity + Quick Links + a
 * single "View Safety Records" button — the exact "current issue"
 * reported: it never clearly guided anyone to create an inspection, record
 * a finding, or see what actually needs action) with a genuinely
 * operational hub, per this unit's own brief.
 *
 * Same route (`/safety-compliance/executive`), same access rule
 * (`safety.read`), same `safetyApi.dashboard()` call as before — every
 * number is real. New:
 *   - "+ New Safety Inspection" (gated `safety.create`) and "View Safety
 *     Records" as prominent top actions. NO "Record Finding" button here —
 *     audited and confirmed findings can only be created from within a
 *     specific inspection's own detail page (`POST /:id/findings`, gated
 *     `safety.finding_create`, only once that inspection is IN_PROGRESS or
 *     COMPLETED) — there is no standalone/global route to record a finding
 *     without first choosing which inspection it belongs to. Per this
 *     unit's own instruction ("if Record Finding does not exist yet, do
 *     not fake it"), no button is shown; see this unit's own
 *     progress-tracker entry for the full audit result.
 *   - 6 overview cards (Scheduled / In Progress / Open Findings / Critical
 *     Findings / Overdue Findings / Completed) from `data.metrics` — all 6
 *     fields already existed on `getDashboard()` before this unit.
 *   - Needs Attention now shows REAL per-finding records (reference number,
 *     title, severity/status badges, due date, an explicit "Open Record"
 *     button) via the new `data.needsAttention` array — a genuinely new,
 *     minimal, additive query in `safety.service.ts`'s `getDashboard()`
 *     (no schema change). The old panel only ever showed 2 counts.
 *   - Recent Activity is removed entirely, per this unit's own "Preferred"
 *     instruction — it only ever showed generic recent inspections, not
 *     human-readable safety updates, and duplicated what the overview
 *     cards + Needs Attention already surface.
 *   - Quick Links replaced with Quick Filters (Scheduled / In Progress /
 *     Completed / Open Findings) — same 4 destinations the old Quick Links
 *     had (minus the redundant "Operational Dashboard" link to the
 *     module's OTHER dashboard page, which this page's own nav row already
 *     supersedes), restyled as filter chips rather than a link list.
 *
 * FMP-UI-21D — per direct feedback that the dashboard "feels unfinished"
 * and has "too much empty space":
 *   - Overview cards split into 2 labeled sub-groups (Inspections /
 *     Findings) for clearer visual hierarchy — same 6 cards, same data,
 *     just grouped by what they're actually counting.
 *   - Quick Filters REMOVED entirely — the brief's own "Preferred" option,
 *     since every one of its 4 links was already a duplicate of "View
 *     Safety Records" (a pre-filtered view of the exact same list). This
 *     also directly addresses "no large empty gaps": that whole section
 *     was the loneliest part of the old page.
 *   - New "Latest Safety Records" section (max 3, via `data.recent`,
 *     already fetched by the same `safetyApi.dashboard()` call — no new
 *     request) fills the space Quick Filters used to occupy with real,
 *     useful data instead: reference number, title, status, department,
 *     scheduled date, and an "Open Record" button per row.
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
  const canCreate = permissions.includes('safety.create');
  const metricsStatus: MetricStatus = data ? 'ok' : 'unavailable';

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-6 lg:px-6">
      <ExecutiveModuleNav code="SAFETY_COMPLIANCE" permissions={permissions} />

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm lg:p-6">
        <ExecutiveModuleTitle
          title="Safety & Compliance"
          description="Manage safety inspections, findings, corrective actions, and compliance status."
          icon={ShieldCheck}
          accent="safety"
          actions={
            <>
              {canCreate && (
                <Link
                  href="/safety-compliance/new"
                  className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  + New Safety Inspection
                </Link>
              )}
              <Link
                href="/safety-compliance"
                className="inline-flex items-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
              >
                View Safety Records
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
        <div className="space-y-3">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">Inspections</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MetricCard
                label="Scheduled Inspections" value={data?.metrics.scheduledInspections} icon={ClipboardCheck} iconColor="text-info"
                href="/safety-compliance?status=SCHEDULED" status={metricsStatus} dense
              />
              <MetricCard
                label="In Progress" value={data?.metrics.inProgressInspections} icon={Clock} iconColor="text-warning"
                href="/safety-compliance?status=IN_PROGRESS" status={metricsStatus} dense
              />
              <MetricCard
                label="Completed Inspections" value={data?.metrics.completedInspections} icon={CheckCircle2} iconColor="text-success"
                href="/safety-compliance?status=COMPLETED" status={metricsStatus} dense
              />
            </div>
          </div>
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">Findings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MetricCard
                label="Open Findings" value={data?.metrics.openFindings} icon={AlertTriangle} iconColor="text-accent"
                href="/safety-compliance" status={metricsStatus} dense
              />
              <MetricCard
                label="Critical Findings" value={data?.metrics.criticalFindings} icon={AlertOctagon} iconColor="text-danger"
                href="/safety-compliance" status={metricsStatus} dense
              />
              <MetricCard
                label="Overdue Findings" value={data?.metrics.overdueFindings} icon={CalendarClock} iconColor="text-warning"
                href="/safety-compliance" status={metricsStatus} dense
              />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="safety-attention-heading" className="space-y-3">
        <h2 id="safety-attention-heading" className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Needs Attention
        </h2>
        {data ? (
          <SafetyNeedsAttentionList items={data.needsAttention ?? []} />
        ) : (
          <div className="rounded-lg border border-border bg-surface-secondary p-4 text-sm text-text-muted">
            Not available — dashboard data could not be loaded.
          </div>
        )}
      </section>

      <section aria-labelledby="safety-latest-heading" className="space-y-3">
        <h2 id="safety-latest-heading" className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Latest Safety Records
        </h2>
        {data ? (
          <SafetyLatestRecordsList items={data.recent} canCreate={canCreate} />
        ) : (
          <div className="rounded-lg border border-border bg-surface-secondary p-4 text-sm text-text-muted">
            Not available — dashboard data could not be loaded.
          </div>
        )}
      </section>
    </div>
  );
}
