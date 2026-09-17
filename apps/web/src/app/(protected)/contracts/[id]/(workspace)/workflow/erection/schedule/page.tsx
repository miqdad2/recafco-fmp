import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { contractsApi } from '@/lib/contracts-api';
import type { ContractErectionMethodStatement, ContractErectionMethodStatementApproval, ContractErectionSchedule } from '@/lib/contracts-api';
import { getUserPermissions } from '../../../../../_lib/get-user-permissions';
import { isContractStaffOnlyAccess } from '../../../../../../_lib/module-visibility';
import { resolveErectionPreviewMode } from '../../../../../_lib/erection-preview';
import { ErectionSchedulePanel } from './_components/erection-schedule-panel';

export const metadata: Metadata = { title: 'Issue Erection Schedule — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

const ERECTION_EVENT_PREFIX = 'erection_';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * CM-71D — Erection Workflow, Step 3: Issue Erection Schedule. Contract-
 * scoped, at most one record per contract, same "create-once, edit-forever"
 * shape as Step 1 — `schedule` is null on first visit, a real object once
 * "Save Draft" has been used at least once. `statement` (Step 1) and
 * `approval` (Step 2) are fetched read-only for their own guard/summary
 * fields — never mutated from this screen. Recent Activity shows both this
 * step's own events and Step 2's approval events, per this unit's own
 * "Recent Activity sidebar should show Step 3 activity AND relevant Step 2
 * approval activity" requirement.
 */
export default async function ErectionSchedulePage({ params, searchParams }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const search = await searchParams;

  const [permissions, contract, statement, approval, schedule, activities] = await Promise.all([
    getUserPermissions(),
    contractsApi.get(id).catch(() => null),
    contractsApi.getErectionMethodStatement(id).catch(() => null) as Promise<ContractErectionMethodStatement | null>,
    contractsApi.getErectionMethodStatementApproval(id).catch(() => null) as Promise<ContractErectionMethodStatementApproval | null>,
    contractsApi.getErectionSchedule(id).catch(() => null) as Promise<ContractErectionSchedule | null>,
    contractsApi.listActivities(id).catch(() => []),
  ]);

  if (!permissions.includes('contracts.read') || !contract) notFound();

  // CM-71H.7 — Step 3 (Issue Erection Schedule) is Erection-Department-
  // owned; the API already accepts contracts.workflow_update for it
  // (erection-department-write-access.ts) — mirrored here so the assigned
  // Erection Manager can save it, not just view it. The backend only
  // requires Step 1 to exist to create a schedule (it may legitimately be
  // prepared before Step 2 approval — see the panel's own InfoBox), so this
  // is never blocked behind approval status.
  const canUpdate = permissions.includes('contracts.update') || permissions.includes('contracts.workflow_update');
  const isStaffTier = isContractStaffOnlyAccess(permissions);
  const isPreviewMode = resolveErectionPreviewMode(permissions, search.preview);

  const recentActivity = activities
    .filter((a) => a.event.startsWith(ERECTION_EVENT_PREFIX) && (a.event.includes('method_statement_approval') || a.event.includes('schedule')))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <ErectionSchedulePanel
      contractId={id}
      statement={statement}
      approval={approval}
      schedule={schedule}
      contract={{ referenceNumber: contract.referenceNumber, title: contract.title, counterpartyName: contract.counterpartyName, jobOrderNo: contract.jobOrder ?? null }}
      canUpdate={canUpdate}
      recentActivity={recentActivity}
      isStaffTier={isStaffTier}
      isPreviewMode={isPreviewMode}
    />
  );
}
