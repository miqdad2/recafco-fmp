import { Module } from '@nestjs/common';
import { FactoryTasksController } from './factory-tasks.controller';
import { FactoryTasksService } from './factory-tasks.service';
import { TasksRefService } from './tasks-ref.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { DepartmentAccessModule } from '../department-access/department-access.module';

@Module({
  imports: [DatabaseModule, AuthModule, DepartmentAccessModule],
  controllers: [FactoryTasksController],
  providers: [FactoryTasksService, TasksRefService],
})
export class FactoryTasksModule {}
