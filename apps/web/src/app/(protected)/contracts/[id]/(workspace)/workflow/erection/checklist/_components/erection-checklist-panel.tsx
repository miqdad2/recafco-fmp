'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Paperclip, Download, Trash2, UploadCloud, Loader2, Plus } from 'lucide-react';
import {
  createErectionChecklistAction,
  updateErectionChecklistAction,
  uploadErectionChecklistAttachmentAction,
  deleteErectionChecklistAttachmentAction,
} from '../../../../../../actions';
import type {
  ContractErectionStart,
  ContractErectionChecklist,
  ContractErectionChecklistItemStatus,
  ContractActivity,
} from '@/lib/contracts-api';
import { inputCls, labelCls, gridCls3, InfoBox } from '../../../../../../_components/contract-form-fields';
import {
  ERECTION_CHECKLIST_ITEM_STATUS_LABELS,
  ERECTION_CHECKLIST_TYPE_OPTIONS,
  ERECTION_CHECKLIST_DEFAULT_ITEMS,
  validateErectionChecklistFormValues,
  validateErectionChecklistHoldOrReturnComments,
  validateErectionChecklistSubmitRequirements,
  computeDisplayStatus,
  computeChecklistItemsSummaryPreview,
  computeErectionStepTrackerCurrentStep,
} from '../../../../../../_lib/contract-erection-checklist-helpers';
import { ErectionWorkflowStepTracker } from '../../method-statement/_components/erection-workflow-step-tracker';
import { ErectionStaffBackNav } from '../../../_components/erection-staff-back-nav';
import { ErectionStepGuidance } from '../../../_components/erection-step-guidance';
import { ErectionPreviewBanner } from '../../../_components/erection-preview-banner';

interface ContractSummary {
  referenceNumber: string;
  title: string;
  counterpartyName: string;
}

interface Props {
  contractId: string;
  erectionStart: ContractErectionStart | null;
  checklist: ContractErectionChecklist | null;
  contract: ContractSummary;
  canUpdate: boolean;
  /** Real ContractActivity rows already filtered to Step 5 + Step 6 events (see page.tsx) — never fabricated. */
  recentActivity: ContractActivity[];
  /** CM-71H.6 — see erection-method-statement-panel.tsx's own doc comment. Defaults to false (manager-tier, unchanged). */
  isStaffTier?: boolean;
  /** CM-71H.9 — manager-tier-only, only ever true via `?preview=1` (see erection-preview.ts). Defaults to false (unchanged for every existing caller). */
  isPreviewMode?: boolean;
}

type SubmitIntent = 'draft' | 'submit' | 'verify' | 'hold' | 'return';

interface ChecklistItemFormRow {
  checklistItem: string;
  status: ContractErectionChecklistItemStatus;
  remarks: string;
  attachmentRef: string;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function defaultItemRows(): ChecklistItemFormRow[] {
  return ERECTION_CHECKLIST_DEFAULT_ITEMS.map((checklistItem) => ({ checklistItem, status: 'NOT_COMPLETED' as const, remarks: '', attachmentRef: '' }));
}

/** CM-71G — real, editable Checklist Items table. Local component state only — the whole array is submitted with the main form, and the backend fully replaces the row set on every save (see contract-erection-checklist.service.ts's own update()). Unlike Steps 4/5's own fixed checklists, users may add/remove rows beyond the 12 defaults. */
function ChecklistItemsTable({
  rows,
  setRows,
  canUpdate,
}: {
  rows: ChecklistItemFormRow[];
  setRows: (rows: ChecklistItemFormRow[]) => void;
  canUpdate: boolean;
}): React.JSX.Element {
  function updateRow(index: number, patch: Partial<ChecklistItemFormRow>): void {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function removeRow(index: number): void {
    setRows(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className={labelCls}>Checklist Items</p>
        {canUpdate && (
          <button
            type="button"
            onClick={() => setRows([...rows, { checklistItem: '', status: 'NOT_COMPLETED', remarks: '', attachmentRef: '' }])}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add Item
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-text-muted">No checklist items added yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] divide-y divide-border text-xs">
            <thead>
              <tr className="text-left text-text-muted">
                <th className="py-1.5 pr-2 font-medium w-10">Sr.</th>
                <th className="py-1.5 pr-2 font-medium">Checklist Item</th>
                <th className="py-1.5 pr-2 font-medium w-36">Status</th>
                <th className="py-1.5 pr-2 font-medium">Remarks</th>
                <th className="py-1.5 pr-2 font-medium">Attachment / Reference</th>
                {canUpdate && <th className="py-1.5 w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row, index) => (
                <tr key={index}>
                  <td className="py-1.5 pr-2 text-text-muted">{index + 1}</td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={row.checklistItem}
                      onChange={(e) => updateRow(index, { checklistItem: e.target.value })}
                      disabled={!canUpdate}
                      className={`${inputCls} py-1`}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <select
                      value={row.status}
                      onChange={(e) => updateRow(index, { status: e.target.value as ContractErectionChecklistItemStatus })}
                      disabled={!canUpdate}
                      className={`${inputCls} py-1`}
                    >
                      {(Object.keys(ERECTION_CHECKLIST_ITEM_STATUS_LABELS) as ContractErectionChecklistItemStatus[]).map((s) => (
                        <option key={s} value={s}>{ERECTION_CHECKLIST_ITEM_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={row.remarks}
                      onChange={(e) => updateRow(index, { remarks: e.target.value })}
                      disabled={!canUpdate}
                      className={`${inputCls} py-1`}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={row.attachmentRef}
                      onChange={(e) => updateRow(index, { attachmentRef: e.target.value })}
                      disabled={!canUpdate}
                      placeholder="e.g. EMS-GRM-001 attached"
                      className={`${inputCls} py-1`}
                    />
                  </td>
                  {canUpdate && (
                    <td className="py-1.5">
                      <button type="button" onClick={() => removeRow(index)} className="text-text-muted hover:text-error" title="Remove item">
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-text-muted">
        Attachment / Reference is a free-text field (e.g. a document number or note) — not a linked upload. Use the Attachments section below to upload the actual files.
      </p>
    </div>
  );
}

/** CM-71G — real attachment upload, list, and download/delete. Same CM-70J-robust local-state pattern as Steps 1/2/3/4/5's own AttachmentsSection. */
function AttachmentsSection({ contractId, checklist }: { contractId: string; checklist: ContractErectionChecklist }): React.JSX.Element {
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
      const result = await uploadErectionChecklistAttachmentAction(contractId, checklist.id, formData);
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
      const result = await deleteErectionChecklistAttachmentAction(contractId, checklist.id, attachmentId);
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

      {checklist.attachments.length > 0 ? (
        <ul className="space-y-1.5">
          {checklist.attachments.map((a) => (
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
                  href={`/contracts/${contractId}/workflow/erection/checklist/${checklist.id}/attachments/${a.id}/download`}
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
      <p className="text-[11px] text-text-muted">
        Suggested: Checklist Form, Material Test Reports, Erection Photos, QA/QC Inspection Record.
        Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx). Max 10MB.
      </p>
    </div>
  );
}

/**
 * CM-71G — Erection Workflow, Step 6: Erection Checklist. Owned by the
 * QA / QC Team — the header badge below always reads "QA / QC Team". Same
 * "create-once, edit-forever" shape as Steps 1/3/4/5 (mode derived from
 * whether `checklist` is null). Written using the CM-70J robust save
 * pattern. Required-field validation for Checklist Ref. No./Date/Type/
 * Prepared By runs on every save — Save Draft included; the "at least one
 * item row" requirement only applies to Submit for Verification, per this
 * unit's own field split. Hold/Return additionally require Comments,
 * mirrored server-side by assertCommentsPresentForHoldOrReturn. A "Verify"
 * action (beyond the task's own explicitly-listed buttons) exists so
 * VERIFIED — named as a real header status badge — is actually reachable.
 */
export function ErectionChecklistPanel({
  contractId,
  erectionStart,
  checklist,
  contract,
  canUpdate,
  recentActivity,
  isStaffTier = false,
  isPreviewMode = false,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [clientError, setClientError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [itemRows, setItemRows] = useState<ChecklistItemFormRow[]>(
    checklist
      ? checklist.items.map((i) => ({ checklistItem: i.checklistItem, status: i.status, remarks: i.remarks ?? '', attachmentRef: i.attachmentRef ?? '' }))
      : defaultItemRows(),
  );
  const submitIntentRef = useRef<SubmitIntent>('draft');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, intent: SubmitIntent): Promise<void> {
    e.preventDefault();
    if (isSaving) return;

    const formData = new FormData(e.currentTarget);

    const errors = validateErectionChecklistFormValues({
      checklistRefNo: String(formData.get('checklistRefNo') ?? ''),
      checklistDate: String(formData.get('checklistDate') ?? ''),
      checklistType: String(formData.get('checklistType') ?? ''),
      preparedBy: String(formData.get('preparedBy') ?? ''),
    });
    if (intent === 'submit') {
      errors.push(...validateErectionChecklistSubmitRequirements(itemRows.length));
    }
    if (intent === 'hold' || intent === 'return') {
      errors.push(...validateErectionChecklistHoldOrReturnComments(String(formData.get('comments') ?? '')));
    }
    if (errors.length > 0) {
      setClientError(errors.join(' '));
      setSavedMessage(null);
      return;
    }

    const status =
      intent === 'draft' ? 'DRAFT' : intent === 'submit' ? 'SUBMITTED_FOR_VERIFICATION' : intent === 'verify' ? 'VERIFIED' : intent === 'hold' ? 'HOLD' : 'RETURNED';

    const input = {
      checklistRefNo: String(formData.get('checklistRefNo') ?? ''),
      checklistDate: String(formData.get('checklistDate') ?? ''),
      checklistType: String(formData.get('checklistType') ?? ''),
      preparedBy: String(formData.get('preparedBy') ?? ''),
      reviewedByQaqc: String(formData.get('reviewedByQaqc') ?? ''),
      verifiedByClientRepresentative: String(formData.get('verifiedByClientRepresentative') ?? ''),
      workLocationYard: String(formData.get('workLocationYard') ?? ''),
      comments: String(formData.get('comments') ?? ''),
      status,
      items: itemRows
        .filter((r) => r.checklistItem.trim())
        .map((r) => ({
          checklistItem: r.checklistItem,
          status: r.status,
          ...(r.remarks.trim() ? { remarks: r.remarks } : {}),
          ...(r.attachmentRef.trim() ? { attachmentRef: r.attachmentRef } : {}),
        })),
    };

    setClientError(null);
    setSavedMessage(null);
    setIsSaving(true);
    try {
      const result =
        checklist !== null
          ? await updateErectionChecklistAction(checklist.id, contractId, input)
          : await createErectionChecklistAction(contractId, input);
      if (result.error) {
        setClientError(result.error);
        return;
      }
      setSavedMessage(
        intent === 'draft' ? 'Draft saved.'
          : intent === 'submit' ? 'Submitted for QA/QC verification.'
            : intent === 'verify' ? 'Checklist verified.'
              : intent === 'hold' ? 'Checklist placed on Hold.'
                : 'Checklist returned.',
      );
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Erection Checklist saved but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Failed to save Erection Checklist:', err);
      setClientError('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  // CM-71H.9 — Manager Preview Mode: see erection-method-statement-approval-panel.tsx's own comment on this pattern.
  const prerequisiteMissing = !erectionStart || erectionStart.status !== 'STARTED';
  if (prerequisiteMissing && !isPreviewMode) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Erection Checklist</h1>
          <p className="text-xs text-text-secondary mt-0.5">Erection Workflow · Step 6 of 7</p>
        </div>
        <InfoBox>
          Erection Start has not been confirmed yet.
        </InfoBox>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/contracts/${contractId}/workflow/erection/start`}
            className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Go to Step 5
          </Link>
          {isStaffTier && <ErectionStaffBackNav />}
        </div>
      </div>
    );
  }

  const { label: statusLabel, badgeClasses: statusBadgeClasses } = computeDisplayStatus(
    checklist?.status ?? null,
    validateErectionChecklistFormValues({
      checklistRefNo: checklist?.checklistRefNo ?? '',
      checklistDate: checklist?.checklistDate ?? '',
      checklistType: checklist?.checklistType ?? '',
      preparedBy: checklist?.preparedBy ?? '',
    }),
  );
  const currentStep = computeErectionStepTrackerCurrentStep(erectionStart?.status ?? null, checklist?.status ?? null);
  const itemsSummaryPreview = computeChecklistItemsSummaryPreview(itemRows);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-semibold text-text-primary">Erection Checklist</h1>
            <span className="inline-flex items-center rounded-full bg-surface-secondary px-2.5 py-0.5 text-[11px] font-medium text-text-secondary">
              QA / QC Team
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusBadgeClasses}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">Erection Workflow · Step 6 of 7</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/contracts/${contractId}/workflow/erection/start`}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            View Step 5
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

      {/* CM-71H.8 — staff-tier never renders this row: no Guidance, and
          Contract Summary moves into the sidebar (aligned with the form
          top) instead of floating alone above it. Manager-tier unchanged. */}
      {!isStaffTier && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ErectionStepGuidance>
            <ul className="list-disc list-inside space-y-1 text-xs text-text-secondary">
              <li>Complete the erection checklist to confirm all required items are available, inspected, and released.</li>
              <li>Ensure all inspection records, test reports, safety records, and supporting documents are attached.</li>
              <li>Submit for QA/QC verification before proceeding to payment.</li>
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
            id="erection-checklist-form"
            onSubmit={(e) => { void handleSubmit(e, submitIntentRef.current); }}
            className="rounded-lg border border-border bg-surface p-4 space-y-4"
          >
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Checklist Information</h2>

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
                <label htmlFor="checklistRefNo" className={labelCls}>
                  Checklist Ref. No. <span className="text-error">*</span>
                </label>
                <input
                  id="checklistRefNo" name="checklistRefNo" type="text" maxLength={50}
                  defaultValue={checklist?.checklistRefNo ?? ''} placeholder="e.g. CL-GRM-001"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="checklistDate" className={labelCls}>
                  Checklist Date <span className="text-error">*</span>
                </label>
                <input
                  id="checklistDate" name="checklistDate" type="date"
                  defaultValue={checklist?.checklistDate ?? ''} disabled={!canUpdate} className={inputCls}
                />
              </div>
              <div>
                <span className={labelCls}>Job Order No.</span>
                <p className="text-sm text-text-primary py-2">{checklist?.jobOrderNo ?? 'Auto-fetched on save'}</p>
              </div>
            </div>

            <div className={gridCls3}>
              <div>
                <label htmlFor="checklistType" className={labelCls}>
                  Checklist Type <span className="text-error">*</span>
                </label>
                <select id="checklistType" name="checklistType" defaultValue={checklist?.checklistType ?? ''} disabled={!canUpdate} className={inputCls}>
                  <option value="" disabled>— Select —</option>
                  {ERECTION_CHECKLIST_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="preparedBy" className={labelCls}>
                  Prepared By <span className="text-error">*</span>
                </label>
                <input
                  id="preparedBy" name="preparedBy" type="text" maxLength={150}
                  defaultValue={checklist?.preparedBy ?? ''} placeholder="e.g. Site Supervisor"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
              <div>
                <span className={labelCls}>Status</span>
                <p className="text-sm text-text-primary py-2">{statusLabel}</p>
                <p className="text-[11px] text-text-muted mt-1">Set automatically by the action button you use below.</p>
              </div>
            </div>

            <div className={gridCls3}>
              <div>
                <label htmlFor="reviewedByQaqc" className={labelCls}>Reviewed By (QA/QC)</label>
                <input
                  id="reviewedByQaqc" name="reviewedByQaqc" type="text" maxLength={150}
                  defaultValue={checklist?.reviewedByQaqc ?? ''} placeholder="e.g. QA/QC Engineer"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="verifiedByClientRepresentative" className={labelCls}>Verified By / Client Representative</label>
                <input
                  id="verifiedByClientRepresentative" name="verifiedByClientRepresentative" type="text" maxLength={150}
                  defaultValue={checklist?.verifiedByClientRepresentative ?? ''} placeholder="e.g. Site Coordinator"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="workLocationYard" className={labelCls}>Work Location / Yard</label>
                <input
                  id="workLocationYard" name="workLocationYard" type="text" maxLength={200}
                  defaultValue={checklist?.workLocationYard ?? ''} placeholder="e.g. GRM Site - Boundary Wall Zone A"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
            </div>

            <div>
              <label htmlFor="comments" className={labelCls}>Comments / Notes</label>
              <textarea
                id="comments" name="comments" rows={3} maxLength={10000}
                defaultValue={checklist?.comments ?? ''} placeholder="Required when placing on Hold or Returning."
                disabled={!canUpdate} className={`${inputCls} resize-y`}
              />
              <p className="text-[11px] text-text-muted mt-1">Required to place this checklist on Hold or Return it.</p>
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted pt-1">Checklist Items Summary</p>
            <div className={gridCls3}>
              <div>
                <span className={labelCls}>Total Items</span>
                <p className="text-sm text-text-primary py-2">{itemsSummaryPreview.totalItems}</p>
              </div>
              <div>
                <span className={labelCls}>Completed</span>
                <p className="text-sm text-text-primary py-2">{itemsSummaryPreview.completed}</p>
              </div>
              <div>
                <span className={labelCls}>In Progress</span>
                <p className="text-sm text-text-primary py-2">{itemsSummaryPreview.inProgress}</p>
              </div>
              <div>
                <span className={labelCls}>Not Completed</span>
                <p className="text-sm text-text-primary py-2">{itemsSummaryPreview.notCompleted}</p>
              </div>
              <div>
                <span className={labelCls}>Not Applicable</span>
                <p className="text-sm text-text-primary py-2">{itemsSummaryPreview.notApplicable}</p>
              </div>
            </div>

            <ChecklistItemsTable rows={itemRows} setRows={setItemRows} canUpdate={canUpdate} />

            {checklist ? (
              <AttachmentsSection contractId={contractId} checklist={checklist} />
            ) : (
              <InfoBox variant="subtle">
                Save this Erection Checklist first (Save Draft). Then upload supporting documents.
              </InfoBox>
            )}

            {/* CM-71H.9 — preview mode never enables saving when the real prerequisite is missing. */}
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
                    onClick={() => { submitIntentRef.current = 'return'; }}
                    disabled={isSaving}
                    className="rounded-md border border-warning bg-warning-light px-4 py-2 text-sm font-medium text-warning hover:bg-warning-light/70 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                  >
                    {isSaving && submitIntentRef.current === 'return' ? 'Saving…' : 'Return'}
                  </button>
                  <button
                    type="submit"
                    onClick={() => { submitIntentRef.current = 'hold'; }}
                    disabled={isSaving}
                    className="rounded-md border border-error bg-error-light px-4 py-2 text-sm font-medium text-error hover:bg-error-light/70 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                  >
                    {isSaving && submitIntentRef.current === 'hold' ? 'Saving…' : 'Hold'}
                  </button>
                  <button
                    type="submit"
                    onClick={() => { submitIntentRef.current = 'verify'; }}
                    disabled={isSaving}
                    className="rounded-md border border-success bg-success-light px-4 py-2 text-sm font-medium text-success hover:bg-success-light/70 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                  >
                    {isSaving && submitIntentRef.current === 'verify' ? 'Saving…' : 'Verify'}
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Payment Issued will be available after Step 7 is implemented"
                    className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-muted opacity-60 cursor-not-allowed"
                  >
                    Save & Next Step
                  </button>
                  <button
                    type="submit"
                    onClick={() => { submitIntentRef.current = 'submit'; }}
                    disabled={isSaving}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                  >
                    {isSaving && submitIntentRef.current === 'submit' ? 'Saving…' : 'Submit for Verification'}
                  </button>
                </div>
              )
            )}
          </form>
        </div>

        <ErectionChecklistSidebar
          checklist={checklist}
          recentActivity={recentActivity}
          contract={isStaffTier ? contract : undefined}
        />
      </div>
    </div>
  );
}

const ACTIVITY_EVENT_LABELS: Record<string, string> = {
  erection_start_confirmed: 'Step 5 erection start confirmed',
  erection_start_hold: 'Step 5 erection start placed on Hold',
  erection_start_returned: 'Step 5 erection start returned',
  erection_checklist_draft_saved: 'Checklist draft saved',
  erection_checklist_submitted_for_verification: 'Submitted for QA/QC verification',
  erection_checklist_verified: 'Checklist verified',
  erection_checklist_hold: 'Checklist placed on Hold',
  erection_checklist_returned: 'Checklist returned',
  erection_checklist_attachment_uploaded: 'Attachment uploaded',
  erection_checklist_attachment_deleted: 'Attachment removed',
};

/** CM-71H.8 — `contract` is only ever passed by the staff-tier call site (see erection-method-statement-panel.tsx's own doc comment on this pattern). */
function ErectionChecklistSidebar({
  checklist,
  recentActivity,
  contract,
}: {
  checklist: ContractErectionChecklist | null;
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
          <li className="text-text-muted">2. Erection Method Statement Approval</li>
          <li className="text-text-muted">3. Issue Erection Schedule</li>
          <li className="text-text-muted">4. Delivery Start</li>
          <li className="text-text-muted">5. Erection Start</li>
          <li className="font-semibold text-text-primary">6. Erection Checklist</li>
        </ol>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">Task Details</h2>
        <dl className="space-y-2 text-xs">
          <div>
            <dt className="text-text-muted">Created By</dt>
            <dd className="text-text-primary mt-0.5">{checklist?.createdByUser.displayName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Last Updated By</dt>
            <dd className="text-text-primary mt-0.5">{checklist?.updatedByUser?.displayName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Last Updated</dt>
            <dd className="text-text-primary mt-0.5">{checklist ? formatDateTime(checklist.updatedAt) : '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Submitted On</dt>
            <dd className="text-text-primary mt-0.5">{checklist ? formatDateTime(checklist.submittedAt) : '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Verified On</dt>
            <dd className="text-text-primary mt-0.5">{checklist ? formatDateTime(checklist.verifiedAt) : '—'}</dd>
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
