'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Eye, Loader2, Paperclip, X } from 'lucide-react';
import { uploadBoqItemFileAction, deleteBoqItemFileAction } from '../actions';
import { formatDateTime, formatFileSize } from '../_lib/technical-format';
import type { BoqItemAttachment } from '@/lib/technical-api';
import {
  BOQ_FILE_TEXT,
  boqAttachmentDownloadHref,
  boqAttachmentSourceLabel,
  boqItemLabel,
  filesAttachedText,
  groupAttachmentsByItem,
  splitValidBoqFiles,
} from '../_lib/boq-attachment-helpers';
import { formatContractQtyUnit } from '../_lib/boq-confirmation-helpers';
import { BTN_DANGER, BTN_SECONDARY } from '../_lib/button-styles';
import { BoqFileViewer } from './boq-file-viewer';
import { BoqFilePicker, BoqFileTypesHint } from './boq-staged-files';

export interface BoqFileItem {
  id: string;
  sortOrder: number;
  itemCode: string | null;
  description: string;
  /** Optional — shown as "Contract Qty" when the caller has it (Technical details page). */
  contractQty?: string | null;
  contractUnit?: string | null;
}

interface Props {
  contractId: string;
  items: BoqFileItem[];
  /** null = the file list could not be loaded. */
  attachments: BoqItemAttachment[] | null;
  currentUserId: string;
  /** Add files (Technical write pair). */
  canUpload: boolean;
  /** Remove files someone else added (contracts.manage / technical.manage). */
  canManage: boolean;
  /** Overrides the default helper sentence under the section (FMP-TECH-17). */
  referenceText?: string;
}

/**
 * FMP-BOQ-17 — drawing files per BOQ item for an existing contract. Technical
 * uses it as a reference when confirming drawing groups and pieces; Contract
 * Management uses it to add client drawings later. Reference only: adding a
 * file never creates pieces or changes any status.
 */
export function BoqItemFilesCard({ contractId, items, attachments, currentUserId, canUpload, canManage, referenceText }: Props): React.JSX.Element {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  // FMP-TECH-19 — View opens the full-screen viewer for that item's files; Download stays a plain download link.
  const [viewing, setViewing] = useState<{ itemId: string; fileId: string } | null>(null);

  const byItem = groupAttachmentsByItem(attachments ?? []);

  function refresh(): void {
    try {
      router.refresh();
    } catch {
      // Best effort — the change itself already succeeded.
    }
  }

  // Files chosen on an item are uploaded straight away, one by one, so a single bad file never stops the rest.
  function addFiles(files: File[], itemId: string): void {
    const { valid, errors: rejected } = splitValidBoqFiles(files);
    setErrors(rejected);
    if (valid.length === 0) return;
    startTransition(async () => {
      const failures: string[] = [...rejected];
      for (const file of valid) {
        const result = await uploadBoqItemFileAction(contractId, itemId, file);
        if (result.error) failures.push(result.error);
      }
      setErrors(failures);
      refresh();
    });
  }

  function remove(attachmentId: string): void {
    setErrors([]);
    startTransition(async () => {
      const result = await deleteBoqItemFileAction(contractId, attachmentId);
      if (result.error) setErrors([result.error]);
      refresh();
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-text-muted">No BOQ items yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">{referenceText ?? BOQ_FILE_TEXT.reference}</p>

      {attachments === null && (
        <p role="alert" className="rounded-md border border-error bg-error-light px-3 py-2 text-sm text-error">
          Files could not be loaded. Please refresh the page.
        </p>
      )}

      <ul className="space-y-3">
        {items.map((item) => {
          const files = byItem.get(item.id) ?? [];
          return (
            <li key={item.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold text-text-primary" title={item.description}>{boqItemLabel(item)}</p>
                {item.contractQty !== undefined && (
                  <span className="text-xs text-text-secondary">
                    Contract Qty: <span className="font-medium text-text-primary">{formatContractQtyUnit(item.contractQty, item.contractUnit ?? null)}</span>
                  </span>
                )}
                {files.length > 0 && <span className="text-xs text-text-muted">{filesAttachedText(files.length)}</span>}
                {canUpload && (
                  <BoqFilePicker label={files.length > 0 ? BOQ_FILE_TEXT.addMore : BOQ_FILE_TEXT.add} size="sm" disabled={isPending} onPick={(picked) => addFiles(picked, item.id)} />
                )}
              </div>
              {files.length === 0 ? (
                attachments !== null && <p className="mt-2 text-xs text-text-muted">{BOQ_FILE_TEXT.noFiles}</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {files.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-secondary/60 px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <Paperclip className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-text-primary" title={a.originalFileName}>{a.originalFileName}</p>
                          <p className="text-xs text-text-muted">
                            {formatFileSize(a.fileSize)} · {boqAttachmentSourceLabel(a.sourceType)} · {a.uploadedByUser.displayName} · {formatDateTime(a.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setViewing({ itemId: item.id, fileId: a.id })}
                          className={BTN_SECONDARY}
                        >
                          <Eye className="size-3.5" aria-hidden="true" />
                          View
                        </button>
                        <a href={boqAttachmentDownloadHref(contractId, a.id)} className={BTN_SECONDARY}>
                          <Download className="size-3.5" aria-hidden="true" />
                          Download
                        </a>
                        {canUpload && (canManage || a.uploadedByUserId === currentUserId) && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => remove(a.id)}
                            className={BTN_DANGER}
                          >
                            <X className="size-3.5" aria-hidden="true" />
                            Remove
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {viewing && (() => {
        const itemFiles = byItem.get(viewing.itemId) ?? [];
        const item = items.find((i) => i.id === viewing.itemId);
        const start = itemFiles.findIndex((f) => f.id === viewing.fileId);
        if (!item || start < 0) return null;
        return <BoqFileViewer contractId={contractId} itemTitle={boqItemLabel(item)} files={itemFiles} startIndex={start} onClose={() => setViewing(null)} />;
      })()}

      {canUpload && (
        <div className="flex flex-wrap items-center gap-2">
          {isPending && <Loader2 className="size-4 animate-spin text-text-muted" aria-hidden="true" />}
          <BoqFileTypesHint />
        </div>
      )}

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-md border border-error bg-error-light px-3 py-2 text-sm text-error">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
