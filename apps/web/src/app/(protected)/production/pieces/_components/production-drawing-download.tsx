'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { getProductionDrawingFilesAction } from '../actions';
import type { ProductionDrawingFiles } from '../actions';
import { productionDrawingHrefs } from '../_lib/production-work-helpers';

interface Props {
  pieceId: string;
  className: string;
}

/**
 * FMP-PROD-03 — "Download Drawing": downloads the original drawing file. One file downloads straight away;
 * with several files a small list lets the user pick which one. The files are looked up on click, so the
 * list of rows stays light.
 */
export function ProductionDrawingDownload({ pieceId, className }: Props): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<ProductionDrawingFiles['files'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onClick(): Promise<void> {
    if (loading) return;
    if (files) {
      setFiles(null);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await getProductionDrawingFilesAction(pieceId);
    setLoading(false);
    if (result.error || !result.data || result.data.files.length === 0) {
      setError(result.error ?? 'No drawing files are attached.');
      return;
    }
    if (result.data.files.length === 1) {
      window.location.assign(productionDrawingHrefs(pieceId, result.data.files[0]!.id).download);
      return;
    }
    setFiles(result.data.files);
  }

  return (
    <span className="relative inline-block">
      <button type="button" onClick={() => void onClick()} disabled={loading} aria-haspopup={files ? 'menu' : undefined} aria-expanded={files ? true : undefined} className={className}>
        <Download className="mr-1.5 size-3.5" aria-hidden="true" />
        {loading ? 'Preparing…' : 'Download Drawing'}
      </button>
      {files && (
        <ul role="menu" className="absolute right-0 z-20 mt-1 w-64 divide-y divide-border rounded-md border border-border bg-surface shadow-lg">
          {files.map((f, i) => (
            <li key={f.id} role="none">
              <a
                role="menuitem"
                href={productionDrawingHrefs(pieceId, f.id).download}
                onClick={() => setFiles(null)}
                className="block truncate px-3 py-2 text-xs text-text-primary hover:bg-surface-secondary focus:bg-surface-secondary focus:outline-none"
                title={f.originalName}
              >
                Download file {i + 1}: {f.originalName}
              </a>
            </li>
          ))}
        </ul>
      )}
      {error && <span role="alert" className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-error bg-error-light px-2 py-1 text-xs text-error">{error}</span>}
    </span>
  );
}
