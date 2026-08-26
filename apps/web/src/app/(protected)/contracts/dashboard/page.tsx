import type { Metadata } from 'next';
import { contractsApi } from '@/lib/contracts-api';
import type { ContractDashboardData } from '@/lib/contracts-api';
import { getUserPermissions } from '../_lib/get-user-permissions';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { DashboardToolbar } from './_components/dashboard-toolbar';
import { ContractKpiGrid } from './_components/contract-kpi-grid';
import { TopContractsPanels } from './_components/top-contracts-panels';
import { DashboardRecentTable } from '../../_components/dashboard-recent-table';
import { ManagerSummaryCards, SecondaryMetricsStrip } from './_components/manager-summary-cards';
import { TodaysFocusPanel } from './_components/todays-focus-panel';
import { ManagerAttentionTable } from './_components/manager-attention-table';
import { buildAttentionRows } from '../_lib/contract-dashboard-attention';
import { ManagerSecondaryTabs } from './_components/manager-secondary-tabs';
import { WorkflowOverviewPanel } from './_components/workflow-overview-panel';
import { UpcomingScheduleList } from './_components/upcoming-schedule-list';
import { StaffDashboardView } from './_components/staff-dashboard-view';

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

  const title = 'Contract Manager Dashboard';
  const subtitle = 'Create contracts, assign work, monitor risks and close contracts.';
  const needsAction = data?.manager?.attentionItems?.length;
  const attentionRows = buildAttentionRows(
    data?.manager?.attentionItems ?? [],
    data?.manager?.summary,
    data?.manager?.workflowOverview ?? [],
  );

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1920px] mx-auto space-y-8">
      <Breadcrumbs
        items={[
          { label: 'Contract Management', href: '/contracts/dashboard' },
          { label: 'Dashboard' },
        ]}
      />

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
          <TodaysFocusPanel summary={data?.manager?.summary} />

          <section aria-labelledby="manager-summary-heading">
            <h2 id="manager-summary-heading" className="sr-only">
              Contract Summary
            </h2>
            <ManagerSummaryCards summary={data?.manager?.summary} needsAction={needsAction} status={status} />
            <SecondaryMetricsStrip summary={data?.manager?.summary} />
          </section>

          <section id="priority-actions" aria-labelledby="attention-heading">
            <h2 id="attention-heading" className="text-base font-semibold text-text-primary">
              Priority Actions
            </h2>
            <p className="text-xs text-text-muted mb-2">Top items requiring manager review or follow-up.</p>
            <ManagerAttentionTable rows={attentionRows} />
          </section>

          <ManagerSecondaryTabs
            workflowLoad={<WorkflowOverviewPanel overview={data?.manager?.workflowOverview ?? []} />}
            upcoming={
              <UpcomingScheduleList
                items={data?.manager?.upcomingSchedule ?? []}
                emptyTitle="No upcoming schedule items in the selected period."
                emptyDescription="Workflow, payment, issue, claim and contract dates will appear here as they come due."
              />
            }
            recent={
              <DashboardRecentTable
                items={data?.recent.slice(0, 5) ?? []}
                baseHref="/contracts"
                emptyMessage="No contracts in scope."
              />
            }
          />
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
