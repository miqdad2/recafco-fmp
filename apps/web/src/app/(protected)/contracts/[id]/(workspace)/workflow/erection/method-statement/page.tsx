import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { contractsApi } from '@/lib/contracts-api';
import { getUserPermissions } from '../../../../../_lib/get-user-permissions';
import { isContractStaffOnlyAccess } from '../../../../../../_lib/module-visibility';
import { resolveErectionPreviewMode } from '../../../../../_lib/erection-preview';
import { ErectionMethodStatementPanel } from './_components/erection-method-statement-panel';

export const metadata: Metadata = { title: 'Issue Erection Method Statement — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

const ERECTION_METHOD_STATEMENT_EVENT_PREFIX = 'erection_method_statement_';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * CM-71A — Erection Workflow, Step 1: Issue Erection Method Statement.
 * Contract-scoped, at most one record per contract (see
 * ContractErectionMethodStatementService) — `statement` is null on first
 * visit, a real object once "Save Draft" has been used at least once.
 * Recent Activity reuses the existing ContractActivity log (CM-66),
 * filtered to this feature's own events — no new activity table.
 */
export default async function ErectionMethodStatementPage({ params, searchParams }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const search = await searchParams;

  const [permissions, contract, statement, activities] = await Promise.all([
    getUserPermissions(),
    contractsApi.get(id).catch(() => null),
    contractsApi.getErectionMethodStatement(id).catch(() => null),
    contractsApi.listActivities(id).catch(() => []),
  ]);

  if (!permissions.includes('contracts.read') || !contract) notFound();

  // CM-71H.7 — Step 1 (Issue Erection Method Statement) is Erection-
  // Department-owned; the API already accepts contracts.workflow_update for
  // it (erection-department-write-access.ts's own AnyPermission relaxation)
  // — this mirrors that on the frontend so the assigned Erection Manager can
  // actually save it, not just view it.
  const canUpdate = permissions.includes('contracts.update') || permissions.includes('contracts.workflow_update');
  const isStaffTier = isContractStaffOnlyAccess(permissions);
  const isPreviewMode = resolveErectionPreviewMode(permissions, search.preview);
  const recentActivity = activities
    .filter((a) => a.event.startsWith(ERECTION_METHOD_STATEMENT_EVENT_PREFIX))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <ErectionMethodStatementPanel
      contractId={id}
      statement={statement}
      contract={{ referenceNumber: contract.referenceNumber, title: contract.title, counterpartyName: contract.counterpartyName, jobOrderNo: contract.jobOrder ?? null }}
      canUpdate={canUpdate}
      recentActivity={recentActivity}
      isStaffTier={isStaffTier}
      isPreviewMode={isPreviewMode}
    />
  );
}
