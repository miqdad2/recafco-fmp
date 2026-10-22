import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchBoqConfirmations, fetchBoqAttachments, fetchElementCoverage } from '../../../../../../lib/technical-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { ContractDepartmentPanel } from '../../../_components/contract-department-panel';
import { technicalStats, departmentLink } from '../../../_lib/contract-department-helpers';

export const metadata: Metadata = { title: 'Technical — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * FMP-CONTRACT-DETAIL-01 — Technical tab: read-only summary for THIS contract, from the existing Technical
 * endpoints. Anyone who can view the contract (contracts.read) sees the numbers; the link to the Technical
 * workflow appears only with that screen's own permission. No update action lives here.
 */
export default async function ContractTechnicalTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const [permissions, items, coverage, attachments] = await Promise.all([
    getUserPermissions(),
    fetchBoqConfirmations(id),
    fetchElementCoverage(id),
    fetchBoqAttachments(id),
  ]);
  if (!permissions.includes('contracts.read')) notFound();

  return (
    <ContractDepartmentPanel
      title="Technical"
      subtitle="Drawing and release progress of this contract's elements."
      stats={technicalStats(items ?? [], coverage?.elements ?? null, attachments ? attachments.length : null)}
      link={departmentLink('technical', id, permissions)}
      loadError={items === null}
    />
  );
}
