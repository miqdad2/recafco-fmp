import { Controller, Get, Post, Patch, Body, Param, Query, HttpCode, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { IsOptional, IsUUID } from 'class-validator';
import { TechnicalDrawingGroupService } from './technical-drawing-group.service';
import { SaveDrawingGroupDto } from './dto/drawing-group.dto';
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

class DrawingGroupPiecesQueryDto {
  @IsOptional()
  @IsUUID('4')
  boqItemId?: string;
}

const uuid = new ParseUUIDPipe({ version: '4' });

// FMP-BOQ-11 — read = contracts.read; write = contracts.update or contracts.workflow_update
// (the same pair every other Technical write uses; no new permissions).
@Controller('technical/jobs/:contractId/drawing-groups')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TechnicalDrawingGroupController {
  constructor(private readonly service: TechnicalDrawingGroupService) {}

  @Get()
  @AnyPermission('technical.read', 'contracts.read')
  async list(@Param('contractId', uuid) contractId: string, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.list(contractId, actor), meta: meta(), error: null };
  }

  // Literal segment, declared before ':groupId'.
  @Get('pieces')
  @AnyPermission('technical.read', 'contracts.read')
  async pieces(
    @Param('contractId', uuid) contractId: string,
    @Query() query: DrawingGroupPiecesQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.piecesForItem(contractId, query.boqItemId ?? '', actor), meta: meta(), error: null };
  }

  @Get(':groupId')
  @AnyPermission('technical.read', 'contracts.read')
  async get(
    @Param('contractId', uuid) contractId: string,
    @Param('groupId', uuid) groupId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.getGroup(contractId, groupId, actor), meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async create(
    @Param('contractId', uuid) contractId: string,
    @Body() dto: SaveDrawingGroupDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.create(contractId, dto, actor), meta: meta(), error: null };
  }

  @Patch(':groupId')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async update(
    @Param('contractId', uuid) contractId: string,
    @Param('groupId', uuid) groupId: string,
    @Body() dto: SaveDrawingGroupDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.updateDraft(contractId, groupId, dto, actor), meta: meta(), error: null };
  }

  @Post(':groupId/submit')
  @HttpCode(200)
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async submit(
    @Param('contractId', uuid) contractId: string,
    @Param('groupId', uuid) groupId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.submit(contractId, groupId, actor), meta: meta(), error: null };
  }

  @Post(':groupId/approve')
  @HttpCode(200)
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async approve(
    @Param('contractId', uuid) contractId: string,
    @Param('groupId', uuid) groupId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.approve(contractId, groupId, actor), meta: meta(), error: null };
  }

  @Post(':groupId/release')
  @HttpCode(200)
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async release(
    @Param('contractId', uuid) contractId: string,
    @Param('groupId', uuid) groupId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.release(contractId, groupId, actor), meta: meta(), error: null };
  }

  @Post(':groupId/cancel')
  @HttpCode(200)
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async cancel(
    @Param('contractId', uuid) contractId: string,
    @Param('groupId', uuid) groupId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.cancel(contractId, groupId, actor), meta: meta(), error: null };
  }
}
