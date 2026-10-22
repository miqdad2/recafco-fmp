import { describe, it, expect } from 'vitest';
import { getLandingPath } from '../app/(protected)/_lib/access-mode';
import { hasManagementAccess, isManagementOnlyAccess, MANAGEMENT_HOME_PATH } from './management-access';

const MGMT = ['management_intelligence.read'];

describe('management access rules', () => {
  it('detects the management permission', () => {
    expect(hasManagementAccess(MGMT)).toBe(true);
    expect(hasManagementAccess(['contracts.read'])).toBe(false);
    expect(hasManagementAccess([])).toBe(false);
  });

  it('treats an account holding only management permissions as management-only', () => {
    expect(isManagementOnlyAccess(MGMT)).toBe(true);
  });

  it.each([
    ['contracts.read'],
    ['production.read'],
    ['users.read'],
    ['access_scope.manage'],
    ['storage_delivery.read'],
    ['erection.read'],
    ['tasks.create'],
  ])('is not management-only when %s is also held', (extra) => {
    expect(isManagementOnlyAccess([...MGMT, extra])).toBe(false);
  });

  it('is not management-only with the Full Platform Access flag', () => {
    expect(isManagementOnlyAccess(MGMT, true)).toBe(false);
  });

  it('is never management-only without the permission (including empty permissions)', () => {
    expect(isManagementOnlyAccess([])).toBe(false);
  });
});

describe('login routing (getLandingPath)', () => {
  it('sends a management-only user to the Management Intelligence Center', () => {
    expect(getLandingPath(MGMT)).toBe(MANAGEMENT_HOME_PATH);
  });

  it('keeps a single-module operational user on their module dashboard', () => {
    expect(getLandingPath(['contracts.read'])).toBe('/contracts/dashboard');
  });

  it('does not let the management permission override an operational user\'s landing', () => {
    expect(getLandingPath([...MGMT, 'contracts.read'])).toBe('/contracts/dashboard');
    expect(getLandingPath([...MGMT, 'contracts.read', 'production.read'])).toBe('/dashboard');
  });

  it('keeps Super Admin / Administration users on the Control Center', () => {
    expect(getLandingPath(['users.read', 'roles.read'])).toBe('/dashboard');
  });

  it('keeps Full Platform Access users on the Control Center', () => {
    expect(getLandingPath(['contracts.read'], true)).toBe('/dashboard');
  });
});
