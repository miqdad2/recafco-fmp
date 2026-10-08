import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ContractBoqPieceStatus as P } from '@recafco/database';
import { ErectionPiecesService, parseErectionStatuses, buildErectionSummary, ERECTION_DEFAULT_STATUSES } from './erection-pieces.service';
import { erectionAllowedPieceStatuses } from '../technical/boq-piece-generation';
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

const actor = (permissions: string[]): AuthUser => ({ id: 'u1', displayName: 'Erector', permissions }) as unknown as AuthUser;
const ERECTOR = actor(['erection.read', 'erection.update']);
const VIEWER = actor(['erection.read']);
const NO_ACCESS = actor(['contracts.read', 'production.read', 'storage_delivery.read']);
const ADMIN = actor(['erection.read', 'erection.update', 'contracts.manage', 'production.manage']);

const piece = (id: string, status: P) => ({ id, pieceCode: `HC-001-${id}`, currentStatus: status, isCancelled: status === P.CANCELLED });

let service: ErectionPiecesService;
beforeEach(() => {
  vi.clearAllMocks();
  mockPieceUpdateMany.mockImplementation(async (args: { where: { id: { in: string[] } } }) => ({ count: args.where.id.in.length }));
  service = new ErectionPiecesService(db);
});

describe('erection status rules', () => {
  it('may set Erected, Completed, Hold and Rejected — nothing else', () => {
    const allowed = erectionAllowedPieceStatuses(['erection.update']);
    expect(allowed).toEqual([P.ERECTED, P.COMPLETED, P.ON_HOLD, P.REJECTED]);
    for (const blocked of [P.DRAWING_READY, P.IN_PRODUCTION, P.PRODUCED, P.IN_STORE, P.DELIVERED, P.CANCELLED]) {
      expect(allowed).not.toContain(blocked);
    }
  });
  it('read-only users get none, and the admin override does not widen the list', () => {
    expect(erectionAllowedPieceStatuses(['erection.read'])).toEqual([]);
    expect(erectionAllowedPieceStatuses(ADMIN.permissions)).toEqual([P.ERECTED, P.COMPLETED, P.ON_HOLD, P.REJECTED]);
  });
});

describe('parseErectionStatuses', () => {
  it('defaults to Delivered + Erected', () => {
    expect(parseErectionStatuses(undefined)).toEqual([P.DELIVERED, P.ERECTED]);
    expect(ERECTION_DEFAULT_STATUSES).toEqual([P.DELIVERED, P.ERECTED]);
  });
  it('accepts its own statuses and ignores earlier ones (Produced, In Store ...)', () => {
    expect(parseErectionStatuses('COMPLETED,ON_HOLD')).toEqual([P.COMPLETED, P.ON_HOLD]);
    expect(parseErectionStatuses('PRODUCED,IN_STORE')).toEqual([P.DELIVERED, P.ERECTED]);
  });
});

describe('ErectionPiecesService.list', () => {
  it('fetches pieces; the default filter is Delivered + Erected and cancelled pieces are never listed', async () => {
    mockPieceFindMany.mockResolvedValue([{ id: 'a' }]);
    mockPieceCount.mockResolvedValue(1);
    const result = await service.list({}, VIEWER);
    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 50 });
    const where = mockPieceFindMany.mock.calls[0]?.[0].where;
    expect(where.currentStatus).toEqual({ in: [P.DELIVERED, P.ERECTED] });
    expect(where.isCancelled).toBe(false);
    expect(mockPieceFindMany.mock.calls[0]?.[0].select.currentLocation).toBe(true);
  });

  it('needs erection access (contract, production or storage access is not enough)', async () => {
    await expect(service.list({}, NO_ACCESS)).rejects.toThrow(ForbiddenException);
  });
});

describe('summary', () => {
  it('counts Ready for Erection (= Delivered), Erected, Completed and Hold/Rejected', () => {
    expect(
      buildErectionSummary([
        { currentStatus: P.DELIVERED, count: 12 },
        { currentStatus: P.ERECTED, count: 5 },
        { currentStatus: P.COMPLETED, count: 3 },
        { currentStatus: P.ON_HOLD, count: 1 },
        { currentStatus: P.REJECTED, count: 2 },
        { currentStatus: P.IN_STORE, count: 99 },
      ]),
    ).toEqual({ readyForErection: 12, erected: 5, completed: 3, onHoldOrRejected: 3 });
  });

  it('counts update after a status change (Delivered 10 → Delivered 6 + Erected 4)', () => {
    expect(buildErectionSummary([{ currentStatus: P.DELIVERED, count: 10 }])).toMatchObject({ readyForErection: 10, erected: 0 });
    expect(
      buildErectionSummary([
        { currentStatus: P.DELIVERED, count: 6 },
        { currentStatus: P.ERECTED, count: 4 },
      ]),
    ).toMatchObject({ readyForErection: 6, erected: 4 });
  });

  it('reads the piece table, excluding cancelled pieces; empty gives zeros', async () => {
    mockPieceGroupBy.mockResolvedValue([]);
    expect(await service.summary(VIEWER)).toEqual({ readyForErection: 0, erected: 0, completed: 0, onHoldOrRejected: 0 });
    expect(mockPieceGroupBy.mock.calls[0]?.[0].where).toEqual({ isCancelled: false });
  });
});

describe('contractProgress (FMP-UI-34)', () => {
  const contractRef: { referenceNumber: string; jobOrder: string | null; title: string } = { referenceNumber: 'CT-1', jobOrder: 'JO-1', title: 'Tower A' };
  const row = (contractId: string, status: P, updatedAt: string, contract = contractRef) => ({
    contractId, currentStatus: status, updatedAt: new Date(updatedAt), contract,
  });

  it('needs erection.read', async () => {
    await expect(service.contractProgress(NO_ACCESS)).rejects.toThrow(ForbiddenException);
  });

  it('groups pieces by contract, counting each status into its own field (Hold and Rejected kept separate)', async () => {
    mockPieceFindMany.mockResolvedValue([
      row('c1', P.DELIVERED, '2026-01-01T00:00:00Z'),
      row('c1', P.DELIVERED, '2026-01-01T00:00:00Z'),
      row('c1', P.ERECTED, '2026-01-02T00:00:00Z'),
      row('c1', P.COMPLETED, '2026-01-01T00:00:00Z'),
      row('c1', P.ON_HOLD, '2026-01-01T00:00:00Z'),
      row('c1', P.REJECTED, '2026-01-01T00:00:00Z'),
    ]);

    const [result] = await service.contractProgress(VIEWER);

    expect(result).toMatchObject({
      contractId: 'c1', referenceNumber: 'CT-1', jobOrder: 'JO-1', projectName: 'Tower A',
      readyForErection: 2, erected: 1, completed: 1, onHold: 1, rejected: 1,
    });
  });

  it('never queries cancelled pieces', async () => {
    mockPieceFindMany.mockResolvedValue([]);
    await service.contractProgress(VIEWER);
    expect(mockPieceFindMany.mock.calls[0]?.[0].where).toEqual({ isCancelled: false });
  });

  it('keeps separate contracts as separate entries', async () => {
    mockPieceFindMany.mockResolvedValue([
      row('c1', P.DELIVERED, '2026-01-01T00:00:00Z'),
      row('c2', P.COMPLETED, '2026-01-01T00:00:00Z', { referenceNumber: 'CT-2', jobOrder: null, title: 'Warehouse' }),
    ]);

    const result = await service.contractProgress(VIEWER);

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.contractId === 'c2')).toMatchObject({ referenceNumber: 'CT-2', jobOrder: null, completed: 1 });
  });

  it('lastUpdatedAt is the latest updatedAt among that contract\'s own pieces', async () => {
    mockPieceFindMany.mockResolvedValue([
      row('c1', P.DELIVERED, '2026-01-01T00:00:00Z'),
      row('c1', P.ERECTED, '2026-03-15T00:00:00Z'),
      row('c1', P.COMPLETED, '2026-02-01T00:00:00Z'),
    ]);

    const [result] = await service.contractProgress(VIEWER);

    expect(result!.lastUpdatedAt).toBe('2026-03-15T00:00:00.000Z');
  });
});

describe('recentUpdates (FMP-UI-34)', () => {
  it('needs erection.read', async () => {
    await expect(service.recentUpdates(NO_ACCESS)).rejects.toThrow(ForbiddenException);
  });

  it('maps real history rows into a flat, dashboard-ready shape, including the piece\'s current location/site note', async () => {
    mockHistoryFindMany.mockResolvedValue([
      {
        id: 'h1', newStatus: P.COMPLETED, createdAt: new Date('2026-03-01T00:00:00Z'),
        updatedByUser: { displayName: 'Site User' },
        piece: { pieceCode: 'HC-001-1', currentLocation: 'Grid C4', contract: { id: 'c1', referenceNumber: 'CT-1', jobOrder: 'JO-1', title: 'Tower A' } },
      },
    ]);

    const [result] = await service.recentUpdates(VIEWER);

    expect(result).toEqual({
      id: 'h1', pieceCode: 'HC-001-1', newStatus: P.COMPLETED,
      contractId: 'c1', referenceNumber: 'CT-1', jobOrder: 'JO-1', projectName: 'Tower A',
      currentLocation: 'Grid C4', createdAt: '2026-03-01T00:00:00.000Z', updatedByName: 'Site User',
    });
  });

  it('is null, not a crash, when there is no real actor or location on record', async () => {
    mockHistoryFindMany.mockResolvedValue([
      {
        id: 'h1', newStatus: P.ON_HOLD, createdAt: new Date('2026-03-01T00:00:00Z'),
        updatedByUser: null,
        piece: { pieceCode: 'HC-002-1', currentLocation: null, contract: { id: 'c2', referenceNumber: 'CT-2', jobOrder: null, title: 'Warehouse' } },
      },
    ]);

    const [result] = await service.recentUpdates(VIEWER);

    expect(result!.updatedByName).toBeNull();
    expect(result!.currentLocation).toBeNull();
  });

  it('caps at the requested limit, newest first', async () => {
    mockHistoryFindMany.mockResolvedValue([]);
    await service.recentUpdates(VIEWER, 5);
    expect(mockHistoryFindMany.mock.calls[0]?.[0]).toMatchObject({ orderBy: { createdAt: 'desc' }, take: 5 });
  });
});

describe('ErectionPiecesService status updates', () => {
  it('bulk update to Erected works and writes a history row for every piece', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.DELIVERED), piece('b', P.DELIVERED)]);
    const result = await service.bulkUpdateStatus(['a', 'b'], 'ERECTED', 'Installed', undefined, ERECTOR);
    expect(result).toMatchObject({ updatedCount: 2, skippedCount: 0, message: 'Pieces updated.' });
    const history = mockHistoryCreateMany.mock.calls[0]?.[0].data as { oldStatus: P; newStatus: P; note: string; updatedById: string }[];
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ oldStatus: P.DELIVERED, newStatus: P.ERECTED, note: 'Installed', updatedById: 'u1' });
  });

  it('bulk update to Completed works and writes history', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.ERECTED)]);
    const result = await service.bulkUpdateStatus(['a'], 'COMPLETED', undefined, undefined, ERECTOR);
    expect(result.updatedCount).toBe(1);
    expect(mockHistoryCreateMany.mock.calls[0]?.[0].data[0]).toMatchObject({ oldStatus: P.ERECTED, newStatus: P.COMPLETED });
  });

  it('skips cancelled pieces and same-status pieces', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.CANCELLED), piece('b', P.ERECTED), piece('c', P.DELIVERED)]);
    const result = await service.bulkUpdateStatus(['a', 'b', 'c'], 'ERECTED', undefined, undefined, ERECTOR);
    expect(result.updatedCount).toBe(1);
    expect(result.skipped.map((s) => s.reason).sort()).toEqual(['CANCELLED', 'SAME_STATUS']);
  });

  it.each(['DRAWING_READY', 'IN_PRODUCTION', 'PRODUCED', 'IN_STORE', 'DELIVERED', 'CANCELLED'] as const)(
    'cannot set %s — blocked with the simple message and nothing is written',
    async (status) => {
      const result = await service.bulkUpdateStatus(['a'], status, undefined, undefined, ERECTOR);
      expect(result).toMatchObject({ updatedCount: 0, skippedCount: 1, message: 'You cannot update pieces to this status.' });
      expect(mockPieceFindMany).not.toHaveBeenCalled();
      expect(mockHistoryCreateMany).not.toHaveBeenCalled();
    },
  );

  it.each(['ERECTED', 'COMPLETED', 'ON_HOLD', 'REJECTED'] as const)('can set %s', async (status) => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.DELIVERED)]);
    expect((await service.bulkUpdateStatus(['a'], status, undefined, undefined, ERECTOR)).updatedCount).toBe(1);
  });

  it('even the admin override stays inside the Erection statuses', async () => {
    const result = await service.bulkUpdateStatus(['a'], 'DELIVERED', undefined, undefined, ADMIN);
    expect(result.message).toBe('You cannot update pieces to this status.');
  });

  it('a read-only user can view but cannot update', async () => {
    mockPieceFindMany.mockResolvedValue([]);
    mockPieceCount.mockResolvedValue(0);
    await expect(service.list({}, VIEWER)).resolves.toBeDefined();
    expect(service.allowedStatuses(VIEWER).statuses).toEqual([]);
    await expect(service.bulkUpdateStatus(['a'], 'ERECTED', undefined, undefined, VIEWER)).rejects.toThrow(ForbiddenException);
  });

  it('asks for at least one piece', async () => {
    await expect(service.bulkUpdateStatus([], 'ERECTED', undefined, undefined, ERECTOR)).rejects.toThrow(UnprocessableEntityException);
  });

  it('creates no records other than piece status, location and history (no plans, crews or inspections)', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.DELIVERED)]);
    await service.bulkUpdateStatus(['a'], 'ERECTED', undefined, 'Grid B4', ERECTOR);
    expect(mockOther).not.toHaveBeenCalled();
  });
});

describe('location / site note', () => {
  it('stores the site note when moving to Erected and records it in the history note', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.DELIVERED)]);
    await service.bulkUpdateStatus(['a'], 'ERECTED', 'Installed', 'Grid B4', ERECTOR);
    expect(mockPieceUpdateMany.mock.calls[0]?.[0].data).toEqual({ currentStatus: P.ERECTED, currentLocation: 'Grid B4' });
    expect(mockHistoryCreateMany.mock.calls[0]?.[0].data[0].note).toBe('Installed · Location: Grid B4');
  });

  it('stores it when moving to Completed', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.ERECTED)]);
    await service.bulkUpdateStatus(['a'], 'COMPLETED', undefined, 'Roof level', ERECTOR);
    expect(mockPieceUpdateMany.mock.calls[0]?.[0].data).toEqual({ currentStatus: P.COMPLETED, currentLocation: 'Roof level' });
  });

  it('is optional, and is ignored for Hold / Rejected', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.DELIVERED)]);
    await service.bulkUpdateStatus(['a'], 'ERECTED', undefined, undefined, ERECTOR);
    expect(mockPieceUpdateMany.mock.calls[0]?.[0].data).toEqual({ currentStatus: P.ERECTED });
    mockPieceUpdateMany.mockClear();
    mockPieceFindMany.mockResolvedValue([piece('a', P.DELIVERED)]);
    await service.bulkUpdateStatus(['a'], 'ON_HOLD', undefined, 'Site Area A', ERECTOR);
    expect(mockPieceUpdateMany.mock.calls[0]?.[0].data).toEqual({ currentStatus: P.ON_HOLD });
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
