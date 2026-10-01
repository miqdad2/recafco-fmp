import { Module } from '@nestjs/common';
import { TechnicalController } from './technical.controller';
import { TechnicalService } from './technical.service';
import { TechnicalAttachmentStorageService } from './technical-attachment-storage.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { DepartmentAccessModule } from '../department-access/department-access.module';

@Module({
  imports: [DatabaseModule, AuthModule, DepartmentAccessModule],
  controllers: [TechnicalController],
  providers: [TechnicalService, TechnicalAttachmentStorageService],
  exports: [TechnicalService],
})
export class TechnicalModule {}
