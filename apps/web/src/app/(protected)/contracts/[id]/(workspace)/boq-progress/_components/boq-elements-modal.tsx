'use client';

import { useEffect, useMemo, useState } from 'react';
import { History, Search, X } from 'lucide-react';
import type { BoqPiece, BoqPieceHistoryEntry, ElementCoverageRow } from '@/lib/technical-api';
import { getBoqPieceHistoryAction, listBoqPiecesAction } from '../../../../../technical/actions';
import { BOQ_PIECE_STATUS_CLASSES } from '../../../../../technical/_lib/boq-confirmation-helpers';
import { BTN_QUIET, BADGE } from '../../../../../technical/_lib/button-styles';
import { formatDate, formatDateTime } from '../../../../../technical/_lib/technical-format';
import {
  ELEMENT_FILTER_LABELS,
  ELEMENT_TEXT,
  elementDrawingStatus,
  elementStage,
  elementStatusLabel,
  matchesElementFilter,
} from '../../../../_lib/boq-element-progress-helpers';
import type { ElementFilterKey, ElementView } from '../../../../_lib/boq-element-progress-helpers';
import { BOQ_PIECE_STATUS_LABELS } from '../../../../../technical/_lib/boq-confirmation-helpers';
import type { ProgressItem } from './boq-item-card';

interface Props {
  contractId: string;
  item: ProgressItem;
  /** This item's elements from the coverage list (release / drawing state); null = not available. */
  rows: ElementCoverageRow[] | null;
  initialFilter: ElementFilterKey;
  onClose: () => void;
}

interface Merged extends ElementView {
  code: string;
  updatedAt: string;
  drawingGroupNo: string | null;
  coverageRow: ElementCoverageRow | null;
}

/** Filters offered as chips, in the order the work flows. */
const CHIP_ORDER: ElementFilterKey[] = [
  'ALL', 'WAITING_DRAWING', 'WAITING_RELEASE', 'WAITING_PRODUCTION', 'GENERATED', 'IN_PRODUCTION', 'PRODUCED', 'IN_STORAGE',
  'DELIVERY_PENDING', 'DELIVERED', 'ERECTED', 'COMPLETED', 'HOLD', 'REJECTED', 'CANCELLED', 'NO_RELEASE_RECORD',
];

/**
 * FMP-BOQ-18 — read-only list of one BOQ item's individual elements: code, who holds it, status,
 * drawing state, drawing group (if any), last update and its history. It combines the element list
 * with the Technical coverage list so the release / drawing wording matches the Technical pages.
 */
export function BoqElementsModal({ contractId, item, rows, initialFilter, onClose }: Props): React.JSX.Element {
  const [pieces, setPieces] = useState<BoqPiece[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ElementFilterKey>(initialFilter);
  const [search, setSearch] = useState('');
  const [openHistory, setOpenHistory] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listBoqPiecesAction(contractId, item.boqItemId).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else setPieces(result.pieces);
    });
    return () => {
      cancelled = true;
    };
  }, [contractId, item.boqItemId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const merged: Merged[] | null = useMemo(() => {
    if (!pieces) return null;
    const byId = new Map((rows ?? []).map((r) => [r.id, r]));
    return pieces.map((p) => {
      const cov = byId.get(p.id) ?? null;
      const group = p.drawingGroupLinks?.[0]?.group ?? null;
      return {
        id: p.id,
        code: p.pieceCode,
        status: p.currentStatus,
        updatedAt: p.updatedAt,
        // Cancelled elements are not in the coverage list: nothing is claimed about their release.
        releaseState: cov?.releaseState ?? null,
        coverage: cov?.coverage ?? null,
        drawingGroupNo: group?.drawingNo ?? null,
        coverageRow: cov,
      };
    });
  }, [pieces, rows]);

  const counts = useMemo(() => {
    const map = new Map<ElementFilterKey, number>();
    if (!merged) return map;
    for (const key of CHIP_ORDER) map.set(key, merged.filter((m) => matchesElementFilter(m, key)).length);
    return map;
  }, [merged]);

  const visible = useMemo(() => {
    if (!merged) return [];
    const q = search.trim().toLowerCase();
    return merged.filter((m) => matchesElementFilter(m, filter) && (q === '' || m.code.toLowerCase().includes(q)));
  }, [merged, filter, search]);

  // A chip shows only when it has elements (All and the chosen one always show).
  const chips = CHIP_ORDER.filter((k) => k === 'ALL' || k === filter || (counts.get(k) ?? 0) > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="boq-elements-title"
    >
      <div className="my-4 flex max-h-[92vh] w-[min(96vw,1040px)] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="boq-elements-title" className="text-lg font-semibold text-text-primary">Elements</h2>
            <p className="truncate text-sm text-text-secondary">{item.sortOrder}. {item.description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-text-muted hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="shrink-0 space-y-2 border-b border-border px-5 py-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search element code"
              aria-label="Search element code"
              className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter elements">
            {chips.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={`rounded-full border px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-focus ${
                  filter === key ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface text-text-secondary hover:bg-surface-secondary'
                }`}
              >
                {ELEMENT_FILTER_LABELS[key]}
                {merged ? ` (${counts.get(key) ?? 0})` : ''}
              </button>
            ))}
          </div>
          {rows === null && <p className="text-xs text-text-muted">{ELEMENT_TEXT.releaseUnavailable}</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && <p className="px-5 py-4 text-sm text-error">{error}</p>}
          {!error && merged === null && <p className="py-8 text-center text-sm text-text-muted">Loading…</p>}
          {merged && visible.length === 0 && <p className="py-8 text-center text-sm text-text-muted">{ELEMENT_TEXT.noElements}</p>}
          {merged && visible.length > 0 && (
            <table className="w-full table-fixed text-sm">
              <thead className="sticky top-0 z-10 bg-surface-secondary text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="w-[17%] px-4 py-2">Element Code</th>
                  <th className="w-[15%] px-3 py-2">Department / Stage</th>
                  <th className="w-[19%] px-3 py-2">Status</th>
                  <th className="w-[25%] px-3 py-2">Drawing</th>
                  <th className="w-[12%] px-3 py-2">Last Updated</th>
                  <th className="w-[12%] px-3 py-2 text-right">History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((m) => (
                  <ElementRow
                    key={m.id}
                    contractId={contractId}
                    el={m}
                    historyOpen={openHistory === m.id}
                    onToggleHistory={() => setOpenHistory((cur) => (cur === m.id ? null : m.id))}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function ElementRow({ contractId, el, historyOpen, onToggleHistory }: { contractId: string; el: Merged; historyOpen: boolean; onToggleHistory: () => void }): React.JSX.Element {
  return (
    <>
      <tr className="align-top">
        <td className="px-4 py-2.5 font-medium text-text-primary">{el.code}</td>
        <td className="px-3 py-2.5 text-text-secondary">{elementStage(el.status, el.releaseState)}</td>
        <td className="px-3 py-2.5">
          <span className={`${BADGE} ${BOQ_PIECE_STATUS_CLASSES[el.status]}`}>{elementStatusLabel(el.status, el.releaseState)}</span>
        </td>
        <td className="px-3 py-2.5 text-text-secondary">
          <span className={el.releaseState === 'RELEASED' ? 'font-medium text-success' : ''}>{elementDrawingStatus(el.releaseState, el.coverage)}</span>
          <span className="block text-xs text-text-muted">{el.drawingGroupNo ? `Drawing Group ${el.drawingGroupNo}` : 'No drawing group'}</span>
        </td>
        <td className="px-3 py-2.5 text-text-secondary">{formatDate(el.updatedAt)}</td>
        <td className="px-3 py-2.5 text-right">
          <button type="button" onClick={onToggleHistory} aria-expanded={historyOpen} className={BTN_QUIET}>
            <History className="size-3.5" aria-hidden="true" />
            {historyOpen ? 'Hide' : 'History'}
          </button>
        </td>
      </tr>
      {historyOpen && (
        <tr className="bg-surface-secondary/40">
          <td colSpan={6} className="px-4 py-3">
            <ElementHistory contractId={contractId} el={el} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Release (from Technical) followed by every status change, newest first. */
function ElementHistory({ contractId, el }: { contractId: string; el: Merged }): React.JSX.Element {
  const [entries, setEntries] = useState<BoqPieceHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getBoqPieceHistoryAction(contractId, el.id).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else setEntries(result.entries);
    });
    return () => {
      cancelled = true;
    };
  }, [contractId, el.id]);

  const cov = el.coverageRow;
  const release =
    cov && cov.releaseState === 'RELEASED' && cov.releasedAt
      ? `Released to Production by Technical${cov.releasedByName ? ` (${cov.releasedByName})` : ''}${cov.releasedVia === 'GROUP' ? ' through its drawing group' : cov.releasedVia === 'INDIVIDUAL' ? ' on its own' : ''}`
      : null;

  if (error) return <p className="text-sm text-error">{error}</p>;
  if (entries === null) return <p className="text-sm text-text-muted">Loading history…</p>;

  const label = (st: BoqPieceHistoryEntry['newStatus']): string => BOQ_PIECE_STATUS_LABELS[st];

  // The Technical release is part of the story, so it sits in date order with the status changes (newest first).
  const lines: { key: string; date: string; text: string; by: string | null; note: string | null; release: boolean }[] = entries.map((h) => ({
    key: h.id,
    date: h.createdAt,
    text: h.oldStatus ? `${label(h.oldStatus)} → ${label(h.newStatus)}` : `Created as ${label(h.newStatus)}`,
    by: h.updatedByUser?.displayName ?? null,
    note: h.note,
    release: false,
  }));
  if (release && cov?.releasedAt) lines.push({ key: 'release', date: cov.releasedAt, text: release, by: null, note: null, release: true });
  lines.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());

  if (lines.length === 0) return <p className="text-sm text-text-muted">No history yet.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {lines.map((l) => (
        <li key={l.key} className="flex flex-wrap gap-x-3 text-text-secondary">
          <span className="w-36 shrink-0 text-xs text-text-muted">{formatDateTime(l.date)}</span>
          <span className={`font-medium ${l.release ? 'text-success' : 'text-text-primary'}`}>{l.text}</span>
          {l.by && <span>by {l.by}</span>}
          {l.note && <span className="text-text-muted">— {l.note}</span>}
        </li>
      ))}
    </ul>
  );
}
