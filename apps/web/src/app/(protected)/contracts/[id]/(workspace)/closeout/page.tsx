import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Gavel, AlertTriangle } from 'lucide-react';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { computeOverallProgress, computePaymentProgressPercent } from '../../../_lib/contract-overview-helpers';
import {
  computeClosureStatus,
  computeChecklist,
  computeChecklistProgress,
  computeBlockingItems,
  countRisksByBucket,
  countVariationsByBucket,
  computeFinalPaymentStatus,
  type ClosureStatus,
} from '../../../_lib/contract-closeout-detail-helpers';
import { ContractCloseoutHeaderCards } from './_components/contract-closeout-header-cards';
import { ContractCloseoutKpiStrip } from './_components/contract-closeout-kpi-strip';
import { ContractCloseoutBlockingPanel } from './_components/contract-closeout-blocking-panel';
import { ContractCloseoutChecklistPanel } from './_components/contract-closeout-checklist-panel';
import { ContractCloseoutRequiredDocumentsPanel } from './_components/contract-closeout-required-documents-panel';
import { ContractCloseoutFinancialPanel } from './_components/contract-closeout-financial-panel';
import { ContractCloseoutModuleSummaryPanel } from './_components/contract-closeout-module-summary-panel';
import { ContractCloseoutRequestForm } from './_components/contract-closeout-request-form';
import { ContractCloseoutApprovalPanel } from './_components/contract-closeout-approval-panel';
import { ContractCloseoutRequestAttachments } from './_components/contract-closeout-request-attachments';

export const metadata: Metadata = { title: 'Contract Closeout — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

const ACTIVE_REQUEST_STATUSES = new Set(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED']);

/**
 * CM-67 — Contract Detail Closeout, approved design, simplified. Reuses the
 * complete real CM-33 closeout backend (checks/requests/review/approve/
 * reject/close/attachments) entirely unmodified — this unit only widened
 * one existing read (GET :id/workflow-summary, +id/taskName/priority so
 * Blocking Items can show real per-task rows instead of just team counts;
 * see contract-workflow.service.ts). No migration, no new endpoint.
 *
 * Every section reads real, already-existing per-module data (Workflow
 * summary, Payments, Claims, Risks, Issues, Documents & Obligations,
 * Variations) — see contract-closeout-detail-helpers.ts for the exact
 * real-data derivation of Closeout Status, Closeout Progress, the
 * Blocking Items list, and the Final Completion Checklist. Removed:
 * Contract Summary card, Recent Activity card, Back to Contract button,
 * Archive Contract button (no real archive workflow exists anywhere in
 * this app), Request Missing Items button (no real
 * task/notification-creation flow exists for it), More Actions button (no
 * additional real actions exist beyond what's already shown) — the user is
 * already inside the contract workspace, and Activity / Audit History has
 * its own tab (CM-66) for history.
 *
 * CM-67B — layout-only compaction pass, no data/logic change: Row 1 Status+
 * Progress, Row 2 KPI strip (unchanged), Row 3 Checklist|Blocking Items,
 * Row 4 Documents|Financial Summary, Row 5 Claims/Risks/Issues Summary|
 * Final Approval & Closeout, all in responsive 2-column grids (stack on
 * mobile/tablet via `grid-cols-1 lg:grid-cols-2`). Blocking Items caps to
 * the top 6 real highest-priority rows with a "View all" in-card expand
 * (contract-closeout-blocking-panel.tsx); the checklist gained a compact
 * scroll region + a status-count recap using the SAME checklistProgress
 * already computed below — no new calculation, no new data source.
 *
 * CM-67C — final visual polish, no data/logic change: per-status icon/color
 * on the Status card (was a plain ready/not-ready binary), colored chips
 * on the Progress/Checklist count recaps, Blocking Items default cap
 * dropped 6→5, tighter row heights throughout, Financial Summary grouped
 * into 3 labeled sub-sections with Current Contract Value/Outstanding
 * Payment highlighted, and the Final Approval & Closeout area strengthened
 * (bold header + icon, larger primary Close Contract button, a real-data
 * blocker-count helper note shown only when blockingItems.length > 0 before
 * a manager submits a request). Removed a redundant nested `<section>` this
 * area had (ContractCloseoutApprovalPanel used to render its own card frame
 * inside this page's already-identical outer one) — one card, not two.
 *
 * CM-67D — readability-only pass, no data/logic change: raw SNAKE_CASE
 * status text in the Blocking Items table now goes through a generic
 * humanizeStatus() (contract-closeout-detail-helpers.ts) and renders as a
 * colored badge (bucketed by the word's own real meaning via
 * blockingStatusTone()) instead of unlabeled plain text; the blocker-count
 * warning below is now more prominent (icon, bolder text, stronger border)
 * and reworded to "...Resolve them before submitting for closeout review.";
 * the Status badge and Progress numbers are one size larger for easier
 * scanning.
 *
 * CM-67E — business-meaning correction: the old "Final Documents /
 * Attachments" card (closeout-request attachments + an upload form) gave
 * the false impression Closeout was where required documents get uploaded.
 * Replaced with "Required Documents for Closeout" — a READ-ONLY readiness
 * summary over the real Documents & Obligations records already fetched
 * above for the KPI strip/checklist (contractsApi.getContractDocumentObligations(),
 * no new fetch). No upload control lives there anymore. The real closeout-
 * request attachment upload (a genuinely different thing — supporting files
 * for the closeout REQUEST itself) moved into Final Approval & Closeout via
 * ContractCloseoutRequestAttachments, unmodified logic, just relocated —
 * nothing was removed, only re-homed to match where it conceptually
 * belongs. The "documents" checklist item already used Documents &
 * Obligations pending/expired counts (not closeout attachments) since
 * CM-67, and Blocking Items already included pending/expired document rows
 * since CM-67 — both audited and confirmed already correct, no change
 * needed for this unit.
 */
export default async function ContractCloseoutTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [
    permissionsRes,
    contractRes,
    checksRes,
    requestsRes,
    workflowSummaryRes,
    risksRes,
    issuesRes,
    claimsRes,
    documentsRes,
    paymentsRes,
    variationsRes,
  ] = await Promise.allSettled([
    getUserPermissions(),
    contractsApi.get(id),
    contractsApi.getCloseoutChecks(id),
    contractsApi.listCloseoutRequests(id),
    contractsApi.getWorkflowSummary(id),
    contractsApi.getContractRisks(id),
    contractsApi.listIssues({ contractId: id, pageSize: 200 }),
    contractsApi.listClaims({ contractId: id, pageSize: 200 }),
    contractsApi.getContractDocumentObligations(id),
    contractsApi.listPayments({ contractId: id, pageSize: 200 }),
    contractsApi.getContractVariations(id),
  ]);

  if (contractRes.status === 'rejected') notFound();
  const contract = contractRes.value;

  const permissions = permissionsRes.status === 'fulfilled' ? permissionsRes.value : [];
  const checks = checksRes.status === 'fulfilled' ? checksRes.value : null;
  const requests = requestsRes.status === 'fulfilled' ? requestsRes.value : [];
  const workflowTasks = workflowSummaryRes.status === 'fulfilled' ? workflowSummaryRes.value.tasks : [];
  const risks = risksRes.status === 'fulfilled' ? risksRes.value : null;
  const issues = issuesRes.status === 'fulfilled' ? issuesRes.value : null;
  const claims = claimsRes.status === 'fulfilled' ? claimsRes.value : null;
  const documents = documentsRes.status === 'fulfilled' ? documentsRes.value : null;
  const payments = paymentsRes.status === 'fulfilled' ? paymentsRes.value : null;
  const variations = variationsRes.status === 'fulfilled' ? variationsRes.value : null;

  const canUpdate = permissions.includes('contracts.update');
  const canReview = permissions.includes('contracts.close');

  const latestRequest = requests[0] ?? null;
  const hasActiveRequest = latestRequest ? ACTIVE_REQUEST_STATUSES.has(latestRequest.status) : false;
  const showRequestForm = contract.status !== 'CLOSED' && !hasActiveRequest && (!latestRequest || latestRequest.status !== 'CLOSED');
  const hasActiveOrClosedRequest = Boolean(latestRequest) && latestRequest?.status !== 'REJECTED' && latestRequest?.status !== 'CANCELLED';

  const attachments = latestRequest ? await contractsApi.listCloseoutAttachments(latestRequest.id).catch(() => []) : [];

  // Closeout Status + Closeout Progress
  const closureStatus: ClosureStatus = computeClosureStatus(contract.status, latestRequest?.status ?? null, checks?.isReadyForClosure);

  const productionTasks = workflowTasks.filter((t) => t.team === 'PRODUCTION');
  const erectionTasks = workflowTasks.filter((t) => t.team === 'ERECTION');
  const productionOpen = productionTasks.filter((t) => t.status !== 'APPROVED' && t.status !== 'COMPLETED').length;
  const erectionOpen = erectionTasks.filter((t) => t.status !== 'APPROVED' && t.status !== 'COMPLETED').length;

  const checklistItems = computeChecklist({
    contractId: id,
    workflowOpen: checks?.workflow.open ?? 0,
    workflowOverdue: checks?.workflow.overdue ?? 0,
    productionTasksTotal: productionTasks.length,
    productionTasksOpen: productionOpen,
    erectionTasksTotal: erectionTasks.length,
    erectionTasksOpen: erectionOpen,
    paymentsNonFinalCount: checks?.payments.nonFinalCount ?? 0,
    claimsOpen: checks?.claims.open ?? 0,
    risksOpen: risks?.summary.openRisks ?? 0,
    issuesOpen: checks?.issues.open ?? 0,
    documentObligationsTotal: documents?.summary.totalItems ?? 0,
    documentObligationsPendingOrExpired: (documents?.summary.pending ?? 0) + (documents?.summary.expiredOverdue ?? 0),
    closeoutAttachmentsCount: attachments.length,
    hasActiveOrClosedRequest,
    latestRequestStatus: latestRequest?.status ?? null,
    latestRequestApprovedAt: latestRequest?.approvedAt ?? null,
    latestRequestApprovedBy: latestRequest?.approvedAt ? (latestRequest.reviewedByUser?.displayName ?? null) : null,
  });
  const checklistProgress = computeChecklistProgress(checklistItems);

  // Blocking Items
  const blockingItems = computeBlockingItems({
    contractId: id,
    workflowTasks: workflowTasks.map((t) => ({ id: t.id, taskName: t.taskName, status: t.status, priority: t.priority, dueDate: t.dueDate, isOverdue: t.isOverdue })),
    payments: payments?.items.map((p) => ({ id: p.id, paymentNo: p.paymentNo, invoiceNumber: p.invoiceNumber, status: p.status, dueDate: p.dueDate })) ?? [],
    claims: claims?.items.map((c) => ({ id: c.id, claimNo: c.claimNo, claimTitle: c.claimTitle, status: c.status, dueDate: c.dueDate })) ?? [],
    risks: risks?.items.map((r) => ({ id: r.id, riskNo: r.riskNo, description: r.description, status: r.status, riskEvaluation: r.riskEvaluation, actionDueDate: r.actionDueDate })) ?? [],
    issues: issues?.items.map((i) => ({ id: i.id, issueNo: i.issueNo, title: i.title, status: i.status, priority: i.priority, dueDate: i.dueDate })) ?? [],
    // CM-70E — prefer the real Expiry Date (falling back to the legacy
    // combined field only for a pre-existing record that predates the
    // Submission/Expiry Date split), matching the same preference the
    // backend's own Expiring Soon / Expired-Overdue derivation now uses.
    documentObligations: documents?.items.map((d) => ({ id: d.id, itemNo: d.itemNo, title: d.title, status: d.status, submissionOrExpiryDate: d.expiryDate ?? d.submissionOrExpiryDate })) ?? [],
    latestRequestStatus: latestRequest?.status ?? null,
  });

  // Readiness KPI strip
  const overallCompletionPercent = workflowSummaryRes.status === 'fulfilled' ? computeOverallProgress(workflowTasks).percent : undefined;
  const paymentCompletionPercent =
    payments && contract.contractValue
      ? computePaymentProgressPercent(parseFloat(payments.summary.totalPaid), parseFloat(contract.contractValue))
      : undefined;

  // Claims / Risks / Issues Summary
  const riskBuckets = risks ? countRisksByBucket(risks.items) : null;
  const variationBuckets = variations ? countVariationsByBucket(variations.items) : null;

  // Financial Closeout Summary
  const finalPaymentStatus = computeFinalPaymentStatus(checks?.payments.nonFinalCount ?? 0);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-base font-semibold text-text-primary">Contract Closeout</h1>
        <p className="text-xs text-text-secondary mt-0.5">Final verification before closing the contract.</p>
      </div>

      <ContractCloseoutHeaderCards status={closureStatus} blockingCount={blockingItems.length} progress={checklistProgress} />

      <ContractCloseoutKpiStrip
        overallCompletionPercent={overallCompletionPercent}
        paymentCompletionPercent={paymentCompletionPercent}
        openClaims={checks ? checks.claims.open : undefined}
        openRisks={risks ? risks.summary.openRisks : undefined}
        pendingDocuments={documents ? documents.summary.pending : undefined}
        openIssues={checks ? checks.issues.open : undefined}
      />

      {/* CM-67B — compact 2-column grid: Checklist | Blocking Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <ContractCloseoutChecklistPanel items={checklistItems} progress={checklistProgress} />
        <ContractCloseoutBlockingPanel items={blockingItems} />
      </div>

      {/* CM-67B — Documents | Financial Summary (moved up from the bottom) */}
      {/* CM-67E — left card is now a read-only Documents & Obligations readiness summary, not a closeout-attachment upload area; the real upload moved into Final Approval & Closeout below (see ContractCloseoutRequestAttachments). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <ContractCloseoutRequiredDocumentsPanel contractId={id} items={documents?.items ?? []} />
        <ContractCloseoutFinancialPanel
          currency={contract.currency}
          originalContractValue={variations?.originalContractValue ?? contract.originalContractValue ?? null}
          approvedVariationsValue={variations?.summary.approvedValue ?? '0'}
          currentContractValue={variations?.computedCurrentValue ?? contract.contractValue ?? null}
          submittedInvoices={payments?.summary.totalSubmitted ?? '0'}
          receivedPayments={payments?.summary.totalPaid ?? '0'}
          outstandingPayment={payments?.summary.totalOutstanding ?? '0'}
          finalPaymentStatus={finalPaymentStatus}
        />
      </div>

      {/* CM-67B — Claims/Risks/Issues Summary | Final Approval & Closeout (moved up from the bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <ContractCloseoutModuleSummaryPanel
          openClaims={claims?.summary.openClaims ?? 0}
          closedOrSettledClaims={claims?.summary.closedOrSettledClaims ?? 0}
          approvedVariations={variationBuckets?.approved ?? 0}
          pendingVariations={variationBuckets?.pending ?? 0}
          openRisks={riskBuckets?.open ?? 0}
          mitigatedOrClosedRisks={(riskBuckets?.mitigated ?? 0) + (riskBuckets?.closedOrCancelled ?? 0)}
          openIssues={issues?.summary.openIssues ?? 0}
          closedOrResolvedIssues={(issues?.summary.closedIssues ?? 0) + (issues?.summary.resolvedIssues ?? 0)}
        />

        <section className="rounded-lg border border-border bg-surface shadow-sm p-4">
          {contract.status === 'CLOSED' && latestRequest?.status === 'CLOSED' ? (
            <>
              <ContractCloseoutApprovalPanel contractId={id} request={latestRequest} canReview={false} />
              <ContractCloseoutRequestAttachments contractId={id} requestId={latestRequest.id} attachments={attachments} canUpload={false} />
            </>
          ) : showRequestForm ? (
            canUpdate ? (
              <>
                <h2 className="text-base font-bold text-text-primary flex items-center gap-2 mb-3">
                  <Gavel className="size-4.5 text-text-secondary shrink-0" aria-hidden="true" />
                  Final Approval & Closeout
                </h2>
                {blockingItems.length > 0 && (
                  <div className="flex items-start gap-2 text-sm text-warning bg-warning-light border-2 border-warning/40 rounded-md px-3 py-2.5 mb-3">
                    <AlertTriangle className="size-4.5 shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="font-semibold">
                      This contract has {blockingItems.length} blocking {blockingItems.length === 1 ? 'item' : 'items'}. Resolve {blockingItems.length === 1 ? 'it' : 'them'} before submitting for closeout review.
                    </p>
                  </div>
                )}
                <ContractCloseoutRequestForm contractId={id} />
              </>
            ) : (
              <>
                <h2 className="text-base font-bold text-text-primary flex items-center gap-2 mb-3">
                  <Gavel className="size-4.5 text-text-secondary shrink-0" aria-hidden="true" />
                  Final Approval & Closeout
                </h2>
                <p className="text-sm text-text-muted">
                  {latestRequest?.status === 'REJECTED'
                    ? 'The previous closeout request was rejected. A user with contract update access can submit a new one.'
                    : 'No closeout request has been submitted for this contract yet.'}
                </p>
              </>
            )
          ) : latestRequest ? (
            <>
              <ContractCloseoutApprovalPanel contractId={id} request={latestRequest} canReview={canReview} />
              <ContractCloseoutRequestAttachments
                contractId={id}
                requestId={latestRequest.id}
                attachments={attachments}
                canUpload={canUpdate && hasActiveRequest}
              />
            </>
          ) : (
            <>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2 mb-3">
                <Gavel className="size-4.5 text-text-secondary shrink-0" aria-hidden="true" />
                Final Approval & Closeout
              </h2>
              <p className="text-sm text-text-muted">No closeout request has been submitted for this contract yet.</p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
