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
  Header,
} from '@nestjs/common';
import { IsOptional, IsBoolean, IsString, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import type { AuthUser } from '../common/types/auth-user';
import type { UserSummary, UserListResult, UserCreatedResult } from './users.service';

class UserListQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Transform(({ value }: { value: string }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  roleCode?: string;
}

function meta(): { requestId?: string } {
  const id = getRequestId();
  return id !== undefined ? { requestId: id } : {};
}

@Controller('administration/users')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions('users.read')
  async list(
    @Query() query: UserListQueryDto,
  ): Promise<ApiSuccessResponse<UserListResult>> {
    const result = await this.usersService.findAll(query);
    return { data: result, meta: meta(), error: null };
  }

  @Get(':id')
  @Permissions('users.read')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiSuccessResponse<UserSummary>> {
    const user = await this.usersService.findOne(id);
    return { data: user, meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  @Permissions('users.create')
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<UserCreatedResult>> {
    const result = await this.usersService.create(dto, actor);
    return { data: result, meta: meta(), error: null };
  }

  @Patch(':id')
  @Permissions('users.update')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<UserSummary>> {
    const user = await this.usersService.update(id, dto, actor);
    return { data: user, meta: meta(), error: null };
  }

  @Patch(':id/role')
  @Permissions('users.assign_role')
  async assignRole(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<UserSummary>> {
    const user = await this.usersService.updateRole(id, dto.roleId, actor);
    return { data: user, meta: meta(), error: null };
  }

  @Post(':id/activate')
  @Permissions('users.activate')
  async activate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<UserSummary>> {
    const user = await this.usersService.activate(id, actor);
    return { data: user, meta: meta(), error: null };
  }

  @Post(':id/deactivate')
  @Permissions('users.activate')
  async deactivate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<UserSummary>> {
    const user = await this.usersService.deactivate(id, actor);
    return { data: user, meta: meta(), error: null };
  }

  @Post(':id/reset-password')
  @Header('Cache-Control', 'no-store')
  @Permissions('users.reset_password')
  async resetPassword(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<{ tempPassword: string }>> {
    const result = await this.usersService.resetPassword(id, actor);
    return { data: result, meta: meta(), error: null };
  }

  @Post(':id/unlock')
  @Permissions('users.unlock')
  async unlock(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<UserSummary>> {
    const user = await this.usersService.unlock(id, actor);
    return { data: user, meta: meta(), error: null };
  }
}
