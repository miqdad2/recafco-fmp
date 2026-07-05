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
import { PlantsService } from './plants.service';
import { CreatePlantDto } from './dto/create-plant.dto';
import { UpdatePlantDto } from './dto/update-plant.dto';
import { OrgListQueryDto } from '../dto/org-list-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import type { Plant } from '@recafco/database';
import type { PaginatedResult } from '../dto/org-list-query.dto';
import type { DependencyCheck } from './plants.service';
import type { AuthUser } from '../../common/types/auth-user';

function meta(): { requestId?: string } {
  const requestId = getRequestId();
  return requestId !== undefined ? { requestId } : {};
}

@Controller('organizations/plants')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PlantsController {
  constructor(private readonly plantsService: PlantsService) {}

  @Get()
  @Permissions('org.plants.read')
  async list(@Query() query: OrgListQueryDto): Promise<ApiSuccessResponse<PaginatedResult<Plant>>> {
    const result = await this.plantsService.findAll(query);
    return { data: result, meta: meta(), error: null };
  }

  @Get(':id')
  @Permissions('org.plants.read')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<Plant>> {
    const plant = await this.plantsService.findOne(id);
    return { data: plant, meta: meta(), error: null };
  }

  @Get(':id/dependencies')
  @Permissions('org.plants.read')
  async checkDependencies(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<DependencyCheck>> {
    const result = await this.plantsService.checkDependencies(id);
    return { data: result, meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @Permissions('org.plants.write')
  async create(@Body() dto: CreatePlantDto): Promise<ApiSuccessResponse<Plant>> {
    const plant = await this.plantsService.create(dto);
    return { data: plant, meta: meta(), error: null };
  }

  @Patch(':id')
  @Permissions('org.plants.write')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePlantDto,
  ): Promise<ApiSuccessResponse<Plant>> {
    const plant = await this.plantsService.update(id, dto);
    return { data: plant, meta: meta(), error: null };
  }

  @Post(':id/activate')
  @Permissions('org.plants.write')
  async activate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<Plant>> {
    const plant = await this.plantsService.activate(id, actor.id);
    return { data: plant, meta: meta(), error: null };
  }

  @Post(':id/deactivate')
  @Permissions('org.plants.deactivate')
  async deactivate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<Plant>> {
    const plant = await this.plantsService.deactivate(id, actor.id);
    return { data: plant, meta: meta(), error: null };
  }

  @Post(':id/archive')
  @Permissions('org.plants.archive')
  async archive(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<Plant>> {
    const plant = await this.plantsService.archive(id, actor.id);
    return { data: plant, meta: meta(), error: null };
  }

  @Delete(':id')
  @HttpCode(204)
  @Permissions('org.plants.delete')
  async delete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<void> {
    await this.plantsService.delete(id, actor.id);
  }
}
