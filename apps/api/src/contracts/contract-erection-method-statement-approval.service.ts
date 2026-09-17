import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import {
  ErectionMethodStatementApprovalAttachmentStorageService,
  ERECTION_METHOD_STATEMENT_APPROVAL_ATTACHMENT_MAX_BYTES,
  ERECTION_METHOD_STATEMENT_APPROVAL_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './erection-method-statement-approval-attachment-storage.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateContractErectionMethodStatementApprovalDto } from './dto/create-contract-erection-method-statement-approval.dto';
import type { UpdateContractErectionMethodStatementApprovalDto } from './dto/update-contract-erection-method-statement-approval.dto';
import { logContractActivity } from './contract-activity-log';

// ---------------------------------------------------------------------------
// CM-71C — Erection Workflow, Step 2: Erection Method Statement Approval.
// QA/QC reviews the CM-71A Step 1 record. At most one approval record per
// method statement (methodStatementId is @unique) — a revision cycle
// updates the SAME record rather than creating a new one, matching CM-71A's
// own "create once, edit forever" convention. No dedicated approve/reject/
// revision endpoints — one generic update(), same as the task's own
// suggested endpoint list; the FRONTEND computes reviewStatus/decision from
// which button was clicked (see erection-method-statement-approval-panel.tsx),
// mirroring CM-71A's own "frontend drives the transition" pattern exactly.
// Comments-required-for-a-final-decision IS still enforced server-side
// (assertCommentsPresentForFinalDecision below) — client-side validation is
// for UX, this is the real defense-in-depth floor, matching the existing
// RejectContractCloseoutRequestDto precedent elsewhere in this module.
// ---------------------------------------------------------------------------

const FINAL_REVIEW_STATUSES = ['APPROVED', 'REVISION_REQUESTED', 'REJECTED'];

export function assertCommentsPresentForFinalDecision(reviewStatus: string | undefined, comments: string | undefined): void {
  if (reviewStatus && FINAL_REVIEW_STATUSES.includes(reviewStatus) && !comments?.trim()) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_COMMENTS_REQUIRED',
      message: 'Comments / Review Notes are required to Approve, Request Revision, or Reject.',
    });
  }
}

/** Maps the resulting reviewStatus to the activity event names this unit's own task explicitly named. */
export function computeApprovalActivityEvent(reviewStatus: string): string {
  switch (reviewStatus) {
    case 'APPROVED':
      return 'erection_method_statement_approval_approved';
    case 'REVISION_REQUESTED':
      return 'erection_method_statement_approval_revision_requested';
    case 'REJECTED':
      return 'erection_method_statement_approval_rejected';
    default:
      return 'erection_method_statement_approval_draft_saved';
  }
}

const APPROVAL_SELECT = {
  id: true,
  contractId: true,
  methodStatementId: true,
  reviewRequiredBy: true,
  reviewingEngineer: true,
  reviewType: true,
  priority: true,
  reviewStatus: true,
  decision: true,
  requiresClientApproval: true,
  comments: true,
  approvedAt: true,
  revisionRequestedAt: true,
  rejectedAt: true,
  reviewedByUser: { select: { id: true, displayName: true } },
  createdByUser: { select: { id: true, displayName: true } },
  updatedByUser: { select: { id: true, displayName: true } },
  createdAt: true,
  updatedAt: true,
  attachments: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      originalFileName: true,
      mimeType: true,
      fileSize: true,
      createdAt: true,
      uploadedByUser: { select: { id: true, displayName: true } },
    },
  },
} as const;

const APPROVAL_ATTACHMENT_SELECT = {
  id: true,
  approvalId: true,
  originalFileName: true,
  mimeType: true,
  fileSize: true,
  createdAt: true,
  uploadedByUser: { select: { id: true, displayName: true } },
} as const;

/** DB-stored DATE column comes back as a UTC-midnight JS Date — reformat to plain YYYY-MM-DD (same fix as CM-70F / CM-71A). */
function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toResponseShape<T extends { reviewRequiredBy: Date | null }>(row: T): Omit<T, 'reviewRequiredBy'> & { reviewRequiredBy: string | null } {
  return { ...row, reviewRequiredBy: isoDate(row.reviewRequiredBy) };
}

@Injectable()
export class ContractErectionMethodStatementApprovalService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
    private readonly attachmentStorage: ErectionMethodStatementApprovalAttachmentStorageService,
  ) {}

  private async loadContract(contractId: string, actor: AuthUser): Promise<{ id: string; departmentId: string | null }> {
    const contract = await this.db.getClient().contract.findUnique({
      where: { id: contractId },
      select: { id: true, departmentId: true },
    });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);
    return contract;
  }

  /** Step 2 can only exist once Step 1 (the method statement) does — this is the one place that dependency is enforced. */
  private async loadMethodStatement(contractId: string): Promise<{ id: string } | null> {
    return this.db.getClient().contractErectionMethodStatement.findUnique({
      where: { contractId },
      select: { id: true },
    });
  }

  // ---------------------------------------------------------------------------
  // Get — returns null (not 404) when Step 1 doesn't exist yet, or Step 1
  // exists but Step 2 hasn't been started yet; both are normal, valid states.
  // ---------------------------------------------------------------------------

  async getForContract(contractId: string, actor: AuthUser): Promise<unknown | null> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    await this.loadContract(contractId, actor);

    const statement = await this.loadMethodStatement(contractId);
    if (!statement) return null;

    const approval = await this.db.getClient().contractErectionMethodStatementApproval.findUnique({
      where: { methodStatementId: statement.id },
      select: APPROVAL_SELECT,
    });
    return approval ? toResponseShape(approval) : null;
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(contractId: string, dto: CreateContractErectionMethodStatementApprovalDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }
    await this.loadContract(contractId, actor);

    const statement = await this.loadMethodStatement(contractId);
    if (!statement) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_NO_STATEMENT',
        message: 'The Erection Method Statement (Step 1) must be saved before Step 2 Approval can be started.',
      });
    }

    const existing = await this.db.getClient().contractErectionMethodStatementApproval.findUnique({
      where: { methodStatementId: statement.id },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_ALREADY_EXISTS',
        message: 'A Method Statement Approval review already exists for this contract.',
      });
    }

    assertCommentsPresentForFinalDecision(dto.reviewStatus, dto.comments);

    const reviewStatus = dto.reviewStatus ?? 'DRAFT_REVIEW';
    const isFinal = FINAL_REVIEW_STATUSES.includes(reviewStatus);

    const created = await this.db.getClient().contractErectionMethodStatementApproval.create({
      data: {
        contractId,
        methodStatementId: statement.id,
        createdByUserId: actor.id,
        ...(dto.reviewRequiredBy !== undefined ? { reviewRequiredBy: dto.reviewRequiredBy ? new Date(dto.reviewRequiredBy) : null } : {}),
        ...(dto.reviewingEngineer !== undefined ? { reviewingEngineer: dto.reviewingEngineer || null } : {}),
        ...(dto.reviewType !== undefined ? { reviewType: dto.reviewType || null } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority as never } : {}),
        reviewStatus: reviewStatus as never,
        ...(dto.decision !== undefined ? { decision: (dto.decision || null) as never } : {}),
        ...(dto.requiresClientApproval !== undefined ? { requiresClientApproval: dto.requiresClientApproval } : {}),
        ...(dto.comments !== undefined ? { comments: dto.comments || null } : {}),
        ...(isFinal ? { reviewedByUserId: actor.id } : {}),
        ...(reviewStatus === 'APPROVED' ? { approvedAt: new Date() } : {}),
        ...(reviewStatus === 'REVISION_REQUESTED' ? { revisionRequestedAt: new Date() } : {}),
        ...(reviewStatus === 'REJECTED' ? { rejectedAt: new Date() } : {}),
      },
      select: APPROVAL_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, computeApprovalActivityEvent(reviewStatus), {
      approvalId: created.id,
      methodStatementId: statement.id,
      reviewStatus,
    });

    return toResponseShape(created);
  }

  // ---------------------------------------------------------------------------
  // Update — no delete endpoint for the approval itself, matching every
  // other contract sub-record in this app.
  // ---------------------------------------------------------------------------

  private async loadApproval(approvalId: string): Promise<{ id: string; contractId: string; methodStatementId: string; reviewStatus: string; departmentId: string | null }> {
    const approval = await this.db.getClient().contractErectionMethodStatementApproval.findUnique({
      where: { id: approvalId },
      select: { id: true, contractId: true, methodStatementId: true, reviewStatus: true, contract: { select: { departmentId: true } } },
    });
    if (!approval) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_NOT_FOUND', message: 'Method Statement Approval not found' });
    }
    return {
      id: approval.id,
      contractId: approval.contractId,
      methodStatementId: approval.methodStatementId,
      reviewStatus: approval.reviewStatus,
      departmentId: approval.contract.departmentId,
    };
  }

  async update(approvalId: string, dto: UpdateContractErectionMethodStatementApprovalDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }
    const existing = await this.loadApproval(approvalId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, existing.departmentId);

    assertCommentsPresentForFinalDecision(dto.reviewStatus, dto.comments);

    const isFinal = dto.reviewStatus !== undefined && FINAL_REVIEW_STATUSES.includes(dto.reviewStatus);

    const updated = await this.db.getClient().contractErectionMethodStatementApproval.update({
      where: { id: approvalId },
      data: {
        updatedByUserId: actor.id,
        ...(dto.reviewRequiredBy !== undefined ? { reviewRequiredBy: dto.reviewRequiredBy ? new Date(dto.reviewRequiredBy) : null } : {}),
        ...(dto.reviewingEngineer !== undefined ? { reviewingEngineer: dto.reviewingEngineer || null } : {}),
        ...(dto.reviewType !== undefined ? { reviewType: dto.reviewType || null } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority as never } : {}),
        ...(dto.reviewStatus !== undefined ? { reviewStatus: dto.reviewStatus as never } : {}),
        ...(dto.decision !== undefined ? { decision: (dto.decision || null) as never } : {}),
        ...(dto.requiresClientApproval !== undefined ? { requiresClientApproval: dto.requiresClientApproval } : {}),
        ...(dto.comments !== undefined ? { comments: dto.comments || null } : {}),
        ...(isFinal ? { reviewedByUserId: actor.id } : {}),
        ...(dto.reviewStatus === 'APPROVED' ? { approvedAt: new Date() } : {}),
        ...(dto.reviewStatus === 'REVISION_REQUESTED' ? { revisionRequestedAt: new Date() } : {}),
        ...(dto.reviewStatus === 'REJECTED' ? { rejectedAt: new Date() } : {}),
      },
      select: APPROVAL_SELECT,
    });

    await logContractActivity(
      this.db,
      existing.contractId,
      actor,
      computeApprovalActivityEvent(dto.reviewStatus ?? existing.reviewStatus),
      { approvalId: updated.id, methodStatementId: existing.methodStatementId, reviewStatus: updated.reviewStatus },
    );

    return toResponseShape(updated);
  }

  // ---------------------------------------------------------------------------
  // Attachments — QA/QC's own review uploads, a separate table from Step 1's
  // submitted attachments (see schema.prisma model comment) — Step 1's files
  // are shown read-only on the Step 2 screen via the EXISTING CM-71A
  // GET .../erection/method-statement response (which already embeds its
  // own attachments), never through these endpoints.
  // ---------------------------------------------------------------------------

  private async loadApprovalForContract(contractId: string, approvalId: string): Promise<{ id: string; departmentId: string | null }> {
    const approval = await this.db.getClient().contractErectionMethodStatementApproval.findFirst({
      where: { id: approvalId, contractId },
      select: { id: true, contract: { select: { departmentId: true } } },
    });
    if (!approval) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_NOT_FOUND', message: 'Method Statement Approval not found' });
    }
    return { id: approval.id, departmentId: approval.contract.departmentId };
  }

  async listAttachments(contractId: string, approvalId: string, actor: AuthUser): Promise<unknown[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    const { departmentId } = await this.loadApprovalForContract(contractId, approvalId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);

    return this.db.getClient().contractErectionMethodStatementApprovalAttachment.findMany({
      where: { approvalId },
      orderBy: [{ createdAt: 'desc' }],
      select: APPROVAL_ATTACHMENT_SELECT,
    });
  }

  async createAttachment(
    contractId: string,
    approvalId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actor: AuthUser,
  ): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }
    const { departmentId } = await this.loadApprovalForContract(contractId, approvalId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);

    if (!(ERECTION_METHOD_STATEMENT_APPROVAL_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_ATTACHMENT_INVALID_TYPE',
        message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
      });
    }
    if (file.size > ERECTION_METHOD_STATEMENT_APPROVAL_ATTACHMENT_MAX_BYTES) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_ATTACHMENT_TOO_LARGE',
        message: `File exceeds the ${ERECTION_METHOD_STATEMENT_APPROVAL_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB upload limit.`,
      });
    }

    const { fileName, storagePath } = await this.attachmentStorage.save(approvalId, file.buffer, file.originalname);

    const attachment = await this.db.getClient().contractErectionMethodStatementApprovalAttachment.create({
      data: {
        approvalId,
        fileName,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath,
        uploadedByUserId: actor.id,
      },
      select: APPROVAL_ATTACHMENT_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, 'erection_method_statement_approval_attachment_uploaded', {
      approvalId,
      attachmentId: attachment.id,
      fileName: file.originalname,
    });

    return attachment;
  }

  async getAttachmentForDownload(
    contractId: string,
    approvalId: string,
    attachmentId: string,
    actor: AuthUser,
  ): Promise<{ storagePath: string; originalFileName: string; mimeType: string }> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const attachment = await this.db.getClient().contractErectionMethodStatementApprovalAttachment.findFirst({
      where: { id: attachmentId, approvalId, approval: { contractId } },
      select: {
        storagePath: true,
        originalFileName: true,
        mimeType: true,
        approval: { select: { contract: { select: { departmentId: true } } } },
      },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      attachment.approval.contract.departmentId,
    );

    return {
      storagePath: attachment.storagePath,
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
    };
  }

  async deleteAttachment(contractId: string, approvalId: string, attachmentId: string, actor: AuthUser): Promise<void> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const attachment = await this.db.getClient().contractErectionMethodStatementApprovalAttachment.findFirst({
      where: { id: attachmentId, approvalId, approval: { contractId } },
      select: {
        id: true,
        storagePath: true,
        originalFileName: true,
        approval: { select: { contract: { select: { departmentId: true } } } },
      },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      attachment.approval.contract.departmentId,
    );

    await this.db.getClient().contractErectionMethodStatementApprovalAttachment.delete({ where: { id: attachmentId } });
    await this.attachmentStorage.deleteFile(attachment.storagePath);

    await logContractActivity(this.db, contractId, actor, 'erection_method_statement_approval_attachment_deleted', {
      approvalId,
      attachmentId,
      fileName: attachment.originalFileName,
    });
  }
}
