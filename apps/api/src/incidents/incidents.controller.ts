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
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
  UnprocessableEntityException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { IncidentsService } from './incidents.service';
import {
  INCIDENT_ATTACHMENT_MAX_BYTES,
  INCIDENT_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './incident-attachment-storage.service';
import { IncidentAttachmentStorageService } from './incident-attachment-storage.service';
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

interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

function meta(): { requestId?: string } {
  const id = getRequestId();
  return id !== undefined ? { requestId: id } : {};
}

@Controller('incidents')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class IncidentsController {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly incidentAttachmentStorage: IncidentAttachmentStorageService,
  ) {}

  // summary and dashboard must be declared BEFORE /:id to avoid route conflict
  @Get('summary')
  @Permissions('incidents.read')
  async summary(
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<{
    totalOpen: number;
    criticalOpen: number;
    underInvestigation: number;
    resolvedThisMonth: number;
  }>> {
    const data = await this.incidentsService.getSummary(actor);
    return { data, meta: meta(), error: null };
  }

  @Get('dashboard')
  @Permissions('incidents.read')
  async dashboard(
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.incidentsService.getDashboard(actor);
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

  // FMP-UI-22 — active departments/plants/locations for the Report Incident
  // form's own dropdowns, gated by `incidents.read` (not the admin-only
  // `org.departments.read`/`org.plants.read`/`org.locations.read`) — see
  // incidents.service.ts's own doc comment for the root cause this fixes.
  // Declared before /:id, same reason as /summary, /dashboard, /people above.
  @Get('departments')
  @Permissions('incidents.read')
  async departments(): Promise<ApiSuccessResponse<{ id: string; name: string; code: string }[]>> {
    const data = await this.incidentsService.listDepartments();
    return { data, meta: meta(), error: null };
  }

  @Get('plants')
  @Permissions('incidents.read')
  async plants(): Promise<ApiSuccessResponse<{ id: string; name: string; code: string }[]>> {
    const data = await this.incidentsService.listPlants();
    return { data, meta: meta(), error: null };
  }

  @Get('locations')
  @Permissions('incidents.read')
  async locations(): Promise<ApiSuccessResponse<{ id: string; name: string; code: string }[]>> {
    const data = await this.incidentsService.listLocations();
    return { data, meta: meta(), error: null };
  }

  @Get()
  @Permissions('incidents.read')
  async list(
    @Query() query: IncidentListQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const result = await this.incidentsService.findAll(query, actor);
    return { data: result, meta: meta(), error: null };
  }

  @Get(':id')
  @Permissions('incidents.read')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const incident = await this.incidentsService.findOne(id, actor);
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
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const comments = await this.incidentsService.listComments(id, actor);
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
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const activities = await this.incidentsService.listActivities(id, actor);
    return { data: activities, meta: meta(), error: null };
  }

  @Get(':id/actions')
  @Permissions('incidents.read')
  async listActions(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const actions = await this.incidentsService.listActions(id, actor);
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

  // ---------------------------------------------------------------------------
  // Evidence Attachments (FMP-INC-01)
  // ---------------------------------------------------------------------------

  @Get(':id/attachments')
  @Permissions('incidents.read')
  async listAttachments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.incidentsService.listAttachments(id, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/attachments')
  @HttpCode(201)
  @Permissions('incidents.create')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: INCIDENT_ATTACHMENT_MAX_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!(INCIDENT_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
          callback(
            new UnprocessableEntityException({
              code: 'INCIDENT_ATTACHMENT_INVALID_TYPE',
              message: 'Unsupported file type. Allowed: JPG/PNG/WEBP images, MP4/MOV/WEBM video, PDF/DOC/DOCX/XLS/XLSX/CSV/TXT documents.',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() file: UploadedFileLike,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.incidentsService.createAttachment(id, file, actor);
    return { data, meta: meta(), error: null };
  }

  // 4 path segments — declared after :id/attachments (2 segments) with no
  // ambiguity: NestJS matches the more specific literal segment
  // ("download") exactly, same reasoning as every other attachment
  // download route in this codebase (contracts.controller.ts).
  @Get(':id/attachments/:attachmentId/download')
  @Permissions('incidents.read')
  async downloadAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalFileName, mimeType } = await this.incidentsService.getAttachmentForDownload(
      id,
      attachmentId,
      actor,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(this.incidentAttachmentStorage.createReadStream(storagePath));
  }

  @Delete(':id/attachments/:attachmentId')
  @HttpCode(200)
  @Permissions('incidents.create')
  async deleteAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<null>> {
    await this.incidentsService.deleteAttachment(id, attachmentId, actor);
    return { data: null, meta: meta(), error: null };
  }
}
