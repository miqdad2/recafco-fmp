import type { BoqPieceStatus, BoqPieceUpdateStatus } from '@/lib/technical-api';
import type { ProductionPiece } from '@/lib/production-pieces-api';

// ---------------------------------------------------------------------------
// FMP-PROD-02 — what a production user can do with an element, and how it is
// worded. "Drawing Ready" is Technical's status; the moment an element is
// released to Production it is simply "Ready for Production" here. The API
// still decides who may set what (production.update) — these helpers only
// decide which buttons make sense for an element's current status.
// ---------------------------------------------------------------------------

/** Production-facing status wording ("Elements Generated" is a Technical status and never shown here). */
export const PRODUCTION_STATUS_LABELS: Record<BoqPieceStatus, string> = {
  NOT_STARTED: 'Not Started',
  DRAWING_READY: 'Ready for Production',
  IN_PRODUCTION: 'In Production',
  PRODUCED: 'Produced',
  SENT_TO_STORAGE: 'Sent to Storage Yard',
  IN_STORE: 'In Storage Yard',
  DELIVERED: 'Delivered',
  ERECTED: 'Erected',
  COMPLETED: 'Completed',
  ON_HOLD: 'On Hold',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export type ProductionActionKey = 'START' | 'PRODUCE' | 'HOLD' | 'REJECT' | 'RESUME' | 'SEND';

export interface ProductionActionDef {
  key: ProductionActionKey;
  /** Button label, e.g. "Start Production". */
  label: string;
  /** Status the element moves to. */
  target: BoqPieceUpdateStatus;
  /** Statuses an element must be in for this action. */
  from: BoqPieceStatus[];
  /** Confirmation modal. */
  modalTitle: string;
  /** Which extra field(s) the modal shows. */
  field: 'note' | 'produced' | 'handover' | 'reason';
  danger?: boolean;
}

export const PRODUCTION_ACTIONS: Record<ProductionActionKey, ProductionActionDef> = {
  START: { key: 'START', label: 'Start Production', target: 'IN_PRODUCTION', from: ['DRAWING_READY'], modalTitle: 'Start Production?', field: 'note' },
  PRODUCE: { key: 'PRODUCE', label: 'Mark Produced', target: 'PRODUCED', from: ['IN_PRODUCTION'], modalTitle: 'Mark as Produced?', field: 'produced' },
  HOLD: { key: 'HOLD', label: 'Put On Hold', target: 'ON_HOLD', from: ['IN_PRODUCTION'], modalTitle: 'Put On Hold?', field: 'reason' },
  REJECT: { key: 'REJECT', label: 'Reject', target: 'REJECTED', from: ['IN_PRODUCTION', 'ON_HOLD'], modalTitle: 'Reject Elements?', field: 'reason', danger: true },
  RESUME: { key: 'RESUME', label: 'Resume Production', target: 'IN_PRODUCTION', from: ['ON_HOLD'], modalTitle: 'Resume Production?', field: 'note' },
  SEND: { key: 'SEND', label: 'Send to Storage Yard', target: 'SENT_TO_STORAGE', from: ['PRODUCED'], modalTitle: 'Send to Storage Yard?', field: 'handover' },
};

/** Row buttons, in display order, for an element's status. Rejected / Sent / later statuses have none (History only). */
const ROW_ACTIONS: Partial<Record<BoqPieceStatus, ProductionActionKey[]>> = {
  DRAWING_READY: ['START'],
  IN_PRODUCTION: ['PRODUCE', 'HOLD', 'REJECT'],
  PRODUCED: ['SEND'],
  ON_HOLD: ['RESUME', 'REJECT'],
};

/** The action buttons to show on one row — only those whose target status this user may set. Read-only users get none. */
export function rowActionsFor(status: BoqPieceStatus, allowed: BoqPieceUpdateStatus[] | null, hasDrawing = true): ProductionActionDef[] {
  if (!allowed || allowed.length === 0) return [];
  return (ROW_ACTIONS[status] ?? [])
    .map((k) => PRODUCTION_ACTIONS[k])
    .filter((a) => allowed.includes(a.target))
    // Production cannot start without a final drawing.
    .filter((a) => a.key !== 'START' || hasDrawing);
}

/** The four bulk actions, in display order. */
const BULK_ACTIONS: ProductionActionKey[] = ['START', 'PRODUCE', 'HOLD', 'SEND'];

/**
 * Bulk buttons for the ticked elements: an action shows only when EVERY ticked
 * element is in a status it applies to (e.g. all Ready → Start Production;
 * all Produced → Send to Storage Yard). Start Production also needs every ticked element to have its
 * final drawing. Nothing ticked → none.
 */
export function bulkActionsFor(
  selected: { status: BoqPieceStatus; hasDrawing: boolean }[],
  allowed: BoqPieceUpdateStatus[] | null,
): ProductionActionDef[] {
  if (!allowed || allowed.length === 0 || selected.length === 0) return [];
  return BULK_ACTIONS.map((k) => PRODUCTION_ACTIONS[k]).filter(
    (a) =>
      allowed.includes(a.target) &&
      selected.every((s) => a.from.includes(s.status)) &&
      // Start Production only for elements that all have a final drawing.
      (a.key !== 'START' || selected.every((s) => s.hasDrawing)),
  );
}

/** "3 elements" / "1 element". */
export function elementCount(n: number): string {
  return n === 1 ? '1 element' : `${n} elements`;
}

/** The modal's one-line message. */
export function actionMessage(action: ProductionActionDef, count: number): string {
  switch (action.key) {
    case 'START': return `You are starting production for ${elementCount(count)}.`;
    case 'PRODUCE': return `You are marking ${elementCount(count)} as produced.`;
    case 'HOLD': return `You are putting ${elementCount(count)} on hold.`;
    case 'REJECT': return `You are rejecting ${elementCount(count)}.`;
    case 'RESUME': return `You are resuming production for ${elementCount(count)}.`;
    case 'SEND': return `${count === 1 ? 'This element' : `These ${count} elements`} will move to Storage Yard & Delivery. Storage team will be able to receive and manage ${count === 1 ? 'it' : 'them'}.`;
  }
}

/** Start Production asks the user to confirm the final drawing was checked (never for Resume). */
export function startConfirmation(count: number): { message: string; checkbox: string } {
  return count === 1
    ? { message: 'You are starting production for this element. Please confirm the final drawing has been checked.', checkbox: 'I checked the final drawing.' }
    : { message: `You are starting production for ${count} elements. Confirm drawings have been checked.`, checkbox: 'I checked the drawings.' };
}

export interface ActionFormValues {
  /** Produced Date (yyyy-mm-dd) — only for Mark Produced. */
  producedDate: string;
  /** Production note / remarks / handover note / reason, depending on the action. */
  text: string;
}

/** Today as yyyy-mm-dd in local time (the Produced Date default). */
export function todayInputValue(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Null when fine, otherwise a plain message. A produced date cannot be in the future. */
export function validateActionForm(action: ProductionActionDef, values: ActionFormValues, today: string = todayInputValue()): string | null {
  if (action.field === 'produced') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.producedDate)) return 'Please enter the produced date.';
    if (values.producedDate > today) return 'Produced date cannot be in the future.';
  }
  return null;
}

/** The note saved in the element's history (the API keeps one free-text note per update). */
export function buildActionNote(action: ProductionActionDef, values: ActionFormValues): string {
  const text = values.text.trim();
  const parts: string[] = [];
  if (action.key === 'PRODUCE') parts.push(`Produced on ${values.producedDate}`);
  if (action.key === 'SEND') parts.push('Handed over to Storage Yard & Delivery');
  if (text) parts.push(text);
  return parts.join(' · ');
}

/** Label of the optional text box in the modal. */
export function actionFieldLabel(action: ProductionActionDef): string {
  switch (action.field) {
    case 'produced': return 'Remarks';
    case 'handover': return 'Handover note';
    case 'reason': return 'Reason';
    case 'note': return 'Production note';
  }
}

/** Success text after an update, e.g. "3 elements sent to Storage Yard." — uses the API's message when something was skipped. */
export function resultMessage(action: ProductionActionDef, updated: number, apiMessage: string | undefined, skipped: number): string {
  if (skipped > 0 && apiMessage) return apiMessage;
  const done: Record<ProductionActionKey, string> = {
    START: 'started in production',
    PRODUCE: 'marked as Produced',
    HOLD: 'put on hold',
    REJECT: 'rejected',
    RESUME: 'resumed',
    SEND: 'sent to Storage Yard successfully',
  };
  const subject = updated === 1 ? 'Element' : `${updated} elements`;
  return `${subject} ${done[action.key]}.`;
}

/** Hold / Rejected elements need attention — shown with their reason. */
export function needsAttention(status: BoqPieceStatus): boolean {
  return status === 'ON_HOLD' || status === 'REJECTED';
}

/** The latest note/who for a row (from the API's latest history row), or null when never updated. */
export function lastUpdateInfo(piece: Pick<ProductionPiece, 'statusHistory'>): { by: string | null; note: string | null } | null {
  const latest = piece.statusHistory?.[0];
  if (!latest) return null;
  return { by: latest.updatedByUser?.displayName ?? null, note: latest.note };
}

/** "1 file" / "3 files" / "No files". */
export function fileCountText(n: number): string {
  return n === 0 ? 'No files' : n === 1 ? '1 file' : `${n} files`;
}

/**
 * The drawing line of a row: "Drawing DN-0001 · Individual Drawing · 1 file" or
 * "Group: hc-zone A · Drawing 8888 · 1 file". Missing drawings say so.
 */
export function drawingLineText(drawing: ProductionPiece['drawing']): string {
  if (drawing.source === 'NONE') return 'No final drawing';
  if (drawing.source === 'GROUP') {
    return [drawing.groupTitle ? `Group: ${drawing.groupTitle}` : 'Group Drawing', `Drawing ${drawing.reference}`, fileCountText(drawing.fileCount)].join(' · ');
  }
  return [`Drawing ${drawing.reference}`, 'Individual Drawing', fileCountText(drawing.fileCount)].join(' · ');
}

export const MISSING_DRAWING_MESSAGE = 'Final drawing is required before production can start.';

/** Missing Drawing matters while the element has not started yet. */
export function showsMissingDrawing(piece: Pick<ProductionPiece, 'currentStatus' | 'drawing'>): boolean {
  return !piece.drawing.hasDrawing && piece.currentStatus === 'DRAWING_READY';
}

/** The wording of a history row for normal users — plain labels, never the raw status codes. */
export function historyEventText(oldStatus: BoqPieceStatus | null, newStatus: BoqPieceStatus, note: string | null): string {
  if (note === 'Released from Technical') return 'Released from Technical';
  if (newStatus === 'IN_PRODUCTION') return oldStatus === 'ON_HOLD' ? 'Resumed Production' : 'Started Production';
  if (newStatus === 'PRODUCED') return 'Marked Produced';
  if (newStatus === 'SENT_TO_STORAGE') return 'Sent to Storage Yard';
  if (newStatus === 'ON_HOLD') return 'Put On Hold';
  if (newStatus === 'REJECTED') return 'Rejected';
  if (newStatus === 'DRAWING_READY') return 'Ready for Production';
  return PRODUCTION_STATUS_LABELS[newStatus];
}

/** Same-origin routes the drawing viewer and Download Drawing use for one of an element's final drawing files. */
export function productionDrawingHrefs(pieceId: string, attachmentId: string): { view: string; preview: string; download: string } {
  const base = `/production/pieces/${pieceId}/drawing-files/${attachmentId}`;
  return { view: `${base}/view`, preview: `${base}/preview`, download: `${base}/download` };
}

// ---------------------------------------------------------------------------
// FMP-PROD-04 — Produced / Sent to Storage Yard details, visibility after an update
// ---------------------------------------------------------------------------

/** "13 Oct 2026, 12:15". */
export function formatMilestoneDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** One history line for normal users: "Marked Produced by manager on 13 Oct 2026, 12:15" (the user and date are left out when unknown). */
export function historyLine(event: string, by: string | null | undefined, createdAt: string | null | undefined): string {
  return [event, by ? `by ${by}` : null, createdAt ? `on ${formatMilestoneDate(createdAt)}` : null].filter(Boolean).join(' ');
}

export interface Milestone {
  at: string;
  by: string | null;
}

/**
 * When and by whom an element was marked Produced / sent to Storage Yard — taken from its latest status
 * changes, so a Produced element shows "Produced on / by" and a handed-over one also shows "Sent on / by".
 */
export function milestoneInfo(piece: Pick<ProductionPiece, 'statusHistory'>): { produced: Milestone | null; sent: Milestone | null } {
  const find = (status: BoqPieceStatus): Milestone | null => {
    const h = (piece.statusHistory ?? []).find((x) => x.newStatus === status);
    return h ? { at: h.createdAt, by: h.updatedByUser?.displayName ?? null } : null;
  };
  return { produced: find('PRODUCED'), sent: find('SENT_TO_STORAGE') };
}

/** Rejected and On Hold rows keep to their own actions (Resume / Reject / History); every other row can open its drawing. */
export function showsDrawingButtons(status: BoqPieceStatus): boolean {
  return status !== 'ON_HOLD' && status !== 'REJECTED';
}

/**
 * After an update the list reloads under the active filter, which may no longer include the element (e.g.
 * Ready + In Production after Mark Produced). Updated elements are kept on screen with their new status
 * until the filter changes, so nothing disappears without explanation.
 */
export function retainUpdated(
  shown: ProductionPiece[],
  updatedIds: string[],
  action: ProductionActionDef,
  note: string,
  by: string | null,
  nowIso: string,
): ProductionPiece[] {
  return shown
    .filter((p) => updatedIds.includes(p.id) && p.currentStatus !== action.target)
    .map((p) => ({
      ...p,
      currentStatus: action.target,
      updatedAt: nowIso,
      statusHistory: [{ newStatus: action.target, note: note || null, createdAt: nowIso, updatedByUser: by ? { displayName: by } : null }, ...(p.statusHistory ?? [])],
    }));
}

/**
 * The list to show: the loaded elements, plus kept ones the server no longer returns for this filter. A kept
 * element also wins over a loaded copy that is older and still shows the previous status (the reload has not
 * arrived yet); once the loaded copy matches, the loaded one is used.
 */
export function mergeRetained(loaded: ProductionPiece[], retained: ProductionPiece[]): ProductionPiece[] {
  const keptById = new Map(retained.map((p) => [p.id, p]));
  const loadedIds = new Set(loaded.map((p) => p.id));
  const base = loaded.map((p) => {
    const kept = keptById.get(p.id);
    return kept && kept.currentStatus !== p.currentStatus && kept.updatedAt > p.updatedAt ? kept : p;
  });
  return [...base, ...retained.filter((p) => !loadedIds.has(p.id))].sort((a, b) => a.pieceCode.localeCompare(b.pieceCode));
}

/** Where "View Produced Elements" goes after Mark Produced (status filter + the same job). */
export function statusFilterHref(status: BoqPieceStatus, contractId: string): string {
  const qs = new URLSearchParams({ status });
  if (contractId) qs.set('contractId', contractId);
  return `/production/pieces?${qs.toString()}`;
}

/** The status filter an updated element now belongs to, so the page can point the user at it. */
export function targetFilterFor(action: ProductionActionDef): { value: BoqPieceStatus; label: string } {
  switch (action.key) {
    case 'PRODUCE': return { value: 'PRODUCED', label: 'View Produced Elements' };
    case 'SEND': return { value: 'SENT_TO_STORAGE', label: 'View Elements Sent to Storage Yard' };
    case 'HOLD': return { value: 'ON_HOLD', label: 'View Elements On Hold' };
    case 'REJECT': return { value: 'REJECTED', label: 'View Rejected Elements' };
    case 'START':
    case 'RESUME': return { value: 'IN_PRODUCTION', label: 'View Elements In Production' };
  }
}
