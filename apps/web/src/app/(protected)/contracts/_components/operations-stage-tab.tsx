import { notFound } from 'next/navigation';
import { operationsApi } from '@/lib/operations-api';
import { getUserPermissions } from '../_lib/get-user-permissions';
import type { StageDef } from '../_lib/operations-progress-helpers';
import { OperationsStagePanel } from './operations-stage-panel';

/**
 * FMP-OPS-02 — shared server body of the Technical, Production & Planning, Delivery and Erection tabs. Gate:
 * contracts.read (and the API applies the contract's department scope). It reads FMP's accepted local data only,
 * so the tab renders even when the Operations system is down, and it never falls back to the old local workflow.
 */
export async function OperationsStageTab({ contractId, stageKey }: { contractId: string; stageKey: StageDef['key'] }): Promise<React.JSX.Element> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) notFound();

  let view: Awaited<ReturnType<typeof operationsApi.contractProgress>> | null = null;
  try {
    view = await operationsApi.contractProgress(contractId);
  } catch {
    view = null;
  }
  if (view === null) {
    return (
      <div role="alert" className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
        Operations progress could not be loaded from FMP. The contract itself is not affected. Please refresh the page.
      </div>
    );
  }
  return <OperationsStagePanel contractId={contractId} stageKey={stageKey} view={view} canLink={permissions.includes('contracts.operations_link')} />;
}
