import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import type { Plant } from '@recafco/database';
import { DatabaseService } from '../../database/database.service';
import type { CreatePlantDto } from './dto/create-plant.dto';
import type { UpdatePlantDto } from './dto/update-plant.dto';
import type { OrgListQueryDto, PaginatedResult } from '../dto/org-list-query.dto';
import { isPrismaError } from '../prisma-error';

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

  async activate(id: string): Promise<Plant> {
    await this.findOne(id);
    return this.db.getClient().plant.update({ where: { id }, data: { isActive: true } });
  }

  async deactivate(id: string): Promise<Plant> {
    await this.findOne(id);
    return this.db.getClient().plant.update({ where: { id }, data: { isActive: false } });
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
