import { describe, it, expect } from 'vitest';
import { applyFullPlatformAccess, FULL_PLATFORM_READ_PERMISSIONS } from './full-platform-access';

const CONTRACT_MANAGER = ['contracts.read', 'contracts.create', 'contracts.update', 'contracts.close'];

describe('applyFullPlatformAccess', () => {
  it('leaves permissions untouched unless the flag is explicitly true', () => {
    expect(applyFullPlatformAccess(CONTRACT_MANAGER, false)).toBe(CONTRACT_MANAGER);
    expect(applyFullPlatformAccess(CONTRACT_MANAGER, undefined)).toBe(CONTRACT_MANAGER);
    expect(applyFullPlatformAccess(CONTRACT_MANAGER, null)).toBe(CONTRACT_MANAGER);
  });

  it('adds the module read codes so dashboards open', () => {
    const out = applyFullPlatformAccess(CONTRACT_MANAGER, true);
    for (const p of ['production.read', 'storage_delivery.read', 'erection.read', 'tasks.read', 'incidents.read', 'maintenance.read', 'safety.read']) {
      expect(out).toContain(p);
    }
  });

  it('keeps every existing permission and adds no duplicates', () => {
    const out = applyFullPlatformAccess(CONTRACT_MANAGER, true);
    for (const p of CONTRACT_MANAGER) expect(out).toContain(p);
    expect(new Set(out).size).toBe(out.length);
  });

  it('adds ONLY read codes: no write/update/manage, no admin, no contracts.manage', () => {
    for (const p of FULL_PLATFORM_READ_PERMISSIONS) expect(p.endsWith('.read')).toBe(true);
    const added = applyFullPlatformAccess([], true);
    for (const forbidden of ['production.update', 'storage_delivery.update', 'erection.update', 'tasks.create', 'tasks.manage', 'tasks.update_progress', 'contracts.manage', 'users.read', 'roles.read', 'access_scope.manage']) {
      expect(added).not.toContain(forbidden);
    }
    expect(added.some((p) => /^(users|roles|org|audit|access_scope)\./.test(p))).toBe(false);
  });
});
