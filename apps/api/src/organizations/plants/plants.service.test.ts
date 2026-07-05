import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { PlantsService } from './plants.service';
import type { DatabaseService } from '../../database/database.service';

const mockCreate = vi.fn();
const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockAuditCreate = vi.fn();

// Dependency count mocks
const mockLocationCount = vi.fn();
const mockUserCount = vi.fn();
const mockIncidentCount = vi.fn();
const mockTaskCount = vi.fn();
const mockMaintenanceCount = vi.fn();
const mockSafetyCount = vi.fn();
const mockContractCount = vi.fn();
const mockLineCount = vi.fn();
const mockOrderCount = vi.fn();

const mockClient = {
  plant: {
    create: mockCreate,
    findMany: mockFindMany,
    count: mockCount,
    findUnique: mockFindUnique,
    update: mockUpdate,
    delete: mockDelete,
  },
  securityAuditEvent: { create: mockAuditCreate },
  location: { count: mockLocationCount },
  user: { count: mockUserCount },
  incident: { count: mockIncidentCount },
  factoryTask: { count: mockTaskCount },
  maintenanceRequest: { count: mockMaintenanceCount },
  safetyInspection: { count: mockSafetyCount },
  contract: { count: mockContractCount },
  productionLine: { count: mockLineCount },
  productionOrder: { count: mockOrderCount },
  $transaction: vi.fn((fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient)),
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockPlant = {
  id: 'b2c3d4e5-0000-0000-0000-000000000001',
  code: 'PLT-01',
  name: 'Plant 01',
  description: null,
  isActive: true,
  archivedAt: null,
  archivedByUserId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const ACTOR_ID = 'actor-uuid-0001';

const zeroCounts = () => {
  mockLocationCount.mockResolvedValue(0);
  mockUserCount.mockResolvedValue(0);
  mockIncidentCount.mockResolvedValue(0);
  mockTaskCount.mockResolvedValue(0);
  mockMaintenanceCount.mockResolvedValue(0);
  mockSafetyCount.mockResolvedValue(0);
  mockContractCount.mockResolvedValue(0);
  mockLineCount.mockResolvedValue(0);
  mockOrderCount.mockResolvedValue(0);
};

describe('PlantsService', () => {
  let service: PlantsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.$transaction.mockImplementation((fn: (tx: typeof mockClient) => Promise<unknown>) =>
      fn(mockClient),
    );
    service = new PlantsService(mockDb);
  });

  describe('create', () => {
    it('stores record with normalized code and null description', async () => {
      mockCreate.mockResolvedValue(mockPlant);
      await service.create({ code: 'PLT-01', name: 'Plant 01' });
      expect(mockCreate).toHaveBeenCalledWith({
        data: { code: 'PLT-01', name: 'Plant 01', description: null },
      });
    });

    it('throws ConflictException with DUPLICATE_CODE on P2002', async () => {
      mockCreate.mockRejectedValue({ code: 'P2002' });
      await expect(service.create({ code: 'PLT-01', name: 'Plant 01' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated items', async () => {
      mockFindMany.mockResolvedValue([mockPlant]);
      mockCount.mockResolvedValue(1);
      const result = await service.findAll({});
      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('filters by isActive', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      await service.findAll({ isActive: true });
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
      );
    });

    it('applies search to name and code', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      await service.findAll({ search: 'pla' });
      const call = mockFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
      expect((call.where?.['OR'] as unknown[]).length).toBe(2);
    });
  });

  describe('findOne', () => {
    it('returns plant when found', async () => {
      mockFindUnique.mockResolvedValue(mockPlant);
      const result = await service.findOne(mockPlant.id);
      expect(result.id).toBe(mockPlant.id);
    });

    it('throws NotFoundException when not found', async () => {
      mockFindUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates only provided fields', async () => {
      mockFindUnique.mockResolvedValue(mockPlant);
      mockUpdate.mockResolvedValue({ ...mockPlant, name: 'New Name' });
      await service.update(mockPlant.id, { name: 'New Name' });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: mockPlant.id },
        data: { name: 'New Name' },
      });
    });
  });

  describe('activate / deactivate', () => {
    it('sets isActive=true on activate and emits audit event', async () => {
      mockFindUnique.mockResolvedValue(mockPlant);
      mockUpdate.mockResolvedValue({ ...mockPlant, isActive: true });
      mockAuditCreate.mockResolvedValue({});
      await service.activate(mockPlant.id, ACTOR_ID);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: true } }),
      );
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ event: 'plant_activated' }) }),
      );
    });

    it('sets isActive=false on deactivate and emits audit event', async () => {
      mockFindUnique.mockResolvedValue(mockPlant);
      mockUpdate.mockResolvedValue({ ...mockPlant, isActive: false });
      mockAuditCreate.mockResolvedValue({});
      await service.deactivate(mockPlant.id, ACTOR_ID);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ event: 'plant_deactivated' }) }),
      );
    });
  });

  describe('archive', () => {
    it('sets isActive=false, archivedAt and archivedByUserId and emits audit event', async () => {
      mockFindUnique.mockResolvedValue(mockPlant);
      const archived = { ...mockPlant, isActive: false, archivedAt: new Date(), archivedByUserId: ACTOR_ID };
      mockUpdate.mockResolvedValue(archived);
      mockAuditCreate.mockResolvedValue({});

      const result = await service.archive(mockPlant.id, ACTOR_ID);

      expect(result.isActive).toBe(false);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false, archivedByUserId: ACTOR_ID }),
        }),
      );
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ event: 'plant_archived', actorId: ACTOR_ID }) }),
      );
    });

    it('throws 404 when plant does not exist', async () => {
      mockFindUnique.mockResolvedValue(null);
      await expect(service.archive('missing', ACTOR_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkDependencies', () => {
    it('returns canDelete=true when no dependencies exist', async () => {
      mockFindUnique.mockResolvedValue(mockPlant);
      zeroCounts();
      const result = await service.checkDependencies(mockPlant.id);
      expect(result.canDelete).toBe(true);
      expect(result.dependencies).toEqual({});
    });

    it('returns canDelete=false with counts when locations reference plant', async () => {
      mockFindUnique.mockResolvedValue(mockPlant);
      zeroCounts();
      mockLocationCount.mockResolvedValue(3);
      const result = await service.checkDependencies(mockPlant.id);
      expect(result.canDelete).toBe(false);
      expect(result.dependencies['locations']).toBe(3);
    });
  });

  describe('delete', () => {
    it('hard-deletes an unused plant and emits audit event', async () => {
      mockFindUnique.mockResolvedValue(mockPlant);
      zeroCounts();
      mockDelete.mockResolvedValue(mockPlant);
      mockAuditCreate.mockResolvedValue({});

      await service.delete(mockPlant.id, ACTOR_ID);

      expect(mockDelete).toHaveBeenCalledWith({ where: { id: mockPlant.id } });
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event: 'plant_permanently_deleted', actorId: ACTOR_ID }),
        }),
      );
    });

    it('throws 422 PLANT_HAS_DEPENDENCIES and emits blocked event when references exist', async () => {
      mockFindUnique.mockResolvedValue(mockPlant);
      zeroCounts();
      mockLocationCount.mockResolvedValue(2);
      mockAuditCreate.mockResolvedValue({});

      await expect(service.delete(mockPlant.id, ACTOR_ID)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event: 'plant_delete_blocked' }),
        }),
      );
    });
  });
});
