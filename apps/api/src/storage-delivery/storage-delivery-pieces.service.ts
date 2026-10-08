import { ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ContractBoqPieceStatus } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import type { ProductionPieceListQueryDto } from '../production/dto/production-piece.dto';
import type { PieceUpdateTargetStatus } from '../technical/dto/boq-piece-status.dto';
import { storageDeliveryAllowedPieceStatuses } from '../technical/boq-piece-generation';
import { applyPieceStatusUpdate } from '../technical/boq-piece-status-update';
import type { PieceStatusUpdateResult } from '../technical/boq-piece-status-update';
import { listScreenPieces, parseScreenStatuses, screenContractOptions, screenPieceHistory, screenStatusGroups } from '../technical/boq-piece-screen';

// ---------------------------------------------------------------------------
// FMP-BOQ-08 — Storage Yard & Delivery view of the BOQ piece engine. It only
// READS pieces and UPDATES piece status/location/history through the shared
// engine; it creates no delivery notes, stock movements or dispatch records.
// ---------------------------------------------------------------------------

/** Statuses this screen shows; anything else (Drawing Ready, In Production, Erected ...) never appears here. */
export const STORAGE_VISIBLE_STATUSES: ContractBoqPieceStatus[] = [
  ContractBoqPieceStatus.PRODUCED,
  ContractBoqPieceStatus.IN_STORE,
  ContractBoqPieceStatus.DELIVERED,
  ContractBoqPieceStatus.ON_HOLD,
  ContractBoqPieceStatus.REJECTED,
];

/** Default list = Produced + In Store. */
export const STORAGE_DEFAULT_STATUSES: ContractBoqPieceStatus[] = [ContractBoqPieceStatus.PRODUCED, ContractBoqPieceStatus.IN_STORE];

export function parseStorageStatuses(statuses: string | undefined): ContractBoqPieceStatus[] {
  return parseScreenStatuses(statuses, STORAGE_VISIBLE_STATUSES, STORAGE_DEFAULT_STATUSES);
}

export interface StoragePieceSummary {
  /** Produced pieces not yet stored or delivered. */
  readyForStore: number;
  inStore: number;
  delivered: number;
  onHoldOrRejected: number;
}

export function buildStorageSummary(groups: { currentStatus: ContractBoqPieceStatus; count: number }[]): StoragePieceSummary {
  const n = (...statuses: ContractBoqPieceStatus[]): number =>
    groups.filter((g) => statuses.includes(g.currentStatus)).reduce((sum, g) => sum + g.count, 0);
  return {
    readyForStore: n(ContractBoqPieceStatus.PRODUCED),
    inStore: n(ContractBoqPieceStatus.IN_STORE),
    delivered: n(ContractBoqPieceStatus.DELIVERED),
    onHoldOrRejected: n(ContractBoqPieceStatus.ON_HOLD, ContractBoqPieceStatus.REJECTED),
  };
}

// FMP-UI-33 — per-contract piece-status breakdown for the redesigned
// Storage Yard & Delivery dashboard. Same approach as
// ProductionPiecesService.contractProgress()/buildProductionContractProgress()
// (FMP-UI-32): one read-only findMany over the same non-cancelled-pieces
// population summary()/screenStatusGroups() already read, reduced in JS so
// the result also carries each contract's identity and latest updatedAt (a
// groupBy alone could give neither). Feeds the KPI row, Overall Delivery
// Flow, the Contract/Project selector, Selected Project Delivery, and the
// Delivery Work Queue from this one query. Hold/Rejected kept separate —
// the existing summary() above combines them into onHoldOrRejected; this
// unit's own KPI row needs them apart.
export interface StorageContractProgress {
  contractId: string;
  referenceNumber: string;
  jobOrder: string | null;
  projectName: string;
  readyForStore: number;
  inStore: number;
  delivered: number;
  onHold: number;
  rejected: number;
  lastUpdatedAt: string;
}

export function buildStorageContractProgress(
  rows: { contractId: string; currentStatus: ContractBoqPieceStatus; updatedAt: Date; contract: { referenceNumber: string; jobOrder: string | null; title: string } }[],
): StorageContractProgress[] {
  const byContract = new Map<string, StorageContractProgress>();
  for (const r of rows) {
    let entry = byContract.get(r.contractId);
    if (!entry) {
      entry = {
        contractId: r.contractId,
        referenceNumber: r.contract.referenceNumber,
        jobOrder: r.contract.jobOrder,
        projectName: r.contract.title,
        readyForStore: 0, inStore: 0, delivered: 0, onHold: 0, rejected: 0,
        lastUpdatedAt: r.updatedAt.toISOString(),
      };
      byContract.set(r.contractId, entry);
    }
    switch (r.currentStatus) {
      case ContractBoqPieceStatus.PRODUCED: entry.readyForStore++; break;
      case ContractBoqPieceStatus.IN_STORE: entry.inStore++; break;
      case ContractBoqPieceStatus.DELIVERED: entry.delivered++; break;
      case ContractBoqPieceStatus.ON_HOLD: entry.onHold++; break;
      case ContractBoqPieceStatus.REJECTED: entry.rejected++; break;
      default: break;
    }
    const updatedIso = r.updatedAt.toISOString();
    if (updatedIso > entry.lastUpdatedAt) entry.lastUpdatedAt = updatedIso;
  }
  return [...byContract.values()];
}

export interface RecentStoragePieceUpdate {
  id: string;
  pieceCode: string;
  newStatus: ContractBoqPieceStatus;
  contractId: string;
  referenceNumber: string;
  jobOrder: string | null;
  projectName: string;
  /** The piece's CURRENT location, not a historical snapshot — ContractBoqPieceStatusHistory has no location column. */
  currentLocation: string | null;
  createdAt: string;
  updatedByName: string | null;
}

@Injectable()
export class StorageDeliveryPiecesService {
  constructor(private readonly db: DatabaseService) {}

  private requireRead(actor: AuthUser): void {
    if (!actor.permissions.includes('storage_delivery.read')) {
      throw new ForbiddenException({ code: 'STORAGE_DELIVERY_PERMISSION_DENIED', message: 'Missing storage_delivery.read' });
    }
  }

  private requireWrite(actor: AuthUser): void {
    if (storageDeliveryAllowedPieceStatuses(actor.permissions).length === 0) {
      throw new ForbiddenException({ code: 'STORAGE_DELIVERY_PERMISSION_DENIED', message: 'You cannot update pieces to this status.' });
    }
  }

  allowedStatuses(actor: AuthUser): { context: 'STORAGE_DELIVERY'; statuses: ContractBoqPieceStatus[] } {
    this.requireRead(actor);
    return { context: 'STORAGE_DELIVERY', statuses: storageDeliveryAllowedPieceStatuses(actor.permissions) };
  }

  async list(query: ProductionPieceListQueryDto, actor: AuthUser) {
    this.requireRead(actor);
    return listScreenPieces(this.db, query, STORAGE_VISIBLE_STATUSES, STORAGE_DEFAULT_STATUSES);
  }

  async summary(actor: AuthUser): Promise<StoragePieceSummary> {
    this.requireRead(actor);
    return buildStorageSummary(await screenStatusGroups(this.db));
  }

  async contractOptions(actor: AuthUser) {
    this.requireRead(actor);
    return screenContractOptions(this.db);
  }

  /** FMP-UI-33 — see buildStorageContractProgress()'s own doc comment above. */
  async contractProgress(actor: AuthUser): Promise<StorageContractProgress[]> {
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
    return buildStorageContractProgress(rows);
  }

  // FMP-UI-33 — "Recent Storage / Delivery Updates": the latest piece status
  // changes across every contract. Reads the SAME contractBoqPieceStatusHistory
  // table history() above already reads (per-piece there; here, the newest
  // rows across all pieces) — nothing new is written, no existing read changed.
  async recentUpdates(actor: AuthUser, limit = 5): Promise<RecentStoragePieceUpdate[]> {
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

  /** Bulk (or one-piece) update through the shared engine, limited to Storage Yard and Delivery statuses. */
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
      allowedStatuses: storageDeliveryAllowedPieceStatuses(actor.permissions),
    });
  }

  async history(pieceId: string, actor: AuthUser) {
    this.requireRead(actor);
    return screenPieceHistory(this.db, pieceId);
  }
}
