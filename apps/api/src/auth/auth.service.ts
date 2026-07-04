import { Injectable, UnauthorizedException, HttpException, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify, Algorithm } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { getApiEnv } from '../env';
import type { LoginDto } from './dto/login.dto';
import type { RefreshDto } from './dto/refresh.dto';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { AuthUser } from '../common/types/auth-user';
import type { JwtPayload } from './types/jwt-payload';

const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const INVALID = {
  code: 'INVALID_CREDENTIALS',
  message: 'Invalid credentials',
} as const;

function sha256hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  roleId: string;
  roleCode: string;
  roleName: string;
  permissions: string[];
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  departmentId: string | null;
  plantId: string | null;
  locationId: string | null;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Pre-warm dummy hash to ensure constant-time response for unknown usernames.
    this.dummyHash = await hash('dummydummydummy_warmup_000', ARGON2_OPTIONS);
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const username = dto.username.toLowerCase().trim();

    const user = await this.db.getClient().user.findUnique({ where: { username } });

    if (!user) {
      // Constant-time defense: run verify against dummy hash.
      await verify(this.dummyHash, dto.password, ARGON2_OPTIONS);
      // Audit: do NOT record username_attempted if user not found (avoid revealing existence).
      throw new UnauthorizedException(INVALID);
    }

    if (!user.isActive) {
      await this.auditEvent('login_failed', user.id, null, { reason: 'account_inactive' });
      throw new UnauthorizedException(INVALID);
    }

    const now = new Date();

    // Check lockout. Auto-expire: if lockedUntil is in the past, treat as unlocked.
    if (user.lockedUntil && user.lockedUntil > now) {
      await this.auditEvent('login_failed', user.id, null, { reason: 'account_locked' });
      throw new UnauthorizedException(INVALID);
    }

    const valid = await verify(user.passwordHash, dto.password, ARGON2_OPTIONS);

    if (!valid) {
      const newCount = user.failedLoginAttempts + 1;
      const shouldLock = newCount >= LOCKOUT_THRESHOLD;
      const lockedUntil = shouldLock ? new Date(now.getTime() + LOCKOUT_DURATION_MS) : null;

      // Critical mutation + audit in one transaction (correction #12).
      await this.db.getClient().$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: newCount,
            ...(shouldLock ? { lockedUntil } : {}),
          },
        });
        await tx.securityAuditEvent.create({
          data: { event: 'login_failed', userId: user.id, metadata: { reason: 'bad_credentials' } },
        });
        if (shouldLock) {
          await tx.securityAuditEvent.create({
            data: { event: 'account_locked', userId: user.id, metadata: { failedAttempts: newCount } },
          });
        }
      });

      throw new UnauthorizedException(INVALID);
    }

    // Successful authentication.
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = sha256hex(rawRefreshToken);
    const env = getApiEnv();
    const expiresAt = new Date(now.getTime() + env.refreshTokenExpiresDays * 24 * 60 * 60 * 1000);

    const session = await this.db.getClient().$transaction(async (tx) => {
      const s = await tx.userSession.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now },
      });
      await tx.securityAuditEvent.create({
        data: { event: 'login_succeeded', userId: user.id, metadata: { username: user.username } },
      });
      return s;
    });

    const payload: JwtPayload = {
      sub: user.id,
      sessionId: session.id,
      mustChangePassword: user.mustChangePassword,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken, refreshToken: rawRefreshToken, mustChangePassword: user.mustChangePassword };
  }

  async refresh(dto: RefreshDto): Promise<LoginResult> {
    const tokenHash = sha256hex(dto.refreshToken);

    const session = await this.db.getClient().userSession.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, isActive: true, mustChangePassword: true } } },
    });

    if (!session) {
      throw new UnauthorizedException({ code: 'SESSION_EXPIRED', message: 'Session not found or expired' });
    }

    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException({ code: 'SESSION_EXPIRED', message: 'Session not found or expired' });
    }

    if (!session.user.isActive) {
      throw new UnauthorizedException({ code: 'SESSION_INVALID', message: 'Account is inactive' });
    }

    const rawRefreshToken = generateRefreshToken();
    const newTokenHash = sha256hex(rawRefreshToken);
    const env = getApiEnv();
    const expiresAt = new Date(Date.now() + env.refreshTokenExpiresDays * 24 * 60 * 60 * 1000);

    // Atomic rotation: delete old, create new in one transaction (correction #5).
    const newSession = await this.db.getClient().$transaction(async (tx) => {
      await tx.userSession.delete({ where: { id: session.id } });
      return tx.userSession.create({
        data: { userId: session.userId, tokenHash: newTokenHash, expiresAt },
      });
    });

    const payload: JwtPayload = {
      sub: session.userId,
      sessionId: newSession.id,
      mustChangePassword: session.user.mustChangePassword,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      mustChangePassword: session.user.mustChangePassword,
    };
  }

  async logout(dto: RefreshDto): Promise<void> {
    const tokenHash = sha256hex(dto.refreshToken);

    const session = await this.db.getClient().userSession.findUnique({ where: { tokenHash } });
    if (!session) return; // idempotent

    await this.db.getClient().$transaction(async (tx) => {
      await tx.userSession.delete({ where: { id: session.id } });
      await tx.securityAuditEvent.create({
        data: {
          event: 'logout',
          userId: session.userId,
          actorId: session.userId,
          metadata: { sessionId: session.id },
        },
      });
    });
  }

  async me(user: AuthUser): Promise<UserProfile> {
    const dbUser = await this.db.getClient().user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        roleId: true,
        role: { select: { code: true, name: true } },
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: true,
        departmentId: true,
        plantId: true,
        locationId: true,
      },
    });

    if (!dbUser) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Authentication required' });

    return {
      id: dbUser.id,
      username: dbUser.username,
      displayName: dbUser.displayName,
      email: dbUser.email,
      roleId: dbUser.roleId,
      roleCode: dbUser.role.code,
      roleName: dbUser.role.name,
      permissions: user.permissions,
      isActive: dbUser.isActive,
      mustChangePassword: dbUser.mustChangePassword,
      lastLoginAt: dbUser.lastLoginAt,
      departmentId: dbUser.departmentId,
      plantId: dbUser.plantId,
      locationId: dbUser.locationId,
    };
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto): Promise<void> {
    const dbUser = await this.db.getClient().user.findUnique({
      where: { id: user.id },
      select: { id: true, passwordHash: true },
    });
    if (!dbUser) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Authentication required' });

    const valid = await verify(dbUser.passwordHash, dto.currentPassword, ARGON2_OPTIONS);
    if (!valid) throw new UnauthorizedException(INVALID);

    // Reject if new password is identical to current.
    const samePassword = await verify(dbUser.passwordHash, dto.newPassword, ARGON2_OPTIONS);
    if (samePassword) {
      throw new HttpException({ code: 'SAME_PASSWORD', message: 'New password must differ from current password' }, 422);
    }

    const newHash = await hash(dto.newPassword, ARGON2_OPTIONS);

    // Revoke all sessions and record audit in one transaction.
    await this.db.getClient().$transaction(async (tx) => {
      await tx.userSession.deleteMany({ where: { userId: user.id } });
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
        },
      });
      await tx.securityAuditEvent.create({
        data: { event: 'password_changed', userId: user.id, actorId: user.id },
      });
    });
  }

  async hashPassword(plain: string): Promise<string> {
    return hash(plain, ARGON2_OPTIONS);
  }

  async auditEvent(
    event: string,
    userId: string | null,
    actorId: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.db.getClient().securityAuditEvent.create({
        data: {
          event,
          ...(userId ? { userId } : {}),
          ...(actorId ? { actorId } : {}),
          ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
        },
      });
    } catch {
      // Audit writes are best-effort; do not fail the primary operation.
    }
  }
}
