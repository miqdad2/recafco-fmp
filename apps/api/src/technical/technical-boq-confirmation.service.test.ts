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
const mockPieceCreate = vi.fn(); // nothing in this service may create pieces

const client = {
  contract: { findUnique: mockContractFindUnique },
  contractBoqItem: { findFirst: mockItemFindFirst, findMany: mockItemFindMany },
  contractBoqDrawingConfirmation: { findFirst: mockConfFindFirst, create: mockConfCreate, update: mockConfUpdate },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(client)),
  contractBoqPiece: { groupBy: mockPieceGroupBy, count: mockPieceCount, create: mockPieceCreate, createMany: mockPieceCreate },
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

  it('allows several drawings for the same BOQ item', async () => {
    await service.create('c1', dto({ action: 'CONFIRM', drawingNo: 'HC-001', confirmedPieces: 20 }), WRITER);
    await service.create('c1', dto({ action: 'CONFIRM', drawingNo: 'HC-002', confirmedPieces: 30 }), WRITER);
    expect(mockConfCreate).toHaveBeenCalledTimes(2);
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

  it('confirms an existing draft', async () => {
    mockConfFindFirst.mockResolvedValue(existing(S.DRAFT));
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

  it('does not cancel a drawing that pieces were already generated from', async () => {
    mockConfFindFirst.mockResolvedValue(existing(S.CONFIRMED));
    mockPieceCount.mockResolvedValue(20);
    await expect(service.cancel('c1', 'conf-1', WRITER)).rejects.toThrow(/already generated/);
    expect(mockConfUpdate).not.toHaveBeenCalled();
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
