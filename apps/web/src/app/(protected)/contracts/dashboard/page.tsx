import type { Metadata } from 'next';
import { contractsApi } from '@/lib/contracts-api';
import type { ContractDashboardData } from '@/lib/contracts-api';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { DashboardToolbar } from './_components/dashboard-toolbar';
import { ContractKpiGrid } from './_components/contract-kpi-grid';
import { TopContractsPanels } from './_components/top-contracts-panels';

export const metadata: Metadata = { title: 'Contract Management Dashboard — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function ContractsDashboardPage(): Promise<React.JSX.Element> {
  const data: ContractDashboardData | null = await contractsApi.dashboard().catch(() => null);
  const status = data ? 'ok' : ('unavailable' as const);

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
          <h1 className="text-3xl font-semibold text-text-primary tracking-tight">Contract Management Dashboard</h1>
          <p className="mt-1.5 text-sm text-text-secondary max-w-2xl">
            Overview of current contracts in your scope.
          </p>
        </div>
      </div>

      {/* Top actions */}
      <DashboardToolbar scope={data?.scope} />

      {!data && (
        <div className="rounded-md bg-error-light border border-error px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline or you may not have access.
        </div>
      )}

      {/* A. Contract Summary cards */}
      <section aria-labelledby="contracts-kpi-heading">
        <h2 id="contracts-kpi-heading" className="text-base font-semibold text-text-primary mb-4">
          Contract Summary
        </h2>
        <ContractKpiGrid data={data} status={status} />
      </section>

      {/* B. Recently Updated Contracts */}
      <TopContractsPanels data={data} />
    </div>
  );
}
