import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Printer, Pencil } from 'lucide-react';
import { DashboardScopeBadge } from '../../../_components/dashboard-scope-badge';
import { ContractLifecycleBadge } from '../../_components/contract-lifecycle-badge';
import { ContractDepartmentBadge } from '../../_components/contract-department-badge';
import { ContractWorkspaceTabs } from '../../_components/contract-workspace-tabs';
import { ContractDetailActionsMenu } from '../../_components/contract-detail-actions-menu';
import { contractsApi } from '../../../../../lib/contracts-api';
import { getUserPermissions } from '../../_lib/get-user-permissions';
import { isContractStaffOnlyAccess } from '../../../_lib/module-visibility';
import { scheduleStatusLabel, SCHEDULE_STATUS_BADGE_CLASSES } from '../../_lib/contract-ui-helpers';
import type { ContractScheduleStatusValue } from '../../_lib/contract-ui-helpers';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface LayoutProps {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export default async function ContractWorkspaceLayout({ params, children }: LayoutProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [permissionsRes, contractRes, dashboardRes, closeoutRequestsRes] = await Promise.allSettled([
    getUserPermissions(),
    contractsApi.get(id),
    contractsApi.dashboard(),
    // CM-69D — needed so the top-right Actions dropdown can correctly show
    // Request Closeout/Close Contract on every tab (not just Overview,
    // where page.tsx already fetches this same list for
    // ContractClosureAction). Same existing endpoint, no new backend call.
    contractsApi.listCloseoutRequests(id),
  ]);

  if (contractRes.status === 'rejected') notFound();

  const contract = (contractRes as PromiseFulfilledResult<Awaited<ReturnType<typeof contractsApi.get>>>).value;
  const viewerScope = dashboardRes.status === 'fulfilled' ? dashboardRes.value.scope : undefined;
  const closeoutRequests = closeoutRequestsRes.status === 'fulfilled' ? closeoutRequestsRes.value : [];
  const latestCloseoutRequest = closeoutRequests[0] ?? null;

  const permissions = permissionsRes.status === 'fulfilled' ? permissionsRes.value : [];

  // CM-44 — Contract Staff (contracts.workflow_update only, no update/close)
  // never see the manager's full contract detail — Payments, Claims,
  // Closeout, Issue Log, Attachments, Activity, etc. They only ever work
  // from My Tasks. This single redirect covers every workspace sub-route
  // (Schedule, Payments, Production, Variations, Claims, Risks, Documents,
  // Workflow, Issues, Attachments, Closeout, Activity) since they all share
  // this one layout — no per-tab hiding needed.
  if (isContractStaffOnlyAccess(permissions)) redirect('/contracts/workflow?mode=my-tasks');

  const canEdit = contract.status === 'DRAFT' && permissions.includes('contracts.update');

  // CM-57 — approved-design title: "<Job Order or Contract Reference> –
  // <Project Name>". Status badge prefers the manager-facing scheduleStatus
  // (never guessed — only ever an explicit stored value); falls back to the
  // real lifecycle status badge when nothing has been set, exactly as this
  // unit's task requires (not a guessed schedule value).
  const titleLead = contract.jobOrder?.trim() || contract.referenceNumber;

  return (
    // CM-66D — this workspace's breadcrumb now renders at top-header level
    // (see TopHeader / isContractWorkspaceDetailPath) instead of here, so
    // the page body starts directly with the contract title/status row.
    <div className="px-6 lg:px-8 py-6 max-w-[1800px] mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">
              {titleLead} – {contract.title}
            </h1>
            {contract.scheduleStatus ? (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SCHEDULE_STATUS_BADGE_CLASSES[contract.scheduleStatus as ContractScheduleStatusValue]}`}
              >
                {scheduleStatusLabel(contract.scheduleStatus)}
              </span>
            ) : (
              <ContractLifecycleBadge status={contract.lifecycleStatus} />
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
            <span>Contract ID: <span className="font-mono text-text-muted">{contract.referenceNumber}</span></span>
            <span>Created on: {formatDate(contract.createdAt)}</span>
            <span>Last Updated: {formatDate(contract.updatedAt)}</span>
            <ContractDepartmentBadge department={contract.department} />
            <DashboardScopeBadge scope={viewerScope} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <Link
              href={`/contracts/${contract.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              <Pencil className="size-3.5 shrink-0" aria-hidden="true" />
              Edit Contract
            </Link>
          )}
          <ContractDetailActionsMenu
            contractId={contract.id}
            status={contract.status}
            version={contract.version}
            permissions={permissions}
            latestCloseoutRequestId={latestCloseoutRequest?.id ?? null}
            latestCloseoutRequestStatus={latestCloseoutRequest?.status ?? null}
          />
          <button
            type="button"
            disabled
            title="Print / Export is planned for a future unit"
            className="inline-flex items-center gap-1.5 rounded-md bg-text-primary px-3 py-1.5 text-xs font-medium text-white opacity-60 cursor-not-allowed"
          >
            <Printer className="size-3.5 shrink-0" aria-hidden="true" />
            Print / Export
          </button>
        </div>
      </div>

      <ContractWorkspaceTabs contractId={contract.id} />

      {children}
    </div>
  );
}
