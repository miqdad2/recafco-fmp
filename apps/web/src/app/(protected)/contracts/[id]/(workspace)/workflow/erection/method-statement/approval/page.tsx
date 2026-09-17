import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { contractsApi } from '@/lib/contracts-api';
import type { ContractErectionMethodStatement, ContractErectionMethodStatementApproval } from '@/lib/contracts-api';
import { getUserPermissions } from '../../../../../../_lib/get-user-permissions';
import { isContractStaffOnlyAccess } from '../../../../../../../_lib/module-visibility';
import { resolveErectionPreviewMode } from '../../../../../../_lib/erection-preview';
import { ErectionMethodStatementApprovalPanel } from './_components/erection-method-statement-approval-panel';

export const metadata: Metadata = { title: 'Erection Method Statement Approval — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

const ERECTION_EVENT_PREFIX = 'erection_method_statement';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * CM-71C — Erection Workflow, Step 2: Erection Method Statement Approval.
 * `statement` (Step 1) is fetched read-only for its own display fields and
 * its submitted attachments; `approval` (Step 2) is null until "Save Draft"
 * is used at least once. "Submitted On" is derived from the real
 * `erection_method_statement_issued` ContractActivity row CM-71A already
 * logs — never fabricated; shown as "—" if that event hasn't happened yet.
 */
export default async function ErectionMethodStatementApprovalPage({ params, searchParams }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const search = await searchParams;

  const [permissions, contract, statement, approval, activities] = await Promise.all([
    getUserPermissions(),
    contractsApi.get(id).catch(() => null),
    contractsApi.getErectionMethodStatement(id).catch(() => null) as Promise<ContractErectionMethodStatement | null>,
    contractsApi.getErectionMethodStatementApproval(id).catch(() => null) as Promise<ContractErectionMethodStatementApproval | null>,
    contractsApi.listActivities(id).catch(() => []),
  ]);

  if (!permissions.includes('contracts.read') || !contract) notFound();

  const canUpdate = permissions.includes('contracts.update');
  const isStaffTier = isContractStaffOnlyAccess(permissions);
  const isPreviewMode = resolveErectionPreviewMode(permissions, search.preview);

  const issuedActivity = activities
    .filter((a) => a.event === 'erection_method_statement_issued')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const submittedOn = issuedActivity?.createdAt ?? null;

  const recentActivity = activities
    .filter((a) => a.event.startsWith(ERECTION_EVENT_PREFIX))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <ErectionMethodStatementApprovalPanel
      contractId={id}
      statement={statement}
      approval={approval}
      submittedOn={submittedOn}
      contract={{ referenceNumber: contract.referenceNumber, title: contract.title, counterpartyName: contract.counterpartyName }}
      canUpdate={canUpdate}
      recentActivity={recentActivity}
      isStaffTier={isStaffTier}
      isPreviewMode={isPreviewMode}
    />
  );
}
