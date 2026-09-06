import { describe, it, expect, vi } from 'vitest';
import { logContractActivity } from './contract-activity-log';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';

const ACTOR: AuthUser = {
  id: 'user-1',
  username: 'manager',
  displayName: 'Manager',
  roleId: 'role-admin',
  roleCode: 'ADMIN',
  roleName: 'Admin',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-1',
  departmentId: null,
  permissions: ['contracts.read', 'contracts.update'],
};

function makeDb(createImpl: () => Promise<unknown>): DatabaseService {
  const mockCreate = vi.fn(createImpl);
  return { getClient: vi.fn(() => ({ contractActivity: { create: mockCreate } })) } as unknown as DatabaseService;
}

describe('logContractActivity', () => {
  it('writes contractId, actorUserId, actorName, event, and metadata into ContractActivity', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'activity-1' });
    const db = { getClient: vi.fn(() => ({ contractActivity: { create: mockCreate } })) } as unknown as DatabaseService;

    await logContractActivity(db, 'contract-1', ACTOR, 'payment_created', { paymentId: 'payment-1' });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        contractId: 'contract-1',
        actorUserId: 'user-1',
        actorName: 'Manager',
        event: 'payment_created',
        metadata: { paymentId: 'payment-1' },
      },
    });
  });

  it('omits metadata entirely when not provided (never writes a fake empty object)', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'activity-1' });
    const db = { getClient: vi.fn(() => ({ contractActivity: { create: mockCreate } })) } as unknown as DatabaseService;

    await logContractActivity(db, 'contract-1', ACTOR, 'risk_created');

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        contractId: 'contract-1',
        actorUserId: 'user-1',
        actorName: 'Manager',
        event: 'risk_created',
      },
    });
  });

  it('never throws when the underlying write fails — a logging failure must not break the real operation', async () => {
    const db = makeDb(() => Promise.reject(new Error('db unavailable')));
    await expect(logContractActivity(db, 'contract-1', ACTOR, 'claim_created')).resolves.toBeUndefined();
  });
});
