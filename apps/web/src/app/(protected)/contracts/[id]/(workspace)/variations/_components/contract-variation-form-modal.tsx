'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Paperclip, Download, UploadCloud } from 'lucide-react';
import type { ActionResult } from '../../../../actions';
import { createVariationAction, updateVariationAction, uploadVariationAttachmentAction } from '../../../../actions';
import type { ContractVariation, ContractVariationAttachment, ContractVariationStatus } from '@/lib/contracts-api';
import { inputCls, labelCls, InfoBox } from '../../../../_components/contract-form-fields';
import {
  VARIATION_STATUS_OPTIONS,
  isSubmittedDateRequired,
  isApprovedDateRequired,
  validateVariationFormValues,
} from '../../../../_lib/contract-variation-helpers';

interface Props {
  contractId: string;
  mode: 'add' | 'edit';
  variation?: ContractVariation;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * CM-60C — real supporting-document upload, list, and download, alongside
 * this variation's own Add/Edit fields. Its own separate useActionState/form
 * (uploadVariationAttachmentAction) — a file upload is a genuinely different
 * action from saving the variation's own fields, not bundled into the same
 * submit. The attachment list is seeded from `variation.attachments`
 * (already embedded in the fetch that produced this prop — no extra round
 * trip to open the modal) and refetched via the real list endpoint
 * (through a client-fetchable JSON proxy route) after each successful
 * upload, so multiple uploads in one modal session all show up immediately
 * without closing/reopening.
 */
function SupportingDocumentsSection({ contractId, variation }: { contractId: string; variation: ContractVariation }): React.JSX.Element {
  const [attachments, setAttachments] = useState<ContractVariationAttachment[]>(variation.attachments);
  const uploadAction = uploadVariationAttachmentAction.bind(null, contractId, variation.id);
  const [uploadState, uploadFormAction, isUploading] = useActionState<ActionResult, FormData>(uploadAction, { error: null });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSubmittedRef = useRef(false);

  useEffect(() => {
    if (uploadSubmittedRef.current && !isUploading && !uploadState.error) {
      uploadSubmittedRef.current = false;
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetch(`/contracts/${contractId}/variations/${variation.id}/attachments`)
        .then((res) => (res.ok ? res.json() : null))
        .then((json: { data?: ContractVariationAttachment[] } | null) => {
          if (json?.data) setAttachments(json.data);
        })
        .catch(() => undefined);
    }
  }, [uploadState, isUploading, contractId, variation.id]);

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <p className={labelCls}>Supporting Documents</p>

      {attachments.length > 0 ? (
        <ul className="space-y-1.5">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-surface-secondary/50 px-2.5 py-1.5 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Paperclip className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                <span className="truncate text-text-primary font-medium" title={a.originalFileName}>{a.originalFileName}</span>
                <span className="shrink-0 text-text-muted">
                  {formatFileSize(a.fileSize)} · {formatUploadedDate(a.createdAt)}
                  {a.uploadedByUser ? ` · ${a.uploadedByUser.displayName}` : ''}
                </span>
              </div>
              <a
                href={`/contracts/${contractId}/variations/${variation.id}/attachments/${a.id}/download`}
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
        <p className="text-xs text-text-muted">No supporting documents uploaded yet.</p>
      )}

      <form
        action={uploadFormAction}
        onSubmit={() => { uploadSubmittedRef.current = true; }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx"
          className="flex-1 min-w-40 text-xs text-text-secondary file:mr-2 file:rounded-md file:border file:border-border file:bg-surface file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-text-primary hover:file:bg-surface-secondary"
        />
        <button
          type="submit"
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
        >
          <UploadCloud className="size-3.5 shrink-0" aria-hidden="true" />
          {isUploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>
      {uploadState.error && <p className="text-xs text-error">{uploadState.error}</p>}
      <p className="text-[11px] text-text-muted">Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx). Max 10MB.</p>
    </div>
  );
}

/**
 * CM-60 — Add / Edit Variation modal. Description and Amount are the only
 * required fields (per this unit's task — a meaningful variation record
 * needs at least those two); everything else is optional. Amount allows a
 * negative value (a deductive variation) — no client-side floor.
 * CM-60C — Supporting Documents is now a real upload (see
 * SupportingDocumentsSection above), shown only in Edit mode since an
 * upload needs a real variationId to attach to. Add mode shows an honest
 * note instead of a fake/disabled upload control — save the variation
 * first, then attach files from Edit. supportingDocumentName/
 * supportingDocumentUrl (the older plain text/link fields from CM-60) are
 * kept, unrenamed, for backwards compatibility with any variation that
 * already used them.
 * CM-70C — Status now drives date requirements rather than the reverse:
 * Submitted Date is required once status leaves Draft, Approved Date only
 * once status is Approved. Both are enforced by validateVariationFormValues
 * (contract-variation-helpers.ts) as a single pre-submit pass, shown as a
 * visible banner — never a silently disabled Save button. Approved Date is
 * softly de-emphasized (not hard-disabled) for statuses that don't need it
 * yet, so an already-set value on an existing record is never hidden or
 * force-cleared. All calculation logic (computeVariationSummary on the
 * backend) is unchanged — this unit is validation/UX only.
 */
export function ContractVariationFormModal({ contractId, mode, variation, onClose }: Props): React.JSX.Element {
  const router = useRouter();
  const action = mode === 'edit' && variation ? updateVariationAction.bind(null, variation.id, contractId) : createVariationAction.bind(null, contractId);
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(action, { error: null });
  const submittedRef = useRef(false);

  const [status, setStatus] = useState<ContractVariationStatus>(variation?.status ?? 'DRAFT');
  const [approvedDate, setApprovedDate] = useState(variation?.approvedDate ?? '');
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    if (submittedRef.current && !isPending && !state.error) {
      submittedRef.current = false;
      onClose();
      router.refresh();
    }
  }, [state, isPending, onClose, router]);

  const submittedDateRequired = isSubmittedDateRequired(status);
  const approvedDateRequired = isApprovedDateRequired(status);
  // CM-70C — softly de-emphasized (muted styling only), never hard-disabled:
  // the task's own "unless user explicitly needs it" hedge means a manager
  // must still be able to type an Approved Date while Draft/Submitted/
  // Pending Approval if a real case calls for it.
  const approvedDateDeemphasized = !approvedDateRequired && !approvedDate.trim();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    const formData = new FormData(e.currentTarget);
    const errors = validateVariationFormValues({
      status,
      description: String(formData.get('description') ?? ''),
      amount: String(formData.get('amount') ?? ''),
      affectsContractValue: formData.get('affectsContractValue') === 'true',
      submittedDate: String(formData.get('submittedDate') ?? ''),
      approvedDate,
    });
    if (errors.length > 0) {
      e.preventDefault();
      setClientError(errors.join(' '));
      return;
    }
    setClientError(null);
    submittedRef.current = true;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="variation-form-title"
    >
      <div className="flex max-h-[92vh] w-[min(96vw,680px)] my-4 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-4">
          <h2 id="variation-form-title" className="text-lg font-semibold text-text-primary">
            {mode === 'add' ? 'Add Variation' : 'Edit Variation'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <form id="variation-form" action={formAction} onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          {(clientError ?? state.error) && (
            <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
              {clientError ?? state.error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="variationNo" className={labelCls}>Variation No.</label>
              <input
                id="variationNo"
                name="variationNo"
                type="text"
                maxLength={50}
                defaultValue={variation?.variationNo ?? ''}
                placeholder="e.g. VO-001"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="status" className={labelCls}>Status</label>
              <select
                id="status"
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ContractVariationStatus)}
                className={inputCls}
              >
                {VARIATION_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-text-muted mt-1">Use Approved only after client approval is confirmed.</p>
            </div>
          </div>

          <div>
            <label htmlFor="description" className={labelCls}>
              Description <span className="text-error">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              maxLength={500}
              defaultValue={variation?.description ?? ''}
              className={`${inputCls} resize-y`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="amount" className={labelCls}>
                Variation Amount (KWD) <span className="text-error">*</span>
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.001"
                defaultValue={variation?.amount ?? ''}
                placeholder="e.g. 6500 or -700"
                className={inputCls}
              />
              <p className="text-[11px] text-text-muted mt-1">
                Use a positive amount for additions and a negative amount for deductions/omissions.
              </p>
            </div>
            <div className="flex items-start">
              <label className="flex items-start gap-2.5 w-full rounded-md border border-border bg-surface-secondary/50 px-3 py-2.5 cursor-pointer hover:border-border-strong">
                <input
                  type="checkbox"
                  name="affectsContractValue"
                  value="true"
                  defaultChecked={variation?.affectsContractValue ?? true}
                  className="mt-0.5 size-4 rounded border-border text-accent focus:ring-accent"
                />
                <span>
                  <span className="block text-sm font-medium text-text-primary">Affects Contract Value</span>
                  <span className="block text-[11px] text-text-muted mt-0.5">
                    Only approved variations marked as affecting contract value will update the current contract value.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="submittedDate" className={labelCls}>
                Submitted Date {submittedDateRequired && <span className="text-error">*</span>}
              </label>
              <input
                id="submittedDate"
                name="submittedDate"
                type="date"
                defaultValue={variation?.submittedDate ?? ''}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="approvedDate" className={labelCls}>
                Approved Date {approvedDateRequired && <span className="text-error">*</span>}
              </label>
              <input
                id="approvedDate"
                name="approvedDate"
                type="date"
                value={approvedDate}
                onChange={(e) => setApprovedDate(e.target.value)}
                className={`${inputCls} ${approvedDateDeemphasized ? 'opacity-60' : ''}`}
              />
              {approvedDateDeemphasized && (
                <p className="text-[11px] text-text-muted mt-1">Only needed once this variation is Approved — set it earlier only if you specifically need to.</p>
              )}
            </div>
          </div>

          {mode === 'edit' && variation ? (
            <SupportingDocumentsSection contractId={contractId} variation={variation} />
          ) : (
            <InfoBox variant="subtle">
              Save the variation first. Then open Edit Variation to upload supporting documents.
            </InfoBox>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="supportingDocumentName" className={labelCls}>Reference Document Name</label>
              <input
                id="supportingDocumentName"
                name="supportingDocumentName"
                type="text"
                maxLength={300}
                defaultValue={variation?.supportingDocumentName ?? ''}
                placeholder="e.g. VO-001 Specification.pdf"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="supportingDocumentUrl" className={labelCls}>Reference Link / Location</label>
              <input
                id="supportingDocumentUrl"
                name="supportingDocumentUrl"
                type="text"
                maxLength={1000}
                defaultValue={variation?.supportingDocumentUrl ?? ''}
                placeholder="Link or reference to a document stored elsewhere"
                className={inputCls}
              />
            </div>
          </div>
          <InfoBox variant="subtle">
            Use this only when the document is stored outside this variation record.
          </InfoBox>

          <div>
            <label htmlFor="remarks" className={labelCls}>Remarks</label>
            <textarea
              id="remarks"
              name="remarks"
              rows={3}
              maxLength={5000}
              defaultValue={variation?.remarks ?? ''}
              className={`${inputCls} resize-y`}
            />
          </div>
        </form>

        <div className="shrink-0 flex items-center justify-end gap-3 border-t border-border bg-surface px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="variation-form"
            disabled={isPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {isPending ? 'Saving…' : mode === 'add' ? 'Add Variation' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
