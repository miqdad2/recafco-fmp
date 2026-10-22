import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnprocessableEntityException } from '@nestjs/common';

vi.mock('@node-rs/argon2', () => ({
  hash: vi.fn().mockResolvedValue('$argon2id$temp_hash'),
  verify: vi.fn().mockResolvedValue(true),
  Algorithm: { Argon2id: 1 },
}));

import { UsersService, MANAGEMENT_ROLE_CODE } from './users.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthService } from '../auth/auth.service';
import type { DepartmentAccessService } from '../department-access/department-access.service';

const mockUserCreate = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserFindFirst = vi.fn();
const mockUserUpdate = vi.fn();
const mockRoleFindUnique = vi.fn();
const mockAuditCreate = vi.fn();

const mockClient = {
  user: { create: mockUserCreate, findUnique: mockUserFindUnique, findFirst: mockUserFindFirst, update: mockUserUpdate },
  role: { findUnique: mockRoleFindUnique },
  securityAuditEvent: { create: mockAuditCreate },
  location: { findUnique: vi.fn() },
  $transaction: vi.fn((fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient)),
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;
const mockAuth = { hashPassword: vi.fn().mockResolvedValue('$argon2id$temp_hash'), auditEvent: vi.fn() } as unknown as AuthService;
const mockDept = { assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined) } as unknown as DepartmentAccessService;

const ACTOR = {
  id: 'actor-1',
  username: 'admin',
  displayName: 'Admin',
  roleId: 'r-sa',
  roleCode: 'SUPER_ADMIN',
  roleName: 'Super Administrator',
  permissions: ['users.create', 'users.read'],
  isActive: true,
  mustChangePassword: false,
  sessionId: 's1',
  departmentId: null,
};

const MGMT_USER = {
  id: 'user-m',
  username: 'mgr',
  displayName: 'Mgr',
  email: 'mgr@example.com',
  employeeNumber: null,
  roleId: 'role-m',
  role: { code: MANAGEMENT_ROLE_CODE, name: 'Management Intelligence Viewer' },
  isActive: true,
  mustChangePassword: true,
  fullPlatformAccess: false,
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: null,
  departmentId: null,
  plantId: null,
  locationId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function mgmtRole(permissionCodes: string[]) {
  return {
    id: 'role-m',
    code: MANAGEMENT_ROLE_CODE,
    isActive: true,
    permissions: permissionCodes.map((code) => ({ permission: { code } })),
  };
}

describe('Management Intelligence account isolation (UsersService)', () => {
  let service: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.$transaction.mockImplementation((fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient));
    mockUserFindFirst.mockResolvedValue(null);
    service = new UsersService(mockDb, mockAuth, mockDept);
  });

  it('creates an account on the management role when it holds only management_intelligence.read', async () => {
    mockRoleFindUnique.mockResolvedValue(mgmtRole(['management_intelligence.read']));
    mockUserCreate.mockResolvedValue(MGMT_USER);

    const result = await service.create({ email: 'mgr@example.com', displayName: 'Mgr', roleId: 'role-m' }, ACTOR);

    expect(result.user.role.code).toBe(MANAGEMENT_ROLE_CODE);
    const data = mockUserCreate.mock.calls[0]![0].data;
    expect(data.roleId).toBe('role-m');
    expect(data.mustChangePassword).toBe(true);
    expect(data).not.toHaveProperty('fullPlatformAccess');
  });

  it('refuses to create an account if the management role also holds an operational permission', async () => {
    mockRoleFindUnique.mockResolvedValue(mgmtRole(['management_intelligence.read', 'contracts.read']));
    await expect(
      service.create({ email: 'mgr@example.com', displayName: 'Mgr', roleId: 'role-m' }, ACTOR),
    ).rejects.toMatchObject({ response: { code: 'MANAGEMENT_ROLE_NOT_ISOLATED' } });
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it('refuses to create an account if the management role holds no permission at all', async () => {
    mockRoleFindUnique.mockResolvedValue(mgmtRole([]));
    await expect(
      service.create({ email: 'mgr@example.com', displayName: 'Mgr', roleId: 'role-m' }, ACTOR),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('blocks Full Platform Access for a management-only account', async () => {
    mockUserFindUnique.mockResolvedValue(MGMT_USER);
    await expect(service.setFullPlatformAccess(MGMT_USER.id, true, ACTOR)).rejects.toMatchObject({
      response: { code: 'MANAGEMENT_ONLY_ACCOUNT' },
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it('still allows turning Full Platform Access off for it', async () => {
    mockUserFindUnique.mockResolvedValue({ ...MGMT_USER, fullPlatformAccess: true });
    mockUserUpdate.mockResolvedValue(MGMT_USER);
    await expect(service.setFullPlatformAccess(MGMT_USER.id, false, ACTOR)).resolves.toBeDefined();
  });

  it('assertNotManagementOnlyAccount rejects a management account and accepts an operational one', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ role: { code: MANAGEMENT_ROLE_CODE } });
    await expect(service.assertNotManagementOnlyAccount('user-m')).rejects.toMatchObject({
      response: { code: 'MANAGEMENT_ONLY_ACCOUNT' },
    });
    mockUserFindUnique.mockResolvedValueOnce({ role: { code: 'CONTRACT_STAFF' } });
    await expect(service.assertNotManagementOnlyAccount('user-o')).resolves.toBeUndefined();
  });
});
