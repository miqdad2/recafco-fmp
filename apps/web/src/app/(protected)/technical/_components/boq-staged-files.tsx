'use client';

import { useRef } from 'react';
import { Download, Eye, Paperclip, Upload, X } from 'lucide-react';
import { formatFileSize } from '../_lib/technical-format';
import { BOQ_FILE_ACCEPT, BOQ_FILE_TYPES_TEXT } from '../_lib/boq-attachment-helpers';

/**
 * FMP-BOQ-17/18 — files attached on New Contract Register that are not saved
 * yet (they are saved together with the contract). Each file belongs to the BOQ
 * row it was attached on.
 */
export interface StagedBoqFile {
  key: string;
  file: File;
  /** The New Contract Register row this file was attached on. */
  itemId: string;
}

const linkBtnCls = 'inline-flex items-center gap-1 text-sm text-accent hover:underline disabled:opacity-50';

let stagedCounter = 0;
export function makeStagedFiles(files: File[], itemId: string): StagedBoqFile[] {
  return files.map((file) => ({ key: `staged-${Date.now()}-${(stagedCounter += 1)}`, file, itemId }));
}

interface PickerProps {
  label: string;
  multiple?: boolean;
  disabled?: boolean | undefined;
  onPick: (files: File[]) => void;
  /** Visual weight: a row-level button is smaller than a standalone one. */
  size?: 'sm' | 'md';
}

/** A button that opens the file chooser (no visible native input). */
export function BoqFilePicker({ label, multiple = true, disabled, onPick, size = 'md' }: PickerProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={`inline-flex items-center gap-1.5 rounded-md border border-border bg-surface font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60 ${
          size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
        }`}
      >
        <Upload className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden="true" />
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={BOQ_FILE_ACCEPT}
        tabIndex={-1}
        aria-label={label}
        className="sr-only"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (picked.length > 0) onPick(picked);
        }}
      />
    </>
  );
}

interface ListProps {
  files: StagedBoqFile[];
  onChange: (files: StagedBoqFile[]) => void;
  disabled?: boolean | undefined;
}

function openLocal(file: File, download: boolean): void {
  const url = URL.createObjectURL(file);
  if (download) {
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
  } else {
    window.open(url, '_blank', 'noopener');
  }
  // Give the new tab / download a moment to start before releasing the file.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function BoqStagedFilesList({ files, onChange, disabled }: ListProps): React.JSX.Element | null {
  if (files.length === 0) return null;
  return (
    <ul className="space-y-2" aria-label="Attached files">
      {files.map((staged) => (
        <li key={staged.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-surface p-3 text-sm">
          <div className="flex min-w-0 flex-1 items-center gap-2 basis-48">
            <Paperclip className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate font-medium text-text-primary" title={staged.file.name}>{staged.file.name}</p>
              <p className="text-xs text-text-muted">{formatFileSize(staged.file.size)}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button type="button" className={linkBtnCls} onClick={() => openLocal(staged.file, false)}>
              <Eye className="size-4" aria-hidden="true" />
              View
            </button>
            <button type="button" className={linkBtnCls} onClick={() => openLocal(staged.file, true)}>
              <Download className="size-4" aria-hidden="true" />
              Download
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(files.filter((f) => f.key !== staged.key))}
              className="inline-flex items-center gap-1 text-sm text-error hover:underline disabled:opacity-50"
            >
              <X className="size-4" aria-hidden="true" />
              Remove
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function BoqFileTypesHint(): React.JSX.Element {
  return <p className="text-xs text-text-muted">{BOQ_FILE_TYPES_TEXT}</p>;
}
