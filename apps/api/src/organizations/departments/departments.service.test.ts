import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import type { DatabaseService } from '../../database/database.service';

const mockCreate = vi.fn();
const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockAuditCreate = vi.fn();
const mockUserCount = vi.fn();
const mockGrantCount = vi.fn();
const mockTaskCount = vi.fn();
const mockIncidentCount = vi.fn();
const mockMaintenanceCount = vi.fn();
const mockSafetyCount = vi.fn();
const mockContractCount = vi.fn();
const mockProductionCount = vi.fn();

const mockClient = {
  department: {
    create: mockCreate,
    findMany: mockFindMany,
    count: mockCount,
    findUnique: mockFindUnique,
    update: mockUpdate,
    delete: mockDelete,
  },
  securityAuditEvent: { create: mockAuditCreate },
  user: { count: mockUserCount, findMany: vi.fn().mockResolvedValue([]) },
  userModuleAccess: { count: vi.fn().mockResolvedValue(0) },
  userModuleDepartmentGrant: { count: mockGrantCount },
  factoryTask: { count: mockTaskCount },
  incident: { count: mockIncidentCount },
  maintenanceRequest: { count: mockMaintenanceCount },
  safetyInspection: { count: mockSafetyCount },
  contract: { count: mockContractCount },
  productionOrder: { count: mockProductionCount },
  $transaction: vi.fn((fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient)),
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockDept = {
  id: 'a1b2c3d4-0000-0000-0000-000000000001',
  code: 'DEPT-A',
  name: 'Department A',
  description: null,
  isActive: true,
  archivedAt: null,
  archivedByUserId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const ACTOR_ID = 'actor-uuid-0001';

describe('DepartmentsService', () => {
  let service: DepartmentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.$transaction.mockImplementation((fn: (tx: typeof mockClient) => Promise<unknown>) =>
      fn(mockClient),
    );
    service = new DepartmentsService(mockDb);
  });

  describe('create', () => {
    it('normalizes code to uppercase via DTO transform and stores record', async () => {
      mockCreate.mockResolvedValue({ ...mockDept, code: 'DEPT-A' });
      const result = await service.create({ code: 'DEPT-A', name: 'Department A' });
      expect(result.code).toBe('DEPT-A');
      expect(mockCreate).toHaveBeenCalledWith({
        data: { code: 'DEPT-A', name: 'Department A', description: null },
      });
    });

    it('stores null description when omitted', async () => {
      mockCreate.mockResolvedValue(mockDept);
      await service.create({ code: 'DEPT-A', name: 'Department A' });
      expect(mockCreate.mock.calls[0]?.[0]).toMatchObject({ data: { description: null } });
    });

    it('stores provided description', async () => {
      mockCreate.mockResolvedValue({ ...mockDept, description: 'Main dept' });
      await service.create({ code: 'DEPT-A', name: 'Department A', description: 'Main dept' });
      expect(mockCreate.mock.calls[0]?.[0]).toMatchObject({ data: { description: 'Main dept' } });
    });

    it('throws ConflictException with DUPLICATE_CODE on P2002', async () => {
      mockCreate.mockRejectedValue({ code: 'P2002' });
      await expect(service.create({ code: 'DEPT-A', name: 'Department A' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('re-throws unexpected errors', async () => {
      mockCreate.mockRejectedValue(new Error('network error'));
      await expect(service.create({ code: 'DEPT-A', name: 'Department A' })).rejects.toThrow(
        'network error',
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated items with correct pagination metadata', async () => {
      mockFindMany.mockResolvedValue([mockDept]);
      mockCount.mockResolvedValue(42);
      const result = await service.findAll({ page: 2, pageSize: 10 });
      expect(result.items).toHaveLength(1);
      expect(result.pagination).toEqual({ page: 2, pageSize: 10, total: 42, totalPages: 5 });
      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    });

    it('defaults to page 1 / pageSize 20', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      const result = await service.findAll({});
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(20);
      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20 }));
    });

    it('applies isActive filter', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      await service.findAll({ isActive: false });
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: false }) }),
      );
    });

    it('applies case-insensitive search to name and code', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      await service.findAll({ search: 'ops' });
      const call = mockFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
      expect(call.where?.['OR']).toBeDefined();
      expect((call.where?.['OR'] as unknown[]).length).toBe(2);
    });

    it('orders by code ascending for deterministic results', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      await service.findAll({});
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ code: 'asc' }] }),
      );
    });
  });

  describe('findOne', () => {
    it('returns department when found', async () => {
      mockFindUnique.mockResolvedValue(mockDept);
      const result = await service.findOne(mockDept.id);
      expect(result.id).toBe(mockDept.id);
    });

    it('throws NotFoundException when not found', async () => {
      mockFindUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates only provided fields', async () => {
      mockFindUnique.mockResolvedValue(mockDept);
      mockUpdate.mockResolvedValue({ ...mockDept, name: 'Updated Name' });
      await service.update(mockDept.id, { name: 'Updated Name' });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: mockDept.id },
        data: { name: 'Updated Name' },
      });
    });

    it('throws 404 when department does not exist', async () => {
      mockFindUnique.mockResolvedValue(null);
      await expect(service.update('missing-id', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException on duplicate code during update', async () => {
      mockFindUnique.mockResolvedValue(mockDept);
      mockUpdate.mockRejectedValue({ code: 'P2002' });
      await expect(service.update(mockDept.id, { code: 'DEPT-B' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('activate / deactivate (idempotent)', () => {
    it('sets isActive to true on activate and emits audit event', async () => {
      mockFindUnique.mockResolvedValue(mockDept);
      mockUpdate.mockResolvedValue({ ...mockDept, isActive: true });
      mockAuditCreate.mockResolvedValue({});
      await service.activate(mockDept.id, ACTOR_ID);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: true } }),
      );
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ event: 'department_activated' }) }),
      );
    });

    it('sets isActive to false on deactivate and emits audit event', async () => {
      mockFindUnique.mockResolvedValue(mockDept);
      mockUpdate.mockResolvedValue({ ...mockDept, isActive: false });
      mockAuditCreate.mockResolvedValue({});
      await service.deactivate(mockDept.id, ACTOR_ID);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ event: 'department_deactivated' }) }),
      );
    });

    it('throws 404 when department does not exist on activate', async () => {
      mockFindUnique.mockResolvedValue(null);
      await expect(service.activate('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('archive', () => {
    it('sets isActive=false and archivedAt and emits audit event', async () => {
      mockFindUnique.mockResolvedValue(mockDept);
      const archived = { ...mockDept, isActive: false, archivedAt: new Date(), archivedByUserId: ACTOR_ID };
      mockUpdate.mockResolvedValue(archived);
      mockAuditCreate.mockResolvedValue({});

      const result = await service.archive(mockDept.id, ACTOR_ID);

      expect(result.isActive).toBe(false);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: false,
            archivedByUserId: ACTOR_ID,
          }),
        }),
      );
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ event: 'department_archived', actorId: ACTOR_ID }) }),
      );
    });

    it('throws 404 when department does not exist', async () => {
      mockFindUnique.mockResolvedValue(null);
      await expect(service.archive('missing-id', ACTOR_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkDependencies', () => {
    const zeroCounts = () => {
      mockUserCount.mockResolvedValue(0);
      mockGrantCount.mockResolvedValue(0);
      mockTaskCount.mockResolvedValue(0);
      mockIncidentCount.mockResolvedValue(0);
      mockMaintenanceCount.mockResolvedValue(0);
      mockSafetyCount.mockResolvedValue(0);
      mockContractCount.mockResolvedValue(0);
      mockProductionCount.mockResolvedValue(0);
    };

    it('returns canDelete=true when no dependencies exist', async () => {
      mockFindUnique.mockResolvedValue(mockDept);
      zeroCounts();
      const result = await service.checkDependencies(mockDept.id);
      expect(result.canDelete).toBe(true);
      expect(result.dependencies).toEqual({});
    });

    it('returns canDelete=false with dependency counts when references exist', async () => {
      mockFindUnique.mockResolvedValue(mockDept);
      zeroCounts();
      mockUserCount.mockResolvedValue(3);
      mockTaskCount.mockResolvedValue(2);

      const result = await service.checkDependencies(mockDept.id);
      expect(result.canDelete).toBe(false);
      expect(result.dependencies['users']).toBe(3);
      expect(result.dependencies['tasks']).toBe(2);
    });

    it('throws 404 when department does not exist', async () => {
      mockFindUnique.mockResolvedValue(null);
      await expect(service.checkDependencies('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    const zeroCounts = () => {
      mockUserCount.mockResolvedValue(0);
      mockGrantCount.mockResolvedValue(0);
      mockTaskCount.mockResolvedValue(0);
      mockIncidentCount.mockResolvedValue(0);
      mockMaintenanceCount.mockResolvedValue(0);
      mockSafetyCount.mockResolvedValue(0);
      mockContractCount.mockResolvedValue(0);
      mockProductionCount.mockResolvedValue(0);
    };

    it('hard-deletes an unused department and emits audit event', async () => {
      mockFindUnique.mockResolvedValue(mockDept);
      zeroCounts();
      mockDelete.mockResolvedValue(mockDept);
      mockAuditCreate.mockResolvedValue({});

      await service.delete(mockDept.id, ACTOR_ID);

      expect(mockDelete).toHaveBeenCalledWith({ where: { id: mockDept.id } });
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event: 'department_permanently_deleted', actorId: ACTOR_ID }),
        }),
      );
    });

    it('throws 422 DEPARTMENT_HAS_DEPENDENCIES when references exist and emits blocked audit event', async () => {
      mockFindUnique.mockResolvedValue(mockDept);
      zeroCounts();
      mockUserCount.mockResolvedValue(5);
      mockAuditCreate.mockResolvedValue({});

      await expect(service.delete(mockDept.id, ACTOR_ID)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event: 'department_delete_blocked' }),
        }),
      );
    });

    it('throws 404 when department does not exist', async () => {
      mockFindUnique.mockResolvedValue(null);
      await expect(service.delete('missing-id', ACTOR_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
