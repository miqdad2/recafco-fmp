import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { contractsApi } from '@/lib/contracts-api';
import type { ContractErectionStart, ContractErectionChecklist } from '@/lib/contracts-api';
import { getUserPermissions } from '../../../../../_lib/get-user-permissions';
import { isContractStaffOnlyAccess } from '../../../../../../_lib/module-visibility';
import { resolveErectionPreviewMode } from '../../../../../_lib/erection-preview';
import { ErectionChecklistPanel } from './_components/erection-checklist-panel';

export const metadata: Metadata = { title: 'Erection Checklist — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

const ERECTION_EVENT_PREFIX = 'erection_';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * CM-71G — Erection Workflow, Step 6: Erection Checklist. Contract-scoped,
 * at most one record per contract, same "create-once, edit-forever" shape
 * as Steps 1/3/4/5 — `checklist` is null on first visit, a real object once
 * "Save Draft" has been used at least once. `erectionStart` (Step 5) is
 * fetched read-only for its own guard/summary fields — never mutated from
 * this screen. Recent Activity shows both this step's own events and Step
 * 5's erection-start events, per this unit's own "Recent Activity sidebar
 * should show Step 6 activity AND relevant Step 5 erection start activity"
 * requirement.
 */
export default async function ErectionChecklistPage({ params, searchParams }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const search = await searchParams;

  const [permissions, contract, erectionStart, checklist, activities] = await Promise.all([
    getUserPermissions(),
    contractsApi.get(id).catch(() => null),
    contractsApi.getErectionStart(id).catch(() => null) as Promise<ContractErectionStart | null>,
    contractsApi.getErectionChecklist(id).catch(() => null) as Promise<ContractErectionChecklist | null>,
    contractsApi.listActivities(id).catch(() => []),
  ]);

  if (!permissions.includes('contracts.read') || !contract) notFound();

  const canUpdate = permissions.includes('contracts.update');
  const isStaffTier = isContractStaffOnlyAccess(permissions);
  const isPreviewMode = resolveErectionPreviewMode(permissions, search.preview);

  const recentActivity = activities
    .filter((a) => a.event.startsWith(ERECTION_EVENT_PREFIX) && (a.event.startsWith('erection_start_') || a.event.startsWith('erection_checklist_')))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <ErectionChecklistPanel
      contractId={id}
      erectionStart={erectionStart}
      checklist={checklist}
      contract={{ referenceNumber: contract.referenceNumber, title: contract.title, counterpartyName: contract.counterpartyName }}
      canUpdate={canUpdate}
      recentActivity={recentActivity}
      isStaffTier={isStaffTier}
      isPreviewMode={isPreviewMode}
    />
  );
}
