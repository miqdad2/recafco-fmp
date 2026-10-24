import { describe, it, expect, vi } from 'vitest';
import { NotFoundException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from '../../common/guards/permission.guard';
import type { AuthUser } from '../../common/types/auth-user';
import type { DatabaseService } from '../../database/database.service';
import { operationsDemoAllowed, isDemoSourceProjectId } from '../demo-guard';
import { OperationsDemoService, nextDemoTotals, DEMO_SOURCE_PROJECT_ID } from './operations-demo.service';
import { OperationsDemoController } from './operations-demo.controller';
import { ApiEnvSchema } from '@recafco/config';

const ACTOR: AuthUser = {
  id: 'u1', username: 'u', displayName: 'U', roleId: 'r', roleCode: 'X', roleName: 'X', permissions: ['contracts.operations_link'],
  isActive: true, mustChangePassword: false, sessionId: 's', departmentId: null,
};

describe('demonstration guard (development only)', () => {
  it('is never allowed in production, even when switched on', () => {
    expect(operationsDemoAllowed({ NODE_ENV: 'production', OPERATIONS_DEMO_ENABLED: 'true' })).toBe(false);
  });
  it('needs the explicit flag, and only the literal true', () => {
    expect(operationsDemoAllowed({ NODE_ENV: 'development' })).toBe(false);
    expect(operationsDemoAllowed({ NODE_ENV: 'development', OPERATIONS_DEMO_ENABLED: 'yes' })).toBe(false);
    expect(operationsDemoAllowed({ NODE_ENV: 'development', OPERATIONS_DEMO_ENABLED: 'true' })).toBe(true);
  });
  it('recognises demonstration source ids', () => {
    expect(isDemoSourceProjectId(DEMO_SOURCE_PROJECT_ID)).toBe(true);
    expect(isDemoSourceProjectId('shapoorji-2025-92')).toBe(false);
  });
  it('the API refuses to start in production with the demo flag set', () => {
    const base = { DATABASE_URL: 'postgresql://u:p@h/db', JWT_ACCESS_SECRET: 'x'.repeat(40), JWT_REFRESH_SECRET: 'y'.repeat(40), CORS_ALLOWED_ORIGINS: 'https://fmp.example' };
    expect(() => ApiEnvSchema.parse({ ...base, NODE_ENV: 'production', OPERATIONS_DEMO_ENABLED: 'true' })).toThrow(/must not be set in production/);
    expect(ApiEnvSchema.parse({ ...base, NODE_ENV: 'production' }).operationsDemoEnabled).toBe(false);
    expect(ApiEnvSchema.parse({ ...base, NODE_ENV: 'development', OPERATIONS_DEMO_ENABLED: 'true' }).operationsDemoEnabled).toBe(true);
  });
});

describe('demonstration service', () => {
  it('every operation is a 404 when demonstration is not allowed, and touches nothing', async () => {
    const client = { contract: { findUnique: vi.fn(), create: vi.fn() }, $transaction: vi.fn() };
    const svc = new OperationsDemoService({ getClient: () => client } as unknown as DatabaseService);
    const prev = process.env['OPERATIONS_DEMO_ENABLED'];
    delete process.env['OPERATIONS_DEMO_ENABLED'];
    try {
      for (const call of [() => svc.status(), () => svc.seed(ACTOR), () => svc.reset(ACTOR), () => svc.simulate(ACTOR, 'update'), () => svc.simulate(ACTOR, 'outage')]) {
        await expect(call()).rejects.toBeInstanceOf(NotFoundException);
      }
      expect(client.contract.create).not.toHaveBeenCalled();
      expect(client.$transaction).not.toHaveBeenCalled();
    } finally {
      if (prev !== undefined) process.env['OPERATIONS_DEMO_ENABLED'] = prev;
    }
  });
});

describe('nextDemoTotals', () => {
  const base = { total: 2727, issued: 2727, produced: 2219, delivered: 1610, installed: 1482, pendingInputs: 1966 };
  it('grows the cumulative counts and shrinks pending inputs, never touching the requirement', () => {
    expect(nextDemoTotals(base)).toEqual({ total: 2727, issued: 2727, produced: 2259, delivered: 1635, installed: 1497, pendingInputs: 1946 });
  });
  it('keeps the documented overlap and never exceeds what was issued', () => {
    let t = base;
    for (let i = 0; i < 200; i++) t = nextDemoTotals(t);
    expect(t.produced).toBeLessThanOrEqual(t.issued);
    expect(t.delivered).toBeLessThanOrEqual(t.produced);
    expect(t.installed).toBeLessThanOrEqual(t.delivered);
    expect(t.pendingInputs).toBe(0);
  });
});

describe('demonstration controller', () => {
  const guard = new PermissionGuard(new Reflector());
  const ctx = (handler: keyof OperationsDemoController, permissions: string[]): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user: { ...ACTOR, permissions } }) }),
      getHandler: () => OperationsDemoController.prototype[handler],
      getClass: () => OperationsDemoController,
    }) as unknown as ExecutionContext;
  it('needs the integration permission; plain contract readers/editors cannot simulate', () => {
    for (const h of ['status', 'seed', 'reset', 'update', 'outage', 'recovery'] as const) {
      expect(guard.canActivate(ctx(h, ['contracts.operations_link']))).toBe(true);
      expect(() => guard.canActivate(ctx(h, ['contracts.read', 'contracts.update', 'contracts.manage']))).toThrow();
    }
  });
});
