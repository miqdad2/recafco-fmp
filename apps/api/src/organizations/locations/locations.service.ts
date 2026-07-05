import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Location } from '@recafco/database';
import { DatabaseService } from '../../database/database.service';
import type { CreateLocationDto } from './dto/create-location.dto';
import type { UpdateLocationDto } from './dto/update-location.dto';
import type { OrgListQueryDto, PaginatedResult } from '../dto/org-list-query.dto';
import { isPrismaError } from '../prisma-error';

type LocationWithPlant = Location & {
  plant: { id: string; code: string; name: string } | null;
};

export interface DependencyCheck {
  canDelete: boolean;
  dependencies: Record<string, number>;
}

@Injectable()
export class LocationsService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateLocationDto): Promise<LocationWithPlant> {
    if (dto.plantId) {
      await this.requirePlantExists(dto.plantId);
    }
    try {
      return await this.db.getClient().location.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description ?? null,
          plantId: dto.plantId ?? null,
        },
        include: { plant: { select: { id: true, code: true, name: true } } },
      });
    } catch (err) {
      if (isPrismaError(err, 'P2002')) {
        throw new ConflictException({
          code: 'DUPLICATE_CODE',
          message: `A location with code '${dto.code}' already exists`,
        });
      }
      if (isPrismaError(err, 'P2003')) {
        throw new BadRequestException({
          code: 'INVALID_PLANT_ID',
          message: `Plant with id '${dto.plantId ?? ''}' does not exist`,
        });
      }
      throw err;
    }
  }

  async findAll(query: OrgListQueryDto & { plantId?: string }): Promise<PaginatedResult<LocationWithPlant>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = buildWhere(query);

    const [items, total] = await Promise.all([
      this.db.getClient().location.findMany({
        where,
        orderBy: [{ code: 'asc' }],
        skip,
        take: pageSize,
        include: { plant: { select: { id: true, code: true, name: true } } },
      }),
      this.db.getClient().location.count({ where }),
    ]);

    return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async findOne(id: string): Promise<LocationWithPlant> {
    const location = await this.db.getClient().location.findUnique({
      where: { id },
      include: { plant: { select: { id: true, code: true, name: true } } },
    });
    if (!location) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Location not found' });
    }
    return location;
  }

  async update(id: string, dto: UpdateLocationDto): Promise<LocationWithPlant> {
    await this.findOne(id);

    if (dto.plantId !== undefined && dto.plantId !== null) {
      await this.requirePlantExists(dto.plantId);
    }

    const data: Record<string, unknown> = {};
    if (dto.code !== undefined) data['code'] = dto.code;
    if (dto.name !== undefined) data['name'] = dto.name;
    if (dto.description !== undefined) data['description'] = dto.description;
    if (dto.plantId !== undefined) data['plantId'] = dto.plantId;

    try {
      return await this.db.getClient().location.update({
        where: { id },
        data,
        include: { plant: { select: { id: true, code: true, name: true } } },
      });
    } catch (err) {
      if (isPrismaError(err, 'P2002')) {
        throw new ConflictException({
          code: 'DUPLICATE_CODE',
          message: `A location with code '${dto.code ?? ''}' already exists`,
        });
      }
      if (isPrismaError(err, 'P2003')) {
        throw new BadRequestException({
          code: 'INVALID_PLANT_ID',
          message: `Plant with id '${String(dto.plantId ?? '')}' does not exist`,
        });
      }
      throw err;
    }
  }

  async activate(id: string, actorId?: string): Promise<LocationWithPlant> {
    await this.findOne(id);
    return this.db.getClient().$transaction(async (tx) => {
      const loc = await tx.location.update({
        where: { id },
        data: { isActive: true },
        include: { plant: { select: { id: true, code: true, name: true } } },
      });
      await tx.securityAuditEvent.create({
        data: { event: 'location_activated', metadata: { locationId: id }, actorId: actorId ?? null },
      });
      return loc;
    });
  }

  async deactivate(id: string, actorId?: string): Promise<LocationWithPlant> {
    await this.findOne(id);
    return this.db.getClient().$transaction(async (tx) => {
      const loc = await tx.location.update({
        where: { id },
        data: { isActive: false },
        include: { plant: { select: { id: true, code: true, name: true } } },
      });
      await tx.securityAuditEvent.create({
        data: { event: 'location_deactivated', metadata: { locationId: id }, actorId: actorId ?? null },
      });
      return loc;
    });
  }

  async archive(id: string, actorId: string): Promise<LocationWithPlant> {
    await this.findOne(id);
    const now = new Date();
    return this.db.getClient().$transaction(async (tx) => {
      const loc = await tx.location.update({
        where: { id },
        data: { isActive: false, archivedAt: now, archivedByUserId: actorId },
        include: { plant: { select: { id: true, code: true, name: true } } },
      });
      await tx.securityAuditEvent.create({
        data: {
          event: 'location_archived',
          actorId,
          metadata: { locationId: id, archivedAt: now.toISOString() },
        },
      });
      return loc;
    });
  }

  async checkDependencies(id: string): Promise<DependencyCheck> {
    await this.findOne(id);
    const db = this.db.getClient();

    const [
      users,
      incidents,
      tasks,
      maintenanceRequests,
      safetyInspections,
      contracts,
      productionLines,
    ] = await Promise.all([
      db.user.count({ where: { locationId: id } }),
      db.incident.count({ where: { affectedLocationId: id } }),
      db.factoryTask.count({ where: { locationId: id } }),
      db.maintenanceRequest.count({ where: { locationId: id } }),
      db.safetyInspection.count({ where: { locationId: id } }),
      db.contract.count({ where: { locationId: id } }),
      db.productionLine.count({ where: { locationId: id } }),
    ]);

    const dependencies: Record<string, number> = {};
    if (users > 0) dependencies['users'] = users;
    if (incidents > 0) dependencies['incidents'] = incidents;
    if (tasks > 0) dependencies['tasks'] = tasks;
    if (maintenanceRequests > 0) dependencies['maintenanceRequests'] = maintenanceRequests;
    if (safetyInspections > 0) dependencies['safetyInspections'] = safetyInspections;
    if (contracts > 0) dependencies['contracts'] = contracts;
    if (productionLines > 0) dependencies['productionLines'] = productionLines;

    return { canDelete: Object.keys(dependencies).length === 0, dependencies };
  }

  async delete(id: string, actorId: string): Promise<void> {
    const loc = await this.findOne(id);
    const check = await this.checkDependencies(id);

    if (!check.canDelete) {
      await this.db.getClient().securityAuditEvent.create({
        data: {
          event: 'location_delete_blocked',
          actorId,
          metadata: { locationId: id, code: loc.code, dependencies: check.dependencies },
        },
      });
      const summary = Object.entries(check.dependencies)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ');
      throw new UnprocessableEntityException({
        code: 'LOCATION_HAS_DEPENDENCIES',
        message: `This location cannot be permanently deleted because it is referenced by ${summary}. Deactivate or archive it instead.`,
        dependencies: check.dependencies,
      });
    }

    await this.db.getClient().$transaction(async (tx) => {
      await tx.location.delete({ where: { id } });
      await tx.securityAuditEvent.create({
        data: {
          event: 'location_permanently_deleted',
          actorId,
          metadata: { locationId: id, code: loc.code, name: loc.name },
        },
      });
    });
  }

  private async requirePlantExists(plantId: string): Promise<void> {
    const plant = await this.db.getClient().plant.findUnique({ where: { id: plantId } });
    if (!plant) {
      throw new BadRequestException({
        code: 'INVALID_PLANT_ID',
        message: `Plant with id '${plantId}' does not exist`,
      });
    }
  }
}

function buildWhere(query: OrgListQueryDto & { plantId?: string }): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (query.isActive !== undefined) where['isActive'] = query.isActive;
  if (query.plantId !== undefined) where['plantId'] = query.plantId;
  if (query.search?.length) {
    where['OR'] = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { code: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  return where;
}
