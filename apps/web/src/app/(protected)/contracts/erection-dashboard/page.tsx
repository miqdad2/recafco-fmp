import type { Metadata } from 'next';
import { contractsApi } from '@/lib/contracts-api';
import type { ErectionDashboardData } from '@/lib/contracts-api';
import { ErectionKpiGrid } from './_components/erection-kpi-grid';
import { ErectionWorkQueueTable } from './_components/erection-work-queue-table';
import {
  ErectionTodaysActionsPanel,
  ErectionPendingApprovalPanel,
  ErectionOverdueAttentionPanel,
  ErectionRecentActivityPanel,
} from './_components/erection-dashboard-panels';

export const metadata: Metadata = { title: 'Erection Manager Dashboard — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * CM-71B — Erection Manager Dashboard / Work Queue. Read-only view built
 * entirely on top of Contract, CM-71A's ContractErectionMethodStatement, the
 * existing generic ERECTION-team ContractWorkflowTask rows, and
 * ContractActivity — no new table, no quick-edit (every action links out to
 * the CM-71A Method Statement screen, per this unit's own "prefer links,
 * avoid dashboard quick-edit unless necessary" instruction). Visibility is
 * gated the same way the existing Contract Manager Dashboard is: the API's
 * own `contracts.read` permission check plus department-scoped filtering
 * (DepartmentAccessService, reused as-is) — no new role/permission was
 * added, per this unit's own "do not add a new role immediately" guidance.
 */
export default async function ErectionDashboardPage(): Promise<React.JSX.Element> {
  const data = (await contractsApi.erectionDashboard().catch(() => null)) as ErectionDashboardData | null;
  const status = data ? 'ok' : ('unavailable' as const);

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1920px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-text-primary tracking-tight">Erection Manager Dashboard</h1>
        <p className="mt-1.5 text-sm text-text-secondary max-w-3xl">
          Track erection method statements, schedule readiness, delivery dependency, erection start, checklist status, and pending actions.
        </p>
      </div>

      {!data && (
        <div className="rounded-md bg-error-light border border-error px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline or you may not have access.
        </div>
      )}

      <ErectionKpiGrid data={data} status={status} />

      {data && (
        <>
          <section>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Erection Work Queue</h2>
            <ErectionWorkQueueTable rows={data.workQueue} />
          </section>

          {data.workQueue.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
              <ErectionTodaysActionsPanel rows={data.todaysActions} />
              <ErectionPendingApprovalPanel rows={data.pendingApproval} />
              <ErectionOverdueAttentionPanel rows={data.overdueAttention} />
              <ErectionRecentActivityPanel rows={data.recentActivity} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
