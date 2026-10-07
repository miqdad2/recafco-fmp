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
