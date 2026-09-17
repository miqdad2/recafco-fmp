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
  ErectionScheduleAttachmentStorageService,
  ERECTION_SCHEDULE_ATTACHMENT_MAX_BYTES,
  ERECTION_SCHEDULE_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './erection-schedule-attachment-storage.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateContractErectionScheduleDto } from './dto/create-contract-erection-schedule.dto';
import type { UpdateContractErectionScheduleDto } from './dto/update-contract-erection-schedule.dto';
import { logContractActivity } from './contract-activity-log';
import { assertCanWriteErectionDepartmentStep } from './erection-department-write-access';

// ---------------------------------------------------------------------------
// CM-71D — Erection Workflow, Step 3: Issue Erection Schedule. At most one
// schedule per contract (contractId is @unique) — the same "create once,
// edit forever" shape as CM-71A's Step 1. See the model's own doc comment
// in schema.prisma for why status never stores a "Ready to Issue" value
// (frontend-only computed badge, same as Step 1) and why
// methodStatementId/approvalId are only ever soft, informational links.
//
// Step 3 can only be created once Step 1 (the method statement) exists —
// the one HARD gate this service enforces, matching CM-71C's own
// Step-2-needs-Step-1 precedent exactly. Step 2's approval status is
// deliberately NOT hard-gated (a manager may want to prepare schedule data
// before the review formally completes) — the frontend shows a soft
// warning instead when the approval isn't Approved yet, same "gate on
// existence, warn on status" pattern CM-71C used for Step 1's exact status.
// ---------------------------------------------------------------------------

const HOLD_OR_RETURNED_STATUSES = ['HOLD', 'RETURNED'];

export function assertRemarksPresentForHoldOrReturn(status: string | undefined, remarks: string | undefined): void {
  if (status && HOLD_OR_RETURNED_STATUSES.includes(status) && !remarks?.trim()) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_ERECTION_SCHEDULE_REMARKS_REQUIRED',
      message: 'Remarks are required to place the schedule on Hold or Return it.',
    });
  }
}

/** Maps the resulting status to the activity event names this unit's own task explicitly named. */
export function computeScheduleActivityEvent(status: string): string {
  switch (status) {
    case 'ISSUED':
      return 'erection_schedule_issued';
    case 'HOLD':
      return 'erection_schedule_hold';
    case 'RETURNED':
      return 'erection_schedule_returned';
    default:
      return 'erection_schedule_draft_saved';
  }
}

const SCHEDULE_SELECT = {
  id: true,
  contractId: true,
  methodStatementId: true,
  approvalId: true,
  scheduleReferenceNo: true,
  scheduleDate: true,
  plannedStartDate: true,
  plannedEndDate: true,
  jobOrderNo: true,
  erectionCrewTeam: true,
  estimatedManpowerPlanned: true,
  requiredEquipmentPlanned: true,
  preparedBy: true,
  reviewedByErectionManager: true,
  reviewedOn: true,
  documentRevision: true,
  totalActivities: true,
  criticalActivities: true,
  status: true,
  remarks: true,
  issuedAt: true,
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

const SCHEDULE_ATTACHMENT_SELECT = {
  id: true,
  erectionScheduleId: true,
  originalFileName: true,
  mimeType: true,
  fileSize: true,
  createdAt: true,
  uploadedByUser: { select: { id: true, displayName: true } },
} as const;

/** DB-stored DATE columns come back as UTC-midnight JS Dates — reformat to plain YYYY-MM-DD so native <input type="date"> never silently renders blank (same fix as CM-70F / CM-71A / CM-71C). */
function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toResponseShape<T extends { scheduleDate: Date; plannedStartDate: Date; plannedEndDate: Date; reviewedOn: Date | null }>(
  row: T,
): Omit<T, 'scheduleDate' | 'plannedStartDate' | 'plannedEndDate' | 'reviewedOn'> & {
  scheduleDate: string;
  plannedStartDate: string;
  plannedEndDate: string;
  reviewedOn: string | null;
} {
  return {
    ...row,
    scheduleDate: isoDate(row.scheduleDate) as string,
    plannedStartDate: isoDate(row.plannedStartDate) as string,
    plannedEndDate: isoDate(row.plannedEndDate) as string,
    reviewedOn: isoDate(row.reviewedOn),
  };
}

@Injectable()
export class ContractErectionScheduleService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
    private readonly attachmentStorage: ErectionScheduleAttachmentStorageService,
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

  /** Step 3 can only exist once Step 1 (and, informationally, Step 2 if it exists) do. */
  private async loadPrerequisites(contractId: string): Promise<{ methodStatementId: string | null; approvalId: string | null }> {
    const statement = await this.db.getClient().contractErectionMethodStatement.findUnique({
      where: { contractId },
      select: { id: true, approval: { select: { id: true } } },
    });
    return { methodStatementId: statement?.id ?? null, approvalId: statement?.approval?.id ?? null };
  }

  // ---------------------------------------------------------------------------
  // Get — returns null (not 404) when no schedule has been created yet;
  // "not created yet" is a normal, valid state for Step 3 of a workflow.
  // ---------------------------------------------------------------------------

  async getForContract(contractId: string, actor: AuthUser): Promise<unknown | null> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    await this.loadContract(contractId, actor);

    const schedule = await this.db.getClient().contractErectionSchedule.findUnique({
      where: { contractId },
      select: SCHEDULE_SELECT,
    });
    return schedule ? toResponseShape(schedule) : null;
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(contractId: string, dto: CreateContractErectionScheduleDto, actor: AuthUser): Promise<unknown> {
    assertCanWriteErectionDepartmentStep(actor);
    await this.loadContract(contractId, actor);

    const { methodStatementId, approvalId } = await this.loadPrerequisites(contractId);
    if (!methodStatementId) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ERECTION_SCHEDULE_NO_METHOD_STATEMENT',
        message: 'The Erection Method Statement (Step 1) must exist before the Erection Schedule can be created.',
      });
    }

    const existing = await this.db.getClient().contractErectionSchedule.findUnique({
      where: { contractId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'CONTRACT_ERECTION_SCHEDULE_ALREADY_EXISTS',
        message: 'An Erection Schedule already exists for this contract.',
      });
    }

    assertRemarksPresentForHoldOrReturn(dto.status, dto.remarks);
    const status = dto.status ?? 'DRAFT';

    const created = await this.db.getClient().contractErectionSchedule.create({
      data: {
        contractId,
        methodStatementId,
        approvalId,
        createdByUserId: actor.id,
        scheduleReferenceNo: dto.scheduleReferenceNo,
        scheduleDate: new Date(dto.scheduleDate),
        plannedStartDate: new Date(dto.plannedStartDate),
        plannedEndDate: new Date(dto.plannedEndDate),
        jobOrderNo: dto.jobOrderNo,
        erectionCrewTeam: dto.erectionCrewTeam,
        estimatedManpowerPlanned: dto.estimatedManpowerPlanned,
        requiredEquipmentPlanned: dto.requiredEquipmentPlanned,
        preparedBy: dto.preparedBy,
        ...(dto.reviewedByErectionManager !== undefined ? { reviewedByErectionManager: dto.reviewedByErectionManager || null } : {}),
        ...(dto.reviewedOn !== undefined ? { reviewedOn: dto.reviewedOn ? new Date(dto.reviewedOn) : null } : {}),
        ...(dto.documentRevision !== undefined ? { documentRevision: dto.documentRevision || null } : {}),
        ...(dto.totalActivities !== undefined ? { totalActivities: dto.totalActivities } : {}),
        ...(dto.criticalActivities !== undefined ? { criticalActivities: dto.criticalActivities } : {}),
        status: status as never,
        ...(dto.remarks !== undefined ? { remarks: dto.remarks || null } : {}),
        ...(status === 'ISSUED' ? { issuedAt: new Date() } : {}),
      },
      select: SCHEDULE_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, computeScheduleActivityEvent(status), {
      erectionScheduleId: created.id,
      status,
    });

    return toResponseShape(created);
  }

  // ---------------------------------------------------------------------------
  // Update — no delete endpoint for the schedule itself, matching every
  // other contract sub-record in this app.
  // ---------------------------------------------------------------------------

  private async loadSchedule(scheduleId: string): Promise<{ id: string; contractId: string; status: string; departmentId: string | null }> {
    const schedule = await this.db.getClient().contractErectionSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true, contractId: true, status: true, contract: { select: { departmentId: true } } },
    });
    if (!schedule) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_SCHEDULE_NOT_FOUND', message: 'Erection Schedule not found' });
    }
    return { id: schedule.id, contractId: schedule.contractId, status: schedule.status, departmentId: schedule.contract.departmentId };
  }

  async update(scheduleId: string, dto: UpdateContractErectionScheduleDto, actor: AuthUser): Promise<unknown> {
    assertCanWriteErectionDepartmentStep(actor);
    const existing = await this.loadSchedule(scheduleId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, existing.departmentId);

    assertRemarksPresentForHoldOrReturn(dto.status, dto.remarks);
    const isIssueTransition = dto.status === 'ISSUED' && existing.status !== 'ISSUED';

    const updated = await this.db.getClient().contractErectionSchedule.update({
      where: { id: scheduleId },
      data: {
        updatedByUserId: actor.id,
        ...(dto.scheduleReferenceNo !== undefined ? { scheduleReferenceNo: dto.scheduleReferenceNo } : {}),
        ...(dto.scheduleDate !== undefined ? { scheduleDate: new Date(dto.scheduleDate) } : {}),
        ...(dto.plannedStartDate !== undefined ? { plannedStartDate: new Date(dto.plannedStartDate) } : {}),
        ...(dto.plannedEndDate !== undefined ? { plannedEndDate: new Date(dto.plannedEndDate) } : {}),
        ...(dto.jobOrderNo !== undefined ? { jobOrderNo: dto.jobOrderNo } : {}),
        ...(dto.erectionCrewTeam !== undefined ? { erectionCrewTeam: dto.erectionCrewTeam } : {}),
        ...(dto.estimatedManpowerPlanned !== undefined ? { estimatedManpowerPlanned: dto.estimatedManpowerPlanned } : {}),
        ...(dto.requiredEquipmentPlanned !== undefined ? { requiredEquipmentPlanned: dto.requiredEquipmentPlanned } : {}),
        ...(dto.preparedBy !== undefined ? { preparedBy: dto.preparedBy } : {}),
        ...(dto.reviewedByErectionManager !== undefined ? { reviewedByErectionManager: dto.reviewedByErectionManager || null } : {}),
        ...(dto.reviewedOn !== undefined ? { reviewedOn: dto.reviewedOn ? new Date(dto.reviewedOn) : null } : {}),
        ...(dto.documentRevision !== undefined ? { documentRevision: dto.documentRevision || null } : {}),
        ...(dto.totalActivities !== undefined ? { totalActivities: dto.totalActivities } : {}),
        ...(dto.criticalActivities !== undefined ? { criticalActivities: dto.criticalActivities } : {}),
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks || null } : {}),
        ...(isIssueTransition ? { issuedAt: new Date() } : {}),
      },
      select: SCHEDULE_SELECT,
    });

    await logContractActivity(
      this.db,
      existing.contractId,
      actor,
      computeScheduleActivityEvent(dto.status ?? existing.status),
      { erectionScheduleId: updated.id, status: updated.status },
    );

    return toResponseShape(updated);
  }

  // ---------------------------------------------------------------------------
  // Attachments — metadata + storage-relative path only; binary data lives on
  // disk via ErectionScheduleAttachmentStorageService, never in the
  // database.
  // ---------------------------------------------------------------------------

  private async loadScheduleForContract(contractId: string, scheduleId: string): Promise<{ id: string; departmentId: string | null }> {
    const schedule = await this.db.getClient().contractErectionSchedule.findFirst({
      where: { id: scheduleId, contractId },
      select: { id: true, contract: { select: { departmentId: true } } },
    });
    if (!schedule) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_SCHEDULE_NOT_FOUND', message: 'Erection Schedule not found' });
    }
    return { id: schedule.id, departmentId: schedule.contract.departmentId };
  }

  async listAttachments(contractId: string, scheduleId: string, actor: AuthUser): Promise<unknown[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    const { departmentId } = await this.loadScheduleForContract(contractId, scheduleId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);

    return this.db.getClient().contractErectionScheduleAttachment.findMany({
      where: { erectionScheduleId: scheduleId },
      orderBy: [{ createdAt: 'desc' }],
      select: SCHEDULE_ATTACHMENT_SELECT,
    });
  }

  async createAttachment(
    contractId: string,
    scheduleId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actor: AuthUser,
  ): Promise<unknown> {
    assertCanWriteErectionDepartmentStep(actor);
    const { departmentId } = await this.loadScheduleForContract(contractId, scheduleId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);

    if (!(ERECTION_SCHEDULE_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ERECTION_SCHEDULE_ATTACHMENT_INVALID_TYPE',
        message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
      });
    }
    if (file.size > ERECTION_SCHEDULE_ATTACHMENT_MAX_BYTES) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ERECTION_SCHEDULE_ATTACHMENT_TOO_LARGE',
        message: `File exceeds the ${ERECTION_SCHEDULE_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB upload limit.`,
      });
    }

    const { fileName, storagePath } = await this.attachmentStorage.save(scheduleId, file.buffer, file.originalname);

    const attachment = await this.db.getClient().contractErectionScheduleAttachment.create({
      data: {
        erectionScheduleId: scheduleId,
        fileName,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath,
        uploadedByUserId: actor.id,
      },
      select: SCHEDULE_ATTACHMENT_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, 'erection_schedule_attachment_uploaded', {
      erectionScheduleId: scheduleId,
      attachmentId: attachment.id,
      fileName: file.originalname,
    });

    return attachment;
  }

  async getAttachmentForDownload(
    contractId: string,
    scheduleId: string,
    attachmentId: string,
    actor: AuthUser,
  ): Promise<{ storagePath: string; originalFileName: string; mimeType: string }> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const attachment = await this.db.getClient().contractErectionScheduleAttachment.findFirst({
      where: { id: attachmentId, erectionScheduleId: scheduleId, erectionSchedule: { contractId } },
      select: {
        storagePath: true,
        originalFileName: true,
        mimeType: true,
        erectionSchedule: { select: { contract: { select: { departmentId: true } } } },
      },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_SCHEDULE_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      attachment.erectionSchedule.contract.departmentId,
    );

    return {
      storagePath: attachment.storagePath,
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
    };
  }

  async deleteAttachment(contractId: string, scheduleId: string, attachmentId: string, actor: AuthUser): Promise<void> {
    assertCanWriteErectionDepartmentStep(actor);

    const attachment = await this.db.getClient().contractErectionScheduleAttachment.findFirst({
      where: { id: attachmentId, erectionScheduleId: scheduleId, erectionSchedule: { contractId } },
      select: {
        id: true,
        storagePath: true,
        originalFileName: true,
        erectionSchedule: { select: { contract: { select: { departmentId: true } } } },
      },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_SCHEDULE_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      attachment.erectionSchedule.contract.departmentId,
    );

    await this.db.getClient().contractErectionScheduleAttachment.delete({ where: { id: attachmentId } });
    await this.attachmentStorage.deleteFile(attachment.storagePath);

    await logContractActivity(this.db, contractId, actor, 'erection_schedule_attachment_deleted', {
      erectionScheduleId: scheduleId,
      attachmentId,
      fileName: attachment.originalFileName,
    });
  }
}
