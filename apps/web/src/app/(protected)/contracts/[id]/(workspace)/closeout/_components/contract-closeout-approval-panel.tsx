'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Gavel, CheckCircle2 } from 'lucide-react';
import type { ActionResult } from '../../../../actions';
import {
  reviewCloseoutRequestAction,
  approveCloseoutRequestAction,
  rejectCloseoutRequestAction,
  closeContractFromCloseoutAction,
} from '../../../../actions';
import type { ContractCloseoutRequest } from '@/lib/contracts-api';
import { inputCls, labelCls } from '../../../../_components/contract-form-fields';
import { CLOSURE_STATUS_LABELS, CLOSURE_STATUS_BADGE_CLASSES, type ClosureStatus } from '../../../../_lib/contract-closeout-detail-helpers';

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

/**
 * CM-67 — Final Approval & Closeout, restyled from closeout-reviewer-panel.tsx
 * (CM-33) to show this unit's real field set (Prepared/Reviewed/Approved
 * By+Date, Closure Date, Final Remarks, Status) — every field is a real
 * stored value from ContractCloseoutRequest, "—" only when genuinely unset.
 * Approve/Reject/Start Review/Close Contract are the same unmodified server
 * actions as before; Close Contract only ever renders once the real
 * backend status is APPROVED (getClosureAction()'s own rule, enforced
 * again server-side by closeContractFromCloseoutAction/closeContract()).
 * CM-67C — visual-only "final decision area" polish: bolder header + icon,
 * a stronger card frame, and a visually prominent Close Contract button —
 * all real behavior (permission gates, action wiring, status transitions)
 * is byte-identical to before.
 */
export function ContractCloseoutApprovalPanel({ contractId, request, canReview }: Props): React.JSX.Element {
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

  const status = request.status as ClosureStatus;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <Gavel className="size-4.5 text-text-secondary shrink-0" aria-hidden="true" />
          Final Approval & Closeout
        </h2>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${CLOSURE_STATUS_BADGE_CLASSES[status] ?? 'bg-surface-secondary text-text-secondary'}`}>
          {CLOSURE_STATUS_LABELS[status] ?? request.status}
        </span>
      </div>

      <p className="text-xs text-text-muted mb-3">{request.requestNo}</p>

      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
        <Field label="Prepared By" value={request.requestedByUser.displayName} />
        <Field label="Prepared Date" value={formatDateTime(request.requestedAt)} />
        <Field label="Reviewed By" value={request.reviewedByUser?.displayName ?? '—'} />
        <Field label="Reviewed Date" value={formatDateTime(request.reviewedAt)} />
        <Field label="Approved By" value={request.approvedAt ? (request.reviewedByUser?.displayName ?? '—') : '—'} />
        <Field label="Approved Date" value={formatDateTime(request.approvedAt)} />
        <Field label="Closure Date" value={formatDateTime(request.closedAt)} />
        <Field label="Final Remarks" value={request.closeoutSummary || '—'} />
      </dl>

      {request.status === 'REJECTED' && request.rejectionReason && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error mb-4">
          <p className="font-medium mb-0.5">Rejection Reason</p>
          <p>{request.rejectionReason}</p>
        </div>
      )}

      {request.reviewRemarks && (
        <div className="rounded-md border border-border bg-surface-secondary/40 px-4 py-3 text-sm text-text-secondary mb-4">
          <p className="font-medium text-text-primary mb-0.5">Review Remarks</p>
          <p>{request.reviewRemarks}</p>
        </div>
      )}

      {!canReview && ['SUBMITTED', 'UNDER_REVIEW'].includes(request.status) && (
        <p className="text-xs text-text-muted italic">You can view this request, but only a reviewer with Close Contract permission can approve, reject, or start review.</p>
      )}

      {canReview && request.status === 'SUBMITTED' && (
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border">
          <form action={approveAction} className="space-y-2">
            {approveState.error && <p className="text-xs text-danger">{approveState.error}</p>}
            <label htmlFor="approveRemarks" className={labelCls}>Approve with remarks (optional)</label>
            <textarea id="approveRemarks" name="reviewRemarks" rows={2} maxLength={5000} className={`${inputCls} resize-y`} />
            <button
              type="submit"
              disabled={approvePending}
              className="rounded-md bg-success px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-success/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
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
              className="rounded-md bg-error px-3 py-1.5 text-xs font-medium text-white hover:bg-error/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
            >
              {rejectPending ? 'Rejecting…' : 'Reject Closeout'}
            </button>
          </form>
        </div>
      )}

      {canReview && request.status === 'APPROVED' && (
        <div className="rounded-md border border-success/40 bg-success-light/40 p-3 pt-3">
          {closeState.error && <p className="text-xs text-danger mb-2">{closeState.error}</p>}
          <p className="text-xs text-success font-medium mb-2">Closeout has been approved — this contract is ready to close.</p>
          <form action={closeFormAction} onSubmit={() => { closeSubmittedRef.current = true; }}>
            <button
              type="submit"
              disabled={closePending}
              className="inline-flex items-center gap-2 rounded-md bg-success px-6 py-3 text-base font-bold text-white shadow-sm hover:bg-success/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
              title="Closeout request has been approved"
            >
              <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
              {closePending ? 'Closing…' : 'Close Contract'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
