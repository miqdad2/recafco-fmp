import type { Metadata } from 'next';
import Link from 'next/link';
import { FolderKanban, FileInput, ClipboardList, PackageCheck, Ruler } from 'lucide-react';
import { technicalApiFetchResult } from '@/lib/technical-api';
import type { TechnicalDashboardData } from '@/lib/technical-api';
import { RefreshButton } from './_components/refresh-button';
import { TechnicalProjectsList } from './_components/technical-projects-list';
import { DashboardKpiCard } from '../_components/dashboard-kpi-card';
import { buildOverviewRows, buildOverviewSummary, buildOverviewAttentionRows } from './_lib/technical-overview-helpers';

export const metadata: Metadata = { title: 'Technical Dashboard — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// FMP-TECH-17 — the Technical Dashboard is a common Technical Overview, read
// by managers, Contract Management, Production, Storage/Delivery, Erection and
// viewers as well as Technical staff. It answers: which projects are waiting
// for Technical work, which have BOQ drawings, which still need piece
// confirmation, which are ready for Production, and what needs attention.
// Frontend only — same single `GET /technical/dashboard` call, no new data.
// The actual Technical work (confirm pieces, groups, release) lives on the
// "Technical Details" page each row links to; nothing here updates data.
// ---------------------------------------------------------------------------

function errorMessage(status: number): string {
  if (status === 401) return 'Session expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to view Technical Dashboard.';
  return 'Technical dashboard data could not be loaded. Please try again.';
}

export default async function TechnicalDashboardPage(): Promise<React.JSX.Element> {
  const result = await technicalApiFetchResult<TechnicalDashboardData>('/technical/dashboard');
  const dashboard = result.data;
  const loadError = result.error;

  const rows = dashboard ? buildOverviewRows(dashboard.jobs, dashboard.releaseByContract ?? {}) : [];
  const summary = dashboard ? buildOverviewSummary(rows, dashboard.boqAttention) : null;
  const attentionRows = dashboard
    ? buildOverviewAttentionRows({
        boqAttention: dashboard.boqAttention,
        waitingApproval: dashboard.metrics.waitingApproval,
        releaseByContract: dashboard.releaseByContract ?? {},
      })
    : [];

  const kpis = [
    { label: 'Projects in Technical', value: summary?.projectsInTechnical, icon: FolderKanban, tone: 'neutral' as const },
    { label: 'Drawings Received', value: summary?.drawingsReceived, icon: FileInput, tone: 'neutral' as const },
    { label: 'Elements Not Confirmed', value: summary?.piecesNotConfirmed, icon: ClipboardList, tone: (summary?.piecesNotConfirmed ?? 0) > 0 ? ('warning' as const) : ('neutral' as const) },
    { label: 'Ready for Production', value: summary?.readyForProduction, icon: PackageCheck, tone: 'success' as const },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-5 py-5 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Ruler className="size-6 shrink-0 text-text-secondary" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Technical Dashboard</h1>
            <p className="mt-1 text-sm text-text-secondary">
              View BOQ drawings, element confirmation, drawing groups, and production release status.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <RefreshButton />
          <Link href="/dashboard" className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-text-secondary hover:bg-surface-secondary">
            Back to Platform Dashboard
          </Link>
          <Link href="/contracts" className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-text-secondary hover:bg-surface-secondary">
            View Contract List
          </Link>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          {errorMessage(loadError.status)}
        </div>
      )}

      <section aria-labelledby="technical-kpi-heading" className="space-y-3">
        <h2 id="technical-kpi-heading" className="sr-only">Summary</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <DashboardKpiCard
              key={kpi.label}
              label={kpi.label}
              value={dashboard ? kpi.value ?? 0 : null}
              icon={kpi.icon}
              tone={kpi.tone}
            />
          ))}
        </div>
      </section>

      {dashboard && <TechnicalProjectsList rows={rows} attentionRows={attentionRows} />}
    </div>
  );
}
