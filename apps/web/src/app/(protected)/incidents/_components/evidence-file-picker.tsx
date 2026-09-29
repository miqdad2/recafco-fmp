'use client';

import { useRef } from 'react';
import { Camera, Video, Upload, X } from 'lucide-react';
import { INCIDENT_ATTACHMENT_ACCEPT_ATTR, formatEvidenceFileSize } from '../_lib/evidence-validation';
import type { StagedEvidenceFile } from '../_lib/evidence-validation';

interface Props {
  staged: StagedEvidenceFile[];
  onAddFiles: (fileList: FileList | null) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

/**
 * FMP-INC-01C — the 3-button evidence selection UI (Take Photo / Record
 * Video / Upload Files) + staged-files preview list, extracted out of
 * `IncidentEvidenceAttachments` (FMP-INC-01) so the Report Incident
 * create page's new optional evidence section (this unit) and the
 * Incident Detail page's existing upload area share ONE implementation
 * of "select files → validate → preview → remove" — never 2 copies that
 * could drift. This component only stages files; it never uploads
 * anything itself — the parent decides what happens to `staged` (the
 * create form merges them into its own submit; the detail page uploads
 * them immediately via its own "Upload Evidence" button).
 *
 * Camera capture (`capture="environment"` on the first two inputs) is
 * never forced — all 3 buttons are always shown side by side, and
 * browsers/devices without camera support simply fall back to their own
 * normal file picker with no code branch needed here.
 */
export function EvidenceFilePicker({ staged, onAddFiles, onRemove, disabled = false }: Props): React.JSX.Element {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={disabled}
          onChange={(e) => { onAddFiles(e.target.files); e.target.value = ''; }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => photoInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
        >
          <Camera className="size-3.5" aria-hidden="true" />
          Take Photo
        </button>

        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          disabled={disabled}
          onChange={(e) => { onAddFiles(e.target.files); e.target.value = ''; }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => videoInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
        >
          <Video className="size-3.5" aria-hidden="true" />
          Record Video
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept={INCIDENT_ATTACHMENT_ACCEPT_ATTR}
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => { onAddFiles(e.target.files); e.target.value = ''; }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
        >
          <Upload className="size-3.5" aria-hidden="true" />
          Upload Files
        </button>
      </div>

      <p className="text-[11px] text-text-muted">
        Photos (JPG/PNG/WEBP), video (MP4/MOV/WEBM), or documents (PDF/DOC/DOCX/XLS/XLSX/CSV/TXT) — up to 25MB each. Camera capture works on supported mobile/tablet devices; desktop always uses the file picker.
      </p>

      {staged.length > 0 && (
        <ul className="space-y-1.5">
          {staged.map((s, i) => (
            <li key={`${s.file.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs">
              <div className="min-w-0">
                <p className="truncate text-text-primary">{s.file.name}</p>
                {s.error ? (
                  <p role="alert" className="text-danger">{s.error}</p>
                ) : (
                  <p className="text-text-muted">{formatEvidenceFileSize(s.file.size)}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="shrink-0 text-text-muted hover:text-text-primary"
                title="Remove"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
