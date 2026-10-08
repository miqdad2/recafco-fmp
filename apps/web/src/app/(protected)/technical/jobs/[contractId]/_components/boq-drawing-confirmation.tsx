'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { pieceGroupLabel, pieceGroupFileCount } from '../../../_lib/drawing-group-helpers';
import type { BoqConfirmationItem, BoqDrawingConfirmation as Confirmation, BoqPiece, BoqPieceStatus, BoqPieceUpdateStatus, BoqPieceHistoryEntry } from '@/lib/technical-api';
import { saveBoqConfirmationAction, cancelBoqConfirmationAction, generateBoqPiecesAction, listBoqPiecesAction, updateBoqPieceStatusAction, getBoqPieceHistoryAction } from '../../../actions';
import {
  BOQ_CONFIRMATION_STATUS_LABELS,
  BOQ_CONFIRMATION_STATUS_CLASSES,
  formatBoqItemOption,
  formatConfirmedPieces,
  formatContractQtyUnit,
  validateConfirmationForm,
  BOQ_PIECE_STATUS_LABELS,
  BOQ_PIECE_STATUS_CLASSES,
  BOQ_PIECE_FILTERS,
  pieceUpdateOptionsFor,
  validatePieceUpdate,
  pieceStatusSummary,
  shouldShowGeneratePieces,
} from '../../../_lib/boq-confirmation-helpers';
import type { ConfirmationFormErrors } from '../../../_lib/boq-confirmation-helpers';

interface Props {
  contractId: string;
  items: BoqConfirmationItem[];
  canWrite: boolean;
  /** Piece statuses this user may set (from the API); null = unknown, so pieces stay read-only. */
  allowedPieceStatuses: BoqPieceUpdateStatus[] | null;
}

type FormState =
  | { kind: 'closed' }
  | { kind: 'add'; boqItemId: string }
  | { kind: 'edit'; row: Confirmation }
  | { kind: 'revise'; row: Confirmation };

interface PiecesView {
  item: BoqConfirmationItem;
}

const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const labelCls = 'mb-1 block text-sm font-medium text-text-primary';
const smallBtnCls =
  'inline-flex items-center h-8 px-3 rounded-md border border-border bg-surface text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60';

function StatusBadge({ status }: { status: Confirmation['confirmationStatus'] }): React.JSX.Element {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${BOQ_CONFIRMATION_STATUS_CLASSES[status]}`}>
      {BOQ_CONFIRMATION_STATUS_LABELS[status]}
    </span>
  );
}

function FieldError({ message }: { message: string | undefined }): React.JSX.Element | null {
  return message ? <p className="mt-1 text-xs text-error">{message}</p> : null;
}

/**
 * FMP-BOQ-03 — "BOQ Drawing Confirmation" on the Technical job page. Technical
 * records, per BOQ item, which drawing confirms how many physical pieces (Nos).
 * An item can have several drawings; the item total is the sum of its Confirmed
 * rows. Nothing is generated from these numbers yet.
 */
export function BoqDrawingConfirmation({ contractId, items, canWrite, allowedPieceStatuses }: Props): React.JSX.Element {
  const [form, setForm] = useState<FormState>({ kind: 'closed' });
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [piecesView, setPiecesView] = useState<PiecesView | null>(null);
  // Only the statuses this user may set; empty hides the update controls in View Pieces.
  const updateOptions = canWrite ? pieceUpdateOptionsFor(allowedPieceStatuses) : [];
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const router = useRouter();

  function toggle(id: string): void {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function generatePieces(): Promise<void> {
    if (generating) return;
    setGenerating(true);
    setMessage(null);
    const result = await generateBoqPiecesAction(contractId);
    setGenerating(false);
    if (result.error) {
      setMessage({ tone: 'error', text: result.error });
      return;
    }
    setMessage({ tone: 'ok', text: result.message ?? 'Pieces generated successfully.' });
    router.refresh();
  }

  async function cancelRow(row: Confirmation): Promise<void> {
    if (busyId) return;
    setBusyId(row.id);
    setMessage(null);
    const result = await cancelBoqConfirmationAction(contractId, row.id);
    setBusyId(null);
    if (result.error) {
      setMessage({ tone: 'error', text: result.error });
      return;
    }
    setMessage({ tone: 'ok', text: `Drawing ${row.drawingNo} cancelled.` });
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-labelledby="boq-confirm-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="boq-confirm-title" className="text-base font-semibold text-text-primary">BOQ Drawing Confirmation</h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            Confirm how many physical pieces each drawing covers. Contract Qty is for contract value only.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {canWrite && shouldShowGeneratePieces(items) && (
          <button
            type="button"
            onClick={() => void generatePieces()}
            disabled={generating}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-accent/40 bg-accent/5 px-4 text-sm font-medium text-accent hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {generating ? 'Generating…' : 'Generate Pieces'}
          </button>
        )}
        {canWrite && items.length > 0 && (
          <button
            type="button"
            onClick={() => setForm({ kind: 'add', boqItemId: '' })}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-accent text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add Drawing Confirmation
          </button>
        )}
        </div>
      </div>

      {message && (
        <div
          role="status"
          className={`mt-3 rounded-md border px-4 py-2.5 text-sm ${
            message.tone === 'ok' ? 'border-success bg-success-light text-success' : 'border-error bg-error-light text-error'
          }`}
        >
          {message.text}
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">This contract has no BOQ items yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => {
            const isOpen = openItems.has(item.boqItemId);
            const visibleRows = item.confirmations;
            return (
              <li key={item.boqItemId} className="rounded-lg border border-border bg-surface-secondary/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{item.sortOrder}. {item.description}</p>
                    <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-secondary">
                      <div className="flex gap-1">
                        <dt>Contract Qty:</dt>
                        <dd className="font-medium text-text-primary">{formatContractQtyUnit(item.contractQty, item.contractUnit)}</dd>
                      </div>
                      <div className="flex gap-1">
                        <dt>Confirmed Pieces:</dt>
                        <dd className={`font-medium ${item.confirmedPieces === null ? 'text-text-muted' : 'text-success'}`}>
                          {formatConfirmedPieces(item.confirmedPieces)}
                        </dd>
                      </div>
                      <div className="flex gap-1">
                        <dt>Pieces Generated:</dt>
                        <dd className="font-medium text-text-primary">{item.piecesGenerated}</dd>
                      </div>
                    </dl>
                    {item.piecesGenerated > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {pieceStatusSummary(item.statusCounts).map((s) => (
                          <span key={s.status} className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BOQ_PIECE_STATUS_CLASSES[s.status]}`}>
                            {s.label} {s.count}
                          </span>
                        ))}
                        {item.needsAttention && (
                          <span className="inline-flex rounded-full bg-warning-light px-2 py-0.5 text-xs font-semibold text-warning">
                            Needs Attention
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canWrite && (
                      <button type="button" onClick={() => setForm({ kind: 'add', boqItemId: item.boqItemId })} className={smallBtnCls}>
                        Add Drawing Confirmation
                      </button>
                    )}
                    {item.piecesGenerated > 0 && (
                      <button type="button" onClick={() => setPiecesView({ item })} className={smallBtnCls}>View Pieces</button>
                    )}
                    <button type="button" onClick={() => toggle(item.boqItemId)} aria-expanded={isOpen} className={smallBtnCls}>
                      {isOpen ? 'Hide Confirmations' : `View Confirmations (${visibleRows.length})`}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-3 border-t border-border pt-3">
                    {visibleRows.length === 0 ? (
                      <p className="text-sm text-text-muted">No drawing confirmations yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {visibleRows.map((row) => (
                          <li key={row.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md bg-surface px-3 py-2">
                            <div className="min-w-0 flex-1 basis-56">
                              <p className="text-sm font-medium text-text-primary">
                                {row.drawingNo}
                                {row.revision ? <span className="ml-2 text-xs font-normal text-text-secondary">{row.revision}</span> : null}
                              </p>
                              <p className="text-xs text-text-secondary">
                                {row.confirmedPieces === null ? 'Pieces not entered' : `${row.confirmedPieces} Nos`}
                                {row.drawingTitle ? ` · ${row.drawingTitle}` : ''}
                                {row.sizeOrSpecification ? ` · ${row.sizeOrSpecification}` : ''}
                              </p>
                              {row.remarks && <p className="mt-0.5 text-xs text-text-muted">{row.remarks}</p>}
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              <StatusBadge status={row.confirmationStatus} />
                              {canWrite && row.confirmationStatus === 'DRAFT' && (
                                <button type="button" onClick={() => setForm({ kind: 'edit', row })} className={smallBtnCls}>Edit</button>
                              )}
                              {canWrite && row.confirmationStatus === 'CONFIRMED' && (
                                <button type="button" onClick={() => setForm({ kind: 'revise', row })} className={smallBtnCls}>Revise</button>
                              )}
                              {canWrite && (row.confirmationStatus === 'DRAFT' || row.confirmationStatus === 'CONFIRMED') && (
                                <button type="button" onClick={() => void cancelRow(row)} disabled={busyId === row.id} className={smallBtnCls}>
                                  Cancel
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {piecesView && (
        <PiecesModal
          contractId={contractId}
          item={piecesView.item}
          updateOptions={updateOptions}
          onClose={() => setPiecesView(null)}
          onChanged={() => router.refresh()}
        />
      )}

      {form.kind !== 'closed' && (
        <ConfirmationFormModal
          contractId={contractId}
          items={items}
          form={form}
          onClose={() => setForm({ kind: 'closed' })}
          onSaved={(text) => {
            setForm({ kind: 'closed' });
            setMessage({ tone: 'ok', text });
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

interface ModalProps {
  contractId: string;
  items: BoqConfirmationItem[];
  form: Exclude<FormState, { kind: 'closed' }>;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function ConfirmationFormModal({ contractId, items, form, onClose, onSaved }: ModalProps): React.JSX.Element {
  const row = form.kind === 'add' ? null : form.row;
  const [boqItemId, setBoqItemId] = useState(form.kind === 'add' ? form.boqItemId : (row?.boqItemId ?? ''));
  const [drawingNo, setDrawingNo] = useState(row?.drawingNo ?? '');
  const [drawingTitle, setDrawingTitle] = useState(row?.drawingTitle ?? '');
  const [confirmedPieces, setConfirmedPieces] = useState(row?.confirmedPieces != null ? String(row.confirmedPieces) : '');
  const [sizeOrSpecification, setSizeOrSpecification] = useState(row?.sizeOrSpecification ?? '');
  const [revision, setRevision] = useState(row?.revision ?? '');
  const [remarks, setRemarks] = useState(row?.remarks ?? '');
  const [errors, setErrors] = useState<ConfirmationFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'DRAFT' | 'CONFIRM' | null>(null);

  const isRevise = form.kind === 'revise';
  const title = form.kind === 'add' ? 'Add Drawing Confirmation' : isRevise ? 'Revise Drawing Confirmation' : 'Edit Drawing Confirmation';

  async function submit(action: 'DRAFT' | 'CONFIRM'): Promise<void> {
    if (saving) return;
    const found = validateConfirmationForm({ boqItemId, drawingNo, confirmedPieces }, action === 'CONFIRM');
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(action);
    const result = await saveBoqConfirmationAction(contractId, {
      mode: form.kind === 'add' ? 'create' : isRevise ? 'revise' : 'update',
      ...(row ? { id: row.id } : {}),
      action,
      boqItemId,
      drawingNo,
      drawingTitle,
      confirmedPieces,
      sizeOrSpecification,
      revision,
      remarks,
    });
    setSaving(null);
    if (result.error) {
      setServerError(result.error);
      return;
    }
    onSaved(action === 'CONFIRM' ? `Drawing ${drawingNo.trim()} confirmed.` : `Drawing ${drawingNo.trim()} saved as draft.`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="boq-confirm-form-title"
    >
      <div className="my-4 flex max-h-[92vh] w-[min(96vw,560px)] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h2 id="boq-confirm-form-title" className="text-lg font-semibold text-text-primary">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-text-muted hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {serverError && <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">{serverError}</div>}
          {isRevise && (
            <p className="rounded-md bg-info-light/60 px-3 py-2 text-xs text-text-secondary">
              The current confirmation is kept as Revised and replaced by this one.
            </p>
          )}

          <div>
            <label htmlFor="bc-item" className={labelCls}>BOQ Item <span className="text-error">*</span></label>
            <select id="bc-item" value={boqItemId} onChange={(e) => setBoqItemId(e.target.value)} disabled={form.kind !== 'add'} className={inputCls}>
              <option value="">Select BOQ item</option>
              {items.map((i) => (
                <option key={i.boqItemId} value={i.boqItemId}>{formatBoqItemOption(i)}</option>
              ))}
            </select>
            <FieldError message={errors.boqItemId} />
          </div>

          <div>
            <label htmlFor="bc-drawing-no" className={labelCls}>Drawing No <span className="text-error">*</span></label>
            <input id="bc-drawing-no" type="text" maxLength={100} value={drawingNo} onChange={(e) => setDrawingNo(e.target.value)} placeholder="Enter drawing number" className={inputCls} />
            <FieldError message={errors.drawingNo} />
          </div>

          <div>
            <label htmlFor="bc-title" className={labelCls}>Drawing Title</label>
            <input id="bc-title" type="text" maxLength={200} value={drawingTitle} onChange={(e) => setDrawingTitle(e.target.value)} placeholder="Enter drawing title" className={inputCls} />
          </div>

          <div>
            <label htmlFor="bc-pieces" className={labelCls}>Confirmed Pieces <span className="text-error">*</span></label>
            <input
              id="bc-pieces"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={confirmedPieces}
              onChange={(e) => setConfirmedPieces(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-text-muted">Number of physical pieces confirmed from this drawing.</p>
            <FieldError message={errors.confirmedPieces} />
          </div>

          <div>
            <label htmlFor="bc-size" className={labelCls}>Size / Specification</label>
            <input id="bc-size" type="text" maxLength={300} value={sizeOrSpecification} onChange={(e) => setSizeOrSpecification(e.target.value)} placeholder="Example: 6m slab, panel type A, beam 300x600" className={inputCls} />
          </div>

          <div>
            <label htmlFor="bc-revision" className={labelCls}>Revision</label>
            <input id="bc-revision" type="text" maxLength={50} value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="Example: Rev 0, Rev A" className={inputCls} />
          </div>

          <div>
            <label htmlFor="bc-remarks" className={labelCls}>Remarks</label>
            <textarea id="bc-remarks" rows={2} maxLength={2000} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={`${inputCls} resize-y`} />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border bg-surface px-5 py-3">
          <button type="button" onClick={onClose} disabled={saving !== null} className={`${smallBtnCls} h-10 px-4 text-sm`}>Cancel</button>
          {!isRevise && (
            <button type="button" onClick={() => void submit('DRAFT')} disabled={saving !== null} className={`${smallBtnCls} h-10 px-4 text-sm`}>
              {saving === 'DRAFT' ? 'Saving…' : 'Save Draft'}
            </button>
          )}
          <button
            type="button"
            onClick={() => void submit('CONFIRM')}
            disabled={saving !== null}
            className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {saving === 'CONFIRM' ? 'Confirming…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Pieces of one BOQ item: status filter, tick boxes, "Update selected to" + Note
 * + Update Status (only for users who can write), and a Piece History view per
 * piece. Status changes are the common foundation only — they do not create any
 * Production, Delivery or Erection records.
 */
function PiecesModal({
  contractId,
  item,
  updateOptions,
  onClose,
  onChanged,
}: {
  contractId: string;
  item: BoqConfirmationItem;
  updateOptions: { value: BoqPieceStatus; label: string }[];
  onClose: () => void;
  onChanged: () => void;
}): React.JSX.Element {
  const [filter, setFilter] = useState<BoqPieceStatus | 'ALL'>('ALL');
  const [pieces, setPieces] = useState<BoqPiece[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetStatus, setTargetStatus] = useState('');
  const [note, setNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<{ loading: boolean; error: string | null; entries: BoqPieceHistoryEntry[] }>({
    loading: false,
    error: null,
    entries: [],
  });

  // Loaded on open, when the filter changes, and after every update.
  useEffect(() => {
    let cancelled = false;
    setError(null);
    void listBoqPiecesAction(contractId, item.boqItemId, filter === 'ALL' ? undefined : filter).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else setPieces(result.pieces);
    });
    return () => {
      cancelled = true;
    };
  }, [contractId, item.boqItemId, filter, reload]);

  const canWrite = updateOptions.length > 0;
  const visible = pieces ?? [];
  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));

  function changeFilter(next: BoqPieceStatus | 'ALL'): void {
    setFilter(next);
    setPieces(null);
    setSelected(new Set());
  }

  function toggleOne(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible(): void {
    setSelected(allVisibleSelected ? new Set() : new Set(visible.map((p) => p.id)));
  }

  async function applyUpdate(): Promise<void> {
    if (updating) return;
    const problem = validatePieceUpdate(selected.size, targetStatus);
    if (problem) {
      setUpdateMessage({ tone: 'error', text: problem });
      return;
    }
    setUpdating(true);
    setUpdateMessage(null);
    const result = await updateBoqPieceStatusAction(contractId, [...selected], targetStatus as BoqPieceUpdateStatus, note);
    setUpdating(false);
    if (result.error) {
      setUpdateMessage({ tone: 'error', text: result.error });
      return;
    }
    // Skipped pieces are not an error, but say so plainly.
    setUpdateMessage({ tone: result.updatedCount > 0 ? 'ok' : 'error', text: result.message ?? 'Pieces updated.' });
    setSelected(new Set());
    setNote('');
    setHistoryFor(null);
    setReload((n) => n + 1);
    onChanged();
  }

  async function toggleHistory(pieceId: string): Promise<void> {
    if (historyFor === pieceId) {
      setHistoryFor(null);
      return;
    }
    setHistoryFor(pieceId);
    setHistory({ loading: true, error: null, entries: [] });
    const result = await getBoqPieceHistoryAction(contractId, pieceId);
    setHistory({ loading: false, error: result.error, entries: result.entries });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="boq-pieces-title"
    >
      <div className="my-4 flex max-h-[92vh] w-[min(96vw,900px)] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="boq-pieces-title" className="text-lg font-semibold text-text-primary">Pieces</h2>
            <p className="truncate text-sm text-text-secondary">{item.description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-text-muted hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-border px-5 py-3">
          {BOQ_PIECE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => changeFilter(f.value)}
              aria-pressed={filter === f.value}
              className={`rounded-full border px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-focus ${
                filter === f.value ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface text-text-secondary hover:bg-surface-secondary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {canWrite && (
          <div className="shrink-0 border-b border-border bg-surface-secondary/40 px-5 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-44">
                <label htmlFor="piece-target-status" className="mb-1 block text-xs font-medium text-text-secondary">Update selected to</label>
                <select
                  id="piece-target-status"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">Select status</option>
                  {updateOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-48 flex-1">
                <label htmlFor="piece-note" className="mb-1 block text-xs font-medium text-text-secondary">Note</label>
                <input
                  id="piece-note"
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

        {updateMessage && (
          <div
            role="status"
            className={`mx-5 mt-3 shrink-0 rounded-md border px-4 py-2.5 text-sm ${
              updateMessage.tone === 'ok' ? 'border-success bg-success-light text-success' : 'border-error bg-error-light text-error'
            }`}
          >
            {updateMessage.text}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {error && <p className="text-sm text-error">{error}</p>}
          {!error && pieces === null && <p className="py-6 text-center text-sm text-text-muted">Loading…</p>}
          {pieces && pieces.length === 0 && <p className="py-6 text-center text-sm text-text-muted">No pieces found.</p>}
          {pieces && pieces.length > 0 && (
            <>
              {canWrite && (
                <label className="mb-1 flex items-center gap-2 border-b border-border pb-2 text-xs font-medium text-text-secondary">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="size-4 rounded border-border accent-[var(--color-accent)]" />
                  Select all shown ({visible.length})
                </label>
              )}
              <ul className="divide-y divide-border">
                {pieces.map((p) => (
                  <li key={p.id} className="py-2.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {canWrite && (
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleOne(p.id)}
                          aria-label={`Select ${p.pieceCode}`}
                          className="size-4 shrink-0 rounded border-border accent-[var(--color-accent)]"
                        />
                      )}
                      <div className="min-w-0 flex-1 basis-44">
                        <p className="text-sm font-medium text-text-primary">{p.pieceCode}</p>
                        <p className="text-xs text-text-secondary">
                          Drawing {p.drawingNo}
                          {p.sizeOrSpecification ? ` · ${p.sizeOrSpecification}` : ''}
                        </p>
                        <p className="text-xs text-text-secondary">
                          Group: {pieceGroupLabel(p)}
                          {p.drawingGroupLinks?.[0] ? ` · Files: ${pieceGroupFileCount(p)}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                        <span>Location: {p.currentLocation || '—'}</span>
                        <span>Updated {formatUpdated(p.updatedAt)}</span>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 font-medium ${BOQ_PIECE_STATUS_CLASSES[p.currentStatus]}`}>
                          {BOQ_PIECE_STATUS_LABELS[p.currentStatus]}
                        </span>
                        <button type="button" onClick={() => void toggleHistory(p.id)} aria-expanded={historyFor === p.id} className={smallBtnCls}>
                          History
                        </button>
                      </div>
                    </div>

                    {historyFor === p.id && (
                      <div className="mt-2 rounded-md bg-surface-secondary/60 px-3 py-2">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">Piece History</p>
                        {history.loading && <p className="text-xs text-text-muted">Loading…</p>}
                        {history.error && <p className="text-xs text-error">{history.error}</p>}
                        {!history.loading && !history.error && history.entries.length === 0 && (
                          <p className="text-xs text-text-muted">No history yet.</p>
                        )}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
