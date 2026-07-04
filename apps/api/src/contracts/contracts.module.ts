import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { DepartmentAccessModule } from '../department-access/department-access.module';
import { ContractsRefService } from './contracts-ref.service';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';

@Module({
  imports: [DatabaseModule, AuthModule, DepartmentAccessModule],
  providers: [ContractsRefService, ContractsService],
  controllers: [ContractsController],
})
export class ContractsModule {}
