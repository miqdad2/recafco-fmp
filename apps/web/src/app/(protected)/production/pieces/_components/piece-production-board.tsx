'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import type { BoqPieceHistoryEntry, BoqPieceUpdateStatus } from '@/lib/technical-api';
import type { ProductionPiece } from '@/lib/production-pieces-api';
import { BOQ_PIECE_STATUS_CLASSES } from '../../../technical/_lib/boq-confirmation-helpers';
import { contractLabel } from '../_lib/production-pieces-helpers';
import {
  PRODUCTION_STATUS_LABELS,
  actionFieldLabel,
  actionMessage,
  bulkActionsFor,
  buildActionNote,
  MISSING_DRAWING_MESSAGE,
  drawingLineText,
  formatMilestoneDate,
  historyLine,
  mergeRetained,
  milestoneInfo,
  retainUpdated,
  showsDrawingButtons,
  statusFilterHref,
  targetFilterFor,
  showsMissingDrawing,
  startConfirmation,
  historyEventText,
  lastUpdateInfo,
  needsAttention,
  resultMessage,
  rowActionsFor,
  todayInputValue,
  validateActionForm,
} from '../_lib/production-work-helpers';
import type { ProductionActionDef } from '../_lib/production-work-helpers';
import { ProductionDrawingViewer } from './production-drawing-viewer';
import { ProductionDrawingDownload } from './production-drawing-download';
import { updateProductionPieceStatusAction, getProductionPieceHistoryAction } from '../actions';

interface Props {
  pieces: ProductionPiece[];
  /** Statuses this user may set (from the API); null/empty = view-only. */
  allowedStatuses: BoqPieceUpdateStatus[] | null;
  /** Shown as "by" on elements just updated, until the server list is reloaded. */
  currentUserName: string | null;
  /** The page's active status filter value (DEFAULT, PRODUCED, ...). */
  statusFilter: string;
  contractId: string;
  emptyTitle: string;
  emptyHelp: string;
}

const btnCls =
  'inline-flex items-center h-8 px-3 rounded-md border border-border bg-surface text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus';
const primaryBtnCls =
  'inline-flex items-center h-8 px-3 rounded-md bg-accent text-xs font-semibold text-accent-foreground shadow-sm hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60';
const dangerBtnCls =
  'inline-flex items-center h-8 px-3 rounded-md border border-error text-xs font-medium text-error hover:bg-error-light focus:outline-none focus:ring-2 focus:ring-focus';
const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function actionBtnClass(action: ProductionActionDef, first: boolean): string {
  if (action.danger) return dangerBtnCls;
  return first ? primaryBtnCls : btnCls;
}

interface PendingAction {
  action: ProductionActionDef;
  ids: string[];
}

/**
 * FMP-PROD-02 — Production Work: the released elements, with the buttons that
 * make sense for each element's status. Production users start, finish, hold,
 * reject and hand over elements; view-only users see status and History only.
 * Every update goes through the shared piece engine on the API, which also
 * enforces who may set which status.
 */
export function PieceProductionBoard({ pieces: loadedPieces, allowedStatuses, currentUserName, statusFilter, contractId, emptyTitle, emptyHelp }: Props): React.JSX.Element {
  const router = useRouter();
  const canUpdate = Boolean(allowedStatuses && allowedStatuses.length > 0);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [text, setText] = useState('');
  const [producedDate, setProducedDate] = useState(todayInputValue());
  const [formError, setFormError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string; link?: { href: string; label: string } } | null>(null);
  const [retained, setRetained] = useState<ProductionPiece[]>([]);
  const pieces = mergeRetained(loadedPieces, retained);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ id: string; pieceCode: string } | null>(null);
  const [checked, setChecked] = useState(false);
  const [history, setHistory] = useState<{ loading: boolean; error: string | null; entries: BoqPieceHistoryEntry[] }>({
    loading: false,
    error: null,
    entries: [],
  });
  const dialogRef = useRef<HTMLDivElement>(null);

  const selectedPieces = pieces.filter((p) => selected.has(p.id));
  const bulkActions = bulkActionsFor(selectedPieces.map((p) => ({ status: p.currentStatus, hasDrawing: p.drawing.hasDrawing })), allowedStatuses);
  const allSelected = pieces.length > 0 && pieces.every((p) => selected.has(p.id));

  useEffect(() => {
    if (!pending) return;
    dialogRef.current?.focus();
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape' && !updating) setPending(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, updating]);

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openAction(action: ProductionActionDef, ids: string[]): void {
    setPending({ action, ids });
    setText('');
    setProducedDate(todayInputValue());
    setFormError(null);
    setChecked(false);
  }

  async function confirmAction(): Promise<void> {
    if (!pending || updating) return;
    if (pending.action.key === 'START' && !checked) {
      setFormError('Please confirm the final drawing has been checked.');
      return;
    }
    const values = { producedDate, text };
    const problem = validateActionForm(pending.action, values);
    if (problem) {
      setFormError(problem);
      return;
    }
    setUpdating(true);
    setFormError(null);
    const result = await updateProductionPieceStatusAction(pending.ids, pending.action.target, buildActionNote(pending.action, values));
    setUpdating(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    const target = targetFilterFor(pending.action);
    // Elements that move out of the active filter are explained, not silently dropped.
    const leavesFilter = statusFilter !== 'ALL' && statusFilter !== target.value;
    if (result.updatedCount > 0) {
      setRetained((prev) => [
        ...prev.filter((p) => !pending.ids.includes(p.id)),
        ...retainUpdated(pieces, pending.ids, pending.action, buildActionNote(pending.action, values), currentUserName, new Date().toISOString()),
      ]);
    }
    setMessage({
      tone: result.updatedCount > 0 ? 'ok' : 'error',
      ...(result.updatedCount > 0 && leavesFilter ? { link: { href: statusFilterHref(target.value, contractId), label: target.label } } : {}),
      text: result.updatedCount > 0 ? resultMessage(pending.action, result.updatedCount, result.message, result.skippedCount) : (result.message ?? 'No elements were updated.'),
    });
    setPending(null);
    setSelected(new Set());
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
    const result = await getProductionPieceHistoryAction(pieceId);
    setHistory({ loading: false, error: result.error, entries: result.entries });
  }

  return (
    <div className="space-y-3">
      {!canUpdate && (
        <div role="note" className="rounded-md border border-info bg-info-light px-4 py-2.5 text-sm text-info">
          You can view this page. Update actions are available only to authorized production users.
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
          {message.link && (
            <>
              {' '}Kept here until you change the filter.{' '}
              <Link href={message.link.href} className="font-semibold underline">{message.link.label}</Link>
            </>
          )}
        </div>
      )}

      {canUpdate && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent bg-surface px-4 py-3">
          <p className="text-sm font-medium text-text-primary">{selected.size} selected</p>
          {bulkActions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {bulkActions.map((a, i) => (
                <button key={a.key} type="button" onClick={() => openAction(a, [...selected])} className={actionBtnClass(a, i === 0)}>
                  {a.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-secondary">Select elements with the same status to update them together.</p>
          )}
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-text-secondary underline hover:text-text-primary">
            Clear selection
          </button>
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
        {pieces.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-base font-medium text-text-primary">{emptyTitle}</p>
            <p className="mt-1 text-sm text-text-secondary">{emptyHelp}</p>
          </div>
        )}
        <ul className="divide-y divide-border">
          {pieces.map((p) => {
            const actions = rowActionsFor(p.currentStatus, allowedStatuses, p.drawing.hasDrawing);
            const missingDrawing = showsMissingDrawing(p);
            const milestones = milestoneInfo(p);
            const last = lastUpdateInfo(p);
            const attention = needsAttention(p.currentStatus);
            return (
              <li key={p.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                  {canUpdate && (
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      aria-label={`Select ${p.pieceCode}`}
                      className="mt-1 size-4 shrink-0 rounded border-border accent-[var(--color-accent)]"
                    />
                  )}

                  {/* Left — which element */}
                  <div className="min-w-0 flex-1 basis-64">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary">{p.pieceCode}</p>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${BOQ_PIECE_STATUS_CLASSES[p.currentStatus]}`}>
                        {PRODUCTION_STATUS_LABELS[p.currentStatus]}
                      </span>
                    </div>
                    <p className="truncate text-xs text-text-secondary" title={contractLabel(p.contract)}>{contractLabel(p.contract)}</p>
                    <p className="truncate text-xs text-text-secondary">
                      {p.boqItem.description}
                      {p.sizeOrSpecification ? ` · ${p.sizeOrSpecification}` : ''}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
                      <span className="truncate" title={drawingLineText(p.drawing)}>{drawingLineText(p.drawing)}</span>
                      {missingDrawing && (
                        <span className="inline-flex rounded-full bg-error-light px-2 py-0.5 font-medium text-error">Missing Drawing</span>
                      )}
                    </p>
                  </div>

                  {/* Middle — latest update */}
                  <div className="min-w-0 basis-52 text-xs text-text-secondary">
                    <p>Last updated {formatDateTime(p.updatedAt)}</p>
                    {last?.by && !milestones.produced && !milestones.sent && <p>By {last.by}</p>}
                    {milestones.produced && (
                      <p>Produced on: {formatMilestoneDate(milestones.produced.at)}{milestones.produced.by ? <><br />Produced by: {milestones.produced.by}</> : null}</p>
                    )}
                    {milestones.sent && (
                      <p>Sent on: {formatMilestoneDate(milestones.sent.at)}{milestones.sent.by ? <><br />Sent by: {milestones.sent.by}</> : null}</p>
                    )}
                    {last?.note && !attention && <p className="truncate text-text-muted" title={last.note}>{last.note}</p>}
                  </div>

                  {/* Right — what can be done */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {p.drawing.hasDrawing && showsDrawingButtons(p.currentStatus) && (
                      <>
                        <button type="button" onClick={() => setViewing({ id: p.id, pieceCode: p.pieceCode })} className={`${btnCls} gap-1.5`}>
                          <Eye className="size-3.5" aria-hidden="true" />
                          View Drawing
                        </button>
                        <ProductionDrawingDownload pieceId={p.id} className={btnCls} />
                      </>
                    )}
                    {actions.map((a, i) => (
                      <button key={a.key} type="button" onClick={() => openAction(a, [p.id])} className={actionBtnClass(a, i === 0)}>
                        {a.label}
                      </button>
                    ))}
                    <button type="button" onClick={() => void toggleHistory(p.id)} aria-expanded={historyFor === p.id} className={btnCls}>
                      History
                    </button>
                  </div>
                </div>

                {missingDrawing && (
                  <p role="alert" className="mt-2 rounded-md bg-error-light px-3 py-1.5 text-xs text-error">{MISSING_DRAWING_MESSAGE}</p>
                )}

                {attention && (
                  <p className={`mt-2 rounded-md px-3 py-1.5 text-xs ${p.currentStatus === 'REJECTED' ? 'bg-error-light text-error' : 'bg-warning-light text-warning'}`}>
                    <span className="font-semibold">{p.currentStatus === 'REJECTED' ? 'Rejected' : 'On Hold'}:</span>{' '}
                    {last?.note ? last.note : 'No reason recorded.'}
                  </p>
                )}

                {historyFor === p.id && (
                  <div className="mt-2 rounded-md bg-surface-secondary/60 px-3 py-2">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">Element History</p>
                    {history.loading && <p className="text-xs text-text-muted">Loading…</p>}
                    {history.error && <p className="text-xs text-error">{history.error}</p>}
                    {!history.loading && !history.error && history.entries.length === 0 && <p className="text-xs text-text-muted">No history yet.</p>}
                    <ul className="space-y-1.5">
                      {history.entries.map((h) => {
                        const event = historyEventText(h.oldStatus, h.newStatus, h.note);
                        const showNote = h.note && h.note !== event;
                        return (
                          <li key={h.id} className="text-xs text-text-secondary">
                            <span className="font-medium text-text-primary">{historyLine(event, h.updatedByUser?.displayName, h.createdAt)}</span>
                            {showNote ? <span className="block text-text-muted">{h.note}</span> : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !updating && setPending(null)}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="prod-action-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl focus:outline-none"
          >
            <h2 id="prod-action-title" className="text-lg font-semibold text-text-primary">{pending.action.modalTitle}</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {pending.action.key === 'START' ? startConfirmation(pending.ids.length).message : actionMessage(pending.action, pending.ids.length)}
            </p>

            {pending.action.key === 'SEND' && (
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-md border border-border bg-surface-secondary/50 p-3 text-xs text-text-secondary">
                {pending.ids
                  .map((id) => pieces.find((p) => p.id === id))
                  .filter((p): p is ProductionPiece => Boolean(p))
                  .map((p) => {
                    const m = milestoneInfo(p);
                    return (
                      <li key={p.id}>
                        <p className="text-sm font-semibold text-text-primary">{p.pieceCode}</p>
                        <p>{contractLabel(p.contract)}</p>
                        <p>BOQ item: {p.boqItem.description}</p>
                        {m.produced && (
                          <p>
                            Produced on: {formatMilestoneDate(m.produced.at)}
                            {m.produced.by ? ` · Produced by: ${m.produced.by}` : ''}
                          </p>
                        )}
                      </li>
                    );
                  })}
              </ul>
            )}

            <div className="mt-4 space-y-3">
              {pending.action.key === 'START' && (
                <label className="flex items-start gap-2 rounded-md border border-border bg-surface-secondary/50 px-3 py-2 text-sm text-text-primary">
                  <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 size-4 shrink-0 rounded border-border accent-[var(--color-accent)]" />
                  {startConfirmation(pending.ids.length).checkbox}
                </label>
              )}
              {pending.action.field === 'produced' && (
                <div>
                  <label htmlFor="prod-date" className="mb-1 block text-xs font-medium text-text-secondary">Produced Date</label>
                  <input id="prod-date" type="date" value={producedDate} max={todayInputValue()} onChange={(e) => setProducedDate(e.target.value)} className={inputCls} />
                </div>
              )}
              <div>
                <label htmlFor="prod-text" className="mb-1 block text-xs font-medium text-text-secondary">
                  {actionFieldLabel(pending.action)} <span className="text-text-muted">(optional)</span>
                </label>
                <textarea
                  id="prod-text"
                  rows={3}
                  maxLength={900}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {formError && <p role="alert" className="mt-3 text-sm text-error">{formError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPending(null)} disabled={updating} className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-primary hover:bg-surface-secondary disabled:opacity-60">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmAction()}
                disabled={updating || (pending.action.key === 'START' && !checked)}
                className={`inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold disabled:opacity-60 ${
                  pending.action.danger ? 'bg-error text-white hover:opacity-90' : 'bg-accent text-accent-foreground hover:bg-accent-hover'
                }`}
              >
                {updating ? 'Saving…' : pending.action.label}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewing && <ProductionDrawingViewer pieceId={viewing.id} pieceCode={viewing.pieceCode} onClose={() => setViewing(null)} />}
    </div>
  );
}
