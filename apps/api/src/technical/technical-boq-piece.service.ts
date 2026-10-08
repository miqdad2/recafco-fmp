import { randomUUID } from 'node:crypto';
import { Injectable, ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ContractBoqConfirmationStatus, ContractBoqPieceStatus, ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';
import { planPieceGeneration, allowedPieceStatuses } from './boq-piece-generation';
import { applyPieceStatusUpdate } from './boq-piece-status-update';
import type { PieceStatusUpdateResult } from './boq-piece-status-update';
import type { PieceUpdateContext } from './boq-piece-generation';
import type { PieceUpdateTargetStatus } from './dto/boq-piece-status.dto';

export const PIECES_CREATED_NOTE = 'Created from drawing confirmation';
const MAX_LISTED_PIECES = 2000;

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === 'P2002' || /unique constraint|duplicate key/i.test(e.message ?? '');
}

/**
 * FMP-BOQ-04 — creates individual trackable pieces from CONFIRMED drawing
 * confirmations (never from Contract Qty) and lists them read-only. Nothing
 * here touches Production, Storage & Delivery or Erection.
 */
@Injectable()
export class TechnicalBoqPieceService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  private requireRead(actor: AuthUser): void {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
  }

  // Same write rule as every other Technical write.
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

  /** Creates the missing pieces for every CONFIRMED drawing confirmation. Safe to run again. */
  async generate(
    contractId: string,
    actor: AuthUser,
  ): Promise<{ generatedCount: number; alreadyGenerated: boolean; message: string }> {
    this.requireWrite(actor);
    await this.loadContract(contractId, actor);
    const client = this.db.getClient();

    const confirmed = await client.contractBoqDrawingConfirmation.findMany({
      where: { contractId, confirmationStatus: ContractBoqConfirmationStatus.CONFIRMED },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        boqItemId: true,
        drawingNo: true,
        confirmedPieces: true,
        sizeOrSpecification: true,
        confirmationStatus: true,
        boqItem: { select: { sortOrder: true } },
      },
    });
    if (confirmed.length === 0) {
      throw new UnprocessableEntityException({
        code: 'BOQ_NO_CONFIRMED_DRAWINGS',
        message: 'Please confirm drawing pieces before generating pieces.',
      });
    }

    const existing = await client.contractBoqPiece.findMany({
      where: { contractId },
      select: { drawingConfirmationId: true, pieceNo: true, pieceCode: true },
    });

    const planned = planPieceGeneration(
      confirmed.map((c) => ({
        id: c.id,
        boqItemId: c.boqItemId,
        boqItemSortOrder: c.boqItem.sortOrder,
        drawingNo: c.drawingNo,
        confirmedPieces: c.confirmedPieces,
        sizeOrSpecification: c.sizeOrSpecification,
        confirmationStatus: c.confirmationStatus,
      })),
      existing,
      randomUUID,
    );

    if (planned.length === 0) {
      return { generatedCount: 0, alreadyGenerated: true, message: 'Pieces are already generated.' };
    }

    try {
      await client.$transaction(async (tx) => {
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
          data: planned.map((p) => ({
            pieceId: p.id,
            newStatus: ContractBoqPieceStatus.DRAWING_READY,
            note: PIECES_CREATED_NOTE,
            updatedById: actor.id,
          })),
        });
      });
    } catch (err) {
      // Two people pressing Generate at the same moment: the second one hits the unique codes.
      if (isUniqueViolation(err)) {
        return { generatedCount: 0, alreadyGenerated: true, message: 'Pieces are already generated.' };
      }
      throw err;
    }

    return { generatedCount: planned.length, alreadyGenerated: false, message: 'Pieces generated successfully.' };
  }

  /** Read-only piece list for one contract, optionally for one BOQ item and/or one status. */
  async list(contractId: string, query: { boqItemId?: string | undefined; status?: ContractBoqPieceStatus | undefined }, actor: AuthUser) {
    this.requireRead(actor);
    await this.loadContract(contractId, actor);

    return this.db.getClient().contractBoqPiece.findMany({
      where: {
        contractId,
        ...(query.boqItemId ? { boqItemId: query.boqItemId } : {}),
        ...(query.status ? { currentStatus: query.status } : {}),
      },
      orderBy: { pieceCode: 'asc' },
      take: MAX_LISTED_PIECES,
      select: {
        id: true,
        boqItemId: true,
        pieceNo: true,
        pieceCode: true,
        drawingNo: true,
        currentStatus: true,
        sizeOrSpecification: true,
        currentLocation: true,
        isCancelled: true,
        updatedAt: true,
        // FMP-BOQ-11 — the drawing / calculation group the piece currently belongs to (none = Not assigned).
        drawingGroupLinks: {
          where: { activeSlot: 1 },
          take: 1,
          select: { group: { select: { id: true, drawingNo: true, calculationRef: true, groupTitle: true, status: true, _count: { select: { attachments: true } } } } },
        },
      },
    });
  }

  // -------------------------------------------------------------------------
  // FMP-BOQ-05 — status updates. Common foundation only: no Production,
  // Storage & Delivery or Erection records are created or touched, and
  // Contract Qty / drawing confirmations are never changed here.
  // -------------------------------------------------------------------------

  /** Moves the selected pieces to one status; every change writes a history row (old status, new status, note, who). */
  async bulkUpdateStatus(
    contractId: string,
    pieceIds: string[],
    status: PieceUpdateTargetStatus,
    note: string | undefined,
    actor: AuthUser,
    context: PieceUpdateContext = 'TECHNICAL',
  ): Promise<PieceStatusUpdateResult> {
    this.requireWrite(actor);
    await this.loadContract(contractId, actor);
    if (pieceIds.length === 0) {
      throw new UnprocessableEntityException({ code: 'BOQ_PIECES_NONE_SELECTED', message: 'Please select at least one piece.' });
    }
    // FMP-BOQ-06 — each department may only set its own statuses (contracts.manage may set any).
    return applyPieceStatusUpdate(this.db, {
      contractId,
      pieceIds,
      target: status as ContractBoqPieceStatus,
      note,
      actorId: actor.id,
      allowedStatuses: allowedPieceStatuses(context, actor.permissions),
    });
  }

  /** One piece. Unlike bulk, a piece that cannot be updated is an error with the plain reason. */
  async updateStatus(
    contractId: string,
    pieceId: string,
    status: PieceUpdateTargetStatus,
    note: string | undefined,
    actor: AuthUser,
    context: PieceUpdateContext = 'TECHNICAL',
  ) {
    const result = await this.bulkUpdateStatus(contractId, [pieceId], status, note, actor, context);
    const skip = result.skipped[0];
    if (skip) {
      if (skip.reason === 'NOT_FOUND') throw new NotFoundException({ code: 'BOQ_PIECE_NOT_FOUND', message: skip.message });
      if (skip.reason === 'NOT_ALLOWED') throw new ForbiddenException({ code: 'BOQ_PIECE_STATUS_NOT_ALLOWED', message: skip.message });
      throw new ConflictException({ code: `BOQ_PIECE_${skip.reason}`, message: skip.message });
    }
    return { updatedCount: 1, message: result.message };
  }

  /** Newest first: when, from, to, note, who. Read-only. */
  async history(contractId: string, pieceId: string, actor: AuthUser) {
    this.requireRead(actor);
    await this.loadContract(contractId, actor);
    const client = this.db.getClient();

    const piece = await client.contractBoqPiece.findFirst({ where: { id: pieceId, contractId }, select: { id: true, pieceCode: true } });
    if (!piece) throw new NotFoundException({ code: 'BOQ_PIECE_NOT_FOUND', message: 'Piece was not found in this job.' });

    const rows = await client.contractBoqPieceStatusHistory.findMany({
      where: { pieceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        oldStatus: true,
        newStatus: true,
        note: true,
        createdAt: true,
        updatedByUser: { select: { id: true, displayName: true } },
      },
    });
    return { pieceCode: piece.pieceCode, history: rows };
  }

  /** The statuses this user may set from this page. The UI shows exactly this list (and nothing to update if it is empty). */
  allowedStatuses(actor: AuthUser, context: PieceUpdateContext = 'TECHNICAL'): { context: PieceUpdateContext; statuses: ContractBoqPieceStatus[] } {
    this.requireRead(actor);
    const canWrite = actor.permissions.includes('contracts.update') || actor.permissions.includes('contracts.workflow_update');
    return { context, statuses: canWrite ? allowedPieceStatuses(context, actor.permissions) : [] };
  }
}
