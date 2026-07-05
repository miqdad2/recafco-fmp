import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  UnprocessableEntityException,
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

// ---------------------------------------------------------------------------
// Mock functions
// ---------------------------------------------------------------------------
const mockUserCreate = vi.fn();
const mockUserFindMany = vi.fn();
const mockUserCount = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserUpdate = vi.fn();
const mockUserDelete = vi.fn();
const mockSessionDeleteMany = vi.fn();
const mockModuleAccessDeleteMany = vi.fn();
const mockLocationFindUnique = vi.fn();
const mockRoleFindUnique = vi.fn();
const mockAuditCreate = vi.fn();
const mockAuditCount = vi.fn();
const mockDepartmentFindMany = vi.fn();

// History count mocks
const mockIncidentCount = vi.fn();
const mockTaskCount = vi.fn();
const mockMaintenanceCount = vi.fn();
const mockSafetyInspectionCount = vi.fn();
const mockSafetyFindingCount = vi.fn();
const mockContractCount = vi.fn();
const mockProductionOrderCount = vi.fn();
const mockIncidentCommentCount = vi.fn();

const mockClient = {
  user: {
    create: mockUserCreate,
    findMany: mockUserFindMany,
    count: mockUserCount,
    findUnique: mockUserFindUnique,
    update: mockUserUpdate,
    delete: mockUserDelete,
  },
  userSession: { deleteMany: mockSessionDeleteMany },
  userModuleAccess: { deleteMany: mockModuleAccessDeleteMany },
  location: { findUnique: mockLocationFindUnique },
  role: { findUnique: mockRoleFindUnique },
  securityAuditEvent: { create: mockAuditCreate, count: mockAuditCount },
  department: { findMany: mockDepartmentFindMany },
  incident: { count: mockIncidentCount },
  factoryTask: { count: mockTaskCount },
  maintenanceRequest: { count: mockMaintenanceCount },
  safetyInspection: { count: mockSafetyInspectionCount },
  safetyFinding: { count: mockSafetyFindingCount },
  contract: { count: mockContractCount },
  productionOrder: { count: mockProductionOrderCount },
  incidentComment: { count: mockIncidentCommentCount },
  $transaction: vi.fn((fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient)),
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;
const mockAuthService = {
  hashPassword: vi.fn().mockResolvedValue('$argon2id$temp_hash'),
  auditEvent: vi.fn(),
} as unknown as AuthService;
const mockDeptAccess = {
  buildDeptFilter: vi.fn().mockResolvedValue(null),
  getScope: vi.fn().mockResolvedValue(DepartmentAccessScope.ALL_DEPARTMENTS),
  assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined),
} as unknown as DepartmentAccessService;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR_ID = 'actor-uuid-0001';

const ADMIN_ACTOR = {
  id: ACTOR_ID,
  username: 'admin',
  displayName: 'Admin',
  roleId: 'role-uuid-super-admin',
  roleCode: 'SUPER_ADMIN',
  roleName: 'Super Administrator',
  permissions: ['users.read', 'users.create', 'users.update', 'users.assign_role',
    'users.activate', 'users.deactivate', 'users.archive', 'users.delete_test',
    'users.reset_password', 'users.unlock', 'roles.read'],
  isActive: true,
  mustChangePassword: false,
  sessionId: 'session-001',
  departmentId: null,
};

const BASE_USER = {
  id: 'user-uuid-0002',
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
  archivedAt: null,
  archivedByUserId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const SUPER_ADMIN_USER = {
  ...BASE_USER,
  id: 'user-uuid-super',
  username: 'sa.user',
  role: { code: 'SUPER_ADMIN', name: 'Super Administrator' },
  roleId: 'role-uuid-super-admin',
};

const TEST_USER = {
  ...BASE_USER,
  id: 'user-uuid-test',
  username: 'test.cleanup',
  displayName: 'Test Cleanup',
};

// All history counts set to 0 — pristine test user
function zeroHistory() {
  mockIncidentCount.mockResolvedValue(0);
  mockTaskCount.mockResolvedValue(0);
  mockMaintenanceCount.mockResolvedValue(0);
  mockSafetyInspectionCount.mockResolvedValue(0);
  mockSafetyFindingCount.mockResolvedValue(0);
  mockContractCount.mockResolvedValue(0);
  mockProductionOrderCount.mockResolvedValue(0);
  mockIncidentCommentCount.mockResolvedValue(0);
  mockAuditCount.mockResolvedValue(0);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UsersService — lifecycle (archive, checkUserHistory, deleteTestUser)', () => {
  let service: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.$transaction.mockImplementation(
      (fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient),
    );
    mockRoleFindUnique.mockResolvedValue({ id: 'role-uuid-viewer', code: 'VIEWER', isActive: true });
    service = new UsersService(mockDb, mockAuthService, mockDeptAccess);
  });

  // --------------------------------------------------------------------------
  // archive
  // --------------------------------------------------------------------------

  describe('archive', () => {
    it('sets isActive=false, archivedAt, invalidates sessions and emits audit event', async () => {
      mockUserFindUnique.mockResolvedValue(BASE_USER);
      mockUserUpdate.mockResolvedValue({ ...BASE_USER, isActive: false, archivedAt: new Date(), archivedByUserId: ACTOR_ID });
      mockSessionDeleteMany.mockResolvedValue({ count: 1 });
      mockAuditCreate.mockResolvedValue({});
      mockUserCount.mockResolvedValue(2); // for assertNotLastActiveSuperAdmin (not SUPER_ADMIN role here)

      const result = await service.archive(BASE_USER.id, ADMIN_ACTOR);

      expect(result.isActive).toBe(false);
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: false,
            archivedByUserId: ACTOR_ID,
          }),
        }),
      );
      expect(mockSessionDeleteMany).toHaveBeenCalledWith({ where: { userId: BASE_USER.id } });
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event: 'user_archived', actorId: ACTOR_ID }),
        }),
      );
    });

    it('throws 422 CANNOT_ARCHIVE_SELF when actor tries to archive themselves', async () => {
      const selfActor = { ...ADMIN_ACTOR, id: BASE_USER.id };
      await expect(service.archive(BASE_USER.id, selfActor)).rejects.toThrow(
        UnprocessableEntityException,
      );
      await expect(service.archive(BASE_USER.id, selfActor)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'CANNOT_ARCHIVE_SELF' }),
      });
    });

    it('throws 422 when trying to archive the last active SUPER_ADMIN', async () => {
      mockUserFindUnique.mockResolvedValue(SUPER_ADMIN_USER);
      // 0 other active SUPER_ADMINs → this is the last one
      mockUserCount.mockResolvedValue(0);

      await expect(service.archive(SUPER_ADMIN_USER.id, ADMIN_ACTOR)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  // --------------------------------------------------------------------------
  // checkUserHistory
  // --------------------------------------------------------------------------

  describe('checkUserHistory', () => {
    it('returns hasHistory=false and isTestUser=false for a clean standard user', async () => {
      mockUserFindUnique.mockResolvedValue(BASE_USER);
      zeroHistory();

      const result = await service.checkUserHistory(BASE_USER.id);

      expect(result.hasHistory).toBe(false);
      expect(result.counts).toEqual({});
      expect(result.isTestUser).toBe(false);
    });

    it('returns hasHistory=true and populates counts when user has incidents', async () => {
      mockUserFindUnique.mockResolvedValue(BASE_USER);
      zeroHistory();
      mockIncidentCount.mockResolvedValueOnce(3).mockResolvedValueOnce(0); // reportedById=3, assignedToId=0

      const result = await service.checkUserHistory(BASE_USER.id);

      expect(result.hasHistory).toBe(true);
      expect(result.counts['incidentsReported']).toBe(3);
    });

    it('identifies test users by username prefix', async () => {
      mockUserFindUnique.mockResolvedValue(TEST_USER);
      zeroHistory();

      const result = await service.checkUserHistory(TEST_USER.id);

      expect(result.isTestUser).toBe(true);
      expect(result.hasHistory).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // deleteTestUser
  // --------------------------------------------------------------------------

  describe('deleteTestUser', () => {
    it('hard-deletes a test user with no history and correct confirmation text', async () => {
      mockUserFindUnique.mockResolvedValue(TEST_USER);
      zeroHistory();
      mockSessionDeleteMany.mockResolvedValue({ count: 0 });
      mockModuleAccessDeleteMany.mockResolvedValue({ count: 0 });
      mockUserDelete.mockResolvedValue(TEST_USER);
      mockAuditCreate.mockResolvedValue({});

      await service.deleteTestUser(TEST_USER.id, TEST_USER.username, ADMIN_ACTOR);

      expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: TEST_USER.id } });
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event: 'test_user_permanently_deleted', actorId: ACTOR_ID }),
        }),
      );
    });

    it('throws 422 CANNOT_DELETE_SELF when actor tries to delete themselves', async () => {
      const selfActor = { ...ADMIN_ACTOR, id: TEST_USER.id };
      await expect(
        service.deleteTestUser(TEST_USER.id, TEST_USER.username, selfActor),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 422 NOT_A_TEST_USER for non-test username', async () => {
      mockUserFindUnique.mockResolvedValue(BASE_USER); // alice — no test. prefix
      await expect(
        service.deleteTestUser(BASE_USER.id, BASE_USER.username, ADMIN_ACTOR),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'NOT_A_TEST_USER' }),
      });
      expect(mockUserDelete).not.toHaveBeenCalled();
    });

    it('throws 400 CONFIRMATION_MISMATCH when confirmation text is wrong', async () => {
      mockUserFindUnique.mockResolvedValue(TEST_USER);
      await expect(
        service.deleteTestUser(TEST_USER.id, 'wrong-text', ADMIN_ACTOR),
      ).rejects.toThrow(BadRequestException);
      expect(mockUserDelete).not.toHaveBeenCalled();
    });

    it('throws 422 USER_HAS_HISTORY and emits blocked event when user has records', async () => {
      mockUserFindUnique.mockResolvedValue(TEST_USER);
      zeroHistory();
      mockIncidentCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      mockAuditCreate.mockResolvedValue({});

      await expect(
        service.deleteTestUser(TEST_USER.id, TEST_USER.username, ADMIN_ACTOR),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'USER_HAS_HISTORY' }),
      });
      expect(mockUserDelete).not.toHaveBeenCalled();
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event: 'test_user_delete_blocked' }),
        }),
      );
    });

    it('deletes sessions and module access before deleting user', async () => {
      mockUserFindUnique.mockResolvedValue(TEST_USER);
      zeroHistory();
      mockSessionDeleteMany.mockResolvedValue({ count: 1 });
      mockModuleAccessDeleteMany.mockResolvedValue({ count: 0 });
      mockUserDelete.mockResolvedValue(TEST_USER);
      mockAuditCreate.mockResolvedValue({});

      await service.deleteTestUser(TEST_USER.id, TEST_USER.username, ADMIN_ACTOR);

      expect(mockSessionDeleteMany).toHaveBeenCalledWith({ where: { userId: TEST_USER.id } });
      expect(mockModuleAccessDeleteMany).toHaveBeenCalledWith({ where: { userId: TEST_USER.id } });
    });
  });
});
