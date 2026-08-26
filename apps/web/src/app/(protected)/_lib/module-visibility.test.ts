import { describe, it, expect } from 'vitest';
import { canSeeModule, getVisibleModules, isContractManagementOnlyAccess, isContractStaffOnlyAccess } from './module-visibility';

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
