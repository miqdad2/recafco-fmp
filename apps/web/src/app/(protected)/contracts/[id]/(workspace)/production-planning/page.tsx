import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchBoqConfirmations, fetchElementCoverage } from '../../../../../../lib/technical-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { ContractDepartmentPanel } from '../../../_components/contract-department-panel';
import { productionStats, departmentLink } from '../../../_lib/contract-department-helpers';

export const metadata: Metadata = { title: 'Production & Planning — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * FMP-CONTRACT-DETAIL-01 — Production & Planning tab: read-only element counts for THIS contract. The
 * older Production Status page (/contracts/:id/production) is unchanged and still reachable by URL.
 * The link opens the existing Production Work screen already filtered to this contract.
 */
export default async function ContractProductionPlanningTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const [permissions, items, coverage] = await Promise.all([getUserPermissions(), fetchBoqConfirmations(id), fetchElementCoverage(id)]);
  if (!permissions.includes('contracts.read')) notFound();

  return (
    <ContractDepartmentPanel
      title="Production & Planning"
      subtitle="Where this contract's elements are in production."
      stats={productionStats(items ?? [], coverage?.elements ?? null)}
      link={departmentLink('production', id, permissions)}
      loadError={items === null}
    />
  );
}
