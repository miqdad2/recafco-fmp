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
import { PlantsService } from './plants.service';
import { CreatePlantDto } from './dto/create-plant.dto';
import { UpdatePlantDto } from './dto/update-plant.dto';
import { OrgListQueryDto } from '../dto/org-list-query.dto';
import { PendingAuthGuard } from '../../common/guards/pending-auth.guard';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import type { Plant } from '@recafco/database';
import type { PaginatedResult } from '../dto/org-list-query.dto';

function meta(): { requestId?: string } {
  const requestId = getRequestId();
  return requestId !== undefined ? { requestId } : {};
}

@Controller('organizations/plants')
export class PlantsController {
  constructor(private readonly plantsService: PlantsService) {}

  @Get()
  async list(@Query() query: OrgListQueryDto): Promise<ApiSuccessResponse<PaginatedResult<Plant>>> {
    const result = await this.plantsService.findAll(query);
    return { data: result, meta: meta(), error: null };
  }

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<Plant>> {
    const plant = await this.plantsService.findOne(id);
    return { data: plant, meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @UseGuards(PendingAuthGuard)
  async create(@Body() dto: CreatePlantDto): Promise<ApiSuccessResponse<Plant>> {
    const plant = await this.plantsService.create(dto);
    return { data: plant, meta: meta(), error: null };
  }

  @Patch(':id')
  @UseGuards(PendingAuthGuard)
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePlantDto,
  ): Promise<ApiSuccessResponse<Plant>> {
    const plant = await this.plantsService.update(id, dto);
    return { data: plant, meta: meta(), error: null };
  }

  @Post(':id/activate')
  @UseGuards(PendingAuthGuard)
  async activate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<Plant>> {
    const plant = await this.plantsService.activate(id);
    return { data: plant, meta: meta(), error: null };
  }

  @Post(':id/deactivate')
  @UseGuards(PendingAuthGuard)
  async deactivate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<Plant>> {
    const plant = await this.plantsService.deactivate(id);
    return { data: plant, meta: meta(), error: null };
  }
}
