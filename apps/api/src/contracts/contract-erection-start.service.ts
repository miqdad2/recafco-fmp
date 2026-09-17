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
  ErectionStartAttachmentStorageService,
  ERECTION_START_ATTACHMENT_MAX_BYTES,
  ERECTION_START_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './erection-start-attachment-storage.service';
import type { AuthUser } from '../common/types/auth-user';
import {
  CONTRACT_ERECTION_START_CHECKLIST_ITEMS,
  type CreateContractErectionStartDto,
  type ErectionStartManpowerInputDto,
  type ErectionStartEquipmentInputDto,
  type ErectionStartChecklistInputDto,
} from './dto/create-contract-erection-start.dto';
import type { UpdateContractErectionStartDto } from './dto/update-contract-erection-start.dto';
import { logContractActivity } from './contract-activity-log';
import { assertCanWriteErectionDepartmentStep } from './erection-department-write-access';

// ---------------------------------------------------------------------------
// CM-71F — Erection Workflow, Step 5: Erection Start. Owned by the Erection
// Department / Site-Erection Team (Contract Management tracks; Delivery /
// Logistics completed Step 4 beforehand — see the service's own hard gate
// below). At most one erection-start record per contract (contractId is
// @unique) — same "create once, edit forever" shape as Steps 1/3/4.
//
// deliveryStartId/erectionScheduleId/jobOrderNo/plannedStartDate/
// methodStatementRefNo are ALL auto-derived server-side at creation time —
// never frontend-supplied — per this unit's own explicit field corrections
// ("Job Order No. ... auto fetch from contract", "Planned Start Date ...
// from Step 3 schedule if available", "Method Statement Ref. read-only if
// available"). These are one-time snapshots taken at creation, not
// re-derived on every update (matching "read-only" framing).
//
// status never stores a "Ready to Start" value, matching every earlier
// step's own "Ready to X" precedent — computed frontend-only.
//
// Resources Summary (Total Manpower/Equipment/Crane/Trailer Assigned) is
// NEVER stored — this unit's own suggested ContractErectionStart schema has
// no summary columns, unlike Step 4's totalPackages/etc — so it is always
// computed live from the real manpower/equipment rows on every read
// (computeResourcesSummary), which is strictly more honest than a stored
// value that could drift.
// ---------------------------------------------------------------------------

const HOLD_OR_RETURNED_STATUSES = ['HOLD', 'RETURNED'];

export function assertCommentsPresentForHoldOrReturn(status: string | undefined, comments: string | undefined): void {
  if (status && HOLD_OR_RETURNED_STATUSES.includes(status) && !comments?.trim()) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_ERECTION_START_COMMENTS_REQUIRED',
      message: 'Comments are required to place erection start on Hold or Return it.',
    });
  }
}

/**
 * Confirm (STARTED) has a stricter floor than Save Draft, matching this
 * unit's own explicit "Confirm Erection Start ... Requires at least" list:
 * actual start date/time, and at least one manpower row with a positive
 * Actual Deployed count. Work Location/Supervisor/Scope of Work Today are
 * already guaranteed non-empty by the DTO's own required-field validation
 * on every save (real non-nullable columns) — only the 2 genuinely
 * confirm-only requirements are checked here. The crane/trailer equipment
 * requirement is deliberately NOT hard-enforced server-side — the task's
 * own "if applicable" wording means this cannot be reliably determined
 * automatically; it is surfaced as a client-side soft note instead.
 */
export function assertConfirmRequirementsMet(
  status: string | undefined,
  actualStartDateTime: string | undefined,
  manpowerRows: { actualDeployedNos?: number }[] | undefined,
): void {
  if (status !== 'STARTED') return;

  const errors: string[] = [];
  if (!actualStartDateTime) errors.push('Actual Start Date / Time is required to confirm Erection Start.');
  if (!manpowerRows?.some((r) => (r.actualDeployedNos ?? 0) > 0)) {
    errors.push('At least one manpower/work activity row must have Actual Deployed Nos. greater than 0.');
  }
  if (errors.length > 0) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_ERECTION_START_CONFIRM_REQUIREMENTS_NOT_MET',
      message: errors.join(' '),
    });
  }
}

/** Maps the resulting status to the activity event names this unit's own task explicitly named. */
export function computeErectionStartActivityEvent(status: string): string {
  switch (status) {
    case 'STARTED':
      return 'erection_start_confirmed';
    case 'HOLD':
      return 'erection_start_hold';
    case 'RETURNED':
      return 'erection_start_returned';
    default:
      return 'erection_start_draft_saved';
  }
}

export interface ResourcesSummary {
  totalManpower: number;
  totalEquipment: number;
  craneAssigned: number;
  trailerAssigned: number;
}

/**
 * Real derived resources summary from the real manpower/equipment rows —
 * never independently stored/user-entered. Crane/Trailer counts match by
 * case-insensitive substring on equipmentType, since equipment type is
 * free text (a site can type "Mobile Crane", "50T Crane", etc.), per this
 * unit's own "allow user to type their own value" instruction.
 */
export function computeResourcesSummary(
  manpowerRows: { actualDeployedNos: number }[],
  equipmentRows: { equipmentType: string; assignedQty: number }[],
): ResourcesSummary {
  return {
    totalManpower: manpowerRows.reduce((sum, r) => sum + r.actualDeployedNos, 0),
    totalEquipment: equipmentRows.reduce((sum, r) => sum + r.assignedQty, 0),
    craneAssigned: equipmentRows.filter((r) => r.equipmentType.toLowerCase().includes('crane')).length,
    trailerAssigned: equipmentRows.filter((r) => r.equipmentType.toLowerCase().includes('trailer')).length,
  };
}

const DEFAULT_MANPOWER_TRADES = [
  'Rigger', 'Mason', 'Welder', 'Foreman', 'Helper', 'Carpenter', 'Steel Fixer', 'Crane Operator', 'Trailer Driver', 'Other',
];

function toNum(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

/** DB-stored DATE columns come back as UTC-midnight JS Dates — reformat to plain YYYY-MM-DD so native <input type="date"> never silently renders blank (same fix as CM-70F / CM-71A / CM-71D / CM-71E). */
function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

const ERECTION_START_SELECT = {
  id: true,
  contractId: true,
  deliveryStartId: true,
  erectionScheduleId: true,
  jobOrderNo: true,
  plannedStartDate: true,
  actualStartDateTime: true,
  workLocationYard: true,
  erectionCrewTeam: true,
  supervisor: true,
  weatherCondition: true,
  windSpeed: true,
  methodStatementRefNo: true,
  scopeOfWorkToday: true,
  status: true,
  comments: true,
  confirmedAt: true,
  createdByUser: { select: { id: true, displayName: true } },
  updatedByUser: { select: { id: true, displayName: true } },
  createdAt: true,
  updatedAt: true,
  manpowerRows: {
    orderBy: { sortOrder: 'asc' as const },
    select: { id: true, trade: true, plannedNos: true, actualDeployedNos: true, remarks: true },
  },
  equipmentRows: {
    orderBy: { sortOrder: 'asc' as const },
    select: { id: true, equipmentType: true, descriptionCapacity: true, ownedOrRental: true, assignedQty: true, operatorDriver: true, remarks: true },
  },
  checklistRows: {
    orderBy: { sortOrder: 'asc' as const },
    select: { id: true, checklistItem: true, status: true, remarks: true },
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

const ERECTION_START_ATTACHMENT_SELECT = {
  id: true,
  erectionStartId: true,
  originalFileName: true,
  mimeType: true,
  fileSize: true,
  createdAt: true,
  uploadedByUser: { select: { id: true, displayName: true } },
} as const;

function toResponseShape(row: {
  plannedStartDate: Date | null;
  actualStartDateTime: Date | null;
  manpowerRows: { actualDeployedNos: unknown }[];
  equipmentRows: { equipmentType: string; assignedQty: unknown }[];
  [key: string]: unknown;
}): Record<string, unknown> {
  const manpowerRows = row.manpowerRows.map((r) => ({ ...r, actualDeployedNos: toNum(r.actualDeployedNos) }));
  const equipmentRows = row.equipmentRows.map((r) => ({ ...r, assignedQty: toNum(r.assignedQty) }));
  return {
    ...row,
    plannedStartDate: isoDate(row.plannedStartDate),
    actualStartDateTime: row.actualStartDateTime ? row.actualStartDateTime.toISOString() : null,
    manpowerRows,
    equipmentRows,
    resourcesSummary: computeResourcesSummary(
      manpowerRows.map((r) => ({ actualDeployedNos: toNum(r.actualDeployedNos) })),
      equipmentRows.map((r) => ({ equipmentType: r.equipmentType, assignedQty: toNum(r.assignedQty) })),
    ),
  };
}

@Injectable()
export class ContractErectionStartService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
    private readonly attachmentStorage: ErectionStartAttachmentStorageService,
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

  /** Step 5 can only exist once Step 4 (delivery start) has reached Started. */
  private async loadPrerequisite(contractId: string): Promise<{
    deliveryStartId: string | null;
    deliveryStartStatus: string | null;
    erectionScheduleId: string | null;
    plannedStartDate: Date | null;
    methodStatementRefNo: string | null;
    scheduleJobOrderNo: string | null;
  }> {
    const [deliveryStart, schedule, statement] = await Promise.all([
      this.db.getClient().contractErectionDeliveryStart.findUnique({
        where: { contractId },
        select: { id: true, status: true },
      }),
      this.db.getClient().contractErectionSchedule.findUnique({
        where: { contractId },
        select: { id: true, plannedStartDate: true, jobOrderNo: true },
      }),
      this.db.getClient().contractErectionMethodStatement.findUnique({
        where: { contractId },
        select: { methodStatementRefNo: true },
      }),
    ]);
    return {
      deliveryStartId: deliveryStart?.id ?? null,
      deliveryStartStatus: deliveryStart?.status ?? null,
      erectionScheduleId: schedule?.id ?? null,
      plannedStartDate: schedule?.plannedStartDate ?? null,
      methodStatementRefNo: statement?.methodStatementRefNo ?? null,
      scheduleJobOrderNo: schedule?.jobOrderNo ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // Get — returns null (not 404) when no erection-start record has been
  // created yet; "not created yet" is a normal, valid state for Step 5.
  // ---------------------------------------------------------------------------

  async getForContract(contractId: string, actor: AuthUser): Promise<unknown | null> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    await this.loadContract(contractId, actor);

    const erectionStart = await this.db.getClient().contractErectionStart.findUnique({
      where: { contractId },
      select: ERECTION_START_SELECT,
    });
    return erectionStart ? toResponseShape(erectionStart) : null;
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(contractId: string, dto: CreateContractErectionStartDto, actor: AuthUser): Promise<unknown> {
    assertCanWriteErectionDepartmentStep(actor);
    const contract = await this.loadContract(contractId, actor);

    const prereq = await this.loadPrerequisite(contractId);
    if (!prereq.deliveryStartId || prereq.deliveryStartStatus !== 'STARTED') {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ERECTION_START_NO_DELIVERY_START',
        message: 'Delivery Start (Step 4) must be Started before Erection Start can be created.',
      });
    }

    const existing = await this.db.getClient().contractErectionStart.findUnique({
      where: { contractId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'CONTRACT_ERECTION_START_ALREADY_EXISTS',
        message: 'An Erection Start record already exists for this contract.',
      });
    }

    assertCommentsPresentForHoldOrReturn(dto.status, dto.comments);
    assertConfirmRequirementsMet(dto.status, dto.actualStartDateTime, dto.manpowerRows);
    const status = dto.status ?? 'DRAFT';
    const jobOrderNo = contract.jobOrder ?? prereq.scheduleJobOrderNo ?? '';

    const manpowerInput: ErectionStartManpowerInputDto[] =
      dto.manpowerRows && dto.manpowerRows.length > 0
        ? dto.manpowerRows
        : DEFAULT_MANPOWER_TRADES.map((trade) => ({ trade, plannedNos: 0, actualDeployedNos: 0 }));
    const equipmentInput: ErectionStartEquipmentInputDto[] = dto.equipmentRows ?? [];

    const createdId = await this.db.getClient().$transaction(async (tx) => {
      const created = await tx.contractErectionStart.create({
        data: {
          contractId,
          deliveryStartId: prereq.deliveryStartId,
          erectionScheduleId: prereq.erectionScheduleId,
          jobOrderNo,
          plannedStartDate: prereq.plannedStartDate,
          methodStatementRefNo: prereq.methodStatementRefNo,
          createdByUserId: actor.id,
          ...(dto.actualStartDateTime !== undefined ? { actualStartDateTime: new Date(dto.actualStartDateTime) } : {}),
          workLocationYard: dto.workLocationYard,
          erectionCrewTeam: dto.erectionCrewTeam,
          supervisor: dto.supervisor,
          weatherCondition: dto.weatherCondition || null,
          windSpeed: dto.windSpeed || null,
          scopeOfWorkToday: dto.scopeOfWorkToday,
          status: status as never,
          comments: dto.comments || null,
          ...(status === 'STARTED' ? { confirmedAt: new Date() } : {}),
        },
        select: { id: true },
      });

      await tx.contractErectionStartManpower.createMany({
        data: manpowerInput.map((row, index) => ({
          erectionStartId: created.id,
          trade: row.trade,
          plannedNos: row.plannedNos ?? 0,
          actualDeployedNos: row.actualDeployedNos ?? 0,
          remarks: row.remarks || null,
          sortOrder: index,
        })),
      });

      if (equipmentInput.length > 0) {
        await tx.contractErectionStartEquipment.createMany({
          data: equipmentInput.map((row, index) => ({
            erectionStartId: created.id,
            equipmentType: row.equipmentType,
            descriptionCapacity: row.descriptionCapacity,
            ownedOrRental: row.ownedOrRental,
            assignedQty: row.assignedQty ?? 0,
            operatorDriver: row.operatorDriver || null,
            remarks: row.remarks || null,
            sortOrder: index,
          })),
        });
      }

      await this.seedOrUpdateChecklist(tx, created.id, dto.checklistRows);

      return created.id;
    });

    const created = await this.db.getClient().contractErectionStart.findUniqueOrThrow({
      where: { id: createdId },
      select: ERECTION_START_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, computeErectionStartActivityEvent(status), {
      erectionStartId: created.id,
      status,
    });

    return toResponseShape(created);
  }

  /** Seeds the fixed 10-item checklist on create (PENDING by default), or applies client-requested status overrides on either create or update — never fabricates COMPLETED. */
  private async seedOrUpdateChecklist(
    tx: Parameters<Parameters<ReturnType<DatabaseService['getClient']>['$transaction']>[0]>[0],
    erectionStartId: string,
    checklistRows: ErectionStartChecklistInputDto[] | undefined,
  ): Promise<void> {
    const byItem = new Map((checklistRows ?? []).map((c) => [c.checklistItem, c]));

    for (const [index, checklistItem] of CONTRACT_ERECTION_START_CHECKLIST_ITEMS.entries()) {
      const requested = byItem.get(checklistItem);
      const status = requested?.status ?? 'PENDING';

      await tx.contractErectionStartChecklist.upsert({
        where: { erectionStartId_checklistItem: { erectionStartId, checklistItem } },
        create: {
          erectionStartId,
          checklistItem,
          status: status as never,
          remarks: requested?.remarks || null,
          sortOrder: index,
        },
        update: {
          status: status as never,
          remarks: requested?.remarks || null,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Update — no delete endpoint for the erection-start record itself,
  // matching every other contract sub-record in this app.
  // ---------------------------------------------------------------------------

  private async loadErectionStart(erectionStartId: string): Promise<{ id: string; contractId: string; status: string; departmentId: string | null }> {
    const erectionStart = await this.db.getClient().contractErectionStart.findUnique({
      where: { id: erectionStartId },
      select: { id: true, contractId: true, status: true, contract: { select: { departmentId: true } } },
    });
    if (!erectionStart) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_START_NOT_FOUND', message: 'Erection Start record not found' });
    }
    return { id: erectionStart.id, contractId: erectionStart.contractId, status: erectionStart.status, departmentId: erectionStart.contract.departmentId };
  }

  async update(erectionStartId: string, dto: UpdateContractErectionStartDto, actor: AuthUser): Promise<unknown> {
    assertCanWriteErectionDepartmentStep(actor);
    const existing = await this.loadErectionStart(erectionStartId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, existing.departmentId);

    assertCommentsPresentForHoldOrReturn(dto.status, dto.comments);

    let manpowerForValidation: { actualDeployedNos?: number }[] | undefined = dto.manpowerRows;
    if (dto.status === 'STARTED' && manpowerForValidation === undefined) {
      const currentManpower = await this.db.getClient().contractErectionStartManpower.findMany({
        where: { erectionStartId },
        select: { actualDeployedNos: true },
      });
      manpowerForValidation = currentManpower.map((r) => ({ actualDeployedNos: toNum(r.actualDeployedNos) }));
    }
    let actualStartDateTimeForValidation = dto.actualStartDateTime;
    if (dto.status === 'STARTED' && actualStartDateTimeForValidation === undefined) {
      const current = await this.db.getClient().contractErectionStart.findUnique({
        where: { id: erectionStartId },
        select: { actualStartDateTime: true },
      });
      actualStartDateTimeForValidation = current?.actualStartDateTime ? current.actualStartDateTime.toISOString() : undefined;
    }
    assertConfirmRequirementsMet(dto.status, actualStartDateTimeForValidation, manpowerForValidation);

    const isConfirmTransition = dto.status === 'STARTED' && existing.status !== 'STARTED';

    await this.db.getClient().$transaction(async (tx) => {
      if (dto.manpowerRows !== undefined) {
        await tx.contractErectionStartManpower.deleteMany({ where: { erectionStartId } });
        if (dto.manpowerRows.length > 0) {
          await tx.contractErectionStartManpower.createMany({
            data: dto.manpowerRows.map((row, index) => ({
              erectionStartId,
              trade: row.trade,
              plannedNos: row.plannedNos ?? 0,
              actualDeployedNos: row.actualDeployedNos ?? 0,
              remarks: row.remarks || null,
              sortOrder: index,
            })),
          });
        }
      }

      if (dto.equipmentRows !== undefined) {
        await tx.contractErectionStartEquipment.deleteMany({ where: { erectionStartId } });
        if (dto.equipmentRows.length > 0) {
          await tx.contractErectionStartEquipment.createMany({
            data: dto.equipmentRows.map((row, index) => ({
              erectionStartId,
              equipmentType: row.equipmentType,
              descriptionCapacity: row.descriptionCapacity,
              ownedOrRental: row.ownedOrRental,
              assignedQty: row.assignedQty ?? 0,
              operatorDriver: row.operatorDriver || null,
              remarks: row.remarks || null,
              sortOrder: index,
            })),
          });
        }
      }

      if (dto.checklistRows !== undefined) {
        await this.seedOrUpdateChecklist(tx, erectionStartId, dto.checklistRows);
      }

      await tx.contractErectionStart.update({
        where: { id: erectionStartId },
        data: {
          updatedByUserId: actor.id,
          ...(dto.actualStartDateTime !== undefined ? { actualStartDateTime: new Date(dto.actualStartDateTime) } : {}),
          ...(dto.workLocationYard !== undefined ? { workLocationYard: dto.workLocationYard } : {}),
          ...(dto.erectionCrewTeam !== undefined ? { erectionCrewTeam: dto.erectionCrewTeam } : {}),
          ...(dto.supervisor !== undefined ? { supervisor: dto.supervisor } : {}),
          ...(dto.weatherCondition !== undefined ? { weatherCondition: dto.weatherCondition || null } : {}),
          ...(dto.windSpeed !== undefined ? { windSpeed: dto.windSpeed || null } : {}),
          ...(dto.scopeOfWorkToday !== undefined ? { scopeOfWorkToday: dto.scopeOfWorkToday } : {}),
          ...(dto.status !== undefined ? { status: dto.status as never } : {}),
          ...(dto.comments !== undefined ? { comments: dto.comments || null } : {}),
          ...(isConfirmTransition ? { confirmedAt: new Date() } : {}),
        },
      });
    });

    const updated = await this.db.getClient().contractErectionStart.findUniqueOrThrow({
      where: { id: erectionStartId },
      select: ERECTION_START_SELECT,
    });

    await logContractActivity(
      this.db,
      existing.contractId,
      actor,
      computeErectionStartActivityEvent(dto.status ?? existing.status),
      { erectionStartId: updated.id, status: updated.status },
    );

    return toResponseShape(updated);
  }

  // ---------------------------------------------------------------------------
  // Attachments — metadata + storage-relative path only; binary data lives
  // on disk via ErectionStartAttachmentStorageService, never in the
  // database.
  // ---------------------------------------------------------------------------

  private async loadErectionStartForContract(contractId: string, erectionStartId: string): Promise<{ id: string; departmentId: string | null }> {
    const erectionStart = await this.db.getClient().contractErectionStart.findFirst({
      where: { id: erectionStartId, contractId },
      select: { id: true, contract: { select: { departmentId: true } } },
    });
    if (!erectionStart) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_START_NOT_FOUND', message: 'Erection Start record not found' });
    }
    return { id: erectionStart.id, departmentId: erectionStart.contract.departmentId };
  }

  async listAttachments(contractId: string, erectionStartId: string, actor: AuthUser): Promise<unknown[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    const { departmentId } = await this.loadErectionStartForContract(contractId, erectionStartId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);

    return this.db.getClient().contractErectionStartAttachment.findMany({
      where: { erectionStartId },
      orderBy: [{ createdAt: 'desc' }],
      select: ERECTION_START_ATTACHMENT_SELECT,
    });
  }

  async createAttachment(
    contractId: string,
    erectionStartId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actor: AuthUser,
  ): Promise<unknown> {
    assertCanWriteErectionDepartmentStep(actor);
    const { departmentId } = await this.loadErectionStartForContract(contractId, erectionStartId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);

    if (!(ERECTION_START_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ERECTION_START_ATTACHMENT_INVALID_TYPE',
        message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
      });
    }
    if (file.size > ERECTION_START_ATTACHMENT_MAX_BYTES) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ERECTION_START_ATTACHMENT_TOO_LARGE',
        message: `File exceeds the ${ERECTION_START_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB upload limit.`,
      });
    }

    const { fileName, storagePath } = await this.attachmentStorage.save(erectionStartId, file.buffer, file.originalname);

    const attachment = await this.db.getClient().contractErectionStartAttachment.create({
      data: {
        erectionStartId,
        fileName,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath,
        uploadedByUserId: actor.id,
      },
      select: ERECTION_START_ATTACHMENT_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, 'erection_start_attachment_uploaded', {
      erectionStartId,
      attachmentId: attachment.id,
      fileName: file.originalname,
    });

    return attachment;
  }

  async getAttachmentForDownload(
    contractId: string,
    erectionStartId: string,
    attachmentId: string,
    actor: AuthUser,
  ): Promise<{ storagePath: string; originalFileName: string; mimeType: string }> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const attachment = await this.db.getClient().contractErectionStartAttachment.findFirst({
      where: { id: attachmentId, erectionStartId, erectionStart: { contractId } },
      select: {
        storagePath: true,
        originalFileName: true,
        mimeType: true,
        erectionStart: { select: { contract: { select: { departmentId: true } } } },
      },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_START_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      attachment.erectionStart.contract.departmentId,
    );

    return {
      storagePath: attachment.storagePath,
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
    };
  }

  async deleteAttachment(contractId: string, erectionStartId: string, attachmentId: string, actor: AuthUser): Promise<void> {
    assertCanWriteErectionDepartmentStep(actor);

    const attachment = await this.db.getClient().contractErectionStartAttachment.findFirst({
      where: { id: attachmentId, erectionStartId, erectionStart: { contractId } },
      select: {
        id: true,
        storagePath: true,
        originalFileName: true,
        erectionStart: { select: { contract: { select: { departmentId: true } } } },
      },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_START_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      attachment.erectionStart.contract.departmentId,
    );

    await this.db.getClient().contractErectionStartAttachment.delete({ where: { id: attachmentId } });
    await this.attachmentStorage.deleteFile(attachment.storagePath);

    await logContractActivity(this.db, contractId, actor, 'erection_start_attachment_deleted', {
      erectionStartId,
      attachmentId,
      fileName: attachment.originalFileName,
    });
  }
}
