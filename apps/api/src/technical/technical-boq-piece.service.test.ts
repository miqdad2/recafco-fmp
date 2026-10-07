import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ContractBoqConfirmationStatus as C, ContractBoqPieceStatus as P } from '@recafco/database';
import { TechnicalBoqPieceService, PIECES_CREATED_NOTE } from './technical-boq-piece.service';
import {
  normalizeDrawingNo,
  planPieceGeneration,
  summarizeItemPieces,
  choosePiecePrefix,
  pieceSkipReason,
  buildBulkUpdateMessage,
  allowedPieceStatuses,
  PIECE_STATUS_OWNERSHIP,
} from './boq-piece-generation';
import type { ConfirmationForGeneration } from './boq-piece-generation';
import type { DatabaseService } from '../database/database.service';
import type { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';

let idCounter = 0;
const newId = (): string => `piece-${++idCounter}`;

function conf(over: Partial<ConfirmationForGeneration> = {}): ConfirmationForGeneration {
  return {
    id: 'c1',
    boqItemId: 'item-1',
    boqItemSortOrder: 1,
    drawingNo: 'HC-001',
    confirmedPieces: 20,
    sizeOrSpecification: null,
    confirmationStatus: C.CONFIRMED,
    ...over,
  };
}

beforeEach(() => {
  idCounter = 0;
});

describe('normalizeDrawingNo', () => {
  it('makes drawing numbers safe for a piece code', () => {
    expect(normalizeDrawingNo('hc 001')).toBe('HC-001');
    expect(normalizeDrawingNo(' A/B\\C#1 ')).toBe('A-B-C-1');
    expect(normalizeDrawingNo('HC-001')).toBe('HC-001');
    expect(normalizeDrawingNo('###')).toBe('DWG');
  });
});

describe('planPieceGeneration', () => {
  it('one confirmed drawing of 20 pieces creates HC-001-001 … HC-001-020', () => {
    const planned = planPieceGeneration([conf()], [], newId);
    expect(planned).toHaveLength(20);
    expect(planned[0]?.pieceCode).toBe('HC-001-001');
    expect(planned[19]?.pieceCode).toBe('HC-001-020');
  });

  it('two confirmed drawings 20 + 30 create 50 pieces with unique codes', () => {
    const planned = planPieceGeneration(
      [conf(), conf({ id: 'c2', drawingNo: 'HC-002', confirmedPieces: 30 })],
      [],
      newId,
    );
    expect(planned).toHaveLength(50);
    expect(new Set(planned.map((p) => p.pieceCode)).size).toBe(50);
    expect(planned.some((p) => p.pieceCode === 'HC-002-030')).toBe(true);
  });

  it('does not use Draft, Revised or Cancelled rows', () => {
    for (const status of [C.DRAFT, C.REVISED, C.CANCELLED]) {
      expect(planPieceGeneration([conf({ confirmationStatus: status })], [], newId)).toHaveLength(0);
    }
  });

  it('ignores a confirmed row that has no piece count', () => {
    expect(planPieceGeneration([conf({ confirmedPieces: null })], [], newId)).toHaveLength(0);
  });

  it('running again creates nothing (no duplicates)', () => {
    const first = planPieceGeneration([conf({ confirmedPieces: 3 })], [], newId);
    const existing = first.map((p) => ({ drawingConfirmationId: p.drawingConfirmationId, pieceNo: p.pieceNo, pieceCode: p.pieceCode }));
    expect(planPieceGeneration([conf({ confirmedPieces: 3 })], existing, newId)).toHaveLength(0);
  });

  it('only adds the missing numbers if some pieces already exist', () => {
    const existing = [
      { drawingConfirmationId: 'c1', pieceNo: 1, pieceCode: 'HC-001-001' },
      { drawingConfirmationId: 'c1', pieceNo: 2, pieceCode: 'HC-001-002' },
    ];
    const planned = planPieceGeneration([conf({ confirmedPieces: 4 })], existing, newId);
    expect(planned.map((p) => p.pieceCode)).toEqual(['HC-001-003', 'HC-001-004']);
  });

  it('a revised drawing keeps old pieces; the new confirmed row gets its own unique codes', () => {
    const existing = [{ drawingConfirmationId: 'old', pieceNo: 1, pieceCode: 'HC-001-001' }];
    const planned = planPieceGeneration(
      [conf({ id: 'old', confirmationStatus: C.REVISED }), conf({ id: 'newrow-abcd1234', confirmedPieces: 2 })],
      existing,
      newId,
    );
    expect(planned).toHaveLength(2);
    expect(planned.every((p) => p.drawingConfirmationId === 'newrow-abcd1234')).toBe(true);
    expect(planned.every((p) => p.pieceCode !== 'HC-001-001')).toBe(true);
    expect(planned[0]?.pieceCode.startsWith('HC-001-1-')).toBe(true);
  });

  it('keeps codes unique when the same drawing number is used on two BOQ items', () => {
    const planned = planPieceGeneration(
      [conf({ confirmedPieces: 2 }), conf({ id: 'c2', boqItemId: 'item-2', boqItemSortOrder: 2, confirmedPieces: 2 })],
      [],
      newId,
    );
    expect(planned.map((p) => p.pieceCode)).toEqual(['HC-001-001', 'HC-001-002', 'HC-001-2-001', 'HC-001-2-002']);
  });

  it('pads piece numbers to three digits and copies size/specification', () => {
    const planned = planPieceGeneration([conf({ confirmedPieces: 1, sizeOrSpecification: '6m slab' })], [], newId);
    expect(planned[0]).toMatchObject({ pieceNo: 1, pieceCode: 'HC-001-001', sizeOrSpecification: '6m slab' });
  });

  it('never reads Contract Qty (it is not even an input) — an M² item only produces pieces from confirmed drawing pieces', () => {
    const planned = planPieceGeneration([conf({ confirmedPieces: 50 })], [], newId); // BOQ item is "500 M²"
    expect(planned).toHaveLength(50);
    expect(planPieceGeneration([], [], newId)).toHaveLength(0);
  });
});

describe('choosePiecePrefix', () => {
  it('adds the BOQ item number, then a short id, when a prefix is taken', () => {
    const owners = new Map([['HC-001', 'other']]);
    expect(choosePiecePrefix('HC-001', 3, 'abcd-1234', owners)).toBe('HC-001-3');
    owners.set('HC-001-3', 'another');
    expect(choosePiecePrefix('HC-001', 3, 'abcd-1234', owners)).toBe('HC-001-3-ABCD');
  });
});

describe('summarizeItemPieces', () => {
  const rows = [
    { id: 'c1', confirmationStatus: C.CONFIRMED, confirmedPieces: 20 },
    { id: 'c2', confirmationStatus: C.CONFIRMED, confirmedPieces: 30 },
  ];
  const group = (cid: string, status: P, count: number, isCancelled = false) => ({
    boqItemId: 'item-1',
    drawingConfirmationId: cid,
    currentStatus: status,
    isCancelled,
    count,
  });

  it('shows pieces generated per status and nothing pending when all are generated', () => {
    const s = summarizeItemPieces(50, rows, [group('c1', P.DRAWING_READY, 20), group('c2', P.DRAWING_READY, 25), group('c2', P.IN_PRODUCTION, 5)]);
    expect(s.piecesGenerated).toBe(50);
    expect(s.statusCounts).toEqual({ [P.DRAWING_READY]: 45, [P.IN_PRODUCTION]: 5 });
    expect(s.pendingPieces).toBe(0);
    expect(s.needsAttention).toBe(false);
  });

  it('before generating: everything pending, nothing generated, no attention flag', () => {
    const s = summarizeItemPieces(50, rows, []);
    expect(s).toMatchObject({ piecesGenerated: 0, pendingPieces: 50, needsAttention: false });
  });

  it('flags Needs Attention when generated pieces differ from drawing confirmed pieces', () => {
    const s = summarizeItemPieces(55, [{ id: 'c1', confirmationStatus: C.CONFIRMED, confirmedPieces: 55 }], [group('c1', P.DRAWING_READY, 50)]);
    expect(s.needsAttention).toBe(true);
    expect(s.pendingPieces).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const mockContractFindUnique = vi.fn();
const mockConfFindMany = vi.fn();
const mockPieceFindMany = vi.fn();
const mockPieceCreateMany = vi.fn();
const mockHistoryCreateMany = vi.fn();
const mockPieceUpdateMany = vi.fn();
const mockPieceFindFirst = vi.fn();
const mockHistoryFindMany = vi.fn();
const mockConfUpdate = vi.fn(); // drawing confirmations must never be written by status updates

const client = {
  contract: { findUnique: mockContractFindUnique },
  contractBoqDrawingConfirmation: { findMany: mockConfFindMany, update: mockConfUpdate, updateMany: mockConfUpdate },
  contractBoqItem: { update: mockConfUpdate, updateMany: mockConfUpdate },
  contractBoqPiece: { findMany: mockPieceFindMany, createMany: mockPieceCreateMany, updateMany: mockPieceUpdateMany, findFirst: mockPieceFindFirst },
  contractBoqPieceStatusHistory: { createMany: mockHistoryCreateMany, findMany: mockHistoryFindMany },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(client)),
};
const db = { getClient: () => client } as unknown as DatabaseService;
const deptAccess = { assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined) } as unknown as DepartmentAccessService;
const actor = (permissions: string[]): AuthUser => ({ id: 'u1', displayName: 'Tech', permissions }) as unknown as AuthUser;
const WRITER = actor(['contracts.read', 'contracts.workflow_update']);
const READER = actor(['contracts.read']);
const MANAGER = actor(['contracts.read', 'contracts.update', 'contracts.manage']); // manager/admin override

const dbRow = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  boqItemId: 'item-1',
  drawingNo: 'HC-001',
  confirmedPieces: 3,
  sizeOrSpecification: null,
  confirmationStatus: C.CONFIRMED,
  boqItem: { sortOrder: 1 },
  ...over,
});

describe('TechnicalBoqPieceService.generate', () => {
  let service: TechnicalBoqPieceService;
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindUnique.mockResolvedValue({ id: 'k1', departmentId: null });
    mockPieceFindMany.mockResolvedValue([]);
    service = new TechnicalBoqPieceService(db, deptAccess);
  });

  it('creates pieces as Drawing Ready, plus one initial history row each', async () => {
    mockConfFindMany.mockResolvedValue([dbRow()]);
    const result = await service.generate('k1', WRITER);
    expect(result).toMatchObject({ generatedCount: 3, alreadyGenerated: false, message: 'Pieces generated successfully.' });

    const pieces = mockPieceCreateMany.mock.calls[0]?.[0].data as { id: string; currentStatus: P; pieceCode: string }[];
    expect(pieces.map((p) => p.pieceCode)).toEqual(['HC-001-001', 'HC-001-002', 'HC-001-003']);
    expect(pieces.every((p) => p.currentStatus === P.DRAWING_READY)).toBe(true);

    const history = mockHistoryCreateMany.mock.calls[0]?.[0].data as { pieceId: string; oldStatus?: unknown; newStatus: P; note: string; updatedById: string }[];
    expect(history).toHaveLength(3);
    expect(history.every((h) => h.newStatus === P.DRAWING_READY && h.note === PIECES_CREATED_NOTE && h.oldStatus === undefined && h.updatedById === 'u1')).toBe(true);
    expect(new Set(history.map((h) => h.pieceId))).toEqual(new Set(pieces.map((p) => p.id)));
  });

  it('only asks for CONFIRMED drawing confirmations (never Draft/Revised/Cancelled)', async () => {
    mockConfFindMany.mockResolvedValue([dbRow()]);
    await service.generate('k1', WRITER);
    expect(mockConfFindMany.mock.calls[0]?.[0].where).toEqual({ contractId: 'k1', confirmationStatus: C.CONFIRMED });
  });

  it('is safe to run twice: nothing is created the second time', async () => {
    mockConfFindMany.mockResolvedValue([dbRow()]);
    mockPieceFindMany.mockResolvedValue([1, 2, 3].map((n) => ({ drawingConfirmationId: 'c1', pieceNo: n, pieceCode: `HC-001-00${n}` })));
    const result = await service.generate('k1', WRITER);
    expect(result).toMatchObject({ generatedCount: 0, alreadyGenerated: true, message: 'Pieces are already generated.' });
    expect(mockPieceCreateMany).not.toHaveBeenCalled();
  });

  it('treats a simultaneous second click (unique conflict) as already generated', async () => {
    mockConfFindMany.mockResolvedValue([dbRow()]);
    mockPieceCreateMany.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
    const result = await service.generate('k1', WRITER);
    expect(result.alreadyGenerated).toBe(true);
  });

  it('asks for confirmed drawing pieces first when there are none', async () => {
    mockConfFindMany.mockResolvedValue([]);
    await expect(service.generate('k1', WRITER)).rejects.toThrow('Please confirm drawing pieces before generating pieces.');
    await expect(service.generate('k1', WRITER)).rejects.toThrow(UnprocessableEntityException);
  });

  it('needs a Technical write permission', async () => {
    await expect(service.generate('k1', READER)).rejects.toThrow(ForbiddenException);
  });
});

// ---------------------------------------------------------------------------
// FMP-BOQ-05 — status updates
// ---------------------------------------------------------------------------

describe('pieceSkipReason / buildBulkUpdateMessage', () => {
  it('skips cancelled pieces and pieces already in the target status', () => {
    expect(pieceSkipReason({ currentStatus: P.CANCELLED, isCancelled: true }, P.PRODUCED)).toBe('CANCELLED');
    expect(pieceSkipReason({ currentStatus: P.DRAWING_READY, isCancelled: true }, P.PRODUCED)).toBe('CANCELLED');
    expect(pieceSkipReason({ currentStatus: P.PRODUCED, isCancelled: false }, P.PRODUCED)).toBe('SAME_STATUS');
    expect(pieceSkipReason({ currentStatus: P.DRAWING_READY, isCancelled: false }, P.PRODUCED)).toBeNull();
  });
  it('keeps Rejected pieces updatable (they stay visible and can be moved on)', () => {
    expect(pieceSkipReason({ currentStatus: P.REJECTED, isCancelled: false }, P.DRAWING_READY)).toBeNull();
  });
  it('writes the simple messages', () => {
    expect(buildBulkUpdateMessage(1, [])).toBe('Status updated.');
    expect(buildBulkUpdateMessage(10, [])).toBe('Pieces updated.');
    expect(buildBulkUpdateMessage(8, ['SAME_STATUS', 'CANCELLED'])).toBe('8 pieces updated. 2 pieces skipped.');
    expect(buildBulkUpdateMessage(1, ['CANCELLED'])).toBe('1 piece updated. 1 piece skipped.');
    expect(buildBulkUpdateMessage(0, ['SAME_STATUS'])).toBe('Piece is already in this status.');
    expect(buildBulkUpdateMessage(0, ['CANCELLED', 'SAME_STATUS'])).toBe('Some pieces were skipped.');
  });
});

describe('TechnicalBoqPieceService status updates', () => {
  let service: TechnicalBoqPieceService;
  const piece = (id: string, status: P, over: Record<string, unknown> = {}) => ({
    id,
    pieceCode: `HC-001-${id}`,
    currentStatus: status,
    isCancelled: status === P.CANCELLED,
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindUnique.mockResolvedValue({ id: 'k1', departmentId: null });
    mockPieceUpdateMany.mockImplementation(async (args: { where: { id: { in: string[] } } }) => ({ count: args.where.id.in.length }));
    service = new TechnicalBoqPieceService(db, deptAccess);
  });

  it('single update moves the piece and writes one history row with old/new status, note and user', async () => {
    mockPieceFindMany.mockResolvedValue([piece('001', P.DRAWING_READY)]);
    const result = await service.updateStatus('k1', '001', 'PRODUCED', 'Produced today', MANAGER);
    expect(result.message).toBe('Status updated.');
    expect(mockPieceUpdateMany.mock.calls[0]?.[0].data).toEqual({ currentStatus: P.PRODUCED });
    expect(mockHistoryCreateMany.mock.calls[0]?.[0].data).toEqual([
      { pieceId: '001', oldStatus: P.DRAWING_READY, newStatus: P.PRODUCED, updatedById: 'u1', note: 'Produced today' },
    ]);
  });

  it('bulk update writes a history row for every updated piece', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(3, '0'));
    mockPieceFindMany.mockResolvedValue(ids.map((id) => piece(id, P.DRAWING_READY)));
    const result = await service.bulkUpdateStatus('k1', ids, 'PRODUCED', 'Produced today', MANAGER);
    expect(result).toMatchObject({ updatedCount: 10, skippedCount: 0, message: 'Pieces updated.' });
    const history = mockHistoryCreateMany.mock.calls[0]?.[0].data as { pieceId: string; newStatus: P }[];
    expect(history).toHaveLength(10);
    expect(history.every((h) => h.newStatus === P.PRODUCED)).toBe(true);
  });

  it('bulk update keeps old statuses per piece (grouped) and reports updated and skipped counts', async () => {
    mockPieceFindMany.mockResolvedValue([
      piece('a', P.DRAWING_READY),
      piece('b', P.IN_PRODUCTION),
      piece('c', P.PRODUCED), // already in target
      piece('d', P.CANCELLED), // cancelled
    ]);
    const result = await service.bulkUpdateStatus('k1', ['a', 'b', 'c', 'd', 'zzz'], 'PRODUCED', undefined, MANAGER);
    expect(result.updatedCount).toBe(2);
    expect(result.skippedCount).toBe(3);
    expect(result.skipped.map((s) => s.reason).sort()).toEqual(['CANCELLED', 'NOT_FOUND', 'SAME_STATUS']);
    expect(result.message).toBe('2 pieces updated. 3 pieces skipped.');
    const history = mockHistoryCreateMany.mock.calls.flatMap((c) => c[0].data as { pieceId: string; oldStatus: P }[]);
    expect(history.find((h) => h.pieceId === 'a')?.oldStatus).toBe(P.DRAWING_READY);
    expect(history.find((h) => h.pieceId === 'b')?.oldStatus).toBe(P.IN_PRODUCTION);
    expect(history).toHaveLength(2);
  });

  it('only looks at pieces of this job (a piece id from another contract is skipped, never updated)', async () => {
    mockPieceFindMany.mockResolvedValue([]);
    const result = await service.bulkUpdateStatus('k1', ['other-job-piece'], 'PRODUCED', undefined, MANAGER);
    expect(mockPieceFindMany.mock.calls[0]?.[0].where).toMatchObject({ contractId: 'k1' });
    expect(result).toMatchObject({ updatedCount: 0, skippedCount: 1 });
    expect(mockPieceUpdateMany).not.toHaveBeenCalled();
    expect(mockHistoryCreateMany).not.toHaveBeenCalled();
  });

  it('same status is skipped with the plain message and writes nothing', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.PRODUCED)]);
    await expect(service.updateStatus('k1', 'a', 'PRODUCED', undefined, MANAGER)).rejects.toThrow('Piece is already in this status.');
    await expect(service.updateStatus('k1', 'a', 'PRODUCED', undefined, MANAGER)).rejects.toThrow(ConflictException);
    expect(mockHistoryCreateMany).not.toHaveBeenCalled();
  });

  it('a cancelled piece cannot be updated', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.CANCELLED)]);
    await expect(service.updateStatus('k1', 'a', 'DRAWING_READY', undefined, WRITER)).rejects.toThrow('Cancelled pieces cannot be updated.');
  });

  it('moving a piece to Cancelled marks it cancelled but never deletes it', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.DRAWING_READY)]);
    await service.updateStatus('k1', 'a', 'CANCELLED', 'Drawing withdrawn', WRITER);
    expect(mockPieceUpdateMany.mock.calls[0]?.[0].data).toEqual({ currentStatus: P.CANCELLED, isCancelled: true });
  });

  it('a piece changed by someone else in the meantime is skipped, not overwritten', async () => {
    mockPieceFindMany.mockResolvedValueOnce([piece('a', P.DRAWING_READY)]).mockResolvedValueOnce([]);
    mockPieceUpdateMany.mockResolvedValue({ count: 0 });
    const result = await service.bulkUpdateStatus('k1', ['a'], 'PRODUCED', undefined, MANAGER);
    expect(result).toMatchObject({ updatedCount: 0, skippedCount: 1 });
    expect(mockHistoryCreateMany).not.toHaveBeenCalled();
  });

  it('asks for at least one piece', async () => {
    await expect(service.bulkUpdateStatus('k1', [], 'PRODUCED', undefined, MANAGER)).rejects.toThrow('Please select at least one piece.');
  });

  it('a read-only user cannot update, but can read history', async () => {
    await expect(service.bulkUpdateStatus('k1', ['a'], 'PRODUCED', undefined, READER)).rejects.toThrow(ForbiddenException);
    await expect(service.updateStatus('k1', 'a', 'PRODUCED', undefined, READER)).rejects.toThrow(ForbiddenException);
    mockPieceFindFirst.mockResolvedValue({ id: 'a', pieceCode: 'HC-001-001' });
    mockHistoryFindMany.mockResolvedValue([]);
    await expect(service.history('k1', 'a', READER)).resolves.toBeDefined();
  });

  it('never touches Contract Qty or drawing confirmations', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.DRAWING_READY)]);
    await service.bulkUpdateStatus('k1', ['a'], 'IN_PRODUCTION', undefined, MANAGER);
    expect(mockConfUpdate).not.toHaveBeenCalled();
  });

  it('history comes back newest first with who changed it', async () => {
    mockPieceFindFirst.mockResolvedValue({ id: 'a', pieceCode: 'HC-001-001' });
    mockHistoryFindMany.mockResolvedValue([
      { id: 'h2', oldStatus: P.DRAWING_READY, newStatus: P.PRODUCED, note: 'x', createdAt: new Date(), updatedByUser: { id: 'u1', displayName: 'Tech' } },
    ]);
    const result = await service.history('k1', 'a', READER);
    expect(mockHistoryFindMany.mock.calls[0]?.[0].orderBy).toEqual({ createdAt: 'desc' });
    expect(result.pieceCode).toBe('HC-001-001');
    expect(result.history[0]?.updatedByUser?.displayName).toBe('Tech');
  });

  it('history for a piece of another job is not found', async () => {
    mockPieceFindFirst.mockResolvedValue(null);
    await expect(service.history('k1', 'x', READER)).rejects.toThrow(NotFoundException);
  });
});

describe('status summary after an update', () => {
  it('moves counts between chips; cancelled pieces show but are not counted as generated', () => {
    const conf = [{ id: 'c1', confirmationStatus: C.CONFIRMED, confirmedPieces: 50 }];
    const g = (status: P, count: number, isCancelled = false) => ({ boqItemId: 'i', drawingConfirmationId: 'c1', currentStatus: status, isCancelled, count });
    const before = summarizeItemPieces(50, conf, [g(P.DRAWING_READY, 50)]);
    const after = summarizeItemPieces(50, conf, [g(P.DRAWING_READY, 40), g(P.PRODUCED, 10)]);
    expect(before.statusCounts).toEqual({ [P.DRAWING_READY]: 50 });
    expect(after.statusCounts).toEqual({ [P.DRAWING_READY]: 40, [P.PRODUCED]: 10 });
    expect(after.piecesGenerated).toBe(50);
    expect(after.pendingPieces).toBe(0);

    const cancelled = summarizeItemPieces(50, conf, [g(P.DRAWING_READY, 49), g(P.CANCELLED, 1, true)]);
    expect(cancelled.statusCounts[P.CANCELLED]).toBe(1);
    expect(cancelled.piecesGenerated).toBe(49);
    expect(cancelled.pendingPieces).toBe(0); // cancelled pieces are not regenerated
    expect(cancelled.needsAttention).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// FMP-BOQ-06 — department-based status controls
// ---------------------------------------------------------------------------

describe('allowedPieceStatuses', () => {
  it('Technical owns Drawing Ready, Hold, Rejected, Cancelled', () => {
    expect(allowedPieceStatuses('TECHNICAL', ['contracts.workflow_update'])).toEqual([P.DRAWING_READY, P.ON_HOLD, P.REJECTED, P.CANCELLED]);
  });
  it('the other departments own their own statuses (ready for later units)', () => {
    expect(PIECE_STATUS_OWNERSHIP.PRODUCTION).toEqual([P.IN_PRODUCTION, P.PRODUCED, P.ON_HOLD, P.REJECTED]);
    expect(PIECE_STATUS_OWNERSHIP.STORAGE_DELIVERY).toEqual([P.IN_STORE, P.DELIVERED, P.ON_HOLD, P.REJECTED]);
    expect(PIECE_STATUS_OWNERSHIP.ERECTION).toEqual([P.ERECTED, P.COMPLETED, P.ON_HOLD, P.REJECTED]);
  });
  it('manager/admin override (contracts.manage) may set every status, in any department context', () => {
    for (const ctx of ['TECHNICAL', 'PRODUCTION', 'STORAGE_DELIVERY', 'ERECTION'] as const) {
      const all = allowedPieceStatuses(ctx, ['contracts.manage']);
      expect(all).toHaveLength(10);
      expect(all).toEqual(expect.arrayContaining([P.PRODUCED, P.DELIVERED, P.ERECTED, P.COMPLETED]));
      expect(all).not.toContain(P.NOT_STARTED);
    }
  });
});

describe('TechnicalBoqPieceService department status controls', () => {
  let service: TechnicalBoqPieceService;
  const piece = (id: string, status: P) => ({ id, pieceCode: `HC-001-${id}`, currentStatus: status, isCancelled: status === P.CANCELLED });

  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindUnique.mockResolvedValue({ id: 'k1', departmentId: null });
    mockPieceUpdateMany.mockImplementation(async (args: { where: { id: { in: string[] } } }) => ({ count: args.where.id.in.length }));
    mockPieceFindMany.mockResolvedValue([piece('a', P.IN_STORE)]);
    service = new TechnicalBoqPieceService(db, deptAccess);
  });

  it.each(['DRAWING_READY', 'ON_HOLD', 'REJECTED', 'CANCELLED'] as const)('a normal Technical user can set %s', async (status) => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.PRODUCED)]);
    const result = await service.bulkUpdateStatus('k1', ['a'], status, undefined, WRITER);
    expect(result).toMatchObject({ updatedCount: 1, skippedCount: 0 });
    expect(mockHistoryCreateMany).toHaveBeenCalledTimes(1);
  });

  it.each(['IN_PRODUCTION', 'PRODUCED', 'IN_STORE', 'DELIVERED', 'ERECTED', 'COMPLETED'] as const)(
    'a normal Technical user cannot set %s',
    async (status) => {
      await expect(service.updateStatus('k1', 'a', status, undefined, WRITER)).rejects.toThrow('You cannot update pieces to this status.');
      await expect(service.updateStatus('k1', 'a', status, undefined, WRITER)).rejects.toThrow(ForbiddenException);
    },
  );

  it('manager/admin override can set Produced, Delivered and Erected, and history is still written', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.DRAWING_READY)]);
    for (const status of ['PRODUCED', 'DELIVERED', 'ERECTED'] as const) {
      mockPieceFindMany.mockResolvedValue([piece('a', P.DRAWING_READY)]);
      const result = await service.bulkUpdateStatus('k1', ['a'], status, undefined, MANAGER);
      expect(result.updatedCount).toBe(1);
    }
    expect(mockHistoryCreateMany).toHaveBeenCalledTimes(3);
    expect(mockHistoryCreateMany.mock.calls[0]?.[0].data[0]).toMatchObject({ updatedById: 'u1', newStatus: P.PRODUCED });
  });

  it('a blocked bulk update returns the skipped count and the simple reason, and writes nothing', async () => {
    const result = await service.bulkUpdateStatus('k1', ['a', 'b', 'c'], 'PRODUCED', 'x', WRITER);
    expect(result).toMatchObject({ updatedCount: 0, skippedCount: 3, message: 'You cannot update pieces to this status.' });
    expect(result.skipped.every((s) => s.reason === 'NOT_ALLOWED')).toBe(true);
    expect(mockPieceFindMany).not.toHaveBeenCalled();
    expect(mockPieceUpdateMany).not.toHaveBeenCalled();
    expect(mockHistoryCreateMany).not.toHaveBeenCalled();
  });

  it('the message avoids technical wording', async () => {
    const result = await service.bulkUpdateStatus('k1', ['a'], 'ERECTED', undefined, WRITER);
    expect(result.message).not.toMatch(/forbidden|permission|denied|transition|enum/i);
  });

  it('cancelled pieces and same-status updates are still skipped for allowed statuses', async () => {
    mockPieceFindMany.mockResolvedValue([piece('a', P.CANCELLED), piece('b', P.ON_HOLD), piece('c', P.DRAWING_READY)]);
    const result = await service.bulkUpdateStatus('k1', ['a', 'b', 'c'], 'ON_HOLD', undefined, WRITER);
    expect(result.updatedCount).toBe(1);
    expect(result.skipped.map((s) => s.reason).sort()).toEqual(['CANCELLED', 'SAME_STATUS']);
    expect(mockHistoryCreateMany.mock.calls[0]?.[0].data).toHaveLength(1);
  });

  it('allowedStatuses: Technical writer gets the four Technical statuses, manager gets all, read-only gets none', () => {
    expect(service.allowedStatuses(WRITER).statuses).toEqual([P.DRAWING_READY, P.ON_HOLD, P.REJECTED, P.CANCELLED]);
    expect(service.allowedStatuses(MANAGER).statuses).toHaveLength(10);
    expect(service.allowedStatuses(READER).statuses).toEqual([]);
  });
});
