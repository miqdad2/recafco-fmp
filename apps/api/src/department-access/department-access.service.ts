import { Injectable } from '@nestjs/common';
import { DepartmentAccessScope, ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';

// Sentinel: null = no department filter (ALL_DEPARTMENTS scope)
type DeptWhereFragment = { in: string[] } | null;

@Injectable()
export class DepartmentAccessService {
  constructor(private readonly db: DatabaseService) {}

  // ---------------------------------------------------------------------------
  // Resolve scope from DB only — no permission fast-path.
  // Operational ALL_DEPARTMENTS visibility MUST come from an explicit
  // UserModuleAccess row; the access_scope.manage_all_departments permission
  // only controls who may ASSIGN that scope to others.
  // ---------------------------------------------------------------------------

  async getScope(actor: AuthUser, module: ModuleIdentifier): Promise<DepartmentAccessScope> {
    const record = await this.db.getClient().userModuleAccess.findUnique({
      where: { userId_module: { userId: actor.id, module } },
      select: { scope: true },
    });
    return record?.scope ?? DepartmentAccessScope.OWN_DEPARTMENT;
  }

  // ---------------------------------------------------------------------------
  // Build a Prisma IN filter for the department field.
  // Returns null  → caller must add NO department filter (ALL_DEPARTMENTS).
  // Returns {in:[]}→ empty set → caller gets zero results (fail-closed).
  // ---------------------------------------------------------------------------

  async buildDeptFilter(actor: AuthUser, module: ModuleIdentifier): Promise<DeptWhereFragment> {
    const scope = await this.getScope(actor, module);

    if (scope === DepartmentAccessScope.ALL_DEPARTMENTS) {
      return null;
    }

    if (scope === DepartmentAccessScope.SELECTED_DEPARTMENTS) {
      const record = await this.db.getClient().userModuleAccess.findUnique({
        where: { userId_module: { userId: actor.id, module } },
        select: { grants: { select: { departmentId: true } } },
      });
      const ids = record?.grants.map((g) => g.departmentId) ?? [];
      return { in: ids };
    }

    // OWN_DEPARTMENT — scope to actor's primary department; fail-closed if none
    return actor.departmentId ? { in: [actor.departmentId] } : { in: [] };
  }

  // ---------------------------------------------------------------------------
  // Check whether actor can see a specific departmentId value.
  // deptId = null means the record has no department → always visible.
  // ---------------------------------------------------------------------------

  async canAccessDepartment(
    actor: AuthUser,
    module: ModuleIdentifier,
    deptId: string | null,
  ): Promise<boolean> {
    if (deptId === null) return true;

    const filter = await this.buildDeptFilter(actor, module);
    if (filter === null) return true; // ALL_DEPARTMENTS scope

    return filter.in.includes(deptId);
  }

  // ---------------------------------------------------------------------------
  // Assert access; throw 403 on failure
  // ---------------------------------------------------------------------------

  async assertCanAccessDepartment(
    actor: AuthUser,
    module: ModuleIdentifier,
    deptId: string | null,
  ): Promise<void> {
    const ok = await this.canAccessDepartment(actor, module, deptId);
    if (!ok) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException({
        code: 'DEPARTMENT_ACCESS_DENIED',
        message: 'Access to this department is not permitted for your scope',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Whether actor may GRANT a given scope to another user.
  // access_scope.manage_all_departments is required to assign ALL_DEPARTMENTS.
  // access_scope.manage (or manage_all_departments) is required for the others.
  // ---------------------------------------------------------------------------

  canGrantScope(actor: AuthUser, scope: DepartmentAccessScope): boolean {
    if (scope === DepartmentAccessScope.ALL_DEPARTMENTS) {
      return actor.permissions.includes('access_scope.manage_all_departments');
    }
    return (
      actor.permissions.includes('access_scope.manage') ||
      actor.permissions.includes('access_scope.manage_all_departments')
    );
  }

  // ---------------------------------------------------------------------------
  // Retrieve module access configuration for a user (for admin UI)
  // ---------------------------------------------------------------------------

  async getUserModuleAccessConfig(userId: string): Promise<UserModuleAccessConfig[]> {
    const records = await this.db.getClient().userModuleAccess.findMany({
      where: { userId },
      select: {
        module: true,
        scope: true,
        grants: {
          select: {
            departmentId: true,
            department: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    return ALL_MODULES.map((mod) => {
      const record = records.find((r) => r.module === mod);
      return {
        module: mod,
        scope: record?.scope ?? DepartmentAccessScope.OWN_DEPARTMENT,
        grantedDepartments: record?.grants.map((g) => g.department) ?? [],
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Set module access configuration for a user.
  // - Validates that actor may grant the requested scope.
  // - Validates that selected department IDs are active.
  // - Atomically replaces the grant rows.
  // - Records an audit event (HIGH severity for ALL_DEPARTMENTS changes).
  // ---------------------------------------------------------------------------

  async setUserModuleAccess(
    userId: string,
    module: ModuleIdentifier,
    scope: DepartmentAccessScope,
    departmentIds: string[],
    actor: AuthUser,
  ): Promise<void> {
    if (!this.canGrantScope(actor, scope)) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException({
        code: 'INSUFFICIENT_GRANT_PERMISSION',
        message: `You cannot grant ${scope} scope`,
      });
    }

    if (scope === DepartmentAccessScope.SELECTED_DEPARTMENTS && departmentIds.length === 0) {
      const { BadRequestException } = await import('@nestjs/common');
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'SELECTED_DEPARTMENTS scope requires at least one department',
      });
    }

    // Validate that all requested departments are active
    if (departmentIds.length > 0) {
      const activeDepts = await this.db.getClient().department.findMany({
        where: { id: { in: departmentIds }, isActive: true },
        select: { id: true },
      });
      const activeIds = new Set(activeDepts.map((d) => d.id));
      const invalid = departmentIds.filter((id) => !activeIds.has(id));
      if (invalid.length > 0) {
        const { BadRequestException } = await import('@nestjs/common');
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `Department IDs not found or inactive: ${invalid.join(', ')}`,
        });
      }
    }

    await this.db.getClient().$transaction(async (tx) => {
      // Read previous state for audit
      const prev = await tx.userModuleAccess.findUnique({
        where: { userId_module: { userId, module } },
        select: {
          scope: true,
          grants: { select: { departmentId: true } },
        },
      });

      const previousScope = prev?.scope ?? DepartmentAccessScope.OWN_DEPARTMENT;
      const previousDeptIds = prev?.grants.map((g) => g.departmentId) ?? [];

      const access = await tx.userModuleAccess.upsert({
        where: { userId_module: { userId, module } },
        create: { userId, module, scope, grantedBy: actor.id },
        update: { scope, grantedBy: actor.id },
        select: { id: true },
      });

      // Replace grant rows atomically
      await tx.userModuleDepartmentGrant.deleteMany({ where: { userModuleAccessId: access.id } });

      if (scope === DepartmentAccessScope.SELECTED_DEPARTMENTS && departmentIds.length > 0) {
        await tx.userModuleDepartmentGrant.createMany({
          data: departmentIds.map((departmentId) => ({
            userModuleAccessId: access.id,
            departmentId,
          })),
          skipDuplicates: true,
        });
      }

      // Audit event — always record scope changes; HIGH severity for ALL_DEPARTMENTS
      const isAllDeptChange =
        scope === DepartmentAccessScope.ALL_DEPARTMENTS ||
        previousScope === DepartmentAccessScope.ALL_DEPARTMENTS;

      await tx.securityAuditEvent.create({
        data: {
          event: isAllDeptChange ? 'scope_all_departments_changed' : 'scope_changed',
          userId,
          actorId: actor.id,
          metadata: {
            module,
            previousScope,
            newScope: scope,
            addedDepartmentIds:
              scope === DepartmentAccessScope.SELECTED_DEPARTMENTS ? departmentIds : [],
            removedDepartmentIds: previousDeptIds,
          },
        },
      });
    });
  }
}

export interface UserModuleAccessConfig {
  module: ModuleIdentifier;
  scope: DepartmentAccessScope;
  grantedDepartments: { id: string; code: string; name: string }[];
}

const ALL_MODULES: ModuleIdentifier[] = [
  ModuleIdentifier.FACTORY_TASKS,
  ModuleIdentifier.INCIDENT_REPORT,
  ModuleIdentifier.MAINTENANCE_REQUESTS,
  ModuleIdentifier.SAFETY_COMPLIANCE,
  ModuleIdentifier.CONTRACTS_MANAGEMENT,
  ModuleIdentifier.PRODUCTION_DASHBOARD,
  ModuleIdentifier.ADMINISTRATION,
];
