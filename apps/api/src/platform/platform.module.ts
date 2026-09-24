import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { DepartmentAccessModule } from '../department-access/department-access.module';
import { ContractsModule } from '../contracts/contracts.module';
import { FactoryTasksModule } from '../factory-tasks/factory-tasks.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { SafetyModule } from '../safety/safety.module';
import { ProductionModule } from '../production/production.module';
import { PlatformDashboardService } from './platform-dashboard.service';
import { PlatformDashboardController } from './platform-dashboard.controller';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    DepartmentAccessModule,
    ContractsModule,
    FactoryTasksModule,
    IncidentsModule,
    MaintenanceModule,
    SafetyModule,
    ProductionModule,
  ],
  controllers: [PlatformDashboardController],
  providers: [PlatformDashboardService],
})
export class PlatformModule {}
