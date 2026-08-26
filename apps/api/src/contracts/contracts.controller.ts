import {
  Controller,
  Get,
  Post,
  Patch,
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
import { ContractDashboardService } from './contract-dashboard.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractListQueryDto } from './dto/contract-list-query.dto';
import { ActivateContractDto } from './dto/activate-contract.dto';
import { TerminateContractDto } from './dto/terminate-contract.dto';
import { CloseContractDto } from './dto/close-contract.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { CreateContractPaymentDto } from './dto/create-contract-payment.dto';
import { UpdateContractPaymentDto } from './dto/update-contract-payment.dto';
import { ContractPaymentListQueryDto } from './dto/contract-payment-list-query.dto';
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
import { ContractCloseoutListQueryDto } from './dto/contract-closeout-list-query.dto';
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
    private readonly contractWorkflowService: ContractWorkflowService,
    private readonly contractIssuesService: ContractIssuesService,
    private readonly contractClaimsService: ContractClaimsService,
    private readonly workflowAttachmentStorage: WorkflowAttachmentStorageService,
    private readonly contractCloseoutService: ContractCloseoutService,
    private readonly closeoutAttachmentStorage: CloseoutAttachmentStorageService,
    private readonly contractScheduleService: ContractScheduleService,
    private readonly contractDashboardService: ContractDashboardService,
  ) {}

  // summary and people MUST be declared before /:id to avoid route conflict

  @Get('summary')
  @Permissions('contracts.read')
  async summary(
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractsService.getSummary(actor);
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

  @Get(':id/schedule')
  @Permissions('contracts.read')
  async getContractSchedule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.contractScheduleService.findAllForContract(id, actor);
    return { data, meta: meta(), error: null };
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
}
