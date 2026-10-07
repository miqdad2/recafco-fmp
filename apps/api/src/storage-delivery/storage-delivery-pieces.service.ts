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
