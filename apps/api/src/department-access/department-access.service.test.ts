import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { DepartmentAccessScope, ModuleIdentifier } from '@recafco/database';
import { DepartmentAccessService } from './department-access.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';

// ---------------------------------------------------------------------------
// Transaction mocks
// ---------------------------------------------------------------------------

const mockTxFindUnique = vi.fn();
const mockTxUpsert = vi.fn();
const mockTxDeleteMany = vi.fn();
const mockTxCreateMany = vi.fn();
const mockTxAuditCreate = vi.fn();

const mockTx = {
  userModuleAccess: {
    findUnique: mockTxFindUnique,
    upsert: mockTxUpsert,
  },
  userModuleDepartmentGrant: {
    deleteMany: mockTxDeleteMany,
    createMany: mockTxCreateMany,
  },
  securityAuditEvent: {
    create: mockTxAuditCreate,
  },
};

// ---------------------------------------------------------------------------
// Client mocks
// ---------------------------------------------------------------------------

const mockUserModuleAccessFindUnique = vi.fn();
const mockUserModuleAccessFindMany = vi.fn();
const mockDepartmentFindMany = vi.fn();
const mockTransaction = vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

const mockClient = {
  userModuleAccess: {
    findUnique: mockUserModuleAccessFindUnique,
    findMany: mockUserModuleAccessFindMany,
  },
  department: {
    findMany: mockDepartmentFindMany,
  },
  $transaction: mockTransaction,
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

// ---------------------------------------------------------------------------
// Fixtures — permission codes use approved access_scope.* names
// ---------------------------------------------------------------------------

/** VIEWER: zero access_scope permissions */
const ACTOR_VIEWER: AuthUser = {
  id: 'user-viewer-1',
  username: 'alice',
  displayName: 'Alice',
  roleId: 'role-viewer',
  roleCode: 'VIEWER',
  roleName: 'Viewer',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-1',
  permissions: [],
  departmentId: 'dept-a',
};

/** ADMIN: access_scope.read + access_scope.manage ONLY (NOT manage_all_departments) */
const ACTOR_ADMIN: AuthUser = {
  id: 'user-admin-1',
  username: 'carol',
  displayName: 'Carol',
  roleId: 'role-admin',
  roleCode: 'ADMIN',
  roleName: 'Admin',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-3',
  permissions: ['access_scope.read', 'access_scope.manage'],
  departmentId: 'dept-a',
};

/** SUPER_ADMIN: all three access_scope permissions */
const ACTOR_SUPER_ADMIN: AuthUser = {
  id: 'user-super-1',
  username: 'eve',
  displayName: 'Eve',
  roleId: 'role-super',
  roleCode: 'SUPER_ADMIN',
  roleName: 'Super Admin',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-5',
  permissions: ['access_scope.read', 'access_scope.manage', 'access_scope.manage_all_departments'],
  departmentId: null,
};

/** Actor with no primary department */
const ACTOR_NO_DEPT: AuthUser = {
  id: 'user-nodept-1',
  username: 'dave',
  displayName: 'Dave',
  roleId: 'role-viewer',
  roleCode: 'VIEWER',
  roleName: 'Viewer',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-4',
  permissions: [],
  departmentId: null,
};

const MOD = ModuleIdentifier.FACTORY_TASKS;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DepartmentAccessService', () => {
  let service: DepartmentAccessService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DepartmentAccessService(mockDb);
    // Default: dept validation passes (all requested depts are active)
    mockDepartmentFindMany.mockResolvedValue([]);
    // Default: no previous access record in tx
    mockTxFindUnique.mockResolvedValue(null);
    // Default: upsert returns an ID
    mockTxUpsert.mockResolvedValue({ id: 'access-record-1' });
    mockTxDeleteMany.mockResolvedValue({ count: 0 });
    mockTxCreateMany.mockResolvedValue({ count: 1 });
    mockTxAuditCreate.mockResolvedValue({});
  });

  // -------------------------------------------------------------------------
  // getScope — DB-only, no fast-path for any permission
  // -------------------------------------------------------------------------

  describe('getScope — DB-only, no permission fast-path', () => {
    it('queries DB regardless of actor permissions', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce(null);

      await service.getScope(ACTOR_SUPER_ADMIN, MOD);

      expect(mockUserModuleAccessFindUnique).toHaveBeenCalledWith({
        where: { userId_module: { userId: ACTOR_SUPER_ADMIN.id, module: MOD } },
        select: { scope: true },
      });
    });

    it('returns ALL_DEPARTMENTS from DB record (not from permission)', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce({
        scope: DepartmentAccessScope.ALL_DEPARTMENTS,
      });

      const scope = await service.getScope(ACTOR_SUPER_ADMIN, MOD);
      expect(scope).toBe(DepartmentAccessScope.ALL_DEPARTMENTS);
    });

    it('returns OWN_DEPARTMENT for ADMIN with no DB record (not all-dept)', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce(null);

      const scope = await service.getScope(ACTOR_ADMIN, MOD);
      // ADMIN has no DB row → default is OWN_DEPARTMENT, not ALL_DEPARTMENTS
      expect(scope).toBe(DepartmentAccessScope.OWN_DEPARTMENT);
    });

    it('returns OWN_DEPARTMENT for SUPER_ADMIN with no DB record', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce(null);

      const scope = await service.getScope(ACTOR_SUPER_ADMIN, MOD);
      expect(scope).toBe(DepartmentAccessScope.OWN_DEPARTMENT);
    });

    it('returns SELECTED_DEPARTMENTS from DB record', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce({
        scope: DepartmentAccessScope.SELECTED_DEPARTMENTS,
      });

      const scope = await service.getScope(ACTOR_VIEWER, MOD);
      expect(scope).toBe(DepartmentAccessScope.SELECTED_DEPARTMENTS);
    });

    it('falls back to OWN_DEPARTMENT when no DB record exists for VIEWER', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce(null);

      const scope = await service.getScope(ACTOR_VIEWER, MOD);
      expect(scope).toBe(DepartmentAccessScope.OWN_DEPARTMENT);
    });
  });

  // -------------------------------------------------------------------------
  // buildDeptFilter
  // -------------------------------------------------------------------------

  describe('buildDeptFilter', () => {
    it('returns null for ALL_DEPARTMENTS scope from DB record', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce({
        scope: DepartmentAccessScope.ALL_DEPARTMENTS,
      });

      const filter = await service.buildDeptFilter(ACTOR_SUPER_ADMIN, MOD);
      expect(filter).toBeNull();
    });

    it('returns {in: [departmentId]} for OWN_DEPARTMENT when actor has a department', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce(null);

      const filter = await service.buildDeptFilter(ACTOR_VIEWER, MOD);
      expect(filter).toEqual({ in: ['dept-a'] });
    });

    it('returns {in: []} (fail-closed) for OWN_DEPARTMENT when actor has no department', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce(null);

      const filter = await service.buildDeptFilter(ACTOR_NO_DEPT, MOD);
      expect(filter).toEqual({ in: [] });
    });

    it('ADMIN with no DB record gets OWN_DEPARTMENT filter, not null', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce(null);

      const filter = await service.buildDeptFilter(ACTOR_ADMIN, MOD);
      expect(filter).toEqual({ in: ['dept-a'] });
    });

    it('returns {in: grantedIds} for SELECTED_DEPARTMENTS scope', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce({
        scope: DepartmentAccessScope.SELECTED_DEPARTMENTS,
      });
      mockUserModuleAccessFindUnique.mockResolvedValueOnce({
        grants: [{ departmentId: 'dept-b' }, { departmentId: 'dept-c' }],
      });

      const filter = await service.buildDeptFilter(ACTOR_VIEWER, MOD);
      expect(filter).toEqual({ in: ['dept-b', 'dept-c'] });
    });

    it('returns {in: []} for SELECTED_DEPARTMENTS when record has no grants', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce({
        scope: DepartmentAccessScope.SELECTED_DEPARTMENTS,
      });
      mockUserModuleAccessFindUnique.mockResolvedValueOnce(null);

      const filter = await service.buildDeptFilter(ACTOR_VIEWER, MOD);
      expect(filter).toEqual({ in: [] });
    });
  });

  // -------------------------------------------------------------------------
  // canAccessDepartment
  // -------------------------------------------------------------------------

  describe('canAccessDepartment', () => {
    it('returns true when deptId is null (record has no department)', async () => {
      const ok = await service.canAccessDepartment(ACTOR_VIEWER, MOD, null);
      expect(ok).toBe(true);
      expect(mockUserModuleAccessFindUnique).not.toHaveBeenCalled();
    });

    it('returns true for ALL_DEPARTMENTS actor (with DB record) and any deptId', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce({
        scope: DepartmentAccessScope.ALL_DEPARTMENTS,
      });

      const ok = await service.canAccessDepartment(ACTOR_SUPER_ADMIN, MOD, 'dept-z');
      expect(ok).toBe(true);
    });

    it('returns false for ADMIN with no DB record accessing a foreign dept', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce(null);

      // ADMIN has departmentId='dept-a'; trying to access 'dept-other'
      const ok = await service.canAccessDepartment(ACTOR_ADMIN, MOD, 'dept-other');
      expect(ok).toBe(false);
    });

    it('returns true when deptId is in the OWN_DEPARTMENT filter', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce(null);

      const ok = await service.canAccessDepartment(ACTOR_VIEWER, MOD, 'dept-a');
      expect(ok).toBe(true);
    });

    it('returns false when deptId is not in the OWN_DEPARTMENT filter', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce(null);

      const ok = await service.canAccessDepartment(ACTOR_VIEWER, MOD, 'dept-other');
      expect(ok).toBe(false);
    });

    it('returns false when actor has no department (fail-closed)', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce(null);

      const ok = await service.canAccessDepartment(ACTOR_NO_DEPT, MOD, 'dept-a');
      expect(ok).toBe(false);
    });

    it('returns true when deptId is in the SELECTED_DEPARTMENTS grants', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce({
        scope: DepartmentAccessScope.SELECTED_DEPARTMENTS,
      });
      mockUserModuleAccessFindUnique.mockResolvedValueOnce({
        grants: [{ departmentId: 'dept-b' }, { departmentId: 'dept-c' }],
      });

      const ok = await service.canAccessDepartment(ACTOR_VIEWER, MOD, 'dept-b');
      expect(ok).toBe(true);
    });

    it('returns false when deptId is not in the SELECTED_DEPARTMENTS grants', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce({
        scope: DepartmentAccessScope.SELECTED_DEPARTMENTS,
      });
      mockUserModuleAccessFindUnique.mockResolvedValueOnce({
        grants: [{ departmentId: 'dept-b' }],
      });

      const ok = await service.canAccessDepartment(ACTOR_VIEWER, MOD, 'dept-x');
      expect(ok).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // assertCanAccessDepartment
  // -------------------------------------------------------------------------

  describe('assertCanAccessDepartment', () => {
    it('does not throw when access is permitted (own dept)', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce(null);

      await expect(
        service.assertCanAccessDepartment(ACTOR_VIEWER, MOD, 'dept-a'),
      ).resolves.toBeUndefined();
    });

    it('does not throw when deptId is null', async () => {
      await expect(
        service.assertCanAccessDepartment(ACTOR_VIEWER, MOD, null),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when access is denied', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce(null);

      await expect(
        service.assertCanAccessDepartment(ACTOR_VIEWER, MOD, 'dept-other'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('thrown ForbiddenException has DEPARTMENT_ACCESS_DENIED code', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce(null);

      await expect(
        service.assertCanAccessDepartment(ACTOR_VIEWER, MOD, 'dept-other'),
      ).rejects.toMatchObject({ response: { code: 'DEPARTMENT_ACCESS_DENIED' } });
    });

    it('does not throw when actor has ALL_DEPARTMENTS DB record', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce({
        scope: DepartmentAccessScope.ALL_DEPARTMENTS,
      });

      await expect(
        service.assertCanAccessDepartment(ACTOR_SUPER_ADMIN, MOD, 'dept-any'),
      ).resolves.toBeUndefined();
    });

    it('throws for ADMIN accessing foreign dept (ADMIN has no DB record = OWN_DEPARTMENT)', async () => {
      mockUserModuleAccessFindUnique.mockResolvedValueOnce(null);

      await expect(
        service.assertCanAccessDepartment(ACTOR_ADMIN, MOD, 'dept-foreign'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // -------------------------------------------------------------------------
  // canGrantScope — privilege-escalation checks
  // -------------------------------------------------------------------------

  describe('canGrantScope', () => {
    // VIEWER: zero access_scope permissions
    it('VIEWER cannot grant OWN_DEPARTMENT', () => {
      expect(service.canGrantScope(ACTOR_VIEWER, DepartmentAccessScope.OWN_DEPARTMENT)).toBe(false);
    });

    it('VIEWER cannot grant SELECTED_DEPARTMENTS', () => {
      expect(service.canGrantScope(ACTOR_VIEWER, DepartmentAccessScope.SELECTED_DEPARTMENTS)).toBe(false);
    });

    it('VIEWER cannot grant ALL_DEPARTMENTS', () => {
      expect(service.canGrantScope(ACTOR_VIEWER, DepartmentAccessScope.ALL_DEPARTMENTS)).toBe(false);
    });

    // ADMIN: access_scope.read + access_scope.manage only
    it('ADMIN can grant OWN_DEPARTMENT', () => {
      expect(service.canGrantScope(ACTOR_ADMIN, DepartmentAccessScope.OWN_DEPARTMENT)).toBe(true);
    });

    it('ADMIN can grant SELECTED_DEPARTMENTS', () => {
      expect(service.canGrantScope(ACTOR_ADMIN, DepartmentAccessScope.SELECTED_DEPARTMENTS)).toBe(true);
    });

    it('ADMIN CANNOT grant ALL_DEPARTMENTS (no access_scope.manage_all_departments)', () => {
      expect(service.canGrantScope(ACTOR_ADMIN, DepartmentAccessScope.ALL_DEPARTMENTS)).toBe(false);
    });

    // SUPER_ADMIN: all three permissions
    it('SUPER_ADMIN can grant ALL_DEPARTMENTS', () => {
      expect(service.canGrantScope(ACTOR_SUPER_ADMIN, DepartmentAccessScope.ALL_DEPARTMENTS)).toBe(true);
    });

    it('SUPER_ADMIN can grant OWN_DEPARTMENT', () => {
      expect(service.canGrantScope(ACTOR_SUPER_ADMIN, DepartmentAccessScope.OWN_DEPARTMENT)).toBe(true);
    });

    it('SUPER_ADMIN can grant SELECTED_DEPARTMENTS', () => {
      expect(service.canGrantScope(ACTOR_SUPER_ADMIN, DepartmentAccessScope.SELECTED_DEPARTMENTS)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getUserModuleAccessConfig
  // -------------------------------------------------------------------------

  describe('getUserModuleAccessConfig', () => {
    it('returns all 7 modules', async () => {
      mockUserModuleAccessFindMany.mockResolvedValueOnce([]);

      const configs = await service.getUserModuleAccessConfig('user-1');
      expect(configs).toHaveLength(7);
    });

    it('returns OWN_DEPARTMENT scope and empty grants for modules without a record', async () => {
      mockUserModuleAccessFindMany.mockResolvedValueOnce([]);

      const configs = await service.getUserModuleAccessConfig('user-1');
      for (const cfg of configs) {
        expect(cfg.scope).toBe(DepartmentAccessScope.OWN_DEPARTMENT);
        expect(cfg.grantedDepartments).toEqual([]);
      }
    });

    it('includes all 7 ModuleIdentifier values', async () => {
      mockUserModuleAccessFindMany.mockResolvedValueOnce([]);

      const configs = await service.getUserModuleAccessConfig('user-1');
      const modules = configs.map((c) => c.module);
      expect(modules).toContain(ModuleIdentifier.FACTORY_TASKS);
      expect(modules).toContain(ModuleIdentifier.INCIDENT_REPORT);
      expect(modules).toContain(ModuleIdentifier.MAINTENANCE_REQUESTS);
      expect(modules).toContain(ModuleIdentifier.SAFETY_COMPLIANCE);
      expect(modules).toContain(ModuleIdentifier.CONTRACTS_MANAGEMENT);
      expect(modules).toContain(ModuleIdentifier.PRODUCTION_DASHBOARD);
      expect(modules).toContain(ModuleIdentifier.ADMINISTRATION);
    });

    it('merges DB records with defaults — uses DB scope for configured modules', async () => {
      mockUserModuleAccessFindMany.mockResolvedValueOnce([
        {
          module: ModuleIdentifier.FACTORY_TASKS,
          scope: DepartmentAccessScope.SELECTED_DEPARTMENTS,
          grants: [
            {
              departmentId: 'dept-b',
              department: { id: 'dept-b', code: 'B', name: 'Department B' },
            },
          ],
        },
      ]);

      const configs = await service.getUserModuleAccessConfig('user-1');
      const ftConfig = configs.find((c) => c.module === ModuleIdentifier.FACTORY_TASKS)!;

      expect(ftConfig.scope).toBe(DepartmentAccessScope.SELECTED_DEPARTMENTS);
      expect(ftConfig.grantedDepartments).toEqual([{ id: 'dept-b', code: 'B', name: 'Department B' }]);
    });

    it('leaves unconfigured modules at OWN_DEPARTMENT even when some modules have records', async () => {
      mockUserModuleAccessFindMany.mockResolvedValueOnce([
        {
          module: ModuleIdentifier.FACTORY_TASKS,
          scope: DepartmentAccessScope.ALL_DEPARTMENTS,
          grants: [],
        },
      ]);

      const configs = await service.getUserModuleAccessConfig('user-1');
      const incidentConfig = configs.find((c) => c.module === ModuleIdentifier.INCIDENT_REPORT)!;

      expect(incidentConfig.scope).toBe(DepartmentAccessScope.OWN_DEPARTMENT);
      expect(incidentConfig.grantedDepartments).toEqual([]);
    });

    it('queries DB with the correct userId', async () => {
      mockUserModuleAccessFindMany.mockResolvedValueOnce([]);

      await service.getUserModuleAccessConfig('user-xyz');

      expect(mockUserModuleAccessFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-xyz' } }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // setUserModuleAccess
  // -------------------------------------------------------------------------

  describe('setUserModuleAccess', () => {
    it('upserts access record for OWN_DEPARTMENT scope', async () => {
      await service.setUserModuleAccess('user-1', MOD, DepartmentAccessScope.OWN_DEPARTMENT, [], ACTOR_ADMIN);

      expect(mockTxUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_module: { userId: 'user-1', module: MOD } },
          create: expect.objectContaining({ scope: DepartmentAccessScope.OWN_DEPARTMENT }),
          update: expect.objectContaining({ scope: DepartmentAccessScope.OWN_DEPARTMENT }),
        }),
      );
    });

    it('deletes existing grants then creates new ones for SELECTED_DEPARTMENTS', async () => {
      mockDepartmentFindMany.mockResolvedValueOnce([
        { id: 'dept-b' },
        { id: 'dept-c' },
      ]);

      await service.setUserModuleAccess(
        'user-1', MOD, DepartmentAccessScope.SELECTED_DEPARTMENTS,
        ['dept-b', 'dept-c'], ACTOR_SUPER_ADMIN,
      );

      expect(mockTxDeleteMany).toHaveBeenCalledWith({ where: { userModuleAccessId: 'access-record-1' } });
      expect(mockTxCreateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            { userModuleAccessId: 'access-record-1', departmentId: 'dept-b' },
            { userModuleAccessId: 'access-record-1', departmentId: 'dept-c' },
          ],
        }),
      );
    });

    it('does not call createMany for OWN_DEPARTMENT scope', async () => {
      await service.setUserModuleAccess('user-1', MOD, DepartmentAccessScope.OWN_DEPARTMENT, [], ACTOR_ADMIN);

      expect(mockTxCreateMany).not.toHaveBeenCalled();
    });

    it('does not call createMany for ALL_DEPARTMENTS scope', async () => {
      await service.setUserModuleAccess('user-1', MOD, DepartmentAccessScope.ALL_DEPARTMENTS, [], ACTOR_SUPER_ADMIN);

      expect(mockTxCreateMany).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for SELECTED_DEPARTMENTS with empty departmentIds', async () => {
      await expect(
        service.setUserModuleAccess('user-1', MOD, DepartmentAccessScope.SELECTED_DEPARTMENTS, [], ACTOR_SUPER_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('thrown BadRequestException has VALIDATION_ERROR code', async () => {
      await expect(
        service.setUserModuleAccess('user-1', MOD, DepartmentAccessScope.SELECTED_DEPARTMENTS, [], ACTOR_SUPER_ADMIN),
      ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
    });

    it('throws ForbiddenException when VIEWER tries to grant OWN_DEPARTMENT', async () => {
      await expect(
        service.setUserModuleAccess('user-1', MOD, DepartmentAccessScope.OWN_DEPARTMENT, [], ACTOR_VIEWER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('thrown ForbiddenException has INSUFFICIENT_GRANT_PERMISSION code', async () => {
      await expect(
        service.setUserModuleAccess('user-1', MOD, DepartmentAccessScope.OWN_DEPARTMENT, [], ACTOR_VIEWER),
      ).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_GRANT_PERMISSION' } });
    });

    it('ADMIN cannot grant ALL_DEPARTMENTS — privilege escalation blocked', async () => {
      await expect(
        service.setUserModuleAccess('user-1', MOD, DepartmentAccessScope.ALL_DEPARTMENTS, [], ACTOR_ADMIN),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN cannot grant ALL_DEPARTMENTS — correct error code', async () => {
      await expect(
        service.setUserModuleAccess('user-1', MOD, DepartmentAccessScope.ALL_DEPARTMENTS, [], ACTOR_ADMIN),
      ).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_GRANT_PERMISSION' } });
    });

    it('SUPER_ADMIN can grant ALL_DEPARTMENTS', async () => {
      await expect(
        service.setUserModuleAccess('user-1', MOD, DepartmentAccessScope.ALL_DEPARTMENTS, [], ACTOR_SUPER_ADMIN),
      ).resolves.toBeUndefined();
    });

    it('throws BadRequestException when a requested departmentId is inactive/not found', async () => {
      // dept-x is not in the active list returned
      mockDepartmentFindMany.mockResolvedValueOnce([{ id: 'dept-b' }]);

      await expect(
        service.setUserModuleAccess('user-1', MOD, DepartmentAccessScope.SELECTED_DEPARTMENTS, ['dept-b', 'dept-x'], ACTOR_SUPER_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('stores grantedBy actor.id in the upsert', async () => {
      await service.setUserModuleAccess('user-1', MOD, DepartmentAccessScope.OWN_DEPARTMENT, [], ACTOR_ADMIN);

      expect(mockTxUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ grantedBy: ACTOR_ADMIN.id }),
          update: expect.objectContaining({ grantedBy: ACTOR_ADMIN.id }),
        }),
      );
    });

    it('records a scope_changed audit event for non-ALL_DEPARTMENTS changes', async () => {
      await service.setUserModuleAccess('user-1', MOD, DepartmentAccessScope.OWN_DEPARTMENT, [], ACTOR_ADMIN);

      expect(mockTxAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'scope_changed',
            actorId: ACTOR_ADMIN.id,
            userId: 'user-1',
          }),
        }),
      );
    });

    it('records a scope_all_departments_changed audit event when granting ALL_DEPARTMENTS', async () => {
      await service.setUserModuleAccess('user-1', MOD, DepartmentAccessScope.ALL_DEPARTMENTS, [], ACTOR_SUPER_ADMIN);

      expect(mockTxAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'scope_all_departments_changed',
            actorId: ACTOR_SUPER_ADMIN.id,
            userId: 'user-1',
          }),
        }),
      );
    });

    it('records HIGH severity audit when revoking ALL_DEPARTMENTS (previousScope was ALL_DEPARTMENTS)', async () => {
      mockTxFindUnique.mockResolvedValueOnce({
        scope: DepartmentAccessScope.ALL_DEPARTMENTS,
        grants: [],
      });

      await service.setUserModuleAccess('user-1', MOD, DepartmentAccessScope.OWN_DEPARTMENT, [], ACTOR_SUPER_ADMIN);

      expect(mockTxAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'scope_all_departments_changed',
          }),
        }),
      );
    });

    it('audit metadata includes module, previousScope, newScope', async () => {
      await service.setUserModuleAccess('user-1', MOD, DepartmentAccessScope.OWN_DEPARTMENT, [], ACTOR_ADMIN);

      expect(mockTxAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              module: MOD,
              newScope: DepartmentAccessScope.OWN_DEPARTMENT,
              previousScope: DepartmentAccessScope.OWN_DEPARTMENT, // no prev record → default
            }),
          }),
        }),
      );
    });
  });
});
