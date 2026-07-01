import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { OrgListQueryDto } from '../dto/org-list-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import type { Department } from '@recafco/database';
import type { PaginatedResult } from '../dto/org-list-query.dto';

function meta(): { requestId?: string } {
  const requestId = getRequestId();
  return requestId !== undefined ? { requestId } : {};
}

@Controller('organizations/departments')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @Permissions('org.departments.read')
  async list(
    @Query() query: OrgListQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<Department>>> {
    const result = await this.departmentsService.findAll(query);
    return { data: result, meta: meta(), error: null };
  }

  @Get(':id')
  @Permissions('org.departments.read')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<Department>> {
    const dept = await this.departmentsService.findOne(id);
    return { data: dept, meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @Permissions('org.departments.write')
  async create(@Body() dto: CreateDepartmentDto): Promise<ApiSuccessResponse<Department>> {
    const dept = await this.departmentsService.create(dto);
    return { data: dept, meta: meta(), error: null };
  }

  @Patch(':id')
  @Permissions('org.departments.write')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<ApiSuccessResponse<Department>> {
    const dept = await this.departmentsService.update(id, dto);
    return { data: dept, meta: meta(), error: null };
  }

  @Post(':id/activate')
  @Permissions('org.departments.write')
  async activate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<Department>> {
    const dept = await this.departmentsService.activate(id);
    return { data: dept, meta: meta(), error: null };
  }

  @Post(':id/deactivate')
  @Permissions('org.departments.write')
  async deactivate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<Department>> {
    const dept = await this.departmentsService.deactivate(id);
    return { data: dept, meta: meta(), error: null };
  }
}
