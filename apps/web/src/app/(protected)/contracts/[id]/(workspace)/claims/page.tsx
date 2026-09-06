import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { ContractClaimKpiStrip } from './_components/contract-claim-kpi-strip';
import { ContractClaimPanel } from './_components/contract-claim-panel';

export const metadata: Metadata = { title: 'Claims — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * CM-61 — Contract Detail Claims tab, approved-design build. Named "Claims"
 * only (tab label, section heading, table heading, Add button) — never
 * "Claims / Change Orders" or "Change Order" as a page/table title, per this
 * unit's explicit naming decision: Variations / Change Orders already owns
 * that framing; Claims separately tracks formal claims, disputes, EOT,
 * delays, payment issues, damage, extra cost, or contractual issues.
 *
 * Reuses the real ContractClaimsService/ClaimFormModal/closeClaimAction from
 * CM-31 (module-level Claim Log) completely unmodified — same Add/Edit
 * fields, same server actions, same contracts.update gate, same
 * contractsApi.listClaims()/export route. Only the display layer (KPI
 * strip, filter labels, claim-type wording, table column set) is
 * contract-scoped-specific — see ui-registry.md's "Contract-scoped page
 * reuses shared components" pattern (established CM-58).
 */
export default async function ContractClaimsTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [permissions, claimsRes, people, contract] = await Promise.all([
    getUserPermissions(),
    contractsApi.listClaims({ contractId: id, pageSize: 200 }).catch(() => null),
    contractsApi.people().catch(() => []),
    // CM-70C — readable contract identity for the Add Claim modal (never
    // derivable from `claims` alone when the contract has no claims yet).
    contractsApi.get(id).catch(() => null),
  ]);
  if (!permissions.includes('contracts.read') || !claimsRes) notFound();

  const canUpdate = permissions.includes('contracts.update');
  const { items: claims, summary, total } = claimsRes;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">Claims Summary</h2>
      <ContractClaimKpiStrip summary={summary} totalClaims={total} />

      <ContractClaimPanel
        contractId={id}
        claims={claims}
        people={people}
        canUpdate={canUpdate}
        {...(contract ? { contract: { referenceNumber: contract.referenceNumber, title: contract.title, counterpartyName: contract.counterpartyName } } : {})}
      />
    </div>
  );
}
