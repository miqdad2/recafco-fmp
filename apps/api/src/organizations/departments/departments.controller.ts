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
import { PendingAuthGuard } from '../../common/guards/pending-auth.guard';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import type { Department } from '@recafco/database';
import type { PaginatedResult } from '../dto/org-list-query.dto';

function meta(): { requestId?: string } {
  const requestId = getRequestId();
  return requestId !== undefined ? { requestId } : {};
}

@Controller('organizations/departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  async list(
    @Query() query: OrgListQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<Department>>> {
    const result = await this.departmentsService.findAll(query);
    return { data: result, meta: meta(), error: null };
  }

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<Department>> {
    const dept = await this.departmentsService.findOne(id);
    return { data: dept, meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @UseGuards(PendingAuthGuard)
  async create(@Body() dto: CreateDepartmentDto): Promise<ApiSuccessResponse<Department>> {
    const dept = await this.departmentsService.create(dto);
    return { data: dept, meta: meta(), error: null };
  }

  @Patch(':id')
  @UseGuards(PendingAuthGuard)
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<ApiSuccessResponse<Department>> {
    const dept = await this.departmentsService.update(id, dto);
    return { data: dept, meta: meta(), error: null };
  }

  @Post(':id/activate')
  @UseGuards(PendingAuthGuard)
  async activate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<Department>> {
    const dept = await this.departmentsService.activate(id);
    return { data: dept, meta: meta(), error: null };
  }

  @Post(':id/deactivate')
  @UseGuards(PendingAuthGuard)
  async deactivate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<Department>> {
    const dept = await this.departmentsService.deactivate(id);
    return { data: dept, meta: meta(), error: null };
  }
}
