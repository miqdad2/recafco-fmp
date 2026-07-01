import { Module } from '@nestjs/common';
import { FactoryTasksController } from './factory-tasks.controller';
import { FactoryTasksService } from './factory-tasks.service';
import { TasksRefService } from './tasks-ref.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [FactoryTasksController],
  providers: [FactoryTasksService, TasksRefService],
})
export class FactoryTasksModule {}
