import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
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
  //
  // CM-71H.3 — EXCEPT the 6 guided erection workflow screens
  // (.../workflow/erection/...): CM-71A-H added those specifically so a
  // Contract-Staff-tier "Erection Manager" (see the ERECTION_MANAGER access
  // template, CM-71H.1) COULD reach them directly — this blanket redirect
  // (written years before those screens existed) was silently sending every
  // one of those users straight back to My Tasks before the guided page
  // itself ever got a chance to render, for every single step including
  // Step 1. The pathname is read from the `x-pathname` header proxy.ts now
  // forwards (a layout has no other way to see the current sub-route — only
  // `params`, which carries just the [id] segment). Every OTHER workspace
  // tab keeps the exact same redirect, unchanged.
  const pathname = (await headers()).get('x-pathname') ?? '';
  const isGuidedErectionRoute = pathname.includes('/workflow/erection/');
  const isStaffTier = isContractStaffOnlyAccess(permissions);
  if (isStaffTier && !isGuidedErectionRoute) {
    redirect('/contracts/workflow?mode=my-tasks');
  }

  // CM-71H.6 — a staff-tier (Erection Manager / Contract Staff) viewer on
  // one of the 6 guided erection screens gets a focused workspace: the
  // full Contract Detail header (title/status badges/Edit Contract/Actions
  // menu/Print-Export) and the full tab bar (Overview, Schedule, Payments,
  // Production, Variations, Claims, Risks, Documents, Workflow & Team
  // Tasks, Issues, Attachments, Activity, Closeout) never render for them —
  // those are manager-monitoring surfaces this viewer has no legitimate
  // reason to see (see this unit's own business rule). Each guided panel
  // already renders its own step title/status badge and Contract Summary
  // (ID/Name/Client) — see e.g. erection-method-statement-panel.tsx — so no
  // separate focused header needed here, just getting the manager chrome
  // out of the way. A manager-tier viewer (or a staff-tier viewer on any
  // OTHER route, which never reaches this point — they were redirected
  // above) always gets the exact same full layout as before, unchanged.
  const isFocusedErectionView = isStaffTier && isGuidedErectionRoute;
  if (isFocusedErectionView) {
    return (
      <div className="px-4 lg:px-6 py-4 max-w-[1900px] mx-auto">
        {children}
      </div>
    );
  }

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
