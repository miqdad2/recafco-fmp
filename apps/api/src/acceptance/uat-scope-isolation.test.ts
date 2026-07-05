/**
 * uat-scope-isolation.test.ts
 *
 * Automated coverage for UAT acceptance test profiles.
 * Tests are logic-only (mocked DB) — no live database required.
 *
 * B1–B3:  test.selected — SELECTED_DEPARTMENTS for configured modules,
 *         OWN_DEPARTMENT for unconfigured modules.
 * B4–B6:  test.manager  — ALL_DEPARTMENTS for INCIDENT_REPORT+CONTRACTS only;
 *         OWN_DEPARTMENT for all other modules.
 * B7–B9:  Scope badge consistency — getScope() result matches buildDeptFilter() sentinel.
 * B10–B15: Direct URL access control by scope profile.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { DepartmentAccessScope, ModuleIdentifier } from '@recafco/database';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const CM01_ID = 'dept-cm01-uuid';
const ENG01_ID = 'dept-eng01-uuid';

const ACTOR_OPERATOR: AuthUser = {
  id: 'user-operator',
  username: 'test.operator',
  displayName: '[UAT] Operator',
  roleId: 'role-viewer',
  roleCode: 'VIEWER',
  roleName: 'Viewer',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'sess-op',
  departmentId: CM01_ID,
  permissions: ['incidents.read', 'tasks.read', 'maintenance.read', 'safety.read', 'contracts.read', 'production.read'],
};

const ACTOR_SELECTED: AuthUser = {
  ...ACTOR_OPERATOR,
  id: 'user-selected',
  username: 'test.selected',
  displayName: '[UAT] Selected',
  sessionId: 'sess-sel',
  departmentId: CM01_ID,
};

const ACTOR_MANAGER: AuthUser = {
  id: 'user-manager',
  username: 'test.manager',
  displayName: '[UAT] Manager',
  roleId: 'role-admin',
  roleCode: 'ADMIN',
  roleName: 'Administrator',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'sess-mgr',
  departmentId: CM01_ID,
  permissions: ['incidents.read', 'incidents.manage', 'contracts.read', 'contracts.manage', 'maintenance.read', 'tasks.read', 'safety.read', 'production.read'],
};

const ACTOR_NODEPT: AuthUser = {
  ...ACTOR_OPERATOR,
  id: 'user-nodept',
  username: 'test.nodept',
  displayName: '[UAT] No-Dept',
  sessionId: 'sess-nd',
  departmentId: null,
};

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const mockFindUnique = vi.fn();

const mockClient = {
  userModuleAccess: { findUnique: mockFindUnique },
  department: { findMany: vi.fn() },
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

let svc: DepartmentAccessService;

beforeEach(() => {
  vi.resetAllMocks();
  svc = new DepartmentAccessService(mockDb);
});

// ---------------------------------------------------------------------------
// B1–B3: test.selected — SELECTED_DEPARTMENTS profile
// ---------------------------------------------------------------------------

describe('B — test.selected SELECTED_DEPARTMENTS profile', () => {
  it('B1: buildDeptFilter returns {in:[CM01,ENG01]} for a SELECTED_DEPARTMENTS-configured module', async () => {
    mockFindUnique
      .mockResolvedValueOnce({ scope: DepartmentAccessScope.SELECTED_DEPARTMENTS }) // getScope call
      .mockResolvedValueOnce({ // grant fetch call
        grants: [{ departmentId: CM01_ID }, { departmentId: ENG01_ID }],
      });

    const result = await svc.buildDeptFilter(ACTOR_SELECTED, ModuleIdentifier.FACTORY_TASKS);

    expect(result).toEqual({ in: [CM01_ID, ENG01_ID] });
  });

  it('B2: buildDeptFilter returns {in:[CM01]} for an OWN_DEPARTMENT (unconfigured) module', async () => {
    // No row for MAINTENANCE_REQUESTS → default OWN_DEPARTMENT
    mockFindUnique.mockResolvedValueOnce(null);

    const result = await svc.buildDeptFilter(ACTOR_SELECTED, ModuleIdentifier.MAINTENANCE_REQUESTS);

    expect(result).toEqual({ in: [CM01_ID] });
  });

  it('B3: canAccessDepartment returns true for ENG-01 on SELECTED_DEPARTMENTS [CM01,ENG01] module', async () => {
    mockFindUnique
      .mockResolvedValueOnce({ scope: DepartmentAccessScope.SELECTED_DEPARTMENTS })
      .mockResolvedValueOnce({ grants: [{ departmentId: CM01_ID }, { departmentId: ENG01_ID }] });

    const ok = await svc.canAccessDepartment(ACTOR_SELECTED, ModuleIdentifier.FACTORY_TASKS, ENG01_ID);

    expect(ok).toBe(true);
  });

  it('B4: canAccessDepartment returns false for ENG-01 on an OWN_DEPARTMENT (unconfigured) module', async () => {
    // test.selected has OWN_DEPARTMENT for MAINTENANCE_REQUESTS → only CM-01
    // OWN_DEPARTMENT path calls findUnique exactly once (getScope only)
    mockFindUnique.mockResolvedValueOnce(null); // getScope → null → OWN_DEPARTMENT

    const ok = await svc.canAccessDepartment(ACTOR_SELECTED, ModuleIdentifier.MAINTENANCE_REQUESTS, ENG01_ID);

    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// B5–B8: test.manager — mixed per-module ALL_DEPARTMENTS profile
// ---------------------------------------------------------------------------

describe('B — test.manager mixed ALL_DEPARTMENTS profile', () => {
  it('B5: buildDeptFilter returns null (ALL_DEPARTMENTS) for INCIDENT_REPORT', async () => {
    mockFindUnique.mockResolvedValueOnce({ scope: DepartmentAccessScope.ALL_DEPARTMENTS });

    const result = await svc.buildDeptFilter(ACTOR_MANAGER, ModuleIdentifier.INCIDENT_REPORT);

    expect(result).toBeNull();
  });

  it('B6: buildDeptFilter returns null (ALL_DEPARTMENTS) for CONTRACTS_MANAGEMENT', async () => {
    mockFindUnique.mockResolvedValueOnce({ scope: DepartmentAccessScope.ALL_DEPARTMENTS });

    const result = await svc.buildDeptFilter(ACTOR_MANAGER, ModuleIdentifier.CONTRACTS_MANAGEMENT);

    expect(result).toBeNull();
  });

  it('B7: buildDeptFilter returns {in:[CM01]} for MAINTENANCE_REQUESTS (not ALL_DEPARTMENTS)', async () => {
    mockFindUnique.mockResolvedValueOnce(null); // no row → OWN_DEPARTMENT

    const result = await svc.buildDeptFilter(ACTOR_MANAGER, ModuleIdentifier.MAINTENANCE_REQUESTS);

    expect(result).toEqual({ in: [CM01_ID] });
  });

  it('B8: same actor — ALL_DEPARTMENTS for one module, OWN_DEPARTMENT for another in same request sequence', async () => {
    // Simulate two sequential buildDeptFilter calls for the same actor (different modules)
    mockFindUnique
      .mockResolvedValueOnce({ scope: DepartmentAccessScope.ALL_DEPARTMENTS }) // incidents
      .mockResolvedValueOnce(null);                                              // maintenance → OWN

    const incidentFilter = await svc.buildDeptFilter(ACTOR_MANAGER, ModuleIdentifier.INCIDENT_REPORT);
    const maintenanceFilter = await svc.buildDeptFilter(ACTOR_MANAGER, ModuleIdentifier.MAINTENANCE_REQUESTS);

    expect(incidentFilter).toBeNull();
    expect(maintenanceFilter).toEqual({ in: [CM01_ID] });
  });
});

// ---------------------------------------------------------------------------
// B9–B11: Scope badge consistency — getScope sentinel matches buildDeptFilter sentinel
// ---------------------------------------------------------------------------

describe('B — Scope badge consistency', () => {
  it('B9: ALL_DEPARTMENTS scope returns null filter (badge and list use same sentinel)', async () => {
    mockFindUnique
      .mockResolvedValueOnce({ scope: DepartmentAccessScope.ALL_DEPARTMENTS }) // getScope
      .mockResolvedValueOnce({ scope: DepartmentAccessScope.ALL_DEPARTMENTS }); // buildDeptFilter's inner getScope

    const scope = await svc.getScope(ACTOR_MANAGER, ModuleIdentifier.INCIDENT_REPORT);
    const filter = await svc.buildDeptFilter(ACTOR_MANAGER, ModuleIdentifier.INCIDENT_REPORT);

    expect(scope).toBe(DepartmentAccessScope.ALL_DEPARTMENTS);
    expect(filter).toBeNull(); // null = no WHERE clause = all records
  });

  it('B10: OWN_DEPARTMENT scope returns {in:[deptId]} filter (badge matches list scope)', async () => {
    mockFindUnique
      .mockResolvedValueOnce({ scope: DepartmentAccessScope.OWN_DEPARTMENT }) // getScope
      .mockResolvedValueOnce({ scope: DepartmentAccessScope.OWN_DEPARTMENT }); // buildDeptFilter

    const scope = await svc.getScope(ACTOR_OPERATOR, ModuleIdentifier.FACTORY_TASKS);
    const filter = await svc.buildDeptFilter(ACTOR_OPERATOR, ModuleIdentifier.FACTORY_TASKS);

    expect(scope).toBe(DepartmentAccessScope.OWN_DEPARTMENT);
    expect(filter).toEqual({ in: [CM01_ID] });
  });

  it('B11: SELECTED_DEPARTMENTS scope returns non-null non-empty filter (badge matches list scope)', async () => {
    mockFindUnique
      .mockResolvedValueOnce({ scope: DepartmentAccessScope.SELECTED_DEPARTMENTS }) // getScope
      .mockResolvedValueOnce({ scope: DepartmentAccessScope.SELECTED_DEPARTMENTS }) // buildDeptFilter getScope
      .mockResolvedValueOnce({ grants: [{ departmentId: CM01_ID }, { departmentId: ENG01_ID }] }); // grants

    const scope = await svc.getScope(ACTOR_SELECTED, ModuleIdentifier.FACTORY_TASKS);
    const filter = await svc.buildDeptFilter(ACTOR_SELECTED, ModuleIdentifier.FACTORY_TASKS);

    expect(scope).toBe(DepartmentAccessScope.SELECTED_DEPARTMENTS);
    expect(filter).not.toBeNull();
    expect((filter as { in: string[] }).in).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// B12–B15: Direct URL access control by profile
// ---------------------------------------------------------------------------

describe('B — Direct URL access control by scope profile', () => {
  it('B12: test.operator (OWN_DEPARTMENT CM-01) — assertCanAccessDepartment throws for ENG-01 record', async () => {
    // OWN_DEPARTMENT → filter = {in: [CM01]}; ENG01 not in that set
    // OWN_DEPARTMENT path calls findUnique exactly once (getScope only)
    mockFindUnique.mockResolvedValueOnce(null); // getScope → null → OWN_DEPARTMENT

    await expect(
      svc.assertCanAccessDepartment(ACTOR_OPERATOR, ModuleIdentifier.INCIDENT_REPORT, ENG01_ID),
    ).rejects.toThrow(ForbiddenException);
  });

  it('B13: test.manager (ALL_DEPARTMENTS for INCIDENT_REPORT) — assertCanAccessDepartment permits ENG-01 record', async () => {
    mockFindUnique.mockResolvedValueOnce({ scope: DepartmentAccessScope.ALL_DEPARTMENTS });

    await expect(
      svc.assertCanAccessDepartment(ACTOR_MANAGER, ModuleIdentifier.INCIDENT_REPORT, ENG01_ID),
    ).resolves.toBeUndefined();
  });

  it('B14: test.manager (OWN_DEPARTMENT for MAINTENANCE_REQUESTS) — assertCanAccessDepartment throws for ENG-01 record', async () => {
    mockFindUnique.mockResolvedValueOnce(null); // no row → OWN_DEPARTMENT → {in: [CM01]}

    await expect(
      svc.assertCanAccessDepartment(ACTOR_MANAGER, ModuleIdentifier.MAINTENANCE_REQUESTS, ENG01_ID),
    ).rejects.toThrow(ForbiddenException);
  });

  it('B15: test.nodept (OWN_DEPARTMENT, no dept) — assertCanAccessDepartment throws for any department', async () => {
    // OWN_DEPARTMENT, departmentId = null → filter = {in: []} → no access to any dept record
    mockFindUnique.mockResolvedValueOnce(null); // no row → OWN_DEPARTMENT

    await expect(
      svc.assertCanAccessDepartment(ACTOR_NODEPT, ModuleIdentifier.INCIDENT_REPORT, CM01_ID),
    ).rejects.toThrow(ForbiddenException);
  });
});
