import { Controller, Get, UseGuards } from '@nestjs/common';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ManagementIntelligenceService, type ManagementConnectionStatus } from './management-intelligence.service';

function meta(): { requestId?: string } {
  const id = getRequestId();
  return id !== undefined ? { requestId: id } : {};
}

// Class-level permission: every current and future route in this controller needs
// management_intelligence.read. It is the only permission this API accepts — operational
// permissions (contracts.*, production.*, ...) and SUPER_ADMIN status do not substitute for it.
@Controller('management-intelligence')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions('management_intelligence.read')
export class ManagementIntelligenceController {
  constructor(private readonly service: ManagementIntelligenceService) {}

  @Get('status')
  status(): ApiSuccessResponse<ManagementConnectionStatus> {
    return { data: this.service.getConnectionStatus(), meta: meta(), error: null };
  }
}
