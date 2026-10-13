import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { hasTechnicalRead, hasTechnicalWrite } from './technical-permissions';
import { randomUUID } from 'node:crypto';
import { ContractBoqConfirmationStatus, ContractBoqPieceStatus, ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';
import type { SaveBoqDrawingConfirmationDto } from './dto/boq-drawing-confirmation.dto';
import { planPieceGeneration, summarizeItemPieces } from './boq-piece-generation';
import type { PieceGroupRow } from './boq-piece-generation';

// ---------------------------------------------------------------------------
// FMP-BOQ-03 — Technical's drawing-confirmed physical pieces per BOQ item.
// Contract Qty (commercial, often M2/M3/LM) is never turned into pieces here:
// this service only RECORDS what Technical confirms. No pieces are generated.
// ---------------------------------------------------------------------------

function unprocessable(code: string, message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({ code, message });
}

/** Plain-language check of the confirmed pieces value; a draft may leave it empty. */
export function assertConfirmedPieces(value: number | null | undefined, required: boolean): number | null {
  if (value === undefined || value === null) {
    if (required) throw unprocessable('BOQ_CONFIRMED_PIECES_REQUIRED', 'Please enter confirmed pieces.');
    return null;
  }
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw unprocessable('BOQ_CONFIRMED_PIECES_NOT_WHOLE', 'Confirmed pieces must be a whole number.');
  }
  if (value <= 0) {
    // A draft is allowed to carry a value too, but never a zero/negative one.
    throw unprocessable('BOQ_CONFIRMED_PIECES_NOT_POSITIVE', 'Confirmed pieces must be more than 0.');
  }
  if (value > 1_000_000) {
    throw unprocessable('BOQ_CONFIRMED_PIECES_TOO_LARGE', 'Confirmed pieces is too large.');
  }
  return value;
}

/** Total confirmed pieces for one BOQ item = sum of its CONFIRMED rows only; null when none are confirmed. */
export function sumConfirmedPieces(
  rows: { confirmationStatus: ContractBoqConfirmationStatus; confirmedPieces: number | null }[],
): number | null {
  const confirmed = rows.filter(
    (r) => r.confirmationStatus === ContractBoqConfirmationStatus.CONFIRMED && r.confirmedPieces !== null,
  );
  if (confirmed.length === 0) return null;
  return confirmed.reduce((sum, r) => sum + (r.confirmedPieces ?? 0), 0);
}

// FMP-TECH-26 — one active confirmation per BOQ item, edited in place while no element has moved on.
export const CONFIRMATION_MESSAGES = {
  alreadyConfirmed: 'Elements are already confirmed for this BOQ item. Use Edit Confirmation if changes are needed.',
  inUseEdit: 'This confirmation cannot be changed because elements are already used in later steps.',
  inUseCancel: 'This confirmation cannot be cancelled because elements are already used in later steps.',
  notConfirmed: 'Only a confirmed drawing can be edited here.',
} as const;

const REMOVED_NOTE = 'Removed: the confirmed number of elements was reduced.';
const CANCELLED_NOTE = 'Removed: the element confirmation was cancelled.';

const CONFIRMATION_SELECT = {
  id: true,
  contractId: true,
  boqItemId: true,
  drawingNo: true,
  drawingTitle: true,
  confirmedPieces: true,
  sizeOrSpecification: true,
  revision: true,
  confirmationStatus: true,
  remarks: true,
  confirmedAt: true,
  createdAt: true,
  updatedAt: true,
  confirmedByUser: { select: { id: true, displayName: true } },
} as const;

@Injectable()
export class TechnicalBoqConfirmationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  private requireRead(actor: AuthUser): void {
    if (!hasTechnicalRead(actor.permissions)) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
  }

  // Same write rule as every other Technical write: contracts.update or contracts.workflow_update.
  private requireWrite(actor: AuthUser): void {
    if (!hasTechnicalWrite(actor.permissions)) {
      throw new ForbiddenException({
        code: 'CONTRACTS_PERMISSION_DENIED',
        message: 'Missing contracts.update or contracts.workflow_update',
      });
    }
  }

  private async loadContract(contractId: string, actor: AuthUser): Promise<void> {
    const contract = await this.db.getClient().contract.findUnique({
      where: { id: contractId },
      select: { id: true, departmentId: true },
    });
    if (!contract) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);
  }

  private async loadConfirmation(contractId: string, id: string) {
    const row = await this.db.getClient().contractBoqDrawingConfirmation.findFirst({
      where: { id, contractId },
      select: { ...CONFIRMATION_SELECT },
    });
    if (!row) throw new NotFoundException({ code: 'BOQ_CONFIRMATION_NOT_FOUND', message: 'Drawing confirmation not found.' });
    return row;
  }

  /** Every BOQ item of the contract with its drawing confirmations and total confirmed pieces. */
  async list(contractId: string, actor: AuthUser) {
    this.requireRead(actor);
    await this.loadContract(contractId, actor);

    const items = await this.db.getClient().contractBoqItem.findMany({
      where: { contractId },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        sortOrder: true,
        description: true,
        unitOfMeasure: true,
        originalEstimatedQty: true,
        drawingConfirmations: {
          orderBy: { createdAt: 'asc' },
          select: { ...CONFIRMATION_SELECT },
        },
      },
    });

    // FMP-BOQ-04 — piece counts per item/drawing/status, read-only.
    const groups = await this.db.getClient().contractBoqPiece.groupBy({
      by: ['boqItemId', 'drawingConfirmationId', 'currentStatus', 'isCancelled'],
      where: { contractId },
      _count: { _all: true },
    });
    const groupRows: PieceGroupRow[] = groups.map((g) => ({
      boqItemId: g.boqItemId,
      drawingConfirmationId: g.drawingConfirmationId,
      currentStatus: g.currentStatus,
      isCancelled: g.isCancelled,
      count: g._count._all,
    }));

    return items.map((item) => {
      const confirmedPieces = sumConfirmedPieces(item.drawingConfirmations);
      const pieceSummary = summarizeItemPieces(
        confirmedPieces,
        item.drawingConfirmations,
        groupRows.filter((g) => g.boqItemId === item.id),
      );
      return {
      boqItemId: item.id,
      sortOrder: item.sortOrder,
      description: item.description,
      contractQty: item.originalEstimatedQty === null ? null : item.originalEstimatedQty.toString(),
      contractUnit: item.unitOfMeasure,
      confirmedPieces,
      confirmations: item.drawingConfirmations,
      ...pieceSummary,
      };
    });
  }

  async create(contractId: string, dto: SaveBoqDrawingConfirmationDto, actor: AuthUser) {
    this.requireWrite(actor);
    await this.loadContract(contractId, actor);

    if (!dto.boqItemId) throw unprocessable('BOQ_ITEM_REQUIRED', 'Please select BOQ item.');
    if (!dto.drawingNo?.trim()) throw unprocessable('BOQ_DRAWING_NO_REQUIRED', 'Please enter drawing number.');
    const pieces = assertConfirmedPieces(dto.confirmedPieces, dto.action === 'CONFIRM');

    const item = await this.db.getClient().contractBoqItem.findFirst({
      where: { id: dto.boqItemId, contractId },
      select: { id: true },
    });
    if (!item) throw unprocessable('BOQ_ITEM_REQUIRED', 'Please select BOQ item.');
    await this.assertNoActiveConfirmation(item.id);

    const confirm = dto.action === 'CONFIRM';
    return this.db.getClient().contractBoqDrawingConfirmation.create({
      data: {
        contractId,
        boqItemId: item.id,
        drawingNo: dto.drawingNo.trim(),
        confirmationStatus: confirm ? ContractBoqConfirmationStatus.CONFIRMED : ContractBoqConfirmationStatus.DRAFT,
        createdByUserId: actor.id,
        ...(pieces !== null ? { confirmedPieces: pieces } : {}),
        ...(dto.drawingTitle ? { drawingTitle: dto.drawingTitle } : {}),
        ...(dto.sizeOrSpecification ? { sizeOrSpecification: dto.sizeOrSpecification } : {}),
        ...(dto.revision ? { revision: dto.revision } : {}),
        ...(dto.remarks ? { remarks: dto.remarks } : {}),
        ...(confirm ? { confirmedById: actor.id, confirmedAt: new Date() } : {}),
      },
      select: { ...CONFIRMATION_SELECT },
    });
  }

  /** Edit a DRAFT in place (save again, or confirm it). Confirmed rows are never edited — use revise(). */
  async updateDraft(contractId: string, id: string, dto: SaveBoqDrawingConfirmationDto, actor: AuthUser) {
    this.requireWrite(actor);
    await this.loadContract(contractId, actor);
    const existing = await this.loadConfirmation(contractId, id);

    if (existing.confirmationStatus !== ContractBoqConfirmationStatus.DRAFT) {
      throw new ConflictException({
        code: 'BOQ_CONFIRMATION_LOCKED',
        message: 'This drawing confirmation is already confirmed. Use Revise to change it.',
      });
    }
    if (!dto.drawingNo?.trim()) throw unprocessable('BOQ_DRAWING_NO_REQUIRED', 'Please enter drawing number.');
    const confirm = dto.action === 'CONFIRM';
    const pieces = assertConfirmedPieces(dto.confirmedPieces, confirm);
    if (confirm) await this.assertNoActiveConfirmation(existing.boqItemId, id);

    return this.db.getClient().contractBoqDrawingConfirmation.update({
      where: { id },
      data: {
        drawingNo: dto.drawingNo.trim(),
        drawingTitle: dto.drawingTitle ?? null,
        confirmedPieces: pieces,
        sizeOrSpecification: dto.sizeOrSpecification ?? null,
        revision: dto.revision ?? null,
        remarks: dto.remarks ?? null,
        ...(confirm
          ? { confirmationStatus: ContractBoqConfirmationStatus.CONFIRMED, confirmedById: actor.id, confirmedAt: new Date() }
          : {}),
      },
      select: { ...CONFIRMATION_SELECT },
    });
  }

  /** A BOQ item has at most one active (Confirmed) confirmation; a second one would double its elements. */
  private async assertNoActiveConfirmation(boqItemId: string, exceptId?: string): Promise<void> {
    const active = await this.db.getClient().contractBoqDrawingConfirmation.findFirst({
      where: { boqItemId, confirmationStatus: ContractBoqConfirmationStatus.CONFIRMED, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (active) throw new ConflictException({ code: 'BOQ_ALREADY_CONFIRMED', message: CONFIRMATION_MESSAGES.alreadyConfirmed });
  }

  /** The confirmation's live elements, and whether any has moved past generation (in a drawing group, or beyond its starting status). */
  private async elementUsage(confirmationId: string) {
    const live = await this.db.getClient().contractBoqPiece.findMany({
      where: { drawingConfirmationId: confirmationId, isCancelled: false },
      select: { id: true, pieceNo: true, currentStatus: true, drawingGroupLinks: { where: { activeSlot: 1 }, select: { id: true } } },
    });
    const inUse = live.some((p) => p.currentStatus !== ContractBoqPieceStatus.DRAWING_READY || p.drawingGroupLinks.length > 0);
    return { live, inUse };
  }

  /**
   * FMP-TECH-26 — edit a CONFIRMED confirmation in place. Text fields (drawing reference, title,
   * specification, revision, remarks) can always change and are copied to the confirmation's elements.
   * The number of elements can change only while none of them is used in a later step: a larger number
   * adds the missing elements, a smaller one cancels the surplus (kept as cancelled, never deleted).
   */
  async editConfirmed(contractId: string, id: string, dto: SaveBoqDrawingConfirmationDto, actor: AuthUser) {
    this.requireWrite(actor);
    await this.loadContract(contractId, actor);
    const existing = await this.loadConfirmation(contractId, id);

    if (existing.confirmationStatus !== ContractBoqConfirmationStatus.CONFIRMED) {
      throw new ConflictException({ code: 'BOQ_CONFIRMATION_NOT_CONFIRMED', message: CONFIRMATION_MESSAGES.notConfirmed });
    }
    if (!dto.drawingNo?.trim()) throw unprocessable('BOQ_DRAWING_NO_REQUIRED', 'Please enter drawing number.');
    const wanted = assertConfirmedPieces(dto.confirmedPieces, true) as number;

    const { live, inUse } = await this.elementUsage(id);
    const countChanged = wanted !== existing.confirmedPieces;
    if (countChanged && inUse) {
      throw new ConflictException({ code: 'BOQ_CONFIRMATION_IN_USE', message: CONFIRMATION_MESSAGES.inUseEdit });
    }

    const drawingNo = dto.drawingNo.trim();
    const spec = dto.sizeOrSpecification ?? null;
    const client = this.db.getClient();
    const item = await client.contractBoqItem.findFirst({ where: { id: existing.boqItemId, contractId }, select: { sortOrder: true } });

    return client.$transaction(async (tx) => {
      const updated = await tx.contractBoqDrawingConfirmation.update({
        where: { id },
        data: {
          drawingNo,
          drawingTitle: dto.drawingTitle ?? null,
          confirmedPieces: wanted,
          sizeOrSpecification: spec,
          revision: dto.revision ?? null,
          remarks: dto.remarks ?? null,
        },
        select: { ...CONFIRMATION_SELECT },
      });

      if (drawingNo !== existing.drawingNo || spec !== existing.sizeOrSpecification) {
        await tx.contractBoqPiece.updateMany({ where: { drawingConfirmationId: id }, data: { drawingNo, sizeOrSpecification: spec } });
      }

      if (countChanged) {
        const surplus = live.filter((p) => p.pieceNo > wanted);
        if (surplus.length > 0) {
          await this.cancelElements(tx, surplus.map((p) => p.id), REMOVED_NOTE, actor.id);
        } else {
          // Bigger number: bring back elements this edit removed earlier, then create the rest.
          const cancelled = await tx.contractBoqPiece.findMany({
            where: { drawingConfirmationId: id, isCancelled: true, pieceNo: { lte: wanted } },
            select: { id: true },
          });
          if (cancelled.length > 0) {
            const removedByEdit = await tx.contractBoqPieceStatusHistory.findMany({
              where: { pieceId: { in: cancelled.map((p) => p.id) }, note: REMOVED_NOTE },
              select: { pieceId: true },
            });
            const restoreIds = [...new Set(removedByEdit.map((h) => h.pieceId))];
            if (restoreIds.length > 0) {
              await tx.contractBoqPiece.updateMany({ where: { id: { in: restoreIds } }, data: { isCancelled: false, currentStatus: ContractBoqPieceStatus.DRAWING_READY } });
              await tx.contractBoqPieceStatusHistory.createMany({
                data: restoreIds.map((pieceId) => ({
                  pieceId,
                  oldStatus: ContractBoqPieceStatus.CANCELLED,
                  newStatus: ContractBoqPieceStatus.DRAWING_READY,
                  note: 'Restored: the confirmed number of elements was increased.',
                  updatedById: actor.id,
                })),
              });
            }
          }
          const everyPiece = await tx.contractBoqPiece.findMany({ where: { contractId }, select: { drawingConfirmationId: true, pieceNo: true, pieceCode: true } });
          const planned = planPieceGeneration(
            [{ id, boqItemId: existing.boqItemId, boqItemSortOrder: item?.sortOrder ?? 0, drawingNo, confirmedPieces: wanted, sizeOrSpecification: spec, confirmationStatus: ContractBoqConfirmationStatus.CONFIRMED }],
            everyPiece,
            randomUUID,
          );
          if (planned.length > 0) {
            await tx.contractBoqPiece.createMany({
              data: planned.map((p) => ({
                id: p.id,
                contractId,
                boqItemId: p.boqItemId,
                drawingConfirmationId: p.drawingConfirmationId,
                pieceNo: p.pieceNo,
                pieceCode: p.pieceCode,
                currentStatus: ContractBoqPieceStatus.DRAWING_READY,
                drawingNo: p.drawingNo,
                ...(p.sizeOrSpecification ? { sizeOrSpecification: p.sizeOrSpecification } : {}),
              })),
            });
            await tx.contractBoqPieceStatusHistory.createMany({
              data: planned.map((p) => ({ pieceId: p.id, newStatus: ContractBoqPieceStatus.DRAWING_READY, note: 'Created: the confirmed number of elements was increased.', updatedById: actor.id })),
            });
          }
        }
      }
      return updated;
    });
  }

  /** Marks elements Cancelled (kept for history, never deleted) with a history entry each. */
  private async cancelElements(
    tx: unknown,
    pieceIds: string[],
    note: string,
    actorId: string,
  ): Promise<void> {
    const t = tx as {
      contractBoqPiece: { updateMany: (args: unknown) => Promise<unknown> };
      contractBoqPieceStatusHistory: { createMany: (args: unknown) => Promise<unknown> };
    };
    await t.contractBoqPiece.updateMany({ where: { id: { in: pieceIds } }, data: { isCancelled: true, currentStatus: ContractBoqPieceStatus.CANCELLED } });
    await t.contractBoqPieceStatusHistory.createMany({
      data: pieceIds.map((pieceId) => ({ pieceId, oldStatus: ContractBoqPieceStatus.DRAWING_READY, newStatus: ContractBoqPieceStatus.CANCELLED, note, updatedById: actorId })),
    });
  }

  /**
   * Change a CONFIRMED drawing: the old row becomes REVISED (kept as history,
   * no longer counted) and a new CONFIRMED row carries the new values.
   */
  async revise(contractId: string, id: string, dto: SaveBoqDrawingConfirmationDto, actor: AuthUser) {
    this.requireWrite(actor);
    await this.loadContract(contractId, actor);
    const existing = await this.loadConfirmation(contractId, id);

    if (existing.confirmationStatus !== ContractBoqConfirmationStatus.CONFIRMED) {
      throw new ConflictException({
        code: 'BOQ_CONFIRMATION_NOT_CONFIRMED',
        message: 'Only a confirmed drawing can be revised.',
      });
    }
    if (!dto.drawingNo?.trim()) throw unprocessable('BOQ_DRAWING_NO_REQUIRED', 'Please enter drawing number.');
    const pieces = assertConfirmedPieces(dto.confirmedPieces, true);

    return this.db.getClient().$transaction(async (tx) => {
      await tx.contractBoqDrawingConfirmation.update({
        where: { id },
        data: { confirmationStatus: ContractBoqConfirmationStatus.REVISED },
      });
      return tx.contractBoqDrawingConfirmation.create({
        data: {
          contractId,
          boqItemId: existing.boqItemId,
          drawingNo: dto.drawingNo.trim(),
          confirmedPieces: pieces,
          confirmationStatus: ContractBoqConfirmationStatus.CONFIRMED,
          confirmedById: actor.id,
          confirmedAt: new Date(),
          createdByUserId: actor.id,
          ...(dto.drawingTitle ? { drawingTitle: dto.drawingTitle } : {}),
          ...(dto.sizeOrSpecification ? { sizeOrSpecification: dto.sizeOrSpecification } : {}),
          ...(dto.revision ? { revision: dto.revision } : {}),
          ...(dto.remarks ? { remarks: dto.remarks } : {}),
        },
        select: { ...CONFIRMATION_SELECT },
      });
    });
  }

  /** Cancel a DRAFT or CONFIRMED row (never deleted). Safe now because no pieces are generated from these rows yet. */
  async cancel(contractId: string, id: string, actor: AuthUser) {
    this.requireWrite(actor);
    await this.loadContract(contractId, actor);
    const existing = await this.loadConfirmation(contractId, id);

    if (
      existing.confirmationStatus !== ContractBoqConfirmationStatus.DRAFT &&
      existing.confirmationStatus !== ContractBoqConfirmationStatus.CONFIRMED
    ) {
      throw new ConflictException({
        code: 'BOQ_CONFIRMATION_NOT_CANCELLABLE',
        message: 'This drawing confirmation cannot be cancelled.',
      });
    }
    // FMP-TECH-26 — elements are generated as soon as a confirmation is made, so cancelling is allowed only
    // while none of them is used in a later step; they are then marked Cancelled (kept, never deleted).
    const { live, inUse } = await this.elementUsage(id);
    if (inUse) {
      throw new ConflictException({ code: 'BOQ_CONFIRMATION_IN_USE', message: CONFIRMATION_MESSAGES.inUseCancel });
    }
    return this.db.getClient().$transaction(async (tx) => {
      if (live.length > 0) await this.cancelElements(tx, live.map((p) => p.id), CANCELLED_NOTE, actor.id);
      return tx.contractBoqDrawingConfirmation.update({
        where: { id },
        data: { confirmationStatus: ContractBoqConfirmationStatus.CANCELLED },
        select: { ...CONFIRMATION_SELECT },
      });
    });
  }
}
