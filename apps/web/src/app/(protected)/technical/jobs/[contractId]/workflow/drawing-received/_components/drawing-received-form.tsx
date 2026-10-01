'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  saveDrawingReceivedDraftAction,
  completeDrawingReceivedAction,
} from '../../../../../actions';
import { DrawingAttachmentsPanel } from './drawing-attachments-panel';
import { stageHref, STAGE_OPEN_LABELS } from '../../../../../_lib/technical-format';
import type { TechnicalStageMode } from '../../../../../_lib/technical-format';
import type { TechnicalDrawing, TechnicalAttachment, TechnicalStage } from '@/lib/technical-api';

interface Props {
  contractId: string;
  drawing: TechnicalDrawing | null;
  attachments: TechnicalAttachment[];
  people: { id: string; displayName: string }[];
  canWrite: boolean;
  /** FMP-TECH-05E — Drawing Received is the first stage, so it can only ever be 'active' or 'completed' (never 'locked' — nothing precedes it). Typed as the full union for consistency with the other 3 stage forms. */
  mode: TechnicalStageMode;
  currentStage: TechnicalStage;
  currentUserId: string;
  canManageAttachments: boolean;
}

const RECEIVED_FROM_OPTIONS = [
  { value: 'CLIENT', label: 'Client' },
  { value: 'CONSULTANT', label: 'Consultant' },
  { value: 'EMPLOYER', label: 'Employer' },
  { value: 'MAIN_CONTRACTOR', label: 'Main Contractor' },
  { value: 'INTERNAL', label: 'Internal' },
];

const DRAWING_TYPE_OPTIONS = [
  { value: 'SHOP_DRAWING', label: 'Shop Drawing' },
  { value: 'ARCHITECTURAL', label: 'Architectural' },
  { value: 'STRUCTURAL', label: 'Structural' },
  { value: 'MEP', label: 'MEP' },
  { value: 'PRECAST', label: 'Precast' },
  { value: 'COORDINATION', label: 'Coordination' },
  { value: 'AS_BUILT', label: 'As Built' },
  { value: 'OTHER', label: 'Other' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const DRAWING_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
];

const LINKED_STAGE_OPTIONS = [
  { value: 'TECHNICAL_REVIEW', label: 'Technical Review' },
  { value: 'SD_CALCULATION', label: 'SD & Calculation' },
  { value: 'GETTING_APPROVAL', label: 'Getting Approval' },
  { value: 'FD_ISSUANCE', label: 'FD Issuance' },
];

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

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
 * FMP-TECH-01, simplified FMP-TECH-05D — the Drawing Received screen's main
 * form: Sections A (Receipt Details), B (Drawing Information), C
 * (Attachments — a separate component, see DrawingAttachmentsPanel), D
 * (Remarks & Follow-up), plus the footer's 2 distinct actions (Save Draft /
 * Complete). Request Clarification was removed from this screen's UI in
 * FMP-TECH-05D — the flow doesn't yet show who receives it, who owns it, or
 * where it's tracked; Remarks/Internal Notes are the interim way to leave a
 * note. The backend action/endpoint (`requestClarificationAction` /
 * `POST .../clarification`) is untouched and still exists — only this
 * screen's UI wiring to it was removed. One shared `<form>` (so both
 * actions see the same field values) with handlers built from the same
 * FormData snapshot, rather than 2 separate forms.
 */
export function DrawingReceivedForm({ contractId, drawing, attachments, people, canWrite, mode, currentStage, currentUserId, canManageAttachments }: Props): React.JSX.Element {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingIntent, setPendingIntent] = useState<'draft' | 'complete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isActive = mode === 'active';
  const disabled = !canWrite || !isActive || isPending;

  function runAction(
    intent: 'draft' | 'complete',
    action: (contractId: string, formData: FormData) => Promise<{ error: string | null; missing?: string[] }>,
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
      } else if (intent === 'draft') {
        setSuccessMessage('Draft saved.');
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
    // split back to one normal flow: the page itself scrolls, the footer
    // is simply the last thing in the `<form>`. See the page's own doc
    // comment for the full reasoning (05N produced nested scrollbars).
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
        <SectionCard title="Drawing Receipt Details">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Received Date" htmlFor="receivedDate">
              <input
                id="receivedDate" name="receivedDate" type="date" disabled={disabled}
                defaultValue={toDateInputValue(drawing?.receivedDate)} max={new Date().toISOString().slice(0, 10)}
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Received From" htmlFor="receivedFrom">
              <select id="receivedFrom" name="receivedFrom" disabled={disabled} defaultValue={drawing?.receivedFrom ?? ''} className={INPUT_CLS}>
                <option value="">Select…</option>
                {RECEIVED_FROM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Sender Name" htmlFor="senderName">
              <input id="senderName" name="senderName" type="text" disabled={disabled} defaultValue={drawing?.senderName ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Drawing Type" htmlFor="drawingType">
              <select id="drawingType" name="drawingType" disabled={disabled} defaultValue={drawing?.drawingType ?? ''} className={INPUT_CLS}>
                <option value="">Select…</option>
                {DRAWING_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Drawing Reference No" htmlFor="drawingReferenceNo">
              <input id="drawingReferenceNo" name="drawingReferenceNo" type="text" disabled={disabled} defaultValue={drawing?.drawingReferenceNo ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Revision No" htmlFor="revisionNo">
              <input id="revisionNo" name="revisionNo" type="text" disabled={disabled} defaultValue={drawing?.revisionNo ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Number of Sheets" htmlFor="numberOfSheets">
              <input id="numberOfSheets" name="numberOfSheets" type="number" min={1} disabled={disabled} defaultValue={drawing?.numberOfSheets ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Priority" htmlFor="priority">
              <select id="priority" name="priority" disabled={disabled} defaultValue={drawing?.priority ?? 'NORMAL'} className={INPUT_CLS}>
                {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Status" htmlFor="status">
              <select id="status" name="status" disabled={disabled} defaultValue={drawing?.status ?? 'DRAFT'} className={INPUT_CLS}>
                {DRAWING_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>
        </SectionCard>

        {/* FMP-TECH-05C — Drawing Information and Attachments side by side
            on desktop (each its own card, so neither loses its own
            heading/border); stacks back to 1 column on tablet/mobile. */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
          <SectionCard title="Drawing Information">
            <Field label="Drawing Description" htmlFor="drawingDescription">
              <textarea id="drawingDescription" name="drawingDescription" rows={2} disabled={disabled} defaultValue={drawing?.drawingDescription ?? ''} className={INPUT_CLS} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Related Area / Package" htmlFor="relatedAreaPackage">
                <input id="relatedAreaPackage" name="relatedAreaPackage" type="text" disabled={disabled} defaultValue={drawing?.relatedAreaPackage ?? ''} className={INPUT_CLS} />
              </Field>
              <Field label="Linked Workflow Stage" htmlFor="linkedWorkflowStage">
                <select id="linkedWorkflowStage" name="linkedWorkflowStage" disabled={disabled} defaultValue={drawing?.linkedWorkflowStage ?? 'TECHNICAL_REVIEW'} className={INPUT_CLS}>
                  {LINKED_STAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Internal Reference / Intake No" htmlFor="internalReferenceNo">
                <input id="internalReferenceNo" name="internalReferenceNo" type="text" disabled={disabled} defaultValue={drawing?.internalReferenceNo ?? ''} className={INPUT_CLS} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input type="checkbox" name="requiresImmediateReview" disabled={disabled} defaultChecked={drawing?.requiresImmediateReview ?? false} className="rounded border-border" />
                Requires immediate review
              </label>
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input type="checkbox" name="additionalDocumentsReceived" disabled={disabled} defaultChecked={drawing?.additionalDocumentsReceived ?? false} className="rounded border-border" />
                Additional documents received
              </label>
            </div>
          </SectionCard>

          <SectionCard title="Attachments">
            <DrawingAttachmentsPanel
              contractId={contractId}
              attachments={attachments}
              currentUserId={currentUserId}
              canUpload={canWrite && isActive}
              canManage={canManageAttachments && mode !== 'locked'}
            />
          </SectionCard>
        </div>

        <SectionCard title="Remarks & Follow-up">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Remarks" htmlFor="remarks">
              <textarea id="remarks" name="remarks" rows={2} disabled={disabled} defaultValue={drawing?.remarks ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Internal Notes" htmlFor="internalNotes">
              <textarea id="internalNotes" name="internalNotes" rows={2} disabled={disabled} defaultValue={drawing?.internalNotes ?? ''} className={INPUT_CLS} />
            </Field>
            <Field label="Assigned To" htmlFor="assignedToUserId">
              <select id="assignedToUserId" name="assignedToUserId" disabled={disabled} defaultValue={drawing?.assignedToUserId ?? ''} className={INPUT_CLS}>
                <option value="">Select…</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
              </select>
            </Field>
            <Field label="Planned Review Start" htmlFor="plannedReviewStart">
              <input
                id="plannedReviewStart" name="plannedReviewStart" type="date" disabled={disabled}
                defaultValue={toDateInputValue(drawing?.plannedReviewStart)} min={new Date().toISOString().slice(0, 10)}
                className={INPUT_CLS}
              />
            </Field>
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

        {/* Action footer — FMP-TECH-05B introduced this footer, FMP-TECH-05C
            strengthened it into a `sticky` floating bar, but that covered
            part of the form and read as an alarming strip — FMP-TECH-05F
            reverts it to a normal, non-floating footer in the page's own
            flow (the exact same shape SD & Calculation/Getting Approval/FD
            Issuance already use), appearing right after Remarks &
            Follow-up. Save Draft/Complete are hidden entirely (not just
            disabled) once this stage isn't active, leaving only
            navigation. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <a
            href={`/technical/jobs/${contractId}`}
            className="inline-flex items-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-secondary"
          >
            Back to Workflow
          </a>
          {isActive && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button" disabled={disabled} onClick={() => runAction('draft', saveDrawingReceivedDraftAction)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-secondary disabled:opacity-50"
              >
                {isPending && pendingIntent === 'draft' && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                Save Draft
              </button>
              <button
                type="button" disabled={disabled} onClick={() => runAction('complete', completeDrawingReceivedAction)}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
              >
                {isPending && pendingIntent === 'complete' && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                Complete Drawing Receipt &amp; Continue
              </button>
            </div>
          )}
          {mode === 'completed' && currentStage !== 'DRAWING_RECEIVED' && (
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
