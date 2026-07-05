import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Plant } from '@recafco/database';
import { DatabaseService } from '../../database/database.service';
import type { CreatePlantDto } from './dto/create-plant.dto';
import type { UpdatePlantDto } from './dto/update-plant.dto';
import type { OrgListQueryDto, PaginatedResult } from '../dto/org-list-query.dto';
import { isPrismaError } from '../prisma-error';

export interface DependencyCheck {
  canDelete: boolean;
  dependencies: Record<string, number>;
}

@Injectable()
export class PlantsService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreatePlantDto): Promise<Plant> {
    try {
      return await this.db.getClient().plant.create({
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
          message: `A plant with code '${dto.code}' already exists`,
        });
      }
      throw err;
    }
  }

  async findAll(query: OrgListQueryDto): Promise<PaginatedResult<Plant>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = buildWhere(query);

    const [items, total] = await Promise.all([
      this.db.getClient().plant.findMany({
        where,
        orderBy: [{ code: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.db.getClient().plant.count({ where }),
    ]);

    return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async findOne(id: string): Promise<Plant> {
    const plant = await this.db.getClient().plant.findUnique({ where: { id } });
    if (!plant) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Plant not found' });
    }
    return plant;
  }

  async update(id: string, dto: UpdatePlantDto): Promise<Plant> {
    await this.findOne(id);
    const data: Record<string, unknown> = {};
    if (dto.code !== undefined) data['code'] = dto.code;
    if (dto.name !== undefined) data['name'] = dto.name;
    if (dto.description !== undefined) data['description'] = dto.description;
    try {
      return await this.db.getClient().plant.update({ where: { id }, data });
    } catch (err) {
      if (isPrismaError(err, 'P2002')) {
        throw new ConflictException({
          code: 'DUPLICATE_CODE',
          message: `A plant with code '${dto.code ?? ''}' already exists`,
        });
      }
      throw err;
    }
  }

  async activate(id: string, actorId?: string): Promise<Plant> {
    await this.findOne(id);
    return this.db.getClient().$transaction(async (tx) => {
      const plant = await tx.plant.update({ where: { id }, data: { isActive: true } });
      await tx.securityAuditEvent.create({
        data: { event: 'plant_activated', metadata: { plantId: id }, actorId: actorId ?? null },
      });
      return plant;
    });
  }

  async deactivate(id: string, actorId?: string): Promise<Plant> {
    await this.findOne(id);
    return this.db.getClient().$transaction(async (tx) => {
      const plant = await tx.plant.update({ where: { id }, data: { isActive: false } });
      await tx.securityAuditEvent.create({
        data: { event: 'plant_deactivated', metadata: { plantId: id }, actorId: actorId ?? null },
      });
      return plant;
    });
  }

  async archive(id: string, actorId: string): Promise<Plant> {
    await this.findOne(id);
    const now = new Date();
    return this.db.getClient().$transaction(async (tx) => {
      const plant = await tx.plant.update({
        where: { id },
        data: { isActive: false, archivedAt: now, archivedByUserId: actorId },
      });
      await tx.securityAuditEvent.create({
        data: {
          event: 'plant_archived',
          actorId,
          metadata: { plantId: id, archivedAt: now.toISOString() },
        },
      });
      return plant;
    });
  }

  async checkDependencies(id: string): Promise<DependencyCheck> {
    await this.findOne(id);
    const db = this.db.getClient();

    const [
      locations,
      users,
      incidents,
      tasks,
      maintenanceRequests,
      safetyInspections,
      contracts,
      productionLines,
      productionOrders,
    ] = await Promise.all([
      db.location.count({ where: { plantId: id } }),
      db.user.count({ where: { plantId: id } }),
      db.incident.count({ where: { affectedPlantId: id } }),
      db.factoryTask.count({ where: { plantId: id } }),
      db.maintenanceRequest.count({ where: { plantId: id } }),
      db.safetyInspection.count({ where: { plantId: id } }),
      db.contract.count({ where: { plantId: id } }),
      db.productionLine.count({ where: { plantId: id } }),
      db.productionOrder.count({ where: { plantId: id } }),
    ]);

    const dependencies: Record<string, number> = {};
    if (locations > 0) dependencies['locations'] = locations;
    if (users > 0) dependencies['users'] = users;
    if (incidents > 0) dependencies['incidents'] = incidents;
    if (tasks > 0) dependencies['tasks'] = tasks;
    if (maintenanceRequests > 0) dependencies['maintenanceRequests'] = maintenanceRequests;
    if (safetyInspections > 0) dependencies['safetyInspections'] = safetyInspections;
    if (contracts > 0) dependencies['contracts'] = contracts;
    if (productionLines > 0) dependencies['productionLines'] = productionLines;
    if (productionOrders > 0) dependencies['productionOrders'] = productionOrders;

    return { canDelete: Object.keys(dependencies).length === 0, dependencies };
  }

  async delete(id: string, actorId: string): Promise<void> {
    const plant = await this.findOne(id);
    const check = await this.checkDependencies(id);

    if (!check.canDelete) {
      await this.db.getClient().securityAuditEvent.create({
        data: {
          event: 'plant_delete_blocked',
          actorId,
          metadata: { plantId: id, code: plant.code, dependencies: check.dependencies },
        },
      });
      const summary = Object.entries(check.dependencies)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ');
      throw new UnprocessableEntityException({
        code: 'PLANT_HAS_DEPENDENCIES',
        message: `This plant cannot be permanently deleted because it is referenced by ${summary}. Deactivate or archive it instead.`,
        dependencies: check.dependencies,
      });
    }

    await this.db.getClient().$transaction(async (tx) => {
      await tx.plant.delete({ where: { id } });
      await tx.securityAuditEvent.create({
        data: {
          event: 'plant_permanently_deleted',
          actorId,
          metadata: { plantId: id, code: plant.code, name: plant.name },
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
