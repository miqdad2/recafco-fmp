'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, FileText, Download, Trash2 } from 'lucide-react';
import type { DrawingGroup, DrawingGroupFile } from '@/lib/technical-api';
import { listDrawingGroupFilesAction, uploadDrawingGroupFileAction, deleteDrawingGroupFileAction } from '../../../actions';
import {
  GROUP_FILE_ACCEPT,
  GROUP_FILE_CATEGORY_LABELS,
  GROUP_FILE_CATEGORY_OPTIONS,
  GROUP_FILE_DEFAULT_CATEGORY,
  canChangeGroupFiles,
  fileCountLabel,
  formatFileSize,
  groupFilesLockedMessage,
  validateGroupUpload,
} from '../../../_lib/drawing-group-helpers';
import { BOQ_FILE_TYPES_TEXT } from '../../../_lib/boq-attachment-helpers';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '../../../_lib/button-styles';

interface Props {
  contractId: string;
  group: DrawingGroup;
  /** The viewer has a Technical write permission. */
  canWrite: boolean;
  /** A short note shown at the top (for example the Replace Drawing hint). */
  intro?: string | null;
  onClose: () => void;
}

const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * FMP-BOQ-12 — files of one Drawing / Calculation Group: list with download, and
 * (for Technical writers, until the group is released) upload and remove. A file
 * never changes the group's status.
 */
export function DrawingGroupFilesModal({ contractId, group, canWrite, intro = null, onClose }: Props): React.JSX.Element {
  const router = useRouter();
  const [files, setFiles] = useState<DrawingGroupFile[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [category, setCategory] = useState<string>(GROUP_FILE_DEFAULT_CATEGORY);
  const [picked, setPicked] = useState<File[]>([]);
  const [remarks, setRemarks] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const canChange = canChangeGroupFiles(group.status);
  const locked = groupFilesLockedMessage(group.status);

  useEffect(() => {
    let cancelled = false;
    void listDrawingGroupFilesAction(contractId, group.id).then((result) => {
      if (cancelled) return;
      if (result.error) setLoadError(result.error);
      else {
        setLoadError(null);
        setFiles(result.files);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [contractId, group.id, reload]);

  async function upload(): Promise<void> {
    if (uploading) return;
    if (picked.length === 0) {
      setMessage({ tone: 'error', text: 'Please select a file.' });
      return;
    }
    // Every picked file is checked first, so one wrong type never blocks the valid ones.
    const problems: string[] = [];
    const valid: File[] = [];
    for (const f of picked) {
      const problem = validateGroupUpload(f, category);
      if (problem) problems.push(`${f.name}: ${problem}`);
      else valid.push(f);
    }
    if (valid.length === 0) {
      setMessage({ tone: 'error', text: problems.join(' ') });
      return;
    }
    setUploading(true);
    setMessage(null);
    let done = 0;
    for (const f of valid) {
      const body = new FormData();
      body.append('category', category);
      if (remarks.trim()) body.append('remarks', remarks.trim());
      body.append('file', f, f.name);
      const result = await uploadDrawingGroupFileAction(contractId, group.id, body);
      if (result.error) problems.push(`${f.name}: ${result.error}`);
      else done += 1;
    }
    setUploading(false);
    if (done > 0) {
      setPicked([]);
      setRemarks('');
      setFileInputKey((k) => k + 1);
      setReload((n) => n + 1);
      router.refresh(); // updates the file count on the group row
    }
    setMessage(
      problems.length > 0
        ? { tone: 'error', text: [done > 0 ? `${done} ${done === 1 ? 'file' : 'files'} uploaded.` : '', ...problems].filter(Boolean).join(' ') }
        : { tone: 'ok', text: `${done} ${done === 1 ? 'file' : 'files'} uploaded.` },
    );
  }

  async function remove(f: DrawingGroupFile): Promise<void> {
    if (removingId) return;
    setRemovingId(f.id);
    setMessage(null);
    const result = await deleteDrawingGroupFileAction(contractId, group.id, f.id);
    setRemovingId(null);
    if (result.error) {
      setMessage({ tone: 'error', text: result.error });
      return;
    }
    setMessage({ tone: 'ok', text: 'File removed.' });
    setReload((n) => n + 1);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-labelledby="group-files-title">
      <div className="my-4 flex max-h-[92vh] w-[min(96vw,680px)] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="group-files-title" className="text-lg font-semibold text-text-primary">Files — {group.drawingNo}</h2>
            <p className="text-sm text-text-secondary">
              {group.calculationRef ? `Calc: ${group.calculationRef} · ` : ''}
              {files ? fileCountLabel(files.length) : 'Loading…'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-text-muted hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {intro && <p className="rounded-md bg-info-light/60 px-3 py-2 text-xs text-text-secondary">{intro}</p>}
          {message && (
            <div
              role="status"
              className={`rounded-md border px-4 py-2.5 text-sm ${
                message.tone === 'ok' ? 'border-success bg-success-light text-success' : 'border-error bg-error-light text-error'
              }`}
            >
              {message.text}
            </div>
          )}

          {canWrite && canChange && (
            <div className="rounded-lg border border-border bg-surface-secondary/40 p-3">
              <p className="mb-2 text-sm font-medium text-text-primary">Add File</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="gf-category" className="mb-1 block text-xs font-medium text-text-secondary">Category <span className="text-error">*</span></label>
                  <select id="gf-category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                    {GROUP_FILE_CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="gf-file" className="mb-1 block text-xs font-medium text-text-secondary">Files <span className="text-error">*</span></label>
                  <input
                    key={fileInputKey}
                    id="gf-file"
                    type="file"
                    accept={GROUP_FILE_ACCEPT}
                    multiple
                    onChange={(e) => setPicked(Array.from(e.target.files ?? []))}
                    className="block w-full text-sm text-text-primary file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label htmlFor="gf-remarks" className="mb-1 block text-xs font-medium text-text-secondary">Remarks</label>
                <input id="gf-remarks" type="text" maxLength={1000} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" className={inputCls} />
              </div>
              <p className="mt-2 text-xs text-text-muted">{BOQ_FILE_TYPES_TEXT}</p>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => void upload()}
                  disabled={uploading}
                  className={BTN_PRIMARY}
                >
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </div>
          )}
          {canWrite && locked && <p className="rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-secondary">{locked}</p>}

          {loadError && <p className="text-sm text-error">{loadError}</p>}
          {!loadError && files === null && <p className="py-4 text-center text-sm text-text-muted">Loading…</p>}
          {files && files.length === 0 && <p className="py-4 text-center text-sm text-warning">No files attached.</p>}
          {files && files.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border">
              {files.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5">
                  <FileText className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-sm font-medium text-text-primary" title={f.originalName}>{f.originalName}</p>
                    <p className="text-xs text-text-secondary">
                      {GROUP_FILE_CATEGORY_LABELS[f.category]} · {formatFileSize(f.fileSize)} · {formatDate(f.createdAt)}
                      {f.uploadedByUser ? ` · ${f.uploadedByUser.displayName}` : ''}
                    </p>
                    {f.remarks && <p className="text-xs text-text-muted">{f.remarks}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={`/technical/jobs/${contractId}/drawing-groups/${group.id}/attachments/${f.id}/download`}
                      className={BTN_SECONDARY}
                    >
                      <Download className="size-3.5" aria-hidden="true" />
                      Download
                    </a>
                    {canWrite && canChange && (
                      <button
                        type="button"
                        onClick={() => void remove(f)}
                        disabled={removingId === f.id}
                        aria-label={`Remove ${f.originalName}`}
                        className={BTN_DANGER}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
