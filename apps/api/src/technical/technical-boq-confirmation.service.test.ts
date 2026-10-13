import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ContractBoqConfirmationStatus as S } from '@recafco/database';
import {
  TechnicalBoqConfirmationService,
  assertConfirmedPieces,
  sumConfirmedPieces,
} from './technical-boq-confirmation.service';
import type { DatabaseService } from '../database/database.service';
import type { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';
import type { SaveBoqDrawingConfirmationDto } from './dto/boq-drawing-confirmation.dto';

const mockContractFindUnique = vi.fn();
const mockItemFindFirst = vi.fn();
const mockItemFindMany = vi.fn();
const mockConfFindFirst = vi.fn();
const mockConfCreate = vi.fn();
const mockConfUpdate = vi.fn();
const mockPieceGroupBy = vi.fn();
const mockPieceCount = vi.fn();
const mockPieceCreate = vi.fn(); // creating elements happens only when an edit raises the number
const mockPieceFindMany = vi.fn();
const mockPieceUpdateMany = vi.fn();
const mockHistoryCreateMany = vi.fn();
const mockHistoryFindMany = vi.fn();

const client = {
  contract: { findUnique: mockContractFindUnique },
  contractBoqItem: { findFirst: mockItemFindFirst, findMany: mockItemFindMany },
  contractBoqDrawingConfirmation: { findFirst: mockConfFindFirst, create: mockConfCreate, update: mockConfUpdate },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(client)),
  contractBoqPiece: { groupBy: mockPieceGroupBy, count: mockPieceCount, create: mockPieceCreate, createMany: mockPieceCreate, findMany: mockPieceFindMany, updateMany: mockPieceUpdateMany },
  contractBoqPieceStatusHistory: { createMany: mockHistoryCreateMany, findMany: mockHistoryFindMany },
};
const db = { getClient: () => client } as unknown as DatabaseService;
const deptAccess = { assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined) } as unknown as DepartmentAccessService;

const actor = (permissions: string[]): AuthUser => ({ id: 'u1', displayName: 'Tech User', permissions }) as unknown as AuthUser;
const WRITER = actor(['contracts.read', 'contracts.workflow_update']);
const READER = actor(['contracts.read']);

const dto = (over: Partial<SaveBoqDrawingConfirmationDto> = {}): SaveBoqDrawingConfirmationDto => ({
  action: 'DRAFT',
  boqItemId: 'item-1',
  drawingNo: 'HC-001',
  ...over,
});

let service: TechnicalBoqConfirmationService;
beforeEach(() => {
  vi.clearAllMocks();
  mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
  mockItemFindFirst.mockResolvedValue({ id: 'item-1' });
  mockConfCreate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({ id: 'conf-1', ...args.data }));
  mockConfUpdate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({ id: 'conf-1', ...args.data }));
  mockPieceGroupBy.mockResolvedValue([]);
  mockPieceCount.mockResolvedValue(0);
  mockPieceFindMany.mockResolvedValue([]);
  mockHistoryFindMany.mockResolvedValue([]);
  mockConfFindFirst.mockResolvedValue(null);
  service = new TechnicalBoqConfirmationService(db, deptAccess);
});

describe('assertConfirmedPieces', () => {
  it('accepts a positive whole number', () => {
    expect(assertConfirmedPieces(50, true)).toBe(50);
  });
  it('rejects decimals', () => {
    expect(() => assertConfirmedPieces(2.5, true)).toThrow('Confirmed pieces must be a whole number.');
  });
  it('rejects zero and negatives', () => {
    expect(() => assertConfirmedPieces(0, true)).toThrow('Confirmed pieces must be more than 0.');
    expect(() => assertConfirmedPieces(-3, false)).toThrow('Confirmed pieces must be more than 0.');
  });
  it('requires a value to confirm but not to save a draft', () => {
    expect(() => assertConfirmedPieces(undefined, true)).toThrow('Please enter confirmed pieces.');
    expect(assertConfirmedPieces(undefined, false)).toBeNull();
  });
});

describe('sumConfirmedPieces', () => {
  it('sums only CONFIRMED rows, across several drawings', () => {
    expect(
      sumConfirmedPieces([
        { confirmationStatus: S.CONFIRMED, confirmedPieces: 20 },
        { confirmationStatus: S.CONFIRMED, confirmedPieces: 30 },
        { confirmationStatus: S.DRAFT, confirmedPieces: 99 },
        { confirmationStatus: S.REVISED, confirmedPieces: 10 },
        { confirmationStatus: S.CANCELLED, confirmedPieces: 5 },
      ]),
    ).toBe(50);
  });
  it('returns null (not confirmed yet) when nothing is confirmed', () => {
    expect(sumConfirmedPieces([])).toBeNull();
    expect(sumConfirmedPieces([{ confirmationStatus: S.DRAFT, confirmedPieces: 4 }])).toBeNull();
  });
});

describe('TechnicalBoqConfirmationService.create', () => {
  it('saves a draft without locking it or requiring pieces', async () => {
    const row = (await service.create('c1', dto(), WRITER)) as Record<string, unknown>;
    expect(row['confirmationStatus']).toBe(S.DRAFT);
    expect(row['confirmedPieces']).toBeUndefined();
    expect(row['confirmedAt']).toBeUndefined();
  });

  it('confirms with pieces and records who and when', async () => {
    const row = (await service.create('c1', dto({ action: 'CONFIRM', confirmedPieces: 20 }), WRITER)) as Record<string, unknown>;
    expect(row['confirmationStatus']).toBe(S.CONFIRMED);
    expect(row['confirmedPieces']).toBe(20);
    expect(row['confirmedById']).toBe('u1');
    expect(row['confirmedAt']).toBeInstanceOf(Date);
  });

  it('rejects decimal, zero, negative and missing pieces when confirming', async () => {
    await expect(service.create('c1', dto({ action: 'CONFIRM', confirmedPieces: 1.5 }), WRITER)).rejects.toThrow(/whole number/);
    await expect(service.create('c1', dto({ action: 'CONFIRM', confirmedPieces: 0 }), WRITER)).rejects.toThrow(/more than 0/);
    await expect(service.create('c1', dto({ action: 'CONFIRM', confirmedPieces: -2 }), WRITER)).rejects.toThrow(/more than 0/);
    await expect(service.create('c1', dto({ action: 'CONFIRM' }), WRITER)).rejects.toThrow(/enter confirmed pieces/);
    expect(mockConfCreate).not.toHaveBeenCalled();
  });

  it('asks for a BOQ item and a drawing number in plain words', async () => {
    await expect(service.create('c1', { action: 'DRAFT' as const, drawingNo: 'HC-001' }, WRITER)).rejects.toThrow('Please select BOQ item.');
    await expect(service.create('c1', dto({ drawingNo: ' ' }), WRITER)).rejects.toThrow('Please enter drawing number.');
  });

  it('rejects a BOQ item that belongs to another contract', async () => {
    mockItemFindFirst.mockResolvedValue(null);
    await expect(service.create('c1', dto(), WRITER)).rejects.toThrow(UnprocessableEntityException);
  });

  it('does not create a second confirmation for a BOQ item that is already confirmed', async () => {
    mockConfFindFirst.mockResolvedValue({ id: 'conf-0' });
    await expect(service.create('c1', dto({ action: 'CONFIRM', confirmedPieces: 20 }), WRITER)).rejects.toThrow(
      'Elements are already confirmed for this BOQ item. Use Edit Confirmation if changes are needed.',
    );
    expect(mockConfCreate).not.toHaveBeenCalled();
  });

  it('needs a Technical write permission', async () => {
    await expect(service.create('c1', dto(), READER)).rejects.toThrow(ForbiddenException);
  });

  it('404s for an unknown contract', async () => {
    mockContractFindUnique.mockResolvedValue(null);
    await expect(service.create('c1', dto(), WRITER)).rejects.toThrow(NotFoundException);
  });
});

describe('draft edit, revise and cancel', () => {
  const existing = (status: S) => ({ id: 'conf-1', boqItemId: 'item-1', confirmationStatus: status });
  const live = (pieceNo: number, over: Record<string, unknown> = {}) => ({ id: `p${pieceNo}`, pieceNo, currentStatus: 'DRAWING_READY', drawingGroupLinks: [], ...over });

  it('confirms an existing draft', async () => {
    mockConfFindFirst.mockResolvedValueOnce(existing(S.DRAFT)).mockResolvedValueOnce(null);
    const row = (await service.updateDraft('c1', 'conf-1', dto({ action: 'CONFIRM', confirmedPieces: 12 }), WRITER)) as Record<string, unknown>;
    expect(row['confirmationStatus']).toBe(S.CONFIRMED);
  });

  it('never edits a confirmed row in place', async () => {
    mockConfFindFirst.mockResolvedValue(existing(S.CONFIRMED));
    await expect(service.updateDraft('c1', 'conf-1', dto({ confirmedPieces: 9 }), WRITER)).rejects.toThrow(ConflictException);
    expect(mockConfUpdate).not.toHaveBeenCalled();
  });

  it('revise keeps history: old row becomes REVISED, a new CONFIRMED row is added', async () => {
    mockConfFindFirst.mockResolvedValue(existing(S.CONFIRMED));
    const row = (await service.revise('c1', 'conf-1', dto({ action: 'CONFIRM', confirmedPieces: 25, revision: 'Rev A' }), WRITER)) as Record<string, unknown>;
    expect(mockConfUpdate.mock.calls[0]?.[0].data).toEqual({ confirmationStatus: S.REVISED });
    expect(row['confirmationStatus']).toBe(S.CONFIRMED);
    expect(row['confirmedPieces']).toBe(25);
    expect(row['boqItemId']).toBe('item-1');
  });

  it('revise only applies to confirmed rows and validates the new pieces', async () => {
    mockConfFindFirst.mockResolvedValue(existing(S.DRAFT));
    await expect(service.revise('c1', 'conf-1', dto({ confirmedPieces: 5 }), WRITER)).rejects.toThrow(ConflictException);
    mockConfFindFirst.mockResolvedValue(existing(S.CONFIRMED));
    await expect(service.revise('c1', 'conf-1', dto({ confirmedPieces: 2.2 }), WRITER)).rejects.toThrow(/whole number/);
  });

  it('does not cancel a confirmation whose elements are used in a later step', async () => {
    mockConfFindFirst.mockResolvedValue(existing(S.CONFIRMED));
    mockPieceFindMany.mockResolvedValue([live(1), live(2, { drawingGroupLinks: [{ id: 'l1' }] })]);
    await expect(service.cancel('c1', 'conf-1', WRITER)).rejects.toThrow('This confirmation cannot be cancelled because elements are already used in later steps.');
    expect(mockConfUpdate).not.toHaveBeenCalled();
    expect(mockPieceUpdateMany).not.toHaveBeenCalled();
  });

  it('cancels an unused confirmation and keeps its elements as Cancelled (never deleted)', async () => {
    mockConfFindFirst.mockResolvedValue(existing(S.CONFIRMED));
    mockPieceFindMany.mockResolvedValue([live(1), live(2)]);
    await service.cancel('c1', 'conf-1', WRITER);
    expect(mockPieceUpdateMany.mock.calls[0]?.[0]).toMatchObject({ data: { isCancelled: true, currentStatus: 'CANCELLED' } });
    expect(mockHistoryCreateMany.mock.calls[0]?.[0].data).toHaveLength(2);
    expect(mockConfUpdate.mock.calls[0]?.[0].data).toEqual({ confirmationStatus: S.CANCELLED });
  });

  it('cancels instead of deleting, and not twice', async () => {
    mockConfFindFirst.mockResolvedValue(existing(S.CONFIRMED));
    await service.cancel('c1', 'conf-1', WRITER);
    expect(mockConfUpdate.mock.calls[0]?.[0].data).toEqual({ confirmationStatus: S.CANCELLED });
    mockConfFindFirst.mockResolvedValue(existing(S.CANCELLED));
    await expect(service.cancel('c1', 'conf-1', WRITER)).rejects.toThrow(ConflictException);
  });
});

describe('TechnicalBoqConfirmationService.list', () => {
  it('shows contract qty/unit next to the total confirmed pieces and never creates pieces', async () => {
    mockItemFindMany.mockResolvedValue([
      {
        id: 'item-1',
        sortOrder: 1,
        description: 'Hollowcore Slab',
        unitOfMeasure: 'm²',
        originalEstimatedQty: { toString: () => '500.000' },
        drawingConfirmations: [
          { confirmationStatus: S.CONFIRMED, confirmedPieces: 20 },
          { confirmationStatus: S.CONFIRMED, confirmedPieces: 30 },
        ],
      },
      { id: 'item-2', sortOrder: 2, description: 'Beam', unitOfMeasure: 'nos', originalEstimatedQty: null, drawingConfirmations: [] },
    ]);
    const result = await service.list('c1', READER);
    expect(result[0]).toMatchObject({ contractQty: '500.000', contractUnit: 'm²', confirmedPieces: 50 });
    expect(result[1]).toMatchObject({ confirmedPieces: null });
    // Summary: Drawing Confirmed Pieces 50, none generated yet, 50 waiting to be generated.
    expect(result[0]).toMatchObject({ piecesGenerated: 0, pendingPieces: 50, needsAttention: false });
    // A commercial M² quantity is never turned into pieces; nothing writes anywhere.
    expect(mockConfCreate).not.toHaveBeenCalled();
    expect(mockPieceCreate).not.toHaveBeenCalled();
  });
});

describe('TechnicalBoqConfirmationService.editConfirmed (FMP-TECH-26)', () => {
  const confirmed = (over: Record<string, unknown> = {}) => ({ id: 'conf-1', boqItemId: 'item-1', drawingNo: 'DN-0001', sizeOrSpecification: null, confirmedPieces: 3, confirmationStatus: S.CONFIRMED, ...over });
  const live = (pieceNo: number, over: Record<string, unknown> = {}) => ({ id: `p${pieceNo}`, pieceNo, currentStatus: 'DRAWING_READY', drawingGroupLinks: [], ...over });
  const edit = (over: Partial<SaveBoqDrawingConfirmationDto> = {}) => dto({ action: 'CONFIRM', drawingNo: 'DN-0001', confirmedPieces: 3, ...over });

  beforeEach(() => {
    mockItemFindFirst.mockResolvedValue({ id: 'item-1', sortOrder: 1 });
    mockConfFindFirst.mockResolvedValue(confirmed());
    mockPieceFindMany.mockResolvedValue([live(1), live(2), live(3)]);
  });

  it('only a confirmed confirmation can be edited this way', async () => {
    mockConfFindFirst.mockResolvedValue(confirmed({ confirmationStatus: S.DRAFT }));
    await expect(service.editConfirmed('c1', 'conf-1', edit(), WRITER)).rejects.toThrow('Only a confirmed drawing can be edited here.');
  });

  it('changes the text in place and copies the drawing reference and specification to its elements', async () => {
    await service.editConfirmed('c1', 'conf-1', edit({ drawingNo: 'DN-0009', sizeOrSpecification: 'Beam 300x600', revision: 'Rev A' }), WRITER);
    expect(mockConfUpdate.mock.calls[0]?.[0].data).toMatchObject({ drawingNo: 'DN-0009', sizeOrSpecification: 'Beam 300x600', revision: 'Rev A', confirmedPieces: 3 });
    expect(mockPieceUpdateMany.mock.calls[0]?.[0]).toEqual({ where: { drawingConfirmationId: 'conf-1' }, data: { drawingNo: 'DN-0009', sizeOrSpecification: 'Beam 300x600' } });
    expect(mockPieceCreate).not.toHaveBeenCalled();
  });

  it('still allows text edits when the elements are already in a group or released, but not a new number', async () => {
    mockPieceFindMany.mockResolvedValue([live(1, { drawingGroupLinks: [{ id: 'l1' }] }), live(2), live(3)]);
    await expect(service.editConfirmed('c1', 'conf-1', edit({ confirmedPieces: 5 }), WRITER)).rejects.toThrow(
      'This confirmation cannot be changed because elements are already used in later steps.',
    );
    expect(mockConfUpdate).not.toHaveBeenCalled();
    await service.editConfirmed('c1', 'conf-1', edit({ remarks: 'Checked' }), WRITER);
    expect(mockConfUpdate).toHaveBeenCalledTimes(1);
    mockPieceFindMany.mockResolvedValue([live(1, { currentStatus: 'IN_PRODUCTION' }), live(2), live(3)]);
    await expect(service.editConfirmed('c1', 'conf-1', edit({ confirmedPieces: 2 }), WRITER)).rejects.toThrow(/already used in later steps/);
  });

  it('a smaller number cancels the surplus elements (kept, with history), highest numbers first', async () => {
    await service.editConfirmed('c1', 'conf-1', edit({ confirmedPieces: 2 }), WRITER);
    expect(mockPieceUpdateMany.mock.calls[0]?.[0]).toMatchObject({ where: { id: { in: ['p3'] } }, data: { isCancelled: true, currentStatus: 'CANCELLED' } });
    expect(mockHistoryCreateMany.mock.calls[0]?.[0].data[0]).toMatchObject({ pieceId: 'p3', newStatus: 'CANCELLED' });
  });

  it('a larger number adds only the missing elements with the next numbers', async () => {
    const existingRefs = [1, 2, 3].map((n) => ({ drawingConfirmationId: 'conf-1', pieceNo: n, pieceCode: `DN-0001-00${n}` }));
    mockPieceFindMany.mockImplementation(async (args: { select: Record<string, unknown> }) => (args.select['drawingGroupLinks'] ? [live(1), live(2), live(3)] : args.select['pieceCode'] ? existingRefs : []));
    await service.editConfirmed('c1', 'conf-1', edit({ confirmedPieces: 5 }), WRITER);
    const created = mockPieceCreate.mock.calls[0]?.[0].data as { pieceNo: number; pieceCode: string; currentStatus: string }[];
    expect(created.map((p) => p.pieceNo)).toEqual([4, 5]);
    expect(created.map((p) => p.pieceCode)).toEqual(['DN-0001-004', 'DN-0001-005']);
    expect(created.every((p) => p.currentStatus === 'DRAWING_READY')).toBe(true);
  });

  it('needs a Technical write permission and a positive whole number', async () => {
    await expect(service.editConfirmed('c1', 'conf-1', edit(), READER)).rejects.toThrow(ForbiddenException);
    await expect(service.editConfirmed('c1', 'conf-1', edit({ confirmedPieces: 0 }), WRITER)).rejects.toThrow(/more than 0/);
  });
});
