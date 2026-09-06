import { notFound } from 'next/navigation';
import { ContractTransitions } from '../../_components/contract-transitions';
import { ContractClosureAction } from '../../_components/contract-closure-action';
import { ContractOverviewSummaryCard } from '../../_components/contract-overview-summary-card';
import { ContractOverviewProgressCard } from '../../_components/contract-overview-progress-card';
import { ContractOverviewValueCard, ContractOverviewFinancialCard } from '../../_components/contract-overview-value-financial-cards';
import { ContractOverviewScopeCard, ContractOverviewPaymentTermsCard } from '../../_components/contract-overview-checklist-cards';
import { ContractOverviewAttentionCard } from '../../_components/contract-overview-attention-card';
import {
  ContractOverviewPaymentStatementCard,
  ContractOverviewProductionCard,
  ContractOverviewDocumentsCard,
} from '../../_components/contract-overview-bottom-summary-cards';
import { InfoBox } from '../../_components/contract-form-fields';
import { contractsApi } from '../../../../../lib/contracts-api';
import { getUserPermissions } from '../../_lib/get-user-permissions';
import { getVisibleContractTransitions, getClosureAction, formatDaysRemainingDisplay } from '../../_lib/contract-ui-helpers';
import {
  computeTeamProgress,
  computeOverallProgress,
  computeProductionTaskSummary,
  computePaymentProgressPercent,
  buildAttentionItems,
} from '../../_lib/contract-overview-helpers';

interface PageProps {
  params: Promise<{ id: string }>;
}

function toNum(value: string | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}

/**
 * CM-57 — Contract Detail Overview, rebuilt to match the approved design.
 * Every number on this page is real: workflow-task progress comes from the
 * read-only GET :id/workflow-summary (never the lazily-generating GET
 * :id/workflow), payment figures come from contractsApi.listPayments's
 * server-computed summary (full filtered set, not just one page), and
 * Attention Required comes from the existing closeout-checks aggregation
 * already used by the Closeout tab. Variations/Documents have no backend
 * yet — those cards show 0/—/real-attachment-counts rather than fabricated
 * numbers; see contract-overview-helpers.ts and the individual card
 * components' own doc comments for exactly which metric maps to which real
 * source. CM-57B — the lifecycle/closeout action buttons (Activate/
 * Terminate/Request Closeout/etc.) no longer live in their own boxed
 * "Available Actions" section; they render inline in Contract Summary's own
 * header row via its `actions` prop — same components, same visibility
 * conditions, purely a placement change.
 */
export default async function ContractOverviewTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [permissionsRes, contractRes, workflowSummaryRes, paymentsRes, closeoutChecksRes, closeoutRequestsRes] =
    await Promise.allSettled([
      getUserPermissions(),
      contractsApi.get(id),
      contractsApi.getWorkflowSummary(id),
      contractsApi.listPayments({ contractId: id, pageSize: 1 }),
      contractsApi.getCloseoutChecks(id),
      contractsApi.listCloseoutRequests(id),
    ]);

  if (contractRes.status === 'rejected') notFound();

  const contract = (contractRes as PromiseFulfilledResult<Awaited<ReturnType<typeof contractsApi.get>>>).value;
  const permissions = permissionsRes.status === 'fulfilled' ? permissionsRes.value : [];
  const workflowTasks = workflowSummaryRes.status === 'fulfilled' ? workflowSummaryRes.value.tasks : [];
  const paymentsList = paymentsRes.status === 'fulfilled' ? paymentsRes.value : null;
  const closeoutChecks = closeoutChecksRes.status === 'fulfilled' ? closeoutChecksRes.value : null;
  const closeoutRequests = closeoutRequestsRes.status === 'fulfilled' ? closeoutRequestsRes.value : [];
  const latestCloseoutRequest = closeoutRequests[0] ?? null;

  const visibleTransitions = getVisibleContractTransitions(contract.status, permissions);
  const closureAction = getClosureAction(contract.status, permissions, latestCloseoutRequest?.status ?? null);
  const hasActions = visibleTransitions.activate || visibleTransitions.terminate
    || closureAction.showRequestCloseout || closureAction.pendingStatus !== null || closureAction.showCloseContract;

  // Section 2 / Section 9 — real per-team workflow progress.
  const technical = computeTeamProgress(workflowTasks, 'TECHNICAL');
  const production = computeTeamProgress(workflowTasks, 'PRODUCTION');
  const erection = computeTeamProgress(workflowTasks, 'ERECTION');
  const overall = computeOverallProgress(workflowTasks);
  const productionTaskSummary = computeProductionTaskSummary(workflowTasks);

  // Section 4 / Section 8 — real manual Contract Management payments.
  const paymentSummary = paymentsList?.summary ?? {
    totalSubmitted: '0', totalCertified: '0', totalPaid: '0', totalOutstanding: '0', overdueCount: 0, overdueValue: '0',
  };
  const paymentProgressPercent = computePaymentProgressPercent(toNum(paymentSummary.totalPaid), toNum(contract.contractValue));

  // Section 7 — real attention conditions only.
  const daysRemaining = formatDaysRemainingDisplay(contract.forecastCompletionDate, contract.endDate);
  const pendingCloseoutStatus =
    latestCloseoutRequest && (latestCloseoutRequest.status === 'SUBMITTED' || latestCloseoutRequest.status === 'UNDER_REVIEW')
      ? latestCloseoutRequest.status
      : null;
  const attentionItems = buildAttentionItems({
    contractId: contract.id,
    overdueWorkflowTasks: closeoutChecks?.workflow.overdue ?? 0,
    overduePayments: closeoutChecks?.payments.overdueCount ?? 0,
    openClaims: closeoutChecks?.claims.open ?? 0,
    openIssues: closeoutChecks?.issues.open ?? 0,
    pendingCloseoutStatus,
    daysRemaining,
  });

  // Section 10 — real attachment counts only (workflow-task + closeout-request attachments).
  const workflowTaskAttachments = workflowTasks.reduce((sum, t) => sum + t.attachmentsCount, 0);
  const closeoutAttachments = closeoutRequests.reduce((sum, r) => sum + r.attachmentsCount, 0);

  return (
    <div className="space-y-4">
      <ContractOverviewSummaryCard
        contract={contract}
        actions={
          hasActions ? (
            <>
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
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ContractOverviewProgressCard technical={technical} production={production} erection={erection} overall={overall} />
        <ContractOverviewValueCard contract={contract} />
        <ContractOverviewFinancialCard
          contractId={contract.id}
          data={{
            totalSubmitted: paymentSummary.totalSubmitted,
            totalPaid: paymentSummary.totalPaid,
            totalOutstanding: paymentSummary.totalOutstanding,
            overdueValue: paymentSummary.overdueValue,
            paymentProgressPercent,
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ContractOverviewScopeCard scopeOfWork={contract.scopeOfWork} />
        <ContractOverviewPaymentTermsCard paymentTerms={contract.paymentTerms} />
        <ContractOverviewAttentionCard items={attentionItems} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ContractOverviewPaymentStatementCard
          contractId={contract.id}
          data={{
            totalInvoices: paymentsList?.total ?? 0,
            totalSubmitted: paymentSummary.totalSubmitted,
            totalPaid: paymentSummary.totalPaid,
            totalOutstanding: paymentSummary.totalOutstanding,
            overdueValue: paymentSummary.overdueValue,
          }}
        />
        <ContractOverviewProductionCard contractId={contract.id} summary={productionTaskSummary} />
        <ContractOverviewDocumentsCard contractId={contract.id} totalAttachments={workflowTaskAttachments + closeoutAttachments} />
      </div>

      <InfoBox variant="subtle">Use the tabs above to view detailed information about this contract.</InfoBox>
    </div>
  );
}
