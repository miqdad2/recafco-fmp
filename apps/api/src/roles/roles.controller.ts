import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  HttpCode,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import type { AuthUser } from '../common/types/auth-user';
import type { RoleSummary, RoleDetail } from './roles.service';

function meta(): { requestId?: string } {
  const id = getRequestId();
  return id !== undefined ? { requestId: id } : {};
}

@Controller('administration/roles')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions('roles.read')
  async list(): Promise<ApiSuccessResponse<RoleSummary[]>> {
    const roles = await this.rolesService.findAll();
    return { data: roles, meta: meta(), error: null };
  }

  @Get('permissions')
  @Permissions('roles.read')
  async listAllPermissions(): Promise<ApiSuccessResponse<{ id: string; code: string; name: string; module: string; description: string | null }[]>> {
    const perms = await this.rolesService.listAllPermissions();
    return { data: perms, meta: meta(), error: null };
  }

  @Get(':id')
  @Permissions('roles.read')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<RoleDetail>> {
    const role = await this.rolesService.findOne(id);
    return { data: role, meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @Permissions('roles.create')
  async create(
    @Body() dto: CreateRoleDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<RoleSummary>> {
    const role = await this.rolesService.create(dto, actor);
    return { data: role, meta: meta(), error: null };
  }

  @Patch(':id')
  @Permissions('roles.update')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<RoleSummary>> {
    const role = await this.rolesService.update(id, dto, actor);
    return { data: role, meta: meta(), error: null };
  }

  @Get(':id/permissions')
  @Permissions('roles.read')
  async getPermissions(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<{ id: string; code: string; name: string; module: string }[]>> {
    const perms = await this.rolesService.getPermissions(id);
    return { data: perms, meta: meta(), error: null };
  }

  @Put(':id/permissions')
  @Permissions('roles.assign_permissions')
  async assignPermissions(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AssignPermissionsDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<null>> {
    await this.rolesService.assignPermissions(id, dto.permissionIds, actor);
    return { data: null, meta: meta(), error: null };
  }

  @Post(':id/deactivate')
  @Permissions('roles.update')
  async deactivate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<RoleSummary>> {
    const role = await this.rolesService.deactivate(id, actor);
    return { data: role, meta: meta(), error: null };
  }
}
