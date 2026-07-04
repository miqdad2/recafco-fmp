import { describe, it, expect } from 'vitest';
import { getAvailableScopeOptions } from '../_components/scope-utils';

describe('getAvailableScopeOptions', () => {
  it('returns OWN_DEPARTMENT and SELECTED_DEPARTMENTS when canManageAll is false', () => {
    const opts = getAvailableScopeOptions(false);
    expect(opts).toEqual(['OWN_DEPARTMENT', 'SELECTED_DEPARTMENTS']);
    expect(opts).not.toContain('ALL_DEPARTMENTS');
  });

  it('includes ALL_DEPARTMENTS when canManageAll is true (access_scope.manage_all_departments)', () => {
    const opts = getAvailableScopeOptions(true);
    expect(opts).toContain('ALL_DEPARTMENTS');
    expect(opts).toHaveLength(3);
  });

  it('ALL_DEPARTMENTS is the last option when present', () => {
    const opts = getAvailableScopeOptions(true);
    expect(opts[opts.length - 1]).toBe('ALL_DEPARTMENTS');
  });

  it('OWN_DEPARTMENT is always first regardless of canManageAll', () => {
    expect(getAvailableScopeOptions(false)[0]).toBe('OWN_DEPARTMENT');
    expect(getAvailableScopeOptions(true)[0]).toBe('OWN_DEPARTMENT');
  });

  it('without access_scope.manage_all_departments, ALL_DEPARTMENTS is never returned', () => {
    const opts = getAvailableScopeOptions(false);
    expect(opts.includes('ALL_DEPARTMENTS')).toBe(false);
  });
});
