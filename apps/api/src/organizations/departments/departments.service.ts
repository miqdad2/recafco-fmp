import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import type { Department } from '@recafco/database';
import { DatabaseService } from '../../database/database.service';
import type { CreateDepartmentDto } from './dto/create-department.dto';
import type { UpdateDepartmentDto } from './dto/update-department.dto';
import type { OrgListQueryDto, PaginatedResult } from '../dto/org-list-query.dto';
import { isPrismaError } from '../prisma-error';

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

  async activate(id: string): Promise<Department> {
    await this.findOne(id);
    return this.db.getClient().department.update({ where: { id }, data: { isActive: true } });
  }

  async deactivate(id: string): Promise<Department> {
    await this.findOne(id);
    return this.db.getClient().department.update({ where: { id }, data: { isActive: false } });
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
