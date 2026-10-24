import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { OperationsSourceService, MAX_MONITORING_IDS } from './operations-source.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "a,b,c" -> valid unique UUIDs only (anything else is ignored), capped. */
export function parseIdList(raw: string | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(',').map((x) => x.trim()).filter((x) => UUID_RE.test(x)))].slice(0, MAX_MONITORING_IDS);
}
import { LinkSourceProjectDto, RegisterSourceProjectDto, SetFactoryMappingDto, UnlinkSourceProjectDto } from './dto/operations-source.dto';

function meta(): { requestId?: string } {
  const id = getRequestId();
  return id !== undefined ? { requestId: id } : {};
}

function ok<T>(data: T): ApiSuccessResponse<T> {
  return { data, meta: meta(), error: null };
}

// FMP-OPS-01 — project-level management of the read-only Operations integration.
// Reading needs contracts.read; confirming, changing or removing a link and the
// factory mapping need contracts.operations_link. NO route here calls the external
// source: the background worker is the only component that does.
@Controller('operations-source')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OperationsSourceController {
  constructor(private readonly service: OperationsSourceService) {}

  @Get('projects')
  @Permissions('contracts.read')
  async projects(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.listProjects(actor));
  }

  // Contract List: one call for the whole page. Same resolver as the Overview and the tabs.
  @Get('monitoring')
  @Permissions('contracts.read')
  async monitoring(@Query('ids') ids: string | undefined, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.monitoringSummaries(parseIdList(ids), actor));
  }

  // Open screens poll this cheap change-detector and reload only when it changes.
  @Get('monitoring/fingerprint')
  @Permissions('contracts.read')
  async fingerprint(@Query('ids') ids: string | undefined, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.monitoringFingerprints(parseIdList(ids), actor));
  }

  @Get('status')
  @Permissions('contracts.read')
  async status(): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.getConnection());
  }

  @Post('projects')
  @HttpCode(201)
  @Permissions('contracts.operations_link')
  async register(@Body() dto: RegisterSourceProjectDto, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.registerProject(actor, dto));
  }

  @Put('projects/:id/link')
  @Permissions('contracts.operations_link')
  async link(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: LinkSourceProjectDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.linkProject(actor, id, dto));
  }

  @Post('projects/:id/unlink')
  @HttpCode(200)
  @Permissions('contracts.operations_link')
  async unlink(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UnlinkSourceProjectDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.unlinkProject(actor, id, dto));
  }

  @Put('factory-mappings')
  @Permissions('contracts.operations_link')
  async setMapping(@Body() dto: SetFactoryMappingDto, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.setFactoryMapping(actor, dto));
  }

  @Delete('factory-mappings/:id')
  @Permissions('contracts.operations_link')
  async deleteMapping(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.deleteFactoryMapping(actor, id));
  }
}

// Per-contract progress. Same permission as the rest of the contract workspace; the
// service also applies the department scope used by every other contract read.
@Controller('contracts/:contractId/operations-progress')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ContractOperationsProgressController {
  constructor(private readonly service: OperationsSourceService) {}

  @Get()
  @Permissions('contracts.read')
  async progress(@Param('contractId', new ParseUUIDPipe()) contractId: string, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.getContractProgress(contractId, actor));
  }

  @Get('history')
  @Permissions('contracts.read')
  async history(
    @Param('contractId', new ParseUUIDPipe()) contractId: string,
    @Query('limit') limit: string | undefined,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const n = limit !== undefined ? parseInt(limit, 10) : 30;
    return ok(await this.service.getContractHistory(contractId, actor, Number.isNaN(n) ? 30 : n));
  }

  @Post('refresh')
  @HttpCode(202)
  @Permissions('contracts.read')
  async refresh(@Param('contractId', new ParseUUIDPipe()) contractId: string, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.requestRefresh(contractId, actor));
  }
}
