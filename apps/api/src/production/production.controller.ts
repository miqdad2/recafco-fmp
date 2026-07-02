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
import { ProductionOrdersService } from './production-orders.service';
import { ProductionLinesService } from './production-lines.service';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';
import { ProductionOrderListQueryDto } from './dto/production-order-list-query.dto';
import { ScheduleOrderDto } from './dto/schedule-order.dto';
import { StartOrderDto } from './dto/start-order.dto';
import { PauseOrderDto } from './dto/pause-order.dto';
import { ResumeOrderDto } from './dto/resume-order.dto';
import { CompleteOrderDto } from './dto/complete-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { AddEntryDto } from './dto/add-entry.dto';
import { AddProductionCommentDto } from './dto/add-production-comment.dto';
import { CreateProductionLineDto } from './dto/create-production-line.dto';
import { UpdateProductionLineDto } from './dto/update-production-line.dto';
import { ProductionLineQueryDto } from './dto/production-line-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import type { AuthUser } from '../common/types/auth-user';

function meta(): { requestId?: string } {
  const id = getRequestId();
  return id !== undefined ? { requestId: id } : {};
}

@Controller('production')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProductionController {
  constructor(
    private readonly ordersService: ProductionOrdersService,
    private readonly linesService: ProductionLinesService,
  ) {}

  // =========================================================================
  // Static routes — MUST be declared before /:id to avoid route conflicts
  // =========================================================================

  // ---- Summary ----

  @Get('summary')
  @Permissions('production.read')
  async summary(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.ordersService.getSummary(actor);
    return { data, meta: meta(), error: null };
  }

  // ---- Org selectors ----

  @Get('departments')
  @Permissions('production.read')
  async departments(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.ordersService.listDepartments(actor);
    return { data, meta: meta(), error: null };
  }

  @Get('plants')
  @Permissions('production.read')
  async plants(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.ordersService.listPlants(actor);
    return { data, meta: meta(), error: null };
  }

  @Get('people')
  @Permissions('production.read')
  async people(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.ordersService.listPeople(actor);
    return { data, meta: meta(), error: null };
  }

  @Get('locations')
  @Permissions('production.read')
  async locations(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.ordersService.listLocations(actor);
    return { data, meta: meta(), error: null };
  }

  // ---- Production lines ----

  @Get('lines')
  @Permissions('production.lines.read')
  async listLines(
    @Query() query: ProductionLineQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.linesService.findAll(query, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('lines')
  @HttpCode(201)
  @Permissions('production.lines.create')
  async createLine(
    @Body() dto: CreateProductionLineDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.linesService.create(dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Get('lines/active')
  @Permissions('production.read')
  async activeLines(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.linesService.listActive(actor);
    return { data, meta: meta(), error: null };
  }

  @Get('lines/:lineId')
  @Permissions('production.lines.read')
  async getLine(
    @Param('lineId', new ParseUUIDPipe({ version: '4' })) lineId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.linesService.findOne(lineId, actor);
    return { data, meta: meta(), error: null };
  }

  @Patch('lines/:lineId')
  @Permissions('production.lines.update')
  async updateLine(
    @Param('lineId', new ParseUUIDPipe({ version: '4' })) lineId: string,
    @Body() dto: UpdateProductionLineDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.linesService.update(lineId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('lines/:lineId/activate')
  @HttpCode(200)
  @Permissions('production.lines.update')
  async activateLine(
    @Param('lineId', new ParseUUIDPipe({ version: '4' })) lineId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.linesService.activate(lineId, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('lines/:lineId/deactivate')
  @HttpCode(200)
  @Permissions('production.lines.manage')
  async deactivateLine(
    @Param('lineId', new ParseUUIDPipe({ version: '4' })) lineId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.linesService.deactivate(lineId, actor);
    return { data, meta: meta(), error: null };
  }

  // =========================================================================
  // Production orders
  // =========================================================================

  @Get()
  @Permissions('production.read')
  async list(
    @Query() query: ProductionOrderListQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.ordersService.findAll(query, actor);
    return { data, meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @Permissions('production.create')
  async create(
    @Body() dto: CreateProductionOrderDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.ordersService.create(dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Get(':id')
  @Permissions('production.read')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.ordersService.findOne(id, actor);
    return { data, meta: meta(), error: null };
  }

  @Patch(':id')
  @Permissions('production.update')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateProductionOrderDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.ordersService.update(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/schedule')
  @HttpCode(200)
  @Permissions('production.schedule')
  async schedule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ScheduleOrderDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.ordersService.schedule(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/start')
  @HttpCode(200)
  @Permissions('production.start')
  async start(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: StartOrderDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.ordersService.start(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/pause')
  @HttpCode(200)
  @Permissions('production.pause')
  async pause(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: PauseOrderDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.ordersService.pause(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/resume')
  @HttpCode(200)
  @Permissions('production.resume')
  async resume(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ResumeOrderDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.ordersService.resume(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/complete')
  @HttpCode(200)
  @Permissions('production.complete')
  async complete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CompleteOrderDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.ordersService.complete(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Permissions('production.cancel')
  async cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.ordersService.cancel(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Get(':id/entries')
  @Permissions('production.read')
  async listEntries(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.ordersService.listEntries(id, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/entries/output')
  @HttpCode(201)
  @Permissions('production.entries.create')
  async addOutputEntry(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddEntryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.ordersService.addEntry(id, 'OUTPUT', dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/entries/downtime')
  @HttpCode(201)
  @Permissions('production.entries.create')
  async addDowntimeEntry(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddEntryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.ordersService.addEntry(id, 'DOWNTIME', dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/entries/adjustment')
  @HttpCode(201)
  @Permissions('production.manage')
  async addAdjustmentEntry(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddEntryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.ordersService.addEntry(id, 'ADJUSTMENT', dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Get(':id/metrics')
  @Permissions('production.read')
  async metrics(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.ordersService.getMetrics(id, actor);
    return { data, meta: meta(), error: null };
  }

  @Get(':id/comments')
  @Permissions('production.read')
  async listComments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.ordersService.listComments(id, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/comments')
  @HttpCode(201)
  @Permissions('production.comment')
  async addComment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddProductionCommentDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.ordersService.addComment(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Get(':id/activities')
  @Permissions('production.read')
  async listActivities(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.ordersService.listActivities(id, actor);
    return { data, meta: meta(), error: null };
  }
}
