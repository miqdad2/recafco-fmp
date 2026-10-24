import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { OperationsDemoService } from './operations-demo.service';

function ok<T>(data: T): ApiSuccessResponse<T> {
  const id = getRequestId();
  return { data, meta: id !== undefined ? { requestId: id } : {}, error: null };
}

// FMP-OPS-02 — DEVELOPMENT ONLY. This controller is only registered when demonstration is allowed (not production
// and OPERATIONS_DEMO_ENABLED=true) and every method re-checks. It sits outside the normal manager screens.
@Controller('operations-demo')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OperationsDemoController {
  constructor(private readonly demo: OperationsDemoService) {}

  @Get('status')
  @Permissions('contracts.operations_link')
  async status(): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.demo.status());
  }

  @Post('seed')
  @HttpCode(200)
  @Permissions('contracts.operations_link')
  async seed(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.demo.seed(actor));
  }

  @Post('reset')
  @HttpCode(200)
  @Permissions('contracts.operations_link')
  async reset(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.demo.reset(actor));
  }

  @Post('simulate/update')
  @HttpCode(200)
  @Permissions('contracts.operations_link')
  async update(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.demo.simulate(actor, 'update'));
  }

  @Post('simulate/outage')
  @HttpCode(200)
  @Permissions('contracts.operations_link')
  async outage(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.demo.simulate(actor, 'outage'));
  }

  @Post('simulate/recovery')
  @HttpCode(200)
  @Permissions('contracts.operations_link')
  async recovery(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.demo.simulate(actor, 'recovery'));
  }
}
