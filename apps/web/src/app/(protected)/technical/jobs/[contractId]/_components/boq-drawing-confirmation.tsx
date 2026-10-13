'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, FileCheck, List, Pencil, Plus, Sparkles, X } from 'lucide-react';
import { pieceGroupFileCount } from '../../../_lib/drawing-group-helpers';
import { technicalStepHref } from '../../../_lib/technical-step-ui';
import { BTN_DANGER, BTN_PRIMARY, BTN_PRIMARY_SM, BTN_SECONDARY, BADGE } from '../../../_lib/button-styles';
import { ElementDrawingModal } from './element-drawing-modal';
import { ELEMENTS_GENERATED_MESSAGE, elementCoverageLabel, elementGroupText, elementStatusClasses, elementStatusLabel, finalDrawingMethod, itemStatusChips } from '../../../_lib/element-status-helpers';
import type { BoqConfirmationItem, BoqDrawingConfirmation as Confirmation, DrawingGroupItem, BoqPiece, BoqPieceStatus, BoqPieceUpdateStatus, BoqPieceHistoryEntry } from '@/lib/technical-api';
import { saveBoqConfirmationAction, cancelBoqConfirmationAction, generateBoqPiecesAction, listBoqPiecesAction, updateBoqPieceStatusAction, getBoqPieceHistoryAction } from '../../../actions';
import {
  BOQ_CONFIRMATION_STATUS_LABELS,
  BOQ_CONFIRMATION_STATUS_CLASSES,
  formatBoqItemOption,
  formatConfirmedPieces,
  formatContractQtyUnit,
  validateConfirmationForm,
  BOQ_PIECE_STATUS_LABELS,
  BOQ_PIECE_FILTERS,
  pieceUpdateOptionsFor,
  validatePieceUpdate,
  shouldShowGeneratePieces,
} from '../../../_lib/boq-confirmation-helpers';
import type { ConfirmationFormErrors } from '../../../_lib/boq-confirmation-helpers';

interface Props {
  contractId: string;
  items: BoqConfirmationItem[];
  canWrite: boolean;
  /** Element statuses this user may set (from the API); null = unknown, so pieces stay read-only. */
  allowedPieceStatuses: BoqPieceUpdateStatus[] | null;
  /** FMP-TECH-25 — to tell which generated elements are already released and which BOQ items use Drawing Groups. */
  groupItems?: DrawingGroupItem[] | null;
}

type FormState =
  | { kind: 'closed' }
  | { kind: 'add'; boqItemId: string }
  | { kind: 'edit'; row: Confirmation }
  | { kind: 'editConfirmed'; row: Confirmation; countLocked: boolean }
  | { kind: 'revise'; row: Confirmation };

interface PiecesView {
  item: BoqConfirmationItem;
}

const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const labelCls = 'mb-1 block text-sm font-medium text-text-primary';
const smallBtnCls = BTN_SECONDARY;

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
 * records, per BOQ item, which drawing confirms how many physical elements (Nos).
 * An item can have several drawings; the item total is the sum of its Confirmed
 * rows. Nothing is generated from these numbers yet.
 */
export function BoqDrawingConfirmation({ contractId, items, canWrite, allowedPieceStatuses, groupItems = null }: Props): React.JSX.Element {
  const [form, setForm] = useState<FormState>({ kind: 'closed' });
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [piecesView, setPiecesView] = useState<PiecesView | null>(null);
  // Only the statuses this user may set; empty hides the update controls in View Elements.
  const updateOptions = canWrite ? pieceUpdateOptionsFor(allowedPieceStatuses) : [];
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const router = useRouter();
  const releasedFor = (boqItemId: string): number => groupItems?.find((g) => g.boqItemId === boqItemId)?.releasedToProduction ?? 0;
  const usesGroups = (boqItemId: string): boolean => {
    const g = groupItems?.find((x) => x.boqItemId === boqItemId);
    return g ? finalDrawingMethod(g) === 'groups' : false;
  };
  // FMP-TECH-26 — a BOQ item has at most one active confirmation; once it exists the page offers View / Edit, not Confirm again.
  const activeConfirmation = (item: BoqConfirmationItem): Confirmation | undefined => item.confirmations.find((c) => c.confirmationStatus === 'CONFIRMED');
  const allConfirmed = items.length > 0 && items.every((i) => activeConfirmation(i) !== undefined);
  /** Elements already in a drawing group or past their starting status: the number of elements (and cancelling) is then locked. */
  const usedInLaterSteps = (item: BoqConfirmationItem): boolean => {
    const moved = Object.entries(item.statusCounts).some(([status, n]) => status !== 'DRAWING_READY' && status !== 'CANCELLED' && (n ?? 0) > 0);
    const grouped = (groupItems?.find((g) => g.boqItemId === item.boqItemId)?.assignedToGroups ?? 0) > 0;
    return moved || grouped;
  };
  const totalGenerated = items.reduce((t, i) => t + i.piecesGenerated, 0);
  const totalWaiting = items.reduce((t, i) => t + Math.max(0, (i.statusCounts.DRAWING_READY ?? 0) - releasedFor(i.boqItemId)), 0);

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
    setMessage({ tone: 'ok', text: ELEMENTS_GENERATED_MESSAGE });
    router.refresh();
  }

  async function cancelRow(row: Confirmation): Promise<void> {
    if (busyId) return;
    if (row.confirmationStatus === 'CONFIRMED' && !window.confirm('Cancel this confirmation? Its generated elements are cancelled too (kept for history, never deleted).')) return;
    setBusyId(row.id);
    setMessage(null);
    const result = await cancelBoqConfirmationAction(contractId, row.id);
    setBusyId(null);
    if (result.error) {
      setMessage({ tone: 'error', text: result.error });
      return;
    }
    setMessage({ tone: 'ok', text: `Confirmation for ${row.drawingNo} cancelled.` });
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-labelledby="boq-confirm-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="boq-confirm-title" className="text-base font-semibold text-text-primary">Confirm Elements</h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            Enter how many physical elements are required for each BOQ item. Contract Qty is for contract value only.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {canWrite && shouldShowGeneratePieces(items) && (
          <button
            type="button"
            onClick={() => void generatePieces()}
            disabled={generating}
            className={`${BTN_SECONDARY} !h-9 !text-sm`}
          >
            <Sparkles className="size-4" aria-hidden="true" />
            {generating ? 'Generating…' : 'Generate Elements'}
          </button>
        )}
        {canWrite && items.length > 0 && (allConfirmed ? (
          <span role="status" className={`${BADGE} gap-1.5 bg-success-light !px-3 !py-1.5 !text-xs text-success`}>
            <CheckCircle2 className="size-4" aria-hidden="true" />
            All Elements Confirmed
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setForm({ kind: 'add', boqItemId: '' })}
            className={BTN_PRIMARY}
          >
            <Plus className="size-4" aria-hidden="true" />
            Confirm Elements
          </button>
        ))}
        </div>
      </div>

      {totalGenerated > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-text-secondary">
          <span>Elements Generated: <span className="font-semibold text-text-primary">{totalGenerated}</span></span>
          <span>Waiting Final Drawing: <span className="font-semibold text-text-primary">{totalWaiting}</span></span>
        </p>
      )}

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
            const active = activeConfirmation(item);
            const countLocked = usedInLaterSteps(item);
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
                        <dt>Confirmed Elements:</dt>
                        <dd className={`font-medium ${item.confirmedPieces === null ? 'text-text-muted' : 'text-success'}`}>
                          {formatConfirmedPieces(item.confirmedPieces)}
                        </dd>
                      </div>
                      <div className="flex gap-1">
                        <dt>Elements Generated:</dt>
                        <dd className="font-medium text-text-primary">{item.piecesGenerated}</dd>
                      </div>
                    </dl>
                    {active && (
                      <div className="mt-2 rounded-md border border-success/40 bg-success-light/40 px-3 py-2" aria-label="Confirmed elements">
                        <p className="text-xs font-semibold uppercase tracking-wide text-success">Confirmed Elements</p>
                        <dl className="mt-1 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-text-secondary sm:grid-cols-2 lg:grid-cols-3">
                          <div className="flex gap-1"><dt>Drawing Reference No:</dt><dd className="font-medium text-text-primary">{active.drawingNo || '—'}</dd></div>
                          <div className="flex gap-1"><dt>Number of Elements:</dt><dd className="font-medium text-text-primary">{active.confirmedPieces ?? '—'}</dd></div>
                          <div className="flex gap-1"><dt>Elements Generated:</dt><dd className="font-medium text-text-primary">{item.piecesGenerated}</dd></div>
                          <div className="flex gap-1"><dt>Status:</dt><dd className="font-medium text-text-primary">{itemStatusChips(item.statusCounts, releasedFor(item.boqItemId)).map((c) => `${c.label} ${c.count}`).join(' · ') || '—'}</dd></div>
                          <div className="flex gap-1"><dt>Confirmed date:</dt><dd className="font-medium text-text-primary">{active.confirmedAt ? formatUpdated(active.confirmedAt) : '—'}</dd></div>
                          <div className="flex gap-1"><dt>Confirmed by:</dt><dd className="font-medium text-text-primary">{active.confirmedByUser?.displayName ?? '—'}</dd></div>
                        </dl>
                      </div>
                    )}
                    {item.piecesGenerated > 0 && !active && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {itemStatusChips(item.statusCounts, releasedFor(item.boqItemId)).map((c) => (
                          <span key={c.key} className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c.classes}`}>
                            {c.label} {c.count}
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
                    {canWrite && !active && (
                      <button type="button" onClick={() => setForm({ kind: 'add', boqItemId: item.boqItemId })} className={BTN_PRIMARY_SM}>
                        <Plus className="size-3.5" aria-hidden="true" />
                        Confirm Elements
                      </button>
                    )}
                    {item.piecesGenerated > 0 && (
                      <button type="button" onClick={() => setPiecesView({ item })} className={smallBtnCls}>
                        <List className="size-3.5" aria-hidden="true" />
                        View Elements
                      </button>
                    )}
                    {visibleRows.length > 0 && (
                      <button type="button" onClick={() => toggle(item.boqItemId)} aria-expanded={isOpen} className={smallBtnCls}>
                        <FileCheck className="size-3.5" aria-hidden="true" />
                        {isOpen ? 'Hide Confirmation' : 'View Confirmation'}
                      </button>
                    )}
                    {canWrite && active && (
                      <button type="button" onClick={() => setForm({ kind: 'editConfirmed', row: active, countLocked })} className={smallBtnCls}>
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Edit Confirmation
                      </button>
                    )}
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
                                {row.confirmedPieces === null ? 'Elements not entered' : `${row.confirmedPieces} Nos`}
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
                                <button type="button" onClick={() => setForm({ kind: 'editConfirmed', row, countLocked })} className={smallBtnCls}><Pencil className="size-3.5" aria-hidden="true" />Edit Confirmation</button>
                              )}
                              {canWrite && row.confirmationStatus === 'DRAFT' && (
                                <button type="button" onClick={() => void cancelRow(row)} disabled={busyId === row.id} className={smallBtnCls}>
                                  Cancel
                                </button>
                              )}
                              {canWrite && row.confirmationStatus === 'CONFIRMED' && (countLocked ? (
                                <span className="text-xs text-text-muted">Cannot cancel — elements are already used in later steps</span>
                              ) : (
                                <button type="button" onClick={() => void cancelRow(row)} disabled={busyId === row.id} className={BTN_DANGER}>
                                  Cancel Confirmation
                                </button>
                              ))}
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
          itemUsesGroups={usesGroups(piecesView.item.boqItemId)}
          canWriteFiles={canWrite}
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
  const isEditConfirmed = form.kind === 'editConfirmed';
  const countLocked = form.kind === 'editConfirmed' && form.countLocked;
  const originalCount = row?.confirmedPieces != null ? String(row.confirmedPieces) : '';
  const countChanged = isEditConfirmed && confirmedPieces.trim() !== originalCount;
  const title = form.kind === 'add' ? 'Confirm Elements for BOQ Item' : isEditConfirmed ? 'Edit Element Confirmation' : isRevise ? 'Revise Drawing Confirmation' : 'Edit Drawing Confirmation';

  async function submit(action: 'DRAFT' | 'CONFIRM'): Promise<void> {
    if (saving) return;
    const found = validateConfirmationForm({ boqItemId, drawingNo, confirmedPieces }, action === 'CONFIRM');
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(action);
    const result = await saveBoqConfirmationAction(contractId, {
      mode: form.kind === 'add' ? 'create' : isEditConfirmed ? 'edit' : isRevise ? 'revise' : 'update',
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
    if (action === 'DRAFT') {
      onSaved(`Drawing ${drawingNo.trim()} saved as draft.`);
      return;
    }
    // FMP-TECH-24 — generating the individual elements is the existing action, run right after a confirmation;
    // nothing goes to Production until a drawing group with final files is released.
    if (isEditConfirmed) {
      onSaved(countChanged ? `Confirmation updated. Elements now: ${confirmedPieces.trim()}.` : 'Confirmation updated.');
      return;
    }
    if (isRevise) {
      onSaved(`Drawing ${drawingNo.trim()} confirmed.`);
      return;
    }
    setSaving('CONFIRM');
    const generated = await generateBoqPiecesAction(contractId);
    setSaving(null);
    onSaved(
      generated.error
        ? `Drawing ${drawingNo.trim()} confirmed. Elements could not be generated yet — use Generate Elements.`
        : ELEMENTS_GENERATED_MESSAGE,
    );
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
          {!isRevise && !isEditConfirmed && (
            <p className="rounded-md bg-info-light/60 px-3 py-2 text-xs text-text-secondary">
              Enter the number of physical elements required for this BOQ item. Elements will be generated after confirmation.
            </p>
          )}
          {isRevise && (
            <p className="rounded-md bg-info-light/60 px-3 py-2 text-xs text-text-secondary">
              The current confirmation is kept as Revised and replaced by this one.
            </p>
          )}

          <div>
            <label htmlFor="bc-item" className={labelCls}>BOQ Item <span className="text-error">*</span></label>
            <select id="bc-item" value={boqItemId} onChange={(e) => setBoqItemId(e.target.value)} disabled={form.kind !== 'add'} className={inputCls}>
              <option value="">Select BOQ item</option>
              {items
                .filter((i) => form.kind !== 'add' || i.boqItemId === boqItemId || !i.confirmations.some((c) => c.confirmationStatus === 'CONFIRMED'))
                .map((i) => (
                  <option key={i.boqItemId} value={i.boqItemId}>{formatBoqItemOption(i)}</option>
                ))}
            </select>
            <FieldError message={errors.boqItemId} />
          </div>

          <div>
            <label htmlFor="bc-drawing-no" className={labelCls}>Drawing Reference No <span className="text-error">*</span></label>
            <input id="bc-drawing-no" type="text" maxLength={100} value={drawingNo} onChange={(e) => setDrawingNo(e.target.value)} placeholder="Enter drawing reference number" className={inputCls} />
            <FieldError message={errors.drawingNo} />
          </div>

          <div>
            <label htmlFor="bc-title" className={labelCls}>Drawing Title</label>
            <input id="bc-title" type="text" maxLength={200} value={drawingTitle} onChange={(e) => setDrawingTitle(e.target.value)} placeholder="Enter drawing title" className={inputCls} />
          </div>

          <div>
            <label htmlFor="bc-pieces" className={labelCls}>Number of Elements <span className="text-error">*</span></label>
            <input
              id="bc-pieces"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={confirmedPieces}
              onChange={(e) => setConfirmedPieces(e.target.value)}
              disabled={countLocked}
              placeholder="0"
              className={`${inputCls} disabled:bg-surface-secondary disabled:text-text-muted`}
            />
            <p className="mt-1 text-xs text-text-muted">Number of physical elements required for this BOQ item.</p>
            {countLocked && (
              <p className="mt-1 text-xs text-warning">This confirmation cannot be changed because elements are already used in later steps. You can still edit the text fields below.</p>
            )}
            {countChanged && !countLocked && (
              <p className="mt-1 rounded-md bg-warning-light px-3 py-2 text-xs text-warning">
                Changing the number of elements may add or remove generated elements. Continue only if this confirmation has not moved forward.
              </p>
            )}
            <FieldError message={errors.confirmedPieces} />
          </div>

          <div>
            <label htmlFor="bc-size" className={labelCls}>Element Type / Size / Specification</label>
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
          {!isRevise && !isEditConfirmed && (
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
            {saving === 'CONFIRM' ? (isEditConfirmed ? 'Saving…' : 'Confirming…') : isEditConfirmed ? 'Save Changes' : 'Confirm'}
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
 * Elements of one BOQ item: status filter, tick boxes, "Update selected to" + Note
 * + Update Status (only for users who can write), and a Element History view per
 * piece. Status changes are the common foundation only — they do not create any
 * Production, Delivery or Erection records.
 */
function PiecesModal({
  contractId,
  item,
  itemUsesGroups,
  canWriteFiles,
  updateOptions,
  onClose,
  onChanged,
}: {
  contractId: string;
  item: BoqConfirmationItem;
  itemUsesGroups: boolean;
  /** The viewer may add final drawing files (Technical write permission). */
  canWriteFiles: boolean;
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
  const [drawingFor, setDrawingFor] = useState<BoqPiece | null>(null);
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
    setUpdateMessage({ tone: result.updatedCount > 0 ? 'ok' : 'error', text: result.message ?? 'Elements updated.' });
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
            <h2 id="boq-pieces-title" className="text-lg font-semibold text-text-primary">Elements</h2>
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
          {pieces && pieces.length === 0 && <p className="py-6 text-center text-sm text-text-muted">No elements found.</p>}
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
                          Group: {elementGroupText(p, itemUsesGroups)}
                          {p.drawingGroupLinks?.[0] ? ` · Files: ${pieceGroupFileCount(p)}` : ''}
                        </p>
                        <p className="text-xs text-text-secondary">
                          Drawing: {elementCoverageLabel(p)}
                          {(p._count?.attachments ?? 0) > 0 ? ` · Own files: ${p._count?.attachments}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                        <span>Location: {p.currentLocation || '—'}</span>
                        <span>Updated {formatUpdated(p.updatedAt)}</span>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 font-medium ${elementStatusClasses(p)}`}>
                          {elementStatusLabel(p)}
                        </span>
                        {p.currentStatus === 'DRAWING_READY' && !p.releasedToProductionAt && !p.drawingGroupLinks?.[0] && canWriteFiles && (
                          <button type="button" onClick={() => setDrawingFor(p)} className={smallBtnCls}>Add Individual Drawing</button>
                        )}
                        {(p._count?.attachments ?? 0) > 0 && (
                          <button type="button" onClick={() => setDrawingFor(p)} className={smallBtnCls}>View Files</button>
                        )}
                        {p.currentStatus === 'DRAWING_READY' && !p.releasedToProductionAt && !p.drawingGroupLinks?.[0] && canWriteFiles && (
                          <Link href={technicalStepHref(contractId, 'drawing-groups')} className={smallBtnCls}>Assign to Group</Link>
                        )}
                        <button type="button" onClick={() => void toggleHistory(p.id)} aria-expanded={historyFor === p.id} className={smallBtnCls}>
                          History
                        </button>
                      </div>
                    </div>

                    {historyFor === p.id && (
                      <div className="mt-2 rounded-md bg-surface-secondary/60 px-3 py-2">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">Element History</p>
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
      {drawingFor && (
        <ElementDrawingModal
          contractId={contractId}
          elements={[{ id: drawingFor.id, pieceCode: drawingFor.pieceCode }]}
          canWrite={canWriteFiles}
          readOnlyReason={drawingFor.drawingGroupLinks?.[0] ? 'This element is in a Drawing Group. Its final drawings are the group\'s files.' : drawingFor.releasedToProductionAt ? 'Released elements cannot be changed.' : null}
          onClose={() => {
            setDrawingFor(null);
            setReload((n) => n + 1);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
