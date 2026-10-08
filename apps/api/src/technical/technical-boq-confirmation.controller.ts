import { Controller, Get, Post, Patch, Body, Param, HttpCode, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { TechnicalBoqConfirmationService } from './technical-boq-confirmation.service';
import { SaveBoqDrawingConfirmationDto } from './dto/boq-drawing-confirmation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { AnyPermission } from '../common/decorators/any-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import type { AuthUser } from '../common/types/auth-user';

function meta(): { requestId?: string } {
  const id = getRequestId();
  return id !== undefined ? { requestId: id } : {};
}

const uuid = new ParseUUIDPipe({ version: '4' });

// FMP-BOQ-03 — BOQ Drawing Confirmation inside the Technical job. Read =
// contracts.read; write = contracts.update or contracts.workflow_update (the
// same pair every other Technical write uses).
@Controller('technical/jobs/:contractId/boq-confirmations')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TechnicalBoqConfirmationController {
  constructor(private readonly service: TechnicalBoqConfirmationService) {}

  @Get()
  @AnyPermission('technical.read', 'contracts.read')
  async list(@Param('contractId', uuid) contractId: string, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.list(contractId, actor), meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async create(
    @Param('contractId', uuid) contractId: string,
    @Body() dto: SaveBoqDrawingConfirmationDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.create(contractId, dto, actor), meta: meta(), error: null };
  }

  @Patch(':id')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async updateDraft(
    @Param('contractId', uuid) contractId: string,
    @Param('id', uuid) id: string,
    @Body() dto: SaveBoqDrawingConfirmationDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.updateDraft(contractId, id, dto, actor), meta: meta(), error: null };
  }

  @Post(':id/revise')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async revise(
    @Param('contractId', uuid) contractId: string,
    @Param('id', uuid) id: string,
    @Body() dto: SaveBoqDrawingConfirmationDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.revise(contractId, id, dto, actor), meta: meta(), error: null };
  }

  @Post(':id/cancel')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async cancel(
    @Param('contractId', uuid) contractId: string,
    @Param('id', uuid) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.cancel(contractId, id, actor), meta: meta(), error: null };
  }
}
