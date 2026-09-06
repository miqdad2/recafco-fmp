import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { DepartmentAccessModule } from '../department-access/department-access.module';
import { ContractsRefService } from './contracts-ref.service';
import { ContractsService } from './contracts.service';
import { ContractPaymentsService } from './contract-payments.service';
import { ContractBoqProductionService } from './contract-boq-production.service';
import { ContractVariationsService } from './contract-variations.service';
import { ContractRisksService } from './contract-risks.service';
import { VariationAttachmentStorageService } from './variation-attachment-storage.service';
import { ContractDocumentObligationsService } from './contract-document-obligations.service';
import { DocumentObligationAttachmentStorageService } from './document-obligation-attachment-storage.service';
import { ContractAttachmentsService } from './contract-attachments.service';
import { ContractWorkflowService } from './contract-workflow.service';
import { WorkflowAttachmentStorageService } from './workflow-attachment-storage.service';
import { ContractIssuesService } from './contract-issues.service';
import { ContractClaimsService } from './contract-claims.service';
import { ContractCloseoutService } from './contract-closeout.service';
import { CloseoutAttachmentStorageService } from './closeout-attachment-storage.service';
import { ContractScheduleService } from './contract-schedule.service';
import { ContractSchedulePlanService } from './contract-schedule-plan.service';
import { ContractScheduleOverviewService } from './contract-schedule-overview.service';
import { ContractDashboardService } from './contract-dashboard.service';
import { ContractsController } from './contracts.controller';

@Module({
  imports: [DatabaseModule, AuthModule, DepartmentAccessModule],
  providers: [
    ContractsRefService,
    ContractsService,
    ContractPaymentsService,
    ContractBoqProductionService,
    ContractVariationsService,
    ContractRisksService,
    VariationAttachmentStorageService,
    ContractDocumentObligationsService,
    DocumentObligationAttachmentStorageService,
    ContractAttachmentsService,
    ContractWorkflowService,
    WorkflowAttachmentStorageService,
    ContractIssuesService,
    ContractClaimsService,
    ContractCloseoutService,
    CloseoutAttachmentStorageService,
    ContractScheduleService,
    ContractSchedulePlanService,
    ContractScheduleOverviewService,
    ContractDashboardService,
  ],
  controllers: [ContractsController],
})
export class ContractsModule {}
