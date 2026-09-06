import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { DashboardScopeBadge } from '../../_components/dashboard-scope-badge';
import { contractsApi } from '../../../../lib/contracts-api';
import { getCurrentUserContext } from '../_lib/get-user-permissions';
import { WorkflowSummaryCards } from './_components/workflow-summary-cards';
import { WorkflowFilterBar } from './_components/workflow-filter-bar';
import { WorkflowContractTable } from './_components/workflow-contract-table';
import { WorkflowBoardModal } from './_components/workflow-board-modal';
import { WorkflowPollingRefresher } from './_components/workflow-polling-refresher';
import { WorkflowModeTabs, type WorkflowModeTabKey } from './_components/workflow-mode-tabs';
import { AssignmentQueueView } from './_components/assignment-queue-view';
import { StaffMyTasksView } from './_components/staff-my-tasks-view';
import { isContractStaffOnlyAccess } from '../../_lib/module-visibility';

export const metadata: Metadata = { title: 'Contract Work Progress — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

type PageSearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams: Promise<PageSearchParams>;
}

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

export default async function ContractWorkflowPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const { id: currentUserId, permissions } = await getCurrentUserContext();
  if (!permissions.includes('contracts.read')) notFound();
  const canManage = permissions.includes('contracts.update');
  const canUpdateAssigned = permissions.includes('contracts.workflow_update');
  const isStaffOnly = isContractStaffOnlyAccess(permissions);

  const params = await searchParams;

  // CM-40 — mode=assignment (or the assignmentOnly=true alias) dispatches to
  // the manager-only Assignment Queue view entirely, before any of the
  // "All Workflows" logic below runs. Contract Staff hitting this URL
  // directly are redirected to My Tasks rather than shown a permission error
  // — they have no assignment work to do, but do have their own tasks.
  const modeParam = str(params['mode']);
  const isAssignmentMode = modeParam === 'assignment' || str(params['assignmentOnly']) === 'true';
  if (isAssignmentMode) {
    if (!canManage) redirect('/contracts/workflow?mode=my-tasks');
    return AssignmentQueueView({ searchParams: params });
  }

  // CM-44/CM-45 — Contract Staff never see the manager-facing "All Workflows"
  // register/board, even under mode=my-tasks or mode=overdue: dispatch
  // entirely to a simplified, staff-only, task-first view instead. Managers
  // and legacy Contract Management Users keep the exact mode=my-tasks /
  // overdueOnly=true behavior below, completely unchanged. Overdue is
  // checked first since a stale link combining both myTasksOnly and
  // overdueOnly (e.g. the dashboard's old "My Overdue Tasks" card) should
  // still land on the more specific Overdue view, not the full My Tasks list.
  const isOverdueMode = modeParam === 'overdue' || str(params['overdueOnly']) === 'true';
  const isMyTasksMode = modeParam === 'my-tasks' || str(params['myTasksOnly']) === 'true';
  if (isStaffOnly && (isOverdueMode || isMyTasksMode)) {
    return StaffMyTasksView({
      mode: isOverdueMode ? 'overdue' : 'my-tasks',
      taskId: str(params['taskId']),
      currentUserId: currentUserId ?? '',
    });
  }

  const search = str(params['search']);
  const status = str(params['status']);
  const departmentId = str(params['departmentId']);
  const ownerUserId = str(params['ownerUserId']);
  const workflowStatus = str(params['workflowStatus']);
  const team = str(params['team']);
  const taskStatus = str(params['taskStatus']);
  const responsibleUserId = str(params['responsibleUserId']);
  // CM-45 — mode=overdue is a thin alias over the existing overdueOnly
  // filter, same as mode=my-tasks is for myTasksOnly (only ever reached
  // here for non-staff actors, since staff dispatch to StaffMyTasksView
  // above short-circuits first).
  const overdueOnly = str(params['overdueOnly']) === 'true' || modeParam === 'overdue';
  // "My Tasks" mode is a thin alias over the existing myTasksOnly filter —
  // both continue to work, mode=my-tasks is just the tab's canonical link.
  const myTasksOnly = str(params['myTasksOnly']) === 'true' || modeParam === 'my-tasks';
  const contractId = str(params['contractId']);
  const page = str(params['page']) ? parseInt(str(params['page'])!, 10) : 1;
  const activeTabKey: WorkflowModeTabKey = myTasksOnly ? 'my-tasks' : overdueOnly ? 'overdue' : 'all';

  const hasActiveFilters = Boolean(
    search || status || departmentId || ownerUserId || workflowStatus || team ||
    taskStatus || responsibleUserId || overdueOnly || myTasksOnly,
  );

  const [listRes, deptsRes, peopleRes, dashboardRes, workflowRes] = await Promise.allSettled([
    contractsApi.listWorkflow({
      page,
      pageSize: 25,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(ownerUserId ? { ownerUserId } : {}),
      ...(workflowStatus ? { workflowStatus } : {}),
      ...(team ? { team } : {}),
      ...(taskStatus ? { taskStatus } : {}),
      ...(responsibleUserId ? { responsibleUserId } : {}),
      ...(overdueOnly ? { overdueOnly } : {}),
      ...(myTasksOnly ? { myTasksOnly } : {}),
    }),
    contractsApi.departments(),
    contractsApi.people(),
    contractsApi.dashboard(),
    contractId ? contractsApi.getWorkflow(contractId, { myTasksOnly }) : Promise.resolve(null),
  ]);

  let error: string | null = null;
  const result = listRes.status === 'fulfilled' ? listRes.value : null;
  if (listRes.status === 'rejected') {
    error = listRes.reason instanceof Error ? listRes.reason.message : 'Failed to load workflow data';
  }

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const summary = result?.summary ?? null;

  const departments = deptsRes.status === 'fulfilled' ? deptsRes.value : [];
  const people = peopleRes.status === 'fulfilled' ? peopleRes.value : [];
  const scope = dashboardRes.status === 'fulfilled' ? dashboardRes.value.scope : undefined;

  // A direct/stale link to a contract outside the actor's department scope fails here
  // (403/404 from the API) rather than ever rendering that contract's workflow.
  const workflowDetail = workflowRes.status === 'fulfilled' ? workflowRes.value : null;
  const workflowError = contractId && workflowRes.status === 'rejected'
    ? (workflowRes.reason instanceof Error ? workflowRes.reason.message : 'This contract is not available in your scope.')
    : null;

  function buildHref(overrides: Record<string, string | undefined>): string {
    const q = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      search, status, departmentId, ownerUserId, workflowStatus, team, taskStatus, responsibleUserId,
      overdueOnly: overdueOnly ? 'true' : undefined,
      myTasksOnly: myTasksOnly ? 'true' : undefined,
      contractId,
      page: page > 1 ? String(page) : undefined,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== '') q.set(k, v);
    }
    const s = q.toString();
    return s ? `/contracts/workflow?${s}` : '/contracts/workflow';
  }

  const generatedAt = new Date().toLocaleTimeString('en-GB');

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1920px] mx-auto space-y-6">
      {contractId && <WorkflowPollingRefresher />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary tracking-tight">Contract Work Progress</h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            Monitor contract tasks, assign work to staff, and follow delayed items.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DashboardScopeBadge scope={scope} />
          <span className="text-xs text-text-muted">Last updated {generatedAt}</span>
        </div>
      </div>

      <WorkflowModeTabs
        active={activeTabKey}
        canManage={canManage}
        hideAllWorkflows={isStaffOnly}
        {...(summary ? { myAssignedTaskCount: summary.myOpenTasks } : {})}
      />

      <WorkflowSummaryCards summary={summary} />

      <WorkflowFilterBar
        search={search}
        status={status}
        departmentId={departmentId}
        ownerUserId={ownerUserId}
        team={team}
        taskStatus={taskStatus}
        responsibleUserId={responsibleUserId}
        myTasksOnly={myTasksOnly}
        overdueOnly={overdueOnly}
        departments={departments}
        people={people}
        hasActiveFilters={hasActiveFilters}
      />

      {error && (
        <div className="rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <WorkflowContractTable items={items} selectedContractId={contractId} buildHref={buildHref} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>Showing {items.length} of {total}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <a href={buildHref({ page: String(page - 1) })} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:border-border-strong">
                Previous
              </a>
            )}
            {page < totalPages && (
              <a href={buildHref({ page: String(page + 1) })} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:border-border-strong">
                Next
              </a>
            )}
          </div>
        </div>
      )}

      {contractId && workflowError && (
        <div className="rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
          {workflowError}
        </div>
      )}
      {contractId && workflowDetail && (
        <WorkflowBoardModal
          contractId={contractId}
          detail={workflowDetail}
          closeHref={buildHref({ contractId: undefined })}
          people={people}
          canManage={canManage}
          canUpdateAssigned={canUpdateAssigned}
          currentUserId={currentUserId}
          {...(myTasksOnly ? { emptyMessage: 'No tasks assigned to you on this contract.' } : {})}
        />
      )}
    </div>
  );
}
