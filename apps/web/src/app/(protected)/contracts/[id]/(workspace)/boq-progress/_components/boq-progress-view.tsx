'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { BoqPiece, BoqPieceStatus } from '@/lib/technical-api';
import { listBoqPiecesAction } from '../../../../../technical/actions';
import {
  BOQ_PIECE_STATUS_CLASSES,
  BOQ_PIECE_STATUS_LABELS,
  formatConfirmedPieces,
} from '../../../../../technical/_lib/boq-confirmation-helpers';
import { DRAWING_GROUP_STATUS_CLASSES, DRAWING_GROUP_STATUS_LABELS, formatGroupDate } from '../../../../../technical/_lib/drawing-group-helpers';
import {
  PROGRESS_TILES,
  progressFlow,
  technicalReleaseNote,
  pieceReleaseLabel,
  withTechnicalRelease,
  TOTAL_CARDS,
  MESSAGES,
  attentionReasons,
  completedProgress,
  contractQtyText,
  contractTotals,
  itemStateMessage,
  tileCount,
} from '../../../../_lib/boq-progress-helpers';

type ProgressItem = ReturnType<typeof withTechnicalRelease>[number];

interface Props {
  contractId: string;
  items: ProgressItem[];
}

// Contract Management can see pieces but never change them. Cancelled is its own
// filter here (the department update screens never list cancelled pieces).
const FILTER_ORDER: (BoqPieceStatus | 'ALL')[] = [
  'ALL', 'DRAWING_READY', 'IN_PRODUCTION', 'PRODUCED', 'IN_STORE', 'DELIVERED', 'ERECTED', 'COMPLETED', 'ON_HOLD', 'REJECTED', 'CANCELLED',
];
const FILTERS = FILTER_ORDER.map((value) => ({ value, label: value === 'ALL' ? 'All' : BOQ_PIECE_STATUS_LABELS[value] }));

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * FMP-BOQ-10 — "BOQ Progress" for managers: contract totals, then per BOQ item
 * Contract Qty → Drawing Confirmed Pieces → Pieces Generated → status counts,
 * a "N of M completed" bar and a read-only View Pieces list. Nothing on this
 * page can change a piece.
 */
export function BoqProgressView({ contractId, items }: Props): React.JSX.Element {
  const [viewing, setViewing] = useState<ProgressItem | null>(null);
  const [viewingGroups, setViewingGroups] = useState<ProgressItem | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface px-6 py-12 text-center">
        <p className="text-sm text-text-muted">{MESSAGES.noItems}</p>
      </div>
    );
  }

  const totals = contractTotals(items);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {TOTAL_CARDS.map((card) => (
          <div
            key={card.key}
            className={`rounded-lg border bg-surface px-4 py-3 ${
              card.key === 'needsAttention' && totals.needsAttention > 0 ? 'border-warning' : 'border-border'
            }`}
          >
            <p className="text-xs font-medium text-text-secondary">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{totals[card.key]}</p>
          </div>
        ))}
      </div>

      <ul className="space-y-3">
        {items.map((item) => {
          const progress = completedProgress(item);
          const reasons = attentionReasons(item);
          const stateMessage = itemStateMessage(item);
          return (
            <li key={item.boqItemId} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">
                    {item.sortOrder}. {item.description}
                  </p>
                  <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-secondary">
                    <div className="flex gap-1">
                      <dt>Contract Qty:</dt>
                      <dd className="font-medium text-text-primary">{contractQtyText(item)}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>Drawing Confirmed Pieces:</dt>
                      <dd className="font-medium text-text-primary">{formatConfirmedPieces(item.confirmedPieces)}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>Pieces Generated:</dt>
                      <dd className="font-medium text-text-primary">{item.piecesGenerated}</dd>
                    </div>
                  </dl>
                </div>
                <div className="flex items-center gap-2">
                  {reasons.length > 0 && (
                    <span className="inline-flex rounded-full bg-warning-light px-2.5 py-0.5 text-xs font-semibold text-warning">Needs Attention</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewing(item)}
                    className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
                  >
                    View Pieces
                  </button>
                  {item.technical && (
                    <button
                      type="button"
                      onClick={() => setViewingGroups(item)}
                      className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      View Drawing Groups
                    </button>
                  )}
                </div>
              </div>

              {stateMessage ? (
                <p className="mt-3 rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-muted">{stateMessage}</p>
              ) : (
                <>
                  <ol className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs" aria-label="Progress flow">
                    {progressFlow(item).map((step, i) => (
                      <li key={step.key} className="flex items-center gap-1">
                        {i > 0 && <span aria-hidden="true" className="text-text-muted">→</span>}
                        <span className="rounded-md bg-surface-secondary px-2 py-1">
                          <span className="text-text-secondary">{step.label}</span>{' '}
                          <span className="font-semibold tabular-nums text-text-primary">{step.count ?? '—'}</span>
                        </span>
                      </li>
                    ))}
                  </ol>

                  {item.technical && (
                    <div className="mt-3 rounded-md border border-border px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Technical Release</p>
                      <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-secondary">
                        <div className="flex gap-1"><dt>Assigned to Groups:</dt><dd className="font-medium text-text-primary">{item.technical.assigned}</dd></div>
                        <div className="flex gap-1"><dt>Not Assigned:</dt><dd className={`font-medium ${item.technical.notAssigned > 0 ? 'text-warning' : 'text-text-primary'}`}>{item.technical.notAssigned}</dd></div>
                        <div className="flex gap-1"><dt>Released to Production:</dt><dd className="font-medium text-text-primary">{item.technical.released}</dd></div>
                        <div className="flex gap-1"><dt>Not Released:</dt><dd className={`font-medium ${item.technical.notReleased > 0 ? 'text-warning' : 'text-text-primary'}`}>{item.technical.notReleased}</dd></div>
                      </dl>
                      <p className="mt-1 text-xs text-text-muted">
                        {technicalReleaseNote(item, item.groups.length) ? `${technicalReleaseNote(item, item.groups.length)} ` : ''}
                        {MESSAGES.releaseHelp}
                      </p>
                    </div>
                  )}

                  <div className="mt-3">
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={progress.generated}
                      aria-valuenow={progress.completed}
                      aria-label={progress.text}
                      className="h-2 w-full overflow-hidden rounded-full bg-surface-secondary"
                    >
                      <div className="h-full rounded-full bg-success" style={{ width: `${progress.percent}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">{progress.text}</p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                    {PROGRESS_TILES.map((tile) => (
                      <div key={tile.key} className="rounded-md bg-surface-secondary px-3 py-2">
                        <p className="text-[11px] text-text-secondary">{tile.label}</p>
                        <p className="text-lg font-semibold tabular-nums text-text-primary">{tileCount(item, tile.key)}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {reasons.length > 0 && (
                <p className="mt-2 text-xs text-warning">
                  {MESSAGES.attentionHelp} <span className="text-text-secondary">({reasons.join('; ')})</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {viewingGroups && <GroupsList item={viewingGroups} onClose={() => setViewingGroups(null)} />}

      {viewing && <PiecesList contractId={contractId} item={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

/** Read-only piece list for one BOQ item. */
function PiecesList({ contractId, item, onClose }: { contractId: string; item: ProgressItem; onClose: () => void }): React.JSX.Element {
  const [filter, setFilter] = useState<BoqPieceStatus | 'ALL'>('ALL');
  const [pieces, setPieces] = useState<BoqPiece[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPieces(null);
    setError(null);
    void listBoqPiecesAction(contractId, item.boqItemId, filter === 'ALL' ? undefined : filter).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else setPieces(result.pieces);
    });
    return () => {
      cancelled = true;
    };
  }, [contractId, item.boqItemId, filter]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="boq-progress-pieces-title"
    >
      <div className="my-4 flex max-h-[92vh] w-[min(96vw,860px)] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="boq-progress-pieces-title" className="text-lg font-semibold text-text-primary">Pieces</h2>
            <p className="truncate text-sm text-text-secondary">{item.description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-text-muted hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-border px-5 py-3">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={`rounded-full border px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-focus ${
                filter === f.value ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface text-text-secondary hover:bg-surface-secondary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {error && <p className="text-sm text-error">{error}</p>}
          {!error && pieces === null && <p className="py-6 text-center text-sm text-text-muted">Loading…</p>}
          {pieces && pieces.length === 0 && <p className="py-6 text-center text-sm text-text-muted">{MESSAGES.noPieces}</p>}
          {pieces && pieces.length > 0 && (
            <ul className="divide-y divide-border">
              {pieces.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                  <div className="min-w-0 flex-1 basis-44">
                    <p className="text-sm font-medium text-text-primary">{p.pieceCode}</p>
                    <p className="text-xs text-text-secondary">
                      Drawing {p.drawingGroupLinks?.[0]?.group.drawingNo ?? p.drawingNo}
                      {p.drawingGroupLinks?.[0]?.group.calculationRef ? ` · Calc ${p.drawingGroupLinks[0].group.calculationRef}` : ''}
                      {p.sizeOrSpecification ? ` · ${p.sizeOrSpecification}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                    <span>Group: {p.drawingGroupLinks?.[0] ? DRAWING_GROUP_STATUS_LABELS[p.drawingGroupLinks[0].group.status] : '—'}</span>
                    <span className={pieceReleaseLabel(p.drawingGroupLinks?.[0]?.group) === 'Released to Production' ? 'font-medium text-success' : ''}>
                      Release: {pieceReleaseLabel(p.drawingGroupLinks?.[0]?.group)}
                    </span>
                    <span>Location: {p.currentLocation || '—'}</span>
                    <span>Updated {formatDate(p.updatedAt)}</span>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 font-medium ${BOQ_PIECE_STATUS_CLASSES[p.currentStatus]}`}>
                      {BOQ_PIECE_STATUS_LABELS[p.currentStatus]}
                    </span>
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

/** Read-only list of an item's drawing / calculation groups (no edit, upload or delete). */
function GroupsList({ item, onClose }: { item: ProgressItem; onClose: () => void }): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-labelledby="boq-progress-groups-title">
      <div className="my-4 flex max-h-[92vh] w-[min(96vw,760px)] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="boq-progress-groups-title" className="text-lg font-semibold text-text-primary">Drawing Groups</h2>
            <p className="truncate text-sm text-text-secondary">{item.description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-text-muted hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {item.groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">{MESSAGES.noGroups}</p>
          ) : (
            <ul className="divide-y divide-border">
              {item.groups.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="text-sm font-medium text-text-primary">
                      {g.drawingNo}
                      {g.calculationRef ? <span className="ml-2 text-xs font-normal text-text-secondary">Calc: {g.calculationRef}</span> : null}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {g.groupTitle ? `${g.groupTitle} · ` : ''}
                      {g.pieceCount} {g.pieceCount === 1 ? 'piece' : 'pieces'} · {g.fileCount} {g.fileCount === 1 ? 'file' : 'files'}
                      {formatGroupDate(g.releasedAt) ? ` · Released ${formatGroupDate(g.releasedAt)}` : ''}
                    </p>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${DRAWING_GROUP_STATUS_CLASSES[g.status]}`}>
                    {DRAWING_GROUP_STATUS_LABELS[g.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
