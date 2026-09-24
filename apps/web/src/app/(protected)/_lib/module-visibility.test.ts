import { describe, it, expect } from 'vitest';
import { canSeeModule, getVisibleModules, isContractManagementOnlyAccess, isContractStaffOnlyAccess, isErectionDashboardMonitorOnly, isExecutiveManagerAccess, isExecutiveManagerOrAdminAccess } from './module-visibility';

describe('canSeeModule', () => {
  it('grants each operational module only when its read permission is present', () => {
    expect(canSeeModule(['contracts.read'], 'CONTRACTS_MANAGEMENT')).toBe(true);
    expect(canSeeModule(['contracts.read'], 'FACTORY_TASKS')).toBe(false);
    expect(canSeeModule(['tasks.read'], 'FACTORY_TASKS')).toBe(true);
  });

  it('grants ADMINISTRATION when any admin-area permission is present, not a specific one', () => {
    expect(canSeeModule(['users.read'], 'ADMINISTRATION')).toBe(true);
    expect(canSeeModule(['org.plants.read'], 'ADMINISTRATION')).toBe(true);
    expect(canSeeModule([], 'ADMINISTRATION')).toBe(false);
    // Regression: a permission that merely LOOKS admin-adjacent must not leak access.
    expect(canSeeModule(['contracts.read'], 'ADMINISTRATION')).toBe(false);
  });

  it('denies everything for a user with no permissions', () => {
    expect(canSeeModule([], 'CONTRACTS_MANAGEMENT')).toBe(false);
    expect(canSeeModule([], 'FACTORY_TASKS')).toBe(false);
  });
});

describe('getVisibleModules', () => {
  it('returns only Contract Management for a contracts-only permission set', () => {
    expect(getVisibleModules(['contracts.read'])).toEqual(['CONTRACTS_MANAGEMENT']);
  });

  it('returns all modules a Super Admin-equivalent permission set grants', () => {
    const superAdminPerms = [
      'tasks.read', 'incidents.read', 'maintenance.read', 'safety.read',
      'contracts.read', 'production.read', 'users.read', 'roles.read',
    ];
    expect(getVisibleModules(superAdminPerms)).toEqual([
      'FACTORY_TASKS', 'INCIDENT_REPORT', 'MAINTENANCE_REQUESTS', 'SAFETY_COMPLIANCE',
      'CONTRACTS_MANAGEMENT', 'PRODUCTION_DASHBOARD', 'ADMINISTRATION',
    ]);
  });

  it('returns only the modules that intersect a mixed permission set', () => {
    expect(getVisibleModules(['contracts.read', 'safety.read'])).toEqual([
      'SAFETY_COMPLIANCE', 'CONTRACTS_MANAGEMENT',
    ]);
  });

  it('returns an empty list for a user with no permissions', () => {
    expect(getVisibleModules([])).toEqual([]);
  });
});

describe('isContractManagementOnlyAccess', () => {
  it('is true when Contract Management is the only visible module', () => {
    expect(isContractManagementOnlyAccess(['contracts.read'])).toBe(true);
  });

  it('is false when the user also has another operational module', () => {
    expect(isContractManagementOnlyAccess(['contracts.read', 'safety.read'])).toBe(false);
  });

  it('is false when the user also has Administration access', () => {
    expect(isContractManagementOnlyAccess(['contracts.read', 'users.read'])).toBe(false);
  });

  it('is false when the user has no modules at all', () => {
    expect(isContractManagementOnlyAccess([])).toBe(false);
  });

  it('is false for a Super Admin-equivalent permission set', () => {
    expect(isContractManagementOnlyAccess(['contracts.read', 'tasks.read', 'users.read'])).toBe(false);
  });
});

describe('isContractStaffOnlyAccess', () => {
  it('is true for CM-35 Contract Staff (workflow_update, no update/close)', () => {
    expect(isContractStaffOnlyAccess(['contracts.read', 'contracts.comment', 'contracts.workflow_update'])).toBe(true);
  });

  it('is false for Contract Manager (has both workflow_update and update)', () => {
    expect(isContractStaffOnlyAccess([
      'contracts.read', 'contracts.create', 'contracts.update', 'contracts.activate',
      'contracts.terminate', 'contracts.close', 'contracts.comment', 'contracts.workflow_update',
    ])).toBe(false);
  });

  it('is false for the legacy CONTRACT_MANAGEMENT_USER role (has update/close, no workflow_update)', () => {
    expect(isContractStaffOnlyAccess([
      'contracts.read', 'contracts.create', 'contracts.update',
      'contracts.activate', 'contracts.terminate', 'contracts.close', 'contracts.comment',
    ])).toBe(false);
  });

  it('is false when workflow_update is absent entirely', () => {
    expect(isContractStaffOnlyAccess(['contracts.read', 'contracts.comment'])).toBe(false);
  });

  it('is false for a user with contracts.close but not contracts.update (edge case, still manager-tier)', () => {
    expect(isContractStaffOnlyAccess(['contracts.read', 'contracts.workflow_update', 'contracts.close'])).toBe(false);
  });

  it('is false for an empty permission set', () => {
    expect(isContractStaffOnlyAccess([])).toBe(false);
  });
});

describe('isErectionDashboardMonitorOnly (CM-71H)', () => {
  it('is true for a manager-tier actor (contracts.update) — relabels "Erection Status" in the sidebar', () => {
    expect(isErectionDashboardMonitorOnly(['contracts.read', 'contracts.update'])).toBe(true);
  });

  it('is false for a non-manager actor (e.g. a future Erection Manager with only contracts.workflow_update) — keeps "Erection Dashboard"', () => {
    expect(isErectionDashboardMonitorOnly(['contracts.read', 'contracts.workflow_update'])).toBe(false);
  });

  it('is false for an empty permission set', () => {
    expect(isErectionDashboardMonitorOnly([])).toBe(false);
  });
});

describe('isExecutiveManagerAccess (FMP-UI-03)', () => {
  const EXECUTIVE_MANAGER_PERMS = [
    'incidents.read', 'incidents.create', 'incidents.manage',
    'tasks.read', 'tasks.create', 'tasks.manage',
    'maintenance.read', 'maintenance.create', 'maintenance.manage',
    'safety.read', 'safety.create', 'safety.manage',
    'contracts.read', 'contracts.create', 'contracts.manage', 'contracts.workflow_update',
    'production.read', 'production.create', 'production.manage',
  ];

  it('is true for the EXECUTIVE_MANAGER role permission shape (all 6 operational modules, no admin)', () => {
    expect(isExecutiveManagerAccess(EXECUTIVE_MANAGER_PERMS)).toBe(true);
  });

  it('is false for SUPER_ADMIN/ADMIN-equivalent permissions (they also hold an Administration-gating permission)', () => {
    expect(isExecutiveManagerAccess([...EXECUTIVE_MANAGER_PERMS, 'users.read'])).toBe(false);
  });

  it('is false when even one operational module is missing', () => {
    const missingProduction = EXECUTIVE_MANAGER_PERMS.filter((p) => !p.startsWith('production.'));
    expect(isExecutiveManagerAccess(missingProduction)).toBe(false);
  });

  it('is false for Contract Manager (single-module tier)', () => {
    expect(isExecutiveManagerAccess([
      'contracts.read', 'contracts.create', 'contracts.update', 'contracts.activate',
      'contracts.terminate', 'contracts.close', 'contracts.comment', 'contracts.workflow_update',
    ])).toBe(false);
  });

  it('is false for an empty permission set', () => {
    expect(isExecutiveManagerAccess([])).toBe(false);
  });
});

describe('isExecutiveManagerOrAdminAccess (FMP-UI-10)', () => {
  const EXECUTIVE_MANAGER_PERMS = [
    'incidents.read', 'tasks.read', 'maintenance.read', 'safety.read', 'contracts.read', 'production.read',
  ];

  it('is true for the Executive Manager permission shape', () => {
    expect(isExecutiveManagerOrAdminAccess(EXECUTIVE_MANAGER_PERMS)).toBe(true);
  });

  it('is true for an Admin/Super Admin-equivalent permission set, even without all 6 operational permissions', () => {
    expect(isExecutiveManagerOrAdminAccess(['users.read'])).toBe(true);
  });

  it('is false for a single-module viewer (e.g. Safety only)', () => {
    expect(isExecutiveManagerOrAdminAccess(['safety.read'])).toBe(false);
  });

  it('is false for an empty permission set', () => {
    expect(isExecutiveManagerOrAdminAccess([])).toBe(false);
  });
});
