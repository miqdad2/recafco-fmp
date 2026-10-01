'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  saveApprovalDraftAction,
  sendApprovalBackForChangesAction,
  rejectApprovalAction,
  approveAndMoveToFdIssuanceAction,
} from '../../../../../actions';
import { ApprovalAttachmentsPanel } from './approval-attachments-panel';
import { formatDate, stageHref, STAGE_OPEN_LABELS } from '../../../../../_lib/technical-format';
import type { TechnicalStageMode } from '../../../../../_lib/technical-format';
import type { TechnicalApproval, TechnicalEligibleSdSubmissionRef, TechnicalAttachment, TechnicalStage } from '@/lib/technical-api';

interface Props {
  contractId: string;
  approval: TechnicalApproval | null;
  eligibleSdSubmissions: TechnicalEligibleSdSubmissionRef[];
  attachments: TechnicalAttachment[];
  canWrite: boolean;
  mode: TechnicalStageMode;
  currentStage: TechnicalStage;
  currentUserId: string;
  canManageAttachments: boolean;
}

// FMP-TECH-05K — internal staff can fill this page anytime; a small,
// non-alarming note sits next to the completion button instead of a
// blocking top banner, since Approve & Move to FD Issuance is the one
// action that still genuinely requires a submitted SD & Calculation record.
// FMP-TECH-05L — exact wording the ticket specified.
const GETTING_APPROVAL_FUTURE_STAGE_NOTE = 'Approval completion will require SD & Calculation submission to be completed.';

const APPROVAL_STATUS_OPTIONS = [
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'APPROVED_WITH_COMMENTS', label: 'Approved with Comments' },
  { value: 'CHANGES_REQUIRED', label: 'Changes Required' },
  { value: 'REJECTED', label: 'Rejected' },
];

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-text-primary">{label}</label>
      {children}
    </div>
  );
}

const INPUT_CLS = 'mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-secondary disabled:text-text-muted';

/**
 * FMP-TECH-03 — the Getting Approval screen's main form: Approval
 * Information, Attachments (via ApprovalAttachmentsPanel), plus the
 * footer's 5 distinct actions (Save Draft / Request Clarification / Send
 * Back for Changes / Reject / Approve & Move to FD Issuance). Same "one
 * shared form, several useTransition-wrapped handlers" mechanism as
 * DrawingReceivedForm/SdCalculationSubmissionForm.
 */
export function GettingApprovalForm({
  contractId,
  approval,
  eligibleSdSubmissions,
  attachments,
  canWrite,
  mode,
  currentStage,
  currentUserId,
  canManageAttachments,
}: Props): React.JSX.Element {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingIntent, setPendingIntent] = useState<'draft' | 'sendBack' | 'reject' | 'approve' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isActive = mode === 'active';
  // FMP-TECH-05K — same "editable anytime except once already passed"
  // reasoning as SdCalculationSubmissionForm.
  const disabled = !canWrite || mode === 'completed' || isPending;

  function runAction(
    intent: 'draft' | 'sendBack' | 'reject' | 'approve',
    action: (contractId: string, formData: FormData) => Promise<{ error: string | null; missing?: string[] }>,
    successText?: string,
  ): void {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    setError(null);
    setMissing([]);
    setSuccessMessage(null);
    setPendingIntent(intent);
    startTransition(async () => {
      const result = await action(contractId, formData);
      if (result.error) {
        setError(result.error);
        setMissing(result.missing ?? []);
      } else if (successText) {
        setSuccessMessage(successText);
      }
      // 'approve' redirects server-side on success — nothing to set here.
      try {
        router.refresh();
      } catch {
        // Refresh best-effort.
      }
    });
  }

  function handleReject(): void {
    // Reject requires confirmation, per that action's own ticket description.
    if (typeof window !== 'undefined' && !window.confirm('Reject this SD & Calculation submission? This records a rejection and does not delete any data.')) {
      return;
    }
    runAction('reject', rejectApprovalAction, 'Rejected.');
  }

  return (
    // FMP-TECH-05O — reverts FMP-TECH-05N's scrollable-region/pinned-footer
    // split back to one normal flow — see DrawingReceivedForm's own doc
    // comment for the full reasoning.
    <div className="space-y-5">
      {mode === 'completed' && (
        <div className="rounded-md border border-success/40 bg-success-light px-4 py-3 text-sm text-success">
          This stage is completed. Showing the saved data below in read-only mode.
        </div>
      )}
      {!canWrite && isActive && (
        <div className="rounded-md border border-border bg-surface-secondary px-4 py-3 text-sm text-text-secondary">
          You have read-only access to this workflow.
        </div>
      )}

      <form ref={formRef} className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        <SectionCard title="Approval Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Related SD & Calculation Submission" htmlFor="relatedSdSubmissionId">
              <select id="relatedSdSubmissionId" name="relatedSdSubmissionId" disabled={disabled} defaultValue={approval?.relatedSdSubmissionId ?? ''} className={INPUT_CLS}>
                <option value="">Select…</option>
                {eligibleSdSubmissions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.drawingReferenceNo ?? 'Submission'}{s.revisionNo ? ` Rev ${s.revisionNo}` : ''}{s.submissionDate ? ` — submitted ${formatDate(s.submissionDate)}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Submitted On" htmlFor="submittedOn">
              <input id="submittedOn" name="submittedOn" type="date" disabled={disabled} defaultValue={toDateInputValue(approval?.submittedOn)} className={INPUT_CLS} />
            </Field>
            <Field label="Submitted To" htmlFor="submittedTo">
              <input id="submittedTo" name="submittedTo" type="text" disabled={disabled} defaultValue={approval?.submittedTo ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Approval Status" htmlFor="approvalStatus">
              <select id="approvalStatus" name="approvalStatus" disabled={disabled} defaultValue={approval?.approvalStatus ?? ''} className={INPUT_CLS}>
                <option value="">Select…</option>
                {APPROVAL_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Expected Approval Date" htmlFor="expectedApprovalDate">
              <input id="expectedApprovalDate" name="expectedApprovalDate" type="date" disabled={disabled} defaultValue={toDateInputValue(approval?.expectedApprovalDate)} className={INPUT_CLS} />
            </Field>
            <Field label="Revision No" htmlFor="revisionNo">
              <input id="revisionNo" name="revisionNo" type="text" disabled={disabled} defaultValue={approval?.revisionNo ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Submitted By" htmlFor="submittedByName">
              <input id="submittedByName" name="submittedByName" type="text" disabled={disabled} defaultValue={approval?.submittedByName ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Reviewed On" htmlFor="reviewedOn">
              <input id="reviewedOn" name="reviewedOn" type="date" disabled={disabled} defaultValue={toDateInputValue(approval?.reviewedOn)} className={INPUT_CLS} />
            </Field>
            <Field label="Reviewed By" htmlFor="reviewedBy">
              <input id="reviewedBy" name="reviewedBy" type="text" disabled={disabled} defaultValue={approval?.reviewedBy ?? ''} className={INPUT_CLS} />
            </Field>
          </div>
          <Field label="Client / Reviewer Comments" htmlFor="reviewerComments">
            <textarea id="reviewerComments" name="reviewerComments" rows={3} disabled={disabled} defaultValue={approval?.reviewerComments ?? ''} className={INPUT_CLS} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex items-center gap-2 pt-6 text-sm text-text-primary">
              <input type="checkbox" name="resubmissionRequired" disabled={disabled} defaultChecked={approval?.resubmissionRequired ?? false} className="rounded border-border" />
              Resubmission Required
            </label>
            <Field label="Resubmission Date" htmlFor="resubmissionDate">
              <input id="resubmissionDate" name="resubmissionDate" type="date" disabled={disabled} defaultValue={toDateInputValue(approval?.resubmissionDate)} className={INPUT_CLS} />
            </Field>
          </div>
          <Field label="Resubmission Reason / Comments" htmlFor="resubmissionReason">
            <textarea id="resubmissionReason" name="resubmissionReason" rows={2} disabled={disabled} defaultValue={approval?.resubmissionReason ?? ''} className={INPUT_CLS} />
          </Field>
        </SectionCard>

        <SectionCard title="Approval Attachments">
          <ApprovalAttachmentsPanel
            contractId={contractId}
            attachments={attachments}
            currentUserId={currentUserId}
            canUpload={canWrite && mode !== 'completed'}
            canManage={canManageAttachments && mode !== 'completed'}
          />
        </SectionCard>

        {error && (
          <div role="alert" className="rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
            <p>{error}</p>
            {missing.length > 0 && <p className="mt-1 text-xs">Missing: {missing.join(', ')}</p>}
          </div>
        )}
        {successMessage && (
          <div role="status" className="rounded-md border border-success bg-success-light px-4 py-3 text-sm text-success">
            {successMessage}
          </div>
        )}

        {mode === 'locked' && (
          <p className="text-right text-xs text-text-muted">{GETTING_APPROVAL_FUTURE_STAGE_NOTE}</p>
        )}

        {/* FMP-TECH-05L — every action (Save Draft/Send Back/Reject/
            Approve) is shown whenever this stage hasn't already been
            passed. Each write action is independently backend-gated by
            `assertApprovalStageIsCurrent()` regardless of what's shown
            here. Request Clarification stays removed from this footer
            (same reasoning as Drawing Received/SD's own removal). */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <a
            href={`/technical/jobs/${contractId}`}
            className="inline-flex items-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-secondary"
          >
            Back to Workflow
          </a>
          {mode !== 'completed' && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button" disabled={disabled} onClick={() => runAction('draft', saveApprovalDraftAction, 'Draft saved.')}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-secondary disabled:opacity-50"
              >
                {isPending && pendingIntent === 'draft' && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                Save Draft
              </button>
              <button
                type="button" disabled={disabled} onClick={() => runAction('sendBack', sendApprovalBackForChangesAction, 'Sent back for changes.')}
                className="inline-flex items-center gap-1.5 rounded-md border border-warning bg-warning-light px-4 py-2 text-sm font-medium text-warning hover:brightness-95 disabled:opacity-50"
              >
                {isPending && pendingIntent === 'sendBack' && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                Send Back for Changes
              </button>
              <button
                type="button" disabled={disabled} onClick={() => runAction('approve', approveAndMoveToFdIssuanceAction)}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
              >
                {isPending && pendingIntent === 'approve' && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                Approve & Move to FD Issuance
              </button>
              <button
                type="button" disabled={disabled} onClick={handleReject}
                className="inline-flex items-center gap-1.5 rounded-md border border-danger bg-danger-light px-4 py-2 text-sm font-medium text-danger hover:brightness-95 disabled:opacity-50"
              >
                {isPending && pendingIntent === 'reject' && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                Reject
              </button>
            </div>
          )}
          {mode === 'completed' && currentStage !== 'GETTING_APPROVAL' && (
            <a
              href={stageHref(contractId, currentStage)}
              className="inline-flex items-center rounded-md border border-accent bg-accent-light px-4 py-2 text-sm font-medium text-accent hover:brightness-95"
            >
              {STAGE_OPEN_LABELS[currentStage]}
            </a>
          )}
        </div>
      </form>
    </div>
  );
}
