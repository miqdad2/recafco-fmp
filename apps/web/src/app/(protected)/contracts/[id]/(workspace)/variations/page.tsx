import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Info } from 'lucide-react';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { ContractVariationKpiStrip } from './_components/contract-variation-kpi-strip';
import { ContractVariationFormulaStrip } from './_components/contract-variation-formula-strip';
import { ContractVariationPanel } from './_components/contract-variation-panel';

export const metadata: Metadata = { title: 'Variations / Change Orders — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * CM-60 — Contract Detail Variations / Change Orders, approved-design build.
 * "Variation" is the real table/field terminology throughout (KPI labels,
 * table columns, backend) per this unit's explicit naming decision — "Change
 * Orders" appears only in the tab label and this page's own title, for
 * manager/client-friendly framing.
 *
 * Business rule: only APPROVED variations with affectsContractValue=true
 * affect Current Contract Value. Pending/rejected/cancelled never do,
 * regardless of amount. Current Contract Value here is a page-level
 * computed value (Contract.originalContractValue + approved variation
 * total) — Contract.contractValue itself stays BOQ-derived and untouched by
 * this unit (see contract-variations.service.ts).
 */
export default async function ContractVariationsTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [permissions, detail] = await Promise.all([
    getUserPermissions(),
    contractsApi.getContractVariations(id).catch(() => null),
  ]);
  if (!permissions.includes('contracts.read') || !detail) notFound();

  const canUpdate = permissions.includes('contracts.update');

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-info/20 bg-info-light px-4 py-2.5 text-xs text-info">
        <Info className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          Variations / Change Orders may impact the contract value and/or completion date. Only approved variations affect the Current Contract Value.
        </p>
      </div>

      <ContractVariationKpiStrip summary={detail.summary} computedCurrentValue={detail.computedCurrentValue} />

      <ContractVariationFormulaStrip
        originalContractValue={detail.originalContractValue}
        approvedValue={detail.summary.approvedValue}
        computedCurrentValue={detail.computedCurrentValue}
      />

      <ContractVariationPanel contractId={id} variations={detail.items} canUpdate={canUpdate} />
    </div>
  );
}
