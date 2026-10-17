'use client';

import { useEffect, useState } from 'react';
import { Download, Eye, FileText, X } from 'lucide-react';
import type { DrawingGroup, DrawingGroupFile, ElementCoverageRow, ElementDrawingFile } from '@/lib/technical-api';
import { listDrawingGroupFilesAction, listElementDrawingFilesAction } from '../../../../../technical/actions';
import { DRAWING_GROUP_STATUS_CLASSES, DRAWING_GROUP_STATUS_LABELS } from '../../../../../technical/_lib/drawing-group-helpers';
import { elementDrawingDownloadHref, elementDrawingViewHref } from '../../../../../technical/_lib/boq-attachment-helpers';
import { BTN_SECONDARY, BADGE } from '../../../../../technical/_lib/button-styles';
import { formatFileSize } from '../../../../../technical/_lib/technical-format';
import type { ProgressItem } from './boq-item-card';

interface Props {
  contractId: string;
  item: ProgressItem;
  /** This item's elements from the coverage list; null = not available. */
  rows: ElementCoverageRow[] | null;
  onClose: () => void;
  /** Opens the Initial BOQ Drawings section on the page (client drawings are kept there, not here). */
  onOpenInitial: () => void;
}

const groupFileDownloadHref = (contractId: string, groupId: string, fileId: string): string =>
  `/technical/jobs/${contractId}/drawing-groups/${groupId}/attachments/${fileId}/download`;

/**
 * FMP-BOQ-18 — read-only view of the FINAL drawings behind one BOQ item: the drawing groups (with
 * their files) and the elements that carry their own final drawing. Grouping is optional, so both
 * ways are shown side by side. Files load only when asked. Nothing can be added, changed or removed.
 */
export function BoqItemDrawingsModal({ contractId, item, rows, onClose, onOpenInitial }: Props): React.JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const groups = item.groups.filter((g) => g.status !== 'CANCELLED' && g.status !== 'REVISED');
  const own = (rows ?? []).filter((r) => r.individualFileCount > 0);
  const nothing = groups.length === 0 && own.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="boq-drawings-title"
    >
      <div className="my-4 flex max-h-[92vh] w-[min(96vw,820px)] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="boq-drawings-title" className="text-lg font-semibold text-text-primary">Drawings</h2>
            <p className="truncate text-sm text-text-secondary">{item.sortOrder}. {item.description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-text-muted hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {nothing && (
            <p className="rounded-md bg-surface-secondary px-3 py-3 text-sm text-text-muted">
              No final drawings have been added for this BOQ item yet. Technical adds them before elements can be released to Production.
            </p>
          )}

          {groups.length > 0 && (
            <section aria-labelledby="drawings-groups-heading">
              <h3 id="drawings-groups-heading" className="mb-2 text-sm font-semibold text-text-primary">Drawing Groups</h3>
              <ul className="space-y-2">
                {groups.map((g) => (
                  <GroupRow key={g.id} contractId={contractId} group={g} />
                ))}
              </ul>
            </section>
          )}

          {own.length > 0 && (
            <section aria-labelledby="drawings-own-heading">
              <h3 id="drawings-own-heading" className="mb-1 text-sm font-semibold text-text-primary">Elements with their own final drawing</h3>
              <p className="mb-2 text-xs text-text-muted">These elements are not in a drawing group; their drawing belongs to the element itself.</p>
              <ul className="space-y-2">
                {own.map((r) => (
                  <ElementRowFiles key={r.id} contractId={contractId} row={r} />
                ))}
              </ul>
            </section>
          )}

          {rows === null && groups.length === 0 && <p className="text-xs text-text-muted">Element drawings could not be loaded, so only drawing groups are shown.</p>}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-secondary/60 px-3 py-2.5 text-sm text-text-secondary">
            <span>The client&rsquo;s original drawings for this BOQ item are kept under Initial BOQ Drawings.</span>
            <button type="button" onClick={() => { onClose(); onOpenInitial(); }} className={BTN_SECONDARY}>
              <FileText className="size-3.5" aria-hidden="true" />
              Open Initial BOQ Drawings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FileLine({ name, size, children }: { name: string; size: number; children: React.ReactNode }): React.JSX.Element {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-secondary/60 px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium text-text-primary" title={name}>{name}</p>
        <p className="text-xs text-text-muted">{formatFileSize(size)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </li>
  );
}

function GroupRow({ contractId, group }: { contractId: string; group: DrawingGroup }): React.JSX.Element {
  const [files, setFiles] = useState<DrawingGroupFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function toggle(): void {
    const next = !open;
    setOpen(next);
    if (next && files === null) {
      void listDrawingGroupFilesAction(contractId, group.id).then((r) => {
        if (r.error) setError(r.error);
        else setFiles(r.files);
      });
    }
  }

  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">
            {group.drawingNo}
            {group.calculationRef ? <span className="ml-2 text-xs font-normal text-text-secondary">Calc: {group.calculationRef}</span> : null}
          </p>
          <p className="text-xs text-text-secondary">
            {group.groupTitle ? `${group.groupTitle} · ` : ''}
            {group.pieceCount} {group.pieceCount === 1 ? 'element' : 'elements'} · {group.fileCount} {group.fileCount === 1 ? 'file' : 'files'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`${BADGE} ${DRAWING_GROUP_STATUS_CLASSES[group.status]}`}>{DRAWING_GROUP_STATUS_LABELS[group.status]}</span>
          {group.fileCount > 0 && (
            <button type="button" onClick={toggle} aria-expanded={open} className={BTN_SECONDARY}>
              <Eye className="size-3.5" aria-hidden="true" />
              {open ? 'Hide Files' : 'Show Files'}
            </button>
          )}
        </div>
      </div>
      {open && (
        <ul className="mt-2 space-y-1.5">
          {error && <li className="text-sm text-error">{error}</li>}
          {!error && files === null && <li className="text-sm text-text-muted">Loading…</li>}
          {files?.map((f) => (
            <FileLine key={f.id} name={f.originalName} size={f.fileSize}>
              <a href={groupFileDownloadHref(contractId, group.id, f.id)} className={BTN_SECONDARY}>
                <Download className="size-3.5" aria-hidden="true" />
                Download
              </a>
            </FileLine>
          ))}
        </ul>
      )}
    </li>
  );
}

function ElementRowFiles({ contractId, row }: { contractId: string; row: ElementCoverageRow }): React.JSX.Element {
  const [files, setFiles] = useState<ElementDrawingFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function toggle(): void {
    const next = !open;
    setOpen(next);
    if (next && files === null) {
      void listElementDrawingFilesAction(contractId, row.id).then((r) => {
        if (r.error) setError(r.error);
        else setFiles(r.files);
      });
    }
  }

  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">{row.pieceCode}</p>
          <p className="text-xs text-text-secondary">
            {row.individualFileCount} {row.individualFileCount === 1 ? 'file' : 'files'}
            {row.releaseState === 'RELEASED' ? ' · Released to Production' : ' · Not released yet'}
          </p>
        </div>
        <button type="button" onClick={toggle} aria-expanded={open} className={BTN_SECONDARY}>
          <Eye className="size-3.5" aria-hidden="true" />
          {open ? 'Hide Files' : 'Show Files'}
        </button>
      </div>
      {open && (
        <ul className="mt-2 space-y-1.5">
          {error && <li className="text-sm text-error">{error}</li>}
          {!error && files === null && <li className="text-sm text-text-muted">Loading…</li>}
          {files?.map((f) => (
            <FileLine key={f.id} name={f.originalName} size={f.fileSize}>
              <a href={elementDrawingViewHref(contractId, f.pieceId, f.id)} target="_blank" rel="noreferrer" className={BTN_SECONDARY}>
                <Eye className="size-3.5" aria-hidden="true" />
                View Drawing
              </a>
              <a href={elementDrawingDownloadHref(contractId, f.pieceId, f.id)} className={BTN_SECONDARY}>
                <Download className="size-3.5" aria-hidden="true" />
                Download
              </a>
            </FileLine>
          ))}
        </ul>
      )}
    </li>
  );
}
