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
  DocumentObligationAttachmentStorageService,
  DOCUMENT_OBLIGATION_ATTACHMENT_MAX_BYTES,
  DOCUMENT_OBLIGATION_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './document-obligation-attachment-storage.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateContractDocumentObligationDto } from './dto/create-contract-document-obligation.dto';
import type { UpdateContractDocumentObligationDto } from './dto/update-contract-document-obligation.dto';
import { logContractActivity } from './contract-activity-log';

// ---------------------------------------------------------------------------
// CM-63 — Documents & Obligations: required contract documents, certificates,
// submissions, guarantees, and approvals with their obligation deadlines.
// `status` is always a plain manual selection, set only by a manager —
// NEVER silently overwritten by date math. The "Expiring Soon"/"Expired /
// Overdue" KPI counts are DERIVED at read time from status + the item's
// effective expiry date (see computeDocumentObligationSummary() below)
// without ever mutating the stored `status` column — a manager who hasn't
// yet updated an item's status is never second-guessed by the system, and
// the derived counts can legitimately overlap with the raw Pending/Submitted
// counts (an item can be both "Pending" by its own status AND "Expiring
// Soon"/"Expired / Overdue" by its real date — both are real, honest facts
// about the same item, not a bug).
// CM-70E — the old combined `submissionOrExpiryDate` column is now legacy:
// new records use the separate `submissionDate`/`expiryDate` columns
// instead. Days-remaining/Expiring-Soon/Expired-Overdue all now prefer the
// real `expiryDate` when set, falling back to the legacy combined column
// only for old records that predate the split — never dropped, never
// guessed into the wrong one of the two new fields.
// CM-70F — root-cause fix: Prisma returns a real JS `Date` object (UTC
// midnight) for every `@db.Date` column, and the default Express/Nest JSON
// response serializes a Date via `.toISOString()` — producing
// "2026-09-06T00:00:00.000Z" instead of the plain "2026-09-06" the
// frontend's own `ContractDocumentObligation` type declares and that a
// native <input type="date"> requires. The browser silently renders such a
// field as EMPTY (an invalid `value`/`defaultValue`) — this, not a missing
// value, was why Required/Submission/Expiry Date all appeared blank in
// Edit even for an item that had them saved. Fixed by reformatting all 4
// date-only columns to "YYYY-MM-DD" strings in withDerivedFields() below,
// the single place every read/create/update response is built. This same
// unconverted-Date-object pattern exists in several sibling services
// (Claims/Risks/Issues/Payments/Variations) — out of scope for this
// Documents-only bug-fix unit; see this unit's own final report.
// ---------------------------------------------------------------------------

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** These statuses mean the item is settled — never counted toward the derived Expiring Soon / Expired-Overdue KPIs regardless of date. */
const SETTLED_STATUSES = ['SUBMITTED', 'CANCELLED', 'NOT_REQUIRED'];

interface DateFields {
  submissionOrExpiryDate: Date | null;
  /** CM-70E — real, separate Expiry Date column; preferred over the legacy submissionOrExpiryDate whenever set. Optional so every pre-existing call site/fixture (which only sets submissionOrExpiryDate) keeps working unchanged. */
  expiryDate?: Date | null;
}

/** The real date this item's Expired/Expiring-Soon/Days-Remaining calculations should use: the new expiryDate when set, otherwise the legacy combined column (for records created before the CM-70E split). */
function effectiveExpiryDate(row: DateFields): Date | null {
  return row.expiryDate ?? row.submissionOrExpiryDate;
}

/**
 * Signed days until the item's effective expiry date (negative once past);
 * null only when no date is set — never a fabricated number, never gated by
 * status (mirrors computeRiskDaysToDeadline()'s own design in
 * contract-risks.service.ts).
 */
export function computeDocumentObligationDaysRemaining(row: DateFields, today: Date = utcToday()): number | null {
  const due = effectiveExpiryDate(row);
  if (!due) return null;
  const dueUtc = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()));
  return Math.round((dueUtc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export interface DocumentObligationStatusFields extends DateFields {
  status: string;
}

/** A real effective expiry date already in the past, on an item not already settled (Submitted/Cancelled/Not Required). */
export function computeDocumentObligationIsExpiredOverdue(row: DocumentObligationStatusFields, today: Date = utcToday()): boolean {
  if (SETTLED_STATUSES.includes(row.status)) return false;
  const days = computeDocumentObligationDaysRemaining(row, today);
  return days !== null && days < 0;
}

/** A real effective expiry date within the next 30 days (inclusive), on an item not already settled. */
export function computeDocumentObligationIsExpiringSoon(row: DocumentObligationStatusFields, today: Date = utcToday()): boolean {
  if (SETTLED_STATUSES.includes(row.status)) return false;
  const days = computeDocumentObligationDaysRemaining(row, today);
  return days !== null && days >= 0 && days <= 30;
}

/** Every real `@db.Date` column on this entity — reformatted to a plain "YYYY-MM-DD" string before leaving the service, see the CM-70F note above. */
interface RawDocumentObligationDates {
  requiredDate: Date | null;
  submissionOrExpiryDate: Date | null;
  submissionDate: Date | null;
  expiryDate: Date | null;
}

/** "YYYY-MM-DD" for a real date, undefined for null/unset — never a full ISO datetime string, which a native <input type="date"> treats as invalid and renders blank. */
function toDateOnlyString(date: Date | null | undefined): string | undefined {
  if (!date) return undefined;
  return date.toISOString().slice(0, 10);
}

function withDerivedFields<T extends RawDocumentObligationDates>(
  row: T,
  today: Date,
): Omit<T, 'requiredDate' | 'submissionOrExpiryDate' | 'submissionDate' | 'expiryDate'> & {
  requiredDate?: string;
  submissionOrExpiryDate?: string;
  submissionDate?: string;
  expiryDate?: string;
  daysRemaining: number | null;
} {
  const daysRemaining = computeDocumentObligationDaysRemaining(row, today);
  return {
    ...row,
    requiredDate: toDateOnlyString(row.requiredDate),
    submissionOrExpiryDate: toDateOnlyString(row.submissionOrExpiryDate),
    submissionDate: toDateOnlyString(row.submissionDate),
    expiryDate: toDateOnlyString(row.expiryDate),
    daysRemaining,
  };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface DocumentObligationSummaryRow {
  status: string;
  submissionOrExpiryDate: Date | null;
  expiryDate?: Date | null;
}

export interface DocumentObligationSummary {
  totalItems: number;
  submitted: number;
  pending: number;
  expiringSoon: number;
  expiredOverdue: number;
}

export function computeDocumentObligationSummary(
  rows: DocumentObligationSummaryRow[],
  today: Date = utcToday(),
): DocumentObligationSummary {
  let submitted = 0;
  let pending = 0;
  let expiringSoon = 0;
  let expiredOverdue = 0;

  for (const row of rows) {
    if (row.status === 'SUBMITTED') submitted += 1;
    if (row.status === 'PENDING') pending += 1;
    if (computeDocumentObligationIsExpiringSoon(row, today)) expiringSoon += 1;
    if (computeDocumentObligationIsExpiredOverdue(row, today)) expiredOverdue += 1;
  }

  return {
    totalItems: rows.length,
    submitted,
    pending,
    expiringSoon,
    expiredOverdue,
  };
}

// ---------------------------------------------------------------------------
// Prisma select shapes
// ---------------------------------------------------------------------------

const DOCUMENT_OBLIGATION_SELECT = {
  id: true,
  contractId: true,
  itemNo: true,
  title: true,
  category: true,
  responsibleParty: true,
  requiredDate: true,
  submissionOrExpiryDate: true,
  submissionDate: true,
  expiryDate: true,
  status: true,
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

const DOCUMENT_OBLIGATION_ATTACHMENT_SELECT = {
  id: true,
  documentObligationId: true,
  originalFileName: true,
  mimeType: true,
  fileSize: true,
  createdAt: true,
  uploadedByUser: { select: { id: true, displayName: true } },
} as const;

const SUMMARY_SELECT = {
  status: true,
  submissionOrExpiryDate: true,
  expiryDate: true,
} as const;

export interface ContractDocumentObligationDetail {
  items: unknown[];
  summary: DocumentObligationSummary;
}

@Injectable()
export class ContractDocumentObligationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
    private readonly attachmentStorage: DocumentObligationAttachmentStorageService,
  ) {}

  // ---------------------------------------------------------------------------
  // List — all items for one contract, unpaginated (bounded, contract-scoped,
  // same pattern as :id/risks, :id/variations).
  // ---------------------------------------------------------------------------

  async findAllForContract(contractId: string, actor: AuthUser): Promise<ContractDocumentObligationDetail> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const contract = await this.db.getClient().contract.findUnique({
      where: { id: contractId },
      select: { id: true, departmentId: true },
    });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);

    const today = utcToday();
    const [items, summaryRows] = await Promise.all([
      this.db.getClient().contractDocumentObligation.findMany({
        where: { contractId },
        select: DOCUMENT_OBLIGATION_SELECT,
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.db.getClient().contractDocumentObligation.findMany({ where: { contractId }, select: SUMMARY_SELECT }),
    ]);

    return {
      items: items.map((item) => withDerivedFields(item, today)),
      summary: computeDocumentObligationSummary(summaryRows as unknown as DocumentObligationSummaryRow[], today),
    };
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(contractId: string, dto: CreateContractDocumentObligationDto, actor: AuthUser): Promise<unknown> {
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

    if (dto.itemNo) {
      const existing = await this.db.getClient().contractDocumentObligation.findUnique({
        where: { contractId_itemNo: { contractId, itemNo: dto.itemNo } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          code: 'CONTRACT_DOCUMENT_OBLIGATION_ITEM_NO_DUPLICATE',
          message: `Item ID "${dto.itemNo}" already exists for this contract.`,
        });
      }
    }

    const created = await this.db.getClient().contractDocumentObligation.create({
      data: {
        contractId,
        createdByUserId: actor.id,
        title: dto.title,
        ...(dto.itemNo !== undefined ? { itemNo: dto.itemNo } : {}),
        ...(dto.category !== undefined ? { category: dto.category as never } : {}),
        ...(dto.responsibleParty !== undefined ? { responsibleParty: dto.responsibleParty } : {}),
        ...(dto.requiredDate !== undefined ? { requiredDate: new Date(dto.requiredDate) } : {}),
        ...(dto.submissionOrExpiryDate !== undefined ? { submissionOrExpiryDate: new Date(dto.submissionOrExpiryDate) } : {}),
        ...(dto.submissionDate !== undefined ? { submissionDate: new Date(dto.submissionDate) } : {}),
        ...(dto.expiryDate !== undefined ? { expiryDate: new Date(dto.expiryDate) } : {}),
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      },
      select: DOCUMENT_OBLIGATION_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, 'document_obligation_created', {
      itemId: created.id,
      itemNo: created.itemNo ?? null,
      title: created.title,
    });

    return withDerivedFields(created, utcToday());
  }

  // ---------------------------------------------------------------------------
  // Update — no hard delete.
  // ---------------------------------------------------------------------------

  async update(itemId: string, dto: UpdateContractDocumentObligationDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const existing = await this.db.getClient().contractDocumentObligation.findUnique({
      where: { id: itemId },
      select: { id: true, contractId: true, itemNo: true, contract: { select: { departmentId: true } } },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'CONTRACT_DOCUMENT_OBLIGATION_NOT_FOUND', message: 'Document / obligation item not found' });
    }
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, existing.contract.departmentId);

    if (dto.itemNo !== undefined && dto.itemNo !== existing.itemNo && dto.itemNo !== '') {
      const duplicate = await this.db.getClient().contractDocumentObligation.findUnique({
        where: { contractId_itemNo: { contractId: existing.contractId, itemNo: dto.itemNo } },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'CONTRACT_DOCUMENT_OBLIGATION_ITEM_NO_DUPLICATE',
          message: `Item ID "${dto.itemNo}" already exists for this contract.`,
        });
      }
    }

    const updated = await this.db.getClient().contractDocumentObligation.update({
      where: { id: itemId },
      data: {
        updatedByUserId: actor.id,
        ...(dto.itemNo !== undefined ? { itemNo: dto.itemNo } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.category !== undefined ? { category: dto.category as never } : {}),
        ...(dto.responsibleParty !== undefined ? { responsibleParty: dto.responsibleParty } : {}),
        ...(dto.requiredDate !== undefined ? { requiredDate: new Date(dto.requiredDate) } : {}),
        ...(dto.submissionOrExpiryDate !== undefined ? { submissionOrExpiryDate: new Date(dto.submissionOrExpiryDate) } : {}),
        ...(dto.submissionDate !== undefined ? { submissionDate: new Date(dto.submissionDate) } : {}),
        ...(dto.expiryDate !== undefined ? { expiryDate: new Date(dto.expiryDate) } : {}),
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      },
      select: DOCUMENT_OBLIGATION_SELECT,
    });

    await logContractActivity(this.db, existing.contractId, actor, 'document_obligation_updated', {
      itemId: updated.id,
      itemNo: updated.itemNo ?? null,
      title: updated.title,
    });

    return withDerivedFields(updated, utcToday());
  }

  // ---------------------------------------------------------------------------
  // Attachments — metadata + storage-relative path only; binary data lives on
  // disk via DocumentObligationAttachmentStorageService, never in the
  // database. Every method verifies the item actually belongs to the given
  // contractId (not just that itemId resolves to *some* item) — a URL with a
  // mismatched :id/:itemId pair is treated as "not found", never silently
  // falling back to whatever contract the itemId happens to belong to.
  // ---------------------------------------------------------------------------

  private async loadItemForContract(
    contractId: string,
    itemId: string,
  ): Promise<{ id: string; departmentId: string | null }> {
    const item = await this.db.getClient().contractDocumentObligation.findFirst({
      where: { id: itemId, contractId },
      select: { id: true, contract: { select: { departmentId: true } } },
    });
    if (!item) {
      throw new NotFoundException({ code: 'CONTRACT_DOCUMENT_OBLIGATION_NOT_FOUND', message: 'Document / obligation item not found' });
    }
    return { id: item.id, departmentId: item.contract.departmentId };
  }

  async listAttachments(contractId: string, itemId: string, actor: AuthUser): Promise<unknown[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    const { departmentId } = await this.loadItemForContract(contractId, itemId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);

    return this.db.getClient().contractDocumentObligationAttachment.findMany({
      where: { documentObligationId: itemId },
      orderBy: [{ createdAt: 'desc' }],
      select: DOCUMENT_OBLIGATION_ATTACHMENT_SELECT,
    });
  }

  async createAttachment(
    contractId: string,
    itemId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actor: AuthUser,
  ): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }
    const { departmentId } = await this.loadItemForContract(contractId, itemId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);

    if (!(DOCUMENT_OBLIGATION_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_DOCUMENT_OBLIGATION_ATTACHMENT_INVALID_TYPE',
        message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
      });
    }
    if (file.size > DOCUMENT_OBLIGATION_ATTACHMENT_MAX_BYTES) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_DOCUMENT_OBLIGATION_ATTACHMENT_TOO_LARGE',
        message: `File exceeds the ${DOCUMENT_OBLIGATION_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB upload limit.`,
      });
    }

    const { fileName, storagePath } = await this.attachmentStorage.save(itemId, file.buffer, file.originalname);

    const attachment = await this.db.getClient().contractDocumentObligationAttachment.create({
      data: {
        documentObligationId: itemId,
        fileName,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath,
        uploadedByUserId: actor.id,
      },
      select: DOCUMENT_OBLIGATION_ATTACHMENT_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, 'document_obligation_attachment_uploaded', {
      itemId,
      attachmentId: attachment.id,
      fileName: file.originalname,
    });

    return attachment;
  }

  async getAttachmentForDownload(
    contractId: string,
    itemId: string,
    attachmentId: string,
    actor: AuthUser,
  ): Promise<{ storagePath: string; originalFileName: string; mimeType: string }> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const attachment = await this.db.getClient().contractDocumentObligationAttachment.findFirst({
      where: { id: attachmentId, documentObligationId: itemId, documentObligation: { contractId } },
      select: {
        storagePath: true,
        originalFileName: true,
        mimeType: true,
        documentObligation: { select: { contract: { select: { departmentId: true } } } },
      },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'CONTRACT_DOCUMENT_OBLIGATION_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      attachment.documentObligation.contract.departmentId,
    );

    return {
      storagePath: attachment.storagePath,
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
    };
  }
}
