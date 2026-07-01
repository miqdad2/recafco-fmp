import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ALLOW_MUST_CHANGE_PASSWORD_KEY } from '../../common/decorators/allow-must-change-password.decorator';
import type { DatabaseService } from '../../database/database.service';

function makeContext(authHeader?: string, handler = vi.fn(), cls = vi.fn()): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: authHeader ? { authorization: authHeader } : {},
        user: undefined,
      }),
    }),
    getHandler: () => handler,
    getClass: () => cls,
  } as unknown as ExecutionContext;
}

// Mirrors the nested include shape that JwtAuthGuard's findFirst query returns.
const SESSION = {
  id: 'session-uuid-001',
  user: {
    id: 'user-uuid-001',
    username: 'alice',
    displayName: 'Alice',
    roleId: 'role-uuid-viewer',
    role: {
      code: 'VIEWER',
      name: 'Viewer',
      permissions: [
        { permission: { code: 'users.read' } },
        { permission: { code: 'roles.read' } },
      ],
    },
    isActive: true,
    mustChangePassword: false,
  },
};

const mockSessionFindFirst = vi.fn();
const mockDb = {
  getClient: vi.fn(() => ({
    userSession: { findFirst: mockSessionFindFirst },
  })),
} as unknown as DatabaseService;

const VALID_PAYLOAD = { sub: SESSION.user.id, sessionId: SESSION.id, mustChangePassword: false };
const mockJwtVerify = vi.fn();
const mockJwtService = { verify: mockJwtVerify } as unknown as JwtService;

const mockReflectorGet = vi.fn();
const mockReflector = {
  getAllAndOverride: mockReflectorGet,
} as unknown as Reflector;

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new JwtAuthGuard(mockJwtService, mockDb, mockReflector);
    mockJwtVerify.mockReturnValue(VALID_PAYLOAD);
    mockSessionFindFirst.mockResolvedValue(SESSION);
    mockReflectorGet.mockReturnValue(false);
  });

  it('returns true for a valid JWT and live session', async () => {
    const ctx = makeContext('Bearer valid.jwt.token');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('sets req.user with roleCode and permissions from the live DB session', async () => {
    const req = { headers: { authorization: 'Bearer valid.jwt.token' }, user: undefined };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: vi.fn(),
      getClass: vi.fn(),
    } as unknown as ExecutionContext;
    mockReflectorGet.mockReturnValue(false);

    await guard.canActivate(ctx);

    expect((req as { user?: unknown }).user).toMatchObject({
      id: SESSION.user.id,
      sessionId: SESSION.id,
      roleCode: 'VIEWER',
      permissions: ['users.read', 'roles.read'],
    });
  });

  it('throws 401 when no Authorization header', async () => {
    const ctx = makeContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws 401 when JWT verification fails', async () => {
    mockJwtVerify.mockImplementation(() => { throw new Error('invalid signature'); });
    const ctx = makeContext('Bearer bad.jwt.token');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws 401 when session is not found in DB (revoked or expired)', async () => {
    mockSessionFindFirst.mockResolvedValue(null);
    const ctx = makeContext('Bearer valid.jwt.token');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws 403 MUST_CHANGE_PASSWORD when mustChangePassword is true and endpoint is not decorated', async () => {
    mockSessionFindFirst.mockResolvedValue({
      ...SESSION,
      user: { ...SESSION.user, mustChangePassword: true },
    });
    mockReflectorGet.mockReturnValue(false);

    const ctx = makeContext('Bearer valid.jwt.token');
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('passes through when mustChangePassword is true but @AllowMustChangePassword is set', async () => {
    mockSessionFindFirst.mockResolvedValue({
      ...SESSION,
      user: { ...SESSION.user, mustChangePassword: true },
    });
    mockReflectorGet.mockImplementation((key: string) =>
      key === ALLOW_MUST_CHANGE_PASSWORD_KEY ? true : false,
    );

    const ctx = makeContext('Bearer valid.jwt.token');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('uses live DB value for mustChangePassword, not JWT claim', async () => {
    // JWT says mustChangePassword=false, but DB says true
    mockJwtVerify.mockReturnValue({ ...VALID_PAYLOAD, mustChangePassword: false });
    mockSessionFindFirst.mockResolvedValue({
      ...SESSION,
      user: { ...SESSION.user, mustChangePassword: true },
    });
    mockReflectorGet.mockReturnValue(false);

    const ctx = makeContext('Bearer valid.jwt.token');
    // Should throw because the live DB value is authoritative
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
