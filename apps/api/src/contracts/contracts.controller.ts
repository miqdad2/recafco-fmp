import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
  UnprocessableEntityException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ContractsService } from './contracts.service';
import { ContractPaymentsService } from './contract-payments.service';
import { ContractBoqProductionService } from './contract-boq-production.service';
import { ContractVariationsService } from './contract-variations.service';
import { ContractRisksService } from './contract-risks.service';
import {
  VariationAttachmentStorageService,
  VARIATION_ATTACHMENT_MAX_BYTES,
  VARIATION_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './variation-attachment-storage.service';
import { ContractDocumentObligationsService } from './contract-document-obligations.service';
import {
  DocumentObligationAttachmentStorageService,
  DOCUMENT_OBLIGATION_ATTACHMENT_MAX_BYTES,
  DOCUMENT_OBLIGATION_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './document-obligation-attachment-storage.service';
import { ContractAttachmentsService } from './contract-attachments.service';
import { ContractWorkflowService } from './contract-workflow.service';
import {
  WorkflowAttachmentStorageService,
  WORKFLOW_ATTACHMENT_MAX_BYTES,
  WORKFLOW_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './workflow-attachment-storage.service';
import { ContractIssuesService } from './contract-issues.service';
import { ContractClaimsService } from './contract-claims.service';
import { ContractCloseoutService } from './contract-closeout.service';
import {
  CloseoutAttachmentStorageService,
  CLOSEOUT_ATTACHMENT_MAX_BYTES,
  CLOSEOUT_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './closeout-attachment-storage.service';
import { ContractScheduleService } from './contract-schedule.service';
import { ContractSchedulePlanService } from './contract-schedule-plan.service';
import { ContractScheduleOverviewService } from './contract-schedule-overview.service';
import { ContractDashboardService } from './contract-dashboard.service';
import { ContractErectionDashboardService } from './contract-erection-dashboard.service';
import { ContractErectionMethodStatementService } from './contract-erection-method-statement.service';
import {
  ErectionMethodStatementAttachmentStorageService,
  ERECTION_METHOD_STATEMENT_ATTACHMENT_MAX_BYTES,
  ERECTION_METHOD_STATEMENT_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './erection-method-statement-attachment-storage.service';
import { ContractErectionMethodStatementApprovalService } from './contract-erection-method-statement-approval.service';
import {
  ErectionMethodStatementApprovalAttachmentStorageService,
  ERECTION_METHOD_STATEMENT_APPROVAL_ATTACHMENT_MAX_BYTES,
  ERECTION_METHOD_STATEMENT_APPROVAL_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './erection-method-statement-approval-attachment-storage.service';
import { ContractErectionScheduleService } from './contract-erection-schedule.service';
import {
  ErectionScheduleAttachmentStorageService,
  ERECTION_SCHEDULE_ATTACHMENT_MAX_BYTES,
  ERECTION_SCHEDULE_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './erection-schedule-attachment-storage.service';
import { ContractErectionDeliveryStartService } from './contract-erection-delivery-start.service';
import {
  ErectionDeliveryStartAttachmentStorageService,
  ERECTION_DELIVERY_START_ATTACHMENT_MAX_BYTES,
  ERECTION_DELIVERY_START_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './erection-delivery-start-attachment-storage.service';
import { ContractErectionStartService } from './contract-erection-start.service';
import {
  ErectionStartAttachmentStorageService,
  ERECTION_START_ATTACHMENT_MAX_BYTES,
  ERECTION_START_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './erection-start-attachment-storage.service';
import { ContractErectionChecklistService } from './contract-erection-checklist.service';
import {
  ErectionChecklistAttachmentStorageService,
  ERECTION_CHECKLIST_ATTACHMENT_MAX_BYTES,
  ERECTION_CHECKLIST_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './erection-checklist-attachment-storage.service';
import { ContractErectionWorkflowAssignmentService } from './contract-erection-workflow-assignment.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractListQueryDto } from './dto/contract-list-query.dto';
import { ActivateContractDto } from './dto/activate-contract.dto';
import { TerminateContractDto } from './dto/terminate-contract.dto';
import { CancelContractDto } from './dto/cancel-contract.dto';
import { CloseContractDto } from './dto/close-contract.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { UpdateContractScheduleStatusDto } from './dto/update-contract-schedule-status.dto';
import { CreateContractPaymentDto } from './dto/create-contract-payment.dto';
import { UpdateContractPaymentDto } from './dto/update-contract-payment.dto';
import { ContractPaymentListQueryDto } from './dto/contract-payment-list-query.dto';
import { UpdateContractBoqItemProductionDto } from './dto/update-contract-boq-item-production.dto';
import { CreateContractVariationDto } from './dto/create-contract-variation.dto';
import { UpdateContractVariationDto } from './dto/update-contract-variation.dto';
import { CreateContractRiskDto } from './dto/create-contract-risk.dto';
import { UpdateContractRiskDto } from './dto/update-contract-risk.dto';
import { CreateContractDocumentObligationDto } from './dto/create-contract-document-obligation.dto';
import { UpdateContractDocumentObligationDto } from './dto/update-contract-document-obligation.dto';
import { UpdateContractWorkflowTaskDto } from './dto/update-contract-workflow-task.dto';
import { ContractWorkflowListQueryDto } from './dto/contract-workflow-list-query.dto';
import { ContractWorkflowAssignmentQueueQueryDto } from './dto/contract-workflow-assignment-queue-query.dto';
import { GetContractWorkflowQueryDto } from './dto/get-contract-workflow-query.dto';
import { CreateContractWorkflowTaskCommentDto } from './dto/create-contract-workflow-task-comment.dto';
import { CreateContractIssueDto } from './dto/create-contract-issue.dto';
import { UpdateContractIssueDto } from './dto/update-contract-issue.dto';
import { ContractIssueListQueryDto } from './dto/contract-issue-list-query.dto';
import { CreateContractClaimDto } from './dto/create-contract-claim.dto';
import { UpdateContractClaimDto } from './dto/update-contract-claim.dto';
import { CloseContractClaimDto } from './dto/close-contract-claim.dto';
import { ContractClaimListQueryDto } from './dto/contract-claim-list-query.dto';
import { CreateContractCloseoutRequestDto } from './dto/create-contract-closeout-request.dto';
import { UpdateContractCloseoutRequestDto } from './dto/update-contract-closeout-request.dto';
import { ReviewContractCloseoutRequestDto } from './dto/review-contract-closeout-request.dto';
import { RejectContractCloseoutRequestDto } from './dto/reject-contract-closeout-request.dto';
import { ContractScheduleListQueryDto } from './dto/contract-schedule-list-query.dto';
import { UpdateContractSchedulePlanDto } from './dto/update-contract-schedule-plan.dto';
import { ContractCloseoutListQueryDto } from './dto/contract-closeout-list-query.dto';
import { CreateContractErectionMethodStatementDto } from './dto/create-contract-erection-method-statement.dto';
import { UpdateContractErectionMethodStatementDto } from './dto/update-contract-erection-method-statement.dto';
import { CreateContractErectionMethodStatementApprovalDto } from './dto/create-contract-erection-method-statement-approval.dto';
import { UpdateContractErectionMethodStatementApprovalDto } from './dto/update-contract-erection-method-statement-approval.dto';
import { CreateContractErectionScheduleDto } from './dto/create-contract-erection-schedule.dto';
import { UpdateContractErectionScheduleDto } from './dto/update-contract-erection-schedule.dto';
import { CreateContractErectionDeliveryStartDto } from './dto/create-contract-erection-delivery-start.dto';
import { UpdateContractErectionDeliveryStartDto } from './dto/update-contract-erection-delivery-start.dto';
import { CreateContractErectionStartDto } from './dto/create-contract-erection-start.dto';
import { UpdateContractErectionStartDto } from './dto/update-contract-erection-start.dto';
import { CreateContractErectionChecklistDto } from './dto/create-contract-erection-checklist.dto';
import { UpdateContractErectionChecklistDto } from './dto/update-contract-erection-checklist.dto';
import { AssignContractErectionWorkflowDto } from './dto/assign-contract-erection-workflow.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AnyPermission } from '../common/decorators/any-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import type { AuthUser } from '../common/types/auth-user';

/** Minimal shape we need from a multer-parsed upload — avoids depending on @types/multer's global Express.Multer.File augmentation, which isn't installed in this project. */
interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

function meta(): { requestId?: string } {
  const id = getRequestId();
  return id !== undefined ? { requestId: id } : {};
}

@Controller('contracts')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly contractPaymentsService: ContractPaymentsService,
    private readonly contractBoqProductionService: ContractBoqProductionService,
    private readonly contractVariationsService: ContractVariationsService,
    private readonly contractRisksService: ContractRisksService,
    private readonly variationAttachmentStorage: VariationAttachmentStorageService,
    private readonly contractDocumentObligationsService: ContractDocumentObligationsService,
    private readonly documentObligationAttachmentStorage: DocumentObligationAttachmentStorageService,
    private readonly contractAttachmentsService: ContractAttachmentsService,
    private readonly contractWorkflowService: ContractWorkflowService,
    private readonly contractIssuesService: ContractIssuesService,
    private readonly contractClaimsService: ContractClaimsService,
    private readonly workflowAttachmentStorage: WorkflowAttachmentStorageService,
    private readonly contractCloseoutService: ContractCloseoutService,
    private readonly closeoutAttachmentStorage: CloseoutAttachmentStorageService,
    private readonly contractScheduleService: ContractScheduleService,
    private readonly contractSchedulePlanService: ContractSchedulePlanService,
    private readonly contractScheduleOverviewService: ContractScheduleOverviewService,
    private readonly contractDashboardService: ContractDashboardService,
    private readonly contractErectionDashboardService: ContractErectionDashboardService,
    private readonly contractErectionMethodStatementService: ContractErectionMethodStatementService,
    private readonly erectionMethodStatementAttachmentStorage: ErectionMethodStatementAttachmentStorageService,
    private readonly contractErectionMethodStatementApprovalService: ContractErectionMethodStatementApprovalService,
    private readonly erectionMethodStatementApprovalAttachmentStorage: ErectionMethodStatementApprovalAttachmentStorageService,
    private readonly contractErectionScheduleService: ContractErectionScheduleService,
    private readonly erectionScheduleAttachmentStorage: ErectionScheduleAttachmentStorageService,
    private readonly contractErectionDeliveryStartService: ContractErectionDeliveryStartService,
    private readonly erectionDeliveryStartAttachmentStorage: ErectionDeliveryStartAttachmentStorageService,
    private readonly contractErectionStartService: ContractErectionStartService,
    private readonly erectionStartAttachmentStorage: ErectionStartAttachmentStorageService,
    private readonly contractErectionChecklistService: ContractErectionChecklistService,
    private readonly contractErectionWorkflowAssignmentService: ContractErectionWorkflowAssignmentService,
    private readonly erectionChecklistAttachmentStorage: ErectionChecklistAttachmentStorageService,
  ) {}

  // summary and people MUST be declared before /:id to avoid route conflict

  @Get('summary')
  @Permissions('contracts.read')
  async summary(
    @Query() query: ContractListQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    // CM-69I — same query shape as the list() route below, so the KPI cards
    // are always computed over the identical filtered scope as the table.
    const data = await this.contractsService.getSummary(actor, query);
    return { data, meta: meta(), error: null };
  }

  @Get('dashboard')
  @Permissions('contracts.read')
  async dashboard(
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractDashboardService.getDashboard(actor);
    return { data, meta: meta(), error: null };
  }

  // CM-71B — Erection Manager Dashboard / Work Queue. 2 literal segments,
  // so this can never collide with the single-param ':id' route regardless
  // of declaration order (unlike 'summary'/'people'/'dashboard' above,
  // which are exactly 1 segment and do need to stay declared before ':id').
  @Get('erection/dashboard')
  @Permissions('contracts.read')
  async erectionDashboard(
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionDashboardService.getDashboard(actor);
    return { data, meta: meta(), error: null };
  }

  @Get('people')
  @Permissions('contracts.read')
  async people(
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractsService.listPeople(actor);
    return { data, meta: meta(), error: null };
  }

  @Get('departments')
  @Permissions('contracts.read')
  async departments(
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractsService.listDepartments(actor);
    return { data, meta: meta(), error: null };
  }

  @Get('plants')
  @Permissions('contracts.read')
  async plants(
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractsService.listPlants(actor);
    return { data, meta: meta(), error: null };
  }

  @Get('locations')
  @Permissions('contracts.read')
  async locations(
    @Query('plantId') plantId: string | undefined,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractsService.listLocations(actor, plantId);
    return { data, meta: meta(), error: null };
  }

  @Get()
  @Permissions('contracts.read')
  async list(
    @Query() query: ContractListQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const result = await this.contractsService.findAll(query, actor);
    return { data: result, meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @Permissions('contracts.create')
  async create(
    @Body() dto: CreateContractDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const contract = await this.contractsService.create(dto, actor);
    return { data: contract, meta: meta(), error: null };
  }

  // payments MUST be declared before /:id to avoid route conflict (same reason
  // summary/people/etc. are declared above) — this is the module-level payments
  // register (all contracts), distinct from a single contract's own payments.
  @Get('payments')
  @Permissions('contracts.read')
  async listPayments(
    @Query() query: ContractPaymentListQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const result = await this.contractPaymentsService.findAll(query, actor);
    return { data: result, meta: meta(), error: null };
  }

  // workflow MUST be declared before /:id to avoid route conflict (same reason
  // summary/people/payments are declared above) — this is the module-level
  // workflow register (all contracts), distinct from a single contract's own
  // workflow board.
  @Get('workflow')
  @Permissions('contracts.read')
  async listWorkflow(
    @Query() query: ContractWorkflowListQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const result = await this.contractWorkflowService.findAll(query, actor);
    return { data: result, meta: meta(), error: null };
  }

  // CM-40 — 2 literal path segments (workflow/assignment-queue), cannot
  // collide with ':id' (1 segment) or ':id/workflow' (var+literal) regardless
  // of declaration order — same reasoning as the workflow/tasks/:taskId
  // routes below. Manager-only (contracts.update): the module-level list of
  // unassigned workflow tasks a Contract Manager needs to assign.
  @Get('workflow/assignment-queue')
  @Permissions('contracts.update')
  async getWorkflowAssignmentQueue(
    @Query() query: ContractWorkflowAssignmentQueueQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const result = await this.contractWorkflowService.findAssignmentQueue(query, actor);
    return { data: result, meta: meta(), error: null };
  }

  // issues MUST be declared before /:id to avoid route conflict (same reason
  // summary/people/payments/workflow are declared above) — this is the
  // module-level issue register (all contracts), distinct from a single
  // contract's own issue log.
  @Get('issues')
  @Permissions('contracts.read')
  async listIssues(
    @Query() query: ContractIssueListQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const result = await this.contractIssuesService.findAll(query, actor);
    return { data: result, meta: meta(), error: null };
  }

  // claims MUST be declared before /:id to avoid route conflict (same reason
  // summary/people/payments/workflow/issues are declared above) — this is the
  // module-level claim register (all contracts), distinct from a single
  // contract's own Claims Registry tab.
  @Get('claims')
  @Permissions('contracts.read')
  async listClaims(
    @Query() query: ContractClaimListQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const result = await this.contractClaimsService.findAll(query, actor);
    return { data: result, meta: meta(), error: null };
  }

  // CM-68B — schedule/overview MUST be declared before both 'schedule' and
  // /:id (same route-conflict reason as summary/people/payments/workflow/
  // issues/claims/schedule below) — the global, all-contract Planned vs
  // Actual overview (reuses CM-68A's per-contract derivation, computed for
  // every department-scoped contract), distinct from BOTH the due-date
  // register below and a single contract's own schedule tab.
  @Get('schedule/overview')
  @Permissions('contracts.read')
  async getContractScheduleOverview(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractScheduleOverviewService.getOverview(actor);
    return { data, meta: meta(), error: null };
  }

  // schedule MUST be declared before /:id to avoid route conflict (same
  // reason summary/people/payments/workflow/issues/claims are declared
  // above) — this is the module-level, read-only schedule aggregation (all
  // contracts), distinct from a single contract's own schedule tab.
  @Get('schedule')
  @Permissions('contracts.read')
  async listSchedule(
    @Query() query: ContractScheduleListQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const result = await this.contractScheduleService.findAll(query, actor);
    return { data: result, meta: meta(), error: null };
  }

  // closeouts (plural — distinct literal from the singular 'closeout' segment
  // used by the per-request routes below) MUST be declared before /:id to
  // avoid route conflict (same reason summary/people/payments/workflow/
  // issues/claims/schedule are declared above) — this is the module-level
  // Closeout Requests register (all contracts), distinct from a single
  // contract's own Closeout tab.
  @Get('closeouts')
  @Permissions('contracts.read')
  async listCloseouts(
    @Query() query: ContractCloseoutListQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const result = await this.contractCloseoutService.findAll(query, actor);
    return { data: result, meta: meta(), error: null };
  }

  @Get(':id')
  @Permissions('contracts.read')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const contract = await this.contractsService.findOne(id, actor);
    return { data: contract, meta: meta(), error: null };
  }

  @Patch(':id')
  @Permissions('contracts.update')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateContractDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const contract = await this.contractsService.update(id, dto, actor);
    return { data: contract, meta: meta(), error: null };
  }

  // CM-55 — manager-facing schedule/progress status (Contract List Status
  // column). Independent of update() above: no DRAFT-only gate, never
  // touches Contract.status/lifecycle, never interacts with closeout.
  @Patch(':id/schedule-status')
  @Permissions('contracts.update')
  async updateScheduleStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateContractScheduleStatusDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const contract = await this.contractsService.updateScheduleStatus(id, dto, actor);
    return { data: contract, meta: meta(), error: null };
  }

  @Post(':id/activate')
  @HttpCode(200)
  @Permissions('contracts.activate')
  async activate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ActivateContractDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const contract = await this.contractsService.activate(id, dto, actor);
    return { data: contract, meta: meta(), error: null };
  }

  @Post(':id/terminate')
  @HttpCode(200)
  @Permissions('contracts.terminate')
  async terminate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: TerminateContractDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const contract = await this.contractsService.terminate(id, dto, actor);
    return { data: contract, meta: meta(), error: null };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @AnyPermission('contracts.update', 'contracts.manage')
  async cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CancelContractDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const contract = await this.contractsService.cancel(id, dto, actor);
    return { data: contract, meta: meta(), error: null };
  }

  @Post(':id/close')
  @HttpCode(200)
  @Permissions('contracts.close')
  async close(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CloseContractDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const contract = await this.contractsService.close(id, dto, actor);
    return { data: contract, meta: meta(), error: null };
  }

  @Get(':id/comments')
  @Permissions('contracts.read')
  async listComments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const comments = await this.contractsService.listComments(id, actor);
    return { data: comments, meta: meta(), error: null };
  }

  @Post(':id/comments')
  @HttpCode(201)
  @Permissions('contracts.comment')
  async addComment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const comment = await this.contractsService.addComment(id, dto, actor);
    return { data: comment, meta: meta(), error: null };
  }

  @Get(':id/activities')
  @Permissions('contracts.read')
  async listActivities(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const activities = await this.contractsService.listActivities(id, actor);
    return { data: activities, meta: meta(), error: null };
  }

  @Post(':id/payments')
  @HttpCode(201)
  @Permissions('contracts.update')
  async createPayment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateContractPaymentDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const payment = await this.contractPaymentsService.create(id, dto, actor);
    return { data: payment, meta: meta(), error: null };
  }

  // 2 path segments (payments/:paymentId) — cannot collide with the 1-segment
  // ':id' pattern above regardless of declaration order.
  @Patch('payments/:paymentId')
  @Permissions('contracts.update')
  async updatePayment(
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
    @Body() dto: UpdateContractPaymentDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const payment = await this.contractPaymentsService.update(paymentId, dto, actor);
    return { data: payment, meta: meta(), error: null };
  }

  @Get(':id/workflow')
  @Permissions('contracts.read')
  async getWorkflow(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: GetContractWorkflowQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractWorkflowService.getWorkflowForContract(id, actor, query.myTasksOnly);
    return { data, meta: meta(), error: null };
  }

  // CM-57 — read-only per-team task counts for the Contract Detail Overview's
  // Progress/Production summary cards. Deliberately a separate endpoint from
  // GET :id/workflow above, which lazily generates the default task set on
  // first view — Overview must never trigger that as a side effect of simply
  // being opened.
  @Get(':id/workflow-summary')
  @Permissions('contracts.read')
  async getWorkflowSummary(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractWorkflowService.getWorkflowSummaryForContract(id, actor);
    return { data, meta: meta(), error: null };
  }

  // CM-68A — replaces the old CM-34 due-date aggregation for the per-contract
  // tab (findAllForContract below is now unused/removed — this was its only
  // real consumer, confirmed via audit) with the real Planned vs Actual
  // schedule detail. The module-level register (GET /contracts/schedule,
  // findAll() below) is untouched — a separate CM-68B unit's concern.
  @Get(':id/schedule')
  @Permissions('contracts.read')
  async getContractSchedule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractSchedulePlanService.getScheduleDetail(id, actor);
    return { data, meta: meta(), error: null };
  }

  @Patch(':id/schedule/planned')
  @Permissions('contracts.update')
  async updateContractSchedulePlan(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateContractSchedulePlanDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractSchedulePlanService.updatePlan(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // CM-59 — Production Status is manually tracked inside Contract Management
  // (no Production Module integration exists); one contract-scoped, read-only
  // list of BOQ items + their production tracking, mirroring the `:id/schedule`
  // pattern above (unpaginated, contract-scoped, no query DTO needed).
  @Get(':id/production')
  @Permissions('contracts.read')
  async getContractProduction(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractBoqProductionService.findAllForContract(id, actor);
    return { data, meta: meta(), error: null };
  }

  // 2 path segments (production/:itemId) — cannot collide with the 1-segment
  // ':id' pattern above regardless of declaration order, same reasoning as
  // 'payments/:paymentId'. :itemId is a ContractBoqItem id, not a contract id
  // — production tracking is upserted per BOQ item.
  @Patch('production/:itemId')
  @Permissions('contracts.update')
  async updateContractProduction(
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Body() dto: UpdateContractBoqItemProductionDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractBoqProductionService.upsertForItem(itemId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // CM-60 — Variations / Change Orders. Contract-scoped, unpaginated, same
  // pattern as :id/schedule and :id/production above — no module-level
  // Variations register exists (or is requested) in this unit.
  @Get(':id/variations')
  @Permissions('contracts.read')
  async getContractVariations(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractVariationsService.findAllForContract(id, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/variations')
  @HttpCode(201)
  @Permissions('contracts.update')
  async createContractVariation(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateContractVariationDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractVariationsService.create(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // 2 path segments (variations/:variationId) — cannot collide with the
  // 1-segment ':id' pattern above, same reasoning as 'payments/:paymentId'
  // and 'production/:itemId'.
  @Patch('variations/:variationId')
  @Permissions('contracts.update')
  async updateContractVariation(
    @Param('variationId', new ParseUUIDPipe({ version: '4' })) variationId: string,
    @Body() dto: UpdateContractVariationDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractVariationsService.update(variationId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // CM-60C — Variation supporting documents. Nested under :id (contract) AND
  // :variationId so the service can verify the variation actually belongs to
  // that exact contract, not just that variationId resolves to some
  // variation — see ContractVariationsService.loadVariationForContract().
  @Get(':id/variations/:variationId/attachments')
  @Permissions('contracts.read')
  async listVariationAttachments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('variationId', new ParseUUIDPipe({ version: '4' })) variationId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractVariationsService.listAttachments(id, variationId, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/variations/:variationId/attachments')
  @HttpCode(201)
  @Permissions('contracts.update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: VARIATION_ATTACHMENT_MAX_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!(VARIATION_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
          callback(
            new UnprocessableEntityException({
              code: 'CONTRACT_VARIATION_ATTACHMENT_INVALID_TYPE',
              message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadVariationAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('variationId', new ParseUUIDPipe({ version: '4' })) variationId: string,
    @UploadedFile() file: UploadedFileLike,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractVariationsService.createAttachment(id, variationId, file, actor);
    return { data, meta: meta(), error: null };
  }

  // 6 path segments — cannot collide with any shorter route regardless of
  // declaration order, same reasoning as the workflow task attachment routes.
  @Get(':id/variations/:variationId/attachments/:attachmentId/download')
  @Permissions('contracts.read')
  async downloadVariationAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('variationId', new ParseUUIDPipe({ version: '4' })) variationId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalFileName, mimeType } = await this.contractVariationsService.getAttachmentForDownload(
      id,
      variationId,
      attachmentId,
      actor,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(this.variationAttachmentStorage.createReadStream(storagePath));
  }

  // CM-60C — read-only aggregation across the 3 existing attachment tables
  // (workflow task, closeout, variation) for the contract's own Attachments
  // tab. No new upload path — each source keeps its own real upload flow;
  // this only lists what already exists with a real download link into that
  // source's own already-scoped download endpoint.
  @Get(':id/attachments')
  @Permissions('contracts.read')
  async getContractAttachments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractAttachmentsService.listAllForContract(id, actor);
    return { data, meta: meta(), error: null };
  }

  // CM-62 — Risk Assessment. Contract-scoped, unpaginated, same pattern as
  // :id/schedule, :id/production, :id/variations above — no module-level
  // Risk register exists (or is requested) in this unit.
  @Get(':id/risks')
  @Permissions('contracts.read')
  async getContractRisks(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractRisksService.findAllForContract(id, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/risks')
  @HttpCode(201)
  @Permissions('contracts.update')
  async createContractRisk(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateContractRiskDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractRisksService.create(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // 2 path segments (risks/:riskId) — cannot collide with the 1-segment
  // ':id' pattern above, same reasoning as 'variations/:variationId'.
  @Patch('risks/:riskId')
  @Permissions('contracts.update')
  async updateContractRisk(
    @Param('riskId', new ParseUUIDPipe({ version: '4' })) riskId: string,
    @Body() dto: UpdateContractRiskDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractRisksService.update(riskId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // CM-63 — Documents & Obligations. Contract-scoped, unpaginated, same
  // pattern as :id/risks/:id/variations above — no module-level register
  // exists (or is requested) in this unit.
  @Get(':id/document-obligations')
  @Permissions('contracts.read')
  async getContractDocumentObligations(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractDocumentObligationsService.findAllForContract(id, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/document-obligations')
  @HttpCode(201)
  @Permissions('contracts.update')
  async createContractDocumentObligation(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateContractDocumentObligationDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractDocumentObligationsService.create(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // 2 path segments (document-obligations/:itemId) — cannot collide with the
  // 1-segment ':id' pattern above, same reasoning as 'risks/:riskId'.
  @Patch('document-obligations/:itemId')
  @Permissions('contracts.update')
  async updateContractDocumentObligation(
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Body() dto: UpdateContractDocumentObligationDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractDocumentObligationsService.update(itemId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // CM-63 — Documents & Obligations supporting files. Nested under :id
  // (contract) AND :itemId so the service can verify the item actually
  // belongs to that exact contract, same reasoning as the variation
  // attachment routes above.
  @Get(':id/document-obligations/:itemId/attachments')
  @Permissions('contracts.read')
  async listDocumentObligationAttachments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractDocumentObligationsService.listAttachments(id, itemId, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/document-obligations/:itemId/attachments')
  @HttpCode(201)
  @Permissions('contracts.update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: DOCUMENT_OBLIGATION_ATTACHMENT_MAX_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!(DOCUMENT_OBLIGATION_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
          callback(
            new UnprocessableEntityException({
              code: 'CONTRACT_DOCUMENT_OBLIGATION_ATTACHMENT_INVALID_TYPE',
              message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadDocumentObligationAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @UploadedFile() file: UploadedFileLike,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractDocumentObligationsService.createAttachment(id, itemId, file, actor);
    return { data, meta: meta(), error: null };
  }

  // 6 path segments — cannot collide with any shorter route regardless of
  // declaration order, same reasoning as the variation attachment routes.
  @Get(':id/document-obligations/:itemId/attachments/:attachmentId/download')
  @Permissions('contracts.read')
  async downloadDocumentObligationAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalFileName, mimeType } = await this.contractDocumentObligationsService.getAttachmentForDownload(
      id,
      itemId,
      attachmentId,
      actor,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(this.documentObligationAttachmentStorage.createReadStream(storagePath));
  }

  @Post(':id/workflow/regenerate')
  @HttpCode(200)
  @Permissions('contracts.update')
  async regenerateWorkflow(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractWorkflowService.regenerate(id, actor);
    return { data, meta: meta(), error: null };
  }

  // 3 path segments (workflow/tasks/:taskId) — cannot collide with ':id' or
  // ':id/workflow' regardless of declaration order.
  // Manager (contracts.update) or staff (contracts.workflow_update, own
  // assigned task only — enforced in ContractWorkflowService) may update.
  @Patch('workflow/tasks/:taskId')
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  async updateWorkflowTask(
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @Body() dto: UpdateContractWorkflowTaskDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractWorkflowService.updateTask(taskId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // 4 path segments (workflow/tasks/:taskId/comments) — cannot collide with
  // any shorter workflow route regardless of declaration order.
  @Get('workflow/tasks/:taskId/comments')
  @Permissions('contracts.read')
  async listWorkflowTaskComments(
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractWorkflowService.listComments(taskId, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('workflow/tasks/:taskId/comments')
  @HttpCode(201)
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  async addWorkflowTaskComment(
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @Body() dto: CreateContractWorkflowTaskCommentDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractWorkflowService.addComment(taskId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Get('workflow/tasks/:taskId/attachments')
  @Permissions('contracts.read')
  async listWorkflowTaskAttachments(
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractWorkflowService.listAttachments(taskId, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('workflow/tasks/:taskId/attachments')
  @HttpCode(201)
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: WORKFLOW_ATTACHMENT_MAX_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!(WORKFLOW_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
          callback(
            new UnprocessableEntityException({
              code: 'CONTRACT_WORKFLOW_ATTACHMENT_INVALID_TYPE',
              message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadWorkflowTaskAttachment(
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @UploadedFile() file: UploadedFileLike,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractWorkflowService.createAttachment(taskId, file, actor);
    return { data, meta: meta(), error: null };
  }

  // 5 path segments (workflow/tasks/:taskId/attachments/:attachmentId/download).
  @Get('workflow/tasks/:taskId/attachments/:attachmentId/download')
  @Permissions('contracts.read')
  async downloadWorkflowTaskAttachment(
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalFileName, mimeType } = await this.contractWorkflowService.getAttachmentForDownload(
      taskId,
      attachmentId,
      actor,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(this.workflowAttachmentStorage.createReadStream(storagePath));
  }

  @Post(':id/issues')
  @HttpCode(201)
  @Permissions('contracts.update')
  async createIssue(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateContractIssueDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const issue = await this.contractIssuesService.create(id, dto, actor);
    return { data: issue, meta: meta(), error: null };
  }

  // 2 path segments (issues/:issueId) — cannot collide with the 1-segment
  // ':id' pattern above regardless of declaration order.
  @Patch('issues/:issueId')
  @Permissions('contracts.update')
  async updateIssue(
    @Param('issueId', new ParseUUIDPipe({ version: '4' })) issueId: string,
    @Body() dto: UpdateContractIssueDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const issue = await this.contractIssuesService.update(issueId, dto, actor);
    return { data: issue, meta: meta(), error: null };
  }

  // 3 path segments (issues/:issueId/close) — cannot collide with
  // 'issues/:issueId' regardless of declaration order.
  @Patch('issues/:issueId/close')
  @Permissions('contracts.update')
  async closeIssue(
    @Param('issueId', new ParseUUIDPipe({ version: '4' })) issueId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const issue = await this.contractIssuesService.close(issueId, actor);
    return { data: issue, meta: meta(), error: null };
  }

  @Post(':id/claims')
  @HttpCode(201)
  @Permissions('contracts.update')
  async createClaim(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateContractClaimDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const claim = await this.contractClaimsService.create(id, dto, actor);
    return { data: claim, meta: meta(), error: null };
  }

  // 2 path segments (claims/:claimId) — cannot collide with the 1-segment
  // ':id' pattern above regardless of declaration order.
  @Patch('claims/:claimId')
  @Permissions('contracts.update')
  async updateClaim(
    @Param('claimId', new ParseUUIDPipe({ version: '4' })) claimId: string,
    @Body() dto: UpdateContractClaimDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const claim = await this.contractClaimsService.update(claimId, dto, actor);
    return { data: claim, meta: meta(), error: null };
  }

  // 3 path segments (claims/:claimId/close) — cannot collide with
  // 'claims/:claimId' regardless of declaration order.
  @Patch('claims/:claimId/close')
  @Permissions('contracts.update')
  async closeClaim(
    @Param('claimId', new ParseUUIDPipe({ version: '4' })) claimId: string,
    @Body() dto: CloseContractClaimDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const claim = await this.contractClaimsService.close(claimId, dto.status as 'CLOSED' | 'SETTLED' | undefined, actor);
    return { data: claim, meta: meta(), error: null };
  }

  // ---------------------------------------------------------------------------
  // Contract Closeout Approval Flow (CM-33)
  // ---------------------------------------------------------------------------

  @Get(':id/closeout/checks')
  @Permissions('contracts.read')
  async getCloseoutChecks(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractCloseoutService.getCloseoutChecks(id, actor);
    return { data, meta: meta(), error: null };
  }

  @Get(':id/closeout')
  @Permissions('contracts.read')
  async listCloseoutRequests(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractCloseoutService.listRequests(id, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/closeout/request')
  @HttpCode(201)
  @Permissions('contracts.update')
  async createCloseoutRequest(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateContractCloseoutRequestDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractCloseoutService.createRequest(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // 'closeout/:requestId' (2 segments, literal-then-param) never collides
  // with ':id/<literal>' (2 segments, param-then-literal) routes above —
  // the two patterns differ in which position is the wildcard, so no
  // incoming path can ambiguously match both regardless of declaration order.
  @Patch('closeout/:requestId')
  @Permissions('contracts.update')
  async updateCloseoutRequest(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
    @Body() dto: UpdateContractCloseoutRequestDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractCloseoutService.updateRequest(requestId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('closeout/:requestId/review')
  @HttpCode(200)
  @Permissions('contracts.close')
  async reviewCloseoutRequest(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
    @Body() dto: ReviewContractCloseoutRequestDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractCloseoutService.review(requestId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('closeout/:requestId/approve')
  @HttpCode(200)
  @Permissions('contracts.close')
  async approveCloseoutRequest(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
    @Body() dto: ReviewContractCloseoutRequestDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractCloseoutService.approve(requestId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('closeout/:requestId/reject')
  @HttpCode(200)
  @Permissions('contracts.close')
  async rejectCloseoutRequest(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
    @Body() dto: RejectContractCloseoutRequestDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractCloseoutService.reject(requestId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('closeout/:requestId/close-contract')
  @HttpCode(200)
  @Permissions('contracts.close')
  async closeContractFromCloseout(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractCloseoutService.closeContract(requestId, actor);
    return { data, meta: meta(), error: null };
  }

  @Get('closeout/:requestId/attachments')
  @Permissions('contracts.read')
  async listCloseoutAttachments(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractCloseoutService.listAttachments(requestId, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('closeout/:requestId/attachments')
  @HttpCode(201)
  @Permissions('contracts.update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: CLOSEOUT_ATTACHMENT_MAX_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!(CLOSEOUT_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
          callback(
            new UnprocessableEntityException({
              code: 'CONTRACT_CLOSEOUT_ATTACHMENT_INVALID_TYPE',
              message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadCloseoutAttachment(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
    @UploadedFile() file: UploadedFileLike,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractCloseoutService.createAttachment(requestId, file, actor);
    return { data, meta: meta(), error: null };
  }

  // 4 path segments (closeout/:requestId/attachments/:attachmentId/download).
  @Get('closeout/:requestId/attachments/:attachmentId/download')
  @Permissions('contracts.read')
  async downloadCloseoutAttachment(
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalFileName, mimeType } = await this.contractCloseoutService.getAttachmentForDownload(
      requestId,
      attachmentId,
      actor,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(this.closeoutAttachmentStorage.createReadStream(storagePath));
  }

  // ---------------------------------------------------------------------------
  // CM-71A — Erection Workflow, Step 1: Issue Erection Method Statement.
  // Contract-scoped, one record per contract (contractId is unique — see
  // ContractErectionMethodStatementService). GET returns null (200), never
  // 404, when nothing has been created yet for this contract.
  // ---------------------------------------------------------------------------

  @Get(':id/erection/method-statement')
  @Permissions('contracts.read')
  async getErectionMethodStatement(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown | null>> {
    const data = await this.contractErectionMethodStatementService.getForContract(id, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/erection/method-statement')
  @HttpCode(201)
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  async createErectionMethodStatement(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateContractErectionMethodStatementDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionMethodStatementService.create(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // 2 path segments (erection/method-statement/:statementId) — cannot
  // collide with the 1-segment ':id' pattern above, same reasoning as
  // 'variations/:variationId'.
  @Patch('erection/method-statement/:statementId')
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  async updateErectionMethodStatement(
    @Param('statementId', new ParseUUIDPipe({ version: '4' })) statementId: string,
    @Body() dto: UpdateContractErectionMethodStatementDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionMethodStatementService.update(statementId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // CM-71A — Erection Method Statement supporting documents. Nested under
  // :id (contract) AND :statementId so the service can verify the statement
  // actually belongs to that exact contract, matching the variation
  // attachment routes above.
  @Get(':id/erection/method-statement/:statementId/attachments')
  @Permissions('contracts.read')
  async listErectionMethodStatementAttachments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('statementId', new ParseUUIDPipe({ version: '4' })) statementId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractErectionMethodStatementService.listAttachments(id, statementId, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/erection/method-statement/:statementId/attachments')
  @HttpCode(201)
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: ERECTION_METHOD_STATEMENT_ATTACHMENT_MAX_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!(ERECTION_METHOD_STATEMENT_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
          callback(
            new UnprocessableEntityException({
              code: 'CONTRACT_ERECTION_METHOD_STATEMENT_ATTACHMENT_INVALID_TYPE',
              message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadErectionMethodStatementAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('statementId', new ParseUUIDPipe({ version: '4' })) statementId: string,
    @UploadedFile() file: UploadedFileLike,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionMethodStatementService.createAttachment(id, statementId, file, actor);
    return { data, meta: meta(), error: null };
  }

  // 6 path segments — cannot collide with any shorter route regardless of
  // declaration order, same reasoning as the variation attachment download route.
  @Get(':id/erection/method-statement/:statementId/attachments/:attachmentId/download')
  @Permissions('contracts.read')
  async downloadErectionMethodStatementAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('statementId', new ParseUUIDPipe({ version: '4' })) statementId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalFileName, mimeType } = await this.contractErectionMethodStatementService.getAttachmentForDownload(
      id,
      statementId,
      attachmentId,
      actor,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(this.erectionMethodStatementAttachmentStorage.createReadStream(storagePath));
  }

  @Delete(':id/erection/method-statement/:statementId/attachments/:attachmentId')
  @HttpCode(200)
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  async deleteErectionMethodStatementAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('statementId', new ParseUUIDPipe({ version: '4' })) statementId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<null>> {
    await this.contractErectionMethodStatementService.deleteAttachment(id, statementId, attachmentId, actor);
    return { data: null, meta: meta(), error: null };
  }

  // ---------------------------------------------------------------------------
  // CM-71C — Erection Workflow, Step 2: Erection Method Statement Approval.
  // At most one record per method statement (see the service's own doc
  // comment). GET returns null (200), never 404, when Step 1 or Step 2
  // simply hasn't happened yet.
  // ---------------------------------------------------------------------------

  @Get(':id/erection/method-statement/approval')
  @Permissions('contracts.read')
  async getErectionMethodStatementApproval(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown | null>> {
    const data = await this.contractErectionMethodStatementApprovalService.getForContract(id, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/erection/method-statement/approval')
  @HttpCode(201)
  @Permissions('contracts.update')
  async createErectionMethodStatementApproval(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateContractErectionMethodStatementApprovalDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionMethodStatementApprovalService.create(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // 3 literal segments (erection/method-statement/approval/:approvalId) —
  // cannot collide with ':id' or with CM-71A's own
  // 'erection/method-statement/:statementId' (different segment count),
  // same reasoning as every other nested-literal PATCH route in this file.
  @Patch('erection/method-statement/approval/:approvalId')
  @Permissions('contracts.update')
  async updateErectionMethodStatementApproval(
    @Param('approvalId', new ParseUUIDPipe({ version: '4' })) approvalId: string,
    @Body() dto: UpdateContractErectionMethodStatementApprovalDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionMethodStatementApprovalService.update(approvalId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // CM-71C — QA/QC review attachments. Nested under :id (contract) AND
  // :approvalId so the service can verify the approval actually belongs to
  // that exact contract, matching the method-statement attachment routes.
  @Get(':id/erection/method-statement/approval/:approvalId/attachments')
  @Permissions('contracts.read')
  async listErectionMethodStatementApprovalAttachments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('approvalId', new ParseUUIDPipe({ version: '4' })) approvalId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractErectionMethodStatementApprovalService.listAttachments(id, approvalId, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/erection/method-statement/approval/:approvalId/attachments')
  @HttpCode(201)
  @Permissions('contracts.update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: ERECTION_METHOD_STATEMENT_APPROVAL_ATTACHMENT_MAX_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!(ERECTION_METHOD_STATEMENT_APPROVAL_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
          callback(
            new UnprocessableEntityException({
              code: 'CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_ATTACHMENT_INVALID_TYPE',
              message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadErectionMethodStatementApprovalAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('approvalId', new ParseUUIDPipe({ version: '4' })) approvalId: string,
    @UploadedFile() file: UploadedFileLike,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionMethodStatementApprovalService.createAttachment(id, approvalId, file, actor);
    return { data, meta: meta(), error: null };
  }

  @Get(':id/erection/method-statement/approval/:approvalId/attachments/:attachmentId/download')
  @Permissions('contracts.read')
  async downloadErectionMethodStatementApprovalAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('approvalId', new ParseUUIDPipe({ version: '4' })) approvalId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalFileName, mimeType } = await this.contractErectionMethodStatementApprovalService.getAttachmentForDownload(
      id,
      approvalId,
      attachmentId,
      actor,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(this.erectionMethodStatementApprovalAttachmentStorage.createReadStream(storagePath));
  }

  @Delete(':id/erection/method-statement/approval/:approvalId/attachments/:attachmentId')
  @HttpCode(200)
  @Permissions('contracts.update')
  async deleteErectionMethodStatementApprovalAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('approvalId', new ParseUUIDPipe({ version: '4' })) approvalId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<null>> {
    await this.contractErectionMethodStatementApprovalService.deleteAttachment(id, approvalId, attachmentId, actor);
    return { data: null, meta: meta(), error: null };
  }

  // ---------------------------------------------------------------------------
  // CM-71D — Erection Workflow, Step 3: Issue Erection Schedule. At most one
  // record per contract (see the service's own doc comment). GET returns
  // null (200), never 404, when Step 3 simply hasn't happened yet.
  // ---------------------------------------------------------------------------

  @Get(':id/erection/schedule')
  @Permissions('contracts.read')
  async getErectionSchedule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown | null>> {
    const data = await this.contractErectionScheduleService.getForContract(id, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/erection/schedule')
  @HttpCode(201)
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  async createErectionSchedule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateContractErectionScheduleDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionScheduleService.create(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // 2 literal segments (erection/schedule/:scheduleId) — cannot collide
  // with ':id' or with any of the erection/method-statement... routes
  // (different literal second segment), same reasoning as every other
  // nested-literal PATCH route in this file.
  @Patch('erection/schedule/:scheduleId')
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  async updateErectionSchedule(
    @Param('scheduleId', new ParseUUIDPipe({ version: '4' })) scheduleId: string,
    @Body() dto: UpdateContractErectionScheduleDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionScheduleService.update(scheduleId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // CM-71D — Erection Schedule documents. Nested under :id (contract) AND
  // :scheduleId so the service can verify the schedule actually belongs to
  // that exact contract, matching the Step 1/Step 2 attachment routes.
  @Get(':id/erection/schedule/:scheduleId/attachments')
  @Permissions('contracts.read')
  async listErectionScheduleAttachments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('scheduleId', new ParseUUIDPipe({ version: '4' })) scheduleId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractErectionScheduleService.listAttachments(id, scheduleId, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/erection/schedule/:scheduleId/attachments')
  @HttpCode(201)
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: ERECTION_SCHEDULE_ATTACHMENT_MAX_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!(ERECTION_SCHEDULE_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
          callback(
            new UnprocessableEntityException({
              code: 'CONTRACT_ERECTION_SCHEDULE_ATTACHMENT_INVALID_TYPE',
              message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadErectionScheduleAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('scheduleId', new ParseUUIDPipe({ version: '4' })) scheduleId: string,
    @UploadedFile() file: UploadedFileLike,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionScheduleService.createAttachment(id, scheduleId, file, actor);
    return { data, meta: meta(), error: null };
  }

  @Get(':id/erection/schedule/:scheduleId/attachments/:attachmentId/download')
  @Permissions('contracts.read')
  async downloadErectionScheduleAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('scheduleId', new ParseUUIDPipe({ version: '4' })) scheduleId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalFileName, mimeType } = await this.contractErectionScheduleService.getAttachmentForDownload(
      id,
      scheduleId,
      attachmentId,
      actor,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(this.erectionScheduleAttachmentStorage.createReadStream(storagePath));
  }

  @Delete(':id/erection/schedule/:scheduleId/attachments/:attachmentId')
  @HttpCode(200)
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  async deleteErectionScheduleAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('scheduleId', new ParseUUIDPipe({ version: '4' })) scheduleId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<null>> {
    await this.contractErectionScheduleService.deleteAttachment(id, scheduleId, attachmentId, actor);
    return { data: null, meta: meta(), error: null };
  }

  // ---------------------------------------------------------------------------
  // CM-71E — Erection Workflow, Step 4: Delivery Start. Owned by the
  // Delivery / Logistics Team (see the service's own doc comment). At most
  // one record per contract. GET returns null (200), never 404, when
  // Step 4 simply hasn't happened yet.
  // ---------------------------------------------------------------------------

  @Get(':id/erection/delivery-start')
  @Permissions('contracts.read')
  async getErectionDeliveryStart(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown | null>> {
    const data = await this.contractErectionDeliveryStartService.getForContract(id, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/erection/delivery-start')
  @HttpCode(201)
  @Permissions('contracts.update')
  async createErectionDeliveryStart(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateContractErectionDeliveryStartDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionDeliveryStartService.create(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // 2 literal segments (erection/delivery-start/:deliveryStartId) — cannot
  // collide with ':id' or any other erection/... route, same reasoning as
  // every other nested-literal PATCH route in this file.
  @Patch('erection/delivery-start/:deliveryStartId')
  @Permissions('contracts.update')
  async updateErectionDeliveryStart(
    @Param('deliveryStartId', new ParseUUIDPipe({ version: '4' })) deliveryStartId: string,
    @Body() dto: UpdateContractErectionDeliveryStartDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionDeliveryStartService.update(deliveryStartId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // CM-71E — Delivery Start documents. Nested under :id (contract) AND
  // :deliveryStartId so the service can verify the record actually belongs
  // to that exact contract, matching the Step 1/2/3 attachment routes.
  @Get(':id/erection/delivery-start/:deliveryStartId/attachments')
  @Permissions('contracts.read')
  async listErectionDeliveryStartAttachments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('deliveryStartId', new ParseUUIDPipe({ version: '4' })) deliveryStartId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractErectionDeliveryStartService.listAttachments(id, deliveryStartId, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/erection/delivery-start/:deliveryStartId/attachments')
  @HttpCode(201)
  @Permissions('contracts.update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: ERECTION_DELIVERY_START_ATTACHMENT_MAX_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!(ERECTION_DELIVERY_START_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
          callback(
            new UnprocessableEntityException({
              code: 'CONTRACT_ERECTION_DELIVERY_START_ATTACHMENT_INVALID_TYPE',
              message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadErectionDeliveryStartAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('deliveryStartId', new ParseUUIDPipe({ version: '4' })) deliveryStartId: string,
    @UploadedFile() file: UploadedFileLike,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionDeliveryStartService.createAttachment(id, deliveryStartId, file, actor);
    return { data, meta: meta(), error: null };
  }

  @Get(':id/erection/delivery-start/:deliveryStartId/attachments/:attachmentId/download')
  @Permissions('contracts.read')
  async downloadErectionDeliveryStartAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('deliveryStartId', new ParseUUIDPipe({ version: '4' })) deliveryStartId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalFileName, mimeType } = await this.contractErectionDeliveryStartService.getAttachmentForDownload(
      id,
      deliveryStartId,
      attachmentId,
      actor,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(this.erectionDeliveryStartAttachmentStorage.createReadStream(storagePath));
  }

  @Delete(':id/erection/delivery-start/:deliveryStartId/attachments/:attachmentId')
  @HttpCode(200)
  @Permissions('contracts.update')
  async deleteErectionDeliveryStartAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('deliveryStartId', new ParseUUIDPipe({ version: '4' })) deliveryStartId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<null>> {
    await this.contractErectionDeliveryStartService.deleteAttachment(id, deliveryStartId, attachmentId, actor);
    return { data: null, meta: meta(), error: null };
  }

  // ---------------------------------------------------------------------------
  // CM-71F — Erection Workflow, Step 5: Erection Start. Owned by the
  // Erection Department / Site-Erection Team (see the service's own doc
  // comment). At most one record per contract. GET returns null (200),
  // never 404, when Step 5 simply hasn't happened yet.
  // ---------------------------------------------------------------------------

  @Get(':id/erection/start')
  @Permissions('contracts.read')
  async getErectionStart(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown | null>> {
    const data = await this.contractErectionStartService.getForContract(id, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/erection/start')
  @HttpCode(201)
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  async createErectionStart(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateContractErectionStartDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionStartService.create(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // 2 literal segments (erection/start/:erectionStartId) — cannot collide
  // with ':id' or any other erection/... route, same reasoning as every
  // other nested-literal PATCH route in this file.
  @Patch('erection/start/:erectionStartId')
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  async updateErectionStart(
    @Param('erectionStartId', new ParseUUIDPipe({ version: '4' })) erectionStartId: string,
    @Body() dto: UpdateContractErectionStartDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionStartService.update(erectionStartId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // CM-71F — Erection Start documents. Nested under :id (contract) AND
  // :erectionStartId so the service can verify the record actually belongs
  // to that exact contract, matching the Step 1/2/3/4 attachment routes.
  @Get(':id/erection/start/:erectionStartId/attachments')
  @Permissions('contracts.read')
  async listErectionStartAttachments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('erectionStartId', new ParseUUIDPipe({ version: '4' })) erectionStartId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractErectionStartService.listAttachments(id, erectionStartId, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/erection/start/:erectionStartId/attachments')
  @HttpCode(201)
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: ERECTION_START_ATTACHMENT_MAX_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!(ERECTION_START_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
          callback(
            new UnprocessableEntityException({
              code: 'CONTRACT_ERECTION_START_ATTACHMENT_INVALID_TYPE',
              message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadErectionStartAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('erectionStartId', new ParseUUIDPipe({ version: '4' })) erectionStartId: string,
    @UploadedFile() file: UploadedFileLike,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionStartService.createAttachment(id, erectionStartId, file, actor);
    return { data, meta: meta(), error: null };
  }

  @Get(':id/erection/start/:erectionStartId/attachments/:attachmentId/download')
  @Permissions('contracts.read')
  async downloadErectionStartAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('erectionStartId', new ParseUUIDPipe({ version: '4' })) erectionStartId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalFileName, mimeType } = await this.contractErectionStartService.getAttachmentForDownload(
      id,
      erectionStartId,
      attachmentId,
      actor,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(this.erectionStartAttachmentStorage.createReadStream(storagePath));
  }

  @Delete(':id/erection/start/:erectionStartId/attachments/:attachmentId')
  @HttpCode(200)
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  async deleteErectionStartAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('erectionStartId', new ParseUUIDPipe({ version: '4' })) erectionStartId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<null>> {
    await this.contractErectionStartService.deleteAttachment(id, erectionStartId, attachmentId, actor);
    return { data: null, meta: meta(), error: null };
  }

  // ---------------------------------------------------------------------------
  // CM-71G — Erection Workflow, Step 6: Erection Checklist. Owned by the
  // QA / QC Team (see the service's own doc comment). At most one record
  // per contract. GET returns null (200), never 404, when Step 6 simply
  // hasn't happened yet.
  // ---------------------------------------------------------------------------

  @Get(':id/erection/checklist')
  @Permissions('contracts.read')
  async getErectionChecklist(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown | null>> {
    const data = await this.contractErectionChecklistService.getForContract(id, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/erection/checklist')
  @HttpCode(201)
  @Permissions('contracts.update')
  async createErectionChecklist(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateContractErectionChecklistDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionChecklistService.create(id, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // 2 literal segments (erection/checklist/:checklistId) — cannot collide
  // with ':id' or any other erection/... route, same reasoning as every
  // other nested-literal PATCH route in this file.
  @Patch('erection/checklist/:checklistId')
  @Permissions('contracts.update')
  async updateErectionChecklist(
    @Param('checklistId', new ParseUUIDPipe({ version: '4' })) checklistId: string,
    @Body() dto: UpdateContractErectionChecklistDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionChecklistService.update(checklistId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // CM-71G — Erection Checklist documents. Nested under :id (contract) AND
  // :checklistId so the service can verify the record actually belongs to
  // that exact contract, matching the Step 1/2/3/4/5 attachment routes.
  @Get(':id/erection/checklist/:checklistId/attachments')
  @Permissions('contracts.read')
  async listErectionChecklistAttachments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('checklistId', new ParseUUIDPipe({ version: '4' })) checklistId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.contractErectionChecklistService.listAttachments(id, checklistId, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/erection/checklist/:checklistId/attachments')
  @HttpCode(201)
  @Permissions('contracts.update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: ERECTION_CHECKLIST_ATTACHMENT_MAX_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!(ERECTION_CHECKLIST_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
          callback(
            new UnprocessableEntityException({
              code: 'CONTRACT_ERECTION_CHECKLIST_ATTACHMENT_INVALID_TYPE',
              message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadErectionChecklistAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('checklistId', new ParseUUIDPipe({ version: '4' })) checklistId: string,
    @UploadedFile() file: UploadedFileLike,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionChecklistService.createAttachment(id, checklistId, file, actor);
    return { data, meta: meta(), error: null };
  }

  @Get(':id/erection/checklist/:checklistId/attachments/:attachmentId/download')
  @Permissions('contracts.read')
  async downloadErectionChecklistAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('checklistId', new ParseUUIDPipe({ version: '4' })) checklistId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalFileName, mimeType } = await this.contractErectionChecklistService.getAttachmentForDownload(
      id,
      checklistId,
      attachmentId,
      actor,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(this.erectionChecklistAttachmentStorage.createReadStream(storagePath));
  }

  @Delete(':id/erection/checklist/:checklistId/attachments/:attachmentId')
  @HttpCode(200)
  @Permissions('contracts.update')
  async deleteErectionChecklistAttachment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('checklistId', new ParseUUIDPipe({ version: '4' })) checklistId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<null>> {
    await this.contractErectionChecklistService.deleteAttachment(id, checklistId, attachmentId, actor);
    return { data: null, meta: meta(), error: null };
  }

  // ---------------------------------------------------------------------------
  // CM-71H — Erection Workflow Assignment (who owns Steps 1/3/5, the
  // Erection-Department-owned steps — see the service's own doc comment).
  // GET returns null (200), never 404, when the contract hasn't been
  // assigned yet. POST both assigns (no row yet) and reassigns/"Change
  // Assignment" (row exists) — contracts.update only, i.e. manager-tier
  // (Contract Manager/Admin/Super Admin), matching this unit's own "Contract
  // Manager assigns the Erection Workflow to an Erection Manager" framing.
  // ---------------------------------------------------------------------------

  @Get(':id/erection/assignment')
  @Permissions('contracts.read')
  async getErectionWorkflowAssignment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown | null>> {
    const data = await this.contractErectionWorkflowAssignmentService.getForContract(id, actor);
    return { data, meta: meta(), error: null };
  }

  @Post(':id/erection/assignment')
  @Permissions('contracts.update')
  async assignErectionWorkflow(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AssignContractErectionWorkflowDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractErectionWorkflowAssignmentService.assign(id, dto, actor);
    return { data, meta: meta(), error: null };
  }
}
