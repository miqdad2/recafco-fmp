import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { contractsApi } from '@/lib/contracts-api';
import type { ContractErectionDeliveryStart, ContractErectionStart } from '@/lib/contracts-api';
import { getUserPermissions } from '../../../../../_lib/get-user-permissions';
import { isContractStaffOnlyAccess } from '../../../../../../_lib/module-visibility';
import { resolveErectionPreviewMode } from '../../../../../_lib/erection-preview';
import { ErectionStartPanel } from './_components/erection-start-panel';

export const metadata: Metadata = { title: 'Erection Start — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

const ERECTION_EVENT_PREFIX = 'erection_';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * CM-71F — Erection Workflow, Step 5: Erection Start. Contract-scoped, at
 * most one record per contract, same "create-once, edit-forever" shape as
 * Steps 1/3/4 — `erectionStart` is null on first visit, a real object once
 * "Save Draft" has been used at least once. `deliveryStart` (Step 4) is
 * fetched read-only for its own guard/summary fields — never mutated from
 * this screen. Recent Activity shows both this step's own events and Step
 * 4's delivery events, per this unit's own "Recent Activity sidebar should
 * show Step 5 activity AND relevant Step 4 delivery start activity"
 * requirement.
 */
export default async function ErectionStartPage({ params, searchParams }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const search = await searchParams;

  const [permissions, contract, deliveryStart, erectionStart, activities] = await Promise.all([
    getUserPermissions(),
    contractsApi.get(id).catch(() => null),
    contractsApi.getErectionDeliveryStart(id).catch(() => null) as Promise<ContractErectionDeliveryStart | null>,
    contractsApi.getErectionStart(id).catch(() => null) as Promise<ContractErectionStart | null>,
    contractsApi.listActivities(id).catch(() => []),
  ]);

  if (!permissions.includes('contracts.read') || !contract) notFound();

  // CM-71H.7 — Step 5 (Erection Start) is Erection-Department-owned; the API
  // already accepts contracts.workflow_update for it (erection-department-
  // write-access.ts) — mirrored here so the assigned Erection Manager can
  // save it, not just view it. The backend still hard-blocks creating it
  // before Delivery Start (Step 4) is Started, for every viewer — the
  // panel's own prerequisite notice below explains that in advance.
  const canUpdate = permissions.includes('contracts.update') || permissions.includes('contracts.workflow_update');
  const isStaffTier = isContractStaffOnlyAccess(permissions);
  const isPreviewMode = resolveErectionPreviewMode(permissions, search.preview);

  const recentActivity = activities
    .filter((a) => a.event.startsWith(ERECTION_EVENT_PREFIX) && (a.event.includes('delivery_start') || (a.event.startsWith('erection_start_'))))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <ErectionStartPanel
      contractId={id}
      deliveryStart={deliveryStart}
      erectionStart={erectionStart}
      contract={{ referenceNumber: contract.referenceNumber, title: contract.title, counterpartyName: contract.counterpartyName }}
      canUpdate={canUpdate}
      recentActivity={recentActivity}
      isStaffTier={isStaffTier}
      isPreviewMode={isPreviewMode}
    />
  );
}
