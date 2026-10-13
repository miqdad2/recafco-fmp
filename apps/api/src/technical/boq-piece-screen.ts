import { NotFoundException } from '@nestjs/common';
import { ContractBoqPieceStatus, TechnicalDrawingGroupStatus } from '@recafco/database';
import type { Prisma } from '@recafco/database';
import type { DatabaseService } from '../database/database.service';

// ---------------------------------------------------------------------------
// Shared read side of the department piece screens (Production, Storage Yard &
// Delivery, later Erection): the same list / filters / summary / history over
// the one piece engine. Each screen supplies only its own visible + default
// statuses; nothing here writes.
// ---------------------------------------------------------------------------

/**
 * FMP-TECH-24/27 — an element is "released" when its active drawing group is Released to Production, or when
 * Technical released it on its own (it has its own final drawing files).
 * Production only works with released elements; Technical keeps seeing all of them.
 */
export const RELEASED_ELEMENT_FILTER: { AND: Prisma.ContractBoqPieceWhereInput[] } = {
  // AND-wrapped so it never collides with the search OR used by the list query.
  AND: [
    {
      OR: [
        { releasedToProductionAt: { not: null } },
        { drawingGroupLinks: { some: { activeSlot: 1, group: { status: TechnicalDrawingGroupStatus.RELEASED_TO_PRODUCTION } } } },
      ],
    },
  ],
};

/**
 * FMP-PROD-02 — Storage Yard & Delivery only sees elements Production has handed over: Sent to Storage Yard,
 * In Store, Delivered, plus Hold / Rejected elements that were already handed over (they have a Sent / In Store
 * history row). Ready, In Production and Produced-but-not-sent elements never appear there.
 */
export const SENT_TO_STORAGE_ELEMENT_FILTER: { AND: Prisma.ContractBoqPieceWhereInput[] } = {
  AND: [
    {
      OR: [
        { currentStatus: { in: [ContractBoqPieceStatus.SENT_TO_STORAGE, ContractBoqPieceStatus.IN_STORE, ContractBoqPieceStatus.DELIVERED] } },
        {
          currentStatus: { in: [ContractBoqPieceStatus.ON_HOLD, ContractBoqPieceStatus.REJECTED] },
          statusHistory: { some: { newStatus: { in: [ContractBoqPieceStatus.SENT_TO_STORAGE, ContractBoqPieceStatus.IN_STORE] } } },
        },
      ],
    },
  ],
};

export interface ScreenScope {
  releasedOnly?: boolean;
  sentToStorageOnly?: boolean;
}

function scopeWhere(options: ScreenScope): Prisma.ContractBoqPieceWhereInput {
  return {
    ...(options.releasedOnly ? RELEASED_ELEMENT_FILTER : {}),
    ...(options.sentToStorageOnly ? SENT_TO_STORAGE_ELEMENT_FILTER : {}),
  };
}

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
  options: ScreenScope & { includeDrawingGroup?: boolean } = {},
) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const search = query.search?.trim();

  const where = {
    isCancelled: false,
    ...scopeWhere(options),
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
        // FMP-PROD-02/04 — the latest status changes (who, note, when, to what): the row shows the last one, and the
        // Produced / Sent to Storage Yard details are picked from these.
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 5, select: { newStatus: true, note: true, createdAt: true, updatedByUser: { select: { displayName: true } } } },
        // FMP-BOQ-13 — only the Production screen asks for the piece's drawing group.
        ...(options.includeDrawingGroup
          ? {
              _count: { select: { attachments: true } },
              drawingGroupLinks: {
                where: { activeSlot: 1 },
                take: 1,
                select: {
                  group: { select: { id: true, drawingNo: true, calculationRef: true, groupTitle: true, status: true, _count: { select: { attachments: true } } } },
                },
              },
            }
          : {}),
      },
    }),
    client.contractBoqPiece.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

/** Status counts over all non-cancelled pieces (not just the current filter). */
export async function screenStatusGroups(
  db: DatabaseService,
  options: ScreenScope = {},
): Promise<{ currentStatus: ContractBoqPieceStatus; count: number }[]> {
  const groups = await db.getClient().contractBoqPiece.groupBy({
    by: ['currentStatus'],
    where: { isCancelled: false, ...scopeWhere(options) },
    _count: { _all: true },
  });
  return groups.map((g) => ({ currentStatus: g.currentStatus, count: g._count._all }));
}

/** Jobs that have pieces — for the Contract filter. */
export function screenContractOptions(db: DatabaseService, options: ScreenScope = {}) {
  return db.getClient().contract.findMany({
    where: { boqPieces: { some: scopeWhere(options) } },
    orderBy: { referenceNumber: 'asc' },
    select: { id: true, referenceNumber: true, jobOrder: true, title: true },
  });
}

/** Newest first: when, from, to, note, who. */
export async function screenPieceHistory(db: DatabaseService, pieceId: string) {
  const client = db.getClient();
  const piece = await client.contractBoqPiece.findUnique({ where: { id: pieceId }, select: { id: true, pieceCode: true } });
  if (!piece) throw new NotFoundException({ code: 'BOQ_PIECE_NOT_FOUND', message: 'Element was not found.' });
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
