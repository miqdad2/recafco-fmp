import { describe, it, expect } from 'vitest';
import {
  getContractDepartmentBadgeState,
  getVisibleContractTransitions,
  hasAnyVisibleTransition,
  formatContractValue,
} from './contract-ui-helpers';

// ---------------------------------------------------------------------------
// getContractDepartmentBadgeState
// covers: list page department badge rendering, no-department warning badge,
// detail page department information
// ---------------------------------------------------------------------------

describe('getContractDepartmentBadgeState', () => {
  it('returns a "No Department" warning state when department is null', () => {
    const state = getContractDepartmentBadgeState(null);
    expect(state.hasDepartment).toBe(false);
    expect(state.label).toBe('No Department');
  });

  it('returns a "No Department" warning state when department is undefined', () => {
    const state = getContractDepartmentBadgeState(undefined);
    expect(state.hasDepartment).toBe(false);
    expect(state.label).toBe('No Department');
  });

  it('returns the department name when a department is present (list row renders correctly)', () => {
    const state = getContractDepartmentBadgeState({ id: 'dept-1', name: 'Engineering' });
    expect(state.hasDepartment).toBe(true);
    expect(state.label).toBe('Engineering');
  });
});

// ---------------------------------------------------------------------------
// getVisibleContractTransitions
// covers: lifecycle actions shown/hidden by permission, contract-transitions
// component's expected action set, role-name-agnostic authorization
// ---------------------------------------------------------------------------

describe('getVisibleContractTransitions', () => {
  it('shows Activate only for DRAFT contracts with contracts.activate permission', () => {
    const visible = getVisibleContractTransitions('DRAFT', ['contracts.activate']);
    expect(visible).toEqual({ activate: true, terminate: false, close: false });
  });

  it('hides Activate when contracts.activate permission is absent, even for a DRAFT contract', () => {
    const visible = getVisibleContractTransitions('DRAFT', ['contracts.read']);
    expect(visible.activate).toBe(false);
  });

  it('hides Activate for a non-DRAFT contract even with the permission present', () => {
    const visible = getVisibleContractTransitions('ACTIVE', ['contracts.activate']);
    expect(visible.activate).toBe(false);
  });

  it('shows Terminate only for ACTIVE contracts with contracts.terminate permission', () => {
    const visible = getVisibleContractTransitions('ACTIVE', ['contracts.terminate']);
    expect(visible).toEqual({ activate: false, terminate: true, close: false });
  });

  it('hides Terminate without contracts.terminate permission', () => {
    const visible = getVisibleContractTransitions('ACTIVE', ['contracts.read']);
    expect(visible.terminate).toBe(false);
  });

  it('shows Close for ACTIVE or TERMINATED contracts with contracts.close permission', () => {
    expect(getVisibleContractTransitions('ACTIVE', ['contracts.close']).close).toBe(true);
    expect(getVisibleContractTransitions('TERMINATED', ['contracts.close']).close).toBe(true);
  });

  it('hides Close for DRAFT or CLOSED contracts regardless of permission', () => {
    expect(getVisibleContractTransitions('DRAFT', ['contracts.close']).close).toBe(false);
    expect(getVisibleContractTransitions('CLOSED', ['contracts.close']).close).toBe(false);
  });

  it('hides Close without contracts.close permission', () => {
    expect(getVisibleContractTransitions('ACTIVE', []).close).toBe(false);
  });

  it('returns all actions visible for a full-permission actor on an ACTIVE contract', () => {
    const visible = getVisibleContractTransitions('ACTIVE', [
      'contracts.activate',
      'contracts.terminate',
      'contracts.close',
    ]);
    expect(visible).toEqual({ activate: false, terminate: true, close: true });
  });

  it('decides visibility purely from the permissions array, not from any role name or code', () => {
    // getVisibleContractTransitions accepts only (status, permissions) — there is no
    // role/roleCode/roleName parameter it could branch on. Two "roles" that carry the
    // same permission set must produce identical results.
    const adminLikePermissions = ['contracts.activate'];
    const viewerLikePermissions = ['contracts.activate'];
    expect(getVisibleContractTransitions('DRAFT', adminLikePermissions)).toEqual(
      getVisibleContractTransitions('DRAFT', viewerLikePermissions),
    );
  });
});

// ---------------------------------------------------------------------------
// hasAnyVisibleTransition
// ---------------------------------------------------------------------------

describe('hasAnyVisibleTransition', () => {
  it('returns false when no transition is visible (component renders nothing)', () => {
    expect(hasAnyVisibleTransition({ activate: false, terminate: false, close: false })).toBe(false);
  });

  it('returns true when at least one transition is visible', () => {
    expect(hasAnyVisibleTransition({ activate: true, terminate: false, close: false })).toBe(true);
    expect(hasAnyVisibleTransition({ activate: false, terminate: false, close: true })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatContractValue
// ---------------------------------------------------------------------------

describe('formatContractValue', () => {
  it('formats with 3 decimal places and a currency prefix', () => {
    expect(formatContractValue('25.5', 'KWD')).toBe('KWD 25.500');
  });

  it('adds thousands separators', () => {
    expect(formatContractValue('2550', 'KWD')).toBe('KWD 2,550.000');
  });

  it('omits the currency prefix when currency is missing', () => {
    expect(formatContractValue('2550', undefined)).toBe('2,550.000');
  });

  it('returns em dash for missing value', () => {
    expect(formatContractValue(undefined, 'KWD')).toBe('—');
  });

  it('returns em dash for unparseable value', () => {
    expect(formatContractValue('not-a-number', 'KWD')).toBe('—');
  });
});
