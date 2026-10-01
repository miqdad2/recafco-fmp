'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2, Paperclip, Upload, X } from 'lucide-react';
import { uploadFdAttachmentAction, deleteFdAttachmentAction } from '../../../../../actions';
import { formatDateTime, formatFileSize } from '../../../../../_lib/technical-format';
import type { TechnicalAttachment } from '@/lib/technical-api';

interface Props {
  contractId: string;
  attachments: TechnicalAttachment[];
  currentUserId: string;
  canUpload: boolean;
  canManage: boolean;
}

/**
 * FMP-TECH-04 — FD Attachments (final drawing PDF, DWG file, document
 * package, transmittal/issue letter — the ticket's own examples, never
 * hardcoded, just real uploaded files). Same TechnicalAttachmentStorageService
 * and allowed-type/size limits as the other 3 stages' attachments; a
 * deliberate near-duplicate of those panels rather than a shared cross-stage
 * import, same reasoning as SdAttachmentsPanel/ApprovalAttachmentsPanel's
 * own doc comments.
 */
export function FdAttachmentsPanel({ contractId, attachments, currentUserId, canUpload, canManage }: Props): React.JSX.Element {
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
        const result = await uploadFdAttachmentAction(contractId, file);
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
      const result = await deleteFdAttachmentAction(contractId, attachmentId);
      if (result.error) setError(result.error);
      try {
        router.refresh();
      } catch {
        // Refresh best-effort.
      }
    });
  }

  return (
    <div className="space-y-3">
      {attachments.length === 0 ? (
        <p className="text-sm text-text-muted">No files uploaded yet.</p>
      ) : (
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
                      {a.mimeType} · {formatFileSize(a.fileSize)} · Uploaded · {a.uploadedByUser.displayName} · {formatDateTime(a.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <a
                    href={`/technical/jobs/${contractId}/workflow/fd-issuance/attachments/${a.id}/download`}
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
      )}

      {canUpload && (
        <div className="rounded-lg border border-dashed border-border bg-surface-secondary p-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-surface px-3.5 py-2 text-xs font-medium text-text-secondary hover:bg-surface-secondary disabled:opacity-50">
            {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Upload className="size-3.5" aria-hidden="true" />}
            {isPending ? 'Uploading…' : 'Upload Files'}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              disabled={isPending}
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="sr-only"
            />
          </label>
          {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
