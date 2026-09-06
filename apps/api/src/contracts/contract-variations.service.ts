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
  VariationAttachmentStorageService,
  VARIATION_ATTACHMENT_MAX_BYTES,
  VARIATION_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './variation-attachment-storage.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateContractVariationDto } from './dto/create-contract-variation.dto';
import type { UpdateContractVariationDto } from './dto/update-contract-variation.dto';
import { logContractActivity } from './contract-activity-log';

// ---------------------------------------------------------------------------
// CM-60 — Contract Variations / Change Orders. "Variation" is the real
// table/field terminology throughout this service (per the task's naming
// decision) — "Change Orders" only appears in the page/tab title on the
// frontend. Current Contract Value for the Variations page is computed here
// as Contract.originalContractValue + approvedValue — Contract.contractValue
// itself (BOQ-derived, see contracts.service.ts) is never written by this
// service.
// ---------------------------------------------------------------------------

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Prisma Decimal | number | null -> plain number | null, without importing the Decimal type directly. */
function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

/** Statuses awaiting a decision — counted toward Pending Variations Value, not Approved/Rejected. */
const PENDING_STATUSES = ['SUBMITTED', 'PENDING_APPROVAL'];
/** Concluded-negative statuses — counted toward Rejected / Cancelled Value. */
const REJECTED_OR_CANCELLED_STATUSES = ['REJECTED', 'CANCELLED'];

export interface VariationRow {
  status: string;
  amount: unknown;
  affectsContractValue: boolean;
}

export interface VariationSummary {
  totalVariations: number;
  approvedValue: string;
  pendingValue: string;
  rejectedCancelledValue: string;
  netVariationImpact: string;
}

/**
 * DRAFT variations and any variation with affectsContractValue=false are
 * counted in totalVariations only — never in a value bucket. A deductive
 * variation's amount is a real signed number (never clamped), so
 * approvedValue/pendingValue/rejectedCancelledValue can each be negative
 * when the underlying amounts are — shown honestly, not hidden.
 */
export function computeVariationSummary(items: VariationRow[]): VariationSummary {
  let approvedValue = 0;
  let pendingValue = 0;
  let rejectedCancelledValue = 0;

  for (const item of items) {
    if (!item.affectsContractValue) continue;
    const amount = toNum(item.amount) ?? 0;
    if (item.status === 'APPROVED') approvedValue += amount;
    else if (PENDING_STATUSES.includes(item.status)) pendingValue += amount;
    else if (REJECTED_OR_CANCELLED_STATUSES.includes(item.status)) rejectedCancelledValue += amount;
  }

  approvedValue = round3(approvedValue);
  pendingValue = round3(pendingValue);
  rejectedCancelledValue = round3(rejectedCancelledValue);

  return {
    totalVariations: items.length,
    approvedValue: approvedValue.toFixed(3),
    pendingValue: pendingValue.toFixed(3),
    rejectedCancelledValue: rejectedCancelledValue.toFixed(3),
    netVariationImpact: round3(approvedValue + pendingValue).toFixed(3),
  };
}

// ---------------------------------------------------------------------------
// Prisma select shape
// ---------------------------------------------------------------------------

const VARIATION_SELECT = {
  id: true,
  contractId: true,
  variationNo: true,
  description: true,
  amount: true,
  currency: true,
  affectsContractValue: true,
  status: true,
  submittedDate: true,
  approvedDate: true,
  supportingDocumentName: true,
  supportingDocumentUrl: true,
  remarks: true,
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

const VARIATION_ATTACHMENT_SELECT = {
  id: true,
  variationId: true,
  originalFileName: true,
  mimeType: true,
  fileSize: true,
  createdAt: true,
  uploadedByUser: { select: { id: true, displayName: true } },
} as const;

export interface ContractVariationDetail {
  items: unknown[];
  summary: VariationSummary;
  originalContractValue: string | null;
  computedCurrentValue: string | null;
}

@Injectable()
export class ContractVariationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
    private readonly attachmentStorage: VariationAttachmentStorageService,
  ) {}

  // ---------------------------------------------------------------------------
  // List — all variations for one contract, unpaginated (bounded, contract-
  // scoped, same pattern as :id/schedule and :id/production).
  // ---------------------------------------------------------------------------

  async findAllForContract(contractId: string, actor: AuthUser): Promise<ContractVariationDetail> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const contract = await this.db.getClient().contract.findUnique({
      where: { id: contractId },
      select: { id: true, departmentId: true, originalContractValue: true },
    });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);

    const items = await this.db.getClient().contractVariation.findMany({
      where: { contractId },
      select: VARIATION_SELECT,
      orderBy: [{ createdAt: 'desc' }],
    });

    const summary = computeVariationSummary(items as unknown as VariationRow[]);
    const originalContractValue = toNum(contract.originalContractValue);
    const computedCurrentValue =
      originalContractValue !== null
        ? round3(originalContractValue + parseFloat(summary.approvedValue)).toFixed(3)
        : null;

    return {
      items,
      summary,
      originalContractValue: originalContractValue !== null ? originalContractValue.toFixed(3) : null,
      computedCurrentValue,
    };
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(contractId: string, dto: CreateContractVariationDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const contract = await this.db.getClient().contract.findUnique({
      where: { id: contractId },
      select: { id: true, departmentId: true },
    });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);

    if (dto.variationNo) {
      const existing = await this.db.getClient().contractVariation.findUnique({
        where: { contractId_variationNo: { contractId, variationNo: dto.variationNo } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          code: 'CONTRACT_VARIATION_NO_DUPLICATE',
          message: `Variation No. "${dto.variationNo}" already exists for this contract.`,
        });
      }
    }

    const created = await this.db.getClient().contractVariation.create({
      data: {
        contractId,
        createdByUserId: actor.id,
        description: dto.description,
        amount: dto.amount,
        ...(dto.variationNo !== undefined ? { variationNo: dto.variationNo } : {}),
        ...(dto.affectsContractValue !== undefined ? { affectsContractValue: dto.affectsContractValue } : {}),
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
        ...(dto.submittedDate !== undefined ? { submittedDate: new Date(dto.submittedDate) } : {}),
        ...(dto.approvedDate !== undefined ? { approvedDate: new Date(dto.approvedDate) } : {}),
        ...(dto.supportingDocumentName !== undefined ? { supportingDocumentName: dto.supportingDocumentName } : {}),
        ...(dto.supportingDocumentUrl !== undefined ? { supportingDocumentUrl: dto.supportingDocumentUrl } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      },
      select: VARIATION_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, 'variation_created', {
      variationId: created.id,
      variationNo: created.variationNo ?? null,
    });

    return created;
  }

  // ---------------------------------------------------------------------------
  // Update — no hard delete; cancellation goes through status = CANCELLED.
  // ---------------------------------------------------------------------------

  async update(variationId: string, dto: UpdateContractVariationDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const existing = await this.db.getClient().contractVariation.findUnique({
      where: { id: variationId },
      select: { id: true, contractId: true, variationNo: true, contract: { select: { departmentId: true } } },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'CONTRACT_VARIATION_NOT_FOUND', message: 'Variation not found' });
    }
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, existing.contract.departmentId);

    if (dto.variationNo !== undefined && dto.variationNo !== existing.variationNo && dto.variationNo !== '') {
      const duplicate = await this.db.getClient().contractVariation.findUnique({
        where: { contractId_variationNo: { contractId: existing.contractId, variationNo: dto.variationNo } },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'CONTRACT_VARIATION_NO_DUPLICATE',
          message: `Variation No. "${dto.variationNo}" already exists for this contract.`,
        });
      }
    }

    const updated = await this.db.getClient().contractVariation.update({
      where: { id: variationId },
      data: {
        updatedByUserId: actor.id,
        ...(dto.variationNo !== undefined ? { variationNo: dto.variationNo } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.affectsContractValue !== undefined ? { affectsContractValue: dto.affectsContractValue } : {}),
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
        ...(dto.submittedDate !== undefined ? { submittedDate: new Date(dto.submittedDate) } : {}),
        ...(dto.approvedDate !== undefined ? { approvedDate: new Date(dto.approvedDate) } : {}),
        ...(dto.supportingDocumentName !== undefined ? { supportingDocumentName: dto.supportingDocumentName } : {}),
        ...(dto.supportingDocumentUrl !== undefined ? { supportingDocumentUrl: dto.supportingDocumentUrl } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      },
      select: VARIATION_SELECT,
    });

    await logContractActivity(this.db, existing.contractId, actor, 'variation_updated', {
      variationId: updated.id,
      variationNo: updated.variationNo ?? null,
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Attachments — metadata + storage-relative path only; binary data lives on
  // disk via VariationAttachmentStorageService, never in the database.
  // Every method verifies the variation actually belongs to the given
  // contractId (not just that variationId resolves to *some* variation) —
  // a URL with a mismatched :id/:variationId pair is treated as "not found",
  // never silently falling back to whatever contract the variationId itself
  // happens to belong to.
  // ---------------------------------------------------------------------------

  private async loadVariationForContract(
    contractId: string,
    variationId: string,
  ): Promise<{ id: string; departmentId: string | null }> {
    const variation = await this.db.getClient().contractVariation.findFirst({
      where: { id: variationId, contractId },
      select: { id: true, contract: { select: { departmentId: true } } },
    });
    if (!variation) {
      throw new NotFoundException({ code: 'CONTRACT_VARIATION_NOT_FOUND', message: 'Variation not found' });
    }
    return { id: variation.id, departmentId: variation.contract.departmentId };
  }

  async listAttachments(contractId: string, variationId: string, actor: AuthUser): Promise<unknown[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    const { departmentId } = await this.loadVariationForContract(contractId, variationId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);

    return this.db.getClient().contractVariationAttachment.findMany({
      where: { variationId },
      orderBy: [{ createdAt: 'desc' }],
      select: VARIATION_ATTACHMENT_SELECT,
    });
  }

  async createAttachment(
    contractId: string,
    variationId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actor: AuthUser,
  ): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }
    const { departmentId } = await this.loadVariationForContract(contractId, variationId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);

    if (!(VARIATION_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_VARIATION_ATTACHMENT_INVALID_TYPE',
        message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
      });
    }
    if (file.size > VARIATION_ATTACHMENT_MAX_BYTES) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_VARIATION_ATTACHMENT_TOO_LARGE',
        message: `File exceeds the ${VARIATION_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB upload limit.`,
      });
    }

    const { fileName, storagePath } = await this.attachmentStorage.save(variationId, file.buffer, file.originalname);

    const attachment = await this.db.getClient().contractVariationAttachment.create({
      data: {
        variationId,
        fileName,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath,
        uploadedByUserId: actor.id,
      },
      select: VARIATION_ATTACHMENT_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, 'variation_attachment_uploaded', {
      variationId,
      attachmentId: attachment.id,
      fileName: file.originalname,
    });

    return attachment;
  }

  async getAttachmentForDownload(
    contractId: string,
    variationId: string,
    attachmentId: string,
    actor: AuthUser,
  ): Promise<{ storagePath: string; originalFileName: string; mimeType: string }> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const attachment = await this.db.getClient().contractVariationAttachment.findFirst({
      where: { id: attachmentId, variationId, variation: { contractId } },
      select: {
        storagePath: true,
        originalFileName: true,
        mimeType: true,
        variation: { select: { contract: { select: { departmentId: true } } } },
      },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'CONTRACT_VARIATION_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      attachment.variation.contract.departmentId,
    );

    return {
      storagePath: attachment.storagePath,
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
    };
  }
}
