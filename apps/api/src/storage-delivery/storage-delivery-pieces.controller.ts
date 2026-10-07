import { Controller, Get, Post, Body, Param, Query, HttpCode, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { StorageDeliveryPiecesService } from './storage-delivery-pieces.service';
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

// FMP-BOQ-08 — read = storage_delivery.read; updating (checked in the service) = storage_delivery.update.
@Controller('storage-delivery/pieces')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class StorageDeliveryPiecesController {
  constructor(private readonly service: StorageDeliveryPiecesService) {}

  @Get()
  @Permissions('storage_delivery.read')
  async list(@Query() query: ProductionPieceListQueryDto, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.list(query, actor), meta: meta(), error: null };
  }

  @Get('summary')
  @Permissions('storage_delivery.read')
  async summary(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.summary(actor), meta: meta(), error: null };
  }

  @Get('contracts')
  @Permissions('storage_delivery.read')
  async contracts(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.contractOptions(actor), meta: meta(), error: null };
  }

  @Get('allowed-statuses')
  @Permissions('storage_delivery.read')
  allowedStatuses(@CurrentUser() actor: AuthUser): ApiSuccessResponse<unknown> {
    return { data: this.service.allowedStatuses(actor), meta: meta(), error: null };
  }

  @Post('bulk-status')
  @HttpCode(200)
  @Permissions('storage_delivery.read')
  async bulkStatus(@Body() dto: BulkUpdatePieceStatusDto, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.bulkUpdateStatus(dto.pieceIds, dto.status, dto.note, dto.location, actor), meta: meta(), error: null };
  }

  @Get(':pieceId/history')
  @Permissions('storage_delivery.read')
  async history(
    @Param('pieceId', new ParseUUIDPipe({ version: '4' })) pieceId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.history(pieceId, actor), meta: meta(), error: null };
  }
}
