'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Paperclip, Download, Loader2 } from 'lucide-react';
import type { ActionResult } from '../../../../actions';
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

export function CloseoutAttachmentsPanel({ contractId, requestId, attachments, canUpload }: Props): React.JSX.Element {
  const router = useRouter();
  const action = uploadCloseoutAttachmentAction.bind(null, requestId, contractId);
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(action, { error: null });
  const submittedRef = useRef(false);
  const formKeyRef = useRef(0);

  useEffect(() => {
    if (submittedRef.current && !isPending && !state.error) {
      submittedRef.current = false;
      formKeyRef.current += 1;
      router.refresh();
    }
  }, [state, isPending, router]);

  return (
    <div className="space-y-3">
      {attachments.length === 0 ? (
        <p className="text-sm text-text-muted">No closeout documents uploaded.</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface p-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-text-primary" title={a.originalFileName}>{a.originalFileName}</p>
                  <p className="text-text-muted">{formatBytes(a.fileSize)} · {a.uploadedByUser.displayName}</p>
                </div>
              </div>
              <a
                href={`/contracts/closeout/${requestId}/attachments/${a.id}/download`}
                className="shrink-0 inline-flex items-center gap-1 text-accent hover:underline"
                title="Download"
              >
                <Download className="size-3.5" aria-hidden="true" />
              </a>
            </div>
          ))}
        </div>
      )}

      {canUpload && (
        <form
          key={formKeyRef.current}
          action={formAction}
          onSubmit={() => { submittedRef.current = true; }}
          className="space-y-2 pt-2 border-t border-border"
        >
          {state.error && <p className="text-xs text-danger">{state.error}</p>}
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
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            {isPending ? 'Uploading…' : 'Upload Document'}
          </button>
        </form>
      )}
    </div>
  );
}
