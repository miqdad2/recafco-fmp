import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DashboardScopeBadge } from '../../_components/dashboard-scope-badge';
import { contractsApi } from '../../../../lib/contracts-api';
import { getUserPermissions } from '../_lib/get-user-permissions';
import { GlobalScheduleKpiStrip } from './_components/global-schedule-kpi-strip';
import { GlobalSchedulePanel } from './_components/global-schedule-panel';

export const metadata: Metadata = { title: 'Schedule — RECAFCO FMP' };
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary tracking-tight">Schedule</h1>
          <p className="mt-1.5 text-sm text-text-secondary">Monitor planned vs actual progress across all contracts.</p>
          <p className="mt-1 text-xs text-text-muted">Planned = entered by manager. Actual = generated from system activity.</p>
        </div>
        <DashboardScopeBadge scope={scope} />
      </div>

      {error && (
        <div className="rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <GlobalScheduleKpiStrip summary={summary} />

      <GlobalSchedulePanel rows={rows} today={today} />
    </div>
  );
}
