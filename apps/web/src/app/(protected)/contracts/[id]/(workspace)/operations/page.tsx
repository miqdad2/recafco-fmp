import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { operationsApi } from '../../../../../../lib/operations-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { OperationsProgressPanel } from '../../../_components/operations-progress-panel';

export const metadata: Metadata = { title: 'Operations progress — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * FMP-OPS-01 — Operations progress for this contract. Reads FMP's own accepted data (never the external system),
 * so the page renders even when the source is down. Not one of the 13 approved tabs: it is reached from the
 * Overview card and is a plain route under the contract workspace.
 */
export default async function ContractOperationsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) notFound();

  const [viewRes, historyRes] = await Promise.allSettled([operationsApi.contractProgress(id), operationsApi.contractHistory(id)]);
  if (viewRes.status === 'rejected') {
    return (
      <div role="alert" className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
        Operations progress could not be loaded from FMP. Contract information is not affected. Please refresh the page.
      </div>
    );
  }
  return (
    <OperationsProgressPanel
      contractId={id}
      view={viewRes.value}
      history={historyRes.status === 'fulfilled' ? historyRes.value : []}
      canLink={permissions.includes('contracts.operations_link')}
    />
  );
}
