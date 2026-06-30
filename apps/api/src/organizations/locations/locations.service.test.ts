import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { LocationsService } from './locations.service';
import type { DatabaseService } from '../../database/database.service';

const plantId = 'p0000000-0000-0000-0000-000000000001';
const mockPlant = { id: plantId, code: 'PLT-01', name: 'Plant 01' };

const mockLocCreate = vi.fn();
const mockLocFindMany = vi.fn();
const mockLocCount = vi.fn();
const mockLocFindUnique = vi.fn();
const mockLocUpdate = vi.fn();
const mockPlantFindUnique = vi.fn();

const mockClient = {
  location: {
    create: mockLocCreate,
    findMany: mockLocFindMany,
    count: mockLocCount,
    findUnique: mockLocFindUnique,
    update: mockLocUpdate,
  },
  plant: { findUnique: mockPlantFindUnique },
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockLocation = {
  id: 'c3d4e5f6-0000-0000-0000-000000000001',
  code: 'LOC-A1',
  name: 'Location A1',
  description: null,
  plantId: null,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  plant: null,
};

describe('LocationsService', () => {
  let service: LocationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LocationsService(mockDb);
  });

  describe('create', () => {
    it('creates location with null plantId when omitted', async () => {
      mockLocCreate.mockResolvedValue(mockLocation);
      await service.create({ code: 'LOC-A1', name: 'Location A1' });
      expect(mockLocCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ plantId: null }) }),
      );
    });

    it('validates plant exists when plantId is provided', async () => {
      mockPlantFindUnique.mockResolvedValue(mockPlant);
      mockLocCreate.mockResolvedValue({ ...mockLocation, plantId, plant: mockPlant });
      await service.create({ code: 'LOC-A1', name: 'Location A1', plantId });
      expect(mockPlantFindUnique).toHaveBeenCalledWith({ where: { id: plantId } });
    });

    it('throws 400 INVALID_PLANT_ID when plantId references non-existent plant', async () => {
      mockPlantFindUnique.mockResolvedValue(null);
      await expect(
        service.create({ code: 'LOC-A1', name: 'Location A1', plantId: 'missing-id' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException with DUPLICATE_CODE on P2002', async () => {
      mockLocCreate.mockRejectedValue({ code: 'P2002' });
      await expect(service.create({ code: 'LOC-A1', name: 'Location A1' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated locations with plant data', async () => {
      mockLocFindMany.mockResolvedValue([mockLocation]);
      mockLocCount.mockResolvedValue(1);
      const result = await service.findAll({});
      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('includes plant relation in query', async () => {
      mockLocFindMany.mockResolvedValue([]);
      mockLocCount.mockResolvedValue(0);
      await service.findAll({});
      expect(mockLocFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { plant: { select: { id: true, code: true, name: true } } },
        }),
      );
    });

    it('filters by isActive', async () => {
      mockLocFindMany.mockResolvedValue([]);
      mockLocCount.mockResolvedValue(0);
      await service.findAll({ isActive: false });
      expect(mockLocFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: false }) }),
      );
    });
  });

  describe('findOne', () => {
    it('returns location with plant when found', async () => {
      mockLocFindUnique.mockResolvedValue(mockLocation);
      const result = await service.findOne(mockLocation.id);
      expect(result.id).toBe(mockLocation.id);
    });

    it('throws NotFoundException when not found', async () => {
      mockLocFindUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('removes plant when plantId set to null', async () => {
      mockLocFindUnique.mockResolvedValue(mockLocation);
      mockLocUpdate.mockResolvedValue({ ...mockLocation, plantId: null, plant: null });
      await service.update(mockLocation.id, { plantId: null });
      expect(mockLocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ plantId: null }) }),
      );
    });

    it('validates new plantId when provided', async () => {
      mockLocFindUnique.mockResolvedValue(mockLocation);
      mockPlantFindUnique.mockResolvedValue(mockPlant);
      mockLocUpdate.mockResolvedValue({ ...mockLocation, plantId, plant: mockPlant });
      await service.update(mockLocation.id, { plantId });
      expect(mockPlantFindUnique).toHaveBeenCalledWith({ where: { id: plantId } });
    });

    it('throws 400 when new plantId does not exist', async () => {
      mockLocFindUnique.mockResolvedValue(mockLocation);
      mockPlantFindUnique.mockResolvedValue(null);
      await expect(service.update(mockLocation.id, { plantId: 'bad-id' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('activate / deactivate', () => {
    it('activates location', async () => {
      mockLocFindUnique.mockResolvedValue(mockLocation);
      mockLocUpdate.mockResolvedValue({ ...mockLocation, isActive: true });
      await service.activate(mockLocation.id);
      expect(mockLocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: true } }),
      );
    });

    it('deactivates location', async () => {
      mockLocFindUnique.mockResolvedValue(mockLocation);
      mockLocUpdate.mockResolvedValue({ ...mockLocation, isActive: false });
      await service.deactivate(mockLocation.id);
      expect(mockLocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });
  });
});
