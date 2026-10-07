import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ContractBoqConfirmationStatus, ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';
import type { SaveBoqDrawingConfirmationDto } from './dto/boq-drawing-confirmation.dto';
import { summarizeItemPieces } from './boq-piece-generation';
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
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
  }

  // Same write rule as every other Technical write: contracts.update or contracts.workflow_update.
  private requireWrite(actor: AuthUser): void {
    if (!actor.permissions.includes('contracts.update') && !actor.permissions.includes('contracts.workflow_update')) {
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
    // FMP-BOQ-04 — once pieces were created from a drawing it can no longer be cancelled.
    const pieceCount = await this.db.getClient().contractBoqPiece.count({ where: { drawingConfirmationId: id } });
    if (pieceCount > 0) {
      throw new ConflictException({
        code: 'BOQ_CONFIRMATION_HAS_PIECES',
        message: 'Pieces were already generated from this drawing, so it cannot be cancelled.',
      });
    }
    return this.db.getClient().contractBoqDrawingConfirmation.update({
      where: { id },
      data: { confirmationStatus: ContractBoqConfirmationStatus.CANCELLED },
      select: { ...CONFIRMATION_SELECT },
    });
  }
}
