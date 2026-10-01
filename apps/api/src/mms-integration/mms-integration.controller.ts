import { Controller, Get, UseGuards } from '@nestjs/common';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { MmsDashboardService } from './mms-dashboard.service';

function meta(): { requestId?: string } {
  const id = getRequestId();
  return id !== undefined ? { requestId: id } : {};
}

// FMP-MAINT-01 — read-only. This controller exposes GET only; there is no
// route that can create, update, or delete anything in MMS.
@Controller('maintenance')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MmsIntegrationController {
  constructor(private readonly mmsDashboard: MmsDashboardService) {}

  @Get('dashboard/live')
  @Permissions('maintenance.read')
  async liveDashboard(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.mmsDashboard.getLiveDashboard(actor);
    return { data, meta: meta(), error: null };
  }
}
