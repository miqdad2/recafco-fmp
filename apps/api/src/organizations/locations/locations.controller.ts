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
import { IsOptional, IsUUID } from 'class-validator';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { OrgListQueryDto } from '../dto/org-list-query.dto';
import { PendingAuthGuard } from '../../common/guards/pending-auth.guard';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import type { PaginatedResult } from '../dto/org-list-query.dto';

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
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  async list(@Query() query: LocationListQueryDto): Promise<ApiSuccessResponse<PaginatedResult<unknown>>> {
    const result = await this.locationsService.findAll(query);
    return { data: result, meta: meta(), error: null };
  }

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<unknown>> {
    const location = await this.locationsService.findOne(id);
    return { data: location, meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @UseGuards(PendingAuthGuard)
  async create(@Body() dto: CreateLocationDto): Promise<ApiSuccessResponse<unknown>> {
    const location = await this.locationsService.create(dto);
    return { data: location, meta: meta(), error: null };
  }

  @Patch(':id')
  @UseGuards(PendingAuthGuard)
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    const location = await this.locationsService.update(id, dto);
    return { data: location, meta: meta(), error: null };
  }

  @Post(':id/activate')
  @UseGuards(PendingAuthGuard)
  async activate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<unknown>> {
    const location = await this.locationsService.activate(id);
    return { data: location, meta: meta(), error: null };
  }

  @Post(':id/deactivate')
  @UseGuards(PendingAuthGuard)
  async deactivate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<unknown>> {
    const location = await this.locationsService.deactivate(id);
    return { data: location, meta: meta(), error: null };
  }
}
