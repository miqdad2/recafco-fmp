import { describe, it, expect } from 'vitest';
import { resolvePermissions } from '../_components/permissions-utils';

describe('resolvePermissions', () => {
  it('returns empty array when permissions is undefined (does not crash)', () => {
    expect(() => resolvePermissions(undefined)).not.toThrow();
    expect(resolvePermissions(undefined)).toEqual([]);
  });

  it('returns empty array when permissions is null', () => {
    expect(resolvePermissions(null)).toEqual([]);
  });

  it('canManageAll is false when permissions is missing', () => {
    const perms = resolvePermissions(undefined);
    expect(perms.includes('access_scope.manage_all_departments')).toBe(false);
  });

  it('canManageAll is true only when access_scope.manage_all_departments is present', () => {
    const perms = resolvePermissions(['access_scope.manage_all_departments', 'users.read']);
    expect(perms.includes('access_scope.manage_all_departments')).toBe(true);
  });

  it('canManageAll is false when access_scope.manage_all_departments is absent', () => {
    const perms = resolvePermissions(['users.read', 'org.departments.read']);
    expect(perms.includes('access_scope.manage_all_departments')).toBe(false);
  });

  it('canManageAccess is false when permissions is missing', () => {
    const perms = resolvePermissions(undefined);
    expect(perms.includes('access_scope.manage')).toBe(false);
  });

  it('returns the array unchanged when input is a valid string array', () => {
    const input = ['a', 'b', 'c'];
    expect(resolvePermissions(input)).toEqual(input);
  });

  it('returns empty array when input is a non-array value', () => {
    expect(resolvePermissions(42)).toEqual([]);
    expect(resolvePermissions({})).toEqual([]);
    expect(resolvePermissions('')).toEqual([]);
  });
});
