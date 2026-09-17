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
  ErectionMethodStatementAttachmentStorageService,
  ERECTION_METHOD_STATEMENT_ATTACHMENT_MAX_BYTES,
  ERECTION_METHOD_STATEMENT_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './erection-method-statement-attachment-storage.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateContractErectionMethodStatementDto } from './dto/create-contract-erection-method-statement.dto';
import type { UpdateContractErectionMethodStatementDto } from './dto/update-contract-erection-method-statement.dto';
import { logContractActivity } from './contract-activity-log';
import { assertCanWriteErectionDepartmentStep } from './erection-department-write-access';

// ---------------------------------------------------------------------------
// CM-71A — Erection Workflow, Step 1: Issue Erection Method Statement. See
// the ContractErectionMethodStatement model comment (schema.prisma) for why
// this is a new, dedicated table rather than a reuse of ContractWorkflowTask.
// At most one record per contract (contractId is @unique) — create() rejects
// a second attempt with a clear 409, matching the closeout-request "one
// active request at a time" pattern in contract-closeout.service.ts.
// ---------------------------------------------------------------------------

const STATEMENT_SELECT = {
  id: true,
  contractId: true,
  plannedIssueDate: true,
  methodStatementRefNo: true,
  jobOrderNo: true,
  workLocationYard: true,
  preparedBy: true,
  departmentArea: true,
  reviewedByInternal: true,
  documentRevision: true,
  applicableStandards: true,
  includesLiftPlan: true,
  includesRiskAssessment: true,
  requiresClientApproval: true,
  scopeDescription: true,
  status: true,
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

const STATEMENT_ATTACHMENT_SELECT = {
  id: true,
  methodStatementId: true,
  originalFileName: true,
  mimeType: true,
  fileSize: true,
  createdAt: true,
  uploadedByUser: { select: { id: true, displayName: true } },
} as const;

/** DB-stored DATE column comes back as a UTC-midnight JS Date — reformat to plain YYYY-MM-DD so a native `<input type="date">` never silently renders blank (same fix as CM-70F). */
function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toResponseShape<T extends { plannedIssueDate: Date | null }>(row: T): Omit<T, 'plannedIssueDate'> & { plannedIssueDate: string | null } {
  return { ...row, plannedIssueDate: isoDate(row.plannedIssueDate) };
}

@Injectable()
export class ContractErectionMethodStatementService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
    private readonly attachmentStorage: ErectionMethodStatementAttachmentStorageService,
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

  // ---------------------------------------------------------------------------
  // Get — returns null (not 404) when no statement has been created yet for
  // this contract; "not created yet" is a normal, valid state for Step 1 of a
  // workflow, not an error.
  // ---------------------------------------------------------------------------

  async getForContract(contractId: string, actor: AuthUser): Promise<unknown | null> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    await this.loadContract(contractId, actor);

    const statement = await this.db.getClient().contractErectionMethodStatement.findUnique({
      where: { contractId },
      select: STATEMENT_SELECT,
    });
    return statement ? toResponseShape(statement) : null;
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(contractId: string, dto: CreateContractErectionMethodStatementDto, actor: AuthUser): Promise<unknown> {
    assertCanWriteErectionDepartmentStep(actor);
    await this.loadContract(contractId, actor);

    const existing = await this.db.getClient().contractErectionMethodStatement.findUnique({
      where: { contractId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'CONTRACT_ERECTION_METHOD_STATEMENT_ALREADY_EXISTS',
        message: 'An Erection Method Statement already exists for this contract.',
      });
    }

    const created = await this.db.getClient().contractErectionMethodStatement.create({
      data: {
        contractId,
        createdByUserId: actor.id,
        ...(dto.plannedIssueDate !== undefined ? { plannedIssueDate: new Date(dto.plannedIssueDate) } : {}),
        methodStatementRefNo: dto.methodStatementRefNo,
        jobOrderNo: dto.jobOrderNo,
        workLocationYard: dto.workLocationYard,
        preparedBy: dto.preparedBy,
        departmentArea: dto.departmentArea,
        ...(dto.reviewedByInternal !== undefined ? { reviewedByInternal: dto.reviewedByInternal || null } : {}),
        ...(dto.documentRevision !== undefined ? { documentRevision: dto.documentRevision || null } : {}),
        ...(dto.applicableStandards !== undefined ? { applicableStandards: dto.applicableStandards || null } : {}),
        ...(dto.includesLiftPlan !== undefined ? { includesLiftPlan: dto.includesLiftPlan } : {}),
        ...(dto.includesRiskAssessment !== undefined ? { includesRiskAssessment: dto.includesRiskAssessment } : {}),
        ...(dto.requiresClientApproval !== undefined ? { requiresClientApproval: dto.requiresClientApproval } : {}),
        scopeDescription: dto.scopeDescription,
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
      },
      select: STATEMENT_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, 'erection_method_statement_created', {
      methodStatementId: created.id,
      status: created.status,
    });

    return toResponseShape(created);
  }

  // ---------------------------------------------------------------------------
  // Update — no delete endpoint for the statement itself, matching every
  // other contract sub-record in this app (status transitions, not deletes,
  // represent real-world outcomes).
  // ---------------------------------------------------------------------------

  private async loadStatement(statementId: string): Promise<{ id: string; contractId: string; status: string; departmentId: string | null }> {
    const statement = await this.db.getClient().contractErectionMethodStatement.findUnique({
      where: { id: statementId },
      select: { id: true, contractId: true, status: true, contract: { select: { departmentId: true } } },
    });
    if (!statement) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_METHOD_STATEMENT_NOT_FOUND', message: 'Erection Method Statement not found' });
    }
    return { id: statement.id, contractId: statement.contractId, status: statement.status, departmentId: statement.contract.departmentId };
  }

  async update(statementId: string, dto: UpdateContractErectionMethodStatementDto, actor: AuthUser): Promise<unknown> {
    assertCanWriteErectionDepartmentStep(actor);
    const existing = await this.loadStatement(statementId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, existing.departmentId);

    const updated = await this.db.getClient().contractErectionMethodStatement.update({
      where: { id: statementId },
      data: {
        updatedByUserId: actor.id,
        ...(dto.plannedIssueDate !== undefined ? { plannedIssueDate: dto.plannedIssueDate ? new Date(dto.plannedIssueDate) : null } : {}),
        ...(dto.methodStatementRefNo !== undefined ? { methodStatementRefNo: dto.methodStatementRefNo } : {}),
        ...(dto.jobOrderNo !== undefined ? { jobOrderNo: dto.jobOrderNo } : {}),
        ...(dto.workLocationYard !== undefined ? { workLocationYard: dto.workLocationYard } : {}),
        ...(dto.preparedBy !== undefined ? { preparedBy: dto.preparedBy } : {}),
        ...(dto.departmentArea !== undefined ? { departmentArea: dto.departmentArea } : {}),
        ...(dto.reviewedByInternal !== undefined ? { reviewedByInternal: dto.reviewedByInternal || null } : {}),
        ...(dto.documentRevision !== undefined ? { documentRevision: dto.documentRevision || null } : {}),
        ...(dto.applicableStandards !== undefined ? { applicableStandards: dto.applicableStandards || null } : {}),
        ...(dto.includesLiftPlan !== undefined ? { includesLiftPlan: dto.includesLiftPlan } : {}),
        ...(dto.includesRiskAssessment !== undefined ? { includesRiskAssessment: dto.includesRiskAssessment } : {}),
        ...(dto.requiresClientApproval !== undefined ? { requiresClientApproval: dto.requiresClientApproval } : {}),
        ...(dto.scopeDescription !== undefined ? { scopeDescription: dto.scopeDescription } : {}),
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
      },
      select: STATEMENT_SELECT,
    });

    const isIssueTransition = dto.status !== undefined && dto.status !== 'DRAFT' && existing.status !== dto.status;
    await logContractActivity(
      this.db,
      existing.contractId,
      actor,
      isIssueTransition ? 'erection_method_statement_issued' : 'erection_method_statement_updated',
      { methodStatementId: updated.id, status: updated.status },
    );

    return toResponseShape(updated);
  }

  // ---------------------------------------------------------------------------
  // Attachments — metadata + storage-relative path only; binary data lives on
  // disk via ErectionMethodStatementAttachmentStorageService, never in the
  // database. Every method verifies the statement actually belongs to the
  // given contractId — a URL with a mismatched :id/:statementId pair is
  // treated as "not found," never silently falling back to a different
  // contract's statement.
  // ---------------------------------------------------------------------------

  private async loadStatementForContract(contractId: string, statementId: string): Promise<{ id: string; departmentId: string | null }> {
    const statement = await this.db.getClient().contractErectionMethodStatement.findFirst({
      where: { id: statementId, contractId },
      select: { id: true, contract: { select: { departmentId: true } } },
    });
    if (!statement) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_METHOD_STATEMENT_NOT_FOUND', message: 'Erection Method Statement not found' });
    }
    return { id: statement.id, departmentId: statement.contract.departmentId };
  }

  async listAttachments(contractId: string, statementId: string, actor: AuthUser): Promise<unknown[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    const { departmentId } = await this.loadStatementForContract(contractId, statementId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);

    return this.db.getClient().contractErectionMethodStatementAttachment.findMany({
      where: { methodStatementId: statementId },
      orderBy: [{ createdAt: 'desc' }],
      select: STATEMENT_ATTACHMENT_SELECT,
    });
  }

  async createAttachment(
    contractId: string,
    statementId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actor: AuthUser,
  ): Promise<unknown> {
    assertCanWriteErectionDepartmentStep(actor);
    const { departmentId } = await this.loadStatementForContract(contractId, statementId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);

    if (!(ERECTION_METHOD_STATEMENT_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ERECTION_METHOD_STATEMENT_ATTACHMENT_INVALID_TYPE',
        message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
      });
    }
    if (file.size > ERECTION_METHOD_STATEMENT_ATTACHMENT_MAX_BYTES) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ERECTION_METHOD_STATEMENT_ATTACHMENT_TOO_LARGE',
        message: `File exceeds the ${ERECTION_METHOD_STATEMENT_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB upload limit.`,
      });
    }

    const { fileName, storagePath } = await this.attachmentStorage.save(statementId, file.buffer, file.originalname);

    const attachment = await this.db.getClient().contractErectionMethodStatementAttachment.create({
      data: {
        methodStatementId: statementId,
        fileName,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath,
        uploadedByUserId: actor.id,
      },
      select: STATEMENT_ATTACHMENT_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, 'erection_method_statement_attachment_uploaded', {
      methodStatementId: statementId,
      attachmentId: attachment.id,
      fileName: file.originalname,
    });

    return attachment;
  }

  async getAttachmentForDownload(
    contractId: string,
    statementId: string,
    attachmentId: string,
    actor: AuthUser,
  ): Promise<{ storagePath: string; originalFileName: string; mimeType: string }> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const attachment = await this.db.getClient().contractErectionMethodStatementAttachment.findFirst({
      where: { id: attachmentId, methodStatementId: statementId, methodStatement: { contractId } },
      select: {
        storagePath: true,
        originalFileName: true,
        mimeType: true,
        methodStatement: { select: { contract: { select: { departmentId: true } } } },
      },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_METHOD_STATEMENT_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      attachment.methodStatement.contract.departmentId,
    );

    return {
      storagePath: attachment.storagePath,
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
    };
  }

  async deleteAttachment(contractId: string, statementId: string, attachmentId: string, actor: AuthUser): Promise<void> {
    assertCanWriteErectionDepartmentStep(actor);

    const attachment = await this.db.getClient().contractErectionMethodStatementAttachment.findFirst({
      where: { id: attachmentId, methodStatementId: statementId, methodStatement: { contractId } },
      select: {
        id: true,
        storagePath: true,
        originalFileName: true,
        methodStatement: { select: { contract: { select: { departmentId: true } } } },
      },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_METHOD_STATEMENT_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      attachment.methodStatement.contract.departmentId,
    );

    await this.db.getClient().contractErectionMethodStatementAttachment.delete({ where: { id: attachmentId } });
    await this.attachmentStorage.deleteFile(attachment.storagePath);

    await logContractActivity(this.db, contractId, actor, 'erection_method_statement_attachment_deleted', {
      methodStatementId: statementId,
      attachmentId,
      fileName: attachment.originalFileName,
    });
  }
}
