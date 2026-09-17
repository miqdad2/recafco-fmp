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
  ErectionChecklistAttachmentStorageService,
  ERECTION_CHECKLIST_ATTACHMENT_MAX_BYTES,
  ERECTION_CHECKLIST_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './erection-checklist-attachment-storage.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateContractErectionChecklistDto, ErectionChecklistItemInputDto } from './dto/create-contract-erection-checklist.dto';
import type { UpdateContractErectionChecklistDto } from './dto/update-contract-erection-checklist.dto';
import { logContractActivity } from './contract-activity-log';

// ---------------------------------------------------------------------------
// CM-71G — Erection Workflow, Step 6: Erection Checklist. Owned by the QA /
// QC Team (Erection Department / Site Team provides supporting documents
// and status; Contract Management tracks). Same "one-per-contract, create
// once, edit forever" shape as Steps 1/3/4/5. See the model's own doc
// comment in schema.prisma for why this is a DELIBERATELY SEPARATE model
// from Step 5's own pre-erection checklist (ContractErectionStartChecklist)
// — never reuses that step's rows/table for anything, per this unit's own
// "should not duplicate Step 5 exactly" instruction.
//
// erectionStartId is auto-derived server-side from the contract's real
// current Step 5 record at creation time (never frontend-supplied); so is
// jobOrderNo (auto-fetched from the contract, falling back to Step 5's own
// jobOrderNo), per this unit's own "Work Package / Area -> Job Order No.,
// auto fetch from contract" field correction.
//
// status never stores a "Ready for Verification" value, matching every
// earlier step's own "Ready to X" precedent — computed frontend-only. A
// dedicated "Verify" transition (VERIFIED) exists beyond the task's own
// explicitly-listed 4 buttons because VERIFIED is named as a real header
// status badge and referenced by the dashboard/workflow-tab integration —
// leaving it unreachable would contradict "every stored status should be
// reachable via a real button," applied consistently across every earlier
// erection-workflow unit.
//
// Checklist Items Summary is NEVER stored — always computed live from the
// real ContractErectionChecklistItem rows (computeChecklistItemsSummary),
// matching CM-71F's own Resources Summary precedent.
// ---------------------------------------------------------------------------

const HOLD_OR_RETURNED_STATUSES = ['HOLD', 'RETURNED'];

export function assertCommentsPresentForHoldOrReturn(status: string | undefined, comments: string | undefined): void {
  if (status && HOLD_OR_RETURNED_STATUSES.includes(status) && !comments?.trim()) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_ERECTION_CHECKLIST_COMMENTS_REQUIRED',
      message: 'Comments are required to place the checklist on Hold or Return it.',
    });
  }
}

/**
 * Submit for Verification has a stricter floor than Save Draft, matching
 * this unit's own explicit "Requires at least ... checklist rows" wording:
 * at least one checklist item row must exist. Checklist Ref. No./Date/Job
 * Order No./Checklist Type/Prepared By are already guaranteed non-empty by
 * the DTO's own required-field validation on every save (real non-nullable
 * columns) — only the genuinely submit-only requirement is checked here.
 */
export function assertSubmitRequirementsMet(status: string | undefined, items: unknown[] | undefined): void {
  if (status !== 'SUBMITTED_FOR_VERIFICATION') return;
  if (!items || items.length === 0) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_ERECTION_CHECKLIST_SUBMIT_REQUIREMENTS_NOT_MET',
      message: 'At least one checklist item row is required to submit for verification.',
    });
  }
}

/** Maps the resulting status to the activity event names this unit's own task explicitly named. */
export function computeErectionChecklistActivityEvent(status: string): string {
  switch (status) {
    case 'SUBMITTED_FOR_VERIFICATION':
      return 'erection_checklist_submitted_for_verification';
    case 'VERIFIED':
      return 'erection_checklist_verified';
    case 'HOLD':
      return 'erection_checklist_hold';
    case 'RETURNED':
      return 'erection_checklist_returned';
    default:
      return 'erection_checklist_draft_saved';
  }
}

export interface ChecklistItemsSummary {
  totalItems: number;
  completed: number;
  inProgress: number;
  notCompleted: number;
  notApplicable: number;
}

/** Real derived checklist items summary from the real item rows — never independently stored/user-entered. */
export function computeChecklistItemsSummary(items: { status: string }[]): ChecklistItemsSummary {
  return {
    totalItems: items.length,
    completed: items.filter((i) => i.status === 'COMPLETED').length,
    inProgress: items.filter((i) => i.status === 'IN_PROGRESS').length,
    notCompleted: items.filter((i) => i.status === 'NOT_COMPLETED').length,
    notApplicable: items.filter((i) => i.status === 'NOT_APPLICABLE').length,
  };
}

const DEFAULT_CHECKLIST_ITEMS = [
  'Approved Erection Method Statement Available',
  'Approved Erection Schedule Available',
  'Delivery Start Confirmed',
  'Material Receiving & Inspection Completed',
  'Material Test Certificates Available',
  'Equipment / Tools Available on Site',
  'Crane / Trailer Arrangement Verified',
  'Manpower Deployment Verified',
  'Site Access / Work Area Ready',
  'Erection Alignment / Installation Check Completed',
  'Safety Induction & Toolbox Talk Conducted',
  'Client / Consultant Acknowledgement Pending',
];

/** DB-stored DATE columns come back as UTC-midnight JS Dates — reformat to plain YYYY-MM-DD so native <input type="date"> never silently renders blank (same fix as CM-70F / CM-71A / CM-71D / CM-71E / CM-71F). */
function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

const ERECTION_CHECKLIST_SELECT = {
  id: true,
  contractId: true,
  erectionStartId: true,
  checklistRefNo: true,
  checklistDate: true,
  jobOrderNo: true,
  checklistType: true,
  preparedBy: true,
  reviewedByQaqc: true,
  verifiedByClientRepresentative: true,
  status: true,
  workLocationYard: true,
  comments: true,
  submittedAt: true,
  verifiedAt: true,
  createdByUser: { select: { id: true, displayName: true } },
  updatedByUser: { select: { id: true, displayName: true } },
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: { sortOrder: 'asc' as const },
    select: { id: true, checklistItem: true, status: true, remarks: true, attachmentRef: true },
  },
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

const ERECTION_CHECKLIST_ATTACHMENT_SELECT = {
  id: true,
  checklistId: true,
  originalFileName: true,
  mimeType: true,
  fileSize: true,
  createdAt: true,
  uploadedByUser: { select: { id: true, displayName: true } },
} as const;

function toResponseShape(row: {
  checklistDate: Date;
  items: { status: string }[];
  [key: string]: unknown;
}): Record<string, unknown> {
  return {
    ...row,
    checklistDate: isoDate(row.checklistDate) as string,
    itemsSummary: computeChecklistItemsSummary(row.items),
  };
}

@Injectable()
export class ContractErectionChecklistService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
    private readonly attachmentStorage: ErectionChecklistAttachmentStorageService,
  ) {}

  private async loadContract(contractId: string, actor: AuthUser): Promise<{ id: string; departmentId: string | null; jobOrder: string | null }> {
    const contract = await this.db.getClient().contract.findUnique({
      where: { id: contractId },
      select: { id: true, departmentId: true, jobOrder: true },
    });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);
    return contract;
  }

  /** Step 6 can only exist once Step 5 (erection start) has reached Started. */
  private async loadPrerequisite(contractId: string): Promise<{ erectionStartId: string | null; erectionStartStatus: string | null; erectionStartJobOrderNo: string | null }> {
    const erectionStart = await this.db.getClient().contractErectionStart.findUnique({
      where: { contractId },
      select: { id: true, status: true, jobOrderNo: true },
    });
    return {
      erectionStartId: erectionStart?.id ?? null,
      erectionStartStatus: erectionStart?.status ?? null,
      erectionStartJobOrderNo: erectionStart?.jobOrderNo ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // Get — returns null (not 404) when no checklist has been created yet;
  // "not created yet" is a normal, valid state for Step 6.
  // ---------------------------------------------------------------------------

  async getForContract(contractId: string, actor: AuthUser): Promise<unknown | null> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    await this.loadContract(contractId, actor);

    const checklist = await this.db.getClient().contractErectionChecklist.findUnique({
      where: { contractId },
      select: ERECTION_CHECKLIST_SELECT,
    });
    return checklist ? toResponseShape(checklist) : null;
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(contractId: string, dto: CreateContractErectionChecklistDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }
    const contract = await this.loadContract(contractId, actor);

    const prereq = await this.loadPrerequisite(contractId);
    if (!prereq.erectionStartId || prereq.erectionStartStatus !== 'STARTED') {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ERECTION_CHECKLIST_NO_ERECTION_START',
        message: 'Erection Start (Step 5) must be Started before the Erection Checklist can be created.',
      });
    }

    const existing = await this.db.getClient().contractErectionChecklist.findUnique({
      where: { contractId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'CONTRACT_ERECTION_CHECKLIST_ALREADY_EXISTS',
        message: 'An Erection Checklist already exists for this contract.',
      });
    }

    assertCommentsPresentForHoldOrReturn(dto.status, dto.comments);
    const status = dto.status ?? 'DRAFT';
    const items: ErectionChecklistItemInputDto[] =
      dto.items && dto.items.length > 0 ? dto.items : DEFAULT_CHECKLIST_ITEMS.map((checklistItem) => ({ checklistItem }));
    assertSubmitRequirementsMet(status, items);
    const jobOrderNo = contract.jobOrder ?? prereq.erectionStartJobOrderNo ?? '';

    const createdId = await this.db.getClient().$transaction(async (tx) => {
      const created = await tx.contractErectionChecklist.create({
        data: {
          contractId,
          erectionStartId: prereq.erectionStartId,
          jobOrderNo,
          createdByUserId: actor.id,
          checklistRefNo: dto.checklistRefNo,
          checklistDate: new Date(dto.checklistDate),
          checklistType: dto.checklistType,
          preparedBy: dto.preparedBy,
          reviewedByQaqc: dto.reviewedByQaqc || null,
          verifiedByClientRepresentative: dto.verifiedByClientRepresentative || null,
          workLocationYard: dto.workLocationYard || null,
          comments: dto.comments || null,
          status: status as never,
          ...(status === 'SUBMITTED_FOR_VERIFICATION' ? { submittedAt: new Date() } : {}),
          ...(status === 'VERIFIED' ? { verifiedAt: new Date() } : {}),
        },
        select: { id: true },
      });

      await tx.contractErectionChecklistItem.createMany({
        data: items.map((item, index) => ({
          checklistId: created.id,
          checklistItem: item.checklistItem,
          status: (item.status ?? 'NOT_COMPLETED') as never,
          remarks: item.remarks || null,
          attachmentRef: item.attachmentRef || null,
          sortOrder: index,
        })),
      });

      return created.id;
    });

    const created = await this.db.getClient().contractErectionChecklist.findUniqueOrThrow({
      where: { id: createdId },
      select: ERECTION_CHECKLIST_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, computeErectionChecklistActivityEvent(status), {
      checklistId: created.id,
      status,
    });

    return toResponseShape(created);
  }

  // ---------------------------------------------------------------------------
  // Update — no delete endpoint for the checklist record itself, matching
  // every other contract sub-record in this app.
  // ---------------------------------------------------------------------------

  private async loadChecklist(checklistId: string): Promise<{ id: string; contractId: string; status: string; departmentId: string | null }> {
    const checklist = await this.db.getClient().contractErectionChecklist.findUnique({
      where: { id: checklistId },
      select: { id: true, contractId: true, status: true, contract: { select: { departmentId: true } } },
    });
    if (!checklist) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_CHECKLIST_NOT_FOUND', message: 'Erection Checklist not found' });
    }
    return { id: checklist.id, contractId: checklist.contractId, status: checklist.status, departmentId: checklist.contract.departmentId };
  }

  async update(checklistId: string, dto: UpdateContractErectionChecklistDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }
    const existing = await this.loadChecklist(checklistId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, existing.departmentId);

    assertCommentsPresentForHoldOrReturn(dto.status, dto.comments);

    let itemsForValidation = dto.items;
    if (dto.status === 'SUBMITTED_FOR_VERIFICATION' && itemsForValidation === undefined) {
      itemsForValidation = await this.db.getClient().contractErectionChecklistItem.findMany({
        where: { checklistId },
        select: { checklistItem: true },
      });
    }
    assertSubmitRequirementsMet(dto.status, itemsForValidation);

    const isSubmitTransition = dto.status === 'SUBMITTED_FOR_VERIFICATION' && existing.status !== 'SUBMITTED_FOR_VERIFICATION';
    const isVerifyTransition = dto.status === 'VERIFIED' && existing.status !== 'VERIFIED';

    await this.db.getClient().$transaction(async (tx) => {
      if (dto.items !== undefined) {
        await tx.contractErectionChecklistItem.deleteMany({ where: { checklistId } });
        if (dto.items.length > 0) {
          await tx.contractErectionChecklistItem.createMany({
            data: dto.items.map((item, index) => ({
              checklistId,
              checklistItem: item.checklistItem,
              status: (item.status ?? 'NOT_COMPLETED') as never,
              remarks: item.remarks || null,
              attachmentRef: item.attachmentRef || null,
              sortOrder: index,
            })),
          });
        }
      }

      await tx.contractErectionChecklist.update({
        where: { id: checklistId },
        data: {
          updatedByUserId: actor.id,
          ...(dto.checklistRefNo !== undefined ? { checklistRefNo: dto.checklistRefNo } : {}),
          ...(dto.checklistDate !== undefined ? { checklistDate: new Date(dto.checklistDate) } : {}),
          ...(dto.checklistType !== undefined ? { checklistType: dto.checklistType } : {}),
          ...(dto.preparedBy !== undefined ? { preparedBy: dto.preparedBy } : {}),
          ...(dto.reviewedByQaqc !== undefined ? { reviewedByQaqc: dto.reviewedByQaqc || null } : {}),
          ...(dto.verifiedByClientRepresentative !== undefined ? { verifiedByClientRepresentative: dto.verifiedByClientRepresentative || null } : {}),
          ...(dto.workLocationYard !== undefined ? { workLocationYard: dto.workLocationYard || null } : {}),
          ...(dto.comments !== undefined ? { comments: dto.comments || null } : {}),
          ...(dto.status !== undefined ? { status: dto.status as never } : {}),
          ...(isSubmitTransition ? { submittedAt: new Date() } : {}),
          ...(isVerifyTransition ? { verifiedAt: new Date() } : {}),
        },
      });
    });

    const updated = await this.db.getClient().contractErectionChecklist.findUniqueOrThrow({
      where: { id: checklistId },
      select: ERECTION_CHECKLIST_SELECT,
    });

    await logContractActivity(
      this.db,
      existing.contractId,
      actor,
      computeErectionChecklistActivityEvent(dto.status ?? existing.status),
      { checklistId: updated.id, status: updated.status },
    );

    return toResponseShape(updated);
  }

  // ---------------------------------------------------------------------------
  // Attachments — metadata + storage-relative path only; binary data lives
  // on disk via ErectionChecklistAttachmentStorageService, never in the
  // database.
  // ---------------------------------------------------------------------------

  private async loadChecklistForContract(contractId: string, checklistId: string): Promise<{ id: string; departmentId: string | null }> {
    const checklist = await this.db.getClient().contractErectionChecklist.findFirst({
      where: { id: checklistId, contractId },
      select: { id: true, contract: { select: { departmentId: true } } },
    });
    if (!checklist) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_CHECKLIST_NOT_FOUND', message: 'Erection Checklist not found' });
    }
    return { id: checklist.id, departmentId: checklist.contract.departmentId };
  }

  async listAttachments(contractId: string, checklistId: string, actor: AuthUser): Promise<unknown[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    const { departmentId } = await this.loadChecklistForContract(contractId, checklistId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);

    return this.db.getClient().contractErectionChecklistAttachment.findMany({
      where: { checklistId },
      orderBy: [{ createdAt: 'desc' }],
      select: ERECTION_CHECKLIST_ATTACHMENT_SELECT,
    });
  }

  async createAttachment(
    contractId: string,
    checklistId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actor: AuthUser,
  ): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }
    const { departmentId } = await this.loadChecklistForContract(contractId, checklistId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);

    if (!(ERECTION_CHECKLIST_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ERECTION_CHECKLIST_ATTACHMENT_INVALID_TYPE',
        message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
      });
    }
    if (file.size > ERECTION_CHECKLIST_ATTACHMENT_MAX_BYTES) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ERECTION_CHECKLIST_ATTACHMENT_TOO_LARGE',
        message: `File exceeds the ${ERECTION_CHECKLIST_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB upload limit.`,
      });
    }

    const { fileName, storagePath } = await this.attachmentStorage.save(checklistId, file.buffer, file.originalname);

    const attachment = await this.db.getClient().contractErectionChecklistAttachment.create({
      data: {
        checklistId,
        fileName,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath,
        uploadedByUserId: actor.id,
      },
      select: ERECTION_CHECKLIST_ATTACHMENT_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, 'erection_checklist_attachment_uploaded', {
      checklistId,
      attachmentId: attachment.id,
      fileName: file.originalname,
    });

    return attachment;
  }

  async getAttachmentForDownload(
    contractId: string,
    checklistId: string,
    attachmentId: string,
    actor: AuthUser,
  ): Promise<{ storagePath: string; originalFileName: string; mimeType: string }> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const attachment = await this.db.getClient().contractErectionChecklistAttachment.findFirst({
      where: { id: attachmentId, checklistId, checklist: { contractId } },
      select: {
        storagePath: true,
        originalFileName: true,
        mimeType: true,
        checklist: { select: { contract: { select: { departmentId: true } } } },
      },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_CHECKLIST_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      attachment.checklist.contract.departmentId,
    );

    return {
      storagePath: attachment.storagePath,
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
    };
  }

  async deleteAttachment(contractId: string, checklistId: string, attachmentId: string, actor: AuthUser): Promise<void> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const attachment = await this.db.getClient().contractErectionChecklistAttachment.findFirst({
      where: { id: attachmentId, checklistId, checklist: { contractId } },
      select: {
        id: true,
        storagePath: true,
        originalFileName: true,
        checklist: { select: { contract: { select: { departmentId: true } } } },
      },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_CHECKLIST_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      attachment.checklist.contract.departmentId,
    );

    await this.db.getClient().contractErectionChecklistAttachment.delete({ where: { id: attachmentId } });
    await this.attachmentStorage.deleteFile(attachment.storagePath);

    await logContractActivity(this.db, contractId, actor, 'erection_checklist_attachment_deleted', {
      checklistId,
      attachmentId,
      fileName: attachment.originalFileName,
    });
  }
}
