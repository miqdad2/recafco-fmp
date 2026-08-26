import { notFound } from 'next/navigation';
import { ContractTransitions } from '../../_components/contract-transitions';
import { ContractClosureAction } from '../../_components/contract-closure-action';
import { ContractInfoCard } from '../../_components/contract-info-card';
import { ContractRegisterDetailsCard } from '../../_components/contract-register-details-card';
import { ContractBadgeGroupCard } from '../../_components/contract-badge-group-card';
import { ContractScopeDetailsCard } from '../../_components/contract-scope-details-card';
import { ContractCraneDetailsCard } from '../../_components/contract-crane-details-card';
import { ContractBoqItemsCard } from '../../_components/contract-boq-items-card';
import { contractsApi } from '../../../../../lib/contracts-api';
import { getUserPermissions } from '../../_lib/get-user-permissions';
import {
  getVisibleContractTransitions,
  getClosureAction,
  SCOPE_OF_WORK_OPTIONS,
  PAYMENT_TERM_OPTIONS,
} from '../../_lib/contract-ui-helpers';

interface PageProps {
  params: Promise<{ id: string }>;
}

const KEY_STATUS_AREAS = [
  'Payments', 'Production Status', 'Variations', 'Claims Registry', 'Risk Assessment',
  'Documents & Obligations', 'Workflow & Team Tasks', 'Issue Log', 'Attachments', 'Closeout',
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default async function ContractOverviewTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [permissionsRes, contractRes, activitiesRes, closeoutRequestsRes] = await Promise.allSettled([
    getUserPermissions(),
    contractsApi.get(id),
    contractsApi.listActivities(id),
    contractsApi.listCloseoutRequests(id),
  ]);

  if (contractRes.status === 'rejected') notFound();

  const contract = (contractRes as PromiseFulfilledResult<Awaited<ReturnType<typeof contractsApi.get>>>).value;
  const permissions = permissionsRes.status === 'fulfilled' ? permissionsRes.value : [];
  const activities = activitiesRes.status === 'fulfilled' ? activitiesRes.value : [];
  const closeoutRequests = closeoutRequestsRes.status === 'fulfilled' ? closeoutRequestsRes.value : [];
  const latestCloseoutRequest = closeoutRequests[0] ?? null;

  const visibleTransitions = getVisibleContractTransitions(contract.status, permissions);
  const closureAction = getClosureAction(contract.status, permissions, latestCloseoutRequest?.status ?? null);
  const hasActions = visibleTransitions.activate || visibleTransitions.terminate
    || closureAction.showRequestCloseout || closureAction.pendingStatus !== null || closureAction.showCloseContract;
  const erectionSelected = contract.scopeOfWork?.['erection'] === true;

  const latestActivity = [...activities]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <ContractInfoCard contract={contract} />
      <ContractRegisterDetailsCard contract={contract} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ContractBadgeGroupCard
          title="Scope of Work"
          options={SCOPE_OF_WORK_OPTIONS}
          selected={contract.scopeOfWork}
          descriptionKey="other"
        />
        <ContractBadgeGroupCard title="Payment Terms" options={PAYMENT_TERM_OPTIONS} selected={contract.paymentTerms} />
      </div>
      <ContractScopeDetailsCard contract={contract} />
      {erectionSelected && <ContractCraneDetailsCard contract={contract} />}
      <ContractBoqItemsCard contract={contract} />

      {hasActions && (
        <section>
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Available Actions</h2>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
            <ContractTransitions
              contractId={contract.id}
              status={contract.status}
              version={contract.version}
              permissions={permissions}
            />
            <ContractClosureAction
              contractId={contract.id}
              contractStatus={contract.status}
              permissions={permissions}
              latestRequestStatus={latestCloseoutRequest?.status ?? null}
              latestRequestId={latestCloseoutRequest?.id ?? null}
            />
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Key Status Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
          {KEY_STATUS_AREAS.map((area) => (
            <div
              key={area}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              <span className="text-text-primary font-medium">{area}</span>
              <span className="text-xs text-text-muted italic">Not started</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Latest Activity</h2>
        {latestActivity.length === 0 ? (
          <p className="text-sm text-text-muted">No activity yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {latestActivity.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 text-sm border-b border-border last:border-0 pb-2.5 last:pb-0">
                <div>
                  <p className="text-text-primary">
                    <span className="font-medium">{a.actorName ?? 'System'}</span>
                    {' — '}
                    <span className="text-text-secondary">{a.event.replace(/_/g, ' ')}</span>
                  </p>
                  {a.previousStatus && a.newStatus && (
                    <p className="text-xs text-text-muted mt-0.5">{a.previousStatus} → {a.newStatus}</p>
                  )}
                </div>
                <span className="text-xs text-text-muted whitespace-nowrap">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
