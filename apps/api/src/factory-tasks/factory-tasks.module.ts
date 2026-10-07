import { Module } from '@nestjs/common';
import { FactoryTasksController } from './factory-tasks.controller';
import { FactoryTasksService } from './factory-tasks.service';
import { TasksRefService } from './tasks-ref.service';
import { FactoryTaskAttachmentsService } from './factory-task-attachments.service';
import { TaskAttachmentStorageService } from './task-attachment-storage.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { DepartmentAccessModule } from '../department-access/department-access.module';

@Module({
  imports: [DatabaseModule, AuthModule, DepartmentAccessModule],
  controllers: [FactoryTasksController],
  providers: [FactoryTasksService, TasksRefService, FactoryTaskAttachmentsService, TaskAttachmentStorageService],
  exports: [FactoryTasksService],
})
export class FactoryTasksModule {}
