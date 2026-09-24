import { Controller, Get, UseGuards } from '@nestjs/common';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { PlatformDashboardService, type PlatformDashboardResult } from './platform-dashboard.service';

function meta(): { requestId?: string } {
  const id = getRequestId();
  return id !== undefined ? { requestId: id } : {};
}

// No @Permissions() here — every authenticated user may call this route.
// Which cards come back is decided entirely inside PlatformDashboardService
// from the actor's own real permissions, per module (never a role code).
@Controller('platform')
@UseGuards(JwtAuthGuard)
export class PlatformDashboardController {
  constructor(private readonly platformDashboardService: PlatformDashboardService) {}

  @Get('dashboard')
  async dashboard(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<PlatformDashboardResult>> {
    const data = await this.platformDashboardService.getDashboard(actor);
    return { data, meta: meta(), error: null };
  }
}
