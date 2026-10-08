import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ContractBoqPieceStatus as P } from '@recafco/database';
import {
  StorageDeliveryPiecesService,
  parseStorageStatuses,
  buildStorageSummary,
  STORAGE_DEFAULT_STATUSES,
} from './storage-delivery-pieces.service';
import { storageDeliveryAllowedPieceStatuses } from '../technical/boq-piece-generation';
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

const actor = (permissions: string[]): AuthUser => ({ id: 'u1', displayName: 'Store', permissions }) as unknown as AuthUser;
const STOREKEEPER = actor(['storage_delivery.read', 'storage_delivery.update']);
const VIEWER = actor(['storage_delivery.read']);
const NO_ACCESS = actor(['contracts.read', 'production.read']);
const ADMIN = actor(['storage_delivery.read', 'storage_delivery.update', 'contracts.manage', 'production.manage']);

const piece = (id: string, status: P) => ({ id, pieceCode: `HC-001-${id}`, currentStatus: status, isCancelled: status === P.CANCELLED });

let service: StorageDeliveryPiecesService;
beforeEach(() => {
  vi.clearAllMocks();
  mockPieceUpdateMany.mockImplementation(async (args: { where: { id: { in: string[] } } }) => ({ count: args.where.id.in.length }));
  service = new StorageDeliveryPiecesService(db);
});

describe('storage & delivery status rules', () => {
  it('may set In Store, Delivered, Hold and Rejected — nothing else', () => {
    const allowed = storageDeliveryAllowedPieceStatuses(['storage_delivery.update']);
    expect(allowed).toEqual([P.IN_STORE, P.DELIVERED, P.ON_HOLD, P.REJECTED]);
    for (const blocked of [P.DRAWING_READY, P.IN_PRODUCTION, P.PRODUCED, P.ERECTED, P.COMPLETED, P.CANCELLED]) {
      expect(allowed).not.toContain(blocked);
    }
  });
  it('read-only users get none, and the admin override does not widen the list', () => {
    expect(storageDeliveryAllowedPieceStatuses(['storage_delivery.read'])).toEqual([]);
    expect(storageDeliveryAllowedPieceStatuses(ADMIN.permissions)).toEqual([P.IN_STORE, P.DELIVERED, P.ON_HOLD, P.REJECTED]);
  });
});

describe('parseStorageStatuses', () => {
  it('defaults to Produced + In Store', () => {
    expect(parseStorageStatuses(undefined)).toEqual([P.PRODUCED, P.IN_STORE]);
    expect(STORAGE_DEFAULT_STATUSES).toEqual([P.PRODUCED, P.IN_STORE]);
  });
  it('accepts its own statuses and ignores others (Drawing Ready, Erected …)', () => {
    expect(parseStorageStatuses('DELIVERED,ON_HOLD')).toEqual([P.DELIVERED, P.ON_HOLD]);
    expect(parseStorageStatuses('DRAWING_READY,ERECTED')).toEqual([P.PRODUCED, P.IN_STORE]);
  });
});

describe('StorageDeliveryPiecesService.list', () => {
  it('fetches pieces; the default filter is Produced + In Store and cancelled pieces are never listed', async () => {
    mockPieceFindMany.mockResolvedValue([{ id: 'a' }]);
    mockPieceCount.mockResolvedValue(1);
    const result = await service.list({}, VIEWER);
    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 50 });
    const where = mockPieceFindMany.mock.calls[0]?.[0].where;
    expect(where.currentStatus).toEqual({ in: [P.PRODUCED, P.IN_STORE] });
    expect(where.isCancelled).toBe(false);
    // The list carries the current location for the Location column.
    expect(mockPieceFindMany.mock.calls[0]?.[0].select.currentLocation).toBe(true);
  });

  it('needs storage & delivery access (production or contract access is not enough)', async () => {
    await expect(service.list({}, NO_ACCESS)).rejects.toThrow(ForbiddenException);
  });
});

describe('summary', () => {
  it('counts Ready for Store (= Produced), In Store, Delivered and Hold/Rejected', () => {
    expect(
      buildStorageSummary([
        { currentStatus: P.PRODUCED, count: 12 },
        { currentStatus: P.IN_STORE, count: 5 },
        { currentStatus: P.DELIVERED, count: 3 },
        { currentStatus: P.ON_HOLD, count: 1 },
        { currentStatus: P.REJECTED, count: 2 },
        { currentStatus: P.DRAWING_READY, count: 99 },
      ]),
    ).toEqual({ readyForStore: 12, inStore: 5, delivered: 3, onHoldOrRejected: 3 });
  });

  it('counts update after a status change (Produced 10 → Produced 6 + In Store 4)', () => {
    expect(buildStorageSummary([{ currentStatus: P.PRODUCED, count: 10 }])).toMatchObject({ readyForStore: 10, inStore: 0 });
    expect(
      buildStorageSummary([
        { currentStatus: P.PRODUCED, count: 6 },
        { currentStatus: P.IN_STORE, count: 4 },
      ]),
    ).toMatchObject({ readyForStore: 6, inStore: 4 });
  });

  it('reads the piece table, excluding cancelled pieces; empty gives zeros', async () => {
    mockPieceGroupBy.mockResolvedValue([]);
    expect(await service.summary(VIEWER)).toEqual({ readyForStore: 0, inStore: 0, delivered: 0, onHoldOrRejected: 0 });
    expect(mockPieceGroupBy.mock.calls[0]?.[0].where).toEqual({ isCancelled: false });
  });
});

describe('contractProgress (FMP-UI-33)', () => {
  const contractRef: { referenceNumber: string; jobOrder: string | null; title: string } = { referenceNumber: 'CT-1', jobOrder: 'JO-1', title: 'Tower A' };
  const row = (contractId: string, status: P, updatedAt: string, contract = contractRef) => ({
    contractId, currentStatus: status, updatedAt: new Date(updatedAt), contract,
  });

  it('needs storage_delivery.read', async () => {
    await expect(service.contractProgress(NO_ACCESS)).rejects.toThrow(ForbiddenException);
  });

  it('groups pieces by contract, counting each status into its own field (Hold and Rejected kept separate)', async () => {
    mockPieceFindMany.mockResolvedValue([
      row('c1', P.PRODUCED, '2026-01-01T00:00:00Z'),
      row('c1', P.PRODUCED, '2026-01-01T00:00:00Z'),
      row('c1', P.IN_STORE, '2026-01-02T00:00:00Z'),
      row('c1', P.DELIVERED, '2026-01-01T00:00:00Z'),
      row('c1', P.ON_HOLD, '2026-01-01T00:00:00Z'),
      row('c1', P.REJECTED, '2026-01-01T00:00:00Z'),
    ]);

    const [result] = await service.contractProgress(VIEWER);

    expect(result).toMatchObject({
      contractId: 'c1', referenceNumber: 'CT-1', jobOrder: 'JO-1', projectName: 'Tower A',
      readyForStore: 2, inStore: 1, delivered: 1, onHold: 1, rejected: 1,
    });
  });

  it('never queries cancelled pieces', async () => {
    mockPieceFindMany.mockResolvedValue([]);
    await service.contractProgress(VIEWER);
    expect(mockPieceFindMany.mock.calls[0]?.[0].where).toEqual({ isCancelled: false });
  });

  it('keeps separate contracts as separate entries', async () => {
    mockPieceFindMany.mockResolvedValue([
      row('c1', P.PRODUCED, '2026-01-01T00:00:00Z'),
      row('c2', P.DELIVERED, '2026-01-01T00:00:00Z', { referenceNumber: 'CT-2', jobOrder: null, title: 'Warehouse' }),
    ]);

    const result = await service.contractProgress(VIEWER);

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.contractId === 'c2')).toMatchObject({ referenceNumber: 'CT-2', jobOrder: null, delivered: 1 });
  });

  it('lastUpdatedAt is the latest updatedAt among that contract\'s own pieces', async () => {
    mockPieceFindMany.mockResolvedValue([
      row('c1', P.PRODUCED, '2026-01-01T00:00:00Z'),
      row('c1', P.IN_STORE, '2026-03-15T00:00:00Z'),
      row('c1', P.DELIVERED, '2026-02-01T00:00:00Z'),
    ]);

    const [result] = await service.contractProgress(VIEWER);

    expect(result!.lastUpdatedAt).toBe('2026-03-15T00:00:00.000Z');
  });
});

describe('recentUpdates (FMP-UI-33)', () => {
  it('needs storage_delivery.read', async () => {
    await expect(service.recentUpdates(NO_ACCESS)).rejects.toThrow(ForbiddenException);
  });

  it('maps real history rows into a flat, dashboard-ready shape, including the piece\'s current location', async () => {
    mockHistoryFindMany.mockResolvedValue([
      {
        id: 'h1', newStatus: P.DELIVERED, createdAt: new Date('2026-03-01T00:00:00Z'),
        updatedByUser: { displayName: 'Store User' },
        piece: { pieceCode: 'HC-001-1', currentLocation: 'Yard B3', contract: { id: 'c1', referenceNumber: 'CT-1', jobOrder: 'JO-1', title: 'Tower A' } },
      },
    ]);

    const [result] = await service.recentUpdates(VIEWER);

    expect(result).toEqual({
      id: 'h1', pieceCode: 'HC-001-1', newStatus: P.DELIVERED,
      contractId: 'c1', referenceNumber: 'CT-1', jobOrder: 'JO-1', projectName: 'Tower A',
      currentLocation: 'Yard B3', createdAt: '2026-03-01T00:00:00.000Z', updatedByName: 'Store User',
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

describe('StorageDeliveryPiecesService status updates', () => {
  it('bulk update to In Store works and writes a history row for every piece', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.PRODUCED), piece('b', P.PRODUCED)]);
    const result = await service.bulkUpdateStatus(['a', 'b'], 'IN_STORE', 'Received', undefined, STOREKEEPER);
    expect(result).toMatchObject({ updatedCount: 2, skippedCount: 0, message: 'Pieces updated.' });
    const history = mockHistoryCreateMany.mock.calls[0]?.[0].data as { oldStatus: P; newStatus: P; note: string; updatedById: string }[];
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ oldStatus: P.PRODUCED, newStatus: P.IN_STORE, note: 'Received', updatedById: 'u1' });
  });

  it('bulk update to Delivered works and writes history', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.IN_STORE)]);
    const result = await service.bulkUpdateStatus(['a'], 'DELIVERED', undefined, undefined, STOREKEEPER);
    expect(result.updatedCount).toBe(1);
    expect(mockHistoryCreateMany.mock.calls[0]?.[0].data[0]).toMatchObject({ oldStatus: P.IN_STORE, newStatus: P.DELIVERED });
  });

  it('skips cancelled pieces and same-status pieces', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.CANCELLED), piece('b', P.IN_STORE), piece('c', P.PRODUCED)]);
    const result = await service.bulkUpdateStatus(['a', 'b', 'c'], 'IN_STORE', undefined, undefined, STOREKEEPER);
    expect(result.updatedCount).toBe(1);
    expect(result.skipped.map((s) => s.reason).sort()).toEqual(['CANCELLED', 'SAME_STATUS']);
  });

  it.each(['DRAWING_READY', 'IN_PRODUCTION', 'PRODUCED', 'ERECTED', 'COMPLETED', 'CANCELLED'] as const)(
    'cannot set %s — blocked with the simple message and nothing is written',
    async (status) => {
      const result = await service.bulkUpdateStatus(['a'], status, undefined, undefined, STOREKEEPER);
      expect(result).toMatchObject({ updatedCount: 0, skippedCount: 1, message: 'You cannot update pieces to this status.' });
      expect(mockPieceFindMany).not.toHaveBeenCalled();
      expect(mockHistoryCreateMany).not.toHaveBeenCalled();
    },
  );

  it.each(['IN_STORE', 'DELIVERED', 'ON_HOLD', 'REJECTED'] as const)('can set %s', async (status) => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.PRODUCED)]);
    expect((await service.bulkUpdateStatus(['a'], status, undefined, undefined, STOREKEEPER)).updatedCount).toBe(1);
  });

  it('even the admin override stays inside the Storage Yard & Delivery statuses', async () => {
    const result = await service.bulkUpdateStatus(['a'], 'ERECTED', undefined, undefined, ADMIN);
    expect(result.message).toBe('You cannot update pieces to this status.');
  });

  it('a read-only user can view but cannot update', async () => {
    mockPieceFindMany.mockResolvedValue([]);
    mockPieceCount.mockResolvedValue(0);
    await expect(service.list({}, VIEWER)).resolves.toBeDefined();
    expect(service.allowedStatuses(VIEWER).statuses).toEqual([]);
    await expect(service.bulkUpdateStatus(['a'], 'IN_STORE', undefined, undefined, VIEWER)).rejects.toThrow(ForbiddenException);
  });

  it('asks for at least one piece', async () => {
    await expect(service.bulkUpdateStatus([], 'IN_STORE', undefined, undefined, STOREKEEPER)).rejects.toThrow(UnprocessableEntityException);
  });

  it('creates no records other than piece status, location and history', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.PRODUCED)]);
    await service.bulkUpdateStatus(['a'], 'IN_STORE', undefined, 'Yard A', STOREKEEPER);
    expect(mockOther).not.toHaveBeenCalled();
  });
});

describe('location', () => {
  it('stores the location when moving to In Store and records it in the history note', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.PRODUCED)]);
    await service.bulkUpdateStatus(['a'], 'IN_STORE', 'Received', 'Yard A', STOREKEEPER);
    expect(mockPieceUpdateMany.mock.calls[0]?.[0].data).toEqual({ currentStatus: P.IN_STORE, currentLocation: 'Yard A' });
    expect(mockHistoryCreateMany.mock.calls[0]?.[0].data[0].note).toBe('Received · Location: Yard A');
  });

  it('stores the location when moving to Delivered (e.g. Site)', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.IN_STORE)]);
    await service.bulkUpdateStatus(['a'], 'DELIVERED', undefined, 'Site', STOREKEEPER);
    expect(mockPieceUpdateMany.mock.calls[0]?.[0].data).toEqual({ currentStatus: P.DELIVERED, currentLocation: 'Site' });
    expect(mockHistoryCreateMany.mock.calls[0]?.[0].data[0].note).toBe('Location: Site');
  });

  it('is optional, and is ignored for Hold / Rejected', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.PRODUCED)]);
    await service.bulkUpdateStatus(['a'], 'IN_STORE', undefined, undefined, STOREKEEPER);
    expect(mockPieceUpdateMany.mock.calls[0]?.[0].data).toEqual({ currentStatus: P.IN_STORE });
    mockPieceUpdateMany.mockClear();
    mockPieceFindMany.mockResolvedValue([piece('a', P.PRODUCED)]);
    await service.bulkUpdateStatus(['a'], 'ON_HOLD', undefined, 'Yard A', STOREKEEPER);
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
