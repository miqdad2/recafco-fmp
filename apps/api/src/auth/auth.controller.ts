import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { IpThrottleGuard } from './guards/ip-throttle.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AllowMustChangePassword } from '../common/decorators/allow-must-change-password.decorator';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import type { LoginResult, UserProfile } from './auth.service';

function meta(): { requestId?: string } {
  const id = getRequestId();
  return id !== undefined ? { requestId: id } : {};
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(IpThrottleGuard)
  async login(@Body() dto: LoginDto): Promise<ApiSuccessResponse<LoginResult>> {
    const result = await this.authService.login(dto);
    return { data: result, meta: meta(), error: null };
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(IpThrottleGuard)
  async refresh(@Body() dto: RefreshDto): Promise<ApiSuccessResponse<LoginResult>> {
    const result = await this.authService.refresh(dto);
    return { data: result, meta: meta(), error: null };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Body() dto: RefreshDto): Promise<ApiSuccessResponse<null>> {
    await this.authService.logout(dto);
    return { data: null, meta: meta(), error: null };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @AllowMustChangePassword()
  async me(@CurrentUser() user: import('../common/types/auth-user').AuthUser): Promise<ApiSuccessResponse<UserProfile>> {
    const profile = await this.authService.me(user);
    return { data: profile, meta: meta(), error: null };
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @AllowMustChangePassword()
  async changePassword(
    @CurrentUser() user: import('../common/types/auth-user').AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<ApiSuccessResponse<null>> {
    await this.authService.changePassword(user, dto);
    return { data: null, meta: meta(), error: null };
  }
}
