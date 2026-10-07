import { NotFoundException } from '@nestjs/common';
import { ContractBoqPieceStatus } from '@recafco/database';
import type { DatabaseService } from '../database/database.service';

// ---------------------------------------------------------------------------
// Shared read side of the department piece screens (Production, Storage Yard &
// Delivery, later Erection): the same list / filters / summary / history over
// the one piece engine. Each screen supplies only its own visible + default
// statuses; nothing here writes.
// ---------------------------------------------------------------------------

export interface PieceScreenListQuery {
  statuses?: string | undefined;
  search?: string | undefined;
  contractId?: string | undefined;
  drawingNo?: string | undefined;
  boqItem?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

/** Valid statuses from the comma list, limited to what the screen shows; nothing valid → the screen's default. */
export function parseScreenStatuses(
  statuses: string | undefined,
  visible: ContractBoqPieceStatus[],
  defaults: ContractBoqPieceStatus[],
): ContractBoqPieceStatus[] {
  if (!statuses) return [...defaults];
  const wanted = statuses
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is ContractBoqPieceStatus => visible.includes(s as ContractBoqPieceStatus));
  return wanted.length > 0 ? wanted : [...defaults];
}

export async function listScreenPieces(
  db: DatabaseService,
  query: PieceScreenListQuery,
  visible: ContractBoqPieceStatus[],
  defaults: ContractBoqPieceStatus[],
) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const search = query.search?.trim();

  const where = {
    isCancelled: false,
    currentStatus: { in: parseScreenStatuses(query.statuses, visible, defaults) },
    ...(query.contractId ? { contractId: query.contractId } : {}),
    ...(query.drawingNo?.trim() ? { drawingNo: { contains: query.drawingNo.trim(), mode: 'insensitive' as const } } : {}),
    ...(query.boqItem?.trim() ? { boqItem: { description: { contains: query.boqItem.trim(), mode: 'insensitive' as const } } } : {}),
    ...(search
      ? {
          OR: [
            { pieceCode: { contains: search, mode: 'insensitive' as const } },
            { drawingNo: { contains: search, mode: 'insensitive' as const } },
            { contract: { referenceNumber: { contains: search, mode: 'insensitive' as const } } },
            { contract: { jobOrder: { contains: search, mode: 'insensitive' as const } } },
            { contract: { title: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const client = db.getClient();
  const [items, total] = await Promise.all([
    client.contractBoqPiece.findMany({
      where,
      orderBy: [{ pieceCode: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        pieceCode: true,
        drawingNo: true,
        sizeOrSpecification: true,
        currentStatus: true,
        currentLocation: true,
        updatedAt: true,
        contract: { select: { id: true, referenceNumber: true, jobOrder: true, title: true } },
        boqItem: { select: { description: true } },
      },
    }),
    client.contractBoqPiece.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

/** Status counts over all non-cancelled pieces (not just the current filter). */
export async function screenStatusGroups(db: DatabaseService): Promise<{ currentStatus: ContractBoqPieceStatus; count: number }[]> {
  const groups = await db.getClient().contractBoqPiece.groupBy({
    by: ['currentStatus'],
    where: { isCancelled: false },
    _count: { _all: true },
  });
  return groups.map((g) => ({ currentStatus: g.currentStatus, count: g._count._all }));
}

/** Jobs that have pieces — for the Contract filter. */
export function screenContractOptions(db: DatabaseService) {
  return db.getClient().contract.findMany({
    where: { boqPieces: { some: {} } },
    orderBy: { referenceNumber: 'asc' },
    select: { id: true, referenceNumber: true, jobOrder: true, title: true },
  });
}

/** Newest first: when, from, to, note, who. */
export async function screenPieceHistory(db: DatabaseService, pieceId: string) {
  const client = db.getClient();
  const piece = await client.contractBoqPiece.findUnique({ where: { id: pieceId }, select: { id: true, pieceCode: true } });
  if (!piece) throw new NotFoundException({ code: 'BOQ_PIECE_NOT_FOUND', message: 'Piece was not found.' });
  const rows = await client.contractBoqPieceStatusHistory.findMany({
    where: { pieceId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      oldStatus: true,
      newStatus: true,
      note: true,
      createdAt: true,
      updatedByUser: { select: { id: true, displayName: true } },
    },
  });
  return { pieceCode: piece.pieceCode, history: rows };
}
