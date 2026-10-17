import { Controller, Post, Body, Param, HttpCode, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ContractBoqItemsService } from './contract-boq-items.service';
import { AddContractBoqItemDto } from './dto/add-contract-boq-item.dto';
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

// FMP-CONTRACT-11 — contracts.update (checked again, with department access and
// the contract's status, in the service).
@Controller('contracts/:id/boq-items')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ContractBoqItemsController {
  constructor(private readonly service: ContractBoqItemsService) {}

  @Post()
  @HttpCode(201)
  @Permissions('contracts.update')
  async add(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddContractBoqItemDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.addItem(id, dto, actor), meta: meta(), error: null };
  }
}
