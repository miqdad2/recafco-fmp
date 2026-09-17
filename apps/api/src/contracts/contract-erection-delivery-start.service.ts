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
  ErectionDeliveryStartAttachmentStorageService,
  ERECTION_DELIVERY_START_ATTACHMENT_MAX_BYTES,
  ERECTION_DELIVERY_START_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './erection-delivery-start-attachment-storage.service';
import type { AuthUser } from '../common/types/auth-user';
import {
  CONTRACT_ERECTION_DELIVERY_DOCUMENT_NAMES,
  type CreateContractErectionDeliveryStartDto,
  type CreateContractErectionDeliveryItemDto,
  type DeliveryDocumentInputDto,
} from './dto/create-contract-erection-delivery-start.dto';
import type { UpdateContractErectionDeliveryStartDto } from './dto/update-contract-erection-delivery-start.dto';
import { logContractActivity } from './contract-activity-log';

// ---------------------------------------------------------------------------
// CM-71E — Erection Workflow, Step 4: Delivery Start. Owned by the Delivery
// / Logistics Team (the Erection Department only VIEWS this step, per this
// unit's own explicit "do not make this look owned by Erection Department"
// instruction — enforced entirely in the frontend badge, since the backend
// uses the same contracts.update permission for every write action in this
// module, no new role). At most one delivery-start record per contract
// (contractId is @unique) — same "create once, edit forever" shape as
// CM-71A's Step 1 / CM-71D's Step 3.
//
// erectionScheduleId is auto-derived server-side from the contract's real
// current Step 3 record at creation time (never frontend-supplied), same
// reasoning as Step 3's own methodStatementId/approvalId auto-linking.
//
// status never stores a "Ready to Start" value (matching CM-71A's/CM-71D's
// own "Ready to Issue"/"Ready to Start" precedent) — computed frontend-only
// for a DRAFT record whose required fields already validate.
//
// totalPackages/totalWeight/totalVolume/totalItems are DERIVED server-side
// from the real ContractErectionDeliveryItem rows on every create/update —
// never independently trusted from the client — so they can never drift
// from the real item rows, per this unit's own "Delivery item summary must
// calculate from real item rows" instruction.
//
// Document checklist status is ATTACHED only when a real, currently-existing
// ContractErectionDeliveryStartAttachment row is linked — never accepted
// as a raw client-supplied status, per this unit's own "do not fake
// attached documents" instruction (see computeDeliveryDocumentStatus).
// ---------------------------------------------------------------------------

const HOLD_OR_RETURNED_STATUSES = ['HOLD', 'RETURNED'];

export function assertCommentsPresentForHoldOrReturn(status: string | undefined, comments: string | undefined): void {
  if (status && HOLD_OR_RETURNED_STATUSES.includes(status) && !comments?.trim()) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_ERECTION_DELIVERY_START_COMMENTS_REQUIRED',
      message: 'Comments are required to place delivery on Hold or Return it.',
    });
  }
}

/** Maps the resulting status to the activity event names this unit's own task explicitly named. */
export function computeDeliveryStartActivityEvent(status: string): string {
  switch (status) {
    case 'STARTED':
      return 'erection_delivery_start_confirmed';
    case 'HOLD':
      return 'erection_delivery_start_hold';
    case 'RETURNED':
      return 'erection_delivery_start_returned';
    default:
      return 'erection_delivery_start_draft_saved';
  }
}

export interface DeliveryTotalsInput {
  weight?: number | null;
  volume?: number | null;
  quantity: number;
}

export interface DeliveryTotals {
  totalPackages: number;
  totalWeight: number | null;
  totalVolume: number | null;
  totalItems: number;
}

/**
 * Real derived totals from the real item rows — never independently
 * user-entered. Total Packages = item row count (one package per row, per
 * this unit's own demo data). Total Weight/Volume treat a missing
 * per-item value as 0 for summation purposes but return null (not a
 * fabricated 0) when there are no items at all yet.
 */
export function computeDeliveryTotals(items: DeliveryTotalsInput[]): DeliveryTotals {
  if (items.length === 0) {
    return { totalPackages: 0, totalWeight: null, totalVolume: null, totalItems: 0 };
  }
  return {
    totalPackages: items.length,
    totalWeight: items.reduce((sum, i) => sum + (i.weight ?? 0), 0),
    totalVolume: items.reduce((sum, i) => sum + (i.volume ?? 0), 0),
    totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
  };
}

/**
 * A document's real status: ATTACHED only when hasValidAttachment is true
 * (the caller has already verified attachmentId resolves to a real
 * ContractErectionDeliveryStartAttachment row belonging to this same
 * delivery start) — the client's own requested status is otherwise honored
 * only for the genuinely manual PENDING/NOT_REQUIRED choice.
 */
export function computeDeliveryDocumentStatus(hasValidAttachment: boolean, requestedStatus: string | undefined): 'ATTACHED' | 'PENDING' | 'NOT_REQUIRED' {
  if (hasValidAttachment) return 'ATTACHED';
  return requestedStatus === 'NOT_REQUIRED' ? 'NOT_REQUIRED' : 'PENDING';
}

function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

/** DB-stored DATE columns come back as UTC-midnight JS Dates — reformat to plain YYYY-MM-DD so native <input type="date"> never silently renders blank (same fix as CM-70F / CM-71A / CM-71D). */
function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

const DELIVERY_START_SELECT = {
  id: true,
  contractId: true,
  erectionScheduleId: true,
  deliveryReferenceNo: true,
  deliveryDate: true,
  plannedDeliveryWindowStart: true,
  plannedDeliveryWindowEnd: true,
  transportMode: true,
  dispatchProductionSource: true,
  dispatchFromYard: true,
  deliveryToSiteLocation: true,
  gateEntryContact: true,
  deliveryNoteOrLrNo: true,
  vehicleNo: true,
  driverName: true,
  driverContact: true,
  totalPackages: true,
  totalWeight: true,
  totalVolume: true,
  totalItems: true,
  status: true,
  comments: true,
  confirmedAt: true,
  createdByUser: { select: { id: true, displayName: true } },
  updatedByUser: { select: { id: true, displayName: true } },
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: { srNo: 'asc' as const },
    select: {
      id: true,
      srNo: true,
      description: true,
      packageNo: true,
      weight: true,
      volume: true,
      quantity: true,
      status: true,
    },
  },
  documents: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      documentName: true,
      status: true,
      attachmentId: true,
    },
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

const DELIVERY_START_ATTACHMENT_SELECT = {
  id: true,
  deliveryStartId: true,
  originalFileName: true,
  mimeType: true,
  fileSize: true,
  createdAt: true,
  uploadedByUser: { select: { id: true, displayName: true } },
} as const;

function toResponseShape(row: {
  deliveryDate: Date;
  plannedDeliveryWindowStart: Date;
  plannedDeliveryWindowEnd: Date;
  totalWeight: unknown;
  totalVolume: unknown;
  items: { weight: unknown; volume: unknown; quantity: unknown }[];
  [key: string]: unknown;
}): Record<string, unknown> {
  return {
    ...row,
    deliveryDate: isoDate(row.deliveryDate) as string,
    plannedDeliveryWindowStart: isoDate(row.plannedDeliveryWindowStart) as string,
    plannedDeliveryWindowEnd: isoDate(row.plannedDeliveryWindowEnd) as string,
    totalWeight: toNum(row.totalWeight),
    totalVolume: toNum(row.totalVolume),
    items: row.items.map((i) => ({ ...i, weight: toNum(i.weight), volume: toNum(i.volume), quantity: toNum(i.quantity) })),
  };
}

@Injectable()
export class ContractErectionDeliveryStartService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
    private readonly attachmentStorage: ErectionDeliveryStartAttachmentStorageService,
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

  /** Step 4 can only exist once Step 3 (the erection schedule) does. */
  private async loadPrerequisite(contractId: string): Promise<{ erectionScheduleId: string | null }> {
    const schedule = await this.db.getClient().contractErectionSchedule.findUnique({
      where: { contractId },
      select: { id: true },
    });
    return { erectionScheduleId: schedule?.id ?? null };
  }

  // ---------------------------------------------------------------------------
  // Get — returns null (not 404) when no delivery-start record has been
  // created yet; "not created yet" is a normal, valid state for Step 4.
  // ---------------------------------------------------------------------------

  async getForContract(contractId: string, actor: AuthUser): Promise<unknown | null> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    await this.loadContract(contractId, actor);

    const deliveryStart = await this.db.getClient().contractErectionDeliveryStart.findUnique({
      where: { contractId },
      select: DELIVERY_START_SELECT,
    });
    return deliveryStart ? toResponseShape(deliveryStart) : null;
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(contractId: string, dto: CreateContractErectionDeliveryStartDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }
    await this.loadContract(contractId, actor);

    const { erectionScheduleId } = await this.loadPrerequisite(contractId);
    if (!erectionScheduleId) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ERECTION_DELIVERY_START_NO_SCHEDULE',
        message: 'The Erection Schedule (Step 3) must be Issued before Delivery Start can be created.',
      });
    }

    const existing = await this.db.getClient().contractErectionDeliveryStart.findUnique({
      where: { contractId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'CONTRACT_ERECTION_DELIVERY_START_ALREADY_EXISTS',
        message: 'A Delivery Start record already exists for this contract.',
      });
    }

    assertCommentsPresentForHoldOrReturn(dto.status, dto.comments);
    const status = dto.status ?? 'DRAFT';
    const items = dto.items ?? [];
    const totals = computeDeliveryTotals(items);

    const createdId = await this.db.getClient().$transaction(async (tx) => {
      const created = await tx.contractErectionDeliveryStart.create({
        data: {
          contractId,
          erectionScheduleId,
          createdByUserId: actor.id,
          deliveryReferenceNo: dto.deliveryReferenceNo,
          deliveryDate: new Date(dto.deliveryDate),
          plannedDeliveryWindowStart: new Date(dto.plannedDeliveryWindowStart),
          plannedDeliveryWindowEnd: new Date(dto.plannedDeliveryWindowEnd),
          transportMode: dto.transportMode,
          dispatchProductionSource: dto.dispatchProductionSource,
          dispatchFromYard: dto.dispatchFromYard,
          deliveryToSiteLocation: dto.deliveryToSiteLocation,
          gateEntryContact: dto.gateEntryContact || null,
          deliveryNoteOrLrNo: dto.deliveryNoteOrLrNo || null,
          vehicleNo: dto.vehicleNo || null,
          driverName: dto.driverName || null,
          driverContact: dto.driverContact || null,
          totalPackages: totals.totalPackages,
          totalWeight: totals.totalWeight,
          totalVolume: totals.totalVolume,
          totalItems: totals.totalItems,
          status: status as never,
          comments: dto.comments || null,
          ...(status === 'STARTED' ? { confirmedAt: new Date() } : {}),
        },
        select: { id: true },
      });

      if (items.length > 0) {
        await tx.contractErectionDeliveryItem.createMany({
          data: items.map((item: CreateContractErectionDeliveryItemDto, index: number) => ({
            deliveryStartId: created.id,
            srNo: index + 1,
            description: item.description,
            packageNo: item.packageNo || null,
            weight: item.weight ?? null,
            volume: item.volume ?? null,
            quantity: item.quantity,
            status: (item.status ?? 'READY_TO_DISPATCH') as never,
          })),
        });
      }

      await this.seedOrUpdateDocuments(tx, created.id, dto.documents);

      return created.id;
    });

    const created = await this.db.getClient().contractErectionDeliveryStart.findUniqueOrThrow({
      where: { id: createdId },
      select: DELIVERY_START_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, computeDeliveryStartActivityEvent(status), {
      deliveryStartId: created.id,
      status,
    });

    return toResponseShape(created);
  }

  /** Seeds the fixed 4-document checklist on create, or applies client-requested PENDING/NOT_REQUIRED overrides on either create or update — ATTACHED is never accepted from the client, only derived (see computeDeliveryDocumentStatus). */
  private async seedOrUpdateDocuments(
    tx: Parameters<Parameters<ReturnType<DatabaseService['getClient']>['$transaction']>[0]>[0],
    deliveryStartId: string,
    documents: DeliveryDocumentInputDto[] | undefined,
  ): Promise<void> {
    const byName = new Map((documents ?? []).map((d) => [d.documentName, d]));

    for (const documentName of CONTRACT_ERECTION_DELIVERY_DOCUMENT_NAMES) {
      const requested = byName.get(documentName);
      let hasValidAttachment = false;
      if (requested?.attachmentId) {
        const attachment = await tx.contractErectionDeliveryStartAttachment.findFirst({
          where: { id: requested.attachmentId, deliveryStartId },
          select: { id: true },
        });
        hasValidAttachment = attachment !== null;
      }
      const status = computeDeliveryDocumentStatus(hasValidAttachment, requested?.status);

      await tx.contractErectionDeliveryDocument.upsert({
        where: { deliveryStartId_documentName: { deliveryStartId, documentName } },
        create: {
          deliveryStartId,
          documentName,
          status: status as never,
          attachmentId: hasValidAttachment ? (requested?.attachmentId ?? null) : null,
        },
        update: {
          status: status as never,
          attachmentId: hasValidAttachment ? (requested?.attachmentId ?? null) : null,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Update — no delete endpoint for the delivery-start record itself,
  // matching every other contract sub-record in this app.
  // ---------------------------------------------------------------------------

  private async loadDeliveryStart(deliveryStartId: string): Promise<{ id: string; contractId: string; status: string; departmentId: string | null }> {
    const deliveryStart = await this.db.getClient().contractErectionDeliveryStart.findUnique({
      where: { id: deliveryStartId },
      select: { id: true, contractId: true, status: true, contract: { select: { departmentId: true } } },
    });
    if (!deliveryStart) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_DELIVERY_START_NOT_FOUND', message: 'Delivery Start record not found' });
    }
    return { id: deliveryStart.id, contractId: deliveryStart.contractId, status: deliveryStart.status, departmentId: deliveryStart.contract.departmentId };
  }

  async update(deliveryStartId: string, dto: UpdateContractErectionDeliveryStartDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }
    const existing = await this.loadDeliveryStart(deliveryStartId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, existing.departmentId);

    assertCommentsPresentForHoldOrReturn(dto.status, dto.comments);
    const isConfirmTransition = dto.status === 'STARTED' && existing.status !== 'STARTED';

    await this.db.getClient().$transaction(async (tx) => {
      if (dto.items !== undefined) {
        await tx.contractErectionDeliveryItem.deleteMany({ where: { deliveryStartId } });
        if (dto.items.length > 0) {
          await tx.contractErectionDeliveryItem.createMany({
            data: dto.items.map((item, index) => ({
              deliveryStartId,
              srNo: index + 1,
              description: item.description,
              packageNo: item.packageNo || null,
              weight: item.weight ?? null,
              volume: item.volume ?? null,
              quantity: item.quantity,
              status: (item.status ?? 'READY_TO_DISPATCH') as never,
            })),
          });
        }
      }

      const currentItems =
        dto.items ??
        (await tx.contractErectionDeliveryItem.findMany({
          where: { deliveryStartId },
          select: { weight: true, volume: true, quantity: true },
        }));
      const totals = computeDeliveryTotals(
        currentItems.map((i) => ({ weight: toNum(i.weight), volume: toNum(i.volume), quantity: toNum(i.quantity) as number })),
      );

      if (dto.documents !== undefined) {
        await this.seedOrUpdateDocuments(tx, deliveryStartId, dto.documents);
      }

      await tx.contractErectionDeliveryStart.update({
        where: { id: deliveryStartId },
        data: {
          updatedByUserId: actor.id,
          ...(dto.deliveryReferenceNo !== undefined ? { deliveryReferenceNo: dto.deliveryReferenceNo } : {}),
          ...(dto.deliveryDate !== undefined ? { deliveryDate: new Date(dto.deliveryDate) } : {}),
          ...(dto.plannedDeliveryWindowStart !== undefined ? { plannedDeliveryWindowStart: new Date(dto.plannedDeliveryWindowStart) } : {}),
          ...(dto.plannedDeliveryWindowEnd !== undefined ? { plannedDeliveryWindowEnd: new Date(dto.plannedDeliveryWindowEnd) } : {}),
          ...(dto.transportMode !== undefined ? { transportMode: dto.transportMode } : {}),
          ...(dto.dispatchProductionSource !== undefined ? { dispatchProductionSource: dto.dispatchProductionSource } : {}),
          ...(dto.dispatchFromYard !== undefined ? { dispatchFromYard: dto.dispatchFromYard } : {}),
          ...(dto.deliveryToSiteLocation !== undefined ? { deliveryToSiteLocation: dto.deliveryToSiteLocation } : {}),
          ...(dto.gateEntryContact !== undefined ? { gateEntryContact: dto.gateEntryContact || null } : {}),
          ...(dto.deliveryNoteOrLrNo !== undefined ? { deliveryNoteOrLrNo: dto.deliveryNoteOrLrNo || null } : {}),
          ...(dto.vehicleNo !== undefined ? { vehicleNo: dto.vehicleNo || null } : {}),
          ...(dto.driverName !== undefined ? { driverName: dto.driverName || null } : {}),
          ...(dto.driverContact !== undefined ? { driverContact: dto.driverContact || null } : {}),
          totalPackages: totals.totalPackages,
          totalWeight: totals.totalWeight,
          totalVolume: totals.totalVolume,
          totalItems: totals.totalItems,
          ...(dto.status !== undefined ? { status: dto.status as never } : {}),
          ...(dto.comments !== undefined ? { comments: dto.comments || null } : {}),
          ...(isConfirmTransition ? { confirmedAt: new Date() } : {}),
        },
      });
    });

    const updated = await this.db.getClient().contractErectionDeliveryStart.findUniqueOrThrow({
      where: { id: deliveryStartId },
      select: DELIVERY_START_SELECT,
    });

    await logContractActivity(
      this.db,
      existing.contractId,
      actor,
      computeDeliveryStartActivityEvent(dto.status ?? existing.status),
      { deliveryStartId: updated.id, status: updated.status },
    );

    return toResponseShape(updated);
  }

  // ---------------------------------------------------------------------------
  // Attachments — metadata + storage-relative path only; binary data lives
  // on disk via ErectionDeliveryStartAttachmentStorageService, never in the
  // database.
  // ---------------------------------------------------------------------------

  private async loadDeliveryStartForContract(contractId: string, deliveryStartId: string): Promise<{ id: string; departmentId: string | null }> {
    const deliveryStart = await this.db.getClient().contractErectionDeliveryStart.findFirst({
      where: { id: deliveryStartId, contractId },
      select: { id: true, contract: { select: { departmentId: true } } },
    });
    if (!deliveryStart) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_DELIVERY_START_NOT_FOUND', message: 'Delivery Start record not found' });
    }
    return { id: deliveryStart.id, departmentId: deliveryStart.contract.departmentId };
  }

  async listAttachments(contractId: string, deliveryStartId: string, actor: AuthUser): Promise<unknown[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    const { departmentId } = await this.loadDeliveryStartForContract(contractId, deliveryStartId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);

    return this.db.getClient().contractErectionDeliveryStartAttachment.findMany({
      where: { deliveryStartId },
      orderBy: [{ createdAt: 'desc' }],
      select: DELIVERY_START_ATTACHMENT_SELECT,
    });
  }

  async createAttachment(
    contractId: string,
    deliveryStartId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actor: AuthUser,
  ): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }
    const { departmentId } = await this.loadDeliveryStartForContract(contractId, deliveryStartId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);

    if (!(ERECTION_DELIVERY_START_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ERECTION_DELIVERY_START_ATTACHMENT_INVALID_TYPE',
        message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
      });
    }
    if (file.size > ERECTION_DELIVERY_START_ATTACHMENT_MAX_BYTES) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ERECTION_DELIVERY_START_ATTACHMENT_TOO_LARGE',
        message: `File exceeds the ${ERECTION_DELIVERY_START_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB upload limit.`,
      });
    }

    const { fileName, storagePath } = await this.attachmentStorage.save(deliveryStartId, file.buffer, file.originalname);

    const attachment = await this.db.getClient().contractErectionDeliveryStartAttachment.create({
      data: {
        deliveryStartId,
        fileName,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath,
        uploadedByUserId: actor.id,
      },
      select: DELIVERY_START_ATTACHMENT_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, 'erection_delivery_start_attachment_uploaded', {
      deliveryStartId,
      attachmentId: attachment.id,
      fileName: file.originalname,
    });

    return attachment;
  }

  async getAttachmentForDownload(
    contractId: string,
    deliveryStartId: string,
    attachmentId: string,
    actor: AuthUser,
  ): Promise<{ storagePath: string; originalFileName: string; mimeType: string }> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const attachment = await this.db.getClient().contractErectionDeliveryStartAttachment.findFirst({
      where: { id: attachmentId, deliveryStartId, deliveryStart: { contractId } },
      select: {
        storagePath: true,
        originalFileName: true,
        mimeType: true,
        deliveryStart: { select: { contract: { select: { departmentId: true } } } },
      },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_DELIVERY_START_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      attachment.deliveryStart.contract.departmentId,
    );

    return {
      storagePath: attachment.storagePath,
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
    };
  }

  async deleteAttachment(contractId: string, deliveryStartId: string, attachmentId: string, actor: AuthUser): Promise<void> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const attachment = await this.db.getClient().contractErectionDeliveryStartAttachment.findFirst({
      where: { id: attachmentId, deliveryStartId, deliveryStart: { contractId } },
      select: {
        id: true,
        storagePath: true,
        originalFileName: true,
        deliveryStart: { select: { contract: { select: { departmentId: true } } } },
      },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'CONTRACT_ERECTION_DELIVERY_START_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      attachment.deliveryStart.contract.departmentId,
    );

    // Unlink any document checklist row pointing at this attachment before
    // deleting it — the FK is onDelete: SetNull so this is defense-in-depth,
    // not strictly required, but keeps the checklist status honest
    // immediately rather than only after the next read re-derives it.
    await this.db.getClient().contractErectionDeliveryDocument.updateMany({
      where: { attachmentId },
      data: { attachmentId: null, status: 'PENDING' },
    });

    await this.db.getClient().contractErectionDeliveryStartAttachment.delete({ where: { id: attachmentId } });
    await this.attachmentStorage.deleteFile(attachment.storagePath);

    await logContractActivity(this.db, contractId, actor, 'erection_delivery_start_attachment_deleted', {
      deliveryStartId,
      attachmentId,
      fileName: attachment.originalFileName,
    });
  }
}
