'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Eye, FileText, Trash2, X } from 'lucide-react';
import type { ElementDrawingFile } from '@/lib/technical-api';
import { deleteElementDrawingFileAction, listElementDrawingFilesAction, uploadElementDrawingAction } from '../../../actions';
import { BOQ_FILE_ACCEPT, BOQ_FILE_TYPES_TEXT, elementDrawingDownloadHref, elementDrawingViewHref, splitValidBoqFiles } from '../../../_lib/boq-attachment-helpers';
import { formatFileSize } from '../../../_lib/drawing-group-helpers';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '../../../_lib/button-styles';

// ---------------------------------------------------------------------------
// FMP-TECH-27 — "Add Final Drawing for Element". The files belong to the element
// itself (an individual final drawing); the same files can be added to several
// selected elements at once. For a single element the dialog also lists its
// files (view / download / remove). Uploading never releases anything.
// ---------------------------------------------------------------------------

interface Props {
  contractId: string;
  elements: { id: string; pieceCode: string }[];
  canWrite: boolean;
  /** Elements in a group or already released cannot take their own file; the dialog then only lists files. */
  readOnlyReason?: string | null;
  /** A short note shown at the top (for example the Replace Drawing hint). */
  intro?: string | null;
  onClose: () => void;
}

const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const labelCls = 'mb-1 block text-sm font-medium text-text-primary';
const smallBtnCls = BTN_SECONDARY;

export function ElementDrawingModal({ contractId, elements, canWrite, readOnlyReason = null, intro = null, onClose }: Props): React.JSX.Element {
  const router = useRouter();
  const single = elements.length === 1 ? elements[0]! : null;
  const [files, setFiles] = useState<ElementDrawingFile[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drawingRefNo, setDrawingRefNo] = useState('');
  const [revision, setRevision] = useState('');
  const [remarks, setRemarks] = useState('');
  const [picked, setPicked] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editable = canWrite && !readOnlyReason;

  async function loadFiles(pieceId: string): Promise<void> {
    const result = await listElementDrawingFilesAction(contractId, pieceId);
    if (result.error) setLoadError(result.error);
    else setFiles(result.files);
  }

  useEffect(() => {
    if (single) void loadFiles(single.id);
    // `single` is fixed for the life of the dialog.
  }, [contractId]);

  async function upload(): Promise<void> {
    if (busy) return;
    const { valid, errors: rejected } = splitValidBoqFiles(picked);
    if (valid.length === 0) {
      setErrors(rejected.length > 0 ? rejected : ['Please choose at least one file.']);
      return;
    }
    setBusy(true);
    setMessage(null);
    const failures: string[] = [...rejected];
    let done = 0;
    for (const element of elements) {
      for (const file of valid) {
        const body = new FormData();
        body.append('file', file, file.name);
        if (drawingRefNo.trim()) body.append('drawingRefNo', drawingRefNo.trim());
        if (revision.trim()) body.append('revision', revision.trim());
        if (remarks.trim()) body.append('remarks', remarks.trim());
        const result = await uploadElementDrawingAction(contractId, element.id, body);
        if (result.error) failures.push(`${element.pieceCode} · ${file.name}: ${result.error}`);
        else done += 1;
      }
    }
    setBusy(false);
    setErrors(failures);
    if (done > 0) {
      setMessage(`${done} ${done === 1 ? 'file' : 'files'} added. ${elements.length === 1 ? 'The element has' : 'The elements have'} a drawing uploaded.`);
      setPicked([]);
      if (single) await loadFiles(single.id);
      router.refresh();
    }
  }

  async function remove(file: ElementDrawingFile): Promise<void> {
    if (busy || !single) return;
    setBusy(true);
    const result = await deleteElementDrawingFileAction(contractId, single.id, file.id);
    setBusy(false);
    if (result.error) {
      setErrors([result.error]);
      return;
    }
    await loadFiles(single.id);
    router.refresh();
  }

  const title = single ? 'Add Final Drawing for Element' : `Add Final Drawing for ${elements.length} Elements`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-labelledby="element-drawing-title">
      <div className="my-4 flex max-h-[92vh] w-[min(96vw,620px)] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="element-drawing-title" className="text-lg font-semibold text-text-primary">{editable ? title : 'Final Drawing Files'}</h2>
            <p className="truncate text-xs text-text-secondary">
              {single ? `Element ${single.pieceCode}` : `${elements.length} elements: ${elements.slice(0, 4).map((e) => e.pieceCode).join(', ')}${elements.length > 4 ? '…' : ''}`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-text-muted hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {readOnlyReason && <p className="rounded-md bg-surface-secondary px-3 py-2 text-xs text-text-secondary">{readOnlyReason}</p>}
          {intro && !readOnlyReason && <p className="rounded-md bg-info-light/60 px-3 py-2 text-xs text-text-secondary">{intro}</p>}
          {message && <div role="status" className="rounded-md border border-success bg-success-light px-4 py-2.5 text-sm text-success">{message}</div>}
          {errors.length > 0 && (
            <ul role="alert" className="space-y-1 rounded-md border border-error bg-error-light px-4 py-2.5 text-sm text-error">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}

          {single && (
            <div>
              <p className="mb-1 text-sm font-medium text-text-primary">Files</p>
              {loadError && <p className="text-sm text-error">{loadError}</p>}
              {!loadError && files === null && <p className="text-sm text-text-muted">Loading…</p>}
              {files && files.length === 0 && <p className="text-sm text-text-muted">No final drawing files attached to this element.</p>}
              {files && files.length > 0 && (
                <ul className="space-y-2">
                  {files.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-secondary/60 px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-text-primary" title={f.originalName}>{f.originalName}</p>
                          <p className="text-xs text-text-muted">
                            {formatFileSize(f.fileSize)}
                            {f.drawingRefNo ? ` · ${f.drawingRefNo}` : ''}
                            {f.revision ? ` · ${f.revision}` : ''}
                            {f.uploadedByUser ? ` · ${f.uploadedByUser.displayName}` : ''}
                          </p>
                          {f.remarks && <p className="text-xs text-text-muted">{f.remarks}</p>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <a href={elementDrawingViewHref(contractId, f.pieceId, f.id)} target="_blank" rel="noreferrer" className={BTN_SECONDARY}>
                          <Eye className="size-4" aria-hidden="true" />
                          View
                        </a>
                        <a href={elementDrawingDownloadHref(contractId, f.pieceId, f.id)} className={BTN_SECONDARY}>
                          <Download className="size-4" aria-hidden="true" />
                          Download
                        </a>
                        {editable && (
                          <button type="button" disabled={busy} onClick={() => void remove(f)} className={BTN_DANGER}>
                            <Trash2 className="size-4" aria-hidden="true" />
                            Remove
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {editable && (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="ed-ref" className={labelCls}>Drawing Reference No</label>
                  <input id="ed-ref" type="text" maxLength={100} value={drawingRefNo} onChange={(e) => setDrawingRefNo(e.target.value)} placeholder="Enter drawing reference number" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="ed-rev" className={labelCls}>Revision</label>
                  <input id="ed-rev" type="text" maxLength={50} value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="Example: Rev 0, Rev A" className={inputCls} />
                </div>
              </div>
              <div>
                <label htmlFor="ed-files" className={labelCls}>Files <span className="text-error">*</span></label>
                <input
                  id="ed-files"
                  type="file"
                  multiple
                  accept={BOQ_FILE_ACCEPT}
                  onChange={(e) => setPicked(Array.from(e.target.files ?? []))}
                  className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text-primary hover:file:bg-surface-secondary"
                />
                <p className="mt-1 text-xs text-text-muted">{BOQ_FILE_TYPES_TEXT}</p>
                {picked.length > 0 && <p className="mt-1 text-xs text-text-secondary">{picked.length} {picked.length === 1 ? 'file' : 'files'} selected.</p>}
              </div>
              <div>
                <label htmlFor="ed-remarks" className={labelCls}>Remarks</label>
                <textarea id="ed-remarks" rows={2} maxLength={1000} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={`${inputCls} resize-y`} />
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border bg-surface px-5 py-3">
          <button type="button" onClick={onClose} disabled={busy} className={`${smallBtnCls} h-10 px-4 text-sm`}>Close</button>
          {editable && (
            <button
              type="button"
              onClick={() => void upload()}
              disabled={busy || picked.length === 0}
              className={BTN_PRIMARY}
            >
              {busy ? 'Uploading…' : 'Upload Drawing'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
