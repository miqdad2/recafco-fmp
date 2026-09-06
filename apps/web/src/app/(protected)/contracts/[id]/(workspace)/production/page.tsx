import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Info, ArrowUpRight } from 'lucide-react';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { ContractProductionKpiStrip } from './_components/contract-production-kpi-strip';
import { ContractProductionPanel } from './_components/contract-production-panel';

export const metadata: Metadata = { title: 'Production Status — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * CM-59 — Contract Detail Production Status, approved-design rebuild.
 * Production is manually tracked inside Contract Management — no Production
 * Module integration exists (the "Open Production Module" link below is
 * real navigation to the actual, separately-built Production module at
 * /production, but the two are not data-linked; this page's own numbers are
 * never sourced from there). Every KPI/table value comes from
 * contractsApi.getContractProduction() — real BOQ items joined with their
 * (optional) production tracking rows, server-computed and divide-by-zero
 * safe (contract-boq-production.service.ts). A contract with no BOQ items
 * shows the real empty state, never fabricated rows.
 * CM-59B — info bar reworded: the old "Future release: Automatically linked
 * with Production Module" read as if a sync already existed. Now states
 * plainly that integration "can be added in a future phase" — a possibility,
 * not a promise or an implication that today's numbers are already synced.
 * Button relabeled "Open Production Module" (was "View") since it only
 * navigates to the separate module, never opens a synced view of this
 * contract's data. Kept (not omitted) because the route is real and working
 * — verified live in CM-59 and unchanged since.
 */
export default async function ContractProductionStatusTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [permissions, detail] = await Promise.all([
    getUserPermissions(),
    contractsApi.getContractProduction(id).catch(() => null),
  ]);
  if (!permissions.includes('contracts.read') || !detail) notFound();

  const canUpdate = permissions.includes('contracts.update');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-info/20 bg-info-light px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-info">
          <Info className="size-3.5 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-medium">This data is manually updated in Contract Management.</span>{' '}
            Production module integration can be added in a future phase.
          </p>
        </div>
        <Link
          href="/production"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-info/30 bg-surface px-3 py-1.5 text-xs font-medium text-info hover:bg-info-light focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Open Production Module
          <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
        </Link>
      </div>

      <ContractProductionKpiStrip summary={detail.summary} />

      <ContractProductionPanel contractId={id} items={detail.items} canUpdate={canUpdate} />
    </div>
  );
}
