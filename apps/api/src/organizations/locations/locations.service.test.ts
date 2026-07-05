import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException, BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { LocationsService } from './locations.service';
import type { DatabaseService } from '../../database/database.service';

const plantId = 'p0000000-0000-0000-0000-000000000001';
const mockPlant = { id: plantId, code: 'PLT-01', name: 'Plant 01' };

const mockLocCreate = vi.fn();
const mockLocFindMany = vi.fn();
const mockLocCount = vi.fn();
const mockLocFindUnique = vi.fn();
const mockLocUpdate = vi.fn();
const mockLocDelete = vi.fn();
const mockPlantFindUnique = vi.fn();
const mockAuditCreate = vi.fn();

// Dependency count mocks
const mockUserCount = vi.fn();
const mockIncidentCount = vi.fn();
const mockTaskCount = vi.fn();
const mockMaintenanceCount = vi.fn();
const mockSafetyCount = vi.fn();
const mockContractCount = vi.fn();
const mockLineCount = vi.fn();

const mockClient = {
  location: {
    create: mockLocCreate,
    findMany: mockLocFindMany,
    count: mockLocCount,
    findUnique: mockLocFindUnique,
    update: mockLocUpdate,
    delete: mockLocDelete,
  },
  plant: { findUnique: mockPlantFindUnique },
  securityAuditEvent: { create: mockAuditCreate },
  user: { count: mockUserCount },
  incident: { count: mockIncidentCount },
  factoryTask: { count: mockTaskCount },
  maintenanceRequest: { count: mockMaintenanceCount },
  safetyInspection: { count: mockSafetyCount },
  contract: { count: mockContractCount },
  productionLine: { count: mockLineCount },
  $transaction: vi.fn((fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient)),
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockLocation = {
  id: 'c3d4e5f6-0000-0000-0000-000000000001',
  code: 'LOC-A1',
  name: 'Location A1',
  description: null,
  plantId: null,
  isActive: true,
  archivedAt: null,
  archivedByUserId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  plant: null,
};

const ACTOR_ID = 'actor-uuid-0001';

const zeroCounts = () => {
  mockUserCount.mockResolvedValue(0);
  mockIncidentCount.mockResolvedValue(0);
  mockTaskCount.mockResolvedValue(0);
  mockMaintenanceCount.mockResolvedValue(0);
  mockSafetyCount.mockResolvedValue(0);
  mockContractCount.mockResolvedValue(0);
  mockLineCount.mockResolvedValue(0);
};

describe('LocationsService', () => {
  let service: LocationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.$transaction.mockImplementation((fn: (tx: typeof mockClient) => Promise<unknown>) =>
      fn(mockClient),
    );
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
    it('activates location and emits audit event', async () => {
      mockLocFindUnique.mockResolvedValue(mockLocation);
      mockLocUpdate.mockResolvedValue({ ...mockLocation, isActive: true });
      mockAuditCreate.mockResolvedValue({});
      await service.activate(mockLocation.id, ACTOR_ID);
      expect(mockLocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: true } }),
      );
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ event: 'location_activated' }) }),
      );
    });

    it('deactivates location and emits audit event', async () => {
      mockLocFindUnique.mockResolvedValue(mockLocation);
      mockLocUpdate.mockResolvedValue({ ...mockLocation, isActive: false });
      mockAuditCreate.mockResolvedValue({});
      await service.deactivate(mockLocation.id, ACTOR_ID);
      expect(mockLocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ event: 'location_deactivated' }) }),
      );
    });
  });

  describe('archive', () => {
    it('sets isActive=false and archivedAt and emits audit event', async () => {
      mockLocFindUnique.mockResolvedValue(mockLocation);
      const archived = { ...mockLocation, isActive: false, archivedAt: new Date(), archivedByUserId: ACTOR_ID };
      mockLocUpdate.mockResolvedValue(archived);
      mockAuditCreate.mockResolvedValue({});

      const result = await service.archive(mockLocation.id, ACTOR_ID);

      expect(result.isActive).toBe(false);
      expect(mockLocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false, archivedByUserId: ACTOR_ID }),
        }),
      );
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ event: 'location_archived', actorId: ACTOR_ID }) }),
      );
    });

    it('throws 404 when location does not exist', async () => {
      mockLocFindUnique.mockResolvedValue(null);
      await expect(service.archive('missing', ACTOR_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkDependencies', () => {
    it('returns canDelete=true when no dependencies exist', async () => {
      mockLocFindUnique.mockResolvedValue(mockLocation);
      zeroCounts();
      const result = await service.checkDependencies(mockLocation.id);
      expect(result.canDelete).toBe(true);
      expect(result.dependencies).toEqual({});
    });

    it('returns canDelete=false with user count when users reference location', async () => {
      mockLocFindUnique.mockResolvedValue(mockLocation);
      zeroCounts();
      mockUserCount.mockResolvedValue(2);
      const result = await service.checkDependencies(mockLocation.id);
      expect(result.canDelete).toBe(false);
      expect(result.dependencies['users']).toBe(2);
    });
  });

  describe('delete', () => {
    it('hard-deletes an unused location and emits audit event', async () => {
      mockLocFindUnique.mockResolvedValue(mockLocation);
      zeroCounts();
      mockLocDelete.mockResolvedValue(mockLocation);
      mockAuditCreate.mockResolvedValue({});

      await service.delete(mockLocation.id, ACTOR_ID);

      expect(mockLocDelete).toHaveBeenCalledWith({ where: { id: mockLocation.id } });
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event: 'location_permanently_deleted', actorId: ACTOR_ID }),
        }),
      );
    });

    it('throws 422 LOCATION_HAS_DEPENDENCIES and emits blocked event when references exist', async () => {
      mockLocFindUnique.mockResolvedValue(mockLocation);
      zeroCounts();
      mockUserCount.mockResolvedValue(1);
      mockAuditCreate.mockResolvedValue({});

      await expect(service.delete(mockLocation.id, ACTOR_ID)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(mockLocDelete).not.toHaveBeenCalled();
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event: 'location_delete_blocked' }),
        }),
      );
    });
  });
});
