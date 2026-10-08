'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Eye, Loader2, Paperclip, Upload, X } from 'lucide-react';
import { uploadDrawingAttachmentAction, deleteDrawingAttachmentAction } from '../../../../../actions';
import { formatDateTime, formatFileSize } from '../../../../../_lib/technical-format';
import type { TechnicalAttachment } from '@/lib/technical-api';
import { drawingAttachmentViewHref, isTiffAttachment, TIFF_PREVIEW_HELPER_TEXT, TECHNICAL_ACCEPTED_FILE_TYPES_TEXT } from '../../../../../_lib/attachment-helpers';

interface Props {
  contractId: string;
  attachments: TechnicalAttachment[];
  currentUserId: string;
  canUpload: boolean;
  canManage: boolean;
}

/**
 * FMP-TECH-01 — Section C, Attachments. Real upload/list/delete against the
 * TechnicalDrawingAttachment backend (reused local-disk storage pattern —
 * see technical-attachment-storage.service.ts's own doc comment for why
 * this codebase has no MinIO/S3 to reuse instead). Deliberately simpler
 * than IncidentEvidenceAttachments' camera/video staging picker — Technical
 * Drawing attachments are documents/images/CAD files, not incident
 * evidence, so a plain multi-file picker is enough; no fake/disabled upload
 * state was needed since this real backend was built as part of this unit.
 */
export function DrawingAttachmentsPanel({ contractId, attachments, currentUserId, canUpload, canManage }: Props): React.JSX.Element {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFilesSelected(fileList: FileList | null): void {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setError(null);
    startTransition(async () => {
      const failures: string[] = [];
      for (const file of files) {
        const result = await uploadDrawingAttachmentAction(contractId, file);
        if (result.error) failures.push(`${file.name}: ${result.error}`);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (failures.length > 0) setError(failures.join(' · '));
      try {
        router.refresh();
      } catch {
        // Refresh best-effort — the upload itself already succeeded for non-failed files.
      }
    });
  }

  function handleDelete(attachmentId: string): void {
    startTransition(async () => {
      const result = await deleteDrawingAttachmentAction(contractId, attachmentId);
      if (result.error) setError(result.error);
      try {
        router.refresh();
      } catch {
        // Refresh best-effort.
      }
    });
  }

  const uploadInput = (
    <input
      ref={fileInputRef}
      type="file"
      multiple
      disabled={isPending}
      onChange={(e) => handleFilesSelected(e.target.files)}
      className="sr-only"
    />
  );

  // FMP-TECH-05E — accepted file types shown as small muted text near the
  // upload control, so the limit is visible before a user hits it, without
  // adding another card/section (the ticket's own exact wording for the
  // backend's real allow-list — see TECHNICAL_DRAWING_ATTACHMENT_ALLOWED_
  // MIME_TYPES's own error-message text, kept identical here).
  const acceptedTypes = TECHNICAL_ACCEPTED_FILE_TYPES_TEXT;

  // FMP-TECH-05B — when empty, a single compact dashed strip carries both
  // the "no files" text and the upload control side by side, instead of a
  // full-width "No files uploaded yet." line stacked above a separate large
  // dashed box (the "overly large blank attachment box" the ticket flags).
  if (attachments.length === 0) {
    return (
      <div className="space-y-2">
        {canUpload ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-secondary px-3.5 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-text-muted">No files uploaded yet.</p>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-secondary disabled:opacity-50">
                {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Upload className="size-3.5" aria-hidden="true" />}
                {isPending ? 'Uploading…' : 'Upload Files'}
                {uploadInput}
              </label>
            </div>
            <p className="mt-1.5 text-[11px] text-text-muted">{acceptedTypes}</p>
          </div>
        ) : (
          <p className="text-sm text-text-muted">No files uploaded yet.</p>
        )}
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <ul className="space-y-2">
        {attachments.map((a) => {
          const canDelete = canManage || a.uploadedByUserId === currentUserId;
          return (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <Paperclip className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-text-primary" title={a.originalFileName}>{a.originalFileName}</p>
                  <p className="text-xs text-text-muted">
                    {formatFileSize(a.fileSize)} · Uploaded · {a.uploadedByUser.displayName} · {formatDateTime(a.createdAt)}
                  </p>
                  {isTiffAttachment(a) && <p className="text-[11px] text-text-muted">{TIFF_PREVIEW_HELPER_TEXT}</p>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {isTiffAttachment(a) && (
                  <a
                    href={drawingAttachmentViewHref(contractId, a.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                    title="View"
                  >
                    <Eye className="size-4" aria-hidden="true" />
                    View
                  </a>
                )}
                <a
                  href={`/technical/jobs/${contractId}/workflow/drawing-received/attachments/${a.id}/download`}
                  className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                  title="Download"
                >
                  <Download className="size-4" aria-hidden="true" />
                  Download
                </a>
                {canDelete && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDelete(a.id)}
                    className="inline-flex items-center gap-1 text-sm text-danger hover:underline disabled:opacity-50"
                    title="Delete"
                  >
                    <X className="size-4" aria-hidden="true" />
                    Delete
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {canUpload && (
        <div className="rounded-lg border border-dashed border-border bg-surface-secondary p-2.5">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-secondary disabled:opacity-50">
            {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Upload className="size-3.5" aria-hidden="true" />}
            {isPending ? 'Uploading…' : 'Upload Files'}
            {uploadInput}
          </label>
          <p className="mt-1.5 text-center text-[11px] text-text-muted">{acceptedTypes}</p>
          {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
