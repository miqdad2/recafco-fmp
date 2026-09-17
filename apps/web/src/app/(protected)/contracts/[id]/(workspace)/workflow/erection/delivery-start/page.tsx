import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { contractsApi } from '@/lib/contracts-api';
import type { ContractErectionSchedule, ContractErectionDeliveryStart } from '@/lib/contracts-api';
import { getUserPermissions } from '../../../../../_lib/get-user-permissions';
import { isContractStaffOnlyAccess } from '../../../../../../_lib/module-visibility';
import { resolveErectionPreviewMode } from '../../../../../_lib/erection-preview';
import { ErectionDeliveryStartPanel } from './_components/erection-delivery-start-panel';

export const metadata: Metadata = { title: 'Delivery Start — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

const ERECTION_EVENT_PREFIX = 'erection_';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * CM-71E — Erection Workflow, Step 4: Delivery Start. Contract-scoped, at
 * most one record per contract, same "create-once, edit-forever" shape as
 * Steps 1/3 — `deliveryStart` is null on first visit, a real object once
 * "Save Draft" has been used at least once. `schedule` (Step 3) is fetched
 * read-only for its own guard/summary fields — never mutated from this
 * screen. Recent Activity shows both this step's own events and Step 3's
 * schedule events, per this unit's own "Recent Activity sidebar should show
 * Step 4 activity AND relevant Step 3 schedule activity" requirement.
 */
export default async function ErectionDeliveryStartPage({ params, searchParams }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const search = await searchParams;

  const [permissions, contract, schedule, deliveryStart, activities] = await Promise.all([
    getUserPermissions(),
    contractsApi.get(id).catch(() => null),
    contractsApi.getErectionSchedule(id).catch(() => null) as Promise<ContractErectionSchedule | null>,
    contractsApi.getErectionDeliveryStart(id).catch(() => null) as Promise<ContractErectionDeliveryStart | null>,
    contractsApi.listActivities(id).catch(() => []),
  ]);

  if (!permissions.includes('contracts.read') || !contract) notFound();

  const canUpdate = permissions.includes('contracts.update');
  const isStaffTier = isContractStaffOnlyAccess(permissions);
  const isPreviewMode = resolveErectionPreviewMode(permissions, search.preview);

  const recentActivity = activities
    .filter((a) => a.event.startsWith(ERECTION_EVENT_PREFIX) && (a.event.includes('schedule') || a.event.includes('delivery_start')))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <ErectionDeliveryStartPanel
      contractId={id}
      schedule={schedule}
      deliveryStart={deliveryStart}
      contract={{ referenceNumber: contract.referenceNumber, title: contract.title, counterpartyName: contract.counterpartyName }}
      canUpdate={canUpdate}
      recentActivity={recentActivity}
      isStaffTier={isStaffTier}
      isPreviewMode={isPreviewMode}
    />
  );
}
