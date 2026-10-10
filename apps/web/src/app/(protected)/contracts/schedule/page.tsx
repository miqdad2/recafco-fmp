import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DashboardScopeBadge } from '../../_components/dashboard-scope-badge';
import { contractsApi } from '../../../../lib/contracts-api';
import { getUserPermissions } from '../_lib/get-user-permissions';
import { GlobalScheduleKpiStrip } from './_components/global-schedule-kpi-strip';
import { AdvancedPlanningPanel } from './_components/advanced-planning-panel';

export const metadata: Metadata = { title: 'Advanced Planning — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function ContractScheduleOverviewPage(): Promise<React.JSX.Element> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) notFound();

  const [overviewRes, dashboardRes] = await Promise.allSettled([
    contractsApi.getContractScheduleOverview(),
    contractsApi.dashboard(),
  ]);

  let error: string | null = null;
  const result = overviewRes.status === 'fulfilled' ? overviewRes.value : null;
  if (overviewRes.status === 'rejected') {
    error = overviewRes.reason instanceof Error ? overviewRes.reason.message : 'Failed to load schedule overview';
  }

  const rows = result?.rows ?? [];
  const summary = result?.summary ?? null;
  const scope = dashboardRes.status === 'fulfilled' ? dashboardRes.value.scope : undefined;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1920px] mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary tracking-tight">Advanced Planning Calendar</h1>
          <p className="mt-1.5 text-sm text-text-secondary">Plan upcoming contract milestones, team workload and delays across all active projects.</p>
          <p className="mt-2 inline-flex rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs text-text-muted">Planned = entered by manager · Actual = generated from system activity</p>
        </div>
        <DashboardScopeBadge scope={scope} />
      </div>

      {error && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <GlobalScheduleKpiStrip summary={summary} />

      <AdvancedPlanningPanel rows={rows} today={today} canEdit={permissions.includes('contracts.update')} />
    </div>
  );
}
