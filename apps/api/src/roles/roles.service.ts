import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';
import type { AuthUser } from '../common/types/auth-user';

const ROLE_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  isSystem: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface RoleSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleDetail extends RoleSummary {
  permissions: { id: string; code: string; name: string; module: string }[];
}

@Injectable()
export class RolesService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(): Promise<RoleSummary[]> {
    return this.db.getClient().role.findMany({
      select: ROLE_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string): Promise<RoleDetail> {
    const role = await this.db.getClient().role.findUnique({
      where: { id },
      select: {
        ...ROLE_SELECT,
        permissions: {
          select: {
            permission: {
              select: { id: true, code: true, name: true, module: true },
            },
          },
          orderBy: { permission: { code: 'asc' } },
        },
      },
    });
    if (!role) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found' });

    return {
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
    };
  }

  async create(dto: CreateRoleDto, actor: AuthUser): Promise<RoleSummary> {
    const code = dto.code.toUpperCase().trim();
    const name = dto.name.trim();

    if (name.length === 0) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'name must not be blank' });
    }

    try {
      return await this.db.getClient().$transaction(async (tx) => {
        const role = await tx.role.create({
          data: { code, name, description: dto.description ?? null, isSystem: false, isActive: true },
          select: ROLE_SELECT,
        });
        await tx.securityAuditEvent.create({
          data: { event: 'role_created', actorId: actor.id, metadata: { roleId: role.id, code } },
        });
        return role;
      });
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException({ code: 'DUPLICATE_ROLE_CODE', message: `Role code '${code}' already exists` });
      }
      throw err as Error;
    }
  }

  async update(id: string, dto: UpdateRoleDto, actor: AuthUser): Promise<RoleSummary> {
    const role = await this.db.getClient().role.findUnique({ where: { id }, select: { id: true, isSystem: true } });
    if (!role) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found' });

    if (dto.name !== undefined && dto.name.trim().length === 0) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'name must not be blank' });
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data['name'] = dto.name.trim();
    if (dto.description !== undefined) data['description'] = dto.description ?? null;

    return this.db.getClient().$transaction(async (tx) => {
      const updated = await tx.role.update({ where: { id }, data, select: ROLE_SELECT });
      await tx.securityAuditEvent.create({
        data: { event: 'role_updated', actorId: actor.id, metadata: { roleId: id } },
      });
      return updated;
    });
  }

  async getPermissions(id: string): Promise<{ id: string; code: string; name: string; module: string }[]> {
    const role = await this.db.getClient().role.findUnique({
      where: { id },
      select: {
        permissions: {
          select: { permission: { select: { id: true, code: true, name: true, module: true } } },
          orderBy: { permission: { code: 'asc' } },
        },
      },
    });
    if (!role) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found' });
    return role.permissions.map((rp) => rp.permission);
  }

  async assignPermissions(id: string, permissionIds: string[], actor: AuthUser): Promise<void> {
    const role = await this.db.getClient().role.findUnique({ where: { id }, select: { id: true } });
    if (!role) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found' });

    // Verify all permission IDs exist.
    if (permissionIds.length > 0) {
      const found = await this.db.getClient().permission.count({
        where: { id: { in: permissionIds } },
      });
      if (found !== permissionIds.length) {
        throw new BadRequestException({ code: 'INVALID_PERMISSIONS', message: 'One or more permission IDs do not exist' });
      }
    }

    await this.db.getClient().$transaction(async (tx) => {
      // Replace the full permission set atomically.
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        });
      }
      await tx.securityAuditEvent.create({
        data: {
          event: 'role_permissions_updated',
          actorId: actor.id,
          metadata: { roleId: id, permissionIds },
        },
      });
    });
  }

  async listAllPermissions(): Promise<{ id: string; code: string; name: string; module: string; description: string | null }[]> {
    return this.db.getClient().permission.findMany({
      select: { id: true, code: true, name: true, module: true, description: true },
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
  }

  // System roles cannot be deactivated. Custom roles may be toggled.
  async deactivate(id: string, actor: AuthUser): Promise<RoleSummary> {
    const role = await this.db.getClient().role.findUnique({ where: { id }, select: { id: true, isSystem: true } });
    if (!role) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found' });

    if (role.isSystem) {
      throw new UnprocessableEntityException({
        code: 'SYSTEM_ROLE_PROTECTED',
        message: 'System roles cannot be deactivated',
      });
    }

    // Prevent deactivating a role that is still assigned to active users.
    const count = await this.db.getClient().user.count({ where: { roleId: id, isActive: true } });
    if (count > 0) {
      throw new UnprocessableEntityException({
        code: 'ROLE_IN_USE',
        message: `Cannot deactivate: ${count} active user(s) are assigned this role`,
      });
    }

    return this.db.getClient().$transaction(async (tx) => {
      const updated = await tx.role.update({ where: { id }, data: { isActive: false }, select: ROLE_SELECT });
      await tx.securityAuditEvent.create({
        data: { event: 'role_deactivated', actorId: actor.id, metadata: { roleId: id } },
      });
      return updated;
    });
  }
}
