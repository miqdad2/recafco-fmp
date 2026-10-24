import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PermissionGuard } from '../common/guards/permission.guard';
import type { AuthUser } from '../common/types/auth-user';
import { ContractOperationsProgressController, OperationsSourceController } from './operations-source.controller';
import { LinkSourceProjectDto, RegisterSourceProjectDto, SetFactoryMappingDto, UnlinkSourceProjectDto } from './dto/operations-source.dto';

const BASE: AuthUser = {
  id: 'u1', username: 'u', displayName: 'U', roleId: 'r1', roleCode: 'X', roleName: 'X', permissions: [],
  isActive: true, mustChangePassword: false, sessionId: 's1', departmentId: null,
};
const guard = new PermissionGuard(new Reflector());
const as = (permissions: string[]): AuthUser => ({ ...BASE, permissions });

type Ctor<T> = { prototype: T };
function ctx<T extends object>(cls: Ctor<T>, handler: keyof T, user: AuthUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => cls.prototype[handler],
    getClass: () => cls,
  } as unknown as ExecutionContext;
}

const READER = ['contracts.read'];
const LINKER = ['contracts.read', 'contracts.operations_link'];
const OTHER_ADMIN = ['contracts.update', 'contracts.manage', 'users.read', 'sales.manage', 'production.update'];

describe('Operations source authorization', () => {
  const reads: (keyof OperationsSourceController)[] = ['projects', 'status'];
  const writes: (keyof OperationsSourceController)[] = ['register', 'link', 'unlink', 'setMapping', 'deleteMapping'];

  it('a contracts reader can look but cannot register, link, unlink or map', () => {
    for (const h of reads) expect(guard.canActivate(ctx(OperationsSourceController, h, as(READER)))).toBe(true);
    for (const h of writes) expect(() => guard.canActivate(ctx(OperationsSourceController, h, as(READER)))).toThrow(ForbiddenException);
  });

  it('only contracts.operations_link opens the write routes', () => {
    for (const h of writes) expect(guard.canActivate(ctx(OperationsSourceController, h, as(LINKER)))).toBe(true);
  });

  it('contracts.update / contracts.manage alone do not allow changing links', () => {
    for (const h of writes) expect(() => guard.canActivate(ctx(OperationsSourceController, h, as([...READER, ...OTHER_ADMIN])))).toThrow(ForbiddenException);
  });

  it('users without contracts.read get nothing', () => {
    for (const h of reads) expect(() => guard.canActivate(ctx(OperationsSourceController, h, as(['sales.read'])))).toThrow(ForbiddenException);
  });

  it('the per-contract routes need contracts.read (refresh included — it only queues a background check)', () => {
    for (const h of ['progress', 'history', 'refresh'] as const) {
      expect(guard.canActivate(ctx(ContractOperationsProgressController, h, as(READER)))).toBe(true);
      expect(() => guard.canActivate(ctx(ContractOperationsProgressController, h, as([])))).toThrow(ForbiddenException);
    }
  });

  it('unauthenticated requests are rejected', () => {
    expect(() => guard.canActivate(ctx(OperationsSourceController, 'projects', undefined))).toThrow();
  });
});

describe('read-only toward the source', () => {
  it('no code in this module makes an HTTP call or imports an HTTP client', () => {
    const dir = __dirname;
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    for (const f of files) {
      const text = readFileSync(join(dir, f), 'utf8');
      expect(text, f).not.toMatch(/\bfetch\s*\(/);
      expect(text, f).not.toMatch(/from ['"](axios|node-fetch|undici|http|https)['"]/);
    }
  });
});

async function errors(cls: new () => object, body: object): Promise<string[]> {
  const res = await validate(plainToInstance(cls, body), { whitelist: true, forbidNonWhitelisted: true });
  return res.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('input validation', () => {
  it('accepts the documented source id and rejects path-like or odd ids', async () => {
    expect(await errors(RegisterSourceProjectDto, { sourceProjectId: 'shapoorji-2025-92' })).toEqual([]);
    for (const bad of ['../admin', 'a/b', 'x?y=1', 'a b', '', ' ', 'a'.repeat(250), '-lead']) {
      expect(await errors(RegisterSourceProjectDto, { sourceProjectId: bad }), bad).not.toEqual([]);
    }
  });
  it('needs a real contract id to link and a reason to unlink', async () => {
    expect(await errors(LinkSourceProjectDto, { contractId: 'not-a-uuid' })).not.toEqual([]);
    expect(await errors(LinkSourceProjectDto, { contractId: '7a4c1d2e-3b5f-4c6d-8e9f-0a1b2c3d4e5f' })).toEqual([]);
    expect(await errors(UnlinkSourceProjectDto, {})).not.toEqual([]);
    expect(await errors(UnlinkSourceProjectDto, { reason: '  ' })).not.toEqual([]);
  });
  it('normalizes and bounds the factory code', async () => {
    const dto = plainToInstance(SetFactoryMappingDto, { factoryCode: ' pc ', plantId: '7a4c1d2e-3b5f-4c6d-8e9f-0a1b2c3d4e5f' });
    expect(dto.factoryCode).toBe('PC');
    expect(await errors(SetFactoryMappingDto, { factoryCode: 'bad code!', plantId: '7a4c1d2e-3b5f-4c6d-8e9f-0a1b2c3d4e5f' })).not.toEqual([]);
  });
});
