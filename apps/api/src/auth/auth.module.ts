import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { IpThrottleGuard } from './guards/ip-throttle.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { getApiEnv } from '../env';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const env = getApiEnv();
        return {
          secret: env.jwtAccessSecret,
          signOptions: { expiresIn: env.jwtAccessExpiresSeconds },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, IpThrottleGuard, PermissionGuard],
  exports: [AuthService, JwtAuthGuard, PermissionGuard, JwtModule],
})
export class AuthModule {}
