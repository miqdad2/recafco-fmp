import type { Metadata } from 'next';
import { contractsApi } from '@/lib/contracts-api';
import type { ContractDashboardData } from '@/lib/contracts-api';
import { getUserPermissions } from '../_lib/get-user-permissions';
import { DashboardToolbar } from './_components/dashboard-toolbar';
import { ContractKpiGrid } from './_components/contract-kpi-grid';
import { TopContractsPanels } from './_components/top-contracts-panels';
import { ManagerKpiGrid } from './_components/manager-kpi-grid';
import { DisciplineProgressPanel } from './_components/discipline-progress-panel';
import { FinancialPerformanceChart } from './_components/financial-performance-chart';
import { DonutChart } from './_components/donut-chart';
import { ManagementAttentionRequiredPanel } from './_components/management-attention-required-panel';
import { TopContractsTable } from './_components/top-contracts-table';
import { StaffDashboardView } from './_components/staff-dashboard-view';
import { buildContractsByStatusSegments, buildClaimsStatusSegments, formatKwdCompact } from './_lib/dashboard-insights-helpers';

export const metadata: Metadata = { title: 'Contract Management Dashboard — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function ContractsDashboardPage(): Promise<React.JSX.Element> {
  const [data, permissions] = await Promise.all([
    contractsApi.dashboard().catch(() => null) as Promise<ContractDashboardData | null>,
    getUserPermissions(),
  ]);
  const status = data ? 'ok' : ('unavailable' as const);
  const dashboardType = data?.dashboardType;
  const canCreate = permissions.includes('contracts.create');
  const canClose = permissions.includes('contracts.close');

  // CM-48 — Contract Staff gets a completely separate, single-window return
  // path (below) instead of sharing the scrolling-page layout every other
  // dashboardType renders — this keeps the MANAGER/legacy/unavailable tree
  // that follows byte-for-byte identical to before CM-48, since it's simply
  // never reached when dashboardType === 'STAFF'.
  if (dashboardType === 'STAFF' && data) {
    return <StaffDashboardView data={data} status={status} />;
  }

  // CM-54 — approved design: title/subtitle apply to this route regardless
  // of dashboardType (the fallback branch below is dead code for real
  // actors — computeContractDashboardType always resolves MANAGER or STAFF
  // — so this header text is effectively manager-only in practice).
  const title = 'Contract Management Dashboard';
  const subtitle = 'Real-time overview of all contracts, progress, financials and key alerts.';

  const insights = data?.manager?.insights;
  const contractsByStatus = data?.metrics ? buildContractsByStatusSegments(data.metrics) : [];
  const claimsByStatus = insights ? buildClaimsStatusSegments(insights.claimsByStatus) : [];

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1920px] mx-auto space-y-8">
      {/* Page title */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-text-secondary max-w-2xl">{subtitle}</p>
        </div>
      </div>

      {/* Top actions */}
      <DashboardToolbar scope={data?.scope} dashboardType={dashboardType} canCreate={canCreate} canClose={canClose} />

      {!data && (
        <div className="rounded-md bg-error-light border border-error px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline or you may not have access.
        </div>
      )}

      {dashboardType === 'MANAGER' && (
        <div className="space-y-5">
          <section aria-labelledby="manager-kpi-heading">
            <h2 id="manager-kpi-heading" className="sr-only">
              Contract Summary
            </h2>
            <ManagerKpiGrid data={data} status={status} />
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <DisciplineProgressPanel overview={data?.manager?.workflowOverview ?? []} />
            <FinancialPerformanceChart financials={insights?.financials} />
            <div className="space-y-1.5">
              <DonutChart title="Contracts by Status" segments={contractsByStatus} emptyMessage="No active working contracts found." />
              {/* CM-69H — a simple, optional audit note (not a full card, per
                  this unit's own "only if simple and not confusing" caution)
                  so cancelled contracts stay visible/known without being
                  counted into the working chart/totals above. */}
              {data?.metrics && data.metrics.totalCancelled > 0 && (
                <p className="text-xs text-text-muted px-1">
                  Cancelled Contracts: {data.metrics.totalCancelled} (excluded from working totals — view via Contract List, Lifecycle Status = Cancelled)
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
            <ManagementAttentionRequiredPanel summary={data?.manager?.summary} insights={insights} />
            <TopContractsTable
              title="Top 5 Delayed Contracts"
              metricColumnLabel="Delay (Days)"
              rows={(insights?.topDelayedContracts ?? []).map((r) => ({
                contractId: r.contractId, jobOrderLabel: r.jobOrderLabel, projectName: r.projectName, metricDisplay: String(r.delayDays),
              }))}
              emptyMessage="No delayed contracts in scope."
            />
            <TopContractsTable
              title="Top 5 Contracts by Value"
              metricColumnLabel="Value (KWD)"
              rows={(insights?.topValueContracts ?? []).map((r) => ({
                contractId: r.contractId, jobOrderLabel: r.jobOrderLabel, projectName: r.projectName, metricDisplay: formatKwdCompact(r.value, false),
              }))}
              emptyMessage="No contracts with a recorded value in scope."
            />
            <DonutChart title="Claims Status Overview" segments={claimsByStatus} emptyMessage="No claims in scope." />
          </div>
        </div>
      )}

      {!dashboardType && (
        <>
          <section aria-labelledby="contracts-kpi-heading">
            <h2 id="contracts-kpi-heading" className="text-base font-semibold text-text-primary mb-4">
              Contract Summary
            </h2>
            <ContractKpiGrid data={data} status={status} />
          </section>
          <TopContractsPanels data={data} />
        </>
      )}
    </div>
  );
}
