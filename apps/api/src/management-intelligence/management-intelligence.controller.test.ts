import { describe, it, expect } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from '../common/guards/permission.guard';
import type { AuthUser } from '../common/types/auth-user';
import { ManagementIntelligenceController } from './management-intelligence.controller';
import { ManagementIntelligenceService } from './management-intelligence.service';

const BASE: AuthUser = {
  id: 'u1',
  username: 'u',
  displayName: 'U',
  roleId: 'r1',
  roleCode: 'X',
  roleName: 'X',
  permissions: [],
  isActive: true,
  mustChangePassword: false,
  sessionId: 's1',
  departmentId: null,
};

function ctx(user: AuthUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ManagementIntelligenceController.prototype.status,
    getClass: () => ManagementIntelligenceController,
  } as unknown as ExecutionContext;
}

const guard = new PermissionGuard(new Reflector());

describe('ManagementIntelligenceController authorization', () => {
  it('allows management_intelligence.read', () => {
    expect(guard.canActivate(ctx({ ...BASE, permissions: ['management_intelligence.read'] }))).toBe(true);
  });

  it('rejects an operational user with broad permissions but no management permission', () => {
    const permissions = ['contracts.read', 'contracts.update', 'production.read', 'production.update', 'users.read'];
    expect(() => guard.canActivate(ctx({ ...BASE, roleCode: 'EXECUTIVE_MANAGER', permissions }))).toThrow(ForbiddenException);
  });

  it('does not let SUPER_ADMIN role code substitute for the permission', () => {
    expect(() => guard.canActivate(ctx({ ...BASE, roleCode: 'SUPER_ADMIN', permissions: ['access_scope.manage'] }))).toThrow(ForbiddenException);
  });

  it('rejects a request with no user', () => {
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });
});

describe('ManagementIntelligenceService', () => {
  it('reports NOT_CONFIGURED and exposes no figures', () => {
    const status = new ManagementIntelligenceService().getConnectionStatus();
    expect(status.state).toBe('NOT_CONFIGURED');
    expect(Object.keys(status).sort()).toEqual(['message', 'source', 'state']);
  });
});
