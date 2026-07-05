import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

vi.mock('@node-rs/argon2', () => ({
  hash: vi.fn().mockResolvedValue('$argon2id$temp_hash'),
  verify: vi.fn().mockResolvedValue(true),
  Algorithm: { Argon2id: 1 },
}));

import { UsersService } from './users.service';
import { DepartmentAccessScope } from '@recafco/database';
import type { DatabaseService } from '../database/database.service';
import type { AuthService } from '../auth/auth.service';
import type { DepartmentAccessService } from '../department-access/department-access.service';

const mockUserCreate = vi.fn();
const mockUserFindMany = vi.fn();
const mockUserCount = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserUpdate = vi.fn();
const mockSessionDeleteMany = vi.fn();
const mockLocationFindUnique = vi.fn();
const mockRoleFindUnique = vi.fn();
const mockAuditCreate = vi.fn();
const mockDepartmentFindMany = vi.fn();
const mockGetScope = vi.fn();

const mockClient = {
  user: {
    create: mockUserCreate,
    findMany: mockUserFindMany,
    count: mockUserCount,
    findUnique: mockUserFindUnique,
    update: mockUserUpdate,
  },
  userSession: { deleteMany: mockSessionDeleteMany },
  location: { findUnique: mockLocationFindUnique },
  role: { findUnique: mockRoleFindUnique },
  securityAuditEvent: { create: mockAuditCreate },
  department: { findMany: mockDepartmentFindMany },
  $transaction: vi.fn((fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient)),
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;
const mockAuthService = {
  hashPassword: vi.fn().mockResolvedValue('$argon2id$temp_hash'),
  auditEvent: vi.fn(),
} as unknown as AuthService;
const mockDeptAccess = {
  buildDeptFilter: vi.fn().mockResolvedValue(null),
  getScope: mockGetScope,
  assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined),
} as unknown as DepartmentAccessService;

const ADMIN_ACTOR = {
  id: 'actor-uuid-0001',
  username: 'admin',
  displayName: 'Admin',
  roleId: 'role-uuid-super-admin',
  roleCode: 'SUPER_ADMIN',
  roleName: 'Super Administrator',
  permissions: ['users.read', 'users.create', 'users.update', 'users.assign_role', 'users.activate', 'users.reset_password', 'users.unlock', 'roles.read'],
  isActive: true,
  mustChangePassword: false,
  sessionId: 'session-001',
  departmentId: null,
};

const BASE_USER = {
  id: 'user-uuid-0001',
  username: 'alice',
  displayName: 'Alice',
  email: null,
  employeeNumber: null,
  roleId: 'role-uuid-viewer',
  role: { code: 'VIEWER', name: 'Viewer' },
  isActive: true,
  mustChangePassword: false,
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: null,
  departmentId: null,
  plantId: null,
  locationId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const VIEWER_ROLE = { id: 'role-uuid-viewer', code: 'VIEWER', isActive: true };

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.$transaction.mockImplementation((fn: (tx: typeof mockClient) => Promise<unknown>) =>
      fn(mockClient),
    );
    // Default: resolve VIEWER role when creating users without an explicit roleId
    mockRoleFindUnique.mockResolvedValue(VIEWER_ROLE);
    service = new UsersService(mockDb, mockAuthService, mockDeptAccess);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('returns user summary and tempPassword on success', async () => {
      mockUserCreate.mockResolvedValue(BASE_USER);

      const result = await service.create(
        { username: 'alice', displayName: 'Alice' },
        ADMIN_ACTOR,
      );

      expect(result.user.username).toBe('alice');
      expect(typeof result.tempPassword).toBe('string');
      expect(result.tempPassword.length).toBeGreaterThan(0);
    });

    it('normalizes username to lowercase', async () => {
      mockUserCreate.mockResolvedValue(BASE_USER);

      await service.create({ username: 'ALICE', displayName: 'Alice' }, ADMIN_ACTOR);

      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ username: 'alice' }) }),
      );
    });

    it('normalizes email to lowercase', async () => {
      mockUserCreate.mockResolvedValue({ ...BASE_USER, email: 'alice@example.com' });

      await service.create(
        { username: 'alice', displayName: 'Alice', email: 'ALICE@EXAMPLE.COM' },
        ADMIN_ACTOR,
      );

      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: 'alice@example.com' }) }),
      );
    });

    it('normalizes employeeNumber to uppercase', async () => {
      mockUserCreate.mockResolvedValue({ ...BASE_USER, employeeNumber: 'EMP-001' });

      await service.create(
        { username: 'alice', displayName: 'Alice', employeeNumber: 'emp-001' },
        ADMIN_ACTOR,
      );

      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ employeeNumber: 'EMP-001' }) }),
      );
    });

    it('throws 400 when displayName is blank after trimming', async () => {
      await expect(
        service.create({ username: 'alice', displayName: '   ' }, ADMIN_ACTOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('always sets mustChangePassword to true on create', async () => {
      mockUserCreate.mockResolvedValue(BASE_USER);
      await service.create({ username: 'alice', displayName: 'Alice' }, ADMIN_ACTOR);

      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ mustChangePassword: true }) }),
      );
    });

    it('creates audit event with actor in same transaction', async () => {
      mockUserCreate.mockResolvedValue(BASE_USER);
      await service.create({ username: 'alice', displayName: 'Alice' }, ADMIN_ACTOR);

      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event: 'user_created', actorId: ADMIN_ACTOR.id }),
        }),
      );
    });

    it('throws ConflictException on duplicate username (P2002)', async () => {
      mockUserCreate.mockRejectedValue({ code: 'P2002', meta: { target: ['username'] } });

      await expect(
        service.create({ username: 'alice', displayName: 'Alice' }, ADMIN_ACTOR),
      ).rejects.toThrow(ConflictException);
    });

    it('throws 403 when non-SUPER_ADMIN tries to create with SUPER_ADMIN roleId', async () => {
      const adminActor = { ...ADMIN_ACTOR, roleCode: 'ADMIN' };
      mockRoleFindUnique.mockResolvedValue({ id: 'role-uuid-super-admin', code: 'SUPER_ADMIN', isActive: true });

      await expect(
        service.create({ username: 'alice', displayName: 'Alice', roleId: 'role-uuid-super-admin' }, adminActor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // validateOrgConsistency (via create/update)
  // ---------------------------------------------------------------------------

  describe('validateOrgConsistency', () => {
    it('throws 400 ORG_ASSIGNMENT_MISMATCH when location belongs to a different plant', async () => {
      mockLocationFindUnique.mockResolvedValue({ plantId: 'plant-uuid-OTHER' });

      await expect(
        service.create(
          {
            username: 'alice',
            displayName: 'Alice',
            plantId: 'plant-uuid-0001',
            locationId: 'location-uuid-0001',
          },
          ADMIN_ACTOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows location with matching plantId', async () => {
      mockLocationFindUnique.mockResolvedValue({ plantId: 'plant-uuid-0001' });
      mockUserCreate.mockResolvedValue(BASE_USER);

      await expect(
        service.create(
          {
            username: 'alice',
            displayName: 'Alice',
            plantId: 'plant-uuid-0001',
            locationId: 'location-uuid-0001',
          },
          ADMIN_ACTOR,
        ),
      ).resolves.toBeDefined();
    });

    it('skips validation when only locationId is given (no plantId)', async () => {
      mockUserCreate.mockResolvedValue(BASE_USER);

      await expect(
        service.create(
          { username: 'alice', displayName: 'Alice', locationId: 'location-uuid-0001' },
          ADMIN_ACTOR,
        ),
      ).resolves.toBeDefined();

      expect(mockLocationFindUnique).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // deactivate
  // ---------------------------------------------------------------------------

  describe('deactivate', () => {
    it('throws 422 CANNOT_DEACTIVATE_SELF when actor deactivates themselves', async () => {
      await expect(service.deactivate(ADMIN_ACTOR.id, ADMIN_ACTOR)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('throws 422 LAST_ACTIVE_SUPER_ADMIN when target is the only active SUPER_ADMIN', async () => {
      const superAdminUser = {
        ...BASE_USER,
        id: 'other-super-admin-uuid',
        roleId: 'role-uuid-super-admin',
        role: { code: 'SUPER_ADMIN', name: 'Super Administrator' },
      };
      mockUserFindUnique.mockResolvedValue(superAdminUser);
      mockUserCount.mockResolvedValue(0); // no OTHER active SUPER_ADMINs

      await expect(service.deactivate(superAdminUser.id, ADMIN_ACTOR)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('deactivates and revokes all sessions in one transaction', async () => {
      const targetUser = { ...BASE_USER, id: 'other-user-uuid' };
      mockUserFindUnique.mockResolvedValue(targetUser);
      mockUserUpdate.mockResolvedValue({ ...targetUser, isActive: false });
      mockSessionDeleteMany.mockResolvedValue({ count: 3 });

      await service.deactivate(targetUser.id, ADMIN_ACTOR);

      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
      );
      expect(mockSessionDeleteMany).toHaveBeenCalledWith({ where: { userId: targetUser.id } });
    });
  });

  // ---------------------------------------------------------------------------
  // updateRole
  // ---------------------------------------------------------------------------

  describe('updateRole', () => {
    it('throws 422 CANNOT_CHANGE_OWN_ROLE when actor changes their own role', async () => {
      await expect(
        service.updateRole(ADMIN_ACTOR.id, 'role-uuid-viewer', ADMIN_ACTOR),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 LAST_ACTIVE_SUPER_ADMIN when demoting the only active SUPER_ADMIN', async () => {
      const superAdminUser = {
        ...BASE_USER,
        id: 'sole-super-admin-uuid',
        roleId: 'role-uuid-super-admin',
        role: { code: 'SUPER_ADMIN', name: 'Super Administrator' },
      };
      // role.findUnique returns the target (VIEWER) role
      mockRoleFindUnique.mockResolvedValue(VIEWER_ROLE);
      // user.findUnique returns the SUPER_ADMIN target user
      mockUserFindUnique.mockResolvedValue(superAdminUser);
      // count returns 0 — no other active SUPER_ADMINs
      mockUserCount.mockResolvedValue(0);

      await expect(
        service.updateRole(superAdminUser.id, 'role-uuid-viewer', ADMIN_ACTOR),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 403 when non-SUPER_ADMIN tries to assign SUPER_ADMIN role', async () => {
      const adminActor = { ...ADMIN_ACTOR, roleCode: 'ADMIN' };
      mockRoleFindUnique.mockResolvedValue({ id: 'role-uuid-super-admin', code: 'SUPER_ADMIN', isActive: true });

      await expect(
        service.updateRole('other-user-uuid', 'role-uuid-super-admin', adminActor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    it('returns paginated items', async () => {
      mockUserFindMany.mockResolvedValue([BASE_USER]);
      mockUserCount.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, pageSize: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('includes isLocked=true when lockedUntil is in the future', async () => {
      const future = new Date(Date.now() + 10 * 60 * 1000);
      mockUserFindMany.mockResolvedValue([{ ...BASE_USER, lockedUntil: future }]);
      mockUserCount.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.items[0]?.isLocked).toBe(true);
    });

    it('includes isLocked=false when lockedUntil is null', async () => {
      mockUserFindMany.mockResolvedValue([{ ...BASE_USER, lockedUntil: null }]);
      mockUserCount.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.items[0]?.isLocked).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------

  describe('findOne', () => {
    it('throws 404 when user does not exist', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // resetPassword
  // ---------------------------------------------------------------------------

  describe('resetPassword', () => {
    it('returns a non-empty tempPassword and revokes all sessions', async () => {
      mockUserFindUnique.mockResolvedValue(BASE_USER);
      mockSessionDeleteMany.mockResolvedValue({ count: 1 });
      mockUserUpdate.mockResolvedValue(BASE_USER);

      const result = await service.resetPassword(BASE_USER.id, ADMIN_ACTOR);

      expect(typeof result.tempPassword).toBe('string');
      expect(result.tempPassword.length).toBeGreaterThan(0);
      expect(mockSessionDeleteMany).toHaveBeenCalledWith({ where: { userId: BASE_USER.id } });
    });
  });

  describe('getDashboard', () => {
    it('returns ALL_DEPARTMENTS scope and correct metrics when no dept filter', async () => {
      mockGetScope.mockResolvedValueOnce(DepartmentAccessScope.ALL_DEPARTMENTS);
      mockUserCount
        .mockResolvedValueOnce(20) // totalActiveUsers
        .mockResolvedValueOnce(5)  // totalInactiveUsers
        .mockResolvedValueOnce(2)  // totalLockedUsers
        .mockResolvedValueOnce(3); // mustChangePassword
      mockUserFindMany.mockResolvedValueOnce([
        { id: 'u-1', username: 'alice', displayName: 'Alice', isActive: true, updatedAt: new Date('2026-07-01T12:00:00Z') },
        { id: 'u-2', username: 'bob', displayName: 'Bob', isActive: false, updatedAt: new Date('2026-07-01T11:00:00Z') },
      ]);

      const result = await service.getDashboard(ADMIN_ACTOR);

      expect(result.scope.type).toBe(DepartmentAccessScope.ALL_DEPARTMENTS);
      expect(result.scope.departmentNames).toEqual([]);
      expect(result.metrics.totalActiveUsers).toBe(20);
      expect(result.metrics.totalInactiveUsers).toBe(5);
      expect(result.metrics.totalLockedUsers).toBe(2);
      expect(result.metrics.mustChangePassword).toBe(3);
      expect(result.recent).toHaveLength(2);
      expect(result.recent[0]?.referenceNumber).toBe('alice');
      expect(result.recent[0]?.title).toBe('Alice');
      expect(result.recent[0]?.status).toBe('active');
      expect(result.recent[1]?.status).toBe('inactive');
      expect(result.recent[0]?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
