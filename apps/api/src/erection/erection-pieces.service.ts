import { ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ContractBoqPieceStatus } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import type { ProductionPieceListQueryDto } from '../production/dto/production-piece.dto';
import type { PieceUpdateTargetStatus } from '../technical/dto/boq-piece-status.dto';
import { erectionAllowedPieceStatuses } from '../technical/boq-piece-generation';
import { applyPieceStatusUpdate } from '../technical/boq-piece-status-update';
import type { PieceStatusUpdateResult } from '../technical/boq-piece-status-update';
import { listScreenPieces, parseScreenStatuses, screenContractOptions, screenPieceHistory, screenStatusGroups } from '../technical/boq-piece-screen';

// ---------------------------------------------------------------------------
// FMP-BOQ-09 — Erection's view of the BOQ piece engine. It only READS pieces and
// UPDATES piece status/location/history through the shared engine; it creates
// no erection plans, crew assignments, inspections or stock movements.
// ---------------------------------------------------------------------------

/** Statuses this screen shows; anything before delivery (Drawing Ready, Produced, In Store ...) never appears here. */
export const ERECTION_VISIBLE_STATUSES: ContractBoqPieceStatus[] = [
  ContractBoqPieceStatus.DELIVERED,
  ContractBoqPieceStatus.ERECTED,
  ContractBoqPieceStatus.COMPLETED,
  ContractBoqPieceStatus.ON_HOLD,
  ContractBoqPieceStatus.REJECTED,
];

/** Default list = Delivered + Erected. */
export const ERECTION_DEFAULT_STATUSES: ContractBoqPieceStatus[] = [ContractBoqPieceStatus.DELIVERED, ContractBoqPieceStatus.ERECTED];

export function parseErectionStatuses(statuses: string | undefined): ContractBoqPieceStatus[] {
  return parseScreenStatuses(statuses, ERECTION_VISIBLE_STATUSES, ERECTION_DEFAULT_STATUSES);
}

export interface ErectionPieceSummary {
  /** Delivered pieces not yet erected. */
  readyForErection: number;
  erected: number;
  completed: number;
  onHoldOrRejected: number;
}

export function buildErectionSummary(groups: { currentStatus: ContractBoqPieceStatus; count: number }[]): ErectionPieceSummary {
  const n = (...statuses: ContractBoqPieceStatus[]): number =>
    groups.filter((g) => statuses.includes(g.currentStatus)).reduce((sum, g) => sum + g.count, 0);
  return {
    readyForErection: n(ContractBoqPieceStatus.DELIVERED),
    erected: n(ContractBoqPieceStatus.ERECTED),
    completed: n(ContractBoqPieceStatus.COMPLETED),
    onHoldOrRejected: n(ContractBoqPieceStatus.ON_HOLD, ContractBoqPieceStatus.REJECTED),
  };
}

// FMP-UI-34 — per-contract piece-status breakdown for the redesigned
// Erection Dashboard. Same approach as ProductionPiecesService's/
// StorageDeliveryPiecesService's own contractProgress()/recentUpdates()
// (FMP-UI-32/33): one read-only findMany over the same non-cancelled-pieces
// population summary()/screenStatusGroups() already read, reduced in JS so
// the result also carries each contract's identity and latest updatedAt.
// Hold/Rejected kept separate — summary() above combines them.
export interface ErectionContractProgress {
  contractId: string;
  referenceNumber: string;
  jobOrder: string | null;
  projectName: string;
  readyForErection: number;
  erected: number;
  completed: number;
  onHold: number;
  rejected: number;
  lastUpdatedAt: string;
}

export function buildErectionContractProgress(
  rows: { contractId: string; currentStatus: ContractBoqPieceStatus; updatedAt: Date; contract: { referenceNumber: string; jobOrder: string | null; title: string } }[],
): ErectionContractProgress[] {
  const byContract = new Map<string, ErectionContractProgress>();
  for (const r of rows) {
    let entry = byContract.get(r.contractId);
    if (!entry) {
      entry = {
        contractId: r.contractId,
        referenceNumber: r.contract.referenceNumber,
        jobOrder: r.contract.jobOrder,
        projectName: r.contract.title,
        readyForErection: 0, erected: 0, completed: 0, onHold: 0, rejected: 0,
        lastUpdatedAt: r.updatedAt.toISOString(),
      };
      byContract.set(r.contractId, entry);
    }
    switch (r.currentStatus) {
      case ContractBoqPieceStatus.DELIVERED: entry.readyForErection++; break;
      case ContractBoqPieceStatus.ERECTED: entry.erected++; break;
      case ContractBoqPieceStatus.COMPLETED: entry.completed++; break;
      case ContractBoqPieceStatus.ON_HOLD: entry.onHold++; break;
      case ContractBoqPieceStatus.REJECTED: entry.rejected++; break;
      default: break;
    }
    const updatedIso = r.updatedAt.toISOString();
    if (updatedIso > entry.lastUpdatedAt) entry.lastUpdatedAt = updatedIso;
  }
  return [...byContract.values()];
}

export interface RecentErectionPieceUpdate {
  id: string;
  pieceCode: string;
  newStatus: ContractBoqPieceStatus;
  contractId: string;
  referenceNumber: string;
  jobOrder: string | null;
  projectName: string;
  /** The piece's CURRENT location/site note, not a historical snapshot — ContractBoqPieceStatusHistory has no location column. */
  currentLocation: string | null;
  createdAt: string;
  updatedByName: string | null;
}

@Injectable()
export class ErectionPiecesService {
  constructor(private readonly db: DatabaseService) {}

  private requireRead(actor: AuthUser): void {
    if (!actor.permissions.includes('erection.read')) {
      throw new ForbiddenException({ code: 'ERECTION_PERMISSION_DENIED', message: 'Missing erection.read' });
    }
  }

  private requireWrite(actor: AuthUser): void {
    if (erectionAllowedPieceStatuses(actor.permissions).length === 0) {
      throw new ForbiddenException({ code: 'ERECTION_PERMISSION_DENIED', message: 'You cannot update pieces to this status.' });
    }
  }

  allowedStatuses(actor: AuthUser): { context: 'ERECTION'; statuses: ContractBoqPieceStatus[] } {
    this.requireRead(actor);
    return { context: 'ERECTION', statuses: erectionAllowedPieceStatuses(actor.permissions) };
  }

  async list(query: ProductionPieceListQueryDto, actor: AuthUser) {
    this.requireRead(actor);
    return listScreenPieces(this.db, query, ERECTION_VISIBLE_STATUSES, ERECTION_DEFAULT_STATUSES);
  }

  async summary(actor: AuthUser): Promise<ErectionPieceSummary> {
    this.requireRead(actor);
    return buildErectionSummary(await screenStatusGroups(this.db));
  }

  async contractOptions(actor: AuthUser) {
    this.requireRead(actor);
    return screenContractOptions(this.db);
  }

  /** FMP-UI-34 — see buildErectionContractProgress()'s own doc comment above. */
  async contractProgress(actor: AuthUser): Promise<ErectionContractProgress[]> {
    this.requireRead(actor);
    const rows = await this.db.getClient().contractBoqPiece.findMany({
      where: { isCancelled: false },
      select: {
        contractId: true,
        currentStatus: true,
        updatedAt: true,
        contract: { select: { referenceNumber: true, jobOrder: true, title: true } },
      },
    });
    return buildErectionContractProgress(rows);
  }

  // FMP-UI-34 — "Recent Erection Updates": the latest piece status changes
  // across every contract. Reads the SAME contractBoqPieceStatusHistory
  // table history() above already reads (per-piece there; here, the newest
  // rows across all pieces) — nothing new is written, no existing read changed.
  async recentUpdates(actor: AuthUser, limit = 5): Promise<RecentErectionPieceUpdate[]> {
    this.requireRead(actor);
    const rows = await this.db.getClient().contractBoqPieceStatusHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        newStatus: true,
        createdAt: true,
        updatedByUser: { select: { displayName: true } },
        piece: {
          select: {
            pieceCode: true,
            currentLocation: true,
            contract: { select: { id: true, referenceNumber: true, jobOrder: true, title: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      pieceCode: r.piece.pieceCode,
      newStatus: r.newStatus,
      contractId: r.piece.contract.id,
      referenceNumber: r.piece.contract.referenceNumber,
      jobOrder: r.piece.contract.jobOrder,
      projectName: r.piece.contract.title,
      currentLocation: r.piece.currentLocation,
      createdAt: r.createdAt.toISOString(),
      updatedByName: r.updatedByUser?.displayName ?? null,
    }));
  }

  /** Bulk (or one-piece) update through the shared engine, limited to Erection's own statuses. */
  async bulkUpdateStatus(
    pieceIds: string[],
    status: PieceUpdateTargetStatus,
    note: string | undefined,
    location: string | undefined,
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
      location,
      actorId: actor.id,
      allowedStatuses: erectionAllowedPieceStatuses(actor.permissions),
    });
  }

  async history(pieceId: string, actor: AuthUser) {
    this.requireRead(actor);
    return screenPieceHistory(this.db, pieceId);
  }
}
