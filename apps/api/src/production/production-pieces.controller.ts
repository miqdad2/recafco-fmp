import { Controller, Get, Post, Body, Param, Query, Res, HttpCode, UseGuards, StreamableFile, ParseUUIDPipe } from '@nestjs/common';
import type { Response } from 'express';
import { ProductionPiecesService } from './production-pieces.service';
import { TechnicalDrawingGroupFileStorageService } from '../technical/technical-drawing-group-file-storage.service';
import { ProductionPieceListQueryDto } from './dto/production-piece.dto';
import { BulkUpdatePieceStatusDto } from '../technical/dto/boq-piece-status.dto';
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

// FMP-BOQ-07 — registered BEFORE ProductionController in the module, so
// 'production/pieces' is never captured by 'production/:id'. Read =
// production.read; updating (checked in the service) = production.update or
// production.manage.
@Controller('production/pieces')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProductionPiecesController {
  constructor(
    private readonly service: ProductionPiecesService,
    private readonly fileStorage: TechnicalDrawingGroupFileStorageService,
  ) {}

  @Get()
  @Permissions('production.read')
  async list(@Query() query: ProductionPieceListQueryDto, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.list(query, actor), meta: meta(), error: null };
  }

  @Get('summary')
  @Permissions('production.read')
  async summary(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.summary(actor), meta: meta(), error: null };
  }

  @Get('contracts')
  @Permissions('production.read')
  async contracts(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.contractOptions(actor), meta: meta(), error: null };
  }

  // FMP-UI-32 — read-only, per-contract piece-status breakdown for the
  // redesigned Production & Planning dashboard. See
  // ProductionPiecesService.contractProgress()'s own doc comment.
  @Get('contract-progress')
  @Permissions('production.read')
  async contractProgress(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.contractProgress(actor), meta: meta(), error: null };
  }

  // FMP-UI-32 — latest piece status updates across every contract. See
  // ProductionPiecesService.recentUpdates()'s own doc comment.
  @Get('recent-updates')
  @Permissions('production.read')
  async recentUpdates(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.recentUpdates(actor), meta: meta(), error: null };
  }

  @Get('allowed-statuses')
  @Permissions('production.read')
  allowedStatuses(@CurrentUser() actor: AuthUser): ApiSuccessResponse<unknown> {
    return { data: this.service.allowedStatuses(actor), meta: meta(), error: null };
  }

  @Post('bulk-status')
  @HttpCode(200)
  @Permissions('production.read')
  async bulkStatus(@Body() dto: BulkUpdatePieceStatusDto, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.bulkUpdateStatus(dto.pieceIds, dto.status, dto.note, actor), meta: meta(), error: null };
  }

  // FMP-BOQ-13 — read-only released drawing / calculation files (production.read).
  @Get(':pieceId/drawing-files')
  @Permissions('production.read')
  async drawingFiles(
    @Param('pieceId', new ParseUUIDPipe({ version: '4' })) pieceId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.drawingFiles(pieceId, actor), meta: meta(), error: null };
  }

  @Get(':pieceId/drawing-files/:attachmentId/download')
  @Permissions('production.read')
  async downloadDrawingFile(
    @Param('pieceId', new ParseUUIDPipe({ version: '4' })) pieceId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalName, mimeType } = await this.service.drawingFileForDownload(pieceId, attachmentId, actor);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalName)}"`,
    });
    return new StreamableFile(this.fileStorage.createReadStream(storagePath));
  }

  @Get(':pieceId/history')
  @Permissions('production.read')
  async history(
    @Param('pieceId', new ParseUUIDPipe({ version: '4' })) pieceId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.history(pieceId, actor), meta: meta(), error: null };
  }
}
