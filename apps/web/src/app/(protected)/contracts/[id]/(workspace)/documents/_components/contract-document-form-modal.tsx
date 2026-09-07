'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Paperclip, Download, UploadCloud } from 'lucide-react';
import type { ActionResult } from '../../../../actions';
import { createDocumentObligationAction, updateDocumentObligationAction, uploadDocumentObligationAttachmentAction } from '../../../../actions';
import type { ContractDocumentObligation, ContractDocumentObligationAttachment } from '@/lib/contracts-api';
import { inputCls, labelCls, InfoBox } from '../../../../_components/contract-form-fields';
import {
  DOCUMENT_OBLIGATION_CATEGORY_OPTIONS,
  DOCUMENT_OBLIGATION_STATUS_OPTIONS,
  validateDocumentObligationFormValues,
} from '../../../../_lib/contract-document-obligation-helpers';

interface Props {
  contractId: string;
  mode: 'add' | 'edit';
  item?: ContractDocumentObligation;
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
 * CM-63 — real attachment upload, list, and download, alongside this item's
 * own Add/Edit fields. Its own separate useActionState/form
 * (uploadDocumentObligationAttachmentAction) — a file upload is a genuinely
 * different action from saving the item's own fields, matching the
 * established SupportingDocumentsSection pattern from
 * contract-variation-form-modal.tsx. No fake upload progress — the button
 * just reads "Uploading…" while the real request is in flight.
 * CM-70F — audited: the upload plumbing itself (server action, secure
 * endpoint, department scope) was already correct; the reported "Upload
 * doesn't work" was a feedback gap, not a broken action. Added an immediate
 * client-side "no file selected" check (before the network round trip, same
 * exact wording the server-side check already used) and a real, non-fake
 * "Uploaded successfully." acknowledgment once a new attachment is actually
 * confirmed present.
 * CM-70G — root cause of the REAL "Upload does nothing" bug: this section's
 * own upload `<form>` was rendered nested inside the outer Document
 * edit `<form>` (the browser console's own "<form> cannot be nested inside
 * another <form>" warning). A form-associated `<button type="submit">`
 * inside an invalidly-nested `<form>` does not reliably submit to its own
 * nearest form — clicking Upload could silently do nothing or misfire onto
 * the outer form instead. Fixed by removing this section's `<form>`
 * entirely (now a plain `<div>`): the file input stays a normal, uncontrolled
 * input; the Upload button is `type="button"` and calls the exact same
 * `uploadFormAction` dispatcher directly with a manually-built `FormData`,
 * bypassing native form submission altogether — `useActionState`'s returned
 * dispatcher is a plain function, not something that requires a real
 * `<form>` to invoke correctly.
 */
function AttachmentsSection({ contractId, item }: { contractId: string; item: ContractDocumentObligation }): React.JSX.Element {
  const [attachments, setAttachments] = useState<ContractDocumentObligationAttachment[]>(item.attachments);
  const uploadAction = uploadDocumentObligationAttachmentAction.bind(null, contractId, item.id);
  const [uploadState, uploadFormAction, isUploading] = useActionState<ActionResult, FormData>(uploadAction, { error: null });
  const [uploadClientError, setUploadClientError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSubmittedRef = useRef(false);

  useEffect(() => {
    if (uploadSubmittedRef.current && !isUploading && !uploadState.error) {
      uploadSubmittedRef.current = false;
      setUploadSuccess(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetch(`/contracts/${contractId}/documents/${item.id}/attachments`)
        .then((res) => (res.ok ? res.json() : null))
        .then((json: { data?: ContractDocumentObligationAttachment[] } | null) => {
          if (json?.data) setAttachments(json.data);
        })
        .catch(() => undefined);
    }
  }, [uploadState, isUploading, contractId, item.id]);

  function handleUploadClick(): void {
    setUploadSuccess(false);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadClientError('Please choose a file before uploading.');
      return;
    }
    setUploadClientError(null);
    uploadSubmittedRef.current = true;
    const formData = new FormData();
    formData.set('file', file);
    uploadFormAction(formData);
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <p className={labelCls}>Attachments</p>

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
                href={`/contracts/${contractId}/documents/${item.id}/attachments/${a.id}/download`}
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
        <p className="text-xs text-text-muted">No attachments uploaded yet.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx"
          onChange={() => { setUploadClientError(null); setUploadSuccess(false); }}
          className="flex-1 min-w-40 text-xs text-text-secondary file:mr-2 file:rounded-md file:border file:border-border file:bg-surface file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-text-primary hover:file:bg-surface-secondary"
        />
        <button
          type="button"
          onClick={handleUploadClick}
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
        >
          <UploadCloud className="size-3.5 shrink-0" aria-hidden="true" />
          {isUploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>
      {(uploadClientError ?? uploadState.error) && (
        <p className="text-xs text-error">{uploadClientError ?? uploadState.error}</p>
      )}
      {uploadSuccess && !uploadState.error && (
        <p className="text-xs text-success">Uploaded successfully.</p>
      )}
      <p className="text-[11px] text-text-muted">Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx). Max 10MB.</p>
    </div>
  );
}

/**
 * CM-63 — Add / Edit Document / Obligation modal. Document / Obligation
 * (title) is the only required field; everything else is optional.
 * Attachments are only shown in Edit mode since an upload needs a real
 * item id to attach to — Add mode shows an honest note instead of a fake/
 * disabled upload control (save the item first, then attach files from
 * Edit), matching the established Variations pattern.
 * CM-70E — the old single "Submission / Expiry Date" field (backed by one
 * combined DB column) is now three clear fields: Required Date, Submission
 * Date, Expiry Date. The database was given two new additive, nullable
 * columns (submission_date, expiry_date) for this — the old
 * submission_or_expiry_date column is kept, unmigrated, for any
 * pre-existing record's historical value (never dropped, never guessed
 * into one of the two new fields). Status remains a plain manual dropdown;
 * Days Remaining / Expiring Soon / Expired-Overdue are derived server-side
 * from Expiry Date (falling back to the legacy column only for old
 * records) — see contract-document-obligations.service.ts.
 * CM-70F — root cause of "dates appear empty in Edit" found and fixed on
 * the BACKEND: Prisma returns a real Date object (UTC midnight) for every
 * `@db.Date` column, and the default JSON response serialized it via
 * `.toISOString()` — a full datetime string a native <input type="date">
 * silently rejects and renders blank. contract-document-obligations.service.ts
 * now reformats all 4 date-only columns to plain "YYYY-MM-DD" strings
 * before they ever reach this component — no frontend change was needed
 * for the date fields themselves once that was fixed.
 * CM-70G — root cause of "Upload does nothing" found and fixed on the
 * FRONTEND: AttachmentsSection's own upload control was a nested `<form>`
 * inside this component's own `<form id="document-form">` — invalid HTML
 * that the browser console itself warns about, and that prevented the
 * Upload button's click from reliably reaching its own action. Fixed by
 * converting that inner form to a plain `<div>` with a `type="button"`
 * Upload button calling the same upload dispatcher directly — see
 * AttachmentsSection's own docstring below for the full explanation. This
 * outer document `<form>` itself is unchanged and remains the only real
 * `<form>` in this modal.
 */
export function ContractDocumentFormModal({ contractId, mode, item, onClose }: Props): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState(item?.status ?? 'PENDING');
  const [clientError, setClientError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (isSaving) return;

    const formData = new FormData(e.currentTarget);
    const errors = validateDocumentObligationFormValues({
      title: String(formData.get('title') ?? ''),
      submissionDate: String(formData.get('submissionDate') ?? ''),
      expiryDate: String(formData.get('expiryDate') ?? ''),
    });
    if (errors.length > 0) {
      setClientError(errors.join(' '));
      return;
    }
    setClientError(null);
    setIsSaving(true);
    try {
      const result =
        mode === 'edit' && item
          ? await updateDocumentObligationAction(item.id, contractId, { error: null }, formData)
          : await createDocumentObligationAction(contractId, { error: null }, formData);
      if (result.error) {
        setClientError(result.error);
        return;
      }
      onClose();
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Document saved but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Failed to save document:', err);
      setClientError('Failed to save document. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  const recommendSubmissionDate = status === 'SUBMITTED' && !item?.submissionDate;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-form-title"
    >
      <div className="flex max-h-[92vh] w-[min(96vw,680px)] my-4 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-4">
          <h2 id="document-form-title" className="text-lg font-semibold text-text-primary">
            {mode === 'add' ? 'Add Document' : 'Edit Document'}
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

        <form id="document-form" onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          {clientError && (
            <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
              {clientError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="itemNo" className={labelCls}>Item ID</label>
              <input
                id="itemNo"
                name="itemNo"
                type="text"
                maxLength={50}
                defaultValue={item?.itemNo ?? ''}
                placeholder="e.g. DOC-001"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="category" className={labelCls}>Category</label>
              <select id="category" name="category" defaultValue={item?.category ?? 'OTHER'} className={inputCls}>
                {DOCUMENT_OBLIGATION_CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="title" className={labelCls}>
              Document / Obligation <span className="text-error">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              maxLength={300}
              defaultValue={item?.title ?? ''}
              placeholder="e.g. Performance Bond"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="responsibleParty" className={labelCls}>Responsible Party</label>
              <input
                id="responsibleParty"
                name="responsibleParty"
                type="text"
                maxLength={150}
                defaultValue={item?.responsibleParty ?? ''}
                placeholder="e.g. Finance Team, Technical Team, Client, Contract Manager"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="status" className={labelCls}>Status</label>
              <select
                id="status"
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className={inputCls}
              >
                {DOCUMENT_OBLIGATION_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="requiredDate" className={labelCls}>Required Date</label>
              <input
                id="requiredDate"
                name="requiredDate"
                type="date"
                defaultValue={item?.requiredDate ?? ''}
                className={inputCls}
              />
              <p className="text-[11px] text-text-muted mt-1">Date by which this document is required.</p>
            </div>
            <div>
              <label htmlFor="submissionDate" className={labelCls}>Submission Date</label>
              <input
                id="submissionDate"
                name="submissionDate"
                type="date"
                defaultValue={item?.submissionDate ?? ''}
                className={inputCls}
              />
              <p className="text-[11px] text-text-muted mt-1">
                {recommendSubmissionDate
                  ? 'Recommended once a document is Submitted, though not required.'
                  : 'Date the document was submitted or received.'}
              </p>
            </div>
            <div>
              <label htmlFor="expiryDate" className={labelCls}>Expiry Date</label>
              <input
                id="expiryDate"
                name="expiryDate"
                type="date"
                defaultValue={item?.expiryDate ?? ''}
                className={inputCls}
              />
              <p className="text-[11px] text-text-muted mt-1">Date this document expires, if applicable.</p>
            </div>
          </div>

          {item?.submissionOrExpiryDate && !item?.submissionDate && !item?.expiryDate && (
            <InfoBox variant="subtle">
              This record has an earlier combined date on file ({item.submissionOrExpiryDate}), from before Submission Date and Expiry Date were separate fields. It is kept as-is — set Submission Date and/or Expiry Date above if you want to record them going forward.
            </InfoBox>
          )}

          <InfoBox variant="subtle">
            Status is always set manually here and is never changed automatically — Days Remaining and the Expiring Soon / Expired &amp; Overdue counts are calculated from Expiry Date without changing this item&apos;s own status.
          </InfoBox>

          {mode === 'edit' && item ? (
            <AttachmentsSection contractId={contractId} item={item} />
          ) : (
            <InfoBox variant="subtle">
              After saving, open Edit Document to upload supporting files.
            </InfoBox>
          )}

          <div>
            <label htmlFor="remarks" className={labelCls}>Remarks</label>
            <textarea
              id="remarks"
              name="remarks"
              rows={3}
              maxLength={5000}
              defaultValue={item?.remarks ?? ''}
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
            form="document-form"
            disabled={isSaving}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : mode === 'add' ? 'Add Document' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
