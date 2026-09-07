'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2, Paperclip } from 'lucide-react';
import { uploadCloseoutAttachmentAction } from '../../../../actions';
import type { ContractCloseoutAttachment } from '@/lib/contracts-api';

interface Props {
  contractId: string;
  requestId: string;
  attachments: ContractCloseoutAttachment[];
  canUpload: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * CM-67E — extracted from the old contract-closeout-documents-panel.tsx
 * (CM-67), unmodified upload/list logic (same uploadCloseoutAttachmentAction,
 * same real ContractCloseoutAttachment model). Relocated into the Final
 * Approval & Closeout section instead of a standalone "documents" card —
 * these are real supporting files for the closeout REQUEST itself (e.g. a
 * signed closeout report), a genuinely different thing from Documents &
 * Obligations' contract-level required documents (see
 * contract-closeout-required-documents-panel.tsx), and this is where a
 * manager preparing/reviewing that request would actually look for them.
 */
export function ContractCloseoutRequestAttachments({ contractId, requestId, attachments, canUpload }: Props): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (isSaving) return;

    const formData = new FormData(e.currentTarget);
    setError(null);
    setIsSaving(true);
    try {
      const result = await uploadCloseoutAttachmentAction(requestId, contractId, { error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setFormKey((k) => k + 1);
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Attachment uploaded but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Failed to upload closeout attachment:', err);
      setError('Failed to upload attachment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="pt-3 mt-3 border-t border-border">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Closeout Request Attachments</h3>

      {attachments.length === 0 ? (
        <p className="text-xs text-text-muted mb-2">No supporting files attached to this closeout request yet.</p>
      ) : (
        <ul className="space-y-1 mb-2">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface p-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-text-primary" title={a.originalFileName}>{a.originalFileName}</p>
                  <p className="text-text-muted">{formatBytes(a.fileSize)} · {a.uploadedByUser.displayName}</p>
                </div>
              </div>
              <a
                href={`/contracts/closeout/${a.closeoutRequestId}/attachments/${a.id}/download`}
                className="shrink-0 inline-flex items-center gap-1 text-info hover:underline"
                title="Download"
              >
                <Download className="size-3.5" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <form
          key={formKey}
          onSubmit={handleSubmit}
          className="space-y-2"
        >
          {error && <p className="text-xs text-error">{error}</p>}
          <input
            type="file"
            name="file"
            required
            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="block w-full text-xs text-text-secondary file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-text-primary hover:file:bg-surface-secondary"
          />
          <p className="text-[11px] text-text-muted">PDF, PNG, JPEG, Excel or Word — up to 10MB.</p>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {isSaving && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            {isSaving ? 'Uploading…' : 'Attach File'}
          </button>
        </form>
      )}
    </div>
  );
}
