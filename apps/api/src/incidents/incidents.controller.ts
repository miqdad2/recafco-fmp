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
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { IncidentListQueryDto } from './dto/incident-list-query.dto';
import {
  ResolveIncidentDto,
  ReopenIncidentDto,
  CancelIncidentDto,
  AssignIncidentDto,
  UpdateSeverityDto,
  UpdateInvestigationDto,
} from './dto/transition.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { AddActionDto, UpdateActionDto } from './dto/action.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import type { AuthUser } from '../common/types/auth-user';
import { IncidentSeverity } from '@recafco/database';
import { BadRequestException } from '@nestjs/common';

function meta(): { requestId?: string } {
  const id = getRequestId();
  return id !== undefined ? { requestId: id } : {};
}

@Controller('incidents')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  // summary must be declared BEFORE /:id to avoid route conflict
  @Get('summary')
  @Permissions('incidents.read')
  async summary(): Promise<ApiSuccessResponse<{
    totalOpen: number;
    criticalOpen: number;
    underInvestigation: number;
    resolvedThisMonth: number;
  }>> {
    const data = await this.incidentsService.getSummary();
    return { data, meta: meta(), error: null };
  }

  // people picker — no UUID input from users; returns active users only
  @Get('people')
  @Permissions('incidents.read')
  async people(
    @Query('search') search?: string,
  ): Promise<ApiSuccessResponse<{ id: string; displayName: string; username: string }[]>> {
    const people = await this.incidentsService.listPeople(search);
    return { data: people, meta: meta(), error: null };
  }

  @Get()
  @Permissions('incidents.read')
  async list(
    @Query() query: IncidentListQueryDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    const result = await this.incidentsService.findAll(query);
    return { data: result, meta: meta(), error: null };
  }

  @Get(':id')
  @Permissions('incidents.read')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<unknown>> {
    const incident = await this.incidentsService.findOne(id);
    return { data: incident, meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @Permissions('incidents.create')
  async create(
    @Body() dto: CreateIncidentDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const incident = await this.incidentsService.create(dto, actor);
    return { data: incident, meta: meta(), error: null };
  }

  @Patch(':id')
  @Permissions('incidents.update_own_draft')
  async updateDraft(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateIncidentDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const incident = await this.incidentsService.updateDraft(id, dto, actor);
    return { data: incident, meta: meta(), error: null };
  }

  @Patch(':id/severity')
  @Permissions('incidents.review')
  async updateSeverity(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateSeverityDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const severityValue = dto.severity as IncidentSeverity;
    if (!Object.values(IncidentSeverity).includes(severityValue)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Invalid severity: ${dto.severity}. Must be one of: ${Object.values(IncidentSeverity).join(', ')}`,
      });
    }
    const incident = await this.incidentsService.updateSeverity(id, severityValue, actor);
    return { data: incident, meta: meta(), error: null };
  }

  @Patch(':id/investigation')
  @Permissions('incidents.investigate')
  async updateInvestigation(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateInvestigationDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const incident = await this.incidentsService.updateInvestigation(id, dto, actor);
    return { data: incident, meta: meta(), error: null };
  }

  @Post(':id/submit')
  @Permissions('incidents.create')
  async submit(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const incident = await this.incidentsService.submit(id, actor);
    return { data: incident, meta: meta(), error: null };
  }

  @Post(':id/start-review')
  @Permissions('incidents.review')
  async startReview(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const incident = await this.incidentsService.startReview(id, actor);
    return { data: incident, meta: meta(), error: null };
  }

  @Post(':id/assign')
  @Permissions('incidents.assign')
  async assign(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AssignIncidentDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const incident = await this.incidentsService.assign(id, dto, actor);
    return { data: incident, meta: meta(), error: null };
  }

  @Post(':id/begin-investigation')
  @Permissions('incidents.investigate')
  async beginInvestigation(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const incident = await this.incidentsService.beginInvestigation(id, actor);
    return { data: incident, meta: meta(), error: null };
  }

  @Post(':id/request-actions')
  @Permissions('incidents.investigate')
  async requestActions(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const incident = await this.incidentsService.requestActions(id, actor);
    return { data: incident, meta: meta(), error: null };
  }

  @Post(':id/resolve')
  @Permissions('incidents.resolve')
  async resolve(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ResolveIncidentDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const incident = await this.incidentsService.resolve(id, dto, actor);
    return { data: incident, meta: meta(), error: null };
  }

  @Post(':id/close')
  @Permissions('incidents.close')
  async close(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const incident = await this.incidentsService.close(id, actor);
    return { data: incident, meta: meta(), error: null };
  }

  @Post(':id/cancel')
  @Permissions('incidents.create')
  async cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CancelIncidentDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const incident = await this.incidentsService.cancel(id, dto, actor);
    return { data: incident, meta: meta(), error: null };
  }

  @Post(':id/reopen')
  @Permissions('incidents.manage')
  async reopen(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReopenIncidentDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const incident = await this.incidentsService.reopen(id, dto, actor);
    return { data: incident, meta: meta(), error: null };
  }

  @Get(':id/comments')
  @Permissions('incidents.read')
  async listComments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const comments = await this.incidentsService.listComments(id);
    return { data: comments, meta: meta(), error: null };
  }

  @Post(':id/comments')
  @HttpCode(201)
  @Permissions('incidents.comment')
  async addComment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const comment = await this.incidentsService.addComment(id, dto, actor);
    return { data: comment, meta: meta(), error: null };
  }

  @Get(':id/activities')
  @Permissions('incidents.read')
  async listActivities(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const activities = await this.incidentsService.listActivities(id);
    return { data: activities, meta: meta(), error: null };
  }

  @Get(':id/actions')
  @Permissions('incidents.read')
  async listActions(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const actions = await this.incidentsService.listActions(id);
    return { data: actions, meta: meta(), error: null };
  }

  @Post(':id/actions')
  @HttpCode(201)
  @Permissions('incidents.investigate')
  async addAction(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddActionDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const action = await this.incidentsService.addAction(id, dto, actor);
    return { data: action, meta: meta(), error: null };
  }

  @Patch(':id/actions/:actionId')
  @Permissions('incidents.investigate')
  async updateAction(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('actionId', new ParseUUIDPipe({ version: '4' })) actionId: string,
    @Body() dto: UpdateActionDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const action = await this.incidentsService.updateAction(id, actionId, dto, actor);
    return { data: action, meta: meta(), error: null };
  }
}
