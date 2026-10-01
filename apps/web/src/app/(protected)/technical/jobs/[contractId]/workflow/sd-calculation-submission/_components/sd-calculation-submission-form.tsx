'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  saveSdSubmissionDraftAction,
  submitSdCalculationAction,
  completeSdCalculationAction,
} from '../../../../../actions';
import { SdAttachmentsPanel } from './sd-attachments-panel';
import { formatDate, stageHref, STAGE_OPEN_LABELS } from '../../../../../_lib/technical-format';
import type { TechnicalStageMode } from '../../../../../_lib/technical-format';
import type { TechnicalSdCalculationSubmission, TechnicalCompletedDrawingRef, TechnicalAttachment, TechnicalStage } from '@/lib/technical-api';

interface Props {
  contractId: string;
  submission: TechnicalSdCalculationSubmission | null;
  completedDrawings: TechnicalCompletedDrawingRef[];
  attachments: TechnicalAttachment[];
  canWrite: boolean;
  mode: TechnicalStageMode;
  currentStage: TechnicalStage;
  currentUserId: string;
  canManageAttachments: boolean;
}

const SUBMISSION_TYPE_OPTIONS = [
  { value: 'SHOP_DRAWING', label: 'Shop Drawing' },
  { value: 'CALCULATION', label: 'Calculation' },
  { value: 'SHOP_DRAWING_AND_CALCULATION', label: 'Shop Drawing & Calculation' },
  { value: 'REVISION_SUBMISSION', label: 'Revision Submission' },
  { value: 'OTHER', label: 'Other' },
];

const CALCULATION_TYPE_OPTIONS = [
  { value: 'STRUCTURAL_CALCULATION', label: 'Structural Calculation' },
  { value: 'PRECAST_CALCULATION', label: 'Precast Calculation' },
  { value: 'CONNECTION_DESIGN', label: 'Connection Design' },
  { value: 'LOAD_CALCULATION', label: 'Load Calculation' },
  { value: 'GENERAL_TECHNICAL_CALCULATION', label: 'General Technical Calculation' },
  { value: 'OTHER', label: 'Other' },
];

const SUBMISSION_METHOD_OPTIONS = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'PORTAL', label: 'Portal' },
  { value: 'HAND_SUBMISSION', label: 'Hand Submission' },
  { value: 'COURIER', label: 'Courier' },
  { value: 'INTERNAL_HANDOVER', label: 'Internal Handover' },
  { value: 'OTHER', label: 'Other' },
];

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

// FMP-TECH-05K — internal staff can fill this page anytime; there is no
// blocking banner anymore, only a small, non-alarming note next to the
// completion button itself, since Complete & Move to Getting Approval is
// the one action that still genuinely requires Drawing Received to be done.
const SD_FUTURE_STAGE_NOTE = 'Completion will require Drawing Received to be completed.';

function SectionCard({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm space-y-3">
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
 * FMP-TECH-02 — the SD & Calculation Submission screen's main form:
 * Submission Information, Attachments (via SdAttachmentsPanel), and Remarks/
 * Follow-up, plus the footer's 4 distinct actions. Same "one shared form,
 * several useTransition-wrapped handlers" mechanism as DrawingReceivedForm
 * (Drawing Received) — see that component's own doc comment for why
 * useActionState isn't used here.
 */
export function SdCalculationSubmissionForm({
  contractId,
  submission,
  completedDrawings,
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
  const [pendingIntent, setPendingIntent] = useState<'draft' | 'submit' | 'complete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isActive = mode === 'active';
  // FMP-TECH-05K — internal staff can open, view, AND fill any Technical
  // workflow page anytime; only a genuinely completed (already-passed)
  // stage stays read-only. Fields are no longer disabled just because
  // `currentStage` hasn't reached this stage yet ('locked').
  const disabled = !canWrite || mode === 'completed' || isPending;

  function runAction(
    intent: 'draft' | 'submit' | 'complete',
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
      // 'complete' redirects server-side on success — nothing to set here.
      try {
        router.refresh();
      } catch {
        // Refresh best-effort.
      }
    });
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

      <form ref={formRef} className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <SectionCard title="Submission Core Details">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Submission Date" htmlFor="submissionDate">
              <input
                id="submissionDate" name="submissionDate" type="date" disabled={disabled}
                defaultValue={toDateInputValue(submission?.submissionDate)} max={new Date().toISOString().slice(0, 10)}
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Submission Type" htmlFor="submissionType">
              <select id="submissionType" name="submissionType" disabled={disabled} defaultValue={submission?.submissionType ?? ''} className={INPUT_CLS}>
                <option value="">Select…</option>
                {SUBMISSION_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Submitted To" htmlFor="submittedTo">
              <input id="submittedTo" name="submittedTo" type="text" disabled={disabled} defaultValue={submission?.submittedTo ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Target Approval Date" htmlFor="targetApprovalDate">
              <input
                id="targetApprovalDate" name="targetApprovalDate" type="date" disabled={disabled}
                defaultValue={toDateInputValue(submission?.targetApprovalDate)}
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Reference / Submission No" htmlFor="referenceSubmissionNo">
              <input id="referenceSubmissionNo" name="referenceSubmissionNo" type="text" disabled={disabled} defaultValue={submission?.referenceSubmissionNo ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Submission Method" htmlFor="submissionMethod">
              <select id="submissionMethod" name="submissionMethod" disabled={disabled} defaultValue={submission?.submissionMethod ?? ''} className={INPUT_CLS}>
                <option value="">Select…</option>
                {SUBMISSION_METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Linked Drawing & Technical Scope">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Related Drawing Received" htmlFor="relatedDrawingId">
              <select id="relatedDrawingId" name="relatedDrawingId" disabled={disabled} defaultValue={submission?.relatedDrawingId ?? ''} className={INPUT_CLS}>
                <option value="">Select…</option>
                {completedDrawings.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.drawingReferenceNo ?? 'Drawing'}{d.revisionNo ? ` Rev ${d.revisionNo}` : ''}{d.receivedDate ? ` — received ${formatDate(d.receivedDate)}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Drawing Reference No" htmlFor="drawingReferenceNo">
              <input id="drawingReferenceNo" name="drawingReferenceNo" type="text" disabled={disabled} defaultValue={submission?.drawingReferenceNo ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Revision No" htmlFor="revisionNo">
              <input id="revisionNo" name="revisionNo" type="text" disabled={disabled} defaultValue={submission?.revisionNo ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Calculation Type" htmlFor="calculationType">
              <select id="calculationType" name="calculationType" disabled={disabled} defaultValue={submission?.calculationType ?? ''} className={INPUT_CLS}>
                <option value="">Select…</option>
                {CALCULATION_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="No. of Sheets / Files" htmlFor="numberOfSheetsOrFiles">
              <input id="numberOfSheetsOrFiles" name="numberOfSheetsOrFiles" type="number" min={1} disabled={disabled} defaultValue={submission?.numberOfSheetsOrFiles ?? ''} className={INPUT_CLS} />
            </Field>
          </div>
          <Field label="Scope / Description" htmlFor="scopeDescription">
            <textarea id="scopeDescription" name="scopeDescription" rows={2} disabled={disabled} defaultValue={submission?.scopeDescription ?? ''} className={INPUT_CLS} />
          </Field>
        </SectionCard>

        {/* FMP-TECH-05H — Attachments and Remarks side by side on desktop
            (each its own visual block within the card), matching Drawing
            Received's own Card 2+3 side-by-side pattern. Submitted By /
            Designation / Contact No / Email moved into a collapsed
            "Contact details" disclosure — secondary info that shouldn't
            lengthen the main visible form. */}
        <SectionCard title="Attachments & Remarks">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Attachments</p>
              <div className="mt-2">
                <SdAttachmentsPanel
                  contractId={contractId}
                  attachments={attachments}
                  currentUserId={currentUserId}
                  canUpload={canWrite && mode !== 'completed'}
                  canManage={canManageAttachments && mode !== 'completed'}
                />
              </div>
            </div>
            <div className="space-y-3">
              <Field label="Remarks" htmlFor="remarks">
                <textarea id="remarks" name="remarks" rows={3} disabled={disabled} defaultValue={submission?.remarks ?? ''} className={INPUT_CLS} />
              </Field>
              <details className="rounded-md border border-border bg-surface-secondary/40 p-3">
                <summary className="cursor-pointer text-sm font-medium text-text-secondary">Contact details (optional)</summary>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Submitted By" htmlFor="submittedByName">
                    <input id="submittedByName" name="submittedByName" type="text" disabled={disabled} defaultValue={submission?.submittedByName ?? ''} className={INPUT_CLS} />
                  </Field>
                  <Field label="Designation" htmlFor="designation">
                    <input id="designation" name="designation" type="text" disabled={disabled} defaultValue={submission?.designation ?? ''} className={INPUT_CLS} />
                  </Field>
                  <Field label="Contact No" htmlFor="contactNo">
                    <input id="contactNo" name="contactNo" type="text" disabled={disabled} defaultValue={submission?.contactNo ?? ''} className={INPUT_CLS} />
                  </Field>
                  <Field label="Email" htmlFor="email">
                    <input id="email" name="email" type="email" disabled={disabled} defaultValue={submission?.email ?? ''} className={INPUT_CLS} />
                  </Field>
                </div>
              </details>
            </div>
          </div>
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

        {/* FMP-TECH-05K — a small, non-blocking helper note sits right
            above the footer, only for the not-yet-reached case, instead of
            a top-of-page banner: Save Draft (and Complete, backed by the
            still-strict backend gate) stay fully available either way —
            this is internal workflow preparation, not a locked screen. */}
        {mode === 'locked' && (
          <p className="text-right text-xs text-text-muted">{SD_FUTURE_STAGE_NOTE}</p>
        )}

        {/* Action footer — FMP-TECH-05H: plain, non-floating, matching
            Drawing Received's own footer shape exactly. Request
            Clarification removed (same reasoning as Drawing Received in
            FMP-TECH-05D). FMP-TECH-05L: Save Draft, Submit SD & Calculation,
            and Complete & Move to Getting Approval are all shown in both
            active and not-yet-reached states — every action is
            backend-gated regardless of what the frontend shows. */}
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
                type="button" disabled={disabled} onClick={() => runAction('draft', saveSdSubmissionDraftAction, 'Draft saved.')}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-secondary disabled:opacity-50"
              >
                {isPending && pendingIntent === 'draft' && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                Save Draft
              </button>
              <button
                type="button" disabled={disabled} onClick={() => runAction('submit', submitSdCalculationAction, 'SD & Calculation submitted.')}
                className="inline-flex items-center gap-1.5 rounded-md border border-accent bg-accent-light px-4 py-2 text-sm font-medium text-accent hover:brightness-95 disabled:opacity-50"
              >
                {isPending && pendingIntent === 'submit' && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                Submit SD & Calculation
              </button>
              <button
                type="button" disabled={disabled} onClick={() => runAction('complete', completeSdCalculationAction)}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
              >
                {isPending && pendingIntent === 'complete' && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                Complete & Move to Getting Approval
              </button>
            </div>
          )}
          {mode === 'completed' && currentStage !== 'SD_CALCULATION_SUBMISSION' && (
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
