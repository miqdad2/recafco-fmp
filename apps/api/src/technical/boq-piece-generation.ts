import { ContractBoqConfirmationStatus, ContractBoqPieceStatus } from '@recafco/database';

// ---------------------------------------------------------------------------
// FMP-BOQ-04 — pure rules for turning CONFIRMED drawing confirmations into
// individual trackable pieces. Contract Qty is never an input here: only the
// physical piece counts Technical confirmed from drawings.
// ---------------------------------------------------------------------------

/** Drawing number made safe for a piece code: upper-case, letters/digits/dot/dash only, never empty. */
export function normalizeDrawingNo(drawingNo: string): string {
  const cleaned = drawingNo
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return cleaned === '' ? 'DWG' : cleaned.slice(0, 80);
}

export function formatPieceNo(pieceNo: number): string {
  return String(pieceNo).padStart(3, '0');
}

export interface ExistingPieceRef {
  drawingConfirmationId: string;
  pieceNo: number;
  pieceCode: string;
}

export interface ConfirmationForGeneration {
  id: string;
  boqItemId: string;
  /** BOQ item number (its sort order) — used to keep codes unique when a drawing number repeats. */
  boqItemSortOrder: number;
  drawingNo: string;
  confirmedPieces: number | null;
  sizeOrSpecification: string | null;
  confirmationStatus: ContractBoqConfirmationStatus;
}

export interface PlannedPiece {
  id: string;
  boqItemId: string;
  drawingConfirmationId: string;
  pieceNo: number;
  pieceCode: string;
  drawingNo: string;
  sizeOrSpecification: string | null;
}

function prefixOf(pieceCode: string): string {
  return pieceCode.replace(/-\d{3,}$/, '');
}

/**
 * The code prefix for one confirmation. Normally just the drawing number
 * (HC-001); if another confirmation already owns that prefix (same drawing no
 * on another BOQ item, or a revised drawing), the BOQ item number and then a
 * short confirmation id are added so codes stay unique per contract.
 */
export function choosePiecePrefix(
  base: string,
  boqItemSortOrder: number,
  confirmationId: string,
  owners: Map<string, string>,
): string {
  const shortId = confirmationId.replace(/-/g, '').toUpperCase();
  const candidates = [base, `${base}-${boqItemSortOrder}`, `${base}-${boqItemSortOrder}-${shortId.slice(0, 4)}`, `${base}-${boqItemSortOrder}-${shortId.slice(0, 8)}`];
  for (const candidate of candidates) {
    const owner = owners.get(candidate);
    if (owner === undefined || owner === confirmationId) return candidate;
  }
  return `${base}-${shortId}`;
}

/**
 * Works out which pieces to create. Only CONFIRMED rows with a positive piece
 * count are used (never Draft / Revised / Cancelled, never Contract Qty).
 * Idempotent: pieces that already exist for a confirmation are kept and only
 * the missing numbers are added, so running it twice creates nothing new.
 */
export function planPieceGeneration(
  confirmations: ConfirmationForGeneration[],
  existingPieces: ExistingPieceRef[],
  newId: () => string,
): PlannedPiece[] {
  const owners = new Map<string, string>();
  const existingByConfirmation = new Map<string, ExistingPieceRef[]>();
  for (const piece of existingPieces) {
    owners.set(prefixOf(piece.pieceCode), piece.drawingConfirmationId);
    const list = existingByConfirmation.get(piece.drawingConfirmationId) ?? [];
    list.push(piece);
    existingByConfirmation.set(piece.drawingConfirmationId, list);
  }

  const planned: PlannedPiece[] = [];
  for (const c of confirmations) {
    if (c.confirmationStatus !== ContractBoqConfirmationStatus.CONFIRMED) continue;
    if (c.confirmedPieces === null || c.confirmedPieces <= 0) continue;

    const existing = existingByConfirmation.get(c.id) ?? [];
    const have = new Set(existing.map((p) => p.pieceNo));
    if (have.size >= c.confirmedPieces) continue;

    const prefix = existing[0]
      ? prefixOf(existing[0].pieceCode)
      : choosePiecePrefix(normalizeDrawingNo(c.drawingNo), c.boqItemSortOrder, c.id, owners);
    owners.set(prefix, c.id);

    for (let n = 1; n <= c.confirmedPieces; n++) {
      if (have.has(n)) continue;
      planned.push({
        id: newId(),
        boqItemId: c.boqItemId,
        drawingConfirmationId: c.id,
        pieceNo: n,
        pieceCode: `${prefix}-${formatPieceNo(n)}`,
        drawingNo: c.drawingNo.trim(),
        sizeOrSpecification: c.sizeOrSpecification,
      });
    }
  }
  return planned;
}

// ---------------------------------------------------------------------------
// Summary per BOQ item
// ---------------------------------------------------------------------------

export interface PieceGroupRow {
  boqItemId: string;
  drawingConfirmationId: string;
  currentStatus: ContractBoqPieceStatus;
  isCancelled: boolean;
  count: number;
}

export interface ItemPieceSummary {
  piecesGenerated: number;
  statusCounts: Partial<Record<ContractBoqPieceStatus, number>>;
  /** Pieces still to be created for this item's CONFIRMED rows (drives the Generate Pieces button). */
  pendingPieces: number;
  /** Pieces exist but their number differs from Drawing Confirmed Pieces (e.g. after a revision). */
  needsAttention: boolean;
}

export function summarizeItemPieces(
  confirmedPieces: number | null,
  confirmations: { id: string; confirmationStatus: ContractBoqConfirmationStatus; confirmedPieces: number | null }[],
  groups: PieceGroupRow[],
): ItemPieceSummary {
  const statusCounts: Partial<Record<ContractBoqPieceStatus, number>> = {};
  let piecesGenerated = 0;
  const perConfirmation = new Map<string, number>();
  for (const g of groups) {
    perConfirmation.set(g.drawingConfirmationId, (perConfirmation.get(g.drawingConfirmationId) ?? 0) + g.count);
    // Every piece shows in its status chip (so Cancelled is visible); cancelled pieces are not counted as generated.
    statusCounts[g.currentStatus] = (statusCounts[g.currentStatus] ?? 0) + g.count;
    if (g.isCancelled) continue;
    piecesGenerated += g.count;
  }

  let pendingPieces = 0;
  for (const c of confirmations) {
    if (c.confirmationStatus !== ContractBoqConfirmationStatus.CONFIRMED || c.confirmedPieces === null) continue;
    pendingPieces += Math.max(0, c.confirmedPieces - (perConfirmation.get(c.id) ?? 0));
  }

  return {
    piecesGenerated,
    statusCounts,
    pendingPieces,
    needsAttention: piecesGenerated > 0 && confirmedPieces !== null && piecesGenerated !== confirmedPieces,
  };
}

// ---------------------------------------------------------------------------
// FMP-BOQ-05 — status update rules (common foundation; department-specific
// restrictions come in later units)
// ---------------------------------------------------------------------------

export type PieceSkipReason = 'CANCELLED' | 'SAME_STATUS' | 'NOT_FOUND' | 'CHANGED' | 'NOT_ALLOWED';

export const PIECE_SKIP_MESSAGES: Record<PieceSkipReason, string> = {
  CANCELLED: 'Cancelled pieces cannot be updated.',
  SAME_STATUS: 'Piece is already in this status.',
  NOT_FOUND: 'Piece was not found in this job.',
  CHANGED: 'Piece was changed by someone else. Please refresh.',
  NOT_ALLOWED: 'You cannot update pieces to this status.',
};

/** Returns why a piece cannot move to the target status, or null when the update is allowed. */
export function pieceSkipReason(
  piece: { currentStatus: ContractBoqPieceStatus; isCancelled: boolean },
  target: ContractBoqPieceStatus,
): PieceSkipReason | null {
  if (piece.isCancelled || piece.currentStatus === ContractBoqPieceStatus.CANCELLED) return 'CANCELLED';
  if (piece.currentStatus === target) return 'SAME_STATUS';
  return null;
}

/** "Status updated." / "Pieces updated." / "8 pieces updated. 2 pieces skipped." / the single skip reason when nothing changed. */
export function buildBulkUpdateMessage(updated: number, skippedReasons: PieceSkipReason[]): string {
  const skipped = skippedReasons.length;
  const plural = (n: number): string => (n === 1 ? '1 piece' : `${n} pieces`);
  if (skipped === 0) return updated === 1 ? 'Status updated.' : 'Pieces updated.';
  if (updated > 0) return `${plural(updated)} updated. ${plural(skipped)} skipped.`;
  const distinct = new Set(skippedReasons);
  const only = distinct.size === 1 ? [...distinct][0] : undefined;
  return only ? PIECE_SKIP_MESSAGES[only] : 'Some pieces were skipped.';
}

// ---------------------------------------------------------------------------
// FMP-BOQ-06 — which statuses each department may set. One shared piece engine;
// the CONTEXT is decided by the page/endpoint the update comes from (only
// Technical exists today; Production, Storage & Delivery and Erection will pass
// their own context when they are connected in later units).
// ---------------------------------------------------------------------------

export type PieceUpdateContext = 'TECHNICAL' | 'PRODUCTION' | 'STORAGE_DELIVERY' | 'ERECTION';

/** Every status a user can set (Not Started is never offered). */
export const ALL_PIECE_UPDATE_STATUSES: ContractBoqPieceStatus[] = [
  ContractBoqPieceStatus.DRAWING_READY,
  ContractBoqPieceStatus.IN_PRODUCTION,
  ContractBoqPieceStatus.PRODUCED,
  ContractBoqPieceStatus.IN_STORE,
  ContractBoqPieceStatus.DELIVERED,
  ContractBoqPieceStatus.ERECTED,
  ContractBoqPieceStatus.COMPLETED,
  ContractBoqPieceStatus.ON_HOLD,
  ContractBoqPieceStatus.REJECTED,
  ContractBoqPieceStatus.CANCELLED,
];

export const PIECE_STATUS_OWNERSHIP: Record<PieceUpdateContext, ContractBoqPieceStatus[]> = {
  TECHNICAL: [
    ContractBoqPieceStatus.DRAWING_READY,
    ContractBoqPieceStatus.ON_HOLD,
    ContractBoqPieceStatus.REJECTED,
    ContractBoqPieceStatus.CANCELLED,
  ],
  PRODUCTION: [
    ContractBoqPieceStatus.IN_PRODUCTION,
    ContractBoqPieceStatus.PRODUCED,
    ContractBoqPieceStatus.ON_HOLD,
    ContractBoqPieceStatus.REJECTED,
  ],
  STORAGE_DELIVERY: [
    ContractBoqPieceStatus.IN_STORE,
    ContractBoqPieceStatus.DELIVERED,
    ContractBoqPieceStatus.ON_HOLD,
    ContractBoqPieceStatus.REJECTED,
  ],
  ERECTION: [
    ContractBoqPieceStatus.ERECTED,
    ContractBoqPieceStatus.COMPLETED,
    ContractBoqPieceStatus.ON_HOLD,
    ContractBoqPieceStatus.REJECTED,
  ],
};

/**
 * Manager/admin override: `contracts.manage` (Admin, Executive Manager, Super
 * Admin — the same permission Technical already uses for manager-level
 * overrides) may set any status; everyone else only their department's own.
 * Status changes by an override user are still recorded in history.
 */
export function allowedPieceStatuses(context: PieceUpdateContext, permissions: string[]): ContractBoqPieceStatus[] {
  return permissions.includes('contracts.manage') ? [...ALL_PIECE_UPDATE_STATUSES] : [...PIECE_STATUS_OWNERSHIP[context]];
}

/**
 * FMP-BOQ-07 — what the Production screen may set. Deliberately NO manager/admin
 * override here: the Production dropdown stays focused on Production statuses.
 * Needs production.update (or production.manage); read-only users get none.
 */
export function productionAllowedPieceStatuses(permissions: string[]): ContractBoqPieceStatus[] {
  const canWrite = permissions.includes('production.update') || permissions.includes('production.manage');
  return canWrite ? [...PIECE_STATUS_OWNERSHIP.PRODUCTION] : [];
}
