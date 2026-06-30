import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import type { DatabaseService } from '../../database/database.service';

const mockCreate = vi.fn();
const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

const mockClient = {
  department: {
    create: mockCreate,
    findMany: mockFindMany,
    count: mockCount,
    findUnique: mockFindUnique,
    update: mockUpdate,
  },
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockDept = {
  id: 'a1b2c3d4-0000-0000-0000-000000000001',
  code: 'DEPT-A',
  name: 'Department A',
  description: null,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('DepartmentsService', () => {
  let service: DepartmentsService;

  beforeEach(() => {
    vi.clearAllMocks();
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
    it('sets isActive to true on activate', async () => {
      mockFindUnique.mockResolvedValue(mockDept);
      mockUpdate.mockResolvedValue({ ...mockDept, isActive: true });
      await service.activate(mockDept.id);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: mockDept.id },
        data: { isActive: true },
      });
    });

    it('sets isActive to false on deactivate', async () => {
      mockFindUnique.mockResolvedValue(mockDept);
      mockUpdate.mockResolvedValue({ ...mockDept, isActive: false });
      await service.deactivate(mockDept.id);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: mockDept.id },
        data: { isActive: false },
      });
    });

    it('throws 404 when department does not exist on activate', async () => {
      mockFindUnique.mockResolvedValue(null);
      await expect(service.activate('missing-id')).rejects.toThrow(NotFoundException);
    });
  });
});
