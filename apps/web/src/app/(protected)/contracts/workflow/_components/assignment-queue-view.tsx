import { Breadcrumbs } from '../../../_components/breadcrumbs';
import { DashboardScopeBadge } from '../../../_components/dashboard-scope-badge';
import { contractsApi } from '../../../../../lib/contracts-api';
import { WorkflowModeTabs } from './workflow-mode-tabs';
import { AssignmentQueueSummaryCards } from './assignment-queue-summary-cards';
import { AssignmentQueueContractPicker } from './assignment-queue-contract-picker';
import { AssignmentQueueAdvancedFilters } from './assignment-queue-advanced-filters';
import { AssignmentQueueContractList } from './assignment-queue-contract-list';
import { AssignmentQueueBoardModal } from './assignment-queue-board-modal';
import { AssignmentQueueViewSwitcher } from './assignment-queue-view-switcher';
import { AssignmentQueueAdvancedSection } from './assignment-queue-advanced-section';
import { ContractsNeedingSetupSection } from './contracts-needing-setup-section';
import { groupAssignmentQueueByContract, getContractQueueItems } from '../../_lib/assignment-queue-grouping';

type PageSearchParams = Record<string, string | string[] | undefined>;

interface Props {
  searchParams: PageSearchParams;
}

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

/**
 * CM-40 — the Assignment Queue is a distinct view within the same
 * /contracts/workflow route (mode=assignment), not a new page: manager-only,
 * task-level (not contract-level), heading/subtitle/cards/filters/list are
 * all different from the "All Workflows" register rendered by page.tsx.
 * Dispatched from page.tsx before any of its existing logic runs, so the
 * default All Workflows / My Tasks / Overdue behavior is untouched.
 *
 * CM-40C — contract-first: by default this renders one card per contract
 * (AssignmentQueueContractList); selecting one (?contractId=...) swaps that
 * out for a focused, single-contract board (same items the queue API
 * already returned, filtered client-side to that contract — no extra
 * fetch). The old CM-40B all-contracts Board/Table view is preserved but
 * demoted to a collapsed "Advanced" section below the contract cards.
 *
 * CM-40D — "Search" is no longer a server-submitted filter: the module-level
 * query to getAssignmentQueue() now only ever carries the Advanced Filters
 * (team/department/manager/status/priority/dueDateMissing). Free-text search
 * is a live, client-side typeahead (AssignmentQueueContractPicker) over the
 * contract groups already fetched — no per-keystroke request, no Apply step.
 */
export async function AssignmentQueueView({ searchParams }: Props): Promise<React.JSX.Element> {
  const team = str(searchParams['team']);
  const departmentId = str(searchParams['departmentId']);
  const ownerUserId = str(searchParams['ownerUserId']);
  const status = str(searchParams['status']);
  const priority = str(searchParams['priority']);
  const dueDateMissing = str(searchParams['dueDateMissing']) === 'true';
  const selectedContractId = str(searchParams['contractId']);

  const hasActiveFilters = Boolean(team || departmentId || ownerUserId || status || priority || dueDateMissing);

  const [queueRes, deptsRes, peopleRes, dashboardRes] = await Promise.allSettled([
    contractsApi.getAssignmentQueue({
      ...(team ? { team } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(ownerUserId ? { ownerUserId } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(dueDateMissing ? { dueDateMissing } : {}),
    }),
    contractsApi.departments(),
    contractsApi.people(),
    contractsApi.dashboard(),
  ]);

  let error: string | null = null;
  const result = queueRes.status === 'fulfilled' ? queueRes.value : null;
  if (queueRes.status === 'rejected') {
    error = queueRes.reason instanceof Error ? queueRes.reason.message : 'Failed to load the assignment queue.';
  }

  const departments = deptsRes.status === 'fulfilled' ? deptsRes.value : [];
  const people = peopleRes.status === 'fulfilled' ? peopleRes.value : [];
  const scope = dashboardRes.status === 'fulfilled' ? dashboardRes.value.scope : undefined;

  const items = result?.items ?? [];
  const contractGroups = groupAssignmentQueueByContract(items);

  function buildAssignmentHref(overrides: Record<string, string | undefined>): string {
    const q = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      mode: 'assignment',
      team,
      departmentId,
      ownerUserId,
      status,
      priority,
      dueDateMissing: dueDateMissing ? 'true' : undefined,
      contractId: selectedContractId,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== '') q.set(k, v);
    }
    return `/contracts/workflow?${q.toString()}`;
  }

  // Base href for "no contract selected" with the current Advanced Filters
  // preserved — used both as "Back to Contracts" and, client-side, as the
  // prefix the contract picker appends &contractId=... to.
  const contractListHref = buildAssignmentHref({ contractId: undefined });

  // Selected-contract focused board — computed up front so the JSX below can
  // stay a simple "landing content always renders, modal overlays it when a
  // contract is selected" structure (CM-52C — previously the selected board
  // replaced the landing content entirely; now the landing cards/filters/
  // sections stay visible underneath the modal, matching CM-52's
  // WorkflowBoardModal pattern on the "All Workflows" page).
  let modalHeader: {
    contractId: string;
    contractReference: string;
    contractTitle: string;
    counterpartyName: string;
    unassignedCount: number;
  } | null = null;
  let modalBody: React.JSX.Element | null = null;
  let scopeError = false;

  if (selectedContractId) {
    const selectedItems = getContractQueueItems(items, selectedContractId);

    if (selectedItems.length > 0) {
      const first = selectedItems[0]!;
      modalHeader = {
        contractId: selectedContractId,
        contractReference: first.contractReference,
        contractTitle: first.contractTitle,
        counterpartyName: first.counterpartyName,
        unassignedCount: selectedItems.length,
      };
      modalBody = <AssignmentQueueViewSwitcher items={selectedItems} people={people} truncated={false} hideContractInfo />;
    } else {
      // Either every task on this contract is now assigned, or the id simply
      // isn't part of this actor's scope — getWorkflow() re-checks department
      // access itself (same guard as the "All Workflows" contractId board),
      // so this can never leak cross-department contract identity.
      const fallback = await contractsApi.getWorkflow(selectedContractId).catch(() => null);
      if (fallback) {
        modalHeader = {
          contractId: selectedContractId,
          contractReference: fallback.contract.referenceNumber,
          contractTitle: fallback.contract.title,
          counterpartyName: fallback.contract.counterpartyName,
          unassignedCount: 0,
        };
        modalBody = (
          <div className="rounded-lg border border-border bg-surface p-8 text-center">
            <p className="text-sm text-text-secondary">All workflow tasks for this contract are assigned.</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <a
                href={contractListHref}
                className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
              >
                Close
              </a>
              <a
                href={contractListHref}
                className="inline-flex items-center justify-center rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
              >
                Back to Contracts
              </a>
            </div>
          </div>
        );
      } else {
        // No real contract identity is available for the modal header in this
        // case (the fetch itself failed), so this stays a plain inline error
        // rather than being wrapped in the modal — never fabricate the
        // contract reference/name/client fields the modal header requires.
        scopeError = true;
      }
    }
  }

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1920px] mx-auto space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Contract Management', href: '/contracts/dashboard' },
          { label: 'Contract Work Progress', href: '/contracts/workflow' },
          { label: 'Assign Work' },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary tracking-tight">Assign Workflow Tasks</h1>
          <p className="mt-1.5 text-sm text-text-secondary max-w-2xl">
            Search a contract, then assign responsible users, due dates and priorities for its workflow tasks.
          </p>
        </div>
        <DashboardScopeBadge scope={scope} />
      </div>

      <WorkflowModeTabs active="assignment" canManage />

      <AssignmentQueueSummaryCards summary={result?.summary ?? null} />

      <AssignmentQueueContractPicker groups={contractGroups} baseHref={contractListHref} />

      <AssignmentQueueAdvancedFilters
        team={team}
        departmentId={departmentId}
        ownerUserId={ownerUserId}
        status={status}
        priority={priority}
        dueDateMissing={dueDateMissing}
        departments={departments}
        people={people}
        hasActiveFilters={hasActiveFilters}
      />

      {error && (
        <div className="rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {scopeError && (
        <div className="rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
          This contract is not available in your scope.{' '}
          <a href={contractListHref} className="font-medium underline">Back to Contracts</a>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Contracts needing assignment</h2>
        <AssignmentQueueContractList
          groups={contractGroups}
          buildAssignHref={(contractId) => buildAssignmentHref({ contractId })}
        />
      </div>

      <ContractsNeedingSetupSection contracts={result?.contractsNeedingSetup ?? []} />

      <AssignmentQueueAdvancedSection items={items} people={people} truncated={result?.truncated ?? false} />

      {modalHeader && modalBody && (
        <AssignmentQueueBoardModal
          contractId={modalHeader.contractId}
          contractReference={modalHeader.contractReference}
          contractTitle={modalHeader.contractTitle}
          counterpartyName={modalHeader.counterpartyName}
          unassignedCount={modalHeader.unassignedCount}
          closeHref={contractListHref}
        >
          {modalBody}
        </AssignmentQueueBoardModal>
      )}
    </div>
  );
}
