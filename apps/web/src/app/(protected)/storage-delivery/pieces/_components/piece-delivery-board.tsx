'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BoqPieceHistoryEntry, BoqPieceUpdateStatus } from '@/lib/technical-api';
import type { StoragePiece } from '@/lib/storage-delivery-pieces-api';
import {
  BOQ_PIECE_STATUS_LABELS,
  BOQ_PIECE_STATUS_CLASSES,
  pieceUpdateOptionsFor,
  validatePieceUpdate,
} from '../../../technical/_lib/boq-confirmation-helpers';
import { storageContractLabel, showsLocationInput } from '../_lib/storage-pieces-helpers';
import { updateStoragePieceStatusAction, getStoragePieceHistoryAction } from '../actions';

interface Props {
  pieces: StoragePiece[];
  /** Statuses this user may set (from the API); null/empty = read-only list. */
  allowedStatuses: BoqPieceUpdateStatus[] | null;
}

const btnCls =
  'inline-flex items-center h-8 px-3 rounded-md border border-border bg-surface text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * FMP-BOQ-08 — Storage Yard & Delivery's piece list: tick pieces, choose In Store /
 * Delivered / Hold / Rejected, add a note and (for In Store / Delivered) an optional
 * Location, Update Status. Read-only users see the
 * list and History only. All rules (allowed statuses, skipped pieces, history)
 * come from the shared piece engine on the API.
 */
export function PieceDeliveryBoard({ pieces, allowedStatuses }: Props): React.JSX.Element {
  const router = useRouter();
  const options = pieceUpdateOptionsFor(allowedStatuses);
  const canUpdate = options.length > 0;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetStatus, setTargetStatus] = useState('');
  const [note, setNote] = useState('');
  const [location, setLocation] = useState('');
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<{ loading: boolean; error: string | null; entries: BoqPieceHistoryEntry[] }>({
    loading: false,
    error: null,
    entries: [],
  });

  const allSelected = pieces.length > 0 && pieces.every((p) => selected.has(p.id));

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyUpdate(): Promise<void> {
    if (updating) return;
    const problem = validatePieceUpdate(selected.size, targetStatus);
    if (problem) {
      setMessage({ tone: 'error', text: problem });
      return;
    }
    setUpdating(true);
    setMessage(null);
    const result = await updateStoragePieceStatusAction([...selected], targetStatus as BoqPieceUpdateStatus, note, showsLocationInput(targetStatus) ? location : '');
    setUpdating(false);
    if (result.error) {
      setMessage({ tone: 'error', text: result.error });
      return;
    }
    setMessage({ tone: result.updatedCount > 0 ? 'ok' : 'error', text: result.message ?? 'Pieces updated.' });
    setSelected(new Set());
    setNote('');
    setLocation('');
    setHistoryFor(null);
    // Reload the list and the summary cards from the server.
    router.refresh();
  }

  async function toggleHistory(pieceId: string): Promise<void> {
    if (historyFor === pieceId) {
      setHistoryFor(null);
      return;
    }
    setHistoryFor(pieceId);
    setHistory({ loading: true, error: null, entries: [] });
    const result = await getStoragePieceHistoryAction(pieceId);
    setHistory({ loading: false, error: result.error, entries: result.entries });
  }

  return (
    <div className="space-y-3">
      {canUpdate && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-44">
              <label htmlFor="store-target-status" className="mb-1 block text-xs font-medium text-text-secondary">Update selected to</label>
              <select
                id="store-target-status"
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">Select status</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {showsLocationInput(targetStatus) && (
              <div className="min-w-40">
                <label htmlFor="store-location" className="mb-1 block text-xs font-medium text-text-secondary">Location</label>
                <input
                  id="store-location"
                  type="text"
                  maxLength={200}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Example: Yard A, Bay 3, Site"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            )}
            <div className="min-w-48 flex-1">
              <label htmlFor="store-note" className="mb-1 block text-xs font-medium text-text-secondary">Note</label>
              <input
                id="store-note"
                type="text"
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <button
              type="button"
              onClick={() => void applyUpdate()}
              disabled={updating}
              className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
            >
              {updating ? 'Updating…' : 'Update Status'}
            </button>
          </div>
          <p className="mt-2 text-xs text-text-secondary">{selected.size} selected</p>
        </div>
      )}

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

      <div className="rounded-lg border border-border bg-surface">
        {canUpdate && (
          <label className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs font-medium text-text-secondary">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(pieces.map((p) => p.id)))}
              className="size-4 rounded border-border accent-[var(--color-accent)]"
            />
            Select all shown ({pieces.length})
          </label>
        )}
        <ul className="divide-y divide-border">
          {pieces.map((p) => (
            <li key={p.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {canUpdate && (
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    aria-label={`Select ${p.pieceCode}`}
                    className="size-4 shrink-0 rounded border-border accent-[var(--color-accent)]"
                  />
                )}
                <div className="min-w-0 flex-1 basis-56">
                  <p className="text-sm font-semibold text-text-primary">{p.pieceCode}</p>
                  <p className="truncate text-xs text-text-secondary" title={storageContractLabel(p.contract)}>{storageContractLabel(p.contract)}</p>
                  <p className="truncate text-xs text-text-secondary">
                    {p.boqItem.description} · Drawing {p.drawingNo}
                    {p.sizeOrSpecification ? ` · ${p.sizeOrSpecification}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                  <span>Location: {p.currentLocation || '—'}</span>
                  <span>Updated {formatDate(p.updatedAt)}</span>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 font-medium ${BOQ_PIECE_STATUS_CLASSES[p.currentStatus]}`}>
                    {BOQ_PIECE_STATUS_LABELS[p.currentStatus]}
                  </span>
                  <button type="button" onClick={() => void toggleHistory(p.id)} aria-expanded={historyFor === p.id} className={btnCls}>
                    History
                  </button>
                </div>
              </div>

              {historyFor === p.id && (
                <div className="mt-2 rounded-md bg-surface-secondary/60 px-3 py-2">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">Piece History</p>
                  {history.loading && <p className="text-xs text-text-muted">Loading…</p>}
                  {history.error && <p className="text-xs text-error">{history.error}</p>}
                  {!history.loading && !history.error && history.entries.length === 0 && <p className="text-xs text-text-muted">No history yet.</p>}
                  <ul className="space-y-1.5">
                    {history.entries.map((h) => (
                      <li key={h.id} className="text-xs text-text-secondary">
                        <span className="font-medium text-text-primary">{formatDateTime(h.createdAt)}</span>
                        {' · '}
                        {h.oldStatus ? BOQ_PIECE_STATUS_LABELS[h.oldStatus] : 'New'}
                        {' → '}
                        <span className="font-medium text-text-primary">{BOQ_PIECE_STATUS_LABELS[h.newStatus]}</span>
                        {' · '}
                        {h.updatedByUser?.displayName ?? 'System'}
                        {h.note ? <span className="block text-text-muted">{h.note}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
