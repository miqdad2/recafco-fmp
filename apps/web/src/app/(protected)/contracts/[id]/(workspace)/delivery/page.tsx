import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchBoqConfirmations } from '../../../../../../lib/technical-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { ContractDepartmentPanel } from '../../../_components/contract-department-panel';
import { deliveryStats, departmentLink } from '../../../_lib/contract-department-helpers';

export const metadata: Metadata = { title: 'Delivery — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/** FMP-CONTRACT-DETAIL-01 — Delivery tab (the Storage Yard & Delivery module keeps its name): read-only counts for THIS contract. */
export default async function ContractDeliveryTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const [permissions, items] = await Promise.all([getUserPermissions(), fetchBoqConfirmations(id)]);
  if (!permissions.includes('contracts.read')) notFound();

  return (
    <ContractDepartmentPanel
      title="Delivery"
      subtitle="Storage Yard and delivery progress of this contract's elements."
      stats={deliveryStats(items ?? [])}
      link={departmentLink('delivery', id, permissions)}
      loadError={items === null}
    />
  );
}
