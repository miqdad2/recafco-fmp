'use client';

import { useEffect, useState } from 'react';
import { X, FileText, Download } from 'lucide-react';
import { getProductionDrawingFilesAction } from '../actions';
import type { ProductionDrawingFiles } from '../actions';
import { GROUP_FILE_CATEGORY_LABELS, formatFileSize } from '../../../technical/_lib/drawing-group-helpers';
import { contractLabel } from '../_lib/production-pieces-helpers';
import { PRODUCTION_DRAWING_TEXT } from '../_lib/production-drawing-helpers';

interface Props {
  pieceId: string;
  pieceCode: string;
  onClose: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * FMP-BOQ-13 — "Drawing / Calculation Files" for one piece, read-only. Shows
 * Technical's files for the piece's Released-to-Production group: who it is for
 * (piece, project, drawing no, calculation ref, title) and each file with a
 * Download button. There is no upload, edit or remove control here by design.
 */
export function ProductionDrawingFilesModal({ pieceId, pieceCode, onClose }: Props): React.JSX.Element {
  const [data, setData] = useState<ProductionDrawingFiles | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getProductionDrawingFilesAction(pieceId).then((result) => {
      if (cancelled) return;
      if (result.error || !result.data) setError(result.error ?? PRODUCTION_DRAWING_TEXT.notReleasedFiles);
      else setData(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [pieceId]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-labelledby="prod-files-title">
      <div className="my-4 flex max-h-[92vh] w-[min(96vw,640px)] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h2 id="prod-files-title" className="text-lg font-semibold text-text-primary">Drawing / Calculation Files</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-text-muted hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && <p className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">{error}</p>}
          {!error && !data && <p className="py-4 text-center text-sm text-text-muted">Loading…</p>}

          {data && (
            <>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg bg-surface-secondary/50 p-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-text-secondary">Piece Code</dt><dd className="font-medium text-text-primary">{pieceCode}</dd></div>
                <div><dt className="text-xs text-text-secondary">Contract / Project</dt><dd className="font-medium text-text-primary">{contractLabel(data.contract)}</dd></div>
                <div><dt className="text-xs text-text-secondary">Drawing No</dt><dd className="font-medium text-text-primary">{data.group.drawingNo}</dd></div>
                <div><dt className="text-xs text-text-secondary">Calculation Ref</dt><dd className="font-medium text-text-primary">{data.group.calculationRef || '—'}</dd></div>
                {data.group.groupTitle && (
                  <div className="sm:col-span-2"><dt className="text-xs text-text-secondary">Group Title</dt><dd className="font-medium text-text-primary">{data.group.groupTitle}</dd></div>
                )}
              </dl>

              {data.files.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-muted">{PRODUCTION_DRAWING_TEXT.noFiles}</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {data.files.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5">
                      <FileText className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="truncate text-sm font-medium text-text-primary" title={f.originalName}>{f.originalName}</p>
                        <p className="text-xs text-text-secondary">
                          {GROUP_FILE_CATEGORY_LABELS[f.category]} · {formatFileSize(f.fileSize)} · {formatDate(f.createdAt)}
                        </p>
                      </div>
                      <a
                        href={`/production/pieces/${pieceId}/drawing-files/${f.id}/download`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
                      >
                        <Download className="size-3.5" aria-hidden="true" />
                        Download
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
