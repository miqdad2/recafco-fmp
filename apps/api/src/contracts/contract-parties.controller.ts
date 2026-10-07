import { Controller, Get, Post, Patch, Body, Param, Query, HttpCode, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ContractPartiesService } from './contract-parties.service';
import {
  ContractPartyListQueryDto,
  CreateContractPartyDto,
  UpdateContractPartyDto,
} from './dto/contract-party.dto';
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

// FMP-CONTRACT-01 — registered before ContractsController in the module so
// GET /contracts/parties is never captured by GET /contracts/:id.
@Controller('contracts/parties')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ContractPartiesController {
  constructor(private readonly parties: ContractPartiesService) {}

  @Get()
  @Permissions('contracts.read')
  async list(
    @Query() query: ContractPartyListQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    return { data: await this.parties.list(query, actor), meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @Permissions('contracts.create')
  async create(
    @Body() dto: CreateContractPartyDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.parties.create(dto, actor), meta: meta(), error: null };
  }

  @Patch(':id')
  @Permissions('contracts.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractPartyDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.parties.update(id, dto, actor), meta: meta(), error: null };
  }
}
