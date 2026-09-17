'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Paperclip, Download, Trash2, UploadCloud, Loader2 } from 'lucide-react';
import {
  createErectionMethodStatementApprovalAction,
  updateErectionMethodStatementApprovalAction,
  uploadErectionMethodStatementApprovalAttachmentAction,
  deleteErectionMethodStatementApprovalAttachmentAction,
} from '../../../../../../../actions';
import type { ContractErectionMethodStatement, ContractErectionMethodStatementApproval, ContractActivity } from '@/lib/contracts-api';
import { inputCls, labelCls, gridCls3, InfoBox } from '../../../../../../../_components/contract-form-fields';
import {
  ERECTION_METHOD_STATEMENT_APPROVAL_STATUS_LABELS,
  ERECTION_METHOD_STATEMENT_APPROVAL_STATUS_BADGE_CLASSES,
  ERECTION_METHOD_STATEMENT_APPROVAL_DECISION_LABELS,
  ERECTION_METHOD_STATEMENT_APPROVAL_PRIORITY_OPTIONS,
  validateErectionMethodStatementApprovalFinalValues,
  computeErectionStepTrackerCurrentStep,
} from '../../../../../../../_lib/contract-erection-method-statement-approval-helpers';
import { ErectionWorkflowStepTracker } from '../../_components/erection-workflow-step-tracker';
import { ErectionStaffBackNav } from '../../../../_components/erection-staff-back-nav';
import { ErectionStepGuidance } from '../../../../_components/erection-step-guidance';
import { ErectionPreviewBanner } from '../../../../_components/erection-preview-banner';

interface ContractSummary {
  referenceNumber: string;
  title: string;
  counterpartyName: string;
}

interface Props {
  contractId: string;
  statement: ContractErectionMethodStatement | null;
  approval: ContractErectionMethodStatementApproval | null;
  submittedOn: string | null;
  contract: ContractSummary;
  canUpdate: boolean;
  recentActivity: ContractActivity[];
  /** CM-71H.6 — see erection-method-statement-panel.tsx's own doc comment. Defaults to false (manager-tier, unchanged). */
  isStaffTier?: boolean;
  /** CM-71H.9 — manager-tier-only, only ever true via `?preview=1` (see erection-preview.ts). Defaults to false (unchanged for every existing caller). */
  isPreviewMode?: boolean;
}

type SubmitIntent = 'draft' | 'approve' | 'revision' | 'reject';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** CM-71C — Step 1's OWN submitted attachments, shown read-only (download only, no upload/delete) for the reviewer. Never mutated from Step 2 — see schema.prisma's own model comment for why these live in two separate tables. */
function Step1AttachmentsSection({ contractId, statement }: { contractId: string; statement: ContractErectionMethodStatement }): React.JSX.Element {
  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <p className={labelCls}>Step 1 — Submitted Attachments</p>
      {statement.attachments.length > 0 ? (
        <ul className="space-y-1.5">
          {statement.attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-surface-secondary/50 px-2.5 py-1.5 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Paperclip className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                <span className="truncate text-text-primary font-medium" title={a.originalFileName}>{a.originalFileName}</span>
              </div>
              <a
                href={`/contracts/${contractId}/workflow/erection/method-statement/${statement.id}/attachments/${a.id}/download`}
                className="shrink-0 inline-flex items-center gap-1 text-accent hover:underline"
                title={`Download ${a.originalFileName}`}
              >
                <Download className="size-3.5 shrink-0" aria-hidden="true" />
                Download
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-muted">No documents were attached to Step 1.</p>
      )}
    </div>
  );
}

/** CM-71C — QA/QC's own review attachments (marked-up files, review reports). Same CM-70J-robust local-state pattern as Step 1's AttachmentsSection. */
function ReviewAttachmentsSection({ contractId, approval }: { contractId: string; approval: ContractErectionMethodStatementApproval }): React.JSX.Element {
  const router = useRouter();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  async function handleUploadSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (isUploading) return;

    const formData = new FormData(e.currentTarget);
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setUploadError('Please choose a file before uploading.');
      return;
    }
    setUploadError(null);
    setIsUploading(true);
    try {
      const result = await uploadErectionMethodStatementApprovalAttachmentAction(contractId, approval.id, formData);
      if (result.error) {
        setUploadError(result.error);
        return;
      }
      setFormKey((k) => k + 1);
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Attachment uploaded but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Failed to upload attachment:', err);
      setUploadError('Failed to upload attachment. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(attachmentId: string, fileName: string): Promise<void> {
    if (!window.confirm(`Remove "${fileName}"? This cannot be undone.`)) return;
    setDeletingId(attachmentId);
    try {
      const result = await deleteErectionMethodStatementApprovalAttachmentAction(contractId, approval.id, attachmentId);
      if (result.error) {
        setUploadError(result.error);
        return;
      }
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Attachment deleted but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Failed to delete attachment:', err);
      setUploadError('Failed to delete attachment. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <p className={labelCls}>Review Attachments (Step 2)</p>

      {approval.attachments.length > 0 ? (
        <ul className="space-y-1.5">
          {approval.attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-surface-secondary/50 px-2.5 py-1.5 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Paperclip className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                <span className="truncate text-text-primary font-medium" title={a.originalFileName}>{a.originalFileName}</span>
                <span className="shrink-0 text-text-muted">{a.uploadedByUser ? ` · ${a.uploadedByUser.displayName}` : ''}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/contracts/${contractId}/workflow/erection/method-statement/approval/${approval.id}/attachments/${a.id}/download`}
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                  title={`Download ${a.originalFileName}`}
                >
                  <Download className="size-3.5 shrink-0" aria-hidden="true" />
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id, a.originalFileName)}
                  disabled={deletingId === a.id}
                  className="inline-flex items-center gap-1 text-text-muted hover:text-error focus:outline-none disabled:opacity-50"
                  title={`Delete ${a.originalFileName}`}
                >
                  <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-muted">No review attachments uploaded yet.</p>
      )}

      <form key={formKey} onSubmit={handleUploadSubmit} className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          name="file"
          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx"
          onChange={() => setUploadError(null)}
          className="flex-1 min-w-40 text-xs text-text-secondary file:mr-2 file:rounded-md file:border file:border-border file:bg-surface file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-text-primary hover:file:bg-surface-secondary"
        />
        <button
          type="submit"
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
        >
          {isUploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <UploadCloud className="size-3.5 shrink-0" aria-hidden="true" />}
          {isUploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>
      {uploadError && <p className="text-xs text-error">{uploadError}</p>}
      <p className="text-[11px] text-text-muted">Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx). Max 10MB.</p>
    </div>
  );
}

/**
 * CM-71C — Erection Workflow, Step 2: Erection Method Statement Approval.
 * Same "create-once, edit-forever" shape as Step 1 (mode derived from
 * whether `approval` is null). Written using the CM-70J robust save
 * pattern. Decision is a real, visible, required `<select>` — but each of
 * the 3 final-action buttons sets it (and reviewStatus) directly when
 * clicked, so the user never has to separately pre-select it and then
 * click a matching button; the two can never drift out of sync.
 */
export function ErectionMethodStatementApprovalPanel({
  contractId,
  statement,
  approval,
  submittedOn,
  contract,
  canUpdate,
  recentActivity,
  isStaffTier = false,
  isPreviewMode = false,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [decision, setDecision] = useState(approval?.decision ?? '');
  const [requiresClientApproval, setRequiresClientApproval] = useState(approval?.requiresClientApproval ?? true);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const submitIntentRef = useRef<SubmitIntent>('draft');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, intent: SubmitIntent): Promise<void> {
    e.preventDefault();
    if (isSaving) return;

    const formData = new FormData(e.currentTarget);

    if (intent !== 'draft') {
      const errors = validateErectionMethodStatementApprovalFinalValues({
        reviewRequiredBy: String(formData.get('reviewRequiredBy') ?? ''),
        reviewingEngineer: String(formData.get('reviewingEngineer') ?? ''),
        reviewType: String(formData.get('reviewType') ?? ''),
        comments: String(formData.get('comments') ?? ''),
      });
      if (errors.length > 0) {
        setClientError(errors.join(' '));
        setSavedMessage(null);
        return;
      }
    }

    const reviewStatus =
      intent === 'draft' ? 'DRAFT_REVIEW' : intent === 'approve' ? 'APPROVED' : intent === 'revision' ? 'REVISION_REQUESTED' : 'REJECTED';
    const newDecision = intent === 'draft' ? decision : intent === 'approve' ? 'APPROVE' : intent === 'revision' ? 'REQUEST_REVISION' : 'REJECT';
    setDecision(newDecision);

    formData.set('reviewStatus', reviewStatus);
    formData.set('decision', newDecision);
    formData.set('requiresClientApproval', requiresClientApproval ? 'true' : 'false');

    setClientError(null);
    setSavedMessage(null);
    setIsSaving(true);
    try {
      const result =
        approval !== null
          ? await updateErectionMethodStatementApprovalAction(approval.id, contractId, formData)
          : await createErectionMethodStatementApprovalAction(contractId, formData);
      if (result.error) {
        setClientError(result.error);
        return;
      }
      setSavedMessage(
        intent === 'draft'
          ? 'Draft saved.'
          : intent === 'approve'
            ? 'Approved and forwarded.'
            : intent === 'revision'
              ? 'Revision requested.'
              : 'Rejected.',
      );
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Method Statement Approval saved but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Failed to save Method Statement Approval:', err);
      setClientError('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  // CM-71H.9 — Manager Preview Mode: a manager-tier viewer who explicitly
  // asked to preview (?preview=1) sees the full screen layout below instead
  // of this early return, even though Step 1 hasn't been submitted yet.
  // Every other viewer (including a manager NOT in preview mode) keeps the
  // exact same honest block as before — real gating is unchanged.
  const prerequisiteMissing = !statement;
  if (prerequisiteMissing && !isPreviewMode) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Erection Method Statement Approval</h1>
          <p className="text-xs text-text-secondary mt-0.5">Erection Workflow · Step 2 of 7</p>
        </div>
        <InfoBox>
          Method Statement has not been submitted yet. Complete Step 1 before approval.
        </InfoBox>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/contracts/${contractId}/workflow/erection/method-statement`}
            className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Go to Step 1
          </Link>
          {isStaffTier && <ErectionStaffBackNav />}
        </div>
      </div>
    );
  }

  const reviewStatus = approval?.reviewStatus ?? 'PENDING_APPROVAL';
  const statusLabel = ERECTION_METHOD_STATEMENT_APPROVAL_STATUS_LABELS[reviewStatus];
  const statusBadgeClasses = ERECTION_METHOD_STATEMENT_APPROVAL_STATUS_BADGE_CLASSES[reviewStatus];
  const currentStep = computeErectionStepTrackerCurrentStep(statement?.status ?? null, approval?.reviewStatus ?? null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-semibold text-text-primary">Erection Method Statement Approval</h1>
            <span className="inline-flex items-center rounded-full bg-surface-secondary px-2.5 py-0.5 text-[11px] font-medium text-text-secondary">
              QA / QC Team
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusBadgeClasses}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">Erection Workflow · Step 2 of 7</p>
        </div>
        <div className="flex items-center gap-2">
          {approval?.reviewStatus === 'APPROVED' && (
            <Link
              href={`/contracts/${contractId}/workflow/erection/schedule`}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Continue to Step 3 →
            </Link>
          )}
          <Link
            href={`/contracts/${contractId}/workflow/erection/method-statement`}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            View Step 1
          </Link>
          {isStaffTier && <ErectionStaffBackNav />}
          <Link
            href={`/contracts/${contractId}/workflow`}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Back to Workflow
          </Link>
        </div>
      </div>

      <ErectionWorkflowStepTracker currentStep={currentStep} />

      {isPreviewMode && <ErectionPreviewBanner />}

      {(prerequisiteMissing || statement?.status === 'DRAFT') && (
        <InfoBox variant="subtle">
          Method Statement has not been submitted yet. Complete Step 1 before approval.
        </InfoBox>
      )}

      {/* CM-71H.8 — staff-tier never renders this row: no Guidance, and
          Contract Summary moves into the sidebar (aligned with the form
          top) instead of floating alone above it. Manager-tier unchanged. */}
      {!isStaffTier && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ErectionStepGuidance>
            <ul className="list-disc list-inside space-y-1 text-xs text-text-secondary">
              <li>Review the Erection Method Statement and all attached documents.</li>
              <li>Verify compliance with project requirements, codes, standards, safety requirements, and client specifications.</li>
              <li>Approve, request revision, or reject with comments.</li>
            </ul>
          </ErectionStepGuidance>

          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Contract Summary</h2>
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-text-muted">Contract ID</dt>
                <dd className="font-medium text-text-primary font-mono mt-0.5">{contract.referenceNumber}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Contract Name</dt>
                <dd className="font-medium text-text-primary mt-0.5">{contract.title}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Client / Project</dt>
                <dd className="font-medium text-text-primary mt-0.5">{contract.counterpartyName}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Main Contractor</dt>
                <dd className="font-medium text-text-primary mt-0.5">—</dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <form
            id="erection-method-statement-approval-form"
            onSubmit={(e) => { void handleSubmit(e, submitIntentRef.current); }}
            className="rounded-lg border border-border bg-surface p-4 space-y-4"
          >
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Erection Method Statement Approval Information</h2>

            {clientError && (
              <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
                {clientError}
              </div>
            )}
            {savedMessage && !clientError && (
              <div className="rounded-md border border-success/40 bg-success-light px-4 py-3 text-sm text-success">
                {savedMessage}
              </div>
            )}

            <div className={gridCls3}>
              <div>
                <span className={labelCls}>EMS Reference No.</span>
                <p className="text-sm text-text-primary py-2">{statement?.methodStatementRefNo ?? 'Not submitted yet'}</p>
              </div>
              <div>
                <span className={labelCls}>EMS Issued Date</span>
                <p className="text-sm text-text-primary py-2">{statement ? formatDate(statement.plannedIssueDate) : 'Not submitted yet'}</p>
              </div>
              <div>
                <span className={labelCls}>Submitted By</span>
                <p className="text-sm text-text-primary py-2">{statement?.preparedBy || 'Not submitted yet'}</p>
              </div>
            </div>
            <div>
              <span className={labelCls}>Submitted On</span>
              <p className="text-sm text-text-primary py-2">{statement ? formatDateTime(submittedOn) : 'Not submitted yet'}</p>
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted pt-1">Review</p>

            <div className={gridCls3}>
              <div>
                <label htmlFor="reviewRequiredBy" className={labelCls}>
                  Review Required By <span className="text-error">*</span>
                </label>
                <input
                  id="reviewRequiredBy"
                  name="reviewRequiredBy"
                  type="date"
                  defaultValue={approval?.reviewRequiredBy ?? ''}
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="reviewingEngineer" className={labelCls}>
                  Reviewing Engineer <span className="text-error">*</span>
                </label>
                <input
                  id="reviewingEngineer"
                  name="reviewingEngineer"
                  type="text"
                  maxLength={150}
                  defaultValue={approval?.reviewingEngineer ?? ''}
                  placeholder="e.g. QA/QC Engineer"
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="reviewType" className={labelCls}>
                  Review Type <span className="text-error">*</span>
                </label>
                <input
                  id="reviewType"
                  name="reviewType"
                  type="text"
                  maxLength={150}
                  defaultValue={approval?.reviewType ?? ''}
                  placeholder="e.g. Technical & Safety Review"
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
            </div>

            <div className={gridCls3}>
              <div>
                <label htmlFor="priority" className={labelCls}>
                  Priority <span className="text-error">*</span>
                </label>
                <select id="priority" name="priority" defaultValue={approval?.priority ?? 'MEDIUM'} disabled={!canUpdate} className={inputCls}>
                  {ERECTION_METHOD_STATEMENT_APPROVAL_PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className={labelCls}>Review Status</span>
                <p className="text-sm text-text-primary py-2">{statusLabel}</p>
              </div>
              <div>
                <label htmlFor="decision" className={labelCls}>
                  Decision <span className="text-error">*</span>
                </label>
                <select
                  id="decision"
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  disabled={!canUpdate}
                  className={inputCls}
                >
                  <option value="" disabled>— Select —</option>
                  {(['APPROVE', 'REQUEST_REVISION', 'REJECT'] as const).map((d) => (
                    <option key={d} value={d}>{ERECTION_METHOD_STATEMENT_APPROVAL_DECISION_LABELS[d]}</option>
                  ))}
                </select>
                <p className="text-[11px] text-text-muted mt-1">Set automatically by the action button you use below.</p>
              </div>
            </div>

            <div>
              <label htmlFor="requiresClientApproval" className={labelCls}>Requires Client Approval</label>
              <select
                id="requiresClientApproval"
                value={requiresClientApproval ? 'true' : 'false'}
                onChange={(e) => setRequiresClientApproval(e.target.value === 'true')}
                disabled={!canUpdate}
                className={`${inputCls} max-w-xs`}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            <div>
              <label htmlFor="comments" className={labelCls}>
                Comments / Review Notes <span className="text-error">*</span>
              </label>
              <textarea
                id="comments"
                name="comments"
                rows={4}
                maxLength={10000}
                defaultValue={approval?.comments ?? ''}
                disabled={!canUpdate}
                className={`${inputCls} resize-y`}
              />
            </div>

            {statement ? (
              <Step1AttachmentsSection contractId={contractId} statement={statement} />
            ) : (
              <InfoBox variant="subtle">Not submitted yet.</InfoBox>
            )}

            {approval ? (
              <ReviewAttachmentsSection contractId={contractId} approval={approval} />
            ) : (
              <InfoBox variant="subtle">
                Save this review first (Save Draft). Then upload review attachments or marked-up files.
              </InfoBox>
            )}

            {/* CM-71H.9 — preview mode never enables saving when the real
                prerequisite is missing: same helper text + no buttons at
                all, regardless of the manager's own contracts.update. */}
            {canUpdate && (
              prerequisiteMissing && isPreviewMode ? (
                <p className="text-xs text-text-muted italic pt-2 border-t border-border">
                  Complete previous workflow steps before saving this step.
                </p>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-border">
                  <button
                    type="submit"
                    onClick={() => { submitIntentRef.current = 'draft'; }}
                    disabled={isSaving}
                    className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                  >
                    {isSaving && submitIntentRef.current === 'draft' ? 'Saving…' : 'Save Draft'}
                  </button>
                  <button
                    type="submit"
                    onClick={() => { submitIntentRef.current = 'revision'; }}
                    disabled={isSaving}
                    className="rounded-md border border-warning bg-warning-light px-4 py-2 text-sm font-medium text-warning hover:bg-warning-light/70 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                  >
                    {isSaving && submitIntentRef.current === 'revision' ? 'Saving…' : 'Request Revision'}
                  </button>
                  <button
                    type="submit"
                    onClick={() => { submitIntentRef.current = 'reject'; }}
                    disabled={isSaving}
                    className="rounded-md border border-error bg-error-light px-4 py-2 text-sm font-medium text-error hover:bg-error-light/70 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                  >
                    {isSaving && submitIntentRef.current === 'reject' ? 'Saving…' : 'Reject'}
                  </button>
                  <button
                    type="submit"
                    onClick={() => { submitIntentRef.current = 'approve'; }}
                    disabled={isSaving}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                  >
                    {isSaving && submitIntentRef.current === 'approve' ? 'Saving…' : 'Approve & Forward'}
                  </button>
                </div>
              )
            )}
          </form>
        </div>

        <ErectionMethodStatementApprovalSidebar
          approval={approval}
          recentActivity={recentActivity}
          contract={isStaffTier ? contract : undefined}
        />
      </div>
    </div>
  );
}

const ACTIVITY_EVENT_LABELS: Record<string, string> = {
  erection_method_statement_created: 'Step 1 draft created',
  erection_method_statement_updated: 'Step 1 draft updated',
  erection_method_statement_issued: 'Step 1 issued to client for approval',
  erection_method_statement_attachment_uploaded: 'Step 1 attachment uploaded',
  erection_method_statement_attachment_deleted: 'Step 1 attachment removed',
  erection_method_statement_approval_draft_saved: 'Review draft saved',
  erection_method_statement_approval_approved: 'Approved and forwarded',
  erection_method_statement_approval_revision_requested: 'Revision requested',
  erection_method_statement_approval_rejected: 'Rejected',
  erection_method_statement_approval_attachment_uploaded: 'Review attachment uploaded',
  erection_method_statement_approval_attachment_deleted: 'Review attachment removed',
};

/** CM-71H.8 — `contract` is only ever passed by the staff-tier call site (see erection-method-statement-panel.tsx's own doc comment on this pattern). */
function ErectionMethodStatementApprovalSidebar({
  approval,
  recentActivity,
  contract,
}: {
  approval: ContractErectionMethodStatementApproval | null;
  recentActivity: ContractActivity[];
  contract: { referenceNumber: string; title: string; counterpartyName: string } | undefined;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 min-w-0">
      {contract && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">Contract Summary</h2>
          <dl className="space-y-2 text-xs">
            <div>
              <dt className="text-text-muted">Contract ID</dt>
              <dd className="font-medium text-text-primary font-mono mt-0.5">{contract.referenceNumber}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Contract Name</dt>
              <dd className="font-medium text-text-primary mt-0.5">{contract.title}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Client / Project</dt>
              <dd className="font-medium text-text-primary mt-0.5">{contract.counterpartyName}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Main Contractor</dt>
              <dd className="font-medium text-text-primary mt-0.5">—</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">Workflow Steps</h2>
        <ol className="space-y-1.5 text-xs">
          <li className="text-text-muted">1. Issue Erection Method Statement</li>
          <li className="font-semibold text-text-primary">2. Erection Method Statement Approval</li>
          <li className="text-text-muted">3. Issue Erection Schedule</li>
        </ol>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">Task Details</h2>
        <dl className="space-y-2 text-xs">
          <div>
            <dt className="text-text-muted">Reviewed By</dt>
            <dd className="text-text-primary mt-0.5">{approval?.reviewedByUser?.displayName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Last Updated By</dt>
            <dd className="text-text-primary mt-0.5">{approval?.updatedByUser?.displayName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Last Updated</dt>
            <dd className="text-text-primary mt-0.5">{approval ? formatDateTime(approval.updatedAt) : '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <p className="text-xs text-text-muted">No activity yet.</p>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {recentActivity.map((a) => (
              <li key={a.id} className="text-xs border-b border-border/60 pb-1.5 last:border-0">
                <p className="text-text-secondary">{ACTIVITY_EVENT_LABELS[a.event] ?? a.event}{a.actorName ? ` · ${a.actorName}` : ''}</p>
                <p className="text-text-muted text-[11px]">{formatDateTime(a.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
