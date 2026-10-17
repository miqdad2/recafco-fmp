import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ContractBoqItemsService, BOQ_ITEM_MESSAGES, DUPLICATE_WINDOW_MS } from './contract-boq-items.service';
import type { DatabaseService } from '../database/database.service';
import type { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';

const mockContractFind = vi.fn();
const mockItemFindFirst = vi.fn();
const mockItemAggregate = vi.fn();
const mockItemCreate = vi.fn();
const mockActivityCreate = vi.fn();
const mockLock = vi.fn();
const mockForbiddenWrite = vi.fn(); // nothing but the one new item + its activity may be written

const client = {
  contract: { findUnique: mockContractFind, update: mockForbiddenWrite, updateMany: mockForbiddenWrite },
  contractBoqItem: {
    findFirst: mockItemFindFirst,
    aggregate: mockItemAggregate,
    create: mockItemCreate,
    update: mockForbiddenWrite,
    updateMany: mockForbiddenWrite,
    delete: mockForbiddenWrite,
    deleteMany: mockForbiddenWrite,
    createMany: mockForbiddenWrite,
  },
  contractActivity: { create: mockActivityCreate },
  contractBoqPiece: { createMany: mockForbiddenWrite, create: mockForbiddenWrite, updateMany: mockForbiddenWrite },
  $executeRaw: mockLock,
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(client)),
};
const db = { getClient: () => client } as unknown as DatabaseService;
const deptAccess = { assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined) } as unknown as DepartmentAccessService;

const actor = (permissions: string[]): AuthUser => ({ id: 'u1', displayName: 'Contract Manager', permissions }) as unknown as AuthUser;
const MANAGER = actor(['contracts.read', 'contracts.update']);
const VIEWER = actor(['contracts.read']);
const TECHNICAL_ONLY = actor(['contracts.read', 'contracts.workflow_update', 'technical.update']);

const dto = { description: 'Hollowcore Slab', unitOfMeasure: 'm²', contractQty: 500, unitPrice: 12.5 };

let service: ContractBoqItemsService;
beforeEach(() => {
  vi.clearAllMocks();
  mockContractFind.mockResolvedValue({ id: 'k1', status: 'ACTIVE', departmentId: null, referenceNumber: 'C-1' });
  mockItemFindFirst.mockResolvedValue(null);
  mockItemAggregate.mockResolvedValue({ _max: { sortOrder: 4 } });
  mockItemCreate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({ id: 'new-item', ...args.data }));
  service = new ContractBoqItemsService(db, deptAccess);
});

describe('ContractBoqItemsService.addItem', () => {
  it('adds one new item to an active contract, numbered after the existing ones', async () => {
    const result = await service.addItem('k1', dto, MANAGER);
    expect(result.duplicate).toBe(false);
    expect(mockItemCreate).toHaveBeenCalledTimes(1);
    expect(mockItemCreate.mock.calls[0]?.[0].data).toEqual({
      contractId: 'k1',
      sortOrder: 5,
      description: 'Hollowcore Slab',
      unitOfMeasure: 'm²',
      originalEstimatedQty: 500,
      unitPrice: 12.5,
      totalPrice: 6250,
    });
  });

  it('calculates the total on the server (Contract Qty × Unit Price, 3 decimals)', async () => {
    await service.addItem('k1', { ...dto, contractQty: 1.333, unitPrice: 3 }, MANAGER);
    expect(mockItemCreate.mock.calls[0]?.[0].data.totalPrice).toBe(3.999);
  });

  it('starts numbering at 1 when the contract has no items', async () => {
    mockItemAggregate.mockResolvedValue({ _max: { sortOrder: null } });
    await service.addItem('k1', dto, MANAGER);
    expect(mockItemCreate.mock.calls[0]?.[0].data.sortOrder).toBe(1);
  });

  it('works on a Draft contract too', async () => {
    mockContractFind.mockResolvedValue({ id: 'k1', status: 'DRAFT', departmentId: null, referenceNumber: 'C-1' });
    await expect(service.addItem('k1', dto, MANAGER)).resolves.toBeDefined();
  });

  it('leaves the contract, other items, elements and contract value untouched (adds only)', async () => {
    await service.addItem('k1', dto, MANAGER);
    expect(mockForbiddenWrite).not.toHaveBeenCalled();
  });

  it('records the addition in the contract activity history', async () => {
    await service.addItem('k1', dto, MANAGER);
    expect(mockActivityCreate).toHaveBeenCalledTimes(1);
    expect(mockActivityCreate.mock.calls[0]?.[0].data).toEqual({
      contractId: 'k1',
      actorUserId: 'u1',
      actorName: 'Contract Manager',
      event: 'boq_item_added',
      metadata: { boqItemNo: 5, description: 'Hollowcore Slab', unit: 'm²', contractQty: 500, unitPrice: 12.5 },
    });
  });

  it('a repeated identical Save within the window returns the same item and creates nothing', async () => {
    const existing = { id: 'already', sortOrder: 5, description: 'Hollowcore Slab' };
    mockItemFindFirst.mockResolvedValue(existing);
    const result = await service.addItem('k1', dto, MANAGER);
    expect(result).toEqual({ item: existing, duplicate: true });
    expect(mockItemCreate).not.toHaveBeenCalled();
    expect(mockActivityCreate).not.toHaveBeenCalled();
    // the check is limited to recent, identical rows of THIS contract
    const where = mockItemFindFirst.mock.calls[0]?.[0].where;
    expect(where).toMatchObject({ contractId: 'k1', unitOfMeasure: 'm²', originalEstimatedQty: 500, unitPrice: 12.5 });
    expect(where.createdAt.gte).toBeInstanceOf(Date);
    expect(Date.now() - where.createdAt.gte.getTime()).toBeLessThan(DUPLICATE_WINDOW_MS + 2000);
  });

  it('takes a per-contract lock first, so two quick Saves cannot both get through', async () => {
    await service.addItem('k1', dto, MANAGER);
    expect(mockLock).toHaveBeenCalledTimes(1);
    expect(mockLock.mock.invocationCallOrder[0]).toBeLessThan(mockItemFindFirst.mock.invocationCallOrder[0]!);
  });

  it.each(['CLOSED', 'TERMINATED', 'CANCELLED'])('is refused for a %s contract', async (status) => {
    mockContractFind.mockResolvedValue({ id: 'k1', status, departmentId: null, referenceNumber: 'C-1' });
    await expect(service.addItem('k1', dto, MANAGER)).rejects.toThrow(BOQ_ITEM_MESSAGES.closed);
    await expect(service.addItem('k1', dto, MANAGER)).rejects.toThrow(UnprocessableEntityException);
    expect(mockItemCreate).not.toHaveBeenCalled();
  });

  it('view-only and Technical-only users cannot add items', async () => {
    await expect(service.addItem('k1', dto, VIEWER)).rejects.toThrow(ForbiddenException);
    await expect(service.addItem('k1', dto, TECHNICAL_ONLY)).rejects.toThrow(ForbiddenException);
    expect(mockItemCreate).not.toHaveBeenCalled();
  });

  it('checks department access and 404s for an unknown contract', async () => {
    await service.addItem('k1', dto, MANAGER);
    expect(deptAccess.assertCanAccessDepartment).toHaveBeenCalled();
    mockContractFind.mockResolvedValue(null);
    await expect(service.addItem('nope', dto, MANAGER)).rejects.toThrow(NotFoundException);
  });
});
