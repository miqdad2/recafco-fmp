import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ModuleIdentifier, DepartmentAccessScope } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { AuthService } from '../auth/auth.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { AuthUser } from '../common/types/auth-user';

const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  employeeNumber: true,
  roleId: true,
  role: {
    select: {
      code: true,
      name: true,
    },
  },
  isActive: true,
  mustChangePassword: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  lastLoginAt: true,
  departmentId: true,
  plantId: true,
  locationId: true,
  createdAt: true,
  updatedAt: true,
} as const;

type UserRecord = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  employeeNumber: string | null;
  roleId: string;
  role: { code: string; name: string };
  isActive: boolean;
  mustChangePassword: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  departmentId: string | null;
  plantId: string | null;
  locationId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface UserSummary extends UserRecord {
  isLocked: boolean;
}

export interface UserCreatedResult {
  user: UserSummary;
  tempPassword: string;
}

export interface UserListResult {
  items: UserSummary[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

function toSummary(u: UserRecord): UserSummary {
  return { ...u, isLocked: u.lockedUntil !== null && u.lockedUntil > new Date() };
}

function handleUniqueError(err: unknown, dto: { username?: string; email?: string; employeeNumber?: string }): never {
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  ) {
    const meta = (err as { meta?: { target?: string[] } }).meta;
    const fields = meta?.target ?? [];
    if (fields.some((f) => f.includes('username'))) {
      throw new ConflictException({
        code: 'DUPLICATE_USERNAME',
        message: `Username '${dto.username ?? ''}' is already taken`,
      });
    }
    if (fields.some((f) => f.includes('email'))) {
      throw new ConflictException({
        code: 'DUPLICATE_EMAIL',
        message: `Email address is already registered`,
      });
    }
    if (fields.some((f) => f.includes('employee_number'))) {
      throw new ConflictException({
        code: 'DUPLICATE_EMPLOYEE_NUMBER',
        message: `Employee number is already registered`,
      });
    }
  }
  throw err as Error;
}

const SUPER_ADMIN_CODE = 'SUPER_ADMIN';
const VIEWER_CODE = 'VIEWER';

@Injectable()
export class UsersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly authService: AuthService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  async create(dto: CreateUserDto, actor: AuthUser): Promise<UserCreatedResult> {
    const username = dto.username.toLowerCase().trim();
    const displayName = dto.displayName.trim();
    const email = dto.email ? dto.email.toLowerCase().trim() : null;
    const employeeNumber = dto.employeeNumber ? dto.employeeNumber.toUpperCase().trim() : null;

    if (displayName.length === 0) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'displayName must not be blank' });
    }

    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.ADMINISTRATION, dto.departmentId ?? null);

    await this.validateOrgConsistency(dto.plantId, dto.locationId);

    // Resolve the role to assign — default to VIEWER.
    const roleId = await this.resolveNewUserRole(dto.roleId, actor);

    const tempPassword = randomBytes(16).toString('base64url');
    const passwordHash = await this.authService.hashPassword(tempPassword);

    let created: UserRecord;
    try {
      created = await this.db.getClient().$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username,
            displayName,
            email,
            employeeNumber: employeeNumber ?? null,
            passwordHash,
            roleId,
            isActive: true,
            mustChangePassword: true,
            departmentId: dto.departmentId ?? null,
            plantId: dto.plantId ?? null,
            locationId: dto.locationId ?? null,
          },
          select: USER_SELECT,
        });
        await tx.securityAuditEvent.create({
          data: {
            event: 'user_created',
            userId: user.id,
            actorId: actor.id,
            metadata: { username: user.username, roleId },
          },
        });
        return user;
      });
    } catch (err) {
      handleUniqueError(err, {
        username,
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.employeeNumber !== undefined ? { employeeNumber: dto.employeeNumber } : {}),
      });
    }

    return { user: toSummary(created!), tempPassword };
  }

  async findAll(
    query: { page?: number; pageSize?: number; search?: string; isActive?: boolean; roleCode?: string },
    actor?: AuthUser,
  ): Promise<UserListResult> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (query.isActive !== undefined) where['isActive'] = query.isActive;
    if (query.roleCode !== undefined) where['role'] = { code: query.roleCode };
    if (query.search?.trim()) {
      where['OR'] = [
        { username: { contains: query.search.trim(), mode: 'insensitive' } },
        { displayName: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    if (actor) {
      const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.ADMINISTRATION);
      if (deptFilter !== null) {
        where['departmentId'] = deptFilter;
      }
    }

    const [raw, total] = await Promise.all([
      this.db.getClient().user.findMany({ where, select: USER_SELECT, orderBy: { username: 'asc' }, skip, take: pageSize }),
      this.db.getClient().user.count({ where }),
    ]);

    return {
      items: raw.map(toSummary),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string, actor?: AuthUser): Promise<UserSummary> {
    const user = await this.findOneOrThrow(id, actor);
    return toSummary(user);
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser): Promise<UserSummary> {
    const existing = await this.findOneOrThrow(id, actor);

    if (dto.displayName !== undefined && dto.displayName.trim().length === 0) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'displayName must not be blank' });
    }

    // If moving to a different department, assert actor can access the new department too
    if (dto.departmentId !== undefined && dto.departmentId !== existing.departmentId) {
      await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.ADMINISTRATION, dto.departmentId ?? null);
    }

    await this.validateOrgConsistency(dto.plantId, dto.locationId);

    const data: Record<string, unknown> = {};
    if (dto.displayName !== undefined) data['displayName'] = dto.displayName.trim();
    if (dto.email !== undefined) data['email'] = dto.email ? dto.email.toLowerCase().trim() : null;
    if (dto.employeeNumber !== undefined)
      data['employeeNumber'] = dto.employeeNumber ? dto.employeeNumber.toUpperCase().trim() : null;
    if (dto.departmentId !== undefined) data['departmentId'] = dto.departmentId ?? null;
    if (dto.plantId !== undefined) data['plantId'] = dto.plantId ?? null;
    if (dto.locationId !== undefined) data['locationId'] = dto.locationId ?? null;

    try {
      const updated = await this.db.getClient().$transaction(async (tx) => {
        const u = await tx.user.update({ where: { id }, data, select: USER_SELECT });
        await tx.securityAuditEvent.create({
          data: { event: 'user_updated', userId: id, actorId: actor.id },
        });
        return u;
      });
      return toSummary(updated);
    } catch (err) {
      handleUniqueError(err, {
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.employeeNumber !== undefined ? { employeeNumber: dto.employeeNumber } : {}),
      });
    }
  }

  async activate(id: string, actor: AuthUser): Promise<UserSummary> {
    await this.findOne(id);
    const updated = await this.db.getClient().$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id }, data: { isActive: true }, select: USER_SELECT });
      await tx.securityAuditEvent.create({
        data: { event: 'user_activated', userId: id, actorId: actor.id },
      });
      return u;
    });
    return toSummary(updated);
  }

  async deactivate(id: string, actor: AuthUser): Promise<UserSummary> {
    if (id === actor.id) {
      throw new UnprocessableEntityException({
        code: 'CANNOT_DEACTIVATE_SELF',
        message: 'You cannot deactivate your own account',
      });
    }

    const target = await this.findOne(id);

    if (target.role.code === SUPER_ADMIN_CODE) {
      await this.assertNotLastActiveSuperAdmin(id, 'deactivate');
    }

    const updated = await this.db.getClient().$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id }, data: { isActive: false }, select: USER_SELECT });
      await tx.userSession.deleteMany({ where: { userId: id } });
      await tx.securityAuditEvent.create({
        data: { event: 'user_deactivated', userId: id, actorId: actor.id },
      });
      return u;
    });
    return toSummary(updated);
  }

  async resetPassword(id: string, actor: AuthUser): Promise<{ tempPassword: string }> {
    await this.findOne(id);

    const tempPassword = randomBytes(16).toString('base64url');
    const passwordHash = await this.authService.hashPassword(tempPassword);

    await this.db.getClient().$transaction(async (tx) => {
      await tx.userSession.deleteMany({ where: { userId: id } });
      await tx.user.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true },
      });
      await tx.securityAuditEvent.create({
        data: { event: 'admin_reset_password', userId: id, actorId: actor.id },
      });
    });

    return { tempPassword };
  }

  async unlock(id: string, actor: AuthUser): Promise<UserSummary> {
    await this.findOne(id);
    const updated = await this.db.getClient().$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
        select: USER_SELECT,
      });
      await tx.securityAuditEvent.create({
        data: { event: 'account_unlocked', userId: id, actorId: actor.id },
      });
      return u;
    });
    return toSummary(updated);
  }

  async updateRole(id: string, roleId: string, actor: AuthUser): Promise<UserSummary> {
    // Self-role changes are never allowed.
    if (id === actor.id) {
      throw new UnprocessableEntityException({
        code: 'CANNOT_CHANGE_OWN_ROLE',
        message: 'You cannot change your own role',
      });
    }

    // Verify the target role exists.
    const targetRole = await this.db.getClient().role.findUnique({
      where: { id: roleId },
      select: { id: true, code: true, isActive: true },
    });
    if (!targetRole) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found' });
    }
    if (!targetRole.isActive) {
      throw new BadRequestException({ code: 'ROLE_INACTIVE', message: 'Cannot assign an inactive role' });
    }

    // Privilege escalation guard (A-9): only users with roles.assign_permissions may assign SUPER_ADMIN.
    if (targetRole.code === SUPER_ADMIN_CODE && !actor.permissions.includes('roles.assign_permissions')) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only a Super Administrator may assign the SUPER_ADMIN role',
      });
    }

    const target = await this.findOne(id);

    // Prevent demoting the last active SUPER_ADMIN.
    if (target.role.code === SUPER_ADMIN_CODE && targetRole.code !== SUPER_ADMIN_CODE) {
      await this.assertNotLastActiveSuperAdmin(id, 'demote');
    }

    const updated = await this.db.getClient().$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: { roleId },
        select: USER_SELECT,
      });
      await tx.securityAuditEvent.create({
        data: {
          event: 'user_role_changed',
          userId: id,
          actorId: actor.id,
          metadata: { newRoleId: roleId, newRoleCode: targetRole.code },
        },
      });
      return u;
    });
    return toSummary(updated);
  }

  async getDashboard(actor: AuthUser): Promise<{
    scope: { type: DepartmentAccessScope; departmentNames: string[] };
    metrics: {
      totalActiveUsers: number;
      totalInactiveUsers: number;
      totalLockedUsers: number;
      mustChangePassword: number;
    };
    recent: { id: string; referenceNumber: string; title: string; status: string; updatedAt: string }[];
  }> {
    const [scopeType, deptFilter] = await Promise.all([
      this.deptAccess.getScope(actor, ModuleIdentifier.ADMINISTRATION),
      this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.ADMINISTRATION),
    ]);

    let departmentNames: string[] = [];
    if (deptFilter !== null && deptFilter.in.length > 0) {
      const depts = await this.db.getClient().department.findMany({
        where: { id: { in: deptFilter.in } },
        select: { name: true },
        orderBy: { name: 'asc' },
      });
      departmentNames = depts.map((d) => d.name);
    }

    const now = new Date();
    const deptWhere = deptFilter !== null ? { departmentId: deptFilter } : {};

    const [totalActiveUsers, totalInactiveUsers, totalLockedUsers, mustChangePassword, recentRaw] =
      await Promise.all([
        this.db.getClient().user.count({ where: { ...deptWhere, isActive: true } }),
        this.db.getClient().user.count({ where: { ...deptWhere, isActive: false } }),
        this.db.getClient().user.count({ where: { ...deptWhere, lockedUntil: { gt: now } } }),
        this.db.getClient().user.count({ where: { ...deptWhere, mustChangePassword: true, isActive: true } }),
        this.db.getClient().user.findMany({
          where: { ...deptWhere },
          take: 8,
          orderBy: { updatedAt: 'desc' },
          select: { id: true, username: true, displayName: true, isActive: true, updatedAt: true },
        }),
      ]);

    return {
      scope: { type: scopeType, departmentNames },
      metrics: { totalActiveUsers, totalInactiveUsers, totalLockedUsers, mustChangePassword },
      recent: recentRaw.map((u) => ({
        id: u.id,
        referenceNumber: u.username,
        title: u.displayName,
        status: u.isActive ? 'active' : 'inactive',
        updatedAt: u.updatedAt.toISOString(),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async findOneOrThrow(id: string, actor?: AuthUser): Promise<UserRecord> {
    const user = await this.db.getClient().user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    if (actor) {
      await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.ADMINISTRATION, user.departmentId);
    }
    return user;
  }

  private async resolveNewUserRole(requestedRoleId: string | undefined, actor: AuthUser): Promise<string> {
    if (!requestedRoleId) {
      const viewerRole = await this.db.getClient().role.findUnique({
        where: { code: VIEWER_CODE },
        select: { id: true },
      });
      if (!viewerRole) {
        throw new BadRequestException({ code: 'CONFIGURATION_ERROR', message: 'Default VIEWER role not found' });
      }
      return viewerRole.id;
    }

    const role = await this.db.getClient().role.findUnique({
      where: { id: requestedRoleId },
      select: { id: true, code: true, isActive: true },
    });
    if (!role) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found' });
    }
    if (!role.isActive) {
      throw new BadRequestException({ code: 'ROLE_INACTIVE', message: 'Cannot assign an inactive role' });
    }
    if (role.code === SUPER_ADMIN_CODE && !actor.permissions.includes('roles.assign_permissions')) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only a Super Administrator may assign the SUPER_ADMIN role',
      });
    }

    return role.id;
  }

  private async assertNotLastActiveSuperAdmin(excludeId: string, action: string): Promise<void> {
    const count = await this.db.getClient().user.count({
      where: {
        role: { code: SUPER_ADMIN_CODE },
        isActive: true,
        id: { not: excludeId },
      },
    });
    if (count === 0) {
      throw new UnprocessableEntityException({
        code: 'LAST_ACTIVE_SUPER_ADMIN',
        message: `Cannot ${action} the only active Super Administrator account`,
      });
    }
  }

  private async validateOrgConsistency(
    plantId: string | undefined,
    locationId: string | undefined,
  ): Promise<void> {
    if (!plantId || !locationId) return;

    const location = await this.db.getClient().location.findUnique({
      where: { id: locationId },
      select: { plantId: true },
    });

    if (!location) {
      throw new BadRequestException({ code: 'INVALID_LOCATION', message: 'Location not found' });
    }

    if (location.plantId !== null && location.plantId !== plantId) {
      throw new BadRequestException({
        code: 'ORG_ASSIGNMENT_MISMATCH',
        message: 'The specified location does not belong to the specified plant',
      });
    }
  }
}
