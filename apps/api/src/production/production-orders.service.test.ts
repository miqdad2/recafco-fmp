import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ProductionOrdersService, computeMetrics } from './production-orders.service';
import type { DatabaseService } from '../database/database.service';
import type { ProductionRefService } from './production-ref.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';
import { DepartmentAccessScope } from '@recafco/database';

// ---------------------------------------------------------------------------
// Transaction mocks
// ---------------------------------------------------------------------------

const mockTxOrderUpdateMany = vi.fn();
const mockTxOrderCreate = vi.fn();
const mockTxOrderFindUniqueOrThrow = vi.fn();
const mockTxOrderFindUnique = vi.fn();
const mockTxActivityCreate = vi.fn();
const mockTxEntryCreate = vi.fn();

const mockTx = {
  productionOrder: {
    updateMany: mockTxOrderUpdateMany,
    create: mockTxOrderCreate,
    findUniqueOrThrow: mockTxOrderFindUniqueOrThrow,
    findUnique: mockTxOrderFindUnique,
  },
  productionActivity: { create: mockTxActivityCreate },
  productionEntry: { create: mockTxEntryCreate },
};

// ---------------------------------------------------------------------------
// Client mocks
// ---------------------------------------------------------------------------

const mockOrderFindUnique = vi.fn();
const mockOrderFindMany = vi.fn();
const mockOrderCount = vi.fn();
const mockGetScope = vi.fn();
const mockEntryFindMany = vi.fn();
const mockEntryCreate = vi.fn();
const mockCommentFindMany = vi.fn();
const mockCommentCreate = vi.fn();
const mockActivityFindMany = vi.fn();
const mockDepartmentFindMany = vi.fn();
const mockPlantFindMany = vi.fn();
const mockUserFindMany = vi.fn();
const mockLocationFindMany = vi.fn();
const mockTransaction = vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

const mockClient = {
  productionOrder: {
    findUnique: mockOrderFindUnique,
    findMany: mockOrderFindMany,
    count: mockOrderCount,
    findUniqueOrThrow: vi.fn(),
  },
  productionEntry: {
    findMany: mockEntryFindMany,
    create: mockEntryCreate,
  },
  productionComment: {
    findMany: mockCommentFindMany,
    create: mockCommentCreate,
  },
  productionActivity: {
    findMany: mockActivityFindMany,
  },
  department: { findMany: mockDepartmentFindMany },
  plant: { findMany: mockPlantFindMany },
  user: { findMany: mockUserFindMany },
  location: { findMany: mockLocationFindMany },
  $transaction: mockTransaction,
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockRef = {
  nextRef: vi.fn().mockResolvedValue('PROD-2026-000001'),
} as unknown as ProductionRefService;

const mockDeptAccess = {
  buildDeptFilter: vi.fn().mockResolvedValue(null),
  getScope: mockGetScope,
  canAccessDepartment: vi.fn().mockResolvedValue(true),
  assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined),
  canGrantScope: vi.fn().mockReturnValue(true),
  getUserModuleAccessConfig: vi.fn(),
  setUserModuleAccess: vi.fn(),
} as unknown as DepartmentAccessService;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR_VIEWER: AuthUser = {
  id: 'user-1', username: 'viewer', displayName: 'Viewer',
  roleId: 'r1', roleCode: 'VIEWER', roleName: 'Viewer',
  mustChangePassword: false, isActive: true, sessionId: 's1',
  departmentId: null,
  permissions: ['production.read'],
};

const ACTOR_NONE: AuthUser = {
  id: 'user-0', username: 'none', displayName: 'None',
  roleId: 'r0', roleCode: 'NONE', roleName: 'None',
  mustChangePassword: false, isActive: true, sessionId: 's0',
  departmentId: null,
  permissions: [],
};

const ACTOR_OPERATOR: AuthUser = {
  id: 'user-3', username: 'op', displayName: 'Operator',
  roleId: 'r3', roleCode: 'OP', roleName: 'Operator',
  mustChangePassword: false, isActive: true, sessionId: 's3',
  departmentId: null,
  permissions: ['production.read', 'production.entries.create'],
};

const ACTOR_MANAGER: AuthUser = {
  id: 'user-2', username: 'mgr', displayName: 'Manager',
  roleId: 'r2', roleCode: 'MGR', roleName: 'Manager',
  mustChangePassword: false, isActive: true, sessionId: 's2',
  departmentId: null,
  permissions: [
    'production.read', 'production.create', 'production.update', 'production.schedule',
    'production.start', 'production.pause', 'production.resume', 'production.complete',
    'production.cancel', 'production.comment', 'production.entries.create', 'production.manage',
    'production.lines.read', 'production.lines.create', 'production.lines.update', 'production.lines.manage',
  ],
};

function makeOrder(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'order-1',
    referenceNumber: 'PROD-2026-000001',
    title: 'Widget Production Run 1',
    description: null,
    status: 'DRAFT',
    version: 1,
    productionLineId: null,
    departmentId: null,
    plantId: null,
    productCode: null,
    productName: null,
    targetQuantity: 1000,
    unit: 'pcs',
    scheduledStartAt: null,
    scheduledEndAt: null,
    startedAt: null,
    startedByUserId: null,
    pausedAt: null,
    pausedByUserId: null,
    pauseReason: null,
    resumedAt: null,
    resumedByUserId: null,
    completedAt: null,
    completedByUserId: null,
    completionNote: null,
    cancelledAt: null,
    cancelledByUserId: null,
    cancellationReason: null,
    supervisorUserId: null,
    createdByUserId: 'user-2',
    createdAt: new Date('2026-07-02'),
    updatedAt: new Date('2026-07-02'),
    productionLine: null,
    department: null,
    plant: null,
    createdByUser: { id: 'user-2', displayName: 'Manager' },
    supervisorUser: null,
    startedByUser: null,
    pausedByUser: null,
    resumedByUser: null,
    completedByUser: null,
    cancelledByUser: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeMetrics — pure function
// ---------------------------------------------------------------------------

describe('computeMetrics', () => {
  it('returns all zeros for empty entries', () => {
    const m = computeMetrics([], 1000);
    expect(m.totalProduced).toBe(0);
    expect(m.totalAccepted).toBe(0);
    expect(m.totalRejected).toBe(0);
    expect(m.totalDowntimeMinutes).toBe(0);
    expect(m.adjustmentTotal).toBe(0);
    expect(m.effectiveProduced).toBe(0);
    expect(m.completionPercentage).toBe(0);
    expect(m.rejectionRate).toBe(0);
    expect(m.remainingQuantity).toBe(1000);
  });

  it('computes metrics from a single OUTPUT entry', () => {
    const entries = [{ type: 'OUTPUT', quantityProduced: 200, quantityAccepted: 190, quantityRejected: 10, downtimeMinutes: null, adjustmentQty: null }];
    const m = computeMetrics(entries, 1000);
    expect(m.totalProduced).toBe(200);
    expect(m.totalAccepted).toBe(190);
    expect(m.totalRejected).toBe(10);
    expect(m.rejectionRate).toBe(5); // 10/200
    expect(m.completionPercentage).toBe(20); // 200/1000
    expect(m.remainingQuantity).toBe(800);
  });

  it('sums DOWNTIME minutes correctly', () => {
    const entries = [
      { type: 'DOWNTIME', quantityProduced: null, quantityAccepted: null, quantityRejected: null, downtimeMinutes: 30, adjustmentQty: null },
      { type: 'DOWNTIME', quantityProduced: null, quantityAccepted: null, quantityRejected: null, downtimeMinutes: 15, adjustmentQty: null },
    ];
    const m = computeMetrics(entries, 1000);
    expect(m.totalDowntimeMinutes).toBe(45);
    expect(m.totalProduced).toBe(0);
  });

  it('applies positive ADJUSTMENT to effectiveProduced', () => {
    const entries = [
      { type: 'OUTPUT', quantityProduced: 100, quantityAccepted: 100, quantityRejected: 0, downtimeMinutes: null, adjustmentQty: null },
      { type: 'ADJUSTMENT', quantityProduced: null, quantityAccepted: null, quantityRejected: null, downtimeMinutes: null, adjustmentQty: 50 },
    ];
    const m = computeMetrics(entries, 200);
    expect(m.totalProduced).toBe(100);
    expect(m.adjustmentTotal).toBe(50);
    expect(m.effectiveProduced).toBe(150);
    expect(m.completionPercentage).toBe(75);
    expect(m.remainingQuantity).toBe(50);
  });

  it('applies negative ADJUSTMENT reducing effectiveProduced', () => {
    const entries = [
      { type: 'OUTPUT', quantityProduced: 100, quantityAccepted: 100, quantityRejected: 0, downtimeMinutes: null, adjustmentQty: null },
      { type: 'ADJUSTMENT', quantityProduced: null, quantityAccepted: null, quantityRejected: null, downtimeMinutes: null, adjustmentQty: -20 },
    ];
    const m = computeMetrics(entries, 200);
    expect(m.effectiveProduced).toBe(80);
    expect(m.remainingQuantity).toBe(120);
  });

  it('allows remainingQuantity to be negative when overproduced', () => {
    const entries = [{ type: 'OUTPUT', quantityProduced: 1200, quantityAccepted: 1200, quantityRejected: 0, downtimeMinutes: null, adjustmentQty: null }];
    const m = computeMetrics(entries, 1000);
    expect(m.remainingQuantity).toBe(-200);
    expect(m.completionPercentage).toBe(120);
  });

  it('returns 0 completionPercentage when targetQuantity is 0', () => {
    const m = computeMetrics([], 0);
    expect(m.completionPercentage).toBe(0);
    expect(m.remainingQuantity).toBe(0);
  });

  it('combines all entry types correctly', () => {
    const entries = [
      { type: 'OUTPUT', quantityProduced: 500, quantityAccepted: 480, quantityRejected: 20, downtimeMinutes: null, adjustmentQty: null },
      { type: 'DOWNTIME', quantityProduced: null, quantityAccepted: null, quantityRejected: null, downtimeMinutes: 60, adjustmentQty: null },
      { type: 'ADJUSTMENT', quantityProduced: null, quantityAccepted: null, quantityRejected: null, downtimeMinutes: null, adjustmentQty: 10 },
    ];
    const m = computeMetrics(entries, 1000);
    expect(m.totalProduced).toBe(500);
    expect(m.totalDowntimeMinutes).toBe(60);
    expect(m.effectiveProduced).toBe(510);
    expect(m.rejectionRate).toBe(4); // 20/500
    expect(m.remainingQuantity).toBe(490);
  });
});

// ---------------------------------------------------------------------------
// ProductionOrdersService
// ---------------------------------------------------------------------------

describe('ProductionOrdersService', () => {
  let service: ProductionOrdersService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));
    service = new ProductionOrdersService(mockDb, mockRef, mockDeptAccess);
  });

  // ---- create ----

  describe('create', () => {
    it('throws 403 when actor lacks production.create', async () => {
      await expect(service.create({ title: 'T', targetQuantity: 100, unit: 'pcs' }, ACTOR_VIEWER))
        .rejects.toThrow(ForbiddenException);
    });

    it('creates an order with a ref number and activity log', async () => {
      const order = makeOrder();
      mockTxOrderCreate.mockResolvedValue(order);
      mockTxActivityCreate.mockResolvedValue({});
      const result = await service.create({ title: 'Widget Run', targetQuantity: 1000, unit: 'pcs' }, ACTOR_MANAGER);
      expect(result).toEqual(order);
      expect(mockRef.nextRef).toHaveBeenCalledWith(mockTx, expect.any(Number));
      expect(mockTxOrderCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ referenceNumber: 'PROD-2026-000001', status: 'DRAFT', version: 1 }),
      }));
      expect(mockTxActivityCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ event: 'created' }),
      }));
    });
  });

  // ---- findAll ----

  describe('findAll', () => {
    it('throws 403 when actor lacks production.read', async () => {
      await expect(service.findAll({}, ACTOR_NONE)).rejects.toThrow(ForbiddenException);
    });

    it('returns paginated results', async () => {
      mockOrderFindMany.mockResolvedValue([makeOrder()]);
      mockOrderCount.mockResolvedValue(1);
      const result = await service.findAll({}, ACTOR_VIEWER);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(25);
    });

    it('filters by status when provided', async () => {
      mockOrderFindMany.mockResolvedValue([]);
      mockOrderCount.mockResolvedValue(0);
      await service.findAll({ status: 'IN_PROGRESS' as never }, ACTOR_VIEWER);
      expect(mockOrderFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: 'IN_PROGRESS' }),
      }));
    });

    it('applies search as OR filter', async () => {
      mockOrderFindMany.mockResolvedValue([]);
      mockOrderCount.mockResolvedValue(0);
      await service.findAll({ search: 'widget' }, ACTOR_VIEWER);
      expect(mockOrderFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }));
    });
  });

  // ---- findOne ----

  describe('findOne', () => {
    it('throws 403 when actor lacks production.read', async () => {
      await expect(service.findOne('order-1', ACTOR_NONE)).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when order does not exist', async () => {
      mockOrderFindUnique.mockResolvedValue(null);
      await expect(service.findOne('order-99', ACTOR_VIEWER)).rejects.toThrow(NotFoundException);
    });

    it('returns the production order', async () => {
      const order = makeOrder();
      mockOrderFindUnique.mockResolvedValue(order);
      const result = await service.findOne('order-1', ACTOR_VIEWER);
      expect(result).toEqual(order);
    });
  });

  // ---- update ----

  describe('update', () => {
    it('throws 403 when actor lacks production.update and production.manage', async () => {
      await expect(service.update('order-1', { version: 1 }, ACTOR_VIEWER))
        .rejects.toThrow(ForbiddenException);
    });

    it('updates a DRAFT order successfully', async () => {
      const updated = makeOrder({ title: 'Updated', version: 2 });
      mockTxOrderUpdateMany.mockResolvedValue({ count: 1 });
      mockTxOrderFindUniqueOrThrow.mockResolvedValue(updated);
      mockTxActivityCreate.mockResolvedValue({});
      const result = await service.update('order-1', { version: 1, title: 'Updated' }, ACTOR_MANAGER);
      expect(result).toEqual(updated);
      expect(mockTxOrderUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ version: 1, status: 'DRAFT' }),
        data: expect.objectContaining({ version: { increment: 1 } }),
      }));
    });

    it('throws 404 when order does not exist (count=0 + findUnique=null)', async () => {
      mockTxOrderUpdateMany.mockResolvedValue({ count: 0 });
      mockOrderFindUnique.mockResolvedValue(null);
      await expect(service.update('order-99', { version: 1 }, ACTOR_MANAGER))
        .rejects.toThrow(NotFoundException);
    });

    it('throws 409 on version mismatch (count=0 + order exists)', async () => {
      mockTxOrderUpdateMany.mockResolvedValue({ count: 0 });
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1' });
      await expect(service.update('order-1', { version: 1 }, ACTOR_MANAGER))
        .rejects.toThrow(ConflictException);
    });
  });

  // ---- schedule ----

  describe('schedule', () => {
    it('throws 403 when actor lacks production.schedule', async () => {
      await expect(service.schedule('order-1', { version: 1 }, ACTOR_VIEWER))
        .rejects.toThrow(ForbiddenException);
    });

    it('transitions DRAFT → SCHEDULED', async () => {
      const scheduled = makeOrder({ status: 'SCHEDULED', version: 2 });
      mockTxOrderUpdateMany.mockResolvedValue({ count: 1 });
      mockTxOrderFindUniqueOrThrow.mockResolvedValue(scheduled);
      mockTxActivityCreate.mockResolvedValue({});
      const result = await service.schedule('order-1', { version: 1 }, ACTOR_MANAGER);
      expect(result).toEqual(scheduled);
      expect(mockTxOrderUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: 'DRAFT', version: 1 }),
        data: expect.objectContaining({ status: 'SCHEDULED' }),
      }));
    });

    it('throws 422 when order is not in DRAFT (wrong status path)', async () => {
      mockTxOrderUpdateMany.mockResolvedValue({ count: 0 });
      mockTxOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'IN_PROGRESS' });
      await expect(service.schedule('order-1', { version: 1 }, ACTOR_MANAGER))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 409 on version conflict for schedule', async () => {
      mockTxOrderUpdateMany.mockResolvedValue({ count: 0 });
      mockTxOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'DRAFT' });
      await expect(service.schedule('order-1', { version: 1 }, ACTOR_MANAGER))
        .rejects.toThrow(ConflictException);
    });

    it('throws 404 when order not found during schedule', async () => {
      mockTxOrderUpdateMany.mockResolvedValue({ count: 0 });
      mockTxOrderFindUnique.mockResolvedValue(null);
      await expect(service.schedule('order-99', { version: 1 }, ACTOR_MANAGER))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ---- start ----

  describe('start', () => {
    it('throws 403 when actor lacks production.start', async () => {
      await expect(service.start('order-1', { version: 1 }, ACTOR_VIEWER))
        .rejects.toThrow(ForbiddenException);
    });

    it('transitions SCHEDULED → IN_PROGRESS with startedAt timestamp', async () => {
      const inProgress = makeOrder({ status: 'IN_PROGRESS', startedByUserId: 'user-2' });
      mockTxOrderUpdateMany.mockResolvedValue({ count: 1 });
      mockTxOrderFindUniqueOrThrow.mockResolvedValue(inProgress);
      mockTxActivityCreate.mockResolvedValue({});
      await service.start('order-1', { version: 2 }, ACTOR_MANAGER);
      expect(mockTxOrderUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: 'SCHEDULED' }),
        data: expect.objectContaining({ status: 'IN_PROGRESS', startedByUserId: ACTOR_MANAGER.id }),
      }));
    });
  });

  // ---- pause ----

  describe('pause', () => {
    it('throws 403 when actor lacks production.pause', async () => {
      await expect(service.pause('order-1', { version: 1 }, ACTOR_VIEWER))
        .rejects.toThrow(ForbiddenException);
    });

    it('transitions IN_PROGRESS → PAUSED with optional reason', async () => {
      const paused = makeOrder({ status: 'PAUSED', pauseReason: 'Machine breakdown' });
      mockTxOrderUpdateMany.mockResolvedValue({ count: 1 });
      mockTxOrderFindUniqueOrThrow.mockResolvedValue(paused);
      mockTxActivityCreate.mockResolvedValue({});
      await service.pause('order-1', { version: 3, reason: 'Machine breakdown' }, ACTOR_MANAGER);
      expect(mockTxOrderUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: 'IN_PROGRESS' }),
        data: expect.objectContaining({ pauseReason: 'Machine breakdown' }),
      }));
    });
  });

  // ---- resume ----

  describe('resume', () => {
    it('throws 403 when actor lacks production.resume', async () => {
      await expect(service.resume('order-1', { version: 1 }, ACTOR_VIEWER))
        .rejects.toThrow(ForbiddenException);
    });

    it('transitions PAUSED → IN_PROGRESS', async () => {
      mockTxOrderUpdateMany.mockResolvedValue({ count: 1 });
      mockTxOrderFindUniqueOrThrow.mockResolvedValue(makeOrder({ status: 'IN_PROGRESS' }));
      mockTxActivityCreate.mockResolvedValue({});
      await service.resume('order-1', { version: 4 }, ACTOR_MANAGER);
      expect(mockTxOrderUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: 'PAUSED' }),
        data: expect.objectContaining({ status: 'IN_PROGRESS' }),
      }));
    });
  });

  // ---- complete ----

  describe('complete', () => {
    it('throws 403 when actor lacks production.complete', async () => {
      await expect(service.complete('order-1', { version: 1 }, ACTOR_VIEWER))
        .rejects.toThrow(ForbiddenException);
    });

    it('transitions IN_PROGRESS → COMPLETED', async () => {
      const completed = makeOrder({ status: 'COMPLETED' });
      mockTxOrderUpdateMany.mockResolvedValue({ count: 1 });
      mockTxOrderFindUniqueOrThrow.mockResolvedValue(completed);
      mockTxActivityCreate.mockResolvedValue({});
      const result = await service.complete('order-1', { version: 3 }, ACTOR_MANAGER);
      expect(result).toEqual(completed);
    });
  });

  // ---- cancel ----

  describe('cancel', () => {
    it('throws 403 when actor lacks production.cancel', async () => {
      await expect(service.cancel('order-1', { version: 1 }, ACTOR_VIEWER))
        .rejects.toThrow(ForbiddenException);
    });

    it('cancels an IN_PROGRESS order', async () => {
      const cancelled = makeOrder({ status: 'CANCELLED', version: 4 });
      mockTxOrderUpdateMany.mockResolvedValue({ count: 1 });
      mockTxOrderFindUniqueOrThrow.mockResolvedValue(cancelled);
      mockTxActivityCreate.mockResolvedValue({});
      const result = await service.cancel('order-1', { version: 3, reason: 'Plan change' }, ACTOR_MANAGER);
      expect(result).toEqual(cancelled);
      expect(mockTxOrderUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: { in: expect.arrayContaining(['DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'PAUSED']) } }),
      }));
    });

    it('throws 404 when order does not exist during cancel', async () => {
      mockTxOrderUpdateMany.mockResolvedValue({ count: 0 });
      mockTxOrderFindUnique.mockResolvedValue(null);
      await expect(service.cancel('order-99', { version: 1 }, ACTOR_MANAGER))
        .rejects.toThrow(NotFoundException);
    });

    it('throws 422 when trying to cancel a COMPLETED order', async () => {
      mockTxOrderUpdateMany.mockResolvedValue({ count: 0 });
      mockTxOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'COMPLETED' });
      await expect(service.cancel('order-1', { version: 1 }, ACTOR_MANAGER))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 409 on version conflict during cancel (order is cancellable)', async () => {
      mockTxOrderUpdateMany.mockResolvedValue({ count: 0 });
      mockTxOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'DRAFT' });
      await expect(service.cancel('order-1', { version: 1 }, ACTOR_MANAGER))
        .rejects.toThrow(ConflictException);
    });
  });

  // ---- addEntry ----

  describe('addEntry', () => {
    // Permission checks
    it('throws 403 for OUTPUT when actor lacks production.entries.create', async () => {
      await expect(service.addEntry('order-1', 'OUTPUT', { quantityProduced: 100 }, ACTOR_VIEWER))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for ADJUSTMENT when actor has entries.create but lacks production.manage', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'IN_PROGRESS', targetQuantity: 1000 });
      await expect(service.addEntry('order-1', 'ADJUSTMENT', { adjustmentQty: 10, note: 'Fix' }, ACTOR_OPERATOR))
        .rejects.toThrow(ForbiddenException);
    });

    // 404
    it('throws 404 when order does not exist', async () => {
      mockOrderFindUnique.mockResolvedValue(null);
      await expect(service.addEntry('order-99', 'OUTPUT', { quantityProduced: 100 }, ACTOR_MANAGER))
        .rejects.toThrow(NotFoundException);
    });

    // OUTPUT — status rules
    it('throws 422 for OUTPUT when order is DRAFT (not IN_PROGRESS)', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'DRAFT', targetQuantity: 1000 });
      await expect(service.addEntry('order-1', 'OUTPUT', { quantityProduced: 100 }, ACTOR_MANAGER))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 for OUTPUT when order is PAUSED (must be IN_PROGRESS only)', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'PAUSED', targetQuantity: 1000 });
      await expect(service.addEntry('order-1', 'OUTPUT', { quantityProduced: 100 }, ACTOR_MANAGER))
        .rejects.toThrow(UnprocessableEntityException);
    });

    // OUTPUT — field rules
    it('throws 422 for OUTPUT missing quantityProduced', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'IN_PROGRESS', targetQuantity: 1000 });
      await expect(service.addEntry('order-1', 'OUTPUT', {}, ACTOR_MANAGER))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 when accepted+rejected do not exactly equal quantityProduced', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'IN_PROGRESS', targetQuantity: 1000 });
      await expect(service.addEntry('order-1', 'OUTPUT', {
        quantityProduced: 100, quantityAccepted: 80, quantityRejected: 30,
      }, ACTOR_MANAGER)).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 when accepted+rejected are less than quantityProduced', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'IN_PROGRESS', targetQuantity: 1000 });
      await expect(service.addEntry('order-1', 'OUTPUT', {
        quantityProduced: 100, quantityAccepted: 80, quantityRejected: 10,
      }, ACTOR_MANAGER)).rejects.toThrow(UnprocessableEntityException);
    });

    it('creates an OUTPUT entry on IN_PROGRESS order when accepted+rejected exactly equal produced', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'IN_PROGRESS', targetQuantity: 1000 });
      const entry = { id: 'entry-1', type: 'OUTPUT', quantityProduced: 100 };
      mockEntryCreate.mockResolvedValue(entry);
      const result = await service.addEntry('order-1', 'OUTPUT', {
        quantityProduced: 100, quantityAccepted: 95, quantityRejected: 5,
      }, ACTOR_MANAGER);
      expect(result).toEqual(entry);
      expect(mockEntryCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ type: 'OUTPUT', quantityProduced: 100 }),
      }));
    });

    // DOWNTIME — status rules
    it('throws 422 for DOWNTIME when order is COMPLETED (not enterable)', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'COMPLETED', targetQuantity: 1000 });
      await expect(service.addEntry('order-1', 'DOWNTIME', { downtimeMinutes: 30, note: 'Breakdown' }, ACTOR_MANAGER))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 for DOWNTIME missing downtimeMinutes', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'IN_PROGRESS', targetQuantity: 1000 });
      await expect(service.addEntry('order-1', 'DOWNTIME', { note: 'Machine down' }, ACTOR_MANAGER))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 for DOWNTIME missing note (reason required)', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'IN_PROGRESS', targetQuantity: 1000 });
      await expect(service.addEntry('order-1', 'DOWNTIME', { downtimeMinutes: 30 }, ACTOR_MANAGER))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('creates a DOWNTIME entry on IN_PROGRESS order with required note', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'IN_PROGRESS', targetQuantity: 1000 });
      mockEntryCreate.mockResolvedValue({ id: 'entry-3', type: 'DOWNTIME', downtimeMinutes: 30 });
      await expect(service.addEntry('order-1', 'DOWNTIME', { downtimeMinutes: 30, note: 'Machine breakdown' }, ACTOR_MANAGER))
        .resolves.toBeDefined();
    });

    it('creates a DOWNTIME entry on PAUSED order', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'PAUSED', targetQuantity: 1000 });
      mockEntryCreate.mockResolvedValue({ id: 'entry-3b', type: 'DOWNTIME' });
      await expect(service.addEntry('order-1', 'DOWNTIME', { downtimeMinutes: 15, note: 'Power outage' }, ACTOR_MANAGER))
        .resolves.toBeDefined();
    });

    // ADJUSTMENT — status rules
    it('throws 422 for ADJUSTMENT when order is DRAFT', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'DRAFT', targetQuantity: 1000 });
      await expect(service.addEntry('order-1', 'ADJUSTMENT', { adjustmentQty: 10, note: 'Fix' }, ACTOR_MANAGER))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 for ADJUSTMENT with zero adjustmentQty', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'IN_PROGRESS', targetQuantity: 1000 });
      await expect(service.addEntry('order-1', 'ADJUSTMENT', { adjustmentQty: 0, note: 'No change' }, ACTOR_MANAGER))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 for ADJUSTMENT missing note (reason required)', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'IN_PROGRESS', targetQuantity: 1000 });
      await expect(service.addEntry('order-1', 'ADJUSTMENT', { adjustmentQty: -5 }, ACTOR_MANAGER))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 for ADJUSTMENT when resulting effectiveProduced would be negative', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'IN_PROGRESS', targetQuantity: 1000 });
      mockEntryFindMany.mockResolvedValue([]);  // effectiveProduced = 0
      await expect(service.addEntry('order-1', 'ADJUSTMENT', { adjustmentQty: -50, note: 'Over-adjustment' }, ACTOR_MANAGER))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('creates an ADJUSTMENT entry on IN_PROGRESS order', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'IN_PROGRESS', targetQuantity: 1000 });
      mockEntryFindMany.mockResolvedValue([
        { type: 'OUTPUT', quantityProduced: 100, quantityAccepted: 100, quantityRejected: 0, downtimeMinutes: null, adjustmentQty: null },
      ]);  // effectiveProduced = 100; -10 adjustment → 90 >= 0
      mockEntryCreate.mockResolvedValue({ id: 'entry-4', type: 'ADJUSTMENT', adjustmentQty: -10 });
      await expect(service.addEntry('order-1', 'ADJUSTMENT', { adjustmentQty: -10, note: 'Rework correction' }, ACTOR_MANAGER))
        .resolves.toBeDefined();
    });

    it('creates an ADJUSTMENT entry on COMPLETED order', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', status: 'COMPLETED', targetQuantity: 1000 });
      mockEntryFindMany.mockResolvedValue([]);
      mockEntryCreate.mockResolvedValue({ id: 'entry-5', type: 'ADJUSTMENT', adjustmentQty: 20 });
      await expect(service.addEntry('order-1', 'ADJUSTMENT', { adjustmentQty: 20, note: 'Post-completion correction' }, ACTOR_MANAGER))
        .resolves.toBeDefined();
    });
  });

  // ---- listEntries ----

  describe('listEntries', () => {
    it('throws 403 when actor lacks production.read', async () => {
      await expect(service.listEntries('order-1', ACTOR_NONE)).rejects.toThrow(ForbiddenException);
    });

    it('returns entries for a valid order', async () => {
      mockOrderFindUnique.mockResolvedValue(makeOrder());
      mockEntryFindMany.mockResolvedValue([{ id: 'entry-1', type: 'OUTPUT' }]);
      const result = await service.listEntries('order-1', ACTOR_VIEWER);
      expect(result).toHaveLength(1);
    });
  });

  // ---- getMetrics ----

  describe('getMetrics', () => {
    it('throws 403 when actor lacks production.read', async () => {
      await expect(service.getMetrics('order-1', ACTOR_NONE)).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when order does not exist', async () => {
      mockOrderFindUnique.mockResolvedValue(null);
      await expect(service.getMetrics('order-99', ACTOR_VIEWER)).rejects.toThrow(NotFoundException);
    });

    it('computes metrics from DB entries', async () => {
      mockOrderFindUnique.mockResolvedValue({ id: 'order-1', targetQuantity: 1000 });
      mockEntryFindMany.mockResolvedValue([
        { type: 'OUTPUT', quantityProduced: 300, quantityAccepted: 290, quantityRejected: 10, downtimeMinutes: null, adjustmentQty: null },
      ]);
      const m = await service.getMetrics('order-1', ACTOR_VIEWER);
      expect(m.totalProduced).toBe(300);
      expect(m.remainingQuantity).toBe(700);
      expect(m.completionPercentage).toBe(30);
    });
  });

  // ---- addComment ----

  describe('addComment', () => {
    it('throws 403 when actor lacks production.comment', async () => {
      await expect(service.addComment('order-1', { body: 'hello' }, ACTOR_VIEWER))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when order does not exist', async () => {
      mockOrderFindUnique.mockResolvedValue(null);
      await expect(service.addComment('order-99', { body: 'hello' }, ACTOR_MANAGER))
        .rejects.toThrow(NotFoundException);
    });

    it('creates a comment', async () => {
      mockOrderFindUnique.mockResolvedValue(makeOrder());
      const comment = { id: 'cmt-1', body: 'hello' };
      mockCommentCreate.mockResolvedValue(comment);
      const result = await service.addComment('order-1', { body: 'hello' }, ACTOR_MANAGER);
      expect(result).toEqual(comment);
    });
  });

  // ---- listComments ----

  describe('listComments', () => {
    it('throws 403 when actor lacks production.read', async () => {
      await expect(service.listComments('order-1', ACTOR_NONE)).rejects.toThrow(ForbiddenException);
    });

    it('returns comments for valid order', async () => {
      mockOrderFindUnique.mockResolvedValue(makeOrder());
      mockCommentFindMany.mockResolvedValue([{ id: 'cmt-1', body: 'test' }]);
      const result = await service.listComments('order-1', ACTOR_VIEWER);
      expect(result).toHaveLength(1);
    });
  });

  // ---- listActivities ----

  describe('listActivities', () => {
    it('throws 403 when actor lacks production.read', async () => {
      await expect(service.listActivities('order-1', ACTOR_NONE)).rejects.toThrow(ForbiddenException);
    });

    it('returns activities for valid order', async () => {
      mockOrderFindUnique.mockResolvedValue(makeOrder());
      mockActivityFindMany.mockResolvedValue([{ id: 'act-1', event: 'created' }]);
      const result = await service.listActivities('order-1', ACTOR_VIEWER);
      expect(result).toHaveLength(1);
    });
  });

  // ---- getSummary ----

  describe('getSummary', () => {
    it('throws 403 when actor lacks production.read', async () => {
      await expect(service.getSummary(ACTOR_NONE)).rejects.toThrow(ForbiddenException);
    });

    it('returns counts for all statuses', async () => {
      mockOrderCount
        .mockResolvedValueOnce(3)  // DRAFT
        .mockResolvedValueOnce(2)  // SCHEDULED
        .mockResolvedValueOnce(5)  // IN_PROGRESS
        .mockResolvedValueOnce(1)  // PAUSED
        .mockResolvedValueOnce(10) // COMPLETED
        .mockResolvedValueOnce(4); // CANCELLED
      const result = await service.getSummary(ACTOR_VIEWER);
      expect(result.totalDraft).toBe(3);
      expect(result.totalInProgress).toBe(5);
      expect(result.totalCompleted).toBe(10);
    });
  });

  // ---- org selectors ----

  describe('listDepartments', () => {
    it('throws 403 when actor lacks production.read', async () => {
      await expect(service.listDepartments(ACTOR_NONE)).rejects.toThrow(ForbiddenException);
    });

    it('returns active departments', async () => {
      mockDepartmentFindMany.mockResolvedValue([{ id: 'd1', name: 'Engineering', code: 'ENG' }]);
      const result = await service.listDepartments(ACTOR_VIEWER);
      expect(result).toHaveLength(1);
      expect(mockDepartmentFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
    });
  });

  describe('listPlants', () => {
    it('throws 403 when actor lacks production.read', async () => {
      await expect(service.listPlants(ACTOR_NONE)).rejects.toThrow(ForbiddenException);
    });

    it('returns active plants', async () => {
      mockPlantFindMany.mockResolvedValue([{ id: 'p1', name: 'Plant A', code: 'PA' }]);
      const result = await service.listPlants(ACTOR_VIEWER);
      expect(result).toHaveLength(1);
    });
  });

  describe('listPeople', () => {
    it('throws 403 when actor lacks production.read', async () => {
      await expect(service.listPeople(ACTOR_NONE)).rejects.toThrow(ForbiddenException);
    });

    it('returns active users', async () => {
      mockUserFindMany.mockResolvedValue([{ id: 'u1', displayName: 'Alice', departmentId: null }]);
      const result = await service.listPeople(ACTOR_VIEWER);
      expect(result).toHaveLength(1);
    });
  });

  describe('listLocations', () => {
    it('throws 403 when actor lacks production.read', async () => {
      await expect(service.listLocations(ACTOR_NONE)).rejects.toThrow(ForbiddenException);
    });

    it('returns active locations', async () => {
      mockLocationFindMany.mockResolvedValue([{ id: 'loc-1', name: 'Warehouse A', code: 'WA', plantId: null }]);
      const result = await service.listLocations(ACTOR_VIEWER);
      expect(result).toHaveLength(1);
      expect(mockLocationFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
    });
  });

  describe('getDashboard', () => {
    it('throws ForbiddenException without production.read', async () => {
      await expect(service.getDashboard(ACTOR_NONE)).rejects.toThrow(ForbiddenException);
    });

    it('returns ALL_DEPARTMENTS scope and correct metrics when no dept filter', async () => {
      mockGetScope.mockResolvedValueOnce(DepartmentAccessScope.ALL_DEPARTMENTS);
      mockOrderCount
        .mockResolvedValueOnce(6)  // scheduledOrders
        .mockResolvedValueOnce(3)  // inProgressOrders
        .mockResolvedValueOnce(1)  // pausedOrders
        .mockResolvedValueOnce(8); // completedThisMonth
      mockOrderFindMany.mockResolvedValueOnce([
        { id: 'ord-r1', referenceNumber: 'PROD-001', title: 'Batch Alpha', status: 'SCHEDULED', updatedAt: new Date('2026-07-01T06:00:00Z') },
      ]);

      const result = await service.getDashboard(ACTOR_VIEWER);

      expect(result.scope.type).toBe(DepartmentAccessScope.ALL_DEPARTMENTS);
      expect(result.scope.departmentNames).toEqual([]);
      expect(result.metrics.scheduledOrders).toBe(6);
      expect(result.metrics.inProgressOrders).toBe(3);
      expect(result.metrics.pausedOrders).toBe(1);
      expect(result.metrics.completedThisMonth).toBe(8);
      expect(result.recent).toHaveLength(1);
      expect(result.recent[0]?.referenceNumber).toBe('PROD-001');
      expect(result.recent[0]?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
