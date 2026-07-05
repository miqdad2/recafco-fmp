import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import type { Department } from '@recafco/database';
import type { PaginatedResult } from '../dto/org-list-query.dto';
import type { DependencyCheck } from './departments.service';
import type { AuthUser } from '../../common/types/auth-user';

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

  @Get(':id/dependencies')
  @Permissions('org.departments.read')
  async checkDependencies(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<DependencyCheck>> {
    const result = await this.departmentsService.checkDependencies(id);
    return { data: result, meta: meta(), error: null };
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
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<Department>> {
    const dept = await this.departmentsService.activate(id, actor.id);
    return { data: dept, meta: meta(), error: null };
  }

  @Post(':id/deactivate')
  @Permissions('org.departments.deactivate')
  async deactivate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<Department>> {
    const dept = await this.departmentsService.deactivate(id, actor.id);
    return { data: dept, meta: meta(), error: null };
  }

  @Post(':id/archive')
  @Permissions('org.departments.archive')
  async archive(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<Department>> {
    const dept = await this.departmentsService.archive(id, actor.id);
    return { data: dept, meta: meta(), error: null };
  }

  @Delete(':id')
  @HttpCode(204)
  @Permissions('org.departments.delete')
  async delete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<void> {
    await this.departmentsService.delete(id, actor.id);
  }
}
