import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateProductionLineDto } from './dto/create-production-line.dto';
import type { UpdateProductionLineDto } from './dto/update-production-line.dto';
import type { ProductionLineQueryDto } from './dto/production-line-query.dto';
import type { PaginatedResult } from './dto/production-order-list-query.dto';

function isPrismaP2002(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  );
}

const LINE_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  plantId: true,
  locationId: true,
  capacity: true,
  isActive: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  plant: { select: { id: true, name: true, code: true } },
  location: { select: { id: true, name: true, code: true } },
} as const;

@Injectable()
export class ProductionLinesService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateProductionLineDto, actor: AuthUser) {
    if (!actor.permissions.includes('production.lines.create')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.lines.create' });
    }

    try {
      return await this.db.getClient().productionLine.create({
        data: {
          code: dto.code,
          name: dto.name,
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.plantId !== undefined ? { plantId: dto.plantId } : {}),
          ...(dto.locationId !== undefined ? { locationId: dto.locationId } : {}),
          ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        },
        select: LINE_SELECT,
      });
    } catch (err) {
      if (isPrismaP2002(err)) {
        throw new ConflictException({ code: 'DUPLICATE_CODE', message: `A production line with code '${dto.code}' already exists` });
      }
      throw err;
    }
  }

  async findAll(query: ProductionLineQueryDto, actor: AuthUser): Promise<PaginatedResult<unknown>> {
    if (!actor.permissions.includes('production.lines.read') && !actor.permissions.includes('production.read')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.lines.read' });
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const where = buildLineWhere(query);

    const [items, total] = await Promise.all([
      this.db.getClient().productionLine.findMany({
        where,
        select: LINE_SELECT,
        orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.db.getClient().productionLine.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string, actor: AuthUser) {
    if (!actor.permissions.includes('production.lines.read') && !actor.permissions.includes('production.read')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.lines.read' });
    }

    const line = await this.db.getClient().productionLine.findUnique({ where: { id }, select: LINE_SELECT });
    if (!line) throw new NotFoundException({ code: 'PRODUCTION_LINE_NOT_FOUND', message: 'Production line not found' });
    return line;
  }

  async update(id: string, dto: UpdateProductionLineDto, actor: AuthUser) {
    if (!actor.permissions.includes('production.lines.update') && !actor.permissions.includes('production.lines.manage')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.lines.update' });
    }

    const data: Record<string, unknown> = { version: { increment: 1 } };
    if (dto.name !== undefined) data['name'] = dto.name;
    if (dto.description !== undefined) data['description'] = dto.description;
    if (dto.plantId !== undefined) data['plantId'] = dto.plantId;
    if (dto.locationId !== undefined) data['locationId'] = dto.locationId;
    if (dto.capacity !== undefined) data['capacity'] = dto.capacity;

    const result = await this.db.getClient().productionLine.updateMany({
      where: { id, version: dto.version },
      data,
    });

    if (result.count === 0) {
      const exists = await this.db.getClient().productionLine.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new NotFoundException({ code: 'PRODUCTION_LINE_NOT_FOUND', message: 'Production line not found' });
      throw new ConflictException({ code: 'PRODUCTION_LINE_VERSION_CONFLICT', message: 'Production line was changed by another user; please refresh and retry' });
    }

    return this.db.getClient().productionLine.findUniqueOrThrow({ where: { id }, select: LINE_SELECT });
  }

  async activate(id: string, actor: AuthUser) {
    if (!actor.permissions.includes('production.lines.update') && !actor.permissions.includes('production.lines.manage')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.lines.update' });
    }

    await this.findOneRaw(id);
    return this.db.getClient().productionLine.update({ where: { id }, data: { isActive: true }, select: LINE_SELECT });
  }

  async deactivate(id: string, actor: AuthUser) {
    if (!actor.permissions.includes('production.lines.manage')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.lines.manage' });
    }

    await this.findOneRaw(id);
    return this.db.getClient().productionLine.update({ where: { id }, data: { isActive: false }, select: LINE_SELECT });
  }

  async listActive(actor: AuthUser) {
    if (!actor.permissions.includes('production.lines.read') && !actor.permissions.includes('production.read')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.lines.read' });
    }

    return this.db.getClient().productionLine.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, plantId: true, capacity: true },
      orderBy: [{ code: 'asc' }],
    });
  }

  private async findOneRaw(id: string) {
    const line = await this.db.getClient().productionLine.findUnique({ where: { id }, select: { id: true } });
    if (!line) throw new NotFoundException({ code: 'PRODUCTION_LINE_NOT_FOUND', message: 'Production line not found' });
    return line;
  }
}

function buildLineWhere(query: ProductionLineQueryDto): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (query.isActive !== undefined) where['isActive'] = query.isActive;
  if (query.plantId) where['plantId'] = query.plantId;
  if (query.search?.length) {
    where['OR'] = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { code: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  return where;
}
