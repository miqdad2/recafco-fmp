import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Info } from 'lucide-react';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { ContractRiskKpiStrip } from './_components/contract-risk-kpi-strip';
import { ContractRiskPanel } from './_components/contract-risk-panel';

export const metadata: Metadata = { title: 'Risk Assessment — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * CM-62 — Contract Detail Risk Assessment, approved-design build. Tracks
 * delivery/cost/schedule/production/erection/materials/client-approval/
 * subcontractor/insurance/contract-execution risk — not an ISO
 * risk-scoring system. Risk Evaluation and Residual Risk are both plain
 * manual dropdowns (LOW/MEDIUM/HIGH/CRITICAL); Residual Risk is never
 * auto-calculated from Risk Evaluation or Risk Response — see
 * contract-risks.service.ts.
 * CM-62B — info note shortened to a single plain sentence (no ISO/SAP
 * wording, no exhaustive risk-category list) — the same information is
 * already conveyed by the KPI strip and the Risk Evaluation/Risk Response
 * filter options themselves. Wording-only change.
 */
export default async function ContractRisksTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [permissions, detail, people] = await Promise.all([
    getUserPermissions(),
    contractsApi.getContractRisks(id).catch(() => null),
    contractsApi.people().catch(() => []),
  ]);
  if (!permissions.includes('contracts.read') || !detail) notFound();

  const canUpdate = permissions.includes('contracts.update');

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-info/20 bg-info-light px-4 py-2.5 text-xs text-info">
        <Info className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          Track contract risks, response actions, residual risk, and action due dates.
        </p>
      </div>

      <ContractRiskKpiStrip summary={detail.summary} />

      <ContractRiskPanel contractId={id} risks={detail.items} people={people} canUpdate={canUpdate} />
    </div>
  );
}
