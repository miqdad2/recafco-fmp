import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, HttpException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';

// Hoist mocks before module imports so vi.mock is applied at import time.
vi.mock('@node-rs/argon2', () => ({
  hash: vi.fn(),
  verify: vi.fn(),
  Algorithm: { Argon2id: 1 },
}));

vi.mock('../env', () => ({
  getApiEnv: vi.fn(() => ({
    jwtAccessSecret: 'test-secret-at-least-32-characters-long!',
    jwtAccessExpiresSeconds: 900,
    refreshTokenExpiresDays: 7,
  })),
}));

import { hash, verify } from '@node-rs/argon2';
import { AuthService } from './auth.service';
import type { DatabaseService } from '../database/database.service';

const mockHash = vi.mocked(hash);
const mockVerify = vi.mocked(verify);

// Shared mock functions for db client operations.
const mockUserFindUnique = vi.fn();
const mockUserUpdate = vi.fn();
const mockSessionCreate = vi.fn();
const mockSessionFindUnique = vi.fn();
const mockSessionDelete = vi.fn();
const mockSessionDeleteMany = vi.fn();
const mockUserDeleteMany = vi.fn();
const mockAuditCreate = vi.fn();

const mockClient = {
  user: {
    findUnique: mockUserFindUnique,
    update: mockUserUpdate,
    deleteMany: mockUserDeleteMany,
  },
  userSession: {
    create: mockSessionCreate,
    findUnique: mockSessionFindUnique,
    delete: mockSessionDelete,
    deleteMany: mockSessionDeleteMany,
  },
  securityAuditEvent: { create: mockAuditCreate },
  $transaction: vi.fn((fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient)),
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockJwtService = {
  signAsync: vi.fn().mockResolvedValue('mock.access.token'),
  verify: vi.fn(),
} as unknown as JwtService;

const ACTIVE_USER = {
  id: 'user-uuid-0001',
  username: 'alice',
  displayName: 'Alice',
  email: null,
  role: 'USER',
  isActive: true,
  mustChangePassword: false,
  passwordHash: '$argon2id$stored_hash',
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: null,
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();
    // $transaction: pass the same client as tx for simplicity
    mockClient.$transaction.mockImplementation((fn: (tx: typeof mockClient) => Promise<unknown>) =>
      fn(mockClient),
    );
    mockHash.mockResolvedValue('$argon2id$new_hash' as never);
    service = new AuthService(mockDb, mockJwtService);
    await service.onModuleInit();
  });

  // ---------------------------------------------------------------------------
  // login
  // ---------------------------------------------------------------------------

  describe('login', () => {
    it('returns accessToken and refreshToken on success', async () => {
      mockUserFindUnique.mockResolvedValue(ACTIVE_USER);
      mockVerify.mockResolvedValue(true as never);
      mockSessionCreate.mockResolvedValue({ id: 'session-id-001' });
      mockUserUpdate.mockResolvedValue(ACTIVE_USER);

      const result = await service.login({ username: 'alice', password: 'correct-pass' });

      expect(result.accessToken).toBe('mock.access.token');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(0);
      expect(result.mustChangePassword).toBe(false);
    });

    it('normalizes username to lowercase before lookup', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockVerify.mockResolvedValue(false as never);

      await expect(service.login({ username: 'ALICE', password: 'x' })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockUserFindUnique).toHaveBeenCalledWith({ where: { username: 'alice' } });
    });

    it('runs dummy verify for unknown users (constant-time defense)', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockVerify.mockResolvedValue(false as never);

      await expect(service.login({ username: 'nobody', password: 'x' })).rejects.toThrow(
        UnauthorizedException,
      );
      // verify must be called even when user not found
      expect(mockVerify).toHaveBeenCalled();
    });

    it('throws 401 INVALID_CREDENTIALS for inactive user', async () => {
      mockUserFindUnique.mockResolvedValue({ ...ACTIVE_USER, isActive: false });

      await expect(service.login({ username: 'alice', password: 'pass' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws 401 for locked account (lockedUntil in future)', async () => {
      const future = new Date(Date.now() + 10 * 60 * 1000);
      mockUserFindUnique.mockResolvedValue({ ...ACTIVE_USER, lockedUntil: future });

      await expect(service.login({ username: 'alice', password: 'pass' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('treats expired lockout as unlocked (auto-expire)', async () => {
      const past = new Date(Date.now() - 1000);
      mockUserFindUnique.mockResolvedValue({ ...ACTIVE_USER, lockedUntil: past });
      mockVerify.mockResolvedValue(true as never);
      mockSessionCreate.mockResolvedValue({ id: 'session-id-002' });
      mockUserUpdate.mockResolvedValue(ACTIVE_USER);

      const result = await service.login({ username: 'alice', password: 'correct' });
      expect(result.accessToken).toBeDefined();
    });

    it('increments failedLoginAttempts on bad password', async () => {
      mockUserFindUnique.mockResolvedValue({ ...ACTIVE_USER, failedLoginAttempts: 2 });
      mockVerify.mockResolvedValue(false as never);

      await expect(service.login({ username: 'alice', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );

      // user.update inside the transaction should have been called with incremented count
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 3 }),
        }),
      );
    });

    it('sets lockedUntil on 5th failed attempt', async () => {
      mockUserFindUnique.mockResolvedValue({ ...ACTIVE_USER, failedLoginAttempts: 4 });
      mockVerify.mockResolvedValue(false as never);

      await expect(service.login({ username: 'alice', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lockedUntil: expect.any(Date) }),
        }),
      );
    });

    it('resets failedLoginAttempts to 0 on successful login', async () => {
      mockUserFindUnique.mockResolvedValue({ ...ACTIVE_USER, failedLoginAttempts: 3 });
      mockVerify.mockResolvedValue(true as never);
      mockSessionCreate.mockResolvedValue({ id: 'session-id-003' });
      mockUserUpdate.mockResolvedValue(ACTIVE_USER);

      await service.login({ username: 'alice', password: 'correct' });

      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 0 }),
        }),
      );
    });

    it('does not include password or hash in audit metadata', async () => {
      mockUserFindUnique.mockResolvedValue(ACTIVE_USER);
      mockVerify.mockResolvedValue(true as never);
      mockSessionCreate.mockResolvedValue({ id: 'session-id-004' });
      mockUserUpdate.mockResolvedValue(ACTIVE_USER);

      await service.login({ username: 'alice', password: 'secret-pass' });

      for (const call of mockAuditCreate.mock.calls) {
        const metadata = (call[0] as { data?: { metadata?: Record<string, unknown> } }).data?.metadata;
        expect(JSON.stringify(metadata ?? {})).not.toContain('secret-pass');
        expect(JSON.stringify(metadata ?? {})).not.toContain('$argon2id');
      }
    });

    it('includes sessionId in JWT payload', async () => {
      mockUserFindUnique.mockResolvedValue(ACTIVE_USER);
      mockVerify.mockResolvedValue(true as never);
      mockSessionCreate.mockResolvedValue({ id: 'session-abc' });
      mockUserUpdate.mockResolvedValue(ACTIVE_USER);

      await service.login({ username: 'alice', password: 'correct' });

      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-abc', sub: ACTIVE_USER.id }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // refresh
  // ---------------------------------------------------------------------------

  describe('refresh', () => {
    const FUTURE = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const SESSION = {
      id: 'session-id-001',
      userId: ACTIVE_USER.id,
      tokenHash: 'hash_abc',
      expiresAt: FUTURE,
      user: { id: ACTIVE_USER.id, isActive: true, mustChangePassword: false },
    };

    it('rotates refresh token atomically and returns new tokens', async () => {
      mockSessionFindUnique.mockResolvedValue(SESSION);
      mockSessionDelete.mockResolvedValue(SESSION);
      mockSessionCreate.mockResolvedValue({ id: 'session-id-002' });

      const result = await service.refresh({ refreshToken: 'raw_refresh_token' });

      expect(result.accessToken).toBe('mock.access.token');
      expect(typeof result.refreshToken).toBe('string');
      // Old session deleted, new session created inside the same $transaction
      expect(mockSessionDelete).toHaveBeenCalledWith({ where: { id: SESSION.id } });
      expect(mockSessionCreate).toHaveBeenCalled();
    });

    it('throws 401 SESSION_EXPIRED when token not found', async () => {
      mockSessionFindUnique.mockResolvedValue(null);

      await expect(service.refresh({ refreshToken: 'bad_token' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws 401 SESSION_EXPIRED when session is past expiresAt', async () => {
      const past = new Date(Date.now() - 1000);
      mockSessionFindUnique.mockResolvedValue({ ...SESSION, expiresAt: past });

      await expect(service.refresh({ refreshToken: 'expired_token' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws 401 SESSION_INVALID when user is inactive', async () => {
      mockSessionFindUnique.mockResolvedValue({
        ...SESSION,
        user: { ...SESSION.user, isActive: false },
      });

      await expect(service.refresh({ refreshToken: 'token_inactive_user' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // logout
  // ---------------------------------------------------------------------------

  describe('logout', () => {
    it('deletes session when found', async () => {
      const SESSION = { id: 'session-id-001', userId: ACTIVE_USER.id };
      mockSessionFindUnique.mockResolvedValue(SESSION);
      mockSessionDelete.mockResolvedValue(SESSION);

      await service.logout({ refreshToken: 'valid_refresh_token' });

      expect(mockSessionDelete).toHaveBeenCalledWith({ where: { id: SESSION.id } });
    });

    it('is idempotent — returns without error when session not found', async () => {
      mockSessionFindUnique.mockResolvedValue(null);

      await expect(service.logout({ refreshToken: 'unknown_token' })).resolves.toBeUndefined();
      expect(mockSessionDelete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // changePassword
  // ---------------------------------------------------------------------------

  describe('changePassword', () => {
    const AUTH_USER = {
      id: ACTIVE_USER.id,
      username: 'alice',
      displayName: 'Alice',
      roleId: 'role-uuid-viewer',
      roleCode: 'VIEWER',
      roleName: 'Viewer',
      permissions: ['users.read'],
      isActive: true,
      mustChangePassword: false,
      sessionId: 'session-id-001',
    };

    it('revokes all sessions, updates hash, and sets mustChangePassword to false', async () => {
      mockUserFindUnique.mockResolvedValue(ACTIVE_USER);
      mockVerify
        .mockResolvedValueOnce(true as never) // current password valid
        .mockResolvedValueOnce(false as never); // new != current
      mockSessionDeleteMany.mockResolvedValue({ count: 2 });
      mockUserUpdate.mockResolvedValue(ACTIVE_USER);

      const result = await service.changePassword(AUTH_USER, {
        currentPassword: 'old-pass',
        newPassword: 'new-pass-strong',
      });

      // Must return void — no tokens (correction #10)
      expect(result).toBeUndefined();
      expect(mockSessionDeleteMany).toHaveBeenCalledWith({ where: { userId: ACTIVE_USER.id } });
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ mustChangePassword: false }),
        }),
      );
    });

    it('throws 401 when current password is wrong', async () => {
      mockUserFindUnique.mockResolvedValue(ACTIVE_USER);
      mockVerify.mockResolvedValue(false as never);

      await expect(
        service.changePassword(AUTH_USER, { currentPassword: 'wrong', newPassword: 'new-pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws 422 SAME_PASSWORD when new password equals current', async () => {
      mockUserFindUnique.mockResolvedValue(ACTIVE_USER);
      mockVerify
        .mockResolvedValueOnce(true as never) // current password valid
        .mockResolvedValueOnce(true as never); // new == current

      await expect(
        service.changePassword(AUTH_USER, {
          currentPassword: 'same-pass',
          newPassword: 'same-pass',
        }),
      ).rejects.toThrow(HttpException);
    });

    it('throws 401 when user not found in DB', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(
        service.changePassword(AUTH_USER, { currentPassword: 'x', newPassword: 'y' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
