import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchBoqConfirmations } from '../../../../../../lib/technical-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { ContractDepartmentPanel } from '../../../_components/contract-department-panel';
import { erectionStats, departmentLink } from '../../../_lib/contract-department-helpers';

export const metadata: Metadata = { title: 'Erection — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/** FMP-CONTRACT-DETAIL-01 — Erection tab: read-only counts for THIS contract. The guided erection workflow pages are unchanged. */
export default async function ContractErectionTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const [permissions, items] = await Promise.all([getUserPermissions(), fetchBoqConfirmations(id)]);
  if (!permissions.includes('contracts.read')) notFound();

  return (
    <ContractDepartmentPanel
      title="Erection"
      subtitle="Erection progress of this contract's elements."
      stats={erectionStats(items ?? [])}
      link={departmentLink('erection', id, permissions)}
      loadError={items === null}
    />
  );
}
