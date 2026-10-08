import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ContractBoqPieceStatus as P } from '@recafco/database';
import {
  ProductionPiecesService,
  parseProductionStatuses,
  buildProductionSummary,
  PRODUCTION_DEFAULT_STATUSES,
} from './production-pieces.service';
import { productionAllowedPieceStatuses } from '../technical/boq-piece-generation';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';

const mockPieceFindMany = vi.fn();
const mockPieceCount = vi.fn();
const mockPieceGroupBy = vi.fn();
const mockPieceUpdateMany = vi.fn();
const mockPieceFindUnique = vi.fn();
const mockHistoryCreateMany = vi.fn();
const mockHistoryFindMany = vi.fn();
const mockContractFindMany = vi.fn();
const mockLinkFindMany = vi.fn();
const mockOther = vi.fn(); // nothing but pieces/history may be written

const client = {
  contractBoqPiece: {
    findMany: mockPieceFindMany,
    count: mockPieceCount,
    groupBy: mockPieceGroupBy,
    updateMany: mockPieceUpdateMany,
    findUnique: mockPieceFindUnique,
  },
  contractBoqPieceStatusHistory: { createMany: mockHistoryCreateMany, findMany: mockHistoryFindMany },
  technicalDrawingGroupPiece: { findMany: mockLinkFindMany },
  contract: { findMany: mockContractFindMany, update: mockOther },
  contractBoqDrawingConfirmation: { update: mockOther, updateMany: mockOther },
  contractBoqItem: { update: mockOther, updateMany: mockOther },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(client)),
};
const db = { getClient: () => client } as unknown as DatabaseService;

const actor = (permissions: string[]): AuthUser => ({ id: 'u1', displayName: 'Prod', permissions }) as unknown as AuthUser;
const PRODUCER = actor(['production.read', 'production.update']);
const VIEWER = actor(['production.read']);
const NO_ACCESS = actor(['contracts.read']);
const ADMIN = actor(['production.read', 'production.update', 'production.manage', 'contracts.manage']);

const piece = (id: string, status: P) => ({ id, pieceCode: `HC-001-${id}`, currentStatus: status, isCancelled: status === P.CANCELLED });

let service: ProductionPiecesService;
beforeEach(() => {
  vi.clearAllMocks();
  mockPieceUpdateMany.mockImplementation(async (args: { where: { id: { in: string[] } } }) => ({ count: args.where.id.in.length }));
  mockLinkFindMany.mockImplementation(async (args: { where: { pieceId: { in: string[] } } }) =>
    args.where.pieceId.in.map((pieceId) => ({ pieceId, activeSlot: 1, group: { status: 'RELEASED_TO_PRODUCTION' } })),
  );
  service = new ProductionPiecesService(db);
});

describe('production status rules', () => {
  it('Production may set In Production, Produced, Hold and Rejected — nothing else', () => {
    expect(productionAllowedPieceStatuses(['production.update'])).toEqual([P.IN_PRODUCTION, P.PRODUCED, P.ON_HOLD, P.REJECTED]);
    const allowed = productionAllowedPieceStatuses(['production.update']);
    for (const blocked of [P.DRAWING_READY, P.IN_STORE, P.DELIVERED, P.ERECTED, P.COMPLETED, P.CANCELLED]) {
      expect(allowed).not.toContain(blocked);
    }
  });
  it('read-only users get no update statuses, and the manager/admin override does not widen the Production list', () => {
    expect(productionAllowedPieceStatuses(['production.read'])).toEqual([]);
    expect(productionAllowedPieceStatuses(['production.manage', 'contracts.manage'])).toEqual([P.IN_PRODUCTION, P.PRODUCED, P.ON_HOLD, P.REJECTED]);
  });
});

describe('parseProductionStatuses', () => {
  it('defaults to Ready for Production + In Production', () => {
    expect(parseProductionStatuses(undefined)).toEqual([P.DRAWING_READY, P.IN_PRODUCTION]);
    expect(PRODUCTION_DEFAULT_STATUSES).toEqual([P.DRAWING_READY, P.IN_PRODUCTION]);
  });
  it('accepts valid Production statuses and ignores others (e.g. Delivered)', () => {
    expect(parseProductionStatuses('PRODUCED,ON_HOLD')).toEqual([P.PRODUCED, P.ON_HOLD]);
    expect(parseProductionStatuses('DELIVERED,ERECTED')).toEqual([P.DRAWING_READY, P.IN_PRODUCTION]);
  });
});

describe('ProductionPiecesService.list', () => {
  it('fetches pieces; the default filter is Drawing Ready + In Production and cancelled pieces are never listed', async () => {
    mockPieceFindMany.mockResolvedValue([{ id: 'a' }]);
    mockPieceCount.mockResolvedValue(1);
    const result = await service.list({}, VIEWER);
    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 50 });
    const where = mockPieceFindMany.mock.calls[0]?.[0].where;
    expect(where.currentStatus).toEqual({ in: [P.DRAWING_READY, P.IN_PRODUCTION] });
    expect(where.isCancelled).toBe(false);
  });

  it('applies the status, contract, drawing, BOQ item and search filters', async () => {
    mockPieceFindMany.mockResolvedValue([]);
    mockPieceCount.mockResolvedValue(0);
    await service.list({ statuses: 'PRODUCED', contractId: 'c1', drawingNo: 'HC', boqItem: 'Slab', search: 'abc' }, VIEWER);
    const where = mockPieceFindMany.mock.calls[0]?.[0].where;
    expect(where.currentStatus).toEqual({ in: [P.PRODUCED] });
    expect(where.contractId).toBe('c1');
    expect(where.drawingNo).toMatchObject({ contains: 'HC' });
    expect(where.boqItem).toMatchObject({ description: { contains: 'Slab' } });
    expect(where.OR).toHaveLength(5);
  });

  it('needs production access', async () => {
    await expect(service.list({}, NO_ACCESS)).rejects.toThrow(ForbiddenException);
  });
});

describe('summary', () => {
  it('counts Ready, In Production, Produced and Hold/Rejected', () => {
    expect(
      buildProductionSummary([
        { currentStatus: P.DRAWING_READY, count: 40 },
        { currentStatus: P.IN_PRODUCTION, count: 5 },
        { currentStatus: P.PRODUCED, count: 3 },
        { currentStatus: P.ON_HOLD, count: 1 },
        { currentStatus: P.REJECTED, count: 1 },
        { currentStatus: P.DELIVERED, count: 9 },
      ]),
    ).toEqual({ readyForProduction: 40, inProduction: 5, produced: 3, onHoldOrRejected: 2 });
  });

  it('counts update after a status change (Ready 50 → Ready 40 + In Production 10)', () => {
    const before = buildProductionSummary([{ currentStatus: P.DRAWING_READY, count: 50 }]);
    const after = buildProductionSummary([
      { currentStatus: P.DRAWING_READY, count: 40 },
      { currentStatus: P.IN_PRODUCTION, count: 10 },
    ]);
    expect(before).toMatchObject({ readyForProduction: 50, inProduction: 0 });
    expect(after).toMatchObject({ readyForProduction: 40, inProduction: 10 });
  });

  it('reads from the piece table, excluding cancelled pieces', async () => {
    mockPieceGroupBy.mockResolvedValue([{ currentStatus: P.DRAWING_READY, _count: { _all: 7 } }]);
    const result = await service.summary(VIEWER);
    expect(result.readyForProduction).toBe(7);
    expect(mockPieceGroupBy.mock.calls[0]?.[0].where).toEqual({ isCancelled: false });
  });

  it('shows the empty state numbers when nothing is ready', async () => {
    mockPieceGroupBy.mockResolvedValue([]);
    expect(await service.summary(VIEWER)).toEqual({ readyForProduction: 0, inProduction: 0, produced: 0, onHoldOrRejected: 0 });
  });
});

describe('contractProgress (FMP-UI-32)', () => {
  const contractRef: { referenceNumber: string; jobOrder: string | null; title: string } = { referenceNumber: 'CT-1', jobOrder: 'JO-1', title: 'Tower A' };
  const row = (contractId: string, status: P, updatedAt: string, contract = contractRef) => ({
    contractId, currentStatus: status, updatedAt: new Date(updatedAt), contract,
  });

  it('needs production access', async () => {
    await expect(service.contractProgress(NO_ACCESS)).rejects.toThrow(ForbiddenException);
  });

  it('groups pieces by contract, counting each status into its own field (Hold and Rejected kept separate)', async () => {
    mockPieceFindMany.mockResolvedValue([
      row('c1', P.DRAWING_READY, '2026-01-01T00:00:00Z'),
      row('c1', P.DRAWING_READY, '2026-01-01T00:00:00Z'),
      row('c1', P.IN_PRODUCTION, '2026-01-02T00:00:00Z'),
      row('c1', P.PRODUCED, '2026-01-01T00:00:00Z'),
      row('c1', P.ON_HOLD, '2026-01-01T00:00:00Z'),
      row('c1', P.REJECTED, '2026-01-01T00:00:00Z'),
    ]);

    const [result] = await service.contractProgress(VIEWER);

    expect(result).toMatchObject({
      contractId: 'c1', referenceNumber: 'CT-1', jobOrder: 'JO-1', projectName: 'Tower A',
      readyForProduction: 2, inProduction: 1, produced: 1, onHold: 1, rejected: 1,
    });
  });

  it('never queries cancelled pieces', async () => {
    mockPieceFindMany.mockResolvedValue([]);
    await service.contractProgress(VIEWER);
    expect(mockPieceFindMany.mock.calls[0]?.[0].where).toEqual({ isCancelled: false });
  });

  it('keeps separate contracts as separate entries', async () => {
    mockPieceFindMany.mockResolvedValue([
      row('c1', P.DRAWING_READY, '2026-01-01T00:00:00Z'),
      row('c2', P.PRODUCED, '2026-01-01T00:00:00Z', { referenceNumber: 'CT-2', jobOrder: null, title: 'Warehouse' }),
    ]);

    const result = await service.contractProgress(VIEWER);

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.contractId === 'c2')).toMatchObject({ referenceNumber: 'CT-2', jobOrder: null, produced: 1 });
  });

  it('lastUpdatedAt is the latest updatedAt among that contract\'s own pieces', async () => {
    mockPieceFindMany.mockResolvedValue([
      row('c1', P.DRAWING_READY, '2026-01-01T00:00:00Z'),
      row('c1', P.IN_PRODUCTION, '2026-03-15T00:00:00Z'),
      row('c1', P.PRODUCED, '2026-02-01T00:00:00Z'),
    ]);

    const [result] = await service.contractProgress(VIEWER);

    expect(result!.lastUpdatedAt).toBe('2026-03-15T00:00:00.000Z');
  });
});

describe('recentUpdates (FMP-UI-32)', () => {
  it('needs production access', async () => {
    await expect(service.recentUpdates(NO_ACCESS)).rejects.toThrow(ForbiddenException);
  });

  it('maps real history rows into a flat, dashboard-ready shape', async () => {
    mockHistoryFindMany.mockResolvedValue([
      {
        id: 'h1', newStatus: P.PRODUCED, createdAt: new Date('2026-03-01T00:00:00Z'),
        updatedByUser: { displayName: 'Prod User' },
        piece: { pieceCode: 'HC-001-1', contract: { id: 'c1', referenceNumber: 'CT-1', jobOrder: 'JO-1', title: 'Tower A' } },
      },
    ]);

    const [result] = await service.recentUpdates(VIEWER);

    expect(result).toEqual({
      id: 'h1', pieceCode: 'HC-001-1', newStatus: P.PRODUCED,
      contractId: 'c1', referenceNumber: 'CT-1', jobOrder: 'JO-1', projectName: 'Tower A',
      createdAt: '2026-03-01T00:00:00.000Z', updatedByName: 'Prod User',
    });
  });

  it('is null, not a crash, when the update has no real actor on record', async () => {
    mockHistoryFindMany.mockResolvedValue([
      {
        id: 'h1', newStatus: P.ON_HOLD, createdAt: new Date('2026-03-01T00:00:00Z'),
        updatedByUser: null,
        piece: { pieceCode: 'HC-002-1', contract: { id: 'c2', referenceNumber: 'CT-2', jobOrder: null, title: 'Warehouse' } },
      },
    ]);

    const [result] = await service.recentUpdates(VIEWER);

    expect(result!.updatedByName).toBeNull();
  });

  it('caps at the requested limit, newest first', async () => {
    mockHistoryFindMany.mockResolvedValue([]);
    await service.recentUpdates(VIEWER, 5);
    expect(mockHistoryFindMany.mock.calls[0]?.[0]).toMatchObject({ orderBy: { createdAt: 'desc' }, take: 5 });
  });
});

describe('ProductionPiecesService status updates', () => {
  it('bulk update to Produced works and writes a history row for every piece, across jobs', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.IN_PRODUCTION), piece('b', P.IN_PRODUCTION)]);
    const result = await service.bulkUpdateStatus(['a', 'b'], 'PRODUCED', 'Produced today', PRODUCER);
    expect(result).toMatchObject({ updatedCount: 2, skippedCount: 0, message: 'Pieces updated.' });
    // Not limited to one contract: Production sees pieces from every job.
    expect(mockPieceFindMany.mock.calls[0]?.[0].where).toEqual({ id: { in: ['a', 'b'] } });
    const history = mockHistoryCreateMany.mock.calls[0]?.[0].data as { pieceId: string; oldStatus: P; newStatus: P; note: string; updatedById: string }[];
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ oldStatus: P.IN_PRODUCTION, newStatus: P.PRODUCED, note: 'Produced today', updatedById: 'u1' });
  });

  it('skips cancelled pieces and same-status pieces', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.CANCELLED), piece('b', P.PRODUCED), piece('c', P.IN_PRODUCTION)]);
    const result = await service.bulkUpdateStatus(['a', 'b', 'c'], 'PRODUCED', undefined, PRODUCER);
    expect(result.updatedCount).toBe(1);
    expect(result.skipped.map((s) => s.reason).sort()).toEqual(['CANCELLED', 'SAME_STATUS']);
    expect(mockHistoryCreateMany.mock.calls[0]?.[0].data).toHaveLength(1);
  });

  it.each(['DRAWING_READY', 'IN_STORE', 'DELIVERED', 'ERECTED', 'COMPLETED', 'CANCELLED'] as const)(
    'Production cannot set %s — blocked with the simple message and nothing is written',
    async (status) => {
      const result = await service.bulkUpdateStatus(['a'], status, undefined, PRODUCER);
      expect(result).toMatchObject({ updatedCount: 0, skippedCount: 1, message: 'You cannot update pieces to this status.' });
      expect(mockPieceFindMany).not.toHaveBeenCalled();
      expect(mockHistoryCreateMany).not.toHaveBeenCalled();
    },
  );

  it.each(['IN_PRODUCTION', 'PRODUCED', 'ON_HOLD', 'REJECTED'] as const)('Production can set %s', async (status) => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.DRAWING_READY)]);
    const result = await service.bulkUpdateStatus(['a'], status, undefined, PRODUCER);
    expect(result.updatedCount).toBe(1);
  });

  it('even the admin override stays inside the Production statuses on this screen', async () => {
    const result = await service.bulkUpdateStatus(['a'], 'DELIVERED', undefined, ADMIN);
    expect(result.message).toBe('You cannot update pieces to this status.');
  });

  it('a read-only user can view but cannot update', async () => {
    mockPieceFindMany.mockResolvedValue([]);
    mockPieceCount.mockResolvedValue(0);
    await expect(service.list({}, VIEWER)).resolves.toBeDefined();
    expect(service.allowedStatuses(VIEWER).statuses).toEqual([]);
    await expect(service.bulkUpdateStatus(['a'], 'PRODUCED', undefined, VIEWER)).rejects.toThrow(ForbiddenException);
  });

  it('asks for at least one piece', async () => {
    await expect(service.bulkUpdateStatus([], 'PRODUCED', undefined, PRODUCER)).rejects.toThrow(UnprocessableEntityException);
  });

  it('creates no records other than piece status and history', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.DRAWING_READY)]);
    await service.bulkUpdateStatus(['a'], 'IN_PRODUCTION', undefined, PRODUCER);
    expect(mockOther).not.toHaveBeenCalled();
  });
});

describe('history', () => {
  it('returns the piece history newest first', async () => {
    mockPieceFindUnique.mockResolvedValue({ id: 'a', pieceCode: 'HC-001-001' });
    mockHistoryFindMany.mockResolvedValue([]);
    const result = await service.history('a', VIEWER);
    expect(result.pieceCode).toBe('HC-001-001');
    expect(mockHistoryFindMany.mock.calls[0]?.[0].orderBy).toEqual({ createdAt: 'desc' });
  });
  it('404s for an unknown piece', async () => {
    mockPieceFindUnique.mockResolvedValue(null);
    await expect(service.history('x', VIEWER)).rejects.toThrow(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// FMP-BOQ-14 — Production needs the Technical release
// ---------------------------------------------------------------------------

type LinkSpec = { status: string; active?: boolean };
function groups(map: Record<string, LinkSpec[]>): void {
  mockLinkFindMany.mockImplementation(async () =>
    Object.entries(map).flatMap(([pieceId, specs]) =>
      specs.map((l) => ({ pieceId, activeSlot: l.active === false ? null : 1, group: { status: l.status } })),
    ),
  );
}

describe('release is required for In Production / Produced', () => {
  it.each(['IN_PRODUCTION', 'PRODUCED'] as const)('a released piece can move to %s', async (status) => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.DRAWING_READY)]);
    groups({ a: [{ status: 'RELEASED_TO_PRODUCTION' }] });
    const r = await service.bulkUpdateStatus(['a'], status, undefined, PRODUCER);
    expect(r).toMatchObject({ updatedCount: 1, skippedCount: 0 });
    expect(mockHistoryCreateMany).toHaveBeenCalledTimes(1);
  });

  it.each(['IN_PRODUCTION', 'PRODUCED'] as const)('a piece with no group cannot move to %s', async (status) => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.DRAWING_READY)]);
    groups({});
    const r = await service.bulkUpdateStatus(['a'], status, undefined, PRODUCER);
    expect(r).toMatchObject({ updatedCount: 0, skippedCount: 1, message: 'No drawing group assigned.' });
    expect(r.skipped[0]?.reason).toBe('NO_GROUP');
    expect(mockPieceUpdateMany).not.toHaveBeenCalled();
    expect(mockHistoryCreateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['DRAFT', 'IN_PRODUCTION'],
    ['SUBMITTED', 'PRODUCED'],
    ['APPROVED', 'PRODUCED'],
    ['APPROVED', 'IN_PRODUCTION'],
  ] as const)('a piece in a %s group cannot move to %s', async (groupStatus, target) => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.DRAWING_READY)]);
    groups({ a: [{ status: groupStatus }] });
    const r = await service.bulkUpdateStatus(['a'], target, undefined, PRODUCER);
    expect(r).toMatchObject({ updatedCount: 0, message: 'Drawing group is not released to Production.' });
    expect(mockHistoryCreateMany).not.toHaveBeenCalled();
  });

  it('a piece whose group was cancelled cannot move to In Production', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.DRAWING_READY)]);
    groups({ a: [{ status: 'CANCELLED', active: false }] });
    const r = await service.bulkUpdateStatus(['a'], 'IN_PRODUCTION', undefined, PRODUCER);
    expect(r.message).toBe('Drawing group is not released to Production.');
  });

  it('a piece re-grouped after a cancel uses its current (active) group', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.DRAWING_READY)]);
    groups({ a: [{ status: 'CANCELLED', active: false }, { status: 'RELEASED_TO_PRODUCTION' }] });
    expect((await service.bulkUpdateStatus(['a'], 'PRODUCED', undefined, PRODUCER)).updatedCount).toBe(1);
  });

  it.each(['ON_HOLD', 'REJECTED'] as const)('an unreleased piece (or one with no group) can still be set to %s', async (status) => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.DRAWING_READY), piece('b', P.DRAWING_READY)]);
    groups({ a: [{ status: 'DRAFT' }] });
    const r = await service.bulkUpdateStatus(['a', 'b'], status, undefined, PRODUCER);
    expect(r).toMatchObject({ updatedCount: 2, skippedCount: 0 });
    // Hold / Rejected never even look at the groups
    expect(mockLinkFindMany).not.toHaveBeenCalled();
  });

  it('bulk: updates released pieces, skips the rest with simple reasons, history only for updated', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.DRAWING_READY), piece('b', P.DRAWING_READY), piece('c', P.DRAWING_READY)]);
    groups({ a: [{ status: 'RELEASED_TO_PRODUCTION' }], b: [{ status: 'SUBMITTED' }] });
    const r = await service.bulkUpdateStatus(['a', 'b', 'c'], 'IN_PRODUCTION', 'Start', PRODUCER);
    expect(r).toMatchObject({ updatedCount: 1, skippedCount: 2, message: '1 piece updated. 2 pieces skipped.' });
    expect(r.skipped.map((s) => s.message).sort()).toEqual(['Drawing group is not released to Production.', 'No drawing group assigned.']);
    const history = mockHistoryCreateMany.mock.calls.flatMap((c) => c[0].data as { pieceId: string }[]);
    expect(history.map((h) => h.pieceId)).toEqual(['a']);
  });

  it('cancelled and same-status skips still apply first', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.CANCELLED), piece('b', P.IN_PRODUCTION)]);
    groups({});
    const r = await service.bulkUpdateStatus(['a', 'b'], 'IN_PRODUCTION', undefined, PRODUCER);
    expect(r.skipped.map((s) => s.reason).sort()).toEqual(['CANCELLED', 'SAME_STATUS']);
  });
});
