import { ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ContractBoqPieceStatus } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import type { ProductionPieceListQueryDto } from './dto/production-piece.dto';
import type { PieceUpdateTargetStatus } from '../technical/dto/boq-piece-status.dto';
import { productionAllowedPieceStatuses } from '../technical/boq-piece-generation';
import { applyPieceStatusUpdate } from '../technical/boq-piece-status-update';
import { listScreenPieces, parseScreenStatuses, screenContractOptions, screenPieceHistory, screenStatusGroups } from '../technical/boq-piece-screen';
import type { PieceStatusUpdateResult } from '../technical/boq-piece-status-update';

// ---------------------------------------------------------------------------
// FMP-BOQ-07 — Production's view of the BOQ piece engine. It only READS pieces
// and UPDATES piece status/history through the shared engine; it creates no
// production orders, batches, inventory or delivery/erection records.
// ---------------------------------------------------------------------------

/** Statuses Production works with; anything else (In Store, Delivered, …) never appears on this screen. */
export const PRODUCTION_VISIBLE_STATUSES: ContractBoqPieceStatus[] = [
  ContractBoqPieceStatus.DRAWING_READY,
  ContractBoqPieceStatus.IN_PRODUCTION,
  ContractBoqPieceStatus.PRODUCED,
  ContractBoqPieceStatus.ON_HOLD,
  ContractBoqPieceStatus.REJECTED,
];

/** Default list = "Ready for Production" + "In Production". */
export const PRODUCTION_DEFAULT_STATUSES: ContractBoqPieceStatus[] = [
  ContractBoqPieceStatus.DRAWING_READY,
  ContractBoqPieceStatus.IN_PRODUCTION,
];

/** Turns the comma list into valid Production statuses; nothing valid → the default. */
export function parseProductionStatuses(statuses: string | undefined): ContractBoqPieceStatus[] {
  return parseScreenStatuses(statuses, PRODUCTION_VISIBLE_STATUSES, PRODUCTION_DEFAULT_STATUSES);
}

export interface ProductionPieceSummary {
  readyForProduction: number;
  inProduction: number;
  produced: number;
  onHoldOrRejected: number;
}

export function buildProductionSummary(groups: { currentStatus: ContractBoqPieceStatus; count: number }[]): ProductionPieceSummary {
  const n = (...statuses: ContractBoqPieceStatus[]): number =>
    groups.filter((g) => statuses.includes(g.currentStatus)).reduce((sum, g) => sum + g.count, 0);
  return {
    readyForProduction: n(ContractBoqPieceStatus.DRAWING_READY),
    inProduction: n(ContractBoqPieceStatus.IN_PRODUCTION),
    produced: n(ContractBoqPieceStatus.PRODUCED),
    onHoldOrRejected: n(ContractBoqPieceStatus.ON_HOLD, ContractBoqPieceStatus.REJECTED),
  };
}

@Injectable()
export class ProductionPiecesService {
  constructor(private readonly db: DatabaseService) {}

  private requireRead(actor: AuthUser): void {
    if (!actor.permissions.includes('production.read')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.read' });
    }
  }

  private requireWrite(actor: AuthUser): void {
    if (productionAllowedPieceStatuses(actor.permissions).length === 0) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'You cannot update pieces to this status.' });
    }
  }

  allowedStatuses(actor: AuthUser): { context: 'PRODUCTION'; statuses: ContractBoqPieceStatus[] } {
    this.requireRead(actor);
    return { context: 'PRODUCTION', statuses: productionAllowedPieceStatuses(actor.permissions) };
  }

  async list(query: ProductionPieceListQueryDto, actor: AuthUser) {
    this.requireRead(actor);
    return listScreenPieces(this.db, query, PRODUCTION_VISIBLE_STATUSES, PRODUCTION_DEFAULT_STATUSES);
  }

  /** Counts for the four summary cards (all non-cancelled pieces, not just the current filter). */
  async summary(actor: AuthUser): Promise<ProductionPieceSummary> {
    this.requireRead(actor);
    return buildProductionSummary(await screenStatusGroups(this.db));
  }

  /** Jobs that have pieces — for the Contract filter. */
  async contractOptions(actor: AuthUser) {
    this.requireRead(actor);
    return screenContractOptions(this.db);
  }

  /** Bulk (or one-piece) update through the shared engine, limited to Production's own statuses. */
  async bulkUpdateStatus(
    pieceIds: string[],
    status: PieceUpdateTargetStatus,
    note: string | undefined,
    actor: AuthUser,
  ): Promise<PieceStatusUpdateResult> {
    this.requireRead(actor);
    this.requireWrite(actor);
    if (pieceIds.length === 0) {
      throw new UnprocessableEntityException({ code: 'BOQ_PIECES_NONE_SELECTED', message: 'Please select at least one piece.' });
    }
    return applyPieceStatusUpdate(this.db, {
      pieceIds,
      target: status as ContractBoqPieceStatus,
      note,
      actorId: actor.id,
      allowedStatuses: productionAllowedPieceStatuses(actor.permissions),
    });
  }

  /** Same history shape the Technical screen uses. */
  async history(pieceId: string, actor: AuthUser) {
    this.requireRead(actor);
    return screenPieceHistory(this.db, pieceId);
  }
}
