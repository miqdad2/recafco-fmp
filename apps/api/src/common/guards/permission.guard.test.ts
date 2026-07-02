import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import type { AuthUser } from '../types/auth-user';

const ACTOR_ADMIN: AuthUser = {
  id: 'user-001',
  username: 'admin',
  displayName: 'Admin',
  roleId: 'role-001',
  roleCode: 'ADMIN',
  roleName: 'Administrator',
  permissions: ['users.read', 'users.create', 'roles.read', 'incidents.read', 'production.manage'],
  isActive: true,
  mustChangePassword: false,
  sessionId: 'session-001',
};

const ACTOR_VIEWER: AuthUser = {
  ...ACTOR_ADMIN,
  id: 'user-002',
  username: 'viewer',
  roleCode: 'VIEWER',
  roleName: 'Viewer',
  permissions: ['users.read', 'roles.read', 'incidents.read'],
};

function makeContext(user: AuthUser | undefined, handler = vi.fn(), cls = vi.fn()): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => handler,
    getClass: () => cls,
  } as unknown as ExecutionContext;
}

const mockReflectorGet = vi.fn();
const mockReflector = {
  getAllAndOverride: mockReflectorGet,
} as unknown as Reflector;

describe('PermissionGuard', () => {
  let guard: PermissionGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new PermissionGuard(mockReflector);
  });

  it('returns true when no @Permissions decorator is present (unguarded route)', () => {
    mockReflectorGet.mockReturnValue(undefined);
    const ctx = makeContext(ACTOR_VIEWER);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('returns true when required permissions array is empty', () => {
    mockReflectorGet.mockReturnValue([]);
    const ctx = makeContext(ACTOR_VIEWER);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('returns true when actor has all required permissions', () => {
    mockReflectorGet.mockReturnValue(['users.read', 'roles.read']);
    const ctx = makeContext(ACTOR_VIEWER);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws 403 when actor is missing one required permission', () => {
    mockReflectorGet.mockReturnValue(['users.create']);
    const ctx = makeContext(ACTOR_VIEWER);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws 403 when actor has none of the required permissions', () => {
    mockReflectorGet.mockReturnValue(['production.manage']);
    const ctx = makeContext(ACTOR_VIEWER);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('returns true when admin has all required permissions including production.manage', () => {
    mockReflectorGet.mockReturnValue(['production.manage']);
    const ctx = makeContext(ACTOR_ADMIN);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws 403 when actor has partial permissions (requires both, has one)', () => {
    mockReflectorGet.mockReturnValue(['users.read', 'users.create']);
    const ctx = makeContext(ACTOR_VIEWER);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws 403 when req.user is undefined (no auth — guard should not be reached normally)', () => {
    mockReflectorGet.mockReturnValue(['users.read']);
    const ctx = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
