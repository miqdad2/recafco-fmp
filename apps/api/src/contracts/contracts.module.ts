import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { DepartmentAccessModule } from '../department-access/department-access.module';
import { ContractsRefService } from './contracts-ref.service';
import { ContractsService } from './contracts.service';
import { ContractPaymentsService } from './contract-payments.service';
import { ContractWorkflowService } from './contract-workflow.service';
import { WorkflowAttachmentStorageService } from './workflow-attachment-storage.service';
import { ContractIssuesService } from './contract-issues.service';
import { ContractClaimsService } from './contract-claims.service';
import { ContractCloseoutService } from './contract-closeout.service';
import { CloseoutAttachmentStorageService } from './closeout-attachment-storage.service';
import { ContractScheduleService } from './contract-schedule.service';
import { ContractDashboardService } from './contract-dashboard.service';
import { ContractsController } from './contracts.controller';

@Module({
  imports: [DatabaseModule, AuthModule, DepartmentAccessModule],
  providers: [
    ContractsRefService,
    ContractsService,
    ContractPaymentsService,
    ContractWorkflowService,
    WorkflowAttachmentStorageService,
    ContractIssuesService,
    ContractClaimsService,
    ContractCloseoutService,
    CloseoutAttachmentStorageService,
    ContractScheduleService,
    ContractDashboardService,
  ],
  controllers: [ContractsController],
})
export class ContractsModule {}
