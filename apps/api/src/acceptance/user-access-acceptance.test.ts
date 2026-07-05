/**
 * User Access Acceptance Tests
 *
 * Proves security properties that span multiple layers:
 *   1. Cross-module scope isolation — scope for module A is independent of module B
 *   2. Role names never used in authorization — PermissionGuard uses permissions[], not role name
 *   3. Permission absent + scope row present = still blocked (PermissionGuard fires first)
 *   4. Department change affects OWN_DEPARTMENT but NOT SELECTED_DEPARTMENTS grants
 *   5. No-department fail-closed — OWN_DEPARTMENT with no dept returns {in: []} for every module
 *   6. ALL_DEPARTMENTS requires explicit DB row — no permission-based fast-path
 *   7. canGrantScope privilege-escalation — access_scope.manage_all_departments required for ALL_DEPARTMENTS
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { DepartmentAccessScope, ModuleIdentifier } from '@recafco/database';
import { PermissionGuard } from '../common/guards/permission.guard';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';

// ---------------------------------------------------------------------------
// Shared actor fixtures
// ---------------------------------------------------------------------------

/** Actor with dept-a but no access_scope permissions */
const ACTOR_WITH_DEPT: AuthUser = {
  id: 'user-accept-1',
  username: 'operator',
  displayName: 'Operator',
  roleId: 'role-viewer',
  roleCode: 'VIEWER',
  roleName: 'Viewer',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'sess-1',
  permissions: ['incidents.read', 'tasks.read'],
  departmentId: 'dept-a',
};

/** Actor with NO department */
const ACTOR_NO_DEPT: AuthUser = {
  ...ACTOR_WITH_DEPT,
  id: 'user-accept-2',
  departmentId: null,
};

/** Actor with access_scope.manage but NOT manage_all_departments */
const ACTOR_ADMIN: AuthUser = {
  id: 'user-accept-3',
  username: 'admin',
  displayName: 'Admin',
  roleId: 'role-admin',
  roleCode: 'ADMIN',
  roleName: 'Administrator',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'sess-3',
  permissions: ['access_scope.manage'],
  departmentId: 'dept-a',
};

/** Actor with all access_scope permissions — still needs explicit DB row for ALL_DEPARTMENTS scope */
const ACTOR_SUPER: AuthUser = {
  id: 'user-accept-4',
  username: 'superadmin',
  displayName: 'Super Admin',
  roleId: 'role-super',
  roleCode: 'SUPER_ADMIN',
  roleName: 'Super Administrator',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'sess-4',
  permissions: ['access_scope.manage', 'access_scope.manage_all_departments', 'incidents.read'],
  departmentId: null,
};

// ---------------------------------------------------------------------------
// Mock database infrastructure shared across DepartmentAccessService tests
// ---------------------------------------------------------------------------

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockDeptFindMany = vi.fn();
const mockTxFindUnique = vi.fn();
const mockTxUpsert = vi.fn();
const mockTxDeleteMany = vi.fn();
const mockTxCreateMany = vi.fn();
const mockTxAudit = vi.fn();

const mockTx = {
  userModuleAccess: { findUnique: mockTxFindUnique, upsert: mockTxUpsert },
  userModuleDepartmentGrant: { deleteMany: mockTxDeleteMany, createMany: mockTxCreateMany },
  securityAuditEvent: { create: mockTxAudit },
};

const mockClient = {
  userModuleAccess: { findUnique: mockFindUnique, findMany: mockFindMany },
  department: { findMany: mockDeptFindMany },
  $transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

// ---------------------------------------------------------------------------
// 1. Cross-module scope isolation
// ---------------------------------------------------------------------------

describe('Cross-module scope isolation', () => {
  let service: DepartmentAccessService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTxUpsert.mockResolvedValue({ id: 'access-1' });
    mockTxDeleteMany.mockResolvedValue({ count: 0 });
    mockTxCreateMany.mockResolvedValue({ count: 0 });
    mockTxAudit.mockResolvedValue({});
    mockTxFindUnique.mockResolvedValue(null);
    mockDeptFindMany.mockResolvedValue([]);
    service = new DepartmentAccessService(mockDb);
  });

  it('A1 — ALL_DEPARTMENTS for FACTORY_TASKS does not affect INCIDENT_REPORT scope', async () => {
    // First call: FACTORY_TASKS → ALL_DEPARTMENTS DB row
    mockFindUnique
      .mockResolvedValueOnce({ scope: DepartmentAccessScope.ALL_DEPARTMENTS }) // getScope FACTORY_TASKS
      .mockResolvedValueOnce(null); // getScope INCIDENT_REPORT → no row

    const filterFT = await service.buildDeptFilter(ACTOR_WITH_DEPT, ModuleIdentifier.FACTORY_TASKS);
    const filterIR = await service.buildDeptFilter(ACTOR_WITH_DEPT, ModuleIdentifier.INCIDENT_REPORT);

    expect(filterFT).toBeNull(); // ALL_DEPARTMENTS → no filter
    expect(filterIR).toEqual({ in: ['dept-a'] }); // OWN_DEPARTMENT default
  });

  it('A2 — SELECTED_DEPARTMENTS for MAINTENANCE does not affect CONTRACTS scope', async () => {
    // MAINTENANCE: SELECTED_DEPARTMENTS with dept-b
    mockFindUnique
      .mockResolvedValueOnce({ scope: DepartmentAccessScope.SELECTED_DEPARTMENTS }) // getScope MAINTENANCE
      .mockResolvedValueOnce({ grants: [{ departmentId: 'dept-b' }] }) // grants for MAINTENANCE
      .mockResolvedValueOnce(null); // getScope CONTRACTS → no row

    const filterMX = await service.buildDeptFilter(ACTOR_WITH_DEPT, ModuleIdentifier.MAINTENANCE_REQUESTS);
    const filterCM = await service.buildDeptFilter(ACTOR_WITH_DEPT, ModuleIdentifier.CONTRACTS_MANAGEMENT);

    expect(filterMX).toEqual({ in: ['dept-b'] }); // only MAINTENANCE grant
    expect(filterCM).toEqual({ in: ['dept-a'] }); // CONTRACTS falls back to OWN_DEPARTMENT
  });

  it('A3 — getScope passes the module identifier to the DB query', async () => {
    mockFindUnique.mockResolvedValue(null);

    await service.getScope(ACTOR_WITH_DEPT, ModuleIdentifier.SAFETY_COMPLIANCE);

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_module: { userId: ACTOR_WITH_DEPT.id, module: ModuleIdentifier.SAFETY_COMPLIANCE } },
      }),
    );
  });

  it('A4 — getScope passes different module for PRODUCTION vs INCIDENTS — two separate DB calls', async () => {
    mockFindUnique
      .mockResolvedValueOnce({ scope: DepartmentAccessScope.ALL_DEPARTMENTS })
      .mockResolvedValueOnce({ scope: DepartmentAccessScope.OWN_DEPARTMENT });

    const scopeProd = await service.getScope(ACTOR_SUPER, ModuleIdentifier.PRODUCTION_DASHBOARD);
    const scopeInc = await service.getScope(ACTOR_SUPER, ModuleIdentifier.INCIDENT_REPORT);

    expect(scopeProd).toBe(DepartmentAccessScope.ALL_DEPARTMENTS);
    expect(scopeInc).toBe(DepartmentAccessScope.OWN_DEPARTMENT);
    expect(mockFindUnique).toHaveBeenCalledTimes(2);
  });

  it('A5 — ALL_DEPARTMENTS for ADMINISTRATION does not bleed into SAFETY scope', async () => {
    mockFindUnique
      .mockResolvedValueOnce({ scope: DepartmentAccessScope.ALL_DEPARTMENTS }) // ADMIN module
      .mockResolvedValueOnce(null); // SAFETY module → default

    const filterAdmin = await service.buildDeptFilter(ACTOR_SUPER, ModuleIdentifier.ADMINISTRATION);
    const filterSafety = await service.buildDeptFilter(ACTOR_SUPER, ModuleIdentifier.SAFETY_COMPLIANCE);

    expect(filterAdmin).toBeNull(); // ALL_DEPARTMENTS → no filter
    expect(filterSafety).toEqual({ in: [] }); // OWN_DEPARTMENT + no dept = fail-closed
  });
});

// ---------------------------------------------------------------------------
// 2. Role names never used in authorization
// ---------------------------------------------------------------------------

describe('Role names never used in PermissionGuard', () => {
  it('A6 — two actors with same permissions but different roleNames are treated identically', () => {
    const actorA: AuthUser = { ...ACTOR_WITH_DEPT, roleCode: 'VIEWER', roleName: 'Viewer', permissions: ['incidents.read'] };
    const actorB: AuthUser = { ...ACTOR_WITH_DEPT, id: 'user-b', roleCode: 'SUPER_ADMIN', roleName: 'Super Administrator', permissions: ['incidents.read'] };

    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['incidents.read']) } as unknown as Reflector;
    const guard = new PermissionGuard(reflector);

    const ctxA = { switchToHttp: () => ({ getRequest: () => ({ user: actorA }) }), getHandler: vi.fn(), getClass: vi.fn() } as unknown as ExecutionContext;
    const ctxB = { switchToHttp: () => ({ getRequest: () => ({ user: actorB }) }), getHandler: vi.fn(), getClass: vi.fn() } as unknown as ExecutionContext;

    expect(guard.canActivate(ctxA)).toBe(true);
    expect(guard.canActivate(ctxB)).toBe(true);
  });

  it('A7 — Super Administrator roleName with empty permissions is still blocked', () => {
    const superNameButNoPerms: AuthUser = { ...ACTOR_SUPER, permissions: [] };
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['incidents.read']) } as unknown as Reflector;
    const guard = new PermissionGuard(reflector);
    const ctx = { switchToHttp: () => ({ getRequest: () => ({ user: superNameButNoPerms }) }), getHandler: vi.fn(), getClass: vi.fn() } as unknown as ExecutionContext;

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('A8 — roleName field is not read by PermissionGuard (no reference to roleName or roleCode)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../common/guards/permission.guard.ts'),
      'utf-8',
    );
    expect(src).toContain('user.permissions.includes');
    expect(src).not.toMatch(/roleName|roleCode|role\.name|role\.code/);
  });
});

// ---------------------------------------------------------------------------
// 3. Permission absent but scope row present = blocked at guard level
// ---------------------------------------------------------------------------

describe('Permission absent → blocked even if scope row present', () => {
  let service: DepartmentAccessService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DepartmentAccessService(mockDb);
  });

  it('A9 — actor with ALL_DEPARTMENTS scope row but no module.read permission is blocked by guard', () => {
    // Actor has ALL_DEPARTMENTS row (as if previously granted) but no incidents.read permission
    const actorNoReadPerm: AuthUser = {
      ...ACTOR_SUPER,
      permissions: ['access_scope.manage', 'access_scope.manage_all_departments'],
      // deliberately omitting 'incidents.read'
    };

    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['incidents.read']) } as unknown as Reflector;
    const guard = new PermissionGuard(reflector);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user: actorNoReadPerm }) }),
      getHandler: vi.fn(),
      getClass: vi.fn(),
    } as unknown as ExecutionContext;

    // Guard fires BEFORE DepartmentAccessService — actor is rejected
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('A10 — PermissionGuard does not consult UserModuleAccess table', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../common/guards/permission.guard.ts'),
      'utf-8',
    );
    expect(src).not.toMatch(/DepartmentAccessService|userModuleAccess|buildDeptFilter/);
  });

  it('A11 — scope row alone never grants access: canGrantScope does not check module read permission', () => {
    // Structural: canGrantScope only checks access_scope.manage/manage_all_departments
    // It does NOT check tasks.read, incidents.read, etc.
    // This means scope rows are only meaningful after the guard passes
    const viewerNoScopePerms: AuthUser = { ...ACTOR_WITH_DEPT, permissions: ['incidents.read'] };

    // canGrantScope returns false (no access_scope.manage)
    expect(service.canGrantScope(viewerNoScopePerms, DepartmentAccessScope.OWN_DEPARTMENT)).toBe(false);
    expect(service.canGrantScope(viewerNoScopePerms, DepartmentAccessScope.SELECTED_DEPARTMENTS)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Department change affects OWN_DEPARTMENT but NOT SELECTED_DEPARTMENTS
// ---------------------------------------------------------------------------

describe('Department change: OWN_DEPARTMENT changes, SELECTED_DEPARTMENTS grants do not', () => {
  let service: DepartmentAccessService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DepartmentAccessService(mockDb);
  });

  it('A12 — OWN_DEPARTMENT filter uses actor.departmentId — changes if dept changes', async () => {
    mockFindUnique.mockResolvedValue(null); // no DB row → OWN_DEPARTMENT default

    const filterBefore = await service.buildDeptFilter(
      { ...ACTOR_WITH_DEPT, departmentId: 'dept-old' },
      ModuleIdentifier.FACTORY_TASKS,
    );
    const filterAfter = await service.buildDeptFilter(
      { ...ACTOR_WITH_DEPT, departmentId: 'dept-new' },
      ModuleIdentifier.FACTORY_TASKS,
    );

    expect(filterBefore).toEqual({ in: ['dept-old'] });
    expect(filterAfter).toEqual({ in: ['dept-new'] });
  });

  it('A13 — SELECTED_DEPARTMENTS filter reads from grants table, not from actor.departmentId', async () => {
    // DB records SELECTED_DEPARTMENTS with dept-b and dept-c grants
    mockFindUnique
      .mockResolvedValueOnce({ scope: DepartmentAccessScope.SELECTED_DEPARTMENTS })
      .mockResolvedValueOnce({ grants: [{ departmentId: 'dept-b' }, { departmentId: 'dept-c' }] });

    // Actor's primary department is dept-a (different from grants)
    const filter = await service.buildDeptFilter(
      { ...ACTOR_WITH_DEPT, departmentId: 'dept-a' },
      ModuleIdentifier.FACTORY_TASKS,
    );

    // Result is grant list, not actor.departmentId
    expect(filter).toEqual({ in: ['dept-b', 'dept-c'] });
    expect(filter).not.toEqual({ in: ['dept-a'] });
  });

  it('A14 — SELECTED_DEPARTMENTS filter is unchanged even when actor.departmentId changes', async () => {
    const grantedDepts = [{ departmentId: 'dept-b' }, { departmentId: 'dept-c' }];

    // Simulate department change by calling with different departmentId values
    for (const deptId of ['dept-x', 'dept-y', null]) {
      mockFindUnique
        .mockResolvedValueOnce({ scope: DepartmentAccessScope.SELECTED_DEPARTMENTS })
        .mockResolvedValueOnce({ grants: grantedDepts });

      const filter = await service.buildDeptFilter(
        { ...ACTOR_WITH_DEPT, departmentId: deptId },
        ModuleIdentifier.FACTORY_TASKS,
      );

      expect(filter).toEqual({ in: ['dept-b', 'dept-c'] });
    }
  });

  it('A15 — clearing primary department (null) does not remove SELECTED_DEPARTMENTS grants', async () => {
    // Actor's dept cleared to null; SELECTED_DEPARTMENTS still uses explicit grants
    mockFindUnique
      .mockResolvedValueOnce({ scope: DepartmentAccessScope.SELECTED_DEPARTMENTS })
      .mockResolvedValueOnce({ grants: [{ departmentId: 'dept-b' }] });

    const filter = await service.buildDeptFilter(
      { ...ACTOR_WITH_DEPT, departmentId: null },
      ModuleIdentifier.FACTORY_TASKS,
    );

    expect(filter).toEqual({ in: ['dept-b'] });
  });
});

// ---------------------------------------------------------------------------
// 5. No-department fail-closed
// ---------------------------------------------------------------------------

describe('No primary department — OWN_DEPARTMENT fails closed for every module', () => {
  let service: DepartmentAccessService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DepartmentAccessService(mockDb);
    mockFindUnique.mockResolvedValue(null); // no scope rows → default OWN_DEPARTMENT
  });

  it.each([
    ModuleIdentifier.FACTORY_TASKS,
    ModuleIdentifier.INCIDENT_REPORT,
    ModuleIdentifier.MAINTENANCE_REQUESTS,
    ModuleIdentifier.SAFETY_COMPLIANCE,
    ModuleIdentifier.CONTRACTS_MANAGEMENT,
    ModuleIdentifier.PRODUCTION_DASHBOARD,
    ModuleIdentifier.ADMINISTRATION,
  ])('A16[%s] — OWN_DEPARTMENT with no dept returns {in:[]} (fail-closed)', async (mod) => {
    const filter = await service.buildDeptFilter(ACTOR_NO_DEPT, mod);
    expect(filter).toEqual({ in: [] });
  });
});

// ---------------------------------------------------------------------------
// 6. ALL_DEPARTMENTS requires explicit DB row — no permission fast-path
// ---------------------------------------------------------------------------

describe('ALL_DEPARTMENTS requires explicit DB row — no permission fast-path', () => {
  let service: DepartmentAccessService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DepartmentAccessService(mockDb);
  });

  it('A17 — SUPER_ADMIN with no DB record gets OWN_DEPARTMENT filter (not null)', async () => {
    mockFindUnique.mockResolvedValue(null); // no UserModuleAccess row

    const filter = await service.buildDeptFilter(ACTOR_SUPER, ModuleIdentifier.FACTORY_TASKS);

    // SUPER_ADMIN has departmentId=null → fail-closed, NOT ALL_DEPARTMENTS
    expect(filter).toEqual({ in: [] });
    expect(filter).not.toBeNull();
  });

  it('A18 — access_scope.manage_all_departments permission does NOT grant ALL_DEPARTMENTS scope', async () => {
    mockFindUnique.mockResolvedValue(null); // no DB row

    // Actor has the manage_all_departments permission but NO UserModuleAccess row
    const scope = await service.getScope(ACTOR_SUPER, ModuleIdentifier.INCIDENT_REPORT);

    expect(scope).toBe(DepartmentAccessScope.OWN_DEPARTMENT); // default, NOT ALL_DEPARTMENTS
  });

  it('A19 — ALL_DEPARTMENTS only comes from an explicit UserModuleAccess row', async () => {
    // With DB row → ALL_DEPARTMENTS
    mockFindUnique.mockResolvedValueOnce({ scope: DepartmentAccessScope.ALL_DEPARTMENTS });
    const withRow = await service.getScope(ACTOR_SUPER, ModuleIdentifier.INCIDENT_REPORT);
    expect(withRow).toBe(DepartmentAccessScope.ALL_DEPARTMENTS);

    // Without DB row → OWN_DEPARTMENT (even for SUPER_ADMIN)
    mockFindUnique.mockResolvedValueOnce(null);
    const withoutRow = await service.getScope(ACTOR_SUPER, ModuleIdentifier.INCIDENT_REPORT);
    expect(withoutRow).toBe(DepartmentAccessScope.OWN_DEPARTMENT);
  });
});

// ---------------------------------------------------------------------------
// 7. Privilege escalation for scope granting
// ---------------------------------------------------------------------------

describe('canGrantScope — privilege escalation prevention', () => {
  let service: DepartmentAccessService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DepartmentAccessService(mockDb);
  });

  it('A20 — operator (no access_scope perms) cannot grant any scope', () => {
    const operator: AuthUser = { ...ACTOR_WITH_DEPT, permissions: ['incidents.read', 'tasks.read'] };
    expect(service.canGrantScope(operator, DepartmentAccessScope.OWN_DEPARTMENT)).toBe(false);
    expect(service.canGrantScope(operator, DepartmentAccessScope.SELECTED_DEPARTMENTS)).toBe(false);
    expect(service.canGrantScope(operator, DepartmentAccessScope.ALL_DEPARTMENTS)).toBe(false);
  });

  it('A21 — ADMIN with access_scope.manage cannot escalate to ALL_DEPARTMENTS', () => {
    expect(service.canGrantScope(ACTOR_ADMIN, DepartmentAccessScope.OWN_DEPARTMENT)).toBe(true);
    expect(service.canGrantScope(ACTOR_ADMIN, DepartmentAccessScope.SELECTED_DEPARTMENTS)).toBe(true);
    expect(service.canGrantScope(ACTOR_ADMIN, DepartmentAccessScope.ALL_DEPARTMENTS)).toBe(false);
  });

  it('A22 — access_scope.manage_all_departments is the minimum for granting ALL_DEPARTMENTS', () => {
    // SUPER has manage_all_departments
    expect(service.canGrantScope(ACTOR_SUPER, DepartmentAccessScope.ALL_DEPARTMENTS)).toBe(true);

    // ADMIN has manage but not manage_all_departments
    expect(service.canGrantScope(ACTOR_ADMIN, DepartmentAccessScope.ALL_DEPARTMENTS)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. assertCanAccessDepartment — direct URL protection per module
// ---------------------------------------------------------------------------

describe('assertCanAccessDepartment — direct URL protection', () => {
  let service: DepartmentAccessService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DepartmentAccessService(mockDb);
  });

  it('A23 — throws DEPARTMENT_ACCESS_DENIED when actor tries to access cross-dept record via direct URL', async () => {
    // Actor has dept-a; record has dept-b; no DB scope row → OWN_DEPARTMENT
    mockFindUnique.mockResolvedValue(null);

    await expect(
      service.assertCanAccessDepartment(ACTOR_WITH_DEPT, ModuleIdentifier.INCIDENT_REPORT, 'dept-b'),
    ).rejects.toMatchObject({ response: { code: 'DEPARTMENT_ACCESS_DENIED' } });
  });

  it('A24 — does NOT throw when record is in actor\'s department', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(
      service.assertCanAccessDepartment(ACTOR_WITH_DEPT, ModuleIdentifier.INCIDENT_REPORT, 'dept-a'),
    ).resolves.toBeUndefined();
  });

  it('A25 — does NOT throw when deptId is null (record has no department)', async () => {
    // null deptId should bypass filter entirely
    await expect(
      service.assertCanAccessDepartment(ACTOR_NO_DEPT, ModuleIdentifier.INCIDENT_REPORT, null),
    ).resolves.toBeUndefined();
  });

  it('A26 — throws for NO_DEPT actor trying to access any department (fail-closed)', async () => {
    mockFindUnique.mockResolvedValue(null); // no scope row

    await expect(
      service.assertCanAccessDepartment(ACTOR_NO_DEPT, ModuleIdentifier.INCIDENT_REPORT, 'dept-a'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('A27 — does NOT throw when actor has ALL_DEPARTMENTS DB row (any dept)', async () => {
    mockFindUnique.mockResolvedValueOnce({ scope: DepartmentAccessScope.ALL_DEPARTMENTS });

    await expect(
      service.assertCanAccessDepartment(ACTOR_SUPER, ModuleIdentifier.INCIDENT_REPORT, 'dept-z'),
    ).resolves.toBeUndefined();
  });
});
