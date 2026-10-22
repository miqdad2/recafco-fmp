import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe, HttpCode } from '@nestjs/common';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { SalesService } from './sales.service';
import { kuwaitToday, monthOf } from './sales.logic';
import {
  CreateEnquiryDto, UpdateEnquiryDto, ChangeStatusDto, AddActivityDto, AddFollowUpDto, CompleteFollowUpDto,
  RescheduleFollowUpDto, EnquiryListQueryDto, FollowUpListQueryDto, MonthQueryDto,
} from './dto/sales.dto';

function meta(): { requestId?: string } {
  const id = getRequestId();
  return id !== undefined ? { requestId: id } : {};
}

function ok<T>(data: T): ApiSuccessResponse<T> {
  return { data, meta: meta(), error: null };
}

// Every route needs its own Sales permission. Operational permissions (contracts.*, production.* ...)
// never substitute for them; there is no export route. The shipped roles: SALES_MANAGER holds all five
// codes, SALES_VIEWER holds sales.read + sales.reports.read.
@Controller('sales')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SalesController {
  constructor(private readonly service: SalesService) {}

  @Get('dashboard')
  @Permissions('sales.read')
  async dashboard(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.dashboard(actor));
  }

  @Get('reports/monthly')
  @Permissions('sales.reports.read')
  async monthly(@Query() q: MonthQueryDto): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.monthlyReport(q.month ?? monthOf(kuwaitToday())));
  }

  @Get('follow-ups')
  @Permissions('sales.read')
  async followUps(@Query() q: FollowUpListQueryDto): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.listFollowUps(q.bucket));
  }

  @Post('follow-ups/:followUpId/complete')
  @HttpCode(200)
  @Permissions('sales.update')
  async completeFollowUp(
    @Param('followUpId', new ParseUUIDPipe({ version: '4' })) followUpId: string,
    @Body() dto: CompleteFollowUpDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.completeFollowUp(followUpId, dto, actor));
  }

  @Post('follow-ups/:followUpId/reschedule')
  @HttpCode(200)
  @Permissions('sales.update')
  async rescheduleFollowUp(
    @Param('followUpId', new ParseUUIDPipe({ version: '4' })) followUpId: string,
    @Body() dto: RescheduleFollowUpDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.rescheduleFollowUp(followUpId, dto, actor));
  }

  @Get('enquiries')
  @Permissions('sales.read')
  async list(@Query() q: EnquiryListQueryDto): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.list(q));
  }

  @Post('enquiries')
  @Permissions('sales.create')
  async create(@Body() dto: CreateEnquiryDto, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.create(dto, actor));
  }

  @Get('enquiries/:id')
  @Permissions('sales.read')
  async getOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.getOne(id));
  }

  @Patch('enquiries/:id')
  @Permissions('sales.update')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateEnquiryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.update(id, dto, actor));
  }

  @Post('enquiries/:id/status')
  @HttpCode(200)
  @Permissions('sales.update')
  async changeStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.changeStatus(id, dto, actor));
  }

  @Post('enquiries/:id/activities')
  @Permissions('sales.update')
  async addActivity(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddActivityDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.addActivity(id, dto, actor));
  }

  @Post('enquiries/:id/follow-ups')
  @Permissions('sales.update')
  async addFollowUp(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddFollowUpDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return ok(await this.service.addFollowUp(id, dto, actor));
  }
}
