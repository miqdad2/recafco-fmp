import { Controller, Get, Post, Body, Param, Query, HttpCode, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ErectionPiecesService } from './erection-pieces.service';
import { ProductionPieceListQueryDto } from '../production/dto/production-piece.dto';
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

// FMP-BOQ-09 — read = erection.read; updating (checked in the service) = erection.update.
@Controller('erection/pieces')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ErectionPiecesController {
  constructor(private readonly service: ErectionPiecesService) {}

  @Get()
  @Permissions('erection.read')
  async list(@Query() query: ProductionPieceListQueryDto, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.list(query, actor), meta: meta(), error: null };
  }

  @Get('summary')
  @Permissions('erection.read')
  async summary(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.summary(actor), meta: meta(), error: null };
  }

  @Get('contracts')
  @Permissions('erection.read')
  async contracts(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.contractOptions(actor), meta: meta(), error: null };
  }

  // FMP-UI-34 — read-only, per-contract piece-status breakdown for the
  // redesigned Erection Dashboard. See
  // ErectionPiecesService.contractProgress()'s own doc comment.
  @Get('contract-progress')
  @Permissions('erection.read')
  async contractProgress(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.contractProgress(actor), meta: meta(), error: null };
  }

  // FMP-UI-34 — latest piece status updates across every contract. See
  // ErectionPiecesService.recentUpdates()'s own doc comment.
  @Get('recent-updates')
  @Permissions('erection.read')
  async recentUpdates(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.recentUpdates(actor), meta: meta(), error: null };
  }

  @Get('allowed-statuses')
  @Permissions('erection.read')
  allowedStatuses(@CurrentUser() actor: AuthUser): ApiSuccessResponse<unknown> {
    return { data: this.service.allowedStatuses(actor), meta: meta(), error: null };
  }

  @Post('bulk-status')
  @HttpCode(200)
  @Permissions('erection.read')
  async bulkStatus(@Body() dto: BulkUpdatePieceStatusDto, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.bulkUpdateStatus(dto.pieceIds, dto.status, dto.note, dto.location, actor), meta: meta(), error: null };
  }

  @Get(':pieceId/history')
  @Permissions('erection.read')
  async history(
    @Param('pieceId', new ParseUUIDPipe({ version: '4' })) pieceId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.history(pieceId, actor), meta: meta(), error: null };
  }
}
