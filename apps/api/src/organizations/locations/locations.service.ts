import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
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

  async activate(id: string): Promise<LocationWithPlant> {
    await this.findOne(id);
    return this.db.getClient().location.update({
      where: { id },
      data: { isActive: true },
      include: { plant: { select: { id: true, code: true, name: true } } },
    });
  }

  async deactivate(id: string): Promise<LocationWithPlant> {
    await this.findOne(id);
    return this.db.getClient().location.update({
      where: { id },
      data: { isActive: false },
      include: { plant: { select: { id: true, code: true, name: true } } },
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
