'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { List, Pencil, Plus, X } from 'lucide-react';
import type { BoqPieceStatus, DrawingGroup, DrawingGroupItem, ElementCoverageData, ElementCoverageRow, GroupablePiece } from '@/lib/technical-api';
import {
  saveDrawingGroupAction,
  drawingGroupTransitionAction,
  listGroupablePiecesAction,
  getDrawingGroupPiecesAction,
} from '../../../actions';
import { DrawingGroupFilesModal } from './drawing-group-files-modal';
import { ElementDrawingModal } from './element-drawing-modal';
import { REPLACE_DRAWING_HINT, drawingFileButtons, drawingRowStatus } from '../../../_lib/drawing-file-ui';
import { technicalStepHref } from '../../../_lib/technical-step-ui';
import { BTN_DANGER, BTN_PRIMARY, BTN_PRIMARY_SM, BTN_SECONDARY } from '../../../_lib/button-styles';
import { DrawingFileActionButton } from '../../../_components/drawing-file-action-button';
import { BOQ_PIECE_STATUS_CLASSES, BOQ_PIECE_STATUS_LABELS } from '../../../_lib/boq-confirmation-helpers';
import {
  DRAWING_GROUP_STATUS_CLASSES,
  DRAWING_GROUP_STATUS_LABELS,
  GROUP_ACTION_LABELS,
  canChangeGroupFiles,
  filterPiecesByCode,
  hasOwnDrawing,
  formatGroupDate,
  isPieceSelectable,
  selectableIdsInRange,
  pieceGroupLabel,
  toggleVisible,
  validateGroupForm,
} from '../../../_lib/drawing-group-helpers';
import type { GroupFormErrors } from '../../../_lib/drawing-group-helpers';
import { groupsWithoutFiles } from '../../../_lib/technical-workflow-helpers';

interface Props {
  contractId: string;
  items: DrawingGroupItem[];
  canWrite: boolean;
  /** FMP-TECH-27 — final drawing coverage of every element (for the Individual / Not Covered sections). */
  coverage?: ElementCoverageData | null;
}

type FormState = { kind: 'closed' } | { kind: 'add'; boqItemId: string } | { kind: 'edit'; group: DrawingGroup };

const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const labelCls = 'mb-1 block text-sm font-medium text-text-primary';
const smallBtnCls = BTN_SECONDARY;

const COUNT_LABELS: { key: keyof DrawingGroupItem; label: string }[] = [
  { key: 'piecesGenerated', label: 'Elements Generated' },
  { key: 'assignedToGroups', label: 'Assigned to Groups' },
  { key: 'notAssigned', label: 'Not Assigned' },
  { key: 'approvedPieces', label: 'Approved Elements' },
  { key: 'releasedToProduction', label: 'Released to Production' },
];

/**
 * FMP-BOQ-11 — "Drawing / Calculation Groups" on the Technical job page. A group
 * ties one drawing (+ calculation) to the generated elements it covers; a BOQ item
 * can have many groups and a piece sits in one active group at a time. Submit /
 * Approve / Release to Production only record the group's status — no elements
 * status changes and Production is not blocked.
 */
export function DrawingGroupsSection({ contractId, items, canWrite, coverage = null }: Props): React.JSX.Element {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({ kind: 'closed' });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<DrawingGroup | null>(null);
  const [filesFor, setFilesFor] = useState<DrawingGroup | null>(null);
  const [elementsFor, setElementsFor] = useState<ElementCoverageRow[] | null>(null);
  const [intro, setIntro] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  function toggle(id: string): void {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function transition(group: DrawingGroup, kind: 'submit' | 'approve' | 'release' | 'cancel'): Promise<void> {
    if (busyId) return;
    setBusyId(group.id);
    setMessage(null);
    const result = await drawingGroupTransitionAction(contractId, group.id, kind);
    setBusyId(null);
    if (result.error) {
      setMessage({ tone: 'error', text: result.error });
      return;
    }
    const done = { submit: 'submitted', approve: 'approved', release: 'released to Production', cancel: 'cancelled' }[kind];
    setMessage({ tone: 'ok', text: `Group ${group.drawingNo} ${done}.` });
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-labelledby="drawing-groups-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="drawing-groups-title" className="text-base font-semibold text-text-primary">Drawing Groups</h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            Group elements that share the same drawing. Drawings can be uploaded here or in Final Drawing Files.
          </p>
        </div>
        {canWrite && items.length > 0 && (
          <button
            type="button"
            onClick={() => setForm({ kind: 'add', boqItemId: '' })}
            className={BTN_PRIMARY}
          >
            <Plus className="size-4" aria-hidden="true" />
            Create Drawing Group
          </button>
        )}
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
            const isOpen = open.has(item.boqItemId);
            return (
              <li key={item.boqItemId} className="rounded-lg border border-border bg-surface-secondary/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{item.sortOrder}. {item.description}</p>
                    <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-secondary">
                      {COUNT_LABELS.map((c) => (
                        <div key={c.key} className="flex gap-1">
                          <dt>{c.label}:</dt>
                          <dd className={`font-medium ${c.key === 'notAssigned' && item.notAssigned > 0 ? 'text-warning' : 'text-text-primary'}`}>
                            {item[c.key] as number}
                          </dd>
                        </div>
                      ))}
                      <div className="flex gap-1">
                        <dt>Groups Without Files:</dt>
                        <dd className={`font-medium ${groupsWithoutFiles(item) > 0 ? 'text-warning' : 'text-text-primary'}`}>{groupsWithoutFiles(item)}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="flex items-center gap-2">
                    {canWrite && item.piecesGenerated > 0 && (
                      <button type="button" onClick={() => setForm({ kind: 'add', boqItemId: item.boqItemId })} className={smallBtnCls}>
                        Create Drawing Group
                      </button>
                    )}
                    <button type="button" onClick={() => toggle(item.boqItemId)} aria-expanded={isOpen} className={smallBtnCls}>
                      {isOpen ? 'Hide Groups' : `View Groups (${item.groups.length})`}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-3 border-t border-border pt-3">
                    {item.piecesGenerated === 0 && <p className="mb-2 text-sm text-text-muted">Generate elements first, then group them by drawing.</p>}
                    {item.groups.length === 0 ? (
                      <p className="text-sm text-text-muted">No drawing groups yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {item.groups.map((g) => (
                          <li key={g.id} className="rounded-md bg-surface px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                              <div className="min-w-0 flex-1 basis-56">
                                <p className="text-sm font-medium text-text-primary">
                                  {g.drawingNo}
                                  {g.calculationRef ? <span className="ml-2 text-xs font-normal text-text-secondary">Calc: {g.calculationRef}</span> : null}
                                </p>
                                <p className="text-xs text-text-secondary">
                                  {g.groupTitle ? `${g.groupTitle} · ` : ''}
                                  {g.pieceCount} {g.pieceCount === 1 ? 'element' : 'elements'}
                                  {formatGroupDate(g.approvedAt) ? ` · Approved ${formatGroupDate(g.approvedAt)}` : ''}
                                  {formatGroupDate(g.releasedAt) ? ` · Released ${formatGroupDate(g.releasedAt)}` : ''}
                                </p>
                                <p className={`text-xs ${g.fileCount === 0 && g.status !== 'CANCELLED' ? 'text-warning' : 'text-text-secondary'}`}>
                                  {g.fileCount === 0 ? 'No drawing uploaded yet' : `Drawing files: ${g.fileCount}`} · {DRAWING_GROUP_STATUS_LABELS[g.status]}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-2">
                                {g.status === 'CANCELLED' || g.status === 'REVISED' ? (
                                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${DRAWING_GROUP_STATUS_CLASSES[g.status]}`}>
                                    {DRAWING_GROUP_STATUS_LABELS[g.status]}
                                  </span>
                                ) : (
                                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${drawingRowStatus(g.fileCount, g.status === 'RELEASED_TO_PRODUCTION').classes}`}>
                                    {drawingRowStatus(g.fileCount, g.status === 'RELEASED_TO_PRODUCTION').label}
                                  </span>
                                )}
                                <button type="button" onClick={() => setViewing(g)} className={smallBtnCls}><List className="size-3.5" aria-hidden="true" />View Elements</button>
                                {drawingFileButtons(g.fileCount, canWrite, canChangeGroupFiles(g.status)).map((b) => (
                                  <DrawingFileActionButton
                                    key={b.action}
                                    action={b.action}
                                    label={b.label}
                                    onClick={() => {
                                      setIntro(b.action === 'replace' ? REPLACE_DRAWING_HINT : null);
                                      setFilesFor(g);
                                    }}
                                  />
                                ))}
                                {canWrite && g.actions.includes('EDIT') && (
                                  <button type="button" onClick={() => setForm({ kind: 'edit', group: g })} className={smallBtnCls}><Pencil className="size-3.5" aria-hidden="true" />{GROUP_ACTION_LABELS.EDIT}</button>
                                )}
                                {canWrite && g.actions.includes('SUBMIT') && (
                                  <button type="button" disabled={busyId === g.id} onClick={() => void transition(g, 'submit')} className={smallBtnCls}>{GROUP_ACTION_LABELS.SUBMIT}</button>
                                )}
                                {canWrite && g.actions.includes('APPROVE') && (
                                  <button type="button" disabled={busyId === g.id} onClick={() => void transition(g, 'approve')} className={smallBtnCls}>{GROUP_ACTION_LABELS.APPROVE}</button>
                                )}
                                {canWrite && g.actions.includes('RELEASE') && g.fileCount > 0 && (
                                  <button type="button" disabled={busyId === g.id} onClick={() => void transition(g, 'release')} className={BTN_PRIMARY_SM}>{GROUP_ACTION_LABELS.RELEASE}</button>
                                )}
                                {canWrite && g.actions.includes('RELEASE') && g.fileCount === 0 && (
                                  <span className="text-xs text-warning">Final drawing files are required before release to Production.</span>
                                )}
                                {canWrite && g.actions.includes('CANCEL') && (
                                  <button type="button" disabled={busyId === g.id} onClick={() => void transition(g, 'cancel')} className={BTN_DANGER}>{GROUP_ACTION_LABELS.CANCEL}</button>
                                )}
                              </div>
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

      {coverage && (
        <CoverageSections
          coverage={coverage}
          canWrite={canWrite}
          contractId={contractId}
          onAddIndividual={(els, hint) => {
            setIntro(hint ?? null);
            setElementsFor(els);
          }}
          onGroupElement={(boqItemId) => setForm({ kind: 'add', boqItemId })}
          onOpenGroup={(groupId) => {
            const g = items.flatMap((i) => i.groups).find((x) => x.id === groupId);
            if (g) setFilesFor(g);
          }}
        />
      )}

      {elementsFor && (
        <ElementDrawingModal
          contractId={contractId}
          elements={elementsFor.map((e) => ({ id: e.id, pieceCode: e.pieceCode }))}
          canWrite={canWrite}
          intro={intro}
          readOnlyReason={elementsFor.some((e) => e.releaseState === 'RELEASED') ? 'Released elements cannot be changed.' : null}
          onClose={() => setElementsFor(null)}
        />
      )}

      {filesFor && <DrawingGroupFilesModal contractId={contractId} group={filesFor} canWrite={canWrite} intro={intro} onClose={() => setFilesFor(null)} />}

      {viewing && <GroupPiecesModal contractId={contractId} group={viewing} onClose={() => setViewing(null)} />}

      {form.kind !== 'closed' && (
        <GroupFormModal
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

/** Read-only list of the elements one group covers. */
function GroupPiecesModal({ contractId, group, onClose }: { contractId: string; group: DrawingGroup; onClose: () => void }): React.JSX.Element {
  const [pieces, setPieces] = useState<{ id: string; pieceCode: string; currentStatus: BoqPieceStatus }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getDrawingGroupPiecesAction(contractId, group.id).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else setPieces(result.pieces);
    });
    return () => {
      cancelled = true;
    };
  }, [contractId, group.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-labelledby="group-pieces-title">
      <div className="my-4 flex max-h-[92vh] w-[min(96vw,520px)] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="group-pieces-title" className="text-lg font-semibold text-text-primary">Elements in {group.drawingNo}</h2>
            <p className="text-sm text-text-secondary">{group.pieceCount} {group.pieceCount === 1 ? 'element' : 'elements'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-text-muted hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {error && <p className="text-sm text-error">{error}</p>}
          {!error && pieces === null && <p className="py-6 text-center text-sm text-text-muted">Loading…</p>}
          {pieces && pieces.length === 0 && <p className="py-6 text-center text-sm text-text-muted">No elements in this group yet.</p>}
          {pieces && pieces.length > 0 && (
            <ul className="divide-y divide-border">
              {pieces.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-sm font-medium text-text-primary">{p.pieceCode}</span>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${BOQ_PIECE_STATUS_CLASSES[p.currentStatus]}`}>
                    {BOQ_PIECE_STATUS_LABELS[p.currentStatus]}
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

interface ModalProps {
  contractId: string;
  items: DrawingGroupItem[];
  form: Exclude<FormState, { kind: 'closed' }>;
  onClose: () => void;
  onSaved: (message: string) => void;
}

/** Add / edit a drawing group: BOQ item, drawing no, calculation ref, title, remarks and the elements it covers. */
function GroupFormModal({ contractId, items, form, onClose, onSaved }: ModalProps): React.JSX.Element {
  const editing = form.kind === 'edit' ? form.group : null;
  const [boqItemId, setBoqItemId] = useState(form.kind === 'add' ? form.boqItemId : (editing?.boqItemId ?? ''));
  const [drawingNo, setDrawingNo] = useState(editing?.drawingNo ?? '');
  const [calculationRef, setCalculationRef] = useState(editing?.calculationRef ?? '');
  const [groupTitle, setGroupTitle] = useState(editing?.groupTitle ?? '');
  const [remarks, setRemarks] = useState(editing?.remarks ?? '');
  const [pieces, setPieces] = useState<GroupablePiece[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [errors, setErrors] = useState<GroupFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'DRAFT' | 'SUBMIT' | null>(null);

  // Elements of the chosen BOQ item (with the group each one is already in).
  useEffect(() => {
    if (!boqItemId) {
      setPieces(null);
      return;
    }
    let cancelled = false;
    setPieces(null);
    setLoadError(null);
    void listGroupablePiecesAction(contractId, boqItemId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setLoadError(result.error);
        return;
      }
      setPieces(result.pieces);
      // When editing, start with the elements already in this group ticked.
      if (editing && boqItemId === editing.boqItemId) {
        setSelected(new Set(result.pieces.filter((p) => p.drawingGroupLinks[0]?.group.id === editing.id).map((p) => p.id)));
      } else {
        setSelected(new Set());
      }
    });
    return () => {
      cancelled = true;
    };
    // `editing` is fixed for the life of the modal, so it is deliberately not a dependency.
  }, [contractId, boqItemId]);

  const visible = filterPiecesByCode(pieces ?? [], search);
  const visibleSelectable = visible.filter((p) => isPieceSelectable(p, editing?.id ?? null));

  async function submit(action: 'DRAFT' | 'SUBMIT'): Promise<void> {
    if (saving) return;
    const found = validateGroupForm({ boqItemId, drawingNo, selectedCount: selected.size }, action === 'SUBMIT');
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(action);
    const result = await saveDrawingGroupAction(contractId, {
      mode: editing ? 'update' : 'create',
      ...(editing ? { id: editing.id } : {}),
      action,
      boqItemId,
      drawingNo,
      calculationRef,
      groupTitle,
      remarks,
      pieceIds: [...selected],
    });
    setSaving(null);
    if (result.error) {
      setServerError(result.error);
      return;
    }
    onSaved(action === 'SUBMIT' ? `Group ${drawingNo.trim()} submitted.` : `Group ${drawingNo.trim()} saved as draft.`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-labelledby="group-form-title">
      <div className="my-4 flex max-h-[92vh] w-[min(96vw,640px)] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h2 id="group-form-title" className="text-lg font-semibold text-text-primary">{editing ? 'Edit Drawing Group' : 'Create Drawing Group'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-text-muted hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {serverError && <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">{serverError}</div>}
          <p className="rounded-md bg-info-light/60 px-3 py-2 text-xs text-text-secondary">
            Use a drawing group when multiple elements share the same drawing. Elements that have their own final drawing are not offered. Add the group's final drawing files after saving.
          </p>

          <div>
            <label htmlFor="dg-item" className={labelCls}>BOQ Item <span className="text-error">*</span></label>
            <select id="dg-item" value={boqItemId} onChange={(e) => setBoqItemId(e.target.value)} disabled={Boolean(editing)} className={inputCls}>
              <option value="">Select BOQ item</option>
              {items.filter((i) => i.piecesGenerated > 0 || i.boqItemId === boqItemId).map((i) => (
                <option key={i.boqItemId} value={i.boqItemId}>{i.sortOrder}. {i.description} — {i.piecesGenerated} elements</option>
              ))}
            </select>
            {errors.boqItemId && <p className="mt-1 text-xs text-error">{errors.boqItemId}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="dg-drawing" className={labelCls}>Drawing Reference No <span className="text-error">*</span></label>
              <input id="dg-drawing" type="text" maxLength={100} value={drawingNo} onChange={(e) => setDrawingNo(e.target.value)} placeholder="Enter drawing reference number" className={inputCls} />
              {errors.drawingNo && <p className="mt-1 text-xs text-error">{errors.drawingNo}</p>}
            </div>
            <div>
              <label htmlFor="dg-calc" className={labelCls}>Calculation Ref</label>
              <input id="dg-calc" type="text" maxLength={100} value={calculationRef} onChange={(e) => setCalculationRef(e.target.value)} placeholder="Enter calculation reference" className={inputCls} />
            </div>
          </div>

          <div>
            <label htmlFor="dg-title" className={labelCls}>Group Name</label>
            <input id="dg-title" type="text" maxLength={200} value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} placeholder="Example: HC slabs zone A" className={inputCls} />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <span className={labelCls}>Select Elements <span className="text-error">*</span></span>
              <span className="text-xs text-text-secondary">{selected.size} selected</span>
            </div>
            {!boqItemId && <p className="rounded-md bg-surface-secondary px-3 py-3 text-sm text-text-muted">Select a BOQ item to see its elements.</p>}
            {boqItemId && loadError && <p className="text-sm text-error">{loadError}</p>}
            {boqItemId && !loadError && pieces === null && <p className="py-3 text-sm text-text-muted">Loading…</p>}
            {pieces && pieces.length === 0 && <p className="rounded-md bg-surface-secondary px-3 py-3 text-sm text-text-muted">No elements generated for this item yet.</p>}
            {pieces && pieces.length > 0 && (
              <div className="rounded-md border border-border">
                <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search element code"
                    aria-label="Search element code"
                    className="min-w-40 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                    <input
                      type="checkbox"
                      checked={visibleSelectable.length > 0 && visibleSelectable.every((p) => selected.has(p.id))}
                      onChange={() => setSelected((prev) => toggleVisible(prev, visibleSelectable))}
                      className="size-4 rounded border-border accent-[var(--color-accent)]"
                    />
                    Select all unassigned
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-xs text-text-secondary">
                  <span className="font-medium">Select range</span>
                  <input type="number" min="1" inputMode="numeric" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} aria-label="From element number" placeholder="From" className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary" />
                  <span>to</span>
                  <input type="number" min="1" inputMode="numeric" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} aria-label="To element number" placeholder="To" className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary" />
                  <button
                    type="button"
                    disabled={rangeFrom === '' || rangeTo === ''}
                    onClick={() => {
                      const ids = selectableIdsInRange(pieces, Number(rangeFrom), Number(rangeTo), editing?.id ?? null);
                      setSelected((prev) => new Set([...prev, ...ids]));
                    }}
                    className={smallBtnCls}
                  >
                    Select range
                  </button>
                </div>
                <ul className="max-h-60 divide-y divide-border overflow-y-auto">
                  {visible.map((p) => {
                    const selectable = isPieceSelectable(p, editing?.id ?? null);
                    return (
                      <li key={p.id} className={`flex items-center gap-3 px-3 py-1.5 ${selectable ? '' : 'opacity-60'}`}>
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          disabled={!selectable}
                          onChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(p.id)) next.delete(p.id);
                              else next.add(p.id);
                              return next;
                            })
                          }
                          aria-label={`Select ${p.pieceCode}`}
                          className="size-4 shrink-0 rounded border-border accent-[var(--color-accent)]"
                        />
                        <span className="text-sm text-text-primary">{p.pieceCode}</span>
                        <span className="ml-auto text-xs text-text-muted">{selectable ? '' : hasOwnDrawing(p) ? 'Has its own final drawing' : `In ${pieceGroupLabel(p)}`}</span>
                      </li>
                    );
                  })}
                  {visible.length === 0 && <li className="px-3 py-3 text-center text-sm text-text-muted">No elements match.</li>}
                </ul>
              </div>
            )}
            {errors.pieces && <p className="mt-1 text-xs text-error">{errors.pieces}</p>}
          </div>

          <div>
            <label htmlFor="dg-remarks" className={labelCls}>Remarks</label>
            <textarea id="dg-remarks" rows={2} maxLength={2000} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={`${inputCls} resize-y`} />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border bg-surface px-5 py-3">
          <button type="button" onClick={onClose} disabled={saving !== null} className={`${smallBtnCls} h-10 px-4 text-sm`}>Cancel</button>
          <button type="button" onClick={() => void submit('DRAFT')} disabled={saving !== null} className={`${smallBtnCls} h-10 px-4 text-sm`}>
            {saving === 'DRAFT' ? 'Saving…' : 'Save Draft'}
          </button>
          <button
            type="button"
            onClick={() => void submit('SUBMIT')}
            disabled={saving !== null}
            className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {saving === 'SUBMIT' ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CoverageSections({
  contractId,
  coverage,
  canWrite,
  onAddIndividual,
  onGroupElement,
  onOpenGroup,
}: {
  contractId: string;
  coverage: ElementCoverageData;
  canWrite: boolean;
  onAddIndividual: (elements: ElementCoverageRow[], hint?: string) => void;
  onGroupElement: (boqItemId: string) => void;
  onOpenGroup: (groupId: string) => void;
}): React.JSX.Element | null {
  const individuallyCovered = coverage.elements.filter((e) => e.group === null && e.coverage === 'INDIVIDUAL');
  const notCovered = coverage.elements.filter((e) => e.coverage === 'NONE');
  if (individuallyCovered.length === 0 && notCovered.length === 0) return null;

  return (
    <div className="mt-6 space-y-6">
      {individuallyCovered.length > 0 && (
        <section aria-labelledby="individual-elements-title">
          <h3 id="individual-elements-title" className="text-sm font-semibold text-text-primary">Individual Elements</h3>
          <p className="mt-0.5 text-xs text-text-secondary">
            Use this when an element has its own drawing and does not need a group. Drawings are uploaded and managed in{' '}
            <Link href={technicalStepHref(contractId, 'final-drawing-files')} className="font-medium text-accent hover:underline">Final Drawing Files</Link>.
          </p>
          <ul className="mt-2 divide-y divide-border rounded-md border border-border">
            {individuallyCovered.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">{e.pieceCode}</p>
                  <p className="truncate text-xs text-text-secondary">{e.boqItemSortOrder}. {e.boqItemDescription} · Files: {e.individualFileCount}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${drawingRowStatus(e.individualFileCount, e.releaseState === 'RELEASED').classes}`}>
                    {drawingRowStatus(e.individualFileCount, e.releaseState === 'RELEASED').label}
                  </span>
                  {drawingFileButtons(e.individualFileCount, canWrite, e.releaseState !== 'RELEASED').map((b) => (
                    <DrawingFileActionButton key={b.action} action={b.action} label={b.label} onClick={() => onAddIndividual([e], b.action === 'replace' ? REPLACE_DRAWING_HINT : undefined)} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {notCovered.length > 0 && (
        <section aria-labelledby="not-covered-title">
          <h3 id="not-covered-title" className="text-sm font-semibold text-text-primary">Elements Waiting Final Drawing</h3>
          <p className="mt-0.5 text-xs text-text-secondary">These elements have no final drawing yet — upload one for the element, or put it in a drawing group that has a drawing.</p>
          <ul className="mt-2 divide-y divide-border rounded-md border border-border">
            {notCovered.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">{e.pieceCode}</p>
                  <p className="truncate text-xs text-text-secondary">
                    {e.boqItemSortOrder}. {e.boqItemDescription} · {e.group ? `In ${e.group.drawingNo} — Waiting Group Drawing` : 'Waiting Final Drawing'}
                  </p>
                </div>
                {canWrite && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {e.group ? (
                      <button type="button" onClick={() => onOpenGroup(e.group!.id)} className={BTN_PRIMARY_SM}><Plus className="size-3.5" aria-hidden="true" />Add Drawing</button>
                    ) : (
                      <>
                        <button type="button" onClick={() => onAddIndividual([e])} className={BTN_PRIMARY_SM}><Plus className="size-3.5" aria-hidden="true" />Add Drawing</button>
                        <button type="button" onClick={() => onGroupElement(e.boqItemId)} className={smallBtnCls}>Group this element</button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
