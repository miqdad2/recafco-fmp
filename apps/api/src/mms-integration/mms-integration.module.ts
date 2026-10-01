import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { DepartmentAccessModule } from '../department-access/department-access.module';
import { MmsIntegrationController } from './mms-integration.controller';
import { MmsDashboardService } from './mms-dashboard.service';
import { MmsLiveApiClient } from './mms-live-api.client';

// FMP-MAINT-01/02 — read-only integration with the live RECAFCO MMS via its live dashboard API.
@Module({
  imports: [DatabaseModule, AuthModule, DepartmentAccessModule],
  controllers: [MmsIntegrationController],
  providers: [MmsDashboardService, MmsLiveApiClient],
})
export class MmsIntegrationModule {}
