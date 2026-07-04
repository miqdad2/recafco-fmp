import {
  Injectable,
  CanActivate,
  type ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService, type JwtVerifyOptions } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { DatabaseService } from '../../database/database.service';
import { ALLOW_MUST_CHANGE_PASSWORD_KEY } from '../../common/decorators/allow-must-change-password.decorator';
import type { AuthUser } from '../../common/types/auth-user';

const UNAUTHORIZED = { code: 'UNAUTHORIZED', message: 'Authentication required' };
const MUST_CHANGE = {
  code: 'MUST_CHANGE_PASSWORD',
  message: 'You must change your password before continuing.',
};

function extractBearer(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  return token.length > 0 ? token : null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly db: DatabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();

    const token = extractBearer(req);
    if (!token) throw new UnauthorizedException(UNAUTHORIZED);

    let payload: { sub?: unknown; sessionId?: unknown };
    try {
      payload = this.jwtService.verify<{ sub: string; sessionId: string }>(
        token,
        {} as JwtVerifyOptions,
      );
    } catch {
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    const userId = typeof payload.sub === 'string' ? payload.sub : null;
    const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : null;
    if (!userId || !sessionId) throw new UnauthorizedException(UNAUTHORIZED);

    // Load live session + user + role + permissions in one query.
    // Authorization uses DB values only — role and permissions are never trusted from the JWT.
    const session = await this.db
      .getClient()
      .userSession.findFirst({
        where: {
          id: sessionId,
          expiresAt: { gt: new Date() },
          user: { isActive: true },
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              roleId: true,
              role: {
                select: {
                  code: true,
                  name: true,
                  permissions: {
                    select: {
                      permission: {
                        select: { code: true },
                      },
                    },
                  },
                },
              },
              isActive: true,
              mustChangePassword: true,
              departmentId: true,
            },
          },
        },
      });

    if (!session) throw new UnauthorizedException(UNAUTHORIZED);

    const { user: dbUser } = session;

    const user: AuthUser = {
      id: dbUser.id,
      username: dbUser.username,
      displayName: dbUser.displayName,
      roleId: dbUser.roleId,
      roleCode: dbUser.role.code,
      roleName: dbUser.role.name,
      permissions: dbUser.role.permissions.map((rp) => rp.permission.code),
      isActive: dbUser.isActive,
      mustChangePassword: dbUser.mustChangePassword,
      sessionId: session.id,
      departmentId: dbUser.departmentId,
    };

    req.user = user;

    const allow = this.reflector.getAllAndOverride<boolean>(ALLOW_MUST_CHANGE_PASSWORD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (user.mustChangePassword && !allow) {
      throw new ForbiddenException(MUST_CHANGE);
    }

    return true;
  }
}
