import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { DepartmentAccessModule } from '../department-access/department-access.module';
import { ContractOperationsProgressController, OperationsSourceController } from './operations-source.controller';
import { OperationsSourceService } from './operations-source.service';

// FMP-OPS-01 — read-only integration with the external Operations system. This module has NO HTTP client:
// it only reads and writes FMP's own tables. All source requests are made by the worker.
@Module({
  imports: [DatabaseModule, AuthModule, DepartmentAccessModule],
  controllers: [OperationsSourceController, ContractOperationsProgressController],
  providers: [OperationsSourceService],
})
export class OperationsSourceModule {}
