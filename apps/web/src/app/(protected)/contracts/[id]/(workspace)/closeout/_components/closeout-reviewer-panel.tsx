'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionResult } from '../../../../actions';
import {
  reviewCloseoutRequestAction,
  approveCloseoutRequestAction,
  rejectCloseoutRequestAction,
  closeContractFromCloseoutAction,
} from '../../../../actions';
import type { ContractCloseoutRequest } from '@/lib/contracts-api';
import { inputCls, labelCls } from '../../../../_components/contract-form-fields';
import { CloseoutRequestStatusBadge } from './closeout-request-status-badge';
import { formatContractValue } from '../../../../_lib/contract-ui-helpers';

interface Props {
  contractId: string;
  request: ContractCloseoutRequest;
  canReview: boolean;
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Field({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm font-medium text-text-primary mt-0.5">{value}</dd>
    </div>
  );
}

function useSimpleAction(
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>,
): [ActionResult, (formData: FormData) => void, boolean] {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(action, { error: null });
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !isPending && !state.error) {
      submittedRef.current = false;
      router.refresh();
    }
  }, [state, isPending, router]);

  return [state, (fd: FormData) => { submittedRef.current = true; formAction(fd); }, isPending];
}

export function CloseoutReviewerPanel({ contractId, request, canReview }: Props): React.JSX.Element {
  const router = useRouter();

  const [reviewState, reviewAction, reviewPending] = useSimpleAction(
    reviewCloseoutRequestAction.bind(null, request.id, contractId),
  );
  const [approveState, approveAction, approvePending] = useSimpleAction(
    approveCloseoutRequestAction.bind(null, request.id, contractId),
  );
  const [rejectState, rejectAction, rejectPending] = useSimpleAction(
    rejectCloseoutRequestAction.bind(null, request.id, contractId),
  );

  const closeSubmittedRef = useRef(false);
  const [closeState, closeFormAction, closePending] = useActionState<ActionResult, FormData>(
    closeContractFromCloseoutAction.bind(null, request.id, contractId),
    { error: null },
  );
  useEffect(() => {
    if (closeSubmittedRef.current && !closePending && !closeState.error) {
      closeSubmittedRef.current = false;
      router.refresh();
    }
  }, [closeState, closePending, router]);

  const snapshot = request.riskSnapshot;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-text-primary">{request.requestNo}</p>
          <p className="text-xs text-text-muted">
            Requested by {request.requestedByUser.displayName} on {formatDateTime(request.requestedAt)}
          </p>
        </div>
        <CloseoutRequestStatusBadge status={request.status} />
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="Closeout Summary" value={request.closeoutSummary || '—'} />
        {request.requestedRemarks && <Field label="Requested Remarks" value={request.requestedRemarks} />}
        {request.reviewedByUser && <Field label="Reviewed By" value={request.reviewedByUser.displayName} />}
        {request.reviewedAt && <Field label="Reviewed At" value={formatDateTime(request.reviewedAt)} />}
        {request.approvedAt && <Field label="Approved At" value={formatDateTime(request.approvedAt)} />}
        {request.rejectedAt && <Field label="Rejected At" value={formatDateTime(request.rejectedAt)} />}
        {request.closedAt && <Field label="Closed At" value={formatDateTime(request.closedAt)} />}
        {request.reviewRemarks && <Field label="Review Remarks" value={request.reviewRemarks} />}
      </dl>

      {request.status === 'REJECTED' && request.rejectionReason && (
        <div className="rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
          <p className="font-medium mb-0.5">Rejection Reason</p>
          <p>{request.rejectionReason}</p>
        </div>
      )}

      {snapshot && (
        <div className="rounded-md border border-border bg-surface-secondary/40 p-3">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
            Risk Snapshot (as of {formatDateTime(snapshot.checkedAt)})
          </p>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <Field label="Open Workflow Tasks" value={snapshot.openWorkflowTasksCount} />
            <Field label="Overdue Workflow Tasks" value={snapshot.overdueWorkflowTasksCount} />
            <Field label="Open Issues" value={snapshot.openIssuesCount} />
            <Field label="Open Claims" value={snapshot.openClaimsCount} />
            <Field label="Outstanding Payment" value={formatContractValue(snapshot.outstandingPaymentAmount, 'KWD')} />
            <Field label="Unpaid Payments" value={snapshot.unpaidPaymentsCount} />
            <Field label="Closeout Documents Missing" value={snapshot.missingCloseoutDocumentsCount > 0 ? 'Yes' : 'No'} />
          </dl>
        </div>
      )}

      {!canReview && ['SUBMITTED', 'UNDER_REVIEW'].includes(request.status) && (
        <p className="text-xs text-text-muted italic">You can view this request, but only a reviewer with Close Contract permission can approve, reject, or start review.</p>
      )}

      {canReview && request.status === 'SUBMITTED' && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
          {reviewState.error && <p className="text-xs text-danger">{reviewState.error}</p>}
          <form action={reviewAction}>
            <button
              type="submit"
              disabled={reviewPending}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
            >
              {reviewPending ? 'Starting…' : 'Start Review'}
            </button>
          </form>
        </div>
      )}

      {canReview && ['SUBMITTED', 'UNDER_REVIEW'].includes(request.status) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
          <form action={approveAction} className="space-y-2">
            {approveState.error && <p className="text-xs text-danger">{approveState.error}</p>}
            <label htmlFor="approveRemarks" className={labelCls}>Approve with remarks (optional)</label>
            <textarea id="approveRemarks" name="reviewRemarks" rows={2} maxLength={5000} className={`${inputCls} resize-y`} />
            <button
              type="submit"
              disabled={approvePending}
              className="rounded-md bg-success px-3 py-1.5 text-xs font-medium text-white hover:bg-success/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
            >
              {approvePending ? 'Approving…' : 'Approve Closeout'}
            </button>
          </form>

          <form action={rejectAction} className="space-y-2">
            {rejectState.error && <p className="text-xs text-danger">{rejectState.error}</p>}
            <label htmlFor="rejectionReason" className={labelCls}>
              Rejection Reason <span className="text-danger">*</span>
            </label>
            <textarea id="rejectionReason" name="rejectionReason" rows={2} required maxLength={5000} className={`${inputCls} resize-y`} />
            <button
              type="submit"
              disabled={rejectPending}
              className="rounded-md bg-danger px-3 py-1.5 text-xs font-medium text-white hover:bg-danger/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
            >
              {rejectPending ? 'Rejecting…' : 'Reject Closeout'}
            </button>
          </form>
        </div>
      )}

      {canReview && request.status === 'APPROVED' && (
        <div className="pt-2 border-t border-border">
          {closeState.error && <p className="text-xs text-danger mb-2">{closeState.error}</p>}
          <form action={closeFormAction} onSubmit={() => { closeSubmittedRef.current = true; }}>
            <button
              type="submit"
              disabled={closePending}
              className="rounded-md bg-success px-4 py-2 text-sm font-medium text-white hover:bg-success/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
            >
              {closePending ? 'Closing…' : 'Final Close Contract'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
