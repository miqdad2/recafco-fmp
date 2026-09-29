'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2, Paperclip, X } from 'lucide-react';
import { uploadAttachmentAction, deleteAttachmentAction } from '../actions';
import { EvidenceFilePicker } from './evidence-file-picker';
import { stageEvidenceFiles, formatEvidenceFileSize, friendlyEvidenceFileType } from '../_lib/evidence-validation';
import type { StagedEvidenceFile } from '../_lib/evidence-validation';
import type { IncidentAttachment } from '../../../../lib/incidents-api';

interface Props {
  incidentId: string;
  attachments: IncidentAttachment[];
  currentUserId: string;
  canUpload: boolean;
  canManage: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * FMP-INC-01 — the Incident Detail page's real Evidence Attachments
 * section. Audited and confirmed there was NO backend support for this
 * before this unit (see FMP-UI-22's own progress-tracker entry) — this
 * component is only ever rendered once that backend genuinely exists
 * (`IncidentAttachment` model, `IncidentAttachmentStorageService`,
 * `POST/GET/DELETE /incidents/:id/attachments*`), never as placeholder UI.
 *
 * FMP-INC-01B — empty-state wording updated to the brief's own exact
 * required text ("No evidence files attached yet." + a hint naming the 3
 * real actions) — the hint line only renders when `canUpload` is true, so
 * a pure `incidents.read` viewer is never told to use buttons they can't
 * see.
 *
 * FMP-INC-01C — the selection buttons/staged-list UI is now
 * `EvidenceFilePicker`, shared verbatim with the Report Incident create
 * page's own new optional evidence section, so both places validate and
 * preview files identically.
 */
export function IncidentEvidenceAttachments({ incidentId, attachments, currentUserId, canUpload, canManage }: Props): React.JSX.Element {
  const router = useRouter();
  const [staged, setStaged] = useState<StagedEvidenceFile[]>([]);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpload(): void {
    const uploadable = staged.filter((s) => !s.error);
    if (uploadable.length === 0) return;
    setBatchError(null);
    startTransition(async () => {
      const failures: string[] = [];
      for (const { file } of uploadable) {
        const result = await uploadAttachmentAction(incidentId, file);
        if (result.error) failures.push(`${file.name}: ${result.error}`);
      }
      setStaged([]);
      if (failures.length > 0) setBatchError(failures.join(' · '));
      try {
        router.refresh();
      } catch {
        // Refresh best-effort — the upload itself already succeeded for non-failed files.
      }
    });
  }

  function handleDelete(attachmentId: string): void {
    startTransition(async () => {
      const result = await deleteAttachmentAction(incidentId, attachmentId);
      if (result.error) setBatchError(result.error);
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
        <div className="text-sm text-text-muted">
          <p>No evidence files attached yet.</p>
          {canUpload && <p className="mt-0.5">Use Take Photo, Record Video, or Upload Files to add supporting evidence.</p>}
        </div>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => {
            const canDelete = canManage || a.uploadedByUserId === currentUserId;
            return (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Paperclip className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text-primary" title={a.originalFileName}>{a.originalFileName}</p>
                    <p className="text-xs text-text-muted">
                      {friendlyEvidenceFileType(a.mimeType)} · {formatEvidenceFileSize(a.fileSize)} · {a.uploadedByUser.displayName} · {formatDate(a.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <a
                    href={`/incidents/${incidentId}/attachments/${a.id}/download`}
                    className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                    title="View / Download"
                  >
                    <Download className="size-4" aria-hidden="true" />
                    View
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
        <div className="rounded-lg border border-border bg-surface-secondary p-3 space-y-3">
          <p className="text-xs font-medium text-text-secondary">Upload Evidence</p>

          <EvidenceFilePicker
            staged={staged}
            onAddFiles={(fileList) => setStaged((prev) => stageEvidenceFiles(fileList, prev))}
            onRemove={(index) => setStaged((prev) => prev.filter((_, i) => i !== index))}
            disabled={isPending}
          />

          {batchError && <p role="alert" className="text-xs text-danger">{batchError}</p>}

          <button
            type="button"
            disabled={isPending || staged.every((s) => s.error) || staged.length === 0}
            onClick={handleUpload}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-1.5 text-xs font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            {isPending ? 'Uploading…' : 'Upload Evidence'}
          </button>
        </div>
      )}
    </div>
  );
}
