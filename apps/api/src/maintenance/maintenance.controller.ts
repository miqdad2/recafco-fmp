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
import { MaintenanceService } from './maintenance.service';
import { CreateMrDto } from './dto/create-mr.dto';
import { UpdateMrDto } from './dto/update-mr.dto';
import { MrListQueryDto } from './dto/mr-list-query.dto';
import {
  AssignMrDto,
  RejectMrDto,
  WaitingForPartsMrDto,
  CompleteMrDto,
  ReopenMrDto,
  CancelMrDto,
} from './dto/transition.dto';
import { AddMrCommentDto } from './dto/add-comment.dto';
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

@Controller('maintenance')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  // summary, my, people MUST be declared before /:id to avoid route conflict

  @Get('summary')
  @Permissions('maintenance.read')
  async summary(
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.maintenanceService.getSummary(actor);
    return { data, meta: meta(), error: null };
  }

  @Get('my')
  @Permissions('maintenance.read')
  async my(
    @Query() query: MrListQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const result = await this.maintenanceService.findMy(query, actor);
    return { data: result, meta: meta(), error: null };
  }

  @Get('people')
  @Permissions('maintenance.read')
  async people(
    @Query('search') search?: string,
  ): Promise<ApiSuccessResponse<{ id: string; displayName: string; username: string }[]>> {
    const people = await this.maintenanceService.listPeople(search);
    return { data: people, meta: meta(), error: null };
  }

  @Get()
  @Permissions('maintenance.read')
  async list(
    @Query() query: MrListQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const result = await this.maintenanceService.findAll(query, actor);
    return { data: result, meta: meta(), error: null };
  }

  @Get(':id')
  @Permissions('maintenance.read')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<unknown>> {
    const mr = await this.maintenanceService.findOne(id);
    return { data: mr, meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @Permissions('maintenance.create')
  async create(
    @Body() dto: CreateMrDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const mr = await this.maintenanceService.create(dto, actor);
    return { data: mr, meta: meta(), error: null };
  }

  @Patch(':id')
  @Permissions('maintenance.create')
  async updateDraft(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateMrDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const mr = await this.maintenanceService.updateDraft(id, dto, actor);
    return { data: mr, meta: meta(), error: null };
  }

  @Post(':id/submit')
  @Permissions('maintenance.create')
  async submit(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const mr = await this.maintenanceService.submit(id, actor);
    return { data: mr, meta: meta(), error: null };
  }

  @Post(':id/review')
  @Permissions('maintenance.review')
  async review(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const mr = await this.maintenanceService.review(id, actor);
    return { data: mr, meta: meta(), error: null };
  }

  @Post(':id/approve')
  @Permissions('maintenance.approve')
  async approve(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const mr = await this.maintenanceService.approve(id, actor);
    return { data: mr, meta: meta(), error: null };
  }

  @Post(':id/reject')
  @Permissions('maintenance.reject')
  async reject(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RejectMrDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const mr = await this.maintenanceService.reject(id, dto, actor);
    return { data: mr, meta: meta(), error: null };
  }

  @Post(':id/assign')
  @Permissions('maintenance.assign')
  async assign(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AssignMrDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const mr = await this.maintenanceService.assign(id, dto, actor);
    return { data: mr, meta: meta(), error: null };
  }

  @Post(':id/unassign')
  @Permissions('maintenance.assign')
  async unassign(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const mr = await this.maintenanceService.unassign(id, actor);
    return { data: mr, meta: meta(), error: null };
  }

  @Post(':id/start')
  @Permissions('maintenance.start')
  async start(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const mr = await this.maintenanceService.start(id, actor);
    return { data: mr, meta: meta(), error: null };
  }

  @Post(':id/waiting-for-parts')
  @Permissions('maintenance.start')
  async waitingForParts(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: WaitingForPartsMrDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const mr = await this.maintenanceService.waitingForParts(id, dto, actor);
    return { data: mr, meta: meta(), error: null };
  }

  @Post(':id/resume')
  @Permissions('maintenance.start')
  async resume(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const mr = await this.maintenanceService.resume(id, actor);
    return { data: mr, meta: meta(), error: null };
  }

  @Post(':id/complete')
  @Permissions('maintenance.complete')
  async complete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CompleteMrDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const mr = await this.maintenanceService.complete(id, dto, actor);
    return { data: mr, meta: meta(), error: null };
  }

  @Post(':id/close')
  @Permissions('maintenance.close')
  async close(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const mr = await this.maintenanceService.close(id, actor);
    return { data: mr, meta: meta(), error: null };
  }

  @Post(':id/cancel')
  @Permissions('maintenance.create')
  async cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CancelMrDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const mr = await this.maintenanceService.cancel(id, dto, actor);
    return { data: mr, meta: meta(), error: null };
  }

  @Post(':id/reopen')
  @Permissions('maintenance.manage')
  async reopen(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReopenMrDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const mr = await this.maintenanceService.reopen(id, dto, actor);
    return { data: mr, meta: meta(), error: null };
  }

  @Get(':id/comments')
  @Permissions('maintenance.read')
  async listComments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const comments = await this.maintenanceService.listComments(id);
    return { data: comments, meta: meta(), error: null };
  }

  @Post(':id/comments')
  @HttpCode(201)
  @Permissions('maintenance.comment')
  async addComment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddMrCommentDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const comment = await this.maintenanceService.addComment(id, dto, actor);
    return { data: comment, meta: meta(), error: null };
  }

  @Get(':id/activities')
  @Permissions('maintenance.read')
  async listActivities(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const activities = await this.maintenanceService.listActivities(id);
    return { data: activities, meta: meta(), error: null };
  }
}
