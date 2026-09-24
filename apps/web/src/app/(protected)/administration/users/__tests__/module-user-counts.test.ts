import { describe, it, expect } from 'vitest';
import { computeModuleUserCounts, computeExecutiveManagerCount, type RolePermissionMap } from '../_components/module-user-counts';

const ROLE_PERMS: RolePermissionMap = {
  CONTRACT_STAFF: ['contracts.read', 'contracts.comment', 'contracts.workflow_update'],
  CONTRACT_MANAGER: [
    'contracts.read', 'contracts.create', 'contracts.update', 'contracts.activate',
    'contracts.terminate', 'contracts.close', 'contracts.comment', 'contracts.workflow_update',
  ],
  CONTRACT_MANAGEMENT_USER: [
    'contracts.read', 'contracts.create', 'contracts.update',
    'contracts.activate', 'contracts.terminate', 'contracts.close', 'contracts.comment',
  ],
  ADMIN: ['users.read', 'contracts.read', 'tasks.read', 'incidents.read', 'maintenance.read', 'safety.read', 'production.read'],
  SUPER_ADMIN: ['users.read', 'contracts.read', 'tasks.read', 'incidents.read', 'maintenance.read', 'safety.read', 'production.read'],
  VIEWER: [],
};

describe('computeModuleUserCounts', () => {
  it('returns zero counts for every module when there are no users', () => {
    const counts = computeModuleUserCounts([], ROLE_PERMS);
    expect(counts['CONTRACTS_MANAGEMENT']?.total).toBe(0);
    expect(counts['FACTORY_TASKS']?.total).toBe(0);
  });

  it('counts a user toward a module only when their role carries that module read permission', () => {
    const users = [{ roleCode: 'CONTRACT_STAFF' }, { roleCode: 'VIEWER' }];
    const counts = computeModuleUserCounts(users, ROLE_PERMS);
    expect(counts['CONTRACTS_MANAGEMENT']?.total).toBe(1);
    expect(counts['FACTORY_TASKS']?.total).toBe(0);
  });

  it('ignores a role code with no known permission mapping (defensive, does not throw)', () => {
    const users = [{ roleCode: 'SOME_UNKNOWN_ROLE' }];
    expect(() => computeModuleUserCounts(users, ROLE_PERMS)).not.toThrow();
    expect(computeModuleUserCounts(users, ROLE_PERMS)['CONTRACTS_MANAGEMENT']?.total).toBe(0);
  });

  it('splits Contract Management into staffCount (CONTRACT_STAFF) and managerCount (everyone else with access)', () => {
    const users = [
      { roleCode: 'CONTRACT_STAFF' },
      { roleCode: 'CONTRACT_STAFF' },
      { roleCode: 'CONTRACT_MANAGER' },
      { roleCode: 'CONTRACT_MANAGEMENT_USER' },
      { roleCode: 'ADMIN' },
    ];
    const counts = computeModuleUserCounts(users, ROLE_PERMS);
    expect(counts['CONTRACTS_MANAGEMENT']).toEqual({ total: 5, staffCount: 2, managerCount: 3 });
  });

  it('matches the spec example: 1 manager, 1 staff -> total 2', () => {
    const users = [{ roleCode: 'CONTRACT_STAFF' }, { roleCode: 'CONTRACT_MANAGER' }];
    const counts = computeModuleUserCounts(users, ROLE_PERMS);
    expect(counts['CONTRACTS_MANAGEMENT']).toEqual({ total: 2, staffCount: 1, managerCount: 1 });
  });

  it('does not compute a staff/manager split for modules other than Contract Management', () => {
    const users = [{ roleCode: 'ADMIN' }];
    const counts = computeModuleUserCounts(users, ROLE_PERMS);
    expect(counts['FACTORY_TASKS']).toEqual({ total: 1 });
    expect(counts['FACTORY_TASKS']?.staffCount).toBeUndefined();
  });

  it('counts every operational module independently for a broad-access role', () => {
    const users = [{ roleCode: 'SUPER_ADMIN' }];
    const counts = computeModuleUserCounts(users, ROLE_PERMS);
    for (const mod of ['CONTRACTS_MANAGEMENT', 'FACTORY_TASKS', 'INCIDENT_REPORT', 'MAINTENANCE_REQUESTS', 'SAFETY_COMPLIANCE', 'PRODUCTION_DASHBOARD']) {
      expect(counts[mod]?.total).toBe(1);
    }
  });
});

describe('computeExecutiveManagerCount', () => {
  it('is 0 when there are no users', () => {
    expect(computeExecutiveManagerCount([])).toBe(0);
  });

  it('counts only EXECUTIVE_MANAGER role-code users, not ADMIN/SUPER_ADMIN even though they share the same operational permissions', () => {
    const users = [
      { roleCode: 'EXECUTIVE_MANAGER' },
      { roleCode: 'EXECUTIVE_MANAGER' },
      { roleCode: 'ADMIN' },
      { roleCode: 'SUPER_ADMIN' },
      { roleCode: 'VIEWER' },
    ];
    expect(computeExecutiveManagerCount(users)).toBe(2);
  });
});
