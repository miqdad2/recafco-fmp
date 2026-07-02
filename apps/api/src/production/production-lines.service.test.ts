import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { ProductionLinesService } from './production-lines.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLineFindUnique = vi.fn();
const mockLineFindMany = vi.fn();
const mockLineCount = vi.fn();
const mockLineCreate = vi.fn();
const mockLineUpdateMany = vi.fn();
const mockLineUpdate = vi.fn();
const mockLineFindUniqueOrThrow = vi.fn();

const mockClient = {
  productionLine: {
    findUnique: mockLineFindUnique,
    findMany: mockLineFindMany,
    count: mockLineCount,
    create: mockLineCreate,
    updateMany: mockLineUpdateMany,
    update: mockLineUpdate,
    findUniqueOrThrow: mockLineFindUniqueOrThrow,
  },
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR_READ: AuthUser = {
  id: 'user-1', username: 'u1', displayName: 'U1',
  roleId: 'r1', roleCode: 'OPS', roleName: 'Ops',
  mustChangePassword: false, isActive: true, sessionId: 's1',
  permissions: ['production.read', 'production.lines.read'],
};

const ACTOR_MANAGE: AuthUser = {
  id: 'user-2', username: 'u2', displayName: 'U2',
  roleId: 'r2', roleCode: 'MGR', roleName: 'Manager',
  mustChangePassword: false, isActive: true, sessionId: 's2',
  permissions: [
    'production.read', 'production.lines.read', 'production.lines.create',
    'production.lines.update', 'production.lines.manage',
  ],
};

const ACTOR_NONE: AuthUser = {
  id: 'user-3', username: 'u3', displayName: 'U3',
  roleId: 'r3', roleCode: 'VIEWER', roleName: 'Viewer',
  mustChangePassword: false, isActive: true, sessionId: 's3',
  permissions: [],
};

function makeLine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'line-1',
    code: 'LINE-A',
    name: 'Assembly Line A',
    description: null,
    plantId: null,
    locationId: null,
    capacity: null,
    isActive: true,
    version: 1,
    createdAt: new Date('2026-07-02'),
    updatedAt: new Date('2026-07-02'),
    plant: null,
    location: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProductionLinesService', () => {
  let service: ProductionLinesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProductionLinesService(mockDb);
  });

  // ---- create ----

  describe('create', () => {
    it('throws 403 when actor lacks production.lines.create', async () => {
      await expect(service.create({ code: 'LINE-A', name: 'Line A' }, ACTOR_READ))
        .rejects.toThrow(ForbiddenException);
    });

    it('creates a production line and returns it', async () => {
      const line = makeLine();
      mockLineCreate.mockResolvedValue(line);
      const result = await service.create({ code: 'LINE-A', name: 'Line A' }, ACTOR_MANAGE);
      expect(result).toEqual(line);
      expect(mockLineCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ code: 'LINE-A', name: 'Line A' }),
      }));
    });

    it('throws 409 on duplicate code (P2002)', async () => {
      mockLineCreate.mockRejectedValue({ code: 'P2002' });
      await expect(service.create({ code: 'LINE-A', name: 'Line A' }, ACTOR_MANAGE))
        .rejects.toThrow(ConflictException);
    });

    it('stores optional capacity when provided', async () => {
      const line = makeLine({ capacity: 500 });
      mockLineCreate.mockResolvedValue(line);
      await service.create({ code: 'LINE-A', name: 'Line A', capacity: 500 }, ACTOR_MANAGE);
      expect(mockLineCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ capacity: 500 }),
      }));
    });
  });

  // ---- findAll ----

  describe('findAll', () => {
    it('throws 403 when actor lacks production.lines.read', async () => {
      await expect(service.findAll({}, ACTOR_NONE)).rejects.toThrow(ForbiddenException);
    });

    it('returns paginated list with defaults', async () => {
      const lines = [makeLine()];
      mockLineFindMany.mockResolvedValue(lines);
      mockLineCount.mockResolvedValue(1);
      const result = await service.findAll({}, ACTOR_READ);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('filters by isActive when provided', async () => {
      mockLineFindMany.mockResolvedValue([]);
      mockLineCount.mockResolvedValue(0);
      await service.findAll({ isActive: true }, ACTOR_READ);
      expect(mockLineFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }));
    });

    it('accepts production.read as fallback permission', async () => {
      mockLineFindMany.mockResolvedValue([]);
      mockLineCount.mockResolvedValue(0);
      const actor: AuthUser = { ...ACTOR_READ, permissions: ['production.read'] };
      await expect(service.findAll({}, actor)).resolves.toBeDefined();
    });
  });

  // ---- findOne ----

  describe('findOne', () => {
    it('throws 403 when actor lacks permission', async () => {
      await expect(service.findOne('line-1', ACTOR_NONE)).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when line does not exist', async () => {
      mockLineFindUnique.mockResolvedValue(null);
      await expect(service.findOne('line-99', ACTOR_READ)).rejects.toThrow(NotFoundException);
    });

    it('returns the production line', async () => {
      const line = makeLine();
      mockLineFindUnique.mockResolvedValue(line);
      const result = await service.findOne('line-1', ACTOR_READ);
      expect(result).toEqual(line);
    });
  });

  // ---- update ----

  describe('update', () => {
    it('throws 403 when actor lacks production.lines.update', async () => {
      await expect(service.update('line-1', { version: 1 }, ACTOR_READ))
        .rejects.toThrow(ForbiddenException);
    });

    it('updates when version matches', async () => {
      mockLineUpdateMany.mockResolvedValue({ count: 1 });
      const updated = makeLine({ name: 'Updated', version: 2 });
      mockLineFindUniqueOrThrow.mockResolvedValue(updated);
      const result = await service.update('line-1', { version: 1, name: 'Updated' }, ACTOR_MANAGE);
      expect(result).toEqual(updated);
      expect(mockLineUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ version: 1 }),
        data: expect.objectContaining({ version: { increment: 1 } }),
      }));
    });

    it('throws 404 when line does not exist (count=0 + no findUnique)', async () => {
      mockLineUpdateMany.mockResolvedValue({ count: 0 });
      mockLineFindUnique.mockResolvedValue(null);
      await expect(service.update('line-99', { version: 1 }, ACTOR_MANAGE))
        .rejects.toThrow(NotFoundException);
    });

    it('throws 409 when version mismatches', async () => {
      mockLineUpdateMany.mockResolvedValue({ count: 0 });
      mockLineFindUnique.mockResolvedValue({ id: 'line-1' });
      await expect(service.update('line-1', { version: 1 }, ACTOR_MANAGE))
        .rejects.toThrow(ConflictException);
    });

    it('allows production.lines.manage as alternative to production.lines.update', async () => {
      mockLineUpdateMany.mockResolvedValue({ count: 1 });
      mockLineFindUniqueOrThrow.mockResolvedValue(makeLine());
      await expect(service.update('line-1', { version: 1 }, ACTOR_MANAGE)).resolves.toBeDefined();
    });
  });

  // ---- activate / deactivate ----

  describe('activate', () => {
    it('throws 403 when actor lacks production.lines.update', async () => {
      await expect(service.activate('line-1', ACTOR_NONE)).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when line does not exist', async () => {
      mockLineFindUnique.mockResolvedValue(null);
      await expect(service.activate('line-99', ACTOR_MANAGE)).rejects.toThrow(NotFoundException);
    });

    it('activates the production line', async () => {
      mockLineFindUnique.mockResolvedValue({ id: 'line-1' });
      const activated = makeLine({ isActive: true });
      mockLineUpdate.mockResolvedValue(activated);
      const result = await service.activate('line-1', ACTOR_MANAGE);
      expect(result).toEqual(activated);
      expect(mockLineUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: { isActive: true },
      }));
    });
  });

  describe('deactivate', () => {
    it('throws 403 when actor lacks production.lines.manage', async () => {
      const actor: AuthUser = { ...ACTOR_MANAGE, permissions: ['production.lines.update'] };
      mockLineFindUnique.mockResolvedValue({ id: 'line-1' });
      await expect(service.deactivate('line-1', actor)).rejects.toThrow(ForbiddenException);
    });

    it('deactivates the production line', async () => {
      mockLineFindUnique.mockResolvedValue({ id: 'line-1' });
      const deactivated = makeLine({ isActive: false });
      mockLineUpdate.mockResolvedValue(deactivated);
      const result = await service.deactivate('line-1', ACTOR_MANAGE);
      expect(result).toEqual(deactivated);
    });
  });

  // ---- listActive ----

  describe('listActive', () => {
    it('throws 403 when actor lacks permission', async () => {
      await expect(service.listActive(ACTOR_NONE)).rejects.toThrow(ForbiddenException);
    });

    it('returns only active lines', async () => {
      mockLineFindMany.mockResolvedValue([{ id: 'line-1', code: 'LINE-A', name: 'Line A', plantId: null, capacity: null }]);
      const result = await service.listActive(ACTOR_READ);
      expect(result).toHaveLength(1);
      expect(mockLineFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { isActive: true },
      }));
    });
  });
});
