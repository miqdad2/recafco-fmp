import { ForbiddenException, Injectable, Logger, NotFoundException, UnprocessableEntityException, BadRequestException } from '@nestjs/common';
import { ContractBoqPieceStatus } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import type { ProductionPieceListQueryDto } from './dto/production-piece.dto';
import type { PieceUpdateTargetStatus } from '../technical/dto/boq-piece-status.dto';
import { productionAllowedPieceStatuses } from '../technical/boq-piece-generation';
import { applyPieceStatusUpdate } from '../technical/boq-piece-status-update';
import { RELEASED_ELEMENT_FILTER, listScreenPieces, parseScreenStatuses, screenContractOptions, screenPieceHistory, screenStatusGroups } from '../technical/boq-piece-screen';
import type { PieceStatusUpdateResult } from '../technical/boq-piece-status-update';
import { PRODUCTION_FILE_MESSAGES, buildProductionDrawingInfo, toProductionDrawingGroup } from './production-drawing-files';
import type { ProductionDrawingSource } from './production-drawing-files';
import { TechnicalAttachmentStorageService } from '../technical/technical-attachment-storage.service';
import { TechnicalDrawingGroupFileStorageService } from '../technical/technical-drawing-group-file-storage.service';
import { convertTiffToPng, isTiffAttachment, previewStoragePath } from '../technical/tiff-preview';
import type { PieceGroupLink } from './production-drawing-files';

// ---------------------------------------------------------------------------
// FMP-TECH-24 — Production only sees elements whose drawing group Technical has
// released (list, summary, contract filter and per-contract progress all use
// RELEASED_ELEMENT_FILTER); unreleased elements never reach this screen.
//
// FMP-BOQ-07 — Production's view of the BOQ piece engine. It only READS pieces
// and UPDATES piece status/history through the shared engine; it creates no
// production orders, batches, inventory or delivery/erection records.
// ---------------------------------------------------------------------------

/** Statuses Production works with; anything else (In Store, Delivered, …) never appears on this screen. */
export const PRODUCTION_VISIBLE_STATUSES: ContractBoqPieceStatus[] = [
  ContractBoqPieceStatus.DRAWING_READY,
  ContractBoqPieceStatus.IN_PRODUCTION,
  ContractBoqPieceStatus.PRODUCED,
  ContractBoqPieceStatus.SENT_TO_STORAGE,
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
  sentToStorage: number;
  onHoldOrRejected: number;
}

export function buildProductionSummary(groups: { currentStatus: ContractBoqPieceStatus; count: number }[]): ProductionPieceSummary {
  const n = (...statuses: ContractBoqPieceStatus[]): number =>
    groups.filter((g) => statuses.includes(g.currentStatus)).reduce((sum, g) => sum + g.count, 0);
  return {
    readyForProduction: n(ContractBoqPieceStatus.DRAWING_READY),
    inProduction: n(ContractBoqPieceStatus.IN_PRODUCTION),
    produced: n(ContractBoqPieceStatus.PRODUCED),
    sentToStorage: n(ContractBoqPieceStatus.SENT_TO_STORAGE),
    onHoldOrRejected: n(ContractBoqPieceStatus.ON_HOLD, ContractBoqPieceStatus.REJECTED),
  };
}

// FMP-UI-32 — per-contract piece-status breakdown for the redesigned
// Production & Planning dashboard: KPI row, Overall Production Flow,
// Selected Project Production, the Contract/Project selector (search runs
// client-side against this one already-complete list — see this unit's own
// dashboard helpers), and the Production Work Queue are all derived from
// this single array, not 5 separate queries. Reuses the exact same
// non-cancelled-pieces population `screenStatusGroups()`/`summary()` above
// already reads; this just keeps the per-contract breakdown instead of
// collapsing it into one platform-wide total. Read-only — nothing here
// writes a piece, and Hold/Rejected are kept separate (the existing
// `summary()` above combines them into `onHoldOrRejected`; this unit's own
// KPI row needs them apart).
export interface ProductionContractProgress {
  contractId: string;
  referenceNumber: string;
  jobOrder: string | null;
  projectName: string;
  /** Contract counterparty — shown as the client. */
  clientName: string;
  readyForProduction: number;
  inProduction: number;
  produced: number;
  sentToStorage: number;
  onHold: number;
  rejected: number;
  /** Latest piece update among this contract's own pieces. */
  lastUpdatedAt: string;
}

export function buildProductionContractProgress(
  rows: { contractId: string; currentStatus: ContractBoqPieceStatus; updatedAt: Date; contract: { referenceNumber: string; jobOrder: string | null; title: string; counterpartyName: string } }[],
): ProductionContractProgress[] {
  const byContract = new Map<string, ProductionContractProgress>();
  for (const r of rows) {
    let entry = byContract.get(r.contractId);
    if (!entry) {
      entry = {
        contractId: r.contractId,
        referenceNumber: r.contract.referenceNumber,
        jobOrder: r.contract.jobOrder,
        projectName: r.contract.title,
        clientName: r.contract.counterpartyName,
        readyForProduction: 0, inProduction: 0, produced: 0, sentToStorage: 0, onHold: 0, rejected: 0,
        lastUpdatedAt: r.updatedAt.toISOString(),
      };
      byContract.set(r.contractId, entry);
    }
    switch (r.currentStatus) {
      case ContractBoqPieceStatus.DRAWING_READY: entry.readyForProduction++; break;
      case ContractBoqPieceStatus.IN_PRODUCTION: entry.inProduction++; break;
      case ContractBoqPieceStatus.PRODUCED: entry.produced++; break;
      case ContractBoqPieceStatus.SENT_TO_STORAGE: entry.sentToStorage++; break;
      case ContractBoqPieceStatus.ON_HOLD: entry.onHold++; break;
      case ContractBoqPieceStatus.REJECTED: entry.rejected++; break;
      default: break;
    }
    const updatedIso = r.updatedAt.toISOString();
    if (updatedIso > entry.lastUpdatedAt) entry.lastUpdatedAt = updatedIso;
  }
  return [...byContract.values()];
}

@Injectable()
export class ProductionPiecesService {
  private readonly logger = new Logger(ProductionPiecesService.name);
  private readonly previewJobs = new Map<string, Promise<void>>();

  constructor(
    private readonly db: DatabaseService,
    private readonly elementStorage?: TechnicalAttachmentStorageService,
    private readonly groupStorage?: TechnicalDrawingGroupFileStorageService,
  ) {}

  private requireRead(actor: AuthUser): void {
    if (!actor.permissions.includes('production.read')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.read' });
    }
  }

  private requireWrite(actor: AuthUser): void {
    if (productionAllowedPieceStatuses(actor.permissions).length === 0) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'You cannot update elements to this status.' });
    }
  }

  allowedStatuses(actor: AuthUser): { context: 'PRODUCTION'; statuses: ContractBoqPieceStatus[] } {
    this.requireRead(actor);
    return { context: 'PRODUCTION', statuses: productionAllowedPieceStatuses(actor.permissions) };
  }

  async list(query: ProductionPieceListQueryDto, actor: AuthUser) {
    this.requireRead(actor);
    const result = await listScreenPieces(this.db, query, PRODUCTION_VISIBLE_STATUSES, PRODUCTION_DEFAULT_STATUSES, { includeDrawingGroup: true, releasedOnly: true });
    // FMP-BOQ-13 — Production only learns a group's details once it is Released to Production.
    return {
      ...result,
      items: result.items.map(({ drawingGroupLinks, _count, ...piece }) => ({
        ...piece,
        drawingGroup: toProductionDrawingGroup(drawingGroupLinks as unknown as PieceGroupLink[] | undefined),
        // FMP-PROD-03 — where the final drawing comes from, for the View / Download Drawing buttons.
        drawing: buildProductionDrawingInfo({
          drawingNo: piece.drawingNo,
          ownFileCount: _count?.attachments ?? 0,
          groupLinks: drawingGroupLinks as unknown as PieceGroupLink[] | undefined,
        }),
      })),
    };
  }

  /**
   * Which final drawing Production may open for an element, and from where.
   * A group's files only once the group is Released to Production (Production never sees a draft /
   * submitted / approved group); otherwise the element's own files, which Technical released on their own.
   */
  private async drawingSourceForPiece(pieceId: string): Promise<{
    piece: { id: string; pieceCode: string; drawingNo: string; contract: { referenceNumber: string; jobOrder: string | null; title: string } };
    source: Exclude<ProductionDrawingSource, 'NONE'>;
    group: { id: string; drawingNo: string; calculationRef: string | null; groupTitle: string | null } | null;
  }> {
    const piece = await this.db.getClient().contractBoqPiece.findUnique({
      where: { id: pieceId },
      select: {
        id: true,
        pieceCode: true,
        drawingNo: true,
        releasedToProductionAt: true,
        contract: { select: { referenceNumber: true, jobOrder: true, title: true } },
        drawingGroupLinks: {
          where: { activeSlot: 1 },
          take: 1,
          select: { group: { select: { id: true, drawingNo: true, calculationRef: true, groupTitle: true, status: true } } },
        },
      },
    });
    if (!piece) throw new NotFoundException({ code: 'BOQ_PIECE_NOT_FOUND', message: PRODUCTION_FILE_MESSAGES.pieceNotFound });
    const group = piece.drawingGroupLinks[0]?.group ?? null;
    if (group && group.status === 'RELEASED_TO_PRODUCTION') return { piece, source: 'GROUP', group };
    if (piece.releasedToProductionAt) return { piece, source: 'INDIVIDUAL', group: null };
    if (group) throw new ForbiddenException({ code: 'PRODUCTION_DRAWING_NOT_RELEASED', message: PRODUCTION_FILE_MESSAGES.notReleased });
    throw new NotFoundException({ code: 'PRODUCTION_NO_DRAWING_GROUP', message: PRODUCTION_FILE_MESSAGES.noGroup });
  }

  /** Read-only: the final drawing files for one element (its group's, or its own) — never raw server paths. */
  async drawingFiles(pieceId: string, actor: AuthUser) {
    this.requireRead(actor);
    const { piece, source, group } = await this.drawingSourceForPiece(pieceId);
    const client = this.db.getClient();
    const files =
      source === 'GROUP' && group
        ? await client.technicalDrawingGroupAttachment.findMany({
            where: { groupId: group.id },
            orderBy: { createdAt: 'desc' },
            select: { id: true, originalName: true, mimeType: true, fileSize: true, category: true, createdAt: true },
          })
        : await client.contractBoqPieceAttachment.findMany({
            where: { pieceId },
            orderBy: { createdAt: 'asc' },
            select: { id: true, originalName: true, mimeType: true, fileSize: true, createdAt: true },
          });
    return {
      pieceCode: piece.pieceCode,
      contract: piece.contract,
      source,
      group: group
        ? { drawingNo: group.drawingNo, calculationRef: group.calculationRef, groupTitle: group.groupTitle }
        : { drawingNo: piece.drawingNo, calculationRef: null, groupTitle: null },
      files,
    };
  }

  /** The stored file for a view / download — only if it belongs to the element's released group, or to the element itself. */
  async drawingFileForDownload(pieceId: string, attachmentId: string, actor: AuthUser) {
    this.requireRead(actor);
    const { source, group } = await this.drawingSourceForPiece(pieceId);
    const client = this.db.getClient();
    const file =
      source === 'GROUP' && group
        ? await client.technicalDrawingGroupAttachment.findFirst({
            where: { id: attachmentId, groupId: group.id },
            select: { storagePath: true, originalName: true, mimeType: true },
          })
        : await client.contractBoqPieceAttachment.findFirst({
            where: { id: attachmentId, pieceId },
            select: { storagePath: true, originalName: true, mimeType: true },
          });
    if (!file) throw new NotFoundException({ code: 'GROUP_FILE_NOT_FOUND', message: PRODUCTION_FILE_MESSAGES.fileNotFound });
    return { ...file, source };
  }

  /** PNG preview of a TIFF drawing, for the viewer only (browsers cannot show TIFF). The original is never changed. */
  async drawingFilePreview(pieceId: string, attachmentId: string, actor: AuthUser): Promise<{ previewPath: string; originalName: string; source: 'GROUP' | 'INDIVIDUAL' }> {
    const file = await this.drawingFileForDownload(pieceId, attachmentId, actor);
    if (!isTiffAttachment({ originalFileName: file.originalName, mimeType: file.mimeType })) {
      throw new BadRequestException({ code: 'PRODUCTION_PREVIEW_NOT_NEEDED', message: 'This file does not need a preview.' });
    }
    const storage = file.source === 'GROUP' ? this.groupStorage : this.elementStorage;
    if (!storage) throw new UnprocessableEntityException({ code: 'PRODUCTION_PREVIEW_FAILED', message: 'Preview could not be prepared. Please download the file.' });
    const previewPath = previewStoragePath(file.storagePath);
    if (!(await storage.exists(previewPath))) {
      let job = this.previewJobs.get(previewPath);
      if (!job) {
        job = (async () => {
          try {
            await storage.writeDerived(previewPath, await convertTiffToPng(await storage.readBuffer(file.storagePath)));
          } catch (err) {
            this.logger.warn(`TIFF preview failed for ${file.storagePath}: ${err instanceof Error ? err.message : String(err)}`);
            throw new UnprocessableEntityException({ code: 'PRODUCTION_PREVIEW_FAILED', message: 'Preview could not be prepared. Please download the file.' });
          }
        })().finally(() => this.previewJobs.delete(previewPath));
        this.previewJobs.set(previewPath, job);
      }
      await job;
    }
    return { previewPath, originalName: file.originalName, source: file.source };
  }

  /** Counts for the four summary cards (all non-cancelled pieces, not just the current filter). */
  async summary(actor: AuthUser): Promise<ProductionPieceSummary> {
    this.requireRead(actor);
    return buildProductionSummary(await screenStatusGroups(this.db, { releasedOnly: true }));
  }

  /** Jobs that have pieces — for the Contract filter. */
  async contractOptions(actor: AuthUser) {
    this.requireRead(actor);
    return screenContractOptions(this.db, { releasedOnly: true });
  }

  /** FMP-UI-32 — see buildProductionContractProgress()'s own doc comment above. */
  async contractProgress(actor: AuthUser): Promise<ProductionContractProgress[]> {
    this.requireRead(actor);
    const rows = await this.db.getClient().contractBoqPiece.findMany({
      where: { isCancelled: false, ...RELEASED_ELEMENT_FILTER },
      select: {
        contractId: true,
        currentStatus: true,
        updatedAt: true,
        contract: { select: { referenceNumber: true, jobOrder: true, title: true, counterpartyName: true } },
      },
    });
    return buildProductionContractProgress(rows);
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
      throw new UnprocessableEntityException({ code: 'BOQ_PIECES_NONE_SELECTED', message: 'Please select at least one element.' });
    }
    return applyPieceStatusUpdate(this.db, {
      pieceIds,
      target: status as ContractBoqPieceStatus,
      note,
      actorId: actor.id,
      requireRelease: true,
      requireDrawing: true,
      allowedStatuses: productionAllowedPieceStatuses(actor.permissions),
    });
  }

  /** Same history shape the Technical screen uses. */
  async history(pieceId: string, actor: AuthUser) {
    this.requireRead(actor);
    const result = await screenPieceHistory(this.db, pieceId);
    // FMP-PROD-02 — the history starts with the release from Technical, which is not a status change.
    const piece = await this.db.getClient().contractBoqPiece.findUnique({
      where: { id: pieceId },
      select: {
        releasedToProductionAt: true,
        releasedToProductionById: true,
        drawingGroupLinks: { where: { activeSlot: 1 }, take: 1, select: { group: { select: { status: true, releasedAt: true, releasedByUser: { select: { id: true, displayName: true } } } } } },
      },
    });
    const group = piece?.drawingGroupLinks?.[0]?.group;
    const releasedAt = piece?.releasedToProductionAt ?? (group?.status === 'RELEASED_TO_PRODUCTION' ? group.releasedAt : null);
    if (!piece || !releasedAt) return result;
    let releasedBy = group?.releasedByUser ?? null;
    if (piece.releasedToProductionById) {
      releasedBy = await this.db.getClient().user.findUnique({ where: { id: piece.releasedToProductionById }, select: { id: true, displayName: true } });
    }
    return {
      ...result,
      history: [
        ...result.history,
        { id: `released-${pieceId}`, oldStatus: null, newStatus: ContractBoqPieceStatus.DRAWING_READY, note: 'Released from Technical', createdAt: releasedAt, updatedByUser: releasedBy },
      ],
    };
  }

  // FMP-UI-32 — "Recent Production Updates": the latest piece status
  // changes across every contract, for the redesigned dashboard. Reads the
  // SAME `contractBoqPieceStatusHistory` table `history()` above already
  // reads (per-piece there; here, the newest rows across all pieces) —
  // nothing new is written, and no existing read is changed.
  async recentUpdates(actor: AuthUser, limit = 5): Promise<RecentPieceUpdate[]> {
    this.requireRead(actor);
    // Production-relevant only: released elements in the statuses Production works with —
    // Technical's generated-only activity never shows here.
    const rows = await this.db.getClient().contractBoqPieceStatusHistory.findMany({
      where: {
        newStatus: { in: PRODUCTION_VISIBLE_STATUSES },
        piece: { isCancelled: false, ...RELEASED_ELEMENT_FILTER },
      },
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
      createdAt: r.createdAt.toISOString(),
      updatedByName: r.updatedByUser?.displayName ?? null,
    }));
  }
}

export interface RecentPieceUpdate {
  id: string;
  pieceCode: string;
  newStatus: ContractBoqPieceStatus;
  contractId: string;
  referenceNumber: string;
  jobOrder: string | null;
  projectName: string;
  createdAt: string;
  updatedByName: string | null;
}
