'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ExternalLink, Maximize2, RotateCcw, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { boqAttachmentDownloadHref, boqAttachmentPreviewHref, boqAttachmentViewHref, boqPreviewKind, rotateBoq, stepBoqZoom } from '../_lib/boq-attachment-helpers';

// ---------------------------------------------------------------------------
// FMP-TECH-19 — full-screen drawing viewer for the files of one BOQ item.
// Files come through the same same-origin routes as before (the API re-checks
// permission on every request); rotation and zoom are viewer-only and never
// change the stored file. PDFs use the browser's own viewer; TIFF files are shown
// through a PNG preview the server makes once and stores (the original is never
// changed, and Download still gives the original TIFF). DWG, DXF and Office
// files cannot be previewed, so they show a plain message with Download.
// ---------------------------------------------------------------------------

/** What the viewer needs of a file — any drawing file (BOQ item, element, drawing group) fits. */
export interface ViewerFile {
  id: string;
  originalFileName: string;
  mimeType: string;
}

export interface ViewerHrefs {
  view: string;
  preview: string;
  download: string;
}

interface BoqFileViewerProps {
  /** BOQ item files: the three routes are derived from the contract. */
  contractId?: string;
  /** Other callers (e.g. Production Work) give their own same-origin routes instead. */
  hrefsFor?: (file: ViewerFile) => ViewerHrefs;
  itemTitle: string;
  files: ViewerFile[];
  startIndex: number;
  onClose: () => void;
}

type ZoomMode = 'fit' | number;

const toolBtn =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-2.5 text-xs font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white disabled:cursor-not-allowed disabled:opacity-40';

export function BoqFileViewer({ contractId, hrefsFor, itemTitle, files, startIndex, onClose }: BoqFileViewerProps): React.JSX.Element {
  const [index, setIndex] = useState(Math.min(Math.max(startIndex, 0), files.length - 1));
  const closeRef = useRef<HTMLButtonElement>(null);
  const file = files[index]!;
  const hasPrev = index > 0;
  const hasNext = index < files.length - 1;

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setIndex((i) => Math.min(files.length - 1, i + 1)), [files.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, goPrev, goNext]);

  const hrefs: ViewerHrefs = hrefsFor
    ? hrefsFor(file)
    : {
        view: boqAttachmentViewHref(contractId ?? '', file.id),
        preview: boqAttachmentPreviewHref(contractId ?? '', file.id),
        download: boqAttachmentDownloadHref(contractId ?? '', file.id),
      };
  const viewHref = hrefs.view;
  const previewHref = hrefs.preview;
  const downloadHref = hrefs.download;
  const kind = boqPreviewKind(file.originalFileName, file.mimeType);
  const canOpenInTab = kind === 'image' || kind === 'pdf' || kind === 'tiff';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-neutral-900" role="dialog" aria-modal="true" aria-labelledby="boq-viewer-title">
      {/* Header — Close is always visible, even on small screens. */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
        <div className="min-w-0">
          <h2 id="boq-viewer-title" className="truncate text-sm font-semibold sm:text-base" title={file.originalFileName}>{file.originalFileName}</h2>
          <p className="truncate text-xs text-white/70" title={itemTitle}>{itemTitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm font-medium tabular-nums text-white/80" aria-live="polite">{index + 1} of {files.length}</span>
          <button ref={closeRef} type="button" onClick={onClose} className={toolBtn} aria-label="Close" title="Close (Esc)">
            <X className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>
      </div>

      {/* Body — keyed by file so zoom/rotation reset when moving between files. */}
      <ViewerBody
        key={file.id}
        file={file}
        kind={kind}
        viewHref={kind === 'tiff' ? previewHref : viewHref}
        downloadHref={downloadHref}
        canOpenInTab={canOpenInTab}
        toolbarStart={
          <>
            <button type="button" onClick={goPrev} disabled={!hasPrev} className={toolBtn} aria-label="Previous" title="Previous file (←)">
              <ChevronLeft className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Previous</span>
            </button>
            <button type="button" onClick={goNext} disabled={!hasNext} className={toolBtn} aria-label="Next" title="Next file (→)">
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </>
        }
      />
    </div>
  );
}

interface ViewerBodyProps {
  file: ViewerFile;
  kind: ReturnType<typeof boqPreviewKind>;
  viewHref: string;
  downloadHref: string;
  canOpenInTab: boolean;
  toolbarStart: React.ReactNode;
}

function ViewerBody({ file, kind, viewHref, downloadHref, canOpenInTab, toolbarStart }: ViewerBodyProps): React.JSX.Element {
  const isImage = kind === 'image' || kind === 'tiff';
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(kind === 'image' || kind === 'pdf' || kind === 'tiff' ? 'loading' : 'ready');
  const [zoom, setZoom] = useState<ZoomMode>('fit');
  const [rotation, setRotation] = useState(0);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  useEffect(() => {
    const el = areaRef.current;
    if (!el || !isImage) return;
    const measure = (): void => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isImage]);

  const quarterTurn = rotation === 90 || rotation === 270;
  const rw = natural ? (quarterTurn ? natural.h : natural.w) : 0;
  const rh = natural ? (quarterTurn ? natural.w : natural.h) : 0;
  const fitZoom = natural && box ? Math.min(1, (box.w - 32) / rw, (box.h - 32) / rh) : 1;
  const effectiveZoom = zoom === 'fit' ? fitZoom : zoom;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    const el = areaRef.current;
    if (!el) return;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    const el = areaRef.current;
    const d = drag.current;
    if (!el || !d) return;
    el.scrollLeft = d.left - (e.clientX - d.x);
    el.scrollTop = d.top - (e.clientY - d.y);
  }
  function endDrag(): void {
    drag.current = null;
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b border-white/10 px-3 py-2" role="toolbar" aria-label="Drawing viewer controls">
        {toolbarStart}
        {isImage && (
          <>
            <span className="mx-1 hidden h-6 w-px bg-white/20 sm:block" aria-hidden="true" />
            <button type="button" onClick={() => setZoom(stepBoqZoom(effectiveZoom, 'in'))} className={toolBtn} aria-label="Zoom In" title="Zoom In">
              <ZoomIn className="size-4" aria-hidden="true" />
              <span className="hidden lg:inline">Zoom In</span>
            </button>
            <button type="button" onClick={() => setZoom(stepBoqZoom(effectiveZoom, 'out'))} className={toolBtn} aria-label="Zoom Out" title="Zoom Out">
              <ZoomOut className="size-4" aria-hidden="true" />
              <span className="hidden lg:inline">Zoom Out</span>
            </button>
            <button type="button" onClick={() => setZoom('fit')} className={toolBtn} aria-label="Fit to screen" title="Fit to screen">
              <Maximize2 className="size-4" aria-hidden="true" />
              <span>Fit</span>
            </button>
            <button type="button" onClick={() => setZoom(1)} className={toolBtn} aria-label="Actual size (100%)" title="Actual size (100%)">100%</button>
            <span className="min-w-12 text-center text-xs tabular-nums text-white/70" aria-live="polite">{natural ? `${Math.round(effectiveZoom * 100)}%` : ''}</span>
            <button type="button" onClick={() => setRotation((r) => rotateBoq(r, 'left'))} className={toolBtn} aria-label="Rotate Left" title="Rotate Left">
              <RotateCcw className="size-4" aria-hidden="true" />
              <span className="hidden lg:inline">Rotate Left</span>
            </button>
            <button type="button" onClick={() => setRotation((r) => rotateBoq(r, 'right'))} className={toolBtn} aria-label="Rotate Right" title="Rotate Right">
              <RotateCw className="size-4" aria-hidden="true" />
              <span className="hidden lg:inline">Rotate Right</span>
            </button>
          </>
        )}
        <span className="mx-1 hidden h-6 w-px bg-white/20 sm:block" aria-hidden="true" />
        <a href={downloadHref} className={toolBtn} aria-label="Download" title="Download">
          <Download className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Download</span>
        </a>
        {canOpenInTab && (
          <a href={viewHref} target="_blank" rel="noreferrer" className={toolBtn} aria-label="Open in New Tab" title="Open in New Tab">
            <ExternalLink className="size-4" aria-hidden="true" />
            <span className="hidden lg:inline">Open in New Tab</span>
          </a>
        )}
      </div>

      {/* Viewer area */}
      <div className="relative min-h-0 flex-1">
        {status === 'loading' && (
          <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-sm text-white/70">{kind === 'tiff' ? 'Preparing preview…' : 'Loading file…'}</p>
        )}

        {status === 'error' && (
          <UnavailableMessage
            title={kind === 'tiff' ? 'Preview could not be prepared. Please download the file.' : 'Could not preview this file.'}
            downloadHref={downloadHref}
            fileName={file.originalFileName}
          />
        )}

        {kind === 'unsupported' && (
          <UnavailableMessage title="Preview is not available for this file type. Please download the file." downloadHref={downloadHref} fileName={file.originalFileName} />
        )}

        {kind === 'pdf' && status !== 'error' && (
          <iframe
            src={viewHref}
            title={file.originalFileName}
            className="size-full border-0 bg-white"
            onLoad={() => setStatus('ready')}
            onError={() => setStatus('error')}
          />
        )}

        {isImage && status !== 'error' && (
          <div
            ref={areaRef}
            className="flex size-full cursor-grab overflow-auto active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div className="relative m-auto shrink-0" style={natural ? { width: rw * effectiveZoom, height: rh * effectiveZoom } : undefined}>
              <img
                src={viewHref}
                alt={file.originalFileName}
                draggable={false}
                onLoad={(e) => {
                  setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
                  setStatus('ready');
                }}
                onError={() => setStatus('error')}
                className="select-none"
                style={
                  natural
                    ? {
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: natural.w * effectiveZoom,
                        height: natural.h * effectiveZoom,
                        maxWidth: 'none',
                        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                      }
                    : { opacity: 0, position: 'absolute' }
                }
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function UnavailableMessage({ title, downloadHref, fileName }: { title: string; downloadHref: string; fileName?: string }): React.JSX.Element {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center text-white">
      <p className="max-w-md text-base font-medium">{title}</p>
      {fileName && <p className="max-w-md break-all text-sm text-white/70">{fileName}</p>}
      <a href={downloadHref} className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-900">
        <Download className="size-4" aria-hidden="true" />
        Download file
      </a>
    </div>
  );
}
