import { Controller, Get, Post, Patch, Body, Param, Query, HttpCode, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ContractBoqPieceStatus } from '@recafco/database';
import { TechnicalBoqPieceService } from './technical-boq-piece.service';
import { BulkUpdatePieceStatusDto, UpdatePieceStatusDto } from './dto/boq-piece-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AnyPermission } from '../common/decorators/any-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import type { AuthUser } from '../common/types/auth-user';

function meta(): { requestId?: string } {
  const id = getRequestId();
  return id !== undefined ? { requestId: id } : {};
}

export class BoqPieceListQueryDto {
  @IsOptional()
  @IsUUID('4')
  boqItemId?: string;

  @IsOptional()
  @IsEnum(ContractBoqPieceStatus)
  status?: ContractBoqPieceStatus;
}

const uuid = new ParseUUIDPipe({ version: '4' });

// FMP-BOQ-04 — read = contracts.read; generate = the same Technical write pair as BOQ-03.
@Controller('technical/jobs/:contractId/boq-pieces')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TechnicalBoqPieceController {
  constructor(private readonly service: TechnicalBoqPieceService) {}

  @Get()
  @Permissions('contracts.read')
  async list(
    @Param('contractId', uuid) contractId: string,
    @Query() query: BoqPieceListQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.list(contractId, query, actor), meta: meta(), error: null };
  }

  // FMP-BOQ-06 — literal segment, declared before ':pieceId' routes.
  @Get('allowed-statuses')
  @Permissions('contracts.read')
  allowedStatuses(@CurrentUser() actor: AuthUser): ApiSuccessResponse<unknown> {
    return { data: this.service.allowedStatuses(actor), meta: meta(), error: null };
  }

  @Post('generate')
  @HttpCode(200)
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  async generate(@Param('contractId', uuid) contractId: string, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.generate(contractId, actor), meta: meta(), error: null };
  }

  // FMP-BOQ-05 — 'bulk-status' is a literal segment, declared before the ':pieceId' routes.
  @Post('bulk-status')
  @HttpCode(200)
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  async bulkStatus(
    @Param('contractId', uuid) contractId: string,
    @Body() dto: BulkUpdatePieceStatusDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.bulkUpdateStatus(contractId, dto.pieceIds, dto.status, dto.note, actor), meta: meta(), error: null };
  }

  @Patch(':pieceId/status')
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  async updateStatus(
    @Param('contractId', uuid) contractId: string,
    @Param('pieceId', uuid) pieceId: string,
    @Body() dto: UpdatePieceStatusDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.updateStatus(contractId, pieceId, dto.status, dto.note, actor), meta: meta(), error: null };
  }

  @Get(':pieceId/history')
  @Permissions('contracts.read')
  async history(
    @Param('contractId', uuid) contractId: string,
    @Param('pieceId', uuid) pieceId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.history(contractId, pieceId, actor), meta: meta(), error: null };
  }
}
