import { describe, it, expect } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { assertCanWriteErectionDepartmentStep } from './erection-department-write-access';
import type { AuthUser } from '../common/types/auth-user';

function actor(permissions: string[]): AuthUser {
  return { id: 'user-1', displayName: 'Test User', permissions } as AuthUser;
}

describe('assertCanWriteErectionDepartmentStep', () => {
  it('does not throw for a manager-tier actor (contracts.update)', () => {
    expect(() => assertCanWriteErectionDepartmentStep(actor(['contracts.read', 'contracts.update']))).not.toThrow();
  });

  it('does not throw for a Contract-Staff-tier actor (contracts.workflow_update only) — an assigned Erection Manager', () => {
    expect(() => assertCanWriteErectionDepartmentStep(actor(['contracts.read', 'contracts.workflow_update']))).not.toThrow();
  });

  it('throws for an actor with only contracts.read', () => {
    expect(() => assertCanWriteErectionDepartmentStep(actor(['contracts.read']))).toThrow(ForbiddenException);
  });

  it('throws for an actor with no permissions at all', () => {
    expect(() => assertCanWriteErectionDepartmentStep(actor([]))).toThrow(ForbiddenException);
  });
});
