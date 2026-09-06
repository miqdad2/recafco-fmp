import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import {
  ContractBoqProductionService,
  computeTotalQty,
  computeStockNotDelivered,
  computeRemainingToCast,
  computePercentOfTotal,
  computeProductionSummary,
  assertProductionAmountsValid,
  type ProductionItemRow,
} from './contract-boq-production.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';

// ---------------------------------------------------------------------------
// Client mocks
// ---------------------------------------------------------------------------

const mockBoqItemFindMany = vi.fn();
const mockBoqItemFindUnique = vi.fn();
const mockProductionStatusUpsert = vi.fn();
const mockContractFindUnique = vi.fn();

const mockClient = {
  contractBoqItem: {
    findMany: mockBoqItemFindMany,
    findUnique: mockBoqItemFindUnique,
  },
  contractBoqItemProductionStatus: {
    upsert: mockProductionStatusUpsert,
  },
  contract: { findUnique: mockContractFindUnique },
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockAssertCanAccessDepartment = vi.fn().mockResolvedValue(undefined);

const mockDeptAccess = {
  assertCanAccessDepartment: mockAssertCanAccessDepartment,
} as unknown as DepartmentAccessService;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR_READ_ONLY: AuthUser = {
  id: 'user-viewer-1',
  username: 'viewer',
  displayName: 'Viewer',
  roleId: 'role-viewer',
  roleCode: 'VIEWER',
  roleName: 'Viewer',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-1',
  departmentId: null,
  permissions: ['contracts.read'],
};

const ACTOR_UPDATE: AuthUser = {
  id: 'user-manager-1',
  username: 'manager',
  displayName: 'Manager',
  roleId: 'role-admin',
  roleCode: 'ADMIN',
  roleName: 'Admin',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-2',
  departmentId: null,
  permissions: ['contracts.read', 'contracts.update'],
};

function makeBoqItemRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'boq-item-1',
    itemCode: 'ITEM-001',
    category: 'Columns',
    description: 'Precast Concrete Columns',
    unitOfMeasure: 'Nos',
    originalEstimatedQty: 1200,
    revisedQty: null,
    sortOrder: 1,
    productionStatus: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('computeTotalQty', () => {
  it('prefers revisedQty when present', () => {
    expect(computeTotalQty({ originalEstimatedQty: 100, revisedQty: 150 })).toBe(150);
  });

  it('falls back to originalEstimatedQty when revisedQty is null', () => {
    expect(computeTotalQty({ originalEstimatedQty: 100, revisedQty: null })).toBe(100);
  });

  it('returns 0 when both are null (never fake data)', () => {
    expect(computeTotalQty({ originalEstimatedQty: null, revisedQty: null })).toBe(0);
  });
});

describe('computeStockNotDelivered', () => {
  it('is produced minus delivered', () => {
    expect(computeStockNotDelivered(1050, 800)).toBe(250);
  });

  it('is divide-by-zero safe / never negative-surprising with zero inputs', () => {
    expect(computeStockNotDelivered(0, 0)).toBe(0);
  });
});

describe('computeRemainingToCast', () => {
  it('is total minus produced', () => {
    expect(computeRemainingToCast(1200, 1050)).toBe(150);
  });

  it('returns 0 when total is 0 (no BOQ qty to remain against)', () => {
    expect(computeRemainingToCast(0, 0)).toBe(0);
  });
});

describe('computePercentOfTotal', () => {
  it('computes a real percentage', () => {
    expect(computePercentOfTotal(7850, 12450)).toBeCloseTo(63.052, 2);
  });

  it('is divide-by-zero safe: returns 0 when total is 0', () => {
    expect(computePercentOfTotal(500, 0)).toBe(0);
  });

  it('is divide-by-zero safe: returns 0 when total is negative', () => {
    expect(computePercentOfTotal(500, -10)).toBe(0);
  });
});

describe('assertProductionAmountsValid', () => {
  it('passes for valid amounts within total', () => {
    expect(() => assertProductionAmountsValid({ producedQty: 500, deliveredQty: 300, totalQty: 1000 })).not.toThrow();
  });

  it('throws when delivered exceeds produced', () => {
    expect(() => assertProductionAmountsValid({ producedQty: 300, deliveredQty: 500, totalQty: 1000 })).toThrow(
      UnprocessableEntityException,
    );
  });

  it('throws when produced exceeds totalQty', () => {
    expect(() => assertProductionAmountsValid({ producedQty: 1500, deliveredQty: 0, totalQty: 1000 })).toThrow(
      UnprocessableEntityException,
    );
  });

  it('does not cap against a zero/unset totalQty (nothing real to cap against)', () => {
    expect(() => assertProductionAmountsValid({ producedQty: 500, deliveredQty: 0, totalQty: 0 })).not.toThrow();
  });
});

describe('computeProductionSummary', () => {
  it('sums real item values and derives stock/remaining/progress from the sums', () => {
    const items: ProductionItemRow[] = [
      {
        id: '1', itemCode: null, category: null, description: 'A', unitOfMeasure: null,
        totalQty: 1200, producedQty: 1050, deliveredQty: 800,
        stockNotDelivered: 250, remainingToCast: 150, progressPercent: 88,
        status: 'IN_PRODUCTION', remarks: null, updatedByUser: null, updatedAt: null,
      },
      {
        id: '2', itemCode: null, category: null, description: 'B', unitOfMeasure: null,
        totalQty: 2400, producedQty: 1800, deliveredQty: 1450,
        stockNotDelivered: 350, remainingToCast: 600, progressPercent: 75,
        status: 'PARTIALLY_DELIVERED', remarks: null, updatedByUser: null, updatedAt: null,
      },
    ];
    const summary = computeProductionSummary(items);
    expect(summary.totalQty).toBe(3600);
    expect(summary.producedQty).toBe(2850);
    expect(summary.deliveredQty).toBe(2250);
    expect(summary.stockNotDelivered).toBe(600);
    expect(summary.remainingToCast).toBe(750);
    expect(summary.progressPercent).toBeCloseTo(79.17, 1);
  });

  it('returns all zeros for an empty item list (no BOQ items — never fake rows)', () => {
    const summary = computeProductionSummary([]);
    expect(summary).toEqual({
      totalQty: 0, producedQty: 0, deliveredQty: 0, stockNotDelivered: 0, remainingToCast: 0, progressPercent: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// Service tests
// ---------------------------------------------------------------------------

describe('ContractBoqProductionService', () => {
  let service: ContractBoqProductionService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertCanAccessDepartment.mockResolvedValue(undefined);
    service = new ContractBoqProductionService(mockDb, mockDeptAccess);
  });

  describe('findAllForContract', () => {
    it('throws ForbiddenException without contracts.read', async () => {
      await expect(service.findAllForContract('contract-1', { ...ACTOR_READ_ONLY, permissions: [] })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException for a missing contract', async () => {
      mockContractFindUnique.mockResolvedValueOnce(null);
      await expect(service.findAllForContract('missing', ACTOR_READ_ONLY)).rejects.toThrow(NotFoundException);
    });

    it('enforces department scope via assertCanAccessDepartment', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockBoqItemFindMany.mockResolvedValueOnce([]);
      await service.findAllForContract('contract-1', ACTOR_READ_ONLY);
      expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_READ_ONLY, expect.anything(), 'dept-1');
    });

    it('returns real zero-filled derived fields for a BOQ item with no production row tracked yet', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockBoqItemFindMany.mockResolvedValueOnce([makeBoqItemRow()]);

      const result = await service.findAllForContract('contract-1', ACTOR_READ_ONLY);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        totalQty: 1200,
        producedQty: 0,
        deliveredQty: 0,
        stockNotDelivered: 0,
        remainingToCast: 1200,
        progressPercent: 0,
        status: 'NOT_STARTED',
      });
    });

    it('returns an empty item list and zeroed summary when the contract has no BOQ items', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockBoqItemFindMany.mockResolvedValueOnce([]);

      const result = await service.findAllForContract('contract-1', ACTOR_READ_ONLY);
      expect(result.items).toEqual([]);
      expect(result.summary.totalQty).toBe(0);
    });
  });

  describe('upsertForItem', () => {
    it('throws ForbiddenException without contracts.update', async () => {
      await expect(service.upsertForItem('boq-item-1', {}, ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for a missing BOQ item', async () => {
      mockBoqItemFindUnique.mockResolvedValueOnce(null);
      await expect(service.upsertForItem('missing', {}, ACTOR_UPDATE)).rejects.toThrow(NotFoundException);
    });

    it('enforces department scope via assertCanAccessDepartment', async () => {
      mockBoqItemFindUnique.mockResolvedValueOnce({
        ...makeBoqItemRow(),
        contract: { departmentId: 'dept-1' },
      });
      mockProductionStatusUpsert.mockResolvedValueOnce({
        producedQty: 100, deliveredQty: 50, status: 'IN_PRODUCTION', remarks: null, updatedAt: new Date(), updatedByUser: null,
      });

      await service.upsertForItem('boq-item-1', { producedQty: 100, deliveredQty: 50 }, ACTOR_UPDATE);
      expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_UPDATE, expect.anything(), 'dept-1');
    });

    it('throws UnprocessableEntityException when delivered exceeds produced', async () => {
      mockBoqItemFindUnique.mockResolvedValueOnce({
        ...makeBoqItemRow(),
        contract: { departmentId: 'dept-1' },
      });

      await expect(
        service.upsertForItem('boq-item-1', { producedQty: 100, deliveredQty: 500 }, ACTOR_UPDATE),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(mockProductionStatusUpsert).not.toHaveBeenCalled();
    });

    it('throws UnprocessableEntityException when produced exceeds the item Total Qty', async () => {
      mockBoqItemFindUnique.mockResolvedValueOnce({
        ...makeBoqItemRow({ originalEstimatedQty: 1000 }),
        contract: { departmentId: 'dept-1' },
      });

      await expect(
        service.upsertForItem('boq-item-1', { producedQty: 5000, deliveredQty: 0 }, ACTOR_UPDATE),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('validates against existing stored values when a field is omitted from the update', async () => {
      mockBoqItemFindUnique.mockResolvedValueOnce({
        ...makeBoqItemRow({ originalEstimatedQty: 1000 }),
        contract: { departmentId: 'dept-1' },
        productionStatus: { producedQty: 900, deliveredQty: 100 },
      });

      // Omitting producedQty means the existing 900 stays effective; delivered
      // update of 950 would exceed it.
      await expect(
        service.upsertForItem('boq-item-1', { deliveredQty: 950 }, ACTOR_UPDATE),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('creates the production row on first update and returns computed derived fields', async () => {
      mockBoqItemFindUnique.mockResolvedValueOnce({
        ...makeBoqItemRow({ originalEstimatedQty: 1200 }),
        contract: { departmentId: 'dept-1' },
      });
      mockProductionStatusUpsert.mockResolvedValueOnce({
        producedQty: 600, deliveredQty: 200, status: 'IN_PRODUCTION', remarks: 'Batch 1', updatedAt: new Date('2026-09-01'), updatedByUser: { id: 'user-manager-1', displayName: 'Manager' },
      });

      const result = await service.upsertForItem('boq-item-1', { producedQty: 600, deliveredQty: 200, status: 'IN_PRODUCTION', remarks: 'Batch 1' }, ACTOR_UPDATE);

      expect(mockProductionStatusUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contractBoqItemId: 'boq-item-1' },
          create: expect.objectContaining({ contractBoqItemId: 'boq-item-1', updatedByUserId: 'user-manager-1' }),
        }),
      );
      expect(result).toMatchObject({
        totalQty: 1200,
        producedQty: 600,
        deliveredQty: 200,
        stockNotDelivered: 400,
        remainingToCast: 600,
        progressPercent: 50,
        status: 'IN_PRODUCTION',
        remarks: 'Batch 1',
      });
    });
  });
});
