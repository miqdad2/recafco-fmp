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
import { IsOptional, IsUUID } from 'class-validator';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { OrgListQueryDto } from '../dto/org-list-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import type { PaginatedResult } from '../dto/org-list-query.dto';
import type { DependencyCheck } from './locations.service';
import type { AuthUser } from '../../common/types/auth-user';

class LocationListQueryDto extends OrgListQueryDto {
  @IsOptional()
  @IsUUID(4)
  plantId?: string;
}

function meta(): { requestId?: string } {
  const requestId = getRequestId();
  return requestId !== undefined ? { requestId } : {};
}

@Controller('organizations/locations')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @Permissions('org.locations.read')
  async list(@Query() query: LocationListQueryDto): Promise<ApiSuccessResponse<PaginatedResult<unknown>>> {
    const result = await this.locationsService.findAll(query);
    return { data: result, meta: meta(), error: null };
  }

  @Get(':id')
  @Permissions('org.locations.read')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<unknown>> {
    const location = await this.locationsService.findOne(id);
    return { data: location, meta: meta(), error: null };
  }

  @Get(':id/dependencies')
  @Permissions('org.locations.read')
  async checkDependencies(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<DependencyCheck>> {
    const result = await this.locationsService.checkDependencies(id);
    return { data: result, meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @Permissions('org.locations.write')
  async create(@Body() dto: CreateLocationDto): Promise<ApiSuccessResponse<unknown>> {
    const location = await this.locationsService.create(dto);
    return { data: location, meta: meta(), error: null };
  }

  @Patch(':id')
  @Permissions('org.locations.write')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    const location = await this.locationsService.update(id, dto);
    return { data: location, meta: meta(), error: null };
  }

  @Post(':id/activate')
  @Permissions('org.locations.write')
  async activate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const location = await this.locationsService.activate(id, actor.id);
    return { data: location, meta: meta(), error: null };
  }

  @Post(':id/deactivate')
  @Permissions('org.locations.deactivate')
  async deactivate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const location = await this.locationsService.deactivate(id, actor.id);
    return { data: location, meta: meta(), error: null };
  }

  @Post(':id/archive')
  @Permissions('org.locations.archive')
  async archive(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const location = await this.locationsService.archive(id, actor.id);
    return { data: location, meta: meta(), error: null };
  }

  @Delete(':id')
  @HttpCode(204)
  @Permissions('org.locations.delete')
  async delete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<void> {
    await this.locationsService.delete(id, actor.id);
  }
}
