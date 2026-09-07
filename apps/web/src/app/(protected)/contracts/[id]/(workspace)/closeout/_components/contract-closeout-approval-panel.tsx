'use client';

import { useState } from 'react';
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

/**
 * (unnumbered) — replaces the old useActionState/submittedRef/useEffect
 * "close detection" with a plain isSaving state tied directly to the async
 * call's own promise: never stuck on "Saving…" if the effect fails to
 * re-fire, since there is no separate effect to fail. router.refresh()
 * failures are logged but never leave the button stuck, since the request
 * itself already succeeded by that point.
 */
function useSimpleAction(
  call: (formData: FormData) => Promise<ActionResult>,
): [string | null, (e: React.FormEvent<HTMLFormElement>) => Promise<void>, boolean] {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (isSaving) return;

    const formData = new FormData(e.currentTarget);
    setError(null);
    setIsSaving(true);
    try {
      const result = await call(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Action saved but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Closeout action failed:', err);
      setError('Action failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return [error, handleSubmit, isSaving];
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
  const [reviewError, submitReview, reviewSaving] = useSimpleAction(
    () => reviewCloseoutRequestAction(request.id, contractId),
  );
  const [approveError, submitApprove, approveSaving] = useSimpleAction(
    (fd) => approveCloseoutRequestAction(request.id, contractId, { error: null }, fd),
  );
  const [rejectError, submitReject, rejectSaving] = useSimpleAction(
    (fd) => rejectCloseoutRequestAction(request.id, contractId, { error: null }, fd),
  );
  const [closeError, submitClose, closeSaving] = useSimpleAction(
    () => closeContractFromCloseoutAction(request.id, contractId),
  );

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
          {reviewError && <p className="text-xs text-error">{reviewError}</p>}
          <form onSubmit={submitReview}>
            <button
              type="submit"
              disabled={reviewSaving}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
            >
              {reviewSaving ? 'Starting…' : 'Start Review'}
            </button>
          </form>
        </div>
      )}

      {canReview && ['SUBMITTED', 'UNDER_REVIEW'].includes(request.status) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border">
          <form onSubmit={submitApprove} className="space-y-2">
            {approveError && <p className="text-xs text-error">{approveError}</p>}
            <label htmlFor="approveRemarks" className={labelCls}>Approve with remarks (optional)</label>
            <textarea id="approveRemarks" name="reviewRemarks" rows={2} maxLength={5000} className={`${inputCls} resize-y`} />
            <button
              type="submit"
              disabled={approveSaving}
              className="rounded-md bg-success px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-success/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
            >
              {approveSaving ? 'Approving…' : 'Approve Closeout'}
            </button>
          </form>

          <form onSubmit={submitReject} className="space-y-2">
            {rejectError && <p className="text-xs text-error">{rejectError}</p>}
            <label htmlFor="rejectionReason" className={labelCls}>
              Rejection Reason <span className="text-error">*</span>
            </label>
            <textarea id="rejectionReason" name="rejectionReason" rows={2} required maxLength={5000} className={`${inputCls} resize-y`} />
            <button
              type="submit"
              disabled={rejectSaving}
              className="rounded-md bg-error px-3 py-1.5 text-xs font-medium text-white hover:bg-error/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
            >
              {rejectSaving ? 'Rejecting…' : 'Reject Closeout'}
            </button>
          </form>
        </div>
      )}

      {canReview && request.status === 'APPROVED' && (
        <div className="rounded-md border border-success/40 bg-success-light/40 p-3 pt-3">
          {closeError && <p className="text-xs text-error mb-2">{closeError}</p>}
          <p className="text-xs text-success font-medium mb-2">Closeout has been approved — this contract is ready to close.</p>
          <form onSubmit={submitClose}>
            <button
              type="submit"
              disabled={closeSaving}
              className="inline-flex items-center gap-2 rounded-md bg-success px-6 py-3 text-base font-bold text-white shadow-sm hover:bg-success/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
              title="Closeout request has been approved"
            >
              <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
              {closeSaving ? 'Closing…' : 'Close Contract'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
