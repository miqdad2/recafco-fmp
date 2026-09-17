import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, UnprocessableEntityException, ConflictException } from '@nestjs/common';
import {
  ContractErectionDeliveryStartService,
  assertCommentsPresentForHoldOrReturn,
  computeDeliveryStartActivityEvent,
  computeDeliveryTotals,
  computeDeliveryDocumentStatus,
} from './contract-erection-delivery-start.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { ErectionDeliveryStartAttachmentStorageService } from './erection-delivery-start-attachment-storage.service';

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('assertCommentsPresentForHoldOrReturn', () => {
  it('does not throw for DRAFT with no comments', () => {
    expect(() => assertCommentsPresentForHoldOrReturn('DRAFT', undefined)).not.toThrow();
  });

  it('does not throw for STARTED with no comments', () => {
    expect(() => assertCommentsPresentForHoldOrReturn('STARTED', undefined)).not.toThrow();
  });

  it('does not throw when status is not provided at all', () => {
    expect(() => assertCommentsPresentForHoldOrReturn(undefined, undefined)).not.toThrow();
  });

  it('throws for HOLD with no comments', () => {
    expect(() => assertCommentsPresentForHoldOrReturn('HOLD', undefined)).toThrow(UnprocessableEntityException);
  });

  it('throws for RETURNED with only whitespace comments', () => {
    expect(() => assertCommentsPresentForHoldOrReturn('RETURNED', '   ')).toThrow(UnprocessableEntityException);
  });

  it('does not throw for HOLD with real comments', () => {
    expect(() => assertCommentsPresentForHoldOrReturn('HOLD', 'Waiting on vehicle availability.')).not.toThrow();
  });
});

describe('computeDeliveryStartActivityEvent', () => {
  it('maps STARTED to the confirmed event', () => {
    expect(computeDeliveryStartActivityEvent('STARTED')).toBe('erection_delivery_start_confirmed');
  });

  it('maps HOLD to the hold event', () => {
    expect(computeDeliveryStartActivityEvent('HOLD')).toBe('erection_delivery_start_hold');
  });

  it('maps RETURNED to the returned event', () => {
    expect(computeDeliveryStartActivityEvent('RETURNED')).toBe('erection_delivery_start_returned');
  });

  it('maps DRAFT to the draft-saved event', () => {
    expect(computeDeliveryStartActivityEvent('DRAFT')).toBe('erection_delivery_start_draft_saved');
  });
});

describe('computeDeliveryTotals', () => {
  it('returns all-zero/null for an empty item list — never fabricates a total', () => {
    expect(computeDeliveryTotals([])).toEqual({ totalPackages: 0, totalWeight: null, totalVolume: null, totalItems: 0 });
  });

  it('matches the unit demo data exactly (5 items)', () => {
    const items = [
      { weight: 12.6, volume: 18.4, quantity: 100 },
      { weight: 8.75, volume: 12.2, quantity: 60 },
      { weight: 4.3, volume: 5.1, quantity: 20 },
      { weight: 6.8, volume: 7.9, quantity: 40 },
      { weight: 5.25, volume: 4.6, quantity: 150 },
    ];
    const totals = computeDeliveryTotals(items);
    expect(totals.totalPackages).toBe(5);
    expect(totals.totalWeight).toBeCloseTo(37.7, 5);
    expect(totals.totalVolume).toBeCloseTo(48.2, 5);
    expect(totals.totalItems).toBe(370);
  });

  it('treats a missing per-item weight/volume as 0 in the sum, not as a blocking error', () => {
    const totals = computeDeliveryTotals([{ weight: null, volume: null, quantity: 10 }, { weight: 5, volume: 2, quantity: 5 }]);
    expect(totals.totalPackages).toBe(2);
    expect(totals.totalWeight).toBe(5);
    expect(totals.totalVolume).toBe(2);
    expect(totals.totalItems).toBe(15);
  });
});

describe('computeDeliveryDocumentStatus', () => {
  it('is ATTACHED only when a real, valid attachment link is confirmed', () => {
    expect(computeDeliveryDocumentStatus(true, undefined)).toBe('ATTACHED');
    expect(computeDeliveryDocumentStatus(true, 'NOT_REQUIRED')).toBe('ATTACHED');
  });

  it('is NOT_REQUIRED when explicitly requested and no valid attachment exists', () => {
    expect(computeDeliveryDocumentStatus(false, 'NOT_REQUIRED')).toBe('NOT_REQUIRED');
  });

  it('defaults to PENDING when no valid attachment and no override requested — never fakes ATTACHED', () => {
    expect(computeDeliveryDocumentStatus(false, undefined)).toBe('PENDING');
    expect(computeDeliveryDocumentStatus(false, 'PENDING')).toBe('PENDING');
  });
});

// ---------------------------------------------------------------------------
// Service-level tests
// ---------------------------------------------------------------------------

const mockContractFindUnique = vi.fn();
const mockScheduleFindUnique = vi.fn();
const mockDeliveryStartFindUnique = vi.fn();
const mockDeliveryStartFindUniqueOrThrow = vi.fn();
const mockActivityCreate = vi.fn().mockResolvedValue({ id: 'activity-1' });

const mockTx = {
  contractErectionDeliveryStart: {
    create: vi.fn(),
    update: vi.fn(),
  },
  contractErectionDeliveryItem: {
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    findMany: vi.fn().mockResolvedValue([]),
  },
  contractErectionDeliveryDocument: {
    upsert: vi.fn().mockResolvedValue({}),
  },
  contractErectionDeliveryStartAttachment: {
    findFirst: vi.fn().mockResolvedValue(null),
  },
};

const mockClient = {
  contract: { findUnique: mockContractFindUnique },
  contractErectionSchedule: { findUnique: mockScheduleFindUnique },
  contractErectionDeliveryStart: {
    findUnique: mockDeliveryStartFindUnique,
    findUniqueOrThrow: mockDeliveryStartFindUniqueOrThrow,
  },
  contractActivity: { create: mockActivityCreate },
  $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};

const mockDb = { getClient: () => mockClient } as unknown as DatabaseService;
const mockAttachmentStorage = {} as unknown as ErectionDeliveryStartAttachmentStorageService;

function actor(permissions: string[]): AuthUser {
  return { id: 'user-1', displayName: 'Delivery Coordinator', permissions } as AuthUser;
}

const VALID_DTO = {
  deliveryReferenceNo: 'DEL-GRM-001',
  deliveryDate: '2026-10-28',
  plannedDeliveryWindowStart: '2026-10-28',
  plannedDeliveryWindowEnd: '2026-10-30',
  transportMode: 'Road',
  dispatchProductionSource: 'RECAFCO Precast Yard',
  dispatchFromYard: 'RECAFCO Mina Abdullah Yard',
  deliveryToSiteLocation: 'GRM Site - Boundary Wall Zone A',
};

describe('ContractErectionDeliveryStartService', () => {
  let deptAccess: DepartmentAccessService;
  let service: ContractErectionDeliveryStartService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.$transaction = vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));
    deptAccess = { assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined) } as unknown as DepartmentAccessService;
    service = new ContractErectionDeliveryStartService(mockDb, deptAccess, mockAttachmentStorage);
  });

  it('rejects a read without contracts.read', async () => {
    await expect(service.getForContract('c1', actor([]))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects create without contracts.update', async () => {
    await expect(service.create('c1', VALID_DTO, actor(['contracts.read']))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to create Step 4 before Step 3 (the erection schedule) exists', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
    mockScheduleFindUnique.mockResolvedValue(null);

    await expect(service.create('c1', VALID_DTO, actor(['contracts.update']))).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(mockTx.contractErectionDeliveryStart.create).not.toHaveBeenCalled();
  });

  it('refuses to create a second delivery-start record once one already exists for the contract', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
    mockScheduleFindUnique.mockResolvedValue({ id: 'schedule-1' });
    mockDeliveryStartFindUnique.mockResolvedValue({ id: 'delivery-existing' });

    await expect(service.create('c1', VALID_DTO, actor(['contracts.update']))).rejects.toBeInstanceOf(ConflictException);
    expect(mockTx.contractErectionDeliveryStart.create).not.toHaveBeenCalled();
  });

  it('refuses to create with status HOLD and no comments (server-side floor, not just client-side)', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
    mockScheduleFindUnique.mockResolvedValue({ id: 'schedule-1' });
    mockDeliveryStartFindUnique.mockResolvedValue(null);

    await expect(
      service.create('c1', { ...VALID_DTO, status: 'HOLD' }, actor(['contracts.update'])),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(mockTx.contractErectionDeliveryStart.create).not.toHaveBeenCalled();
  });

  it('creates a Draft delivery-start record, linking the real Step 3 schedule id and deriving totals from the given items', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
    mockScheduleFindUnique.mockResolvedValue({ id: 'schedule-1' });
    mockDeliveryStartFindUnique.mockResolvedValue(null);
    mockTx.contractErectionDeliveryStart.create.mockResolvedValue({ id: 'delivery-1' });
    mockDeliveryStartFindUniqueOrThrow.mockResolvedValue({
      id: 'delivery-1', contractId: 'c1', erectionScheduleId: 'schedule-1',
      deliveryReferenceNo: 'DEL-GRM-001', deliveryDate: new Date('2026-10-28'),
      plannedDeliveryWindowStart: new Date('2026-10-28'), plannedDeliveryWindowEnd: new Date('2026-10-30'),
      transportMode: 'Road', dispatchProductionSource: 'RECAFCO Precast Yard', dispatchFromYard: 'RECAFCO Mina Abdullah Yard',
      deliveryToSiteLocation: 'GRM Site - Boundary Wall Zone A', gateEntryContact: null, deliveryNoteOrLrNo: null,
      vehicleNo: null, driverName: null, driverContact: null,
      totalPackages: 1, totalWeight: 12.6, totalVolume: 18.4, totalItems: 100,
      status: 'DRAFT', comments: null, confirmedAt: null,
      createdByUser: { id: 'user-1', displayName: 'Delivery Coordinator' }, updatedByUser: null,
      createdAt: new Date(), updatedAt: new Date(),
      items: [{ id: 'item-1', srNo: 1, description: 'Precast Boundary Wall Panel Type A', packageNo: 'PKG-001', weight: 12.6, volume: 18.4, quantity: 100, status: 'READY_TO_DISPATCH' }],
      documents: [],
      attachments: [],
    });

    const dto = { ...VALID_DTO, items: [{ description: 'Precast Boundary Wall Panel Type A', packageNo: 'PKG-001', weight: 12.6, volume: 18.4, quantity: 100 }] };
    const result = (await service.create('c1', dto, actor(['contracts.update']))) as { status: string; erectionScheduleId: string; totalPackages: number };
    expect(result.status).toBe('DRAFT');
    expect(result.erectionScheduleId).toBe('schedule-1');
    expect(result.totalPackages).toBe(1);
    expect(mockTx.contractErectionDeliveryStart.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totalPackages: 1, totalWeight: 12.6, totalVolume: 18.4, totalItems: 100 }) }),
    );
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'erection_delivery_start_draft_saved' }) }),
    );
  });
});
