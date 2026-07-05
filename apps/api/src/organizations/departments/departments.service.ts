import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Department } from '@recafco/database';
import { DatabaseService } from '../../database/database.service';
import type { CreateDepartmentDto } from './dto/create-department.dto';
import type { UpdateDepartmentDto } from './dto/update-department.dto';
import type { OrgListQueryDto, PaginatedResult } from '../dto/org-list-query.dto';
import { isPrismaError } from '../prisma-error';

export interface DependencyCheck {
  canDelete: boolean;
  dependencies: Record<string, number>;
}

@Injectable()
export class DepartmentsService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateDepartmentDto): Promise<Department> {
    try {
      return await this.db.getClient().department.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description ?? null,
        },
      });
    } catch (err) {
      if (isPrismaError(err, 'P2002')) {
        throw new ConflictException({
          code: 'DUPLICATE_CODE',
          message: `A department with code '${dto.code}' already exists`,
        });
      }
      throw err;
    }
  }

  async findAll(query: OrgListQueryDto): Promise<PaginatedResult<Department>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = buildWhere(query);

    const [items, total] = await Promise.all([
      this.db.getClient().department.findMany({
        where,
        orderBy: [{ code: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.db.getClient().department.count({ where }),
    ]);

    return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async findOne(id: string): Promise<Department> {
    const dept = await this.db.getClient().department.findUnique({ where: { id } });
    if (!dept) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Department not found' });
    }
    return dept;
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<Department> {
    await this.findOne(id);
    const data: Record<string, unknown> = {};
    if (dto.code !== undefined) data['code'] = dto.code;
    if (dto.name !== undefined) data['name'] = dto.name;
    if (dto.description !== undefined) data['description'] = dto.description;
    try {
      return await this.db.getClient().department.update({ where: { id }, data });
    } catch (err) {
      if (isPrismaError(err, 'P2002')) {
        throw new ConflictException({
          code: 'DUPLICATE_CODE',
          message: `A department with code '${dto.code ?? ''}' already exists`,
        });
      }
      throw err;
    }
  }

  async activate(id: string, actorId?: string): Promise<Department> {
    await this.findOne(id);
    return this.db.getClient().$transaction(async (tx) => {
      const dept = await tx.department.update({ where: { id }, data: { isActive: true } });
      await tx.securityAuditEvent.create({
        data: { event: 'department_activated', metadata: { departmentId: id }, actorId: actorId ?? null },
      });
      return dept;
    });
  }

  async deactivate(id: string, actorId?: string): Promise<Department> {
    await this.findOne(id);
    return this.db.getClient().$transaction(async (tx) => {
      const dept = await tx.department.update({ where: { id }, data: { isActive: false } });
      await tx.securityAuditEvent.create({
        data: { event: 'department_deactivated', metadata: { departmentId: id }, actorId: actorId ?? null },
      });
      return dept;
    });
  }

  async archive(id: string, actorId: string): Promise<Department> {
    await this.findOne(id);
    const now = new Date();
    return this.db.getClient().$transaction(async (tx) => {
      const dept = await tx.department.update({
        where: { id },
        data: { isActive: false, archivedAt: now, archivedByUserId: actorId },
      });
      await tx.securityAuditEvent.create({
        data: {
          event: 'department_archived',
          actorId,
          metadata: { departmentId: id, archivedAt: now.toISOString() },
        },
      });
      return dept;
    });
  }

  async checkDependencies(id: string): Promise<DependencyCheck> {
    await this.findOne(id);
    const db = this.db.getClient();

    const [
      users,
      moduleGrants,
      tasks,
      incidents,
      maintenanceRequests,
      safetyInspections,
      contracts,
      productionOrders,
    ] = await Promise.all([
      db.user.count({ where: { departmentId: id } }),
      db.userModuleDepartmentGrant.count({ where: { departmentId: id } }),
      db.factoryTask.count({ where: { OR: [{ requestingDepartmentId: id }, { responsibleDepartmentId: id }] } }),
      db.incident.count({ where: { affectedDepartmentId: id } }),
      db.maintenanceRequest.count({ where: { affectedDepartmentId: id } }),
      db.safetyInspection.count({ where: { departmentId: id } }),
      db.contract.count({ where: { departmentId: id } }),
      db.productionOrder.count({ where: { departmentId: id } }),
    ]);

    const dependencies: Record<string, number> = {};
    if (users > 0) dependencies['users'] = users;
    if (moduleGrants > 0) dependencies['moduleAccessGrants'] = moduleGrants;
    if (tasks > 0) dependencies['tasks'] = tasks;
    if (incidents > 0) dependencies['incidents'] = incidents;
    if (maintenanceRequests > 0) dependencies['maintenanceRequests'] = maintenanceRequests;
    if (safetyInspections > 0) dependencies['safetyInspections'] = safetyInspections;
    if (contracts > 0) dependencies['contracts'] = contracts;
    if (productionOrders > 0) dependencies['productionOrders'] = productionOrders;

    return { canDelete: Object.keys(dependencies).length === 0, dependencies };
  }

  async delete(id: string, actorId: string): Promise<void> {
    const dept = await this.findOne(id);
    const check = await this.checkDependencies(id);

    if (!check.canDelete) {
      await this.db.getClient().securityAuditEvent.create({
        data: {
          event: 'department_delete_blocked',
          actorId,
          metadata: { departmentId: id, code: dept.code, dependencies: check.dependencies },
        },
      });
      const summary = Object.entries(check.dependencies)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ');
      throw new UnprocessableEntityException({
        code: 'DEPARTMENT_HAS_DEPENDENCIES',
        message: `This department cannot be permanently deleted because it is referenced by ${summary}. Deactivate or archive it instead.`,
        dependencies: check.dependencies,
      });
    }

    await this.db.getClient().$transaction(async (tx) => {
      await tx.department.delete({ where: { id } });
      await tx.securityAuditEvent.create({
        data: {
          event: 'department_permanently_deleted',
          actorId,
          metadata: { departmentId: id, code: dept.code, name: dept.name },
        },
      });
    });
  }
}

function buildWhere(query: OrgListQueryDto): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (query.isActive !== undefined) where['isActive'] = query.isActive;
  if (query.search?.length) {
    where['OR'] = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { code: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  return where;
}
