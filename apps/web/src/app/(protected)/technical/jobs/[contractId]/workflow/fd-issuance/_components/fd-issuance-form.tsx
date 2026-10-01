'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  saveFdDraftAction,
  submitFdIssueAction,
  returnOrReopenFdAction,
  issueFdAndCompleteWorkflowAction,
} from '../../../../../actions';
import { FdAttachmentsPanel } from './fd-attachments-panel';
import { formatDate, stageHref, STAGE_OPEN_LABELS } from '../../../../../_lib/technical-format';
import type { TechnicalStageMode } from '../../../../../_lib/technical-format';
import type { TechnicalFdIssuance, TechnicalEligibleApprovalRef, TechnicalAttachment, TechnicalStage } from '@/lib/technical-api';

interface Props {
  contractId: string;
  fdIssuance: TechnicalFdIssuance | null;
  eligibleApprovals: TechnicalEligibleApprovalRef[];
  attachments: TechnicalAttachment[];
  canWrite: boolean;
  mode: TechnicalStageMode;
  currentStage: TechnicalStage;
  currentUserId: string;
  canManageAttachments: boolean;
}

// FMP-TECH-05K — internal staff can fill this page anytime; a small,
// non-alarming note sits next to the completion button instead of a
// blocking top banner, since Issue FD & Complete Technical Workflow is the
// one action that still genuinely requires an approved Getting Approval record.
// FMP-TECH-05L — exact wording the ticket specified.
const FD_ISSUANCE_FUTURE_STAGE_NOTE = 'FD completion will require Getting Approval to be approved.';

const PURPOSE_OPTIONS = [
  { value: 'PRODUCTION', label: 'Production' },
  { value: 'ERECTION', label: 'Erection' },
  { value: 'STORAGE_YARD_DELIVERY', label: 'Storage Yard / Delivery' },
  { value: 'QUALITY_CONTROL', label: 'Quality Control' },
  { value: 'CLIENT_CONSULTANT', label: 'Client / Consultant' },
  { value: 'INTERNAL_RECORD', label: 'Internal Record' },
  { value: 'OTHER', label: 'Other' },
];

const ISSUE_TYPE_OPTIONS = [
  { value: 'FINAL_DRAWING', label: 'Final Drawing' },
  { value: 'FINAL_DOCUMENT', label: 'Final Document' },
  { value: 'REVISED_FINAL_DRAWING', label: 'Revised Final Drawing' },
  { value: 'APPROVED_PACKAGE', label: 'Approved Package' },
  { value: 'OTHER', label: 'Other' },
];

const DISTRIBUTION_OPTIONS = [
  { value: 'ELECTRONIC', label: 'Electronic' },
  { value: 'PRINTED_COPY', label: 'Printed Copy' },
  { value: 'BOTH', label: 'Both' },
  { value: 'PORTAL', label: 'Portal' },
  { value: 'OTHER', label: 'Other' },
];

const ISSUE_METHOD_OPTIONS = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'PORTAL', label: 'Portal' },
  { value: 'HANDOVER', label: 'Handover' },
  { value: 'INTERNAL_SYSTEM', label: 'Internal System' },
  { value: 'COURIER', label: 'Courier' },
  { value: 'OTHER', label: 'Other' },
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
 * FMP-TECH-04 — the FD Issuance screen's main form (Technical Stage 4, the
 * final stage): FD Issuance Information, Issued By details, FD Attachments
 * (via FdAttachmentsPanel), plus the footer's 4 distinct actions (Save Draft
 * / Submit FD Issue / Return-Reopen / Issue FD & Complete Technical
 * Workflow). Same "one shared form, several useTransition-wrapped handlers"
 * mechanism as GettingApprovalForm.
 */
export function FdIssuanceForm({
  contractId,
  fdIssuance,
  eligibleApprovals,
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
  const [pendingIntent, setPendingIntent] = useState<'draft' | 'submit' | 'return' | 'complete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isActive = mode === 'active';
  // FMP-TECH-05K — same "editable anytime except once already passed"
  // reasoning as SdCalculationSubmissionForm.
  const disabled = !canWrite || mode === 'completed' || isPending;

  function runAction(
    intent: 'draft' | 'submit' | 'return' | 'complete',
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
      // 'return' and 'complete' redirect server-side on success — nothing to set here.
      try {
        router.refresh();
      } catch {
        // Refresh best-effort.
      }
    });
  }

  function handleReturnOrReopen(): void {
    const returnReason = (formRef.current?.elements.namedItem('returnReason') as HTMLTextAreaElement | null)?.value.trim();
    if (!returnReason) {
      setError('A reason is required to return/reopen this FD Issuance.');
      setSuccessMessage(null);
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm('Return/reopen this job order to Getting Approval for revision? This does not delete any data.')) {
      return;
    }
    runAction('return', returnOrReopenFdAction);
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
        <SectionCard title="FD Issuance Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Related Approval" htmlFor="relatedApprovalId">
              <select id="relatedApprovalId" name="relatedApprovalId" disabled={disabled} defaultValue={fdIssuance?.relatedApprovalId ?? ''} className={INPUT_CLS}>
                <option value="">Select…</option>
                {eligibleApprovals.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.revisionNo ? `Rev ${a.revisionNo}` : 'Approval'}{a.reviewedOn ? ` — reviewed ${formatDate(a.reviewedOn)}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="FD Issue Date" htmlFor="fdIssueDate">
              <input id="fdIssueDate" name="fdIssueDate" type="date" disabled={disabled} defaultValue={toDateInputValue(fdIssuance?.fdIssueDate)} className={INPUT_CLS} />
            </Field>
            <Field label="Issued To" htmlFor="issuedTo">
              <input id="issuedTo" name="issuedTo" type="text" disabled={disabled} defaultValue={fdIssuance?.issuedTo ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Purpose / For" htmlFor="purposeFor">
              <select id="purposeFor" name="purposeFor" disabled={disabled} defaultValue={fdIssuance?.purposeFor ?? ''} className={INPUT_CLS}>
                <option value="">Select…</option>
                {PURPOSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Issue Type" htmlFor="issueType">
              <select id="issueType" name="issueType" disabled={disabled} defaultValue={fdIssuance?.issueType ?? ''} className={INPUT_CLS}>
                <option value="">Select…</option>
                {ISSUE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Drawing Reference No" htmlFor="drawingReferenceNo">
              <input id="drawingReferenceNo" name="drawingReferenceNo" type="text" disabled={disabled} defaultValue={fdIssuance?.drawingReferenceNo ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Revision No" htmlFor="revisionNo">
              <input id="revisionNo" name="revisionNo" type="text" disabled={disabled} defaultValue={fdIssuance?.revisionNo ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Approved Reference No" htmlFor="approvedReferenceNo">
              <input id="approvedReferenceNo" name="approvedReferenceNo" type="text" disabled={disabled} defaultValue={fdIssuance?.approvedReferenceNo ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Approved Date" htmlFor="approvedDate">
              <input id="approvedDate" name="approvedDate" type="date" disabled={disabled} defaultValue={toDateInputValue(fdIssuance?.approvedDate)} className={INPUT_CLS} />
            </Field>
            <Field label="No. of Sheets / Files" htmlFor="numberOfSheetsOrFiles">
              <input id="numberOfSheetsOrFiles" name="numberOfSheetsOrFiles" type="number" min={1} disabled={disabled} defaultValue={fdIssuance?.numberOfSheetsOrFiles ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Distribution" htmlFor="distribution">
              <select id="distribution" name="distribution" disabled={disabled} defaultValue={fdIssuance?.distribution ?? ''} className={INPUT_CLS}>
                <option value="">Select…</option>
                {DISTRIBUTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Issue Method" htmlFor="issueMethod">
              <select id="issueMethod" name="issueMethod" disabled={disabled} defaultValue={fdIssuance?.issueMethod ?? ''} className={INPUT_CLS}>
                <option value="">Select…</option>
                {ISSUE_METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Issued By">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Issued By" htmlFor="issuedByName">
              <input id="issuedByName" name="issuedByName" type="text" disabled={disabled} defaultValue={fdIssuance?.issuedByName ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Designation" htmlFor="designation">
              <input id="designation" name="designation" type="text" disabled={disabled} defaultValue={fdIssuance?.designation ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Contact No" htmlFor="contactNo">
              <input id="contactNo" name="contactNo" type="text" disabled={disabled} defaultValue={fdIssuance?.contactNo ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Email" htmlFor="email">
              <input id="email" name="email" type="email" disabled={disabled} defaultValue={fdIssuance?.email ?? ''} className={INPUT_CLS} />
            </Field>
          </div>
          <Field label="Remarks" htmlFor="remarks">
            <textarea id="remarks" name="remarks" rows={2} disabled={disabled} defaultValue={fdIssuance?.remarks ?? ''} className={INPUT_CLS} />
          </Field>
        </SectionCard>

        <SectionCard title="FD Attachments">
          <FdAttachmentsPanel
            contractId={contractId}
            attachments={attachments}
            currentUserId={currentUserId}
            canUpload={canWrite && mode !== 'completed'}
            canManage={canManageAttachments && mode !== 'completed'}
          />
        </SectionCard>

        <SectionCard title="Return / Reopen">
          <Field label="Reason (required to Return/Reopen)" htmlFor="returnReason">
            <textarea id="returnReason" name="returnReason" rows={2} disabled={disabled} className={INPUT_CLS} />
          </Field>
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
          <p className="text-right text-xs text-text-muted">{FD_ISSUANCE_FUTURE_STAGE_NOTE}</p>
        )}

        {/* FMP-TECH-05L — Save Draft/Submit FD Issue/Return-Reopen/Issue &
            Complete are all shown whenever this stage hasn't already been
            passed. Each write action is independently backend-gated by
            `assertFdStageIsCurrent()` regardless of what's shown here. */}
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
                type="button" disabled={disabled} onClick={() => runAction('draft', saveFdDraftAction, 'Draft saved.')}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-secondary disabled:opacity-50"
              >
                {isPending && pendingIntent === 'draft' && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                Save Draft
              </button>
              <button
                type="button" disabled={disabled} onClick={() => runAction('submit', submitFdIssueAction, 'FD issue submitted.')}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-secondary px-4 py-2 text-sm font-medium text-text-secondary hover:brightness-95 disabled:opacity-50"
              >
                {isPending && pendingIntent === 'submit' && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                Submit FD Issue
              </button>
              <button
                type="button" disabled={disabled} onClick={handleReturnOrReopen}
                className="inline-flex items-center gap-1.5 rounded-md border border-warning bg-warning-light px-4 py-2 text-sm font-medium text-warning hover:brightness-95 disabled:opacity-50"
              >
                {isPending && pendingIntent === 'return' && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                Return / Reopen
              </button>
              <button
                type="button" disabled={disabled} onClick={() => runAction('complete', issueFdAndCompleteWorkflowAction)}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
              >
                {isPending && pendingIntent === 'complete' && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                Issue FD & Complete Technical Workflow
              </button>
            </div>
          )}
          {mode === 'completed' && currentStage !== 'FD_ISSUANCE' && (
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
