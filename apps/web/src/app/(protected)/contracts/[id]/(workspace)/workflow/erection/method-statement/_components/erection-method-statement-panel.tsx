'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Paperclip, Download, Trash2, UploadCloud, Loader2 } from 'lucide-react';
import {
  createErectionMethodStatementAction,
  updateErectionMethodStatementAction,
  uploadErectionMethodStatementAttachmentAction,
  deleteErectionMethodStatementAttachmentAction,
} from '../../../../../../actions';
import type { ContractErectionMethodStatement, ContractActivity } from '@/lib/contracts-api';
import { inputCls, labelCls, gridCls3, InfoBox } from '../../../../../../_components/contract-form-fields';
import {
  validateErectionMethodStatementFormValues,
  computeDisplayStatus,
} from '../../../../../../_lib/contract-erection-method-statement-helpers';
import { ErectionWorkflowStepTracker } from './erection-workflow-step-tracker';
import { ErectionStaffBackNav } from '../../../_components/erection-staff-back-nav';
import { ErectionStepGuidance } from '../../../_components/erection-step-guidance';
import { ErectionPreviewBanner } from '../../../_components/erection-preview-banner';

interface ContractSummary {
  referenceNumber: string;
  title: string;
  counterpartyName: string;
  /** CM-71H.7 — when the contract already has its own Job Order No., Step 1's own field is auto-fetched from it and shown read-only instead of free-typed. */
  jobOrderNo: string | null;
}

interface Props {
  contractId: string;
  statement: ContractErectionMethodStatement | null;
  contract: ContractSummary;
  canUpdate: boolean;
  /** Real ContractActivity rows already filtered to this feature's own events (see page.tsx) — never fabricated. */
  recentActivity: ContractActivity[];
  /** CM-71H.6 — Contract Staff / Erection Manager viewer: adds Back to Erection Dashboard / Back to My Tasks links and collapses Step Guidance by default. Defaults to false (manager-tier, unchanged) so every existing caller (and CM-71A-G's own tests) keeps its current behavior without needing to pass this. */
  isStaffTier?: boolean;
  /** CM-71H.9 — manager-tier-only, only ever true via `?preview=1` (see erection-preview.ts). Step 1 has no prerequisite so this only shows the banner — it never gates anything here. Defaults to false. */
  isPreviewMode?: boolean;
}

/**
 * CM-71A — real attachment upload, list, and download/delete alongside the
 * method statement's own fields. Its own local state (not useActionState) —
 * this is a brand-new feature written from day one using the CM-70J robust
 * pattern, so there was never a fragile submittedRef/useEffect version to
 * migrate away from. Only rendered once the statement already exists (a
 * real id is required to attach files to) — matching the established
 * Variations/Documents "save first, then attach" convention.
 */
function AttachmentsSection({ contractId, statement }: { contractId: string; statement: ContractErectionMethodStatement }): React.JSX.Element {
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
      const result = await uploadErectionMethodStatementAttachmentAction(contractId, statement.id, formData);
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
      const result = await deleteErectionMethodStatementAttachmentAction(contractId, statement.id, attachmentId);
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
      <p className={labelCls}>Attachments</p>

      {statement.attachments.length > 0 ? (
        <ul className="space-y-1.5">
          {statement.attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-surface-secondary/50 px-2.5 py-1.5 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Paperclip className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                <span className="truncate text-text-primary font-medium" title={a.originalFileName}>{a.originalFileName}</span>
                <span className="shrink-0 text-text-muted">
                  {a.uploadedByUser ? ` · ${a.uploadedByUser.displayName}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/contracts/${contractId}/workflow/erection/method-statement/${statement.id}/attachments/${a.id}/download`}
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
        <p className="text-xs text-text-muted">No supporting documents uploaded yet.</p>
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
 * CM-71A — Erection Workflow, Step 1: Issue Erection Method Statement.
 * Single-record-per-contract screen (create-once, then edit-forever, like
 * a "one Add/Edit modal inlined into a full page" — mode is derived purely
 * from whether `statement` is null, matching every Add/Edit modal's own
 * mode prop elsewhere in this module). Written from day one using the
 * CM-70J robust save pattern: explicit `isSaving`, try/catch/finally,
 * unconditional error display, router.refresh() failures logged but never
 * blocking. Required-field validation (validateErectionMethodStatementFormValues)
 * runs on every save — Save Draft included — since every required field
 * here (Ref No, Job Order No, Work Location, Prepared By, Department/Area,
 * Scope/Description) is a real, non-nullable database column; there is no
 * genuinely valid "partial draft" state below that floor.
 */
export function ErectionMethodStatementPanel({ contractId, statement, contract, canUpdate, recentActivity, isStaffTier = false, isPreviewMode = false }: Props): React.JSX.Element {
  const router = useRouter();
  const [requiresClientApproval, setRequiresClientApproval] = useState(statement?.requiresClientApproval ?? true);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const submitIntentRef = useRef<'draft' | 'issue' | 'next'>('draft');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, intent: 'draft' | 'issue' | 'next'): Promise<void> {
    e.preventDefault();
    if (isSaving) return;

    const formData = new FormData(e.currentTarget);
    const errors = validateErectionMethodStatementFormValues({
      plannedIssueDate: String(formData.get('plannedIssueDate') ?? ''),
      methodStatementRefNo: String(formData.get('methodStatementRefNo') ?? ''),
      jobOrderNo: String(formData.get('jobOrderNo') ?? ''),
      workLocationYard: String(formData.get('workLocationYard') ?? ''),
      preparedBy: String(formData.get('preparedBy') ?? ''),
      departmentArea: String(formData.get('departmentArea') ?? ''),
      scopeDescription: String(formData.get('scopeDescription') ?? ''),
    });
    if (errors.length > 0) {
      setClientError(errors.join(' '));
      setSavedMessage(null);
      return;
    }

    formData.set(
      'status',
      intent === 'draft' ? 'DRAFT' : intent === 'issue' ? (requiresClientApproval ? 'SUBMITTED_FOR_APPROVAL' : 'ISSUED') : (statement?.status ?? 'DRAFT'),
    );
    formData.set('requiresClientApproval', requiresClientApproval ? 'true' : 'false');

    setClientError(null);
    setSavedMessage(null);
    setIsSaving(true);
    try {
      const result =
        statement !== null
          ? await updateErectionMethodStatementAction(statement.id, contractId, formData)
          : await createErectionMethodStatementAction(contractId, formData);
      if (result.error) {
        setClientError(result.error);
        return;
      }
      setSavedMessage(intent === 'draft' ? 'Draft saved.' : intent === 'issue' ? 'Issued to client for approval.' : 'Saved.');
      if (intent === 'next') {
        router.push(`/contracts/${contractId}/workflow/erection/method-statement/approval`);
        return;
      }
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Erection Method Statement saved but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Failed to save Erection Method Statement:', err);
      setClientError('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  const { label: statusLabel, badgeClasses: statusBadgeClasses } = computeDisplayStatus(
    statement?.status ?? null,
    validateErectionMethodStatementFormValues({
      plannedIssueDate: statement?.plannedIssueDate ?? '',
      methodStatementRefNo: statement?.methodStatementRefNo ?? '',
      jobOrderNo: statement?.jobOrderNo ?? '',
      workLocationYard: statement?.workLocationYard ?? '',
      preparedBy: statement?.preparedBy ?? '',
      departmentArea: statement?.departmentArea ?? '',
      scopeDescription: statement?.scopeDescription ?? '',
    }),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-semibold text-text-primary">Issue Erection Method Statement</h1>
            <span className="inline-flex items-center rounded-full bg-surface-secondary px-2.5 py-0.5 text-[11px] font-medium text-text-secondary">
              Site Team
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusBadgeClasses}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">Erection Workflow · Step 1 of 7</p>
        </div>
        <div className="flex items-center gap-2">
          {statement && (statement.status === 'SUBMITTED_FOR_APPROVAL' || statement.status === 'ISSUED') && (
            <Link
              href={`/contracts/${contractId}/workflow/erection/method-statement/approval`}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Continue to Step 2 →
            </Link>
          )}
          {isStaffTier && <ErectionStaffBackNav />}
          <Link
            href={`/contracts/${contractId}/workflow`}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Back to Workflow
          </Link>
        </div>
      </div>

      <ErectionWorkflowStepTracker currentStep={1} />

      {isPreviewMode && <ErectionPreviewBanner />}

      {/* CM-71H.8 — staff-tier never renders this row at all: no Guidance,
          and Contract Summary moves into the sidebar below (aligned with
          the form top) instead of floating alone above it. Manager-tier is
          byte-for-byte unchanged. */}
      {!isStaffTier && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ErectionStepGuidance>
            <ul className="list-disc list-inside space-y-1 text-xs text-text-secondary">
              <li>Prepare and issue the Erection Method Statement as per contract requirements.</li>
              <li>Ensure the statement covers methodology, equipment, manpower, safety, lifting, quality, and sequence of erection.</li>
              <li>Attach supporting documents and drawings before issuing to the client for approval.</li>
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
            id="erection-method-statement-form"
            onSubmit={(e) => { void handleSubmit(e, submitIntentRef.current); }}
            className="rounded-lg border border-border bg-surface p-4 space-y-4"
          >
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Erection Method Statement Information</h2>

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
                <label htmlFor="plannedIssueDate" className={labelCls}>
                  Planned Issue Date <span className="text-error">*</span>
                </label>
                <input
                  id="plannedIssueDate"
                  name="plannedIssueDate"
                  type="date"
                  defaultValue={statement?.plannedIssueDate ?? ''}
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="methodStatementRefNo" className={labelCls}>
                  Method Statement Ref. No. <span className="text-error">*</span>
                </label>
                <input
                  id="methodStatementRefNo"
                  name="methodStatementRefNo"
                  type="text"
                  maxLength={50}
                  defaultValue={statement?.methodStatementRefNo ?? ''}
                  placeholder="e.g. EMS-GRM-001"
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="jobOrderNo" className={labelCls}>
                  Job Order No. <span className="text-error">*</span>
                </label>
                {contract.jobOrderNo ? (
                  <>
                    <p className="text-sm text-text-primary py-2">{contract.jobOrderNo}</p>
                    <input id="jobOrderNo" name="jobOrderNo" type="hidden" value={contract.jobOrderNo} />
                  </>
                ) : (
                  <input
                    id="jobOrderNo"
                    name="jobOrderNo"
                    type="text"
                    maxLength={50}
                    defaultValue={statement?.jobOrderNo ?? ''}
                    placeholder="e.g. JO-004/26"
                    disabled={!canUpdate}
                    className={inputCls}
                  />
                )}
              </div>
            </div>

            <div className={gridCls3}>
              <div>
                <label htmlFor="workLocationYard" className={labelCls}>
                  Work Location / Yard <span className="text-error">*</span>
                </label>
                <input
                  id="workLocationYard"
                  name="workLocationYard"
                  type="text"
                  maxLength={200}
                  defaultValue={statement?.workLocationYard ?? ''}
                  placeholder="e.g. Site - Boundary Wall Zone A"
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="preparedBy" className={labelCls}>
                  Prepared By <span className="text-error">*</span>
                </label>
                <input
                  id="preparedBy"
                  name="preparedBy"
                  type="text"
                  maxLength={150}
                  defaultValue={statement?.preparedBy ?? ''}
                  placeholder="e.g. Site Engineer"
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
              <div>
                {/* CM-71H.4 — visible label only; backend field name (departmentArea) and column stay unchanged. */}
                <label htmlFor="departmentArea" className={labelCls}>
                  Responsible Department / Team <span className="text-error">*</span>
                </label>
                <input
                  id="departmentArea"
                  name="departmentArea"
                  type="text"
                  maxLength={150}
                  defaultValue={statement?.departmentArea ?? ''}
                  placeholder="e.g. Site - Erection"
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
            </div>

            <div className={gridCls3}>
              <div>
                <label htmlFor="reviewedByInternal" className={labelCls}>Reviewed By Internal</label>
                <input
                  id="reviewedByInternal"
                  name="reviewedByInternal"
                  type="text"
                  maxLength={150}
                  defaultValue={statement?.reviewedByInternal ?? ''}
                  placeholder="e.g. Contract Manager"
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="documentRevision" className={labelCls}>Document Revision</label>
                <input
                  id="documentRevision"
                  name="documentRevision"
                  type="text"
                  maxLength={50}
                  defaultValue={statement?.documentRevision ?? ''}
                  placeholder="e.g. Rev. 0"
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="applicableStandards" className={labelCls}>Applicable Standards</label>
                <input
                  id="applicableStandards"
                  name="applicableStandards"
                  type="text"
                  maxLength={2000}
                  defaultValue={statement?.applicableStandards ?? ''}
                  placeholder="e.g. Company HSE Plan, Approved Shop Drawing"
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
            </div>

            <div className={gridCls3}>
              <div>
                <label htmlFor="includesLiftPlan" className={labelCls}>Includes Lift Plan</label>
                <select
                  id="includesLiftPlan"
                  name="includesLiftPlan"
                  defaultValue={String(statement?.includesLiftPlan ?? false)}
                  disabled={!canUpdate}
                  className={inputCls}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div>
                <label htmlFor="includesRiskAssessment" className={labelCls}>Includes Risk Assessment</label>
                <select
                  id="includesRiskAssessment"
                  name="includesRiskAssessment"
                  defaultValue={String(statement?.includesRiskAssessment ?? false)}
                  disabled={!canUpdate}
                  className={inputCls}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div>
                <label htmlFor="requiresClientApproval" className={labelCls}>Requires Client Approval</label>
                <select
                  id="requiresClientApproval"
                  value={requiresClientApproval ? 'true' : 'false'}
                  onChange={(e) => setRequiresClientApproval(e.target.value === 'true')}
                  disabled={!canUpdate}
                  className={inputCls}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
                <p className="text-[11px] text-text-muted mt-1">
                  {requiresClientApproval
                    ? 'Issuing will set status to "Submitted for Approval".'
                    : 'Issuing will set status directly to "Issued" (no client approval required).'}
                </p>
              </div>
            </div>
            {/* requiresClientApproval is a controlled select above (needs live
                value for the status-on-issue computation) — its own value is
                re-submitted as a hidden field just before dispatch (see
                handleSubmit), so the visible <select> itself does not need a
                name attribute of its own. */}

            <div>
              <label htmlFor="scopeDescription" className={labelCls}>
                Scope / Description <span className="text-error">*</span>
              </label>
              <textarea
                id="scopeDescription"
                name="scopeDescription"
                rows={4}
                maxLength={10000}
                defaultValue={statement?.scopeDescription ?? ''}
                disabled={!canUpdate}
                className={`${inputCls} resize-y`}
              />
            </div>

            {statement ? (
              <AttachmentsSection contractId={contractId} statement={statement} />
            ) : (
              <InfoBox variant="subtle">
                Save this Method Statement first (Save Draft). Then upload supporting documents and drawings.
              </InfoBox>
            )}

            {canUpdate && (
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
                  onClick={() => { submitIntentRef.current = 'issue'; }}
                  disabled={isSaving}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                >
                  {isSaving && submitIntentRef.current === 'issue' ? 'Saving…' : 'Issue to Client for Approval'}
                </button>
                <button
                  type="submit"
                  onClick={() => { submitIntentRef.current = 'next'; }}
                  disabled={isSaving}
                  title="Save and continue to Step 2 — Erection Method Statement Approval"
                  className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                >
                  {isSaving && submitIntentRef.current === 'next' ? 'Saving…' : 'Save & Next Step'}
                </button>
              </div>
            )}
          </form>
        </div>

        <ErectionMethodStatementSidebar
          statement={statement}
          recentActivity={recentActivity}
          contract={isStaffTier ? contract : undefined}
        />
      </div>
    </div>
  );
}

const ACTIVITY_EVENT_LABELS: Record<string, string> = {
  erection_method_statement_created: 'Draft created',
  erection_method_statement_updated: 'Draft updated',
  erection_method_statement_issued: 'Issued to client for approval',
  erection_method_statement_attachment_uploaded: 'Attachment uploaded',
  erection_method_statement_attachment_deleted: 'Attachment removed',
};

/**
 * CM-71H.8 — `contract` is only ever passed by the staff-tier call site
 * (Contract Summary moves down here, as the sidebar's first card, instead
 * of floating alone above the form); manager-tier omits it and keeps the
 * separate top-of-page Contract Summary card it already had since CM-71A.
 */
function ErectionMethodStatementSidebar({
  statement,
  recentActivity,
  contract,
}: {
  statement: ContractErectionMethodStatement | null;
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
          <li className="font-semibold text-text-primary">1. Issue Erection Method Statement</li>
          <li className="text-text-muted">2. Erection Method Statement Approval</li>
          <li className="text-text-muted">3. Issue Erection Schedule</li>
        </ol>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">Task Details</h2>
        <dl className="space-y-2 text-xs">
          <div>
            <dt className="text-text-muted">Created By</dt>
            <dd className="text-text-primary mt-0.5">{statement?.createdByUser.displayName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Last Updated By</dt>
            <dd className="text-text-primary mt-0.5">{statement?.updatedByUser?.displayName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Last Updated</dt>
            <dd className="text-text-primary mt-0.5">
              {statement ? new Date(statement.updatedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <p className="text-xs text-text-muted">No activity yet — save a draft to begin.</p>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {recentActivity.map((a) => (
              <li key={a.id} className="text-xs border-b border-border/60 pb-1.5 last:border-0">
                <p className="text-text-secondary">{ACTIVITY_EVENT_LABELS[a.event] ?? a.event}{a.actorName ? ` · ${a.actorName}` : ''}</p>
                <p className="text-text-muted text-[11px]">
                  {new Date(a.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
