import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Info } from 'lucide-react';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { ContractDocumentKpiStrip } from './_components/contract-document-kpi-strip';
import { ContractDocumentPanel } from './_components/contract-document-panel';

export const metadata: Metadata = { title: 'Documents & Obligations — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * CM-63 — Contract Detail Documents & Obligations, approved-design build.
 * Tracks required contract documents, certificates, submissions,
 * guarantees, and approvals (Performance Bond, Insurance, Advance Payment
 * Guarantee, Tax Clearance Certificate, Method Statement, Shop Drawings
 * Approval, Environmental Approval, Safety Plan, etc.) with real supporting
 * file uploads. `status` is always a plain manual selection — Days
 * Remaining and the Expiring Soon / Expired-Overdue KPI counts are derived
 * from status + Expiry Date (CM-70E) without ever mutating the stored
 * status column — see contract-document-obligations.service.ts.
 */
export default async function ContractDocumentsTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [permissions, detail] = await Promise.all([
    getUserPermissions(),
    contractsApi.getContractDocumentObligations(id).catch(() => null),
  ]);
  if (!permissions.includes('contracts.read') || !detail) notFound();

  const canUpdate = permissions.includes('contracts.update');

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-info/20 bg-info-light px-4 py-2.5 text-xs text-info">
        <Info className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          Track contract documents, certificates, submissions, guarantees, approvals, and obligation deadlines.
        </p>
      </div>

      <ContractDocumentKpiStrip summary={detail.summary} />

      <ContractDocumentPanel contractId={id} items={detail.items} canUpdate={canUpdate} />
    </div>
  );
}
