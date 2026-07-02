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
import { SafetyService } from './safety.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { UpdateInspectionDto } from './dto/update-inspection.dto';
import { InspectionListQueryDto } from './dto/inspection-list-query.dto';
import { ScheduleInspectionDto } from './dto/schedule-inspection.dto';
import {
  CompleteInspectionDto,
  CancelInspectionDto,
  ReopenInspectionDto,
  CreateFindingDto,
  AssignFindingDto,
  RequireActionDto,
  ResolveFindingDto,
  ReopenFindingDto,
} from './dto/transition.dto';
import { AddInspectionCommentDto } from './dto/add-comment.dto';
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

@Controller('safety-compliance')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SafetyController {
  constructor(private readonly safetyService: SafetyService) {}

  // summary and people MUST be declared before /:id to avoid route conflict

  @Get('summary')
  @Permissions('safety.read')
  async summary(): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.safetyService.getSummary();
    return { data, meta: meta(), error: null };
  }

  @Get('people')
  @Permissions('safety.read')
  async people(
    @Query('search') search?: string,
  ): Promise<ApiSuccessResponse<{ id: string; displayName: string; username: string }[]>> {
    const people = await this.safetyService.listPeople(search);
    return { data: people, meta: meta(), error: null };
  }

  @Get()
  @Permissions('safety.read')
  async list(
    @Query() query: InspectionListQueryDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    const result = await this.safetyService.findAll(query);
    return { data: result, meta: meta(), error: null };
  }

  @Get(':id')
  @Permissions('safety.read')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<unknown>> {
    const inspection = await this.safetyService.findOne(id);
    return { data: inspection, meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @Permissions('safety.create')
  async create(
    @Body() dto: CreateInspectionDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const inspection = await this.safetyService.create(dto, actor);
    return { data: inspection, meta: meta(), error: null };
  }

  @Patch(':id')
  @Permissions('safety.create')
  async updateDraft(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateInspectionDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const inspection = await this.safetyService.updateDraft(id, dto, actor);
    return { data: inspection, meta: meta(), error: null };
  }

  @Post(':id/schedule')
  @Permissions('safety.schedule')
  async scheduleInspection(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ScheduleInspectionDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const inspection = await this.safetyService.schedule(id, dto, actor);
    return { data: inspection, meta: meta(), error: null };
  }

  @Post(':id/start')
  @Permissions('safety.inspect')
  async start(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const inspection = await this.safetyService.start(id, actor);
    return { data: inspection, meta: meta(), error: null };
  }

  @Post(':id/complete')
  @Permissions('safety.inspect')
  async complete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CompleteInspectionDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const inspection = await this.safetyService.complete(id, dto, actor);
    return { data: inspection, meta: meta(), error: null };
  }

  @Post(':id/close')
  @Permissions('safety.close')
  async close(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const inspection = await this.safetyService.close(id, actor);
    return { data: inspection, meta: meta(), error: null };
  }

  @Post(':id/reopen')
  @Permissions('safety.manage')
  async reopen(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReopenInspectionDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const inspection = await this.safetyService.reopen(id, dto, actor);
    return { data: inspection, meta: meta(), error: null };
  }

  @Post(':id/cancel')
  @Permissions('safety.create')
  async cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CancelInspectionDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const inspection = await this.safetyService.cancel(id, dto, actor);
    return { data: inspection, meta: meta(), error: null };
  }

  // ---------------------------------------------------------------------------
  // Findings
  // ---------------------------------------------------------------------------

  @Get(':id/findings')
  @Permissions('safety.read')
  async listFindings(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const findings = await this.safetyService.listFindings(id);
    return { data: findings, meta: meta(), error: null };
  }

  @Post(':id/findings')
  @HttpCode(201)
  @Permissions('safety.finding_create')
  async createFinding(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateFindingDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const finding = await this.safetyService.createFinding(id, dto, actor);
    return { data: finding, meta: meta(), error: null };
  }

  @Post(':id/findings/:findingId/assign')
  @Permissions('safety.finding_assign')
  async assignFinding(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('findingId', new ParseUUIDPipe({ version: '4' })) findingId: string,
    @Body() dto: AssignFindingDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const finding = await this.safetyService.assignFinding(id, findingId, dto, actor);
    return { data: finding, meta: meta(), error: null };
  }

  @Post(':id/findings/:findingId/require-action')
  @Permissions('safety.finding_assign')
  async requireAction(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('findingId', new ParseUUIDPipe({ version: '4' })) findingId: string,
    @Body() dto: RequireActionDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const finding = await this.safetyService.requireAction(id, findingId, dto, actor);
    return { data: finding, meta: meta(), error: null };
  }

  @Post(':id/findings/:findingId/resolve')
  @Permissions('safety.finding_resolve')
  async resolveFinding(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('findingId', new ParseUUIDPipe({ version: '4' })) findingId: string,
    @Body() dto: ResolveFindingDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const finding = await this.safetyService.resolveFinding(id, findingId, dto, actor);
    return { data: finding, meta: meta(), error: null };
  }

  @Post(':id/findings/:findingId/verify')
  @Permissions('safety.verify')
  async verifyFinding(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('findingId', new ParseUUIDPipe({ version: '4' })) findingId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const finding = await this.safetyService.verifyFinding(id, findingId, actor);
    return { data: finding, meta: meta(), error: null };
  }

  @Post(':id/findings/:findingId/close')
  @Permissions('safety.close')
  async closeFinding(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('findingId', new ParseUUIDPipe({ version: '4' })) findingId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const finding = await this.safetyService.closeFinding(id, findingId, actor);
    return { data: finding, meta: meta(), error: null };
  }

  @Post(':id/findings/:findingId/reopen')
  @Permissions('safety.manage')
  async reopenFinding(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('findingId', new ParseUUIDPipe({ version: '4' })) findingId: string,
    @Body() dto: ReopenFindingDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const finding = await this.safetyService.reopenFinding(id, findingId, dto, actor);
    return { data: finding, meta: meta(), error: null };
  }

  // ---------------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------------

  @Get(':id/comments')
  @Permissions('safety.read')
  async listComments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const comments = await this.safetyService.listComments(id);
    return { data: comments, meta: meta(), error: null };
  }

  @Post(':id/comments')
  @HttpCode(201)
  @Permissions('safety.comment')
  async addComment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddInspectionCommentDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const comment = await this.safetyService.addComment(id, dto, actor);
    return { data: comment, meta: meta(), error: null };
  }

  // ---------------------------------------------------------------------------
  // Activities
  // ---------------------------------------------------------------------------

  @Get(':id/activities')
  @Permissions('safety.read')
  async listActivities(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const activities = await this.safetyService.listActivities(id);
    return { data: activities, meta: meta(), error: null };
  }
}



