import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { IncidentsModule } from './incidents/incidents.module';
import { FactoryTasksModule } from './factory-tasks/factory-tasks.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { SafetyModule } from './safety/safety.module';
import { ContractsModule } from './contracts/contracts.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { RequestLogMiddleware } from './common/middleware/request-log.middleware';

@Module({
  imports: [HealthModule, AuthModule, OrganizationsModule, UsersModule, RolesModule, IncidentsModule, FactoryTasksModule, MaintenanceModule, SafetyModule, ContractsModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware, RequestLogMiddleware)
      .forRoutes({ path: '*splat', method: RequestMethod.ALL });
  }
}
