import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceRefService } from './maintenance-ref.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { DepartmentAccessModule } from '../department-access/department-access.module';

@Module({
  imports: [DatabaseModule, AuthModule, DepartmentAccessModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, MaintenanceRefService],
})
export class MaintenanceModule {}
