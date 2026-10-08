import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  StreamableFile,
  UnprocessableEntityException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { TechnicalService } from './technical.service';
import {
  TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES,
  resolveTechnicalAttachmentMimeType,
} from './technical-attachment-storage.service';
import { TechnicalAttachmentStorageService } from './technical-attachment-storage.service';
import { SaveDrawingReceivedDto } from './dto/save-drawing-received.dto';
import { SaveSdCalculationSubmissionDto } from './dto/save-sd-calculation-submission.dto';
import { SaveGettingApprovalDto } from './dto/save-getting-approval.dto';
import { SaveFdIssuanceDto } from './dto/save-fd-issuance.dto';
import { RequestClarificationDto } from './dto/request-clarification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { AnyPermission } from '../common/decorators/any-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import type { AuthUser } from '../common/types/auth-user';

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

@Controller('technical')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TechnicalController {
  constructor(
    private readonly technicalService: TechnicalService,
    private readonly technicalAttachmentStorage: TechnicalAttachmentStorageService,
  ) {}

  @Get('dashboard')
  @AnyPermission('technical.read', 'contracts.read')
  async dashboard(@CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.getDashboard(actor);
    return { data, meta: meta(), error: null };
  }

  @Get('jobs/:contractId')
  @AnyPermission('technical.read', 'contracts.read')
  async workflowOverview(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.getWorkflowOverview(contractId, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('jobs/:contractId/start')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async start(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.startWorkflow(contractId, actor);
    return { data, meta: meta(), error: null };
  }

  @Get('jobs/:contractId/drawing-received')
  @AnyPermission('technical.read', 'contracts.read')
  async drawingReceived(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.getDrawingReceived(contractId, actor);
    return { data, meta: meta(), error: null };
  }

  @Patch('jobs/:contractId/drawing-received')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async saveDraft(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Body() dto: SaveDrawingReceivedDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.saveDrawingReceivedDraft(contractId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('jobs/:contractId/drawing-received/clarification')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async requestClarification(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Body() dto: RequestClarificationDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<null>> {
    await this.technicalService.requestClarification(contractId, dto.note, actor);
    return { data: null, meta: meta(), error: null };
  }

  @Post('jobs/:contractId/drawing-received/complete')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async complete(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Body() dto: SaveDrawingReceivedDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.completeDrawingReceived(contractId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  // Attachments (4 path segments, declared after the 2-segment GET above —
  // same reasoning as every other attachment controller in this app.)

  @Get('jobs/:contractId/drawing-received/attachments')
  @AnyPermission('technical.read', 'contracts.read')
  async listAttachments(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.technicalService.listAttachments(contractId, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('jobs/:contractId/drawing-received/attachments')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES },
      fileFilter: (_req, file, callback) => {
        if (resolveTechnicalAttachmentMimeType(file) === null) {
          callback(
            new UnprocessableEntityException({
              code: 'TECHNICAL_ATTACHMENT_INVALID_TYPE',
              message: 'Unsupported file type.',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadAttachment(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @UploadedFile() file: UploadedFileLike,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.createAttachment(contractId, file, actor);
    return { data, meta: meta(), error: null };
  }

  @Get('jobs/:contractId/drawing-received/attachments/:attachmentId/download')
  @AnyPermission('technical.read', 'contracts.read')
  async downloadAttachment(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalFileName, mimeType } = await this.technicalService.getAttachmentForDownload(
      contractId,
      attachmentId,
      actor,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(this.technicalAttachmentStorage.createReadStream(storagePath));
  }

  /**
   * FMP-TECH-06 — inline view of a Drawing Received attachment (same
   * permission/ownership checks as download; only the disposition differs).
   * TIFF is always served as image/tiff.
   */
  @Get('jobs/:contractId/drawing-received/attachments/:attachmentId/view')
  @AnyPermission('technical.read', 'contracts.read')
  async viewAttachment(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalFileName, mimeType } = await this.technicalService.getAttachmentForDownload(
      contractId,
      attachmentId,
      actor,
    );
    const isTiff = /\.tiff?$/i.test(originalFileName);
    res.set({
      'Content-Type': isTiff ? 'image/tiff' : mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(this.technicalAttachmentStorage.createReadStream(storagePath));
  }

  @Delete('jobs/:contractId/drawing-received/attachments/:attachmentId')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async deleteAttachment(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<null>> {
    await this.technicalService.deleteAttachment(contractId, attachmentId, actor);
    return { data: null, meta: meta(), error: null };
  }

  // ---------------------------------------------------------------------------
  // FMP-TECH-02 — SD & Calculation Submission (Technical Stage 2). Mirrors
  // the Drawing Received endpoints above exactly in shape.
  // ---------------------------------------------------------------------------

  @Get('jobs/:contractId/sd-calculation-submission')
  @AnyPermission('technical.read', 'contracts.read')
  async sdCalculationSubmission(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.getSdCalculationSubmission(contractId, actor);
    return { data, meta: meta(), error: null };
  }

  @Patch('jobs/:contractId/sd-calculation-submission')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async saveSdDraft(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Body() dto: SaveSdCalculationSubmissionDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.saveSdSubmissionDraft(contractId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('jobs/:contractId/sd-calculation-submission/submit')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async submitSd(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Body() dto: SaveSdCalculationSubmissionDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.submitSdCalculation(contractId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('jobs/:contractId/sd-calculation-submission/clarification')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async requestSdClarification(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Body() dto: RequestClarificationDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<null>> {
    await this.technicalService.requestSdClarification(contractId, dto.note, actor);
    return { data: null, meta: meta(), error: null };
  }

  @Post('jobs/:contractId/sd-calculation-submission/complete')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async completeSd(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Body() dto: SaveSdCalculationSubmissionDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.completeSdCalculationSubmission(contractId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Get('jobs/:contractId/sd-calculation-submission/attachments')
  @AnyPermission('technical.read', 'contracts.read')
  async listSdAttachments(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.technicalService.listSdAttachments(contractId, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('jobs/:contractId/sd-calculation-submission/attachments')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES },
      fileFilter: (_req, file, callback) => {
        if (resolveTechnicalAttachmentMimeType(file) === null) {
          callback(
            new UnprocessableEntityException({
              code: 'TECHNICAL_ATTACHMENT_INVALID_TYPE',
              message: 'Unsupported file type.',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadSdAttachment(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @UploadedFile() file: UploadedFileLike,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.createSdAttachment(contractId, file, actor);
    return { data, meta: meta(), error: null };
  }

  @Get('jobs/:contractId/sd-calculation-submission/attachments/:attachmentId/download')
  @AnyPermission('technical.read', 'contracts.read')
  async downloadSdAttachment(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalFileName, mimeType } = await this.technicalService.getSdAttachmentForDownload(
      contractId,
      attachmentId,
      actor,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(this.technicalAttachmentStorage.createReadStream(storagePath));
  }

  @Delete('jobs/:contractId/sd-calculation-submission/attachments/:attachmentId')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async deleteSdAttachment(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<null>> {
    await this.technicalService.deleteSdAttachment(contractId, attachmentId, actor);
    return { data: null, meta: meta(), error: null };
  }

  // ---------------------------------------------------------------------------
  // FMP-TECH-03 — Getting Approval (Technical Stage 3). Mirrors the SD &
  // Calculation Submission endpoints above; 3 write actions here
  // (Send Back for Changes, Reject, Approve) instead of 2, matching this
  // stage's own richer action set.
  // ---------------------------------------------------------------------------

  @Get('jobs/:contractId/getting-approval')
  @AnyPermission('technical.read', 'contracts.read')
  async gettingApproval(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.getGettingApproval(contractId, actor);
    return { data, meta: meta(), error: null };
  }

  @Patch('jobs/:contractId/getting-approval')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async saveApprovalDraft(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Body() dto: SaveGettingApprovalDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.saveApprovalDraft(contractId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('jobs/:contractId/getting-approval/clarification')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async requestApprovalClarification(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Body() dto: RequestClarificationDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<null>> {
    await this.technicalService.requestApprovalClarification(contractId, dto.note, actor);
    return { data: null, meta: meta(), error: null };
  }

  @Post('jobs/:contractId/getting-approval/send-back')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async sendApprovalBackForChanges(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Body() dto: SaveGettingApprovalDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.sendApprovalBackForChanges(contractId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('jobs/:contractId/getting-approval/reject')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async rejectApproval(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Body() dto: SaveGettingApprovalDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.rejectApproval(contractId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('jobs/:contractId/getting-approval/approve')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async approveAndMoveToFdIssuance(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Body() dto: SaveGettingApprovalDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.approveAndMoveToFdIssuance(contractId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Get('jobs/:contractId/getting-approval/attachments')
  @AnyPermission('technical.read', 'contracts.read')
  async listApprovalAttachments(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.technicalService.listApprovalAttachments(contractId, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('jobs/:contractId/getting-approval/attachments')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES },
      fileFilter: (_req, file, callback) => {
        if (resolveTechnicalAttachmentMimeType(file) === null) {
          callback(
            new UnprocessableEntityException({
              code: 'TECHNICAL_ATTACHMENT_INVALID_TYPE',
              message: 'Unsupported file type.',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadApprovalAttachment(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @UploadedFile() file: UploadedFileLike,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.createApprovalAttachment(contractId, file, actor);
    return { data, meta: meta(), error: null };
  }

  @Get('jobs/:contractId/getting-approval/attachments/:attachmentId/download')
  @AnyPermission('technical.read', 'contracts.read')
  async downloadApprovalAttachment(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalFileName, mimeType } = await this.technicalService.getApprovalAttachmentForDownload(
      contractId,
      attachmentId,
      actor,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(this.technicalAttachmentStorage.createReadStream(storagePath));
  }

  @Delete('jobs/:contractId/getting-approval/attachments/:attachmentId')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async deleteApprovalAttachment(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<null>> {
    await this.technicalService.deleteApprovalAttachment(contractId, attachmentId, actor);
    return { data: null, meta: meta(), error: null };
  }

  // ---------------------------------------------------------------------------
  // FMP-TECH-04 — FD Issuance (Technical Stage 4, the final stage). Mirrors
  // the Getting Approval endpoints above; Return/Reopen replaces Send Back
  // for Changes, and Issue FD & Complete replaces Approve — same shape.
  // ---------------------------------------------------------------------------

  @Get('jobs/:contractId/fd-issuance')
  @AnyPermission('technical.read', 'contracts.read')
  async fdIssuance(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.getFdIssuance(contractId, actor);
    return { data, meta: meta(), error: null };
  }

  @Patch('jobs/:contractId/fd-issuance')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async saveFdDraft(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Body() dto: SaveFdIssuanceDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.saveFdIssuanceDraft(contractId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('jobs/:contractId/fd-issuance/submit')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async submitFd(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Body() dto: SaveFdIssuanceDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.submitFdIssue(contractId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('jobs/:contractId/fd-issuance/return')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async returnOrReopenFd(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Body() dto: RequestClarificationDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.returnOrReopenFd(contractId, dto.note, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('jobs/:contractId/fd-issuance/complete')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async issueFdAndCompleteWorkflow(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Body() dto: SaveFdIssuanceDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.issueFdAndCompleteWorkflow(contractId, dto, actor);
    return { data, meta: meta(), error: null };
  }

  @Get('jobs/:contractId/fd-issuance/attachments')
  @AnyPermission('technical.read', 'contracts.read')
  async listFdAttachments(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const data = await this.technicalService.listFdAttachments(contractId, actor);
    return { data, meta: meta(), error: null };
  }

  @Post('jobs/:contractId/fd-issuance/attachments')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES },
      fileFilter: (_req, file, callback) => {
        if (resolveTechnicalAttachmentMimeType(file) === null) {
          callback(
            new UnprocessableEntityException({
              code: 'TECHNICAL_ATTACHMENT_INVALID_TYPE',
              message: 'Unsupported file type.',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadFdAttachment(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @UploadedFile() file: UploadedFileLike,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.technicalService.createFdAttachment(contractId, file, actor);
    return { data, meta: meta(), error: null };
  }

  @Get('jobs/:contractId/fd-issuance/attachments/:attachmentId/download')
  @AnyPermission('technical.read', 'contracts.read')
  async downloadFdAttachment(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalFileName, mimeType } = await this.technicalService.getFdAttachmentForDownload(
      contractId,
      attachmentId,
      actor,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(this.technicalAttachmentStorage.createReadStream(storagePath));
  }

  @Delete('jobs/:contractId/fd-issuance/attachments/:attachmentId')
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async deleteFdAttachment(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' })) attachmentId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<null>> {
    await this.technicalService.deleteFdAttachment(contractId, attachmentId, actor);
    return { data: null, meta: meta(), error: null };
  }
}
