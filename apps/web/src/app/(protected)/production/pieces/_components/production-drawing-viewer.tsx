'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { BoqFileViewer } from '../../../technical/_components/boq-file-viewer';
import type { ViewerFile, ViewerHrefs } from '../../../technical/_components/boq-file-viewer';
import { getProductionDrawingFilesAction } from '../actions';
import type { ProductionDrawingFiles } from '../actions';
import { productionDrawingHrefs } from '../_lib/production-work-helpers';

interface Props {
  pieceId: string;
  pieceCode: string;
  onClose: () => void;
}

/**
 * FMP-PROD-03 — "View Drawing": opens the platform's existing drawing viewer (PDF / image / TIFF preview,
 * zoom, fit, rotate, previous / next) on the element's final drawing files — its released group's files, or
 * its own. Nothing is downloaded automatically; DWG / DXF show the viewer's plain message with a download button.
 */
export function ProductionDrawingViewer({ pieceId, pieceCode, onClose }: Props): React.JSX.Element {
  const [data, setData] = useState<ProductionDrawingFiles | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getProductionDrawingFilesAction(pieceId).then((result) => {
      if (cancelled) return;
      if (result.error || !result.data) setError(result.error ?? 'Drawing files are not available.');
      else if (result.data.files.length === 0) setError('No drawing files are attached.');
      else setData(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [pieceId]);

  if (data) {
    const files: ViewerFile[] = data.files.map((f) => ({ id: f.id, originalFileName: f.originalName, mimeType: f.mimeType }));
    const title = `${pieceCode} · ${data.source === 'GROUP' ? `Group Drawing${data.group.groupTitle ? ` · ${data.group.groupTitle}` : ''}` : 'Individual Drawing'} · ${data.group.drawingNo}`;
    return (
      <BoqFileViewer
        itemTitle={title}
        files={files}
        startIndex={0}
        hrefsFor={(f): ViewerHrefs => productionDrawingHrefs(pieceId, f.id)}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Drawing">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-text-primary">{pieceCode}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-text-muted hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        {error ? <p role="alert" className="mt-3 text-sm text-error">{error}</p> : <p className="mt-3 text-sm text-text-muted">Loading drawing…</p>}
      </div>
    </div>
  );
}
