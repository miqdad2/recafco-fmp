import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractListQueryDto } from './dto/contract-list-query.dto';
import { ActivateContractDto } from './dto/activate-contract.dto';
import { TerminateContractDto } from './dto/terminate-contract.dto';
import { CloseContractDto } from './dto/close-contract.dto';
import { AddCommentDto } from './dto/add-comment.dto';
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

@Controller('contracts')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  // summary and people MUST be declared before /:id to avoid route conflict

  @Get('summary')
  @Permissions('contracts.read')
  async summary(
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractsService.getSummary(actor);
    return { data, meta: meta(), error: null };
  }

  @Get('dashboard')
  @Permissions('contracts.read')
  async dashboard(
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractsService.getDashboard(actor);
    return { data, meta: meta(), error: null };
  }

  @Get('people')
  @Permissions('contracts.read')
  async people(
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractsService.listPeople(actor);
    return { data, meta: meta(), error: null };
  }

  @Get('departments')
  @Permissions('contracts.read')
  async departments(
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractsService.listDepartments(actor);
    return { data, meta: meta(), error: null };
  }

  @Get('plants')
  @Permissions('contracts.read')
  async plants(
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractsService.listPlants(actor);
    return { data, meta: meta(), error: null };
  }

  @Get('locations')
  @Permissions('contracts.read')
  async locations(
    @Query('plantId') plantId: string | undefined,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractsService.listLocations(actor, plantId);
    return { data, meta: meta(), error: null };
  }

  @Get()
  @Permissions('contracts.read')
  async list(
    @Query() query: ContractListQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const result = await this.contractsService.findAll(query, actor);
    return { data: result, meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @Permissions('contracts.create')
  async create(
    @Body() dto: CreateContractDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const contract = await this.contractsService.create(dto, actor);
    return { data: contract, meta: meta(), error: null };
  }

  @Get(':id')
  @Permissions('contracts.read')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const contract = await this.contractsService.findOne(id, actor);
    return { data: contract, meta: meta(), error: null };
  }

  @Patch(':id')
  @Permissions('contracts.update')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateContractDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const contract = await this.contractsService.update(id, dto, actor);
    return { data: contract, meta: meta(), error: null };
  }

  @Post(':id/activate')
  @HttpCode(200)
  @Permissions('contracts.activate')
  async activate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ActivateContractDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const contract = await this.contractsService.activate(id, dto, actor);
    return { data: contract, meta: meta(), error: null };
  }

  @Post(':id/terminate')
  @HttpCode(200)
  @Permissions('contracts.terminate')
  async terminate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: TerminateContractDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const contract = await this.contractsService.terminate(id, dto, actor);
    return { data: contract, meta: meta(), error: null };
  }

  @Post(':id/close')
  @HttpCode(200)
  @Permissions('contracts.close')
  async close(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CloseContractDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const contract = await this.contractsService.close(id, dto, actor);
    return { data: contract, meta: meta(), error: null };
  }

  @Get(':id/comments')
  @Permissions('contracts.read')
  async listComments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const comments = await this.contractsService.listComments(id, actor);
    return { data: comments, meta: meta(), error: null };
  }

  @Post(':id/comments')
  @HttpCode(201)
  @Permissions('contracts.comment')
  async addComment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const comment = await this.contractsService.addComment(id, dto, actor);
    return { data: comment, meta: meta(), error: null };
  }

  @Get(':id/activities')
  @Permissions('contracts.read')
  async listActivities(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const activities = await this.contractsService.listActivities(id, actor);
    return { data: activities, meta: meta(), error: null };
  }
}
