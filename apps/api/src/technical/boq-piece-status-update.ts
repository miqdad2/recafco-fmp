import { ContractBoqPieceStatus } from '@recafco/database';
import type { DatabaseService } from '../database/database.service';
import { pieceSkipReason, buildBulkUpdateMessage, PIECE_SKIP_MESSAGES } from './boq-piece-generation';
import type { PieceSkipReason } from './boq-piece-generation';

// ---------------------------------------------------------------------------
// The ONE piece status-update engine, shared by every department screen
// (Technical today, Production next; Storage & Delivery and Erection later).
// Each screen decides WHO may call it and WHICH statuses it allows; the rules
// for skipping, history and concurrency live here once.
// ---------------------------------------------------------------------------

/** Statuses where an optional place (yard, bay, site area ...) is recorded. */
const LOCATION_STATUSES: ContractBoqPieceStatus[] = [
  ContractBoqPieceStatus.IN_STORE,
  ContractBoqPieceStatus.DELIVERED,
  ContractBoqPieceStatus.ERECTED,
  ContractBoqPieceStatus.COMPLETED,
];

export interface SkippedPiece {
  pieceId: string;
  pieceCode: string | null;
  reason: PieceSkipReason;
  message: string;
}

export interface PieceStatusUpdateResult {
  updatedCount: number;
  skippedCount: number;
  skipped: SkippedPiece[];
  message: string;
}

export interface PieceStatusUpdateParams {
  /** Limits the update to one job's pieces (Technical). Omit for a cross-job screen (Production). */
  contractId?: string;
  pieceIds: string[];
  target: ContractBoqPieceStatus;
  note: string | undefined;
  /** Optional place; only stored when the target is In Store, Delivered, Erected or Completed. */
  location?: string | undefined;
  actorId: string;
  /** FMP-BOQ-14 — Production: In Production / Produced need the piece's drawing group to be Released to Production. */
  requireRelease?: boolean;
  /** Statuses the calling screen/user may set. A target outside this list is blocked before anything is read or written. */
  allowedStatuses: ContractBoqPieceStatus[];
}

export async function applyPieceStatusUpdate(
  db: DatabaseService,
  params: PieceStatusUpdateParams,
): Promise<PieceStatusUpdateResult> {
  const { contractId, pieceIds, target, actorId, allowedStatuses } = params;
  const location =
    params.location && LOCATION_STATUSES.includes(target)
      ? params.location
      : undefined;
  // The place is also written into the history note so the movement can be traced.
  const note = [params.note, location ? `Location: ${location}` : undefined].filter(Boolean).join(' · ') || undefined;
  const client = db.getClient();
  const scope = contractId ? { contractId } : {};

  // Blocked before anything is read or written, so no history row can exist for a blocked update.
  if (!allowedStatuses.includes(target)) {
    return {
      updatedCount: 0,
      skippedCount: pieceIds.length,
      skipped: pieceIds.map((pieceId) => ({ pieceId, pieceCode: null, reason: 'NOT_ALLOWED' as const, message: PIECE_SKIP_MESSAGES.NOT_ALLOWED })),
      message: PIECE_SKIP_MESSAGES.NOT_ALLOWED,
    };
  }

  const found = await client.contractBoqPiece.findMany({
    where: { id: { in: pieceIds }, ...scope },
    select: { id: true, pieceCode: true, currentStatus: true, isCancelled: true },
  });
  const byId = new Map(found.map((p) => [p.id, p]));

  // FMP-BOQ-14 — Hold / Rejected are never gated; only starting or finishing production needs a release.
  const releaseGate =
    params.requireRelease && (target === ContractBoqPieceStatus.IN_PRODUCTION || target === ContractBoqPieceStatus.PRODUCED)
      ? await releaseSkipReasons(client, found.map((p) => p.id))
      : null;

  const skipped: SkippedPiece[] = [];
  const toUpdate: typeof found = [];
  for (const id of pieceIds) {
    const piece = byId.get(id);
    if (!piece) {
      skipped.push({ pieceId: id, pieceCode: null, reason: 'NOT_FOUND', message: PIECE_SKIP_MESSAGES.NOT_FOUND });
      continue;
    }
    const reason = pieceSkipReason(piece, target) ?? (releaseGate ? releaseGate.get(id) ?? null : null);
    if (reason) skipped.push({ pieceId: id, pieceCode: piece.pieceCode, reason, message: PIECE_SKIP_MESSAGES[reason] });
    else toUpdate.push(piece);
  }

  let updatedCount = 0;
  if (toUpdate.length > 0) {
    await client.$transaction(async (tx) => {
      // Grouped by old status; the status condition makes a piece changed by someone else in the meantime skip instead of being overwritten.
      const groups = new Map<ContractBoqPieceStatus, typeof found>();
      for (const p of toUpdate) groups.set(p.currentStatus, [...(groups.get(p.currentStatus) ?? []), p]);

      for (const [oldStatus, groupPieces] of groups) {
        let pieces = groupPieces;
        const result = await tx.contractBoqPiece.updateMany({
          where: { id: { in: groupPieces.map((p) => p.id) }, ...scope, currentStatus: oldStatus, isCancelled: false },
          data: {
            currentStatus: target,
            ...(location ? { currentLocation: location } : {}),
            ...(target === ContractBoqPieceStatus.CANCELLED ? { isCancelled: true } : {}),
          },
        });
        if (result.count !== groupPieces.length) {
          // Rare race: re-read which of these actually moved, skip the rest.
          const moved = await tx.contractBoqPiece.findMany({
            where: { id: { in: groupPieces.map((p) => p.id) }, currentStatus: target },
            select: { id: true },
          });
          const movedIds = new Set(moved.map((m) => m.id));
          for (const p of groupPieces) {
            if (!movedIds.has(p.id)) {
              skipped.push({ pieceId: p.id, pieceCode: p.pieceCode, reason: 'CHANGED', message: PIECE_SKIP_MESSAGES.CHANGED });
            }
          }
          pieces = groupPieces.filter((p) => movedIds.has(p.id));
        }
        if (pieces.length > 0) {
          await tx.contractBoqPieceStatusHistory.createMany({
            data: pieces.map((p) => ({
              pieceId: p.id,
              oldStatus,
              newStatus: target,
              updatedById: actorId,
              ...(note ? { note } : {}),
            })),
          });
          updatedCount += pieces.length;
        }
      }
    });
  }

  return {
    updatedCount,
    skippedCount: skipped.length,
    skipped,
    message: buildBulkUpdateMessage(updatedCount, skipped.map((s) => s.reason)),
  };
}

/**
 * For each piece: null-free map of why it is not released (NO_GROUP / NOT_RELEASED);
 * pieces in a Released-to-Production active group are absent (= allowed). A piece
 * whose only groups were cancelled counts as "not released".
 */
async function releaseSkipReasons(
  client: ReturnType<DatabaseService['getClient']>,
  pieceIds: string[],
): Promise<Map<string, PieceSkipReason>> {
  const links = await client.technicalDrawingGroupPiece.findMany({
    where: { pieceId: { in: pieceIds } },
    select: { pieceId: true, activeSlot: true, group: { select: { status: true } } },
  });
  const result = new Map<string, PieceSkipReason>();
  for (const id of pieceIds) {
    const own = links.filter((l) => l.pieceId === id);
    const active = own.find((l) => l.activeSlot === 1);
    if (active) {
      if (active.group.status !== 'RELEASED_TO_PRODUCTION') result.set(id, 'NOT_RELEASED');
    } else {
      result.set(id, own.length > 0 ? 'NOT_RELEASED' : 'NO_GROUP');
    }
  }
  return result;
}
