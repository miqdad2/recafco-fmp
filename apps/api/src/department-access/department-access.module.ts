import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DepartmentAccessService } from './department-access.service';

@Module({
  imports: [DatabaseModule],
  providers: [DepartmentAccessService],
  exports: [DepartmentAccessService],
})
export class DepartmentAccessModule {}
