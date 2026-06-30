import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PlantsService } from './plants.service';
import type { DatabaseService } from '../../database/database.service';

const mockCreate = vi.fn();
const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

const mockClient = {
  plant: {
    create: mockCreate,
    findMany: mockFindMany,
    count: mockCount,
    findUnique: mockFindUnique,
    update: mockUpdate,
  },
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockPlant = {
  id: 'b2c3d4e5-0000-0000-0000-000000000001',
  code: 'PLT-01',
  name: 'Plant 01',
  description: null,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('PlantsService', () => {
  let service: PlantsService;

  beforeEach(() => {
    vi.clearAllMocks();
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
    it('sets isActive=true on activate', async () => {
      mockFindUnique.mockResolvedValue(mockPlant);
      mockUpdate.mockResolvedValue({ ...mockPlant, isActive: true });
      await service.activate(mockPlant.id);
      expect(mockUpdate).toHaveBeenCalledWith({ where: { id: mockPlant.id }, data: { isActive: true } });
    });

    it('sets isActive=false on deactivate', async () => {
      mockFindUnique.mockResolvedValue(mockPlant);
      mockUpdate.mockResolvedValue({ ...mockPlant, isActive: false });
      await service.deactivate(mockPlant.id);
      expect(mockUpdate).toHaveBeenCalledWith({ where: { id: mockPlant.id }, data: { isActive: false } });
    });
  });
});
