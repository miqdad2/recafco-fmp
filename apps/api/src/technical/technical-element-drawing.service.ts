import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ContractBoqPieceStatus, ModuleIdentifier, TechnicalDrawingGroupStatus as S } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';
import { canDeleteOthersTechnicalFiles, hasTechnicalRead, hasTechnicalWrite } from './technical-permissions';
import { TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES, TECHNICAL_FILE_BAD_TYPE_MESSAGE, TechnicalAttachmentStorageService, resolveTechnicalAttachmentMimeType } from './technical-attachment-storage.service';
import { classifyElement, individualReleaseBlocker, summarizeCoverage } from './element-coverage';

// ---------------------------------------------------------------------------
// FMP-TECH-27 — final drawing files for ONE element, the coverage overview of
// all elements of a job, and releasing individually covered elements to
// Production. Same permission pairs, department access and file rules as every
// other Technical drawing file; files live under "boq-elements/<element id>".
// ---------------------------------------------------------------------------

export const ELEMENT_DRAWING_MESSAGES = {
  noFile: 'Please choose a file to upload.',
  badType: TECHNICAL_FILE_BAD_TYPE_MESSAGE,
  tooLarge: `This file is too large. The limit is ${TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES / (1024 * 1024)} MB per file.`,
  elementNotFound: 'Element not found for this job.',
  fileNotFound: 'File not found.',
  notOwner: 'You can only remove a file you added.',
  inGroup: 'This element is in a Drawing Group. Add the final drawing files to its group instead.',
  released: 'This element is already released to Production, so its files cannot be changed.',
  noneSelected: 'Please select at least one element.',
  coverageRequired: 'Final drawing coverage is required before release to Production.',
} as const;

const FOLDER = 'boq-elements';

const FILE_SELECT = {
  id: true,
  pieceId: true,
  originalName: true,
  mimeType: true,
  fileSize: true,
  drawingRefNo: true,
  revision: true,
  remarks: true,
  createdAt: true,
  uploadedById: true,
  uploadedByUser: { select: { id: true, displayName: true } },
} as const;

@Injectable()
export class TechnicalElementDrawingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
    private readonly storage: TechnicalAttachmentStorageService,
  ) {}

  private requireRead(actor: AuthUser): void {
    if (!hasTechnicalRead(actor.permissions)) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
  }

  private requireWrite(actor: AuthUser): void {
    if (!hasTechnicalWrite(actor.permissions)) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update or contracts.workflow_update' });
    }
  }

  private async assertContractAccess(contractId: string, actor: AuthUser): Promise<void> {
    const contract = await this.db.getClient().contract.findUnique({ where: { id: contractId }, select: { id: true, departmentId: true } });
    if (!contract) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);
  }

  private async loadElement(contractId: string, pieceId: string) {
    const piece = await this.db.getClient().contractBoqPiece.findFirst({
      where: { id: pieceId, contractId },
      select: {
        id: true,
        boqItemId: true,
        isCancelled: true,
        releasedToProductionAt: true,
        drawingGroupLinks: { where: { activeSlot: 1 }, take: 1, select: { group: { select: { status: true, _count: { select: { attachments: true } } } } } },
        _count: { select: { attachments: true } },
      },
    });
    if (!piece) throw new NotFoundException({ code: 'BOQ_PIECE_NOT_FOUND', message: ELEMENT_DRAWING_MESSAGES.elementNotFound });
    return piece;
  }

  /** Every live element of the job with how it is covered and whether it is released, plus the summary counts. */
  async coverage(contractId: string, actor: AuthUser) {
    this.requireRead(actor);
    await this.assertContractAccess(contractId, actor);
    const pieces = await this.db.getClient().contractBoqPiece.findMany({
      where: { contractId, isCancelled: false },
      orderBy: [{ boqItem: { sortOrder: 'asc' } }, { pieceNo: 'asc' }, { pieceCode: 'asc' }],
      select: {
        id: true,
        boqItemId: true,
        pieceNo: true,
        pieceCode: true,
        drawingNo: true,
        currentStatus: true,
        releasedToProductionAt: true,
        releasedToProductionById: true,
        boqItem: { select: { sortOrder: true, description: true } },
        drawingGroupLinks: {
          where: { activeSlot: 1 },
          take: 1,
          select: {
            group: {
              select: {
                id: true,
                drawingNo: true,
                calculationRef: true,
                groupTitle: true,
                status: true,
                // FMP-TECH-31 — when and by whom a group was released (display only).
                releasedAt: true,
                releasedByUser: { select: { displayName: true } },
                _count: { select: { attachments: true } },
              },
            },
          },
        },
        _count: { select: { attachments: true } },
      },
    });

    // Individually released elements record the releaser's id only, so look up their names in one query.
    const releaserIds = [...new Set(pieces.map((p) => p.releasedToProductionById).filter((id): id is string => id !== null))];
    const releasers = releaserIds.length > 0 ? await this.db.getClient().user.findMany({ where: { id: { in: releaserIds } }, select: { id: true, displayName: true } }) : [];
    const releaserName = new Map(releasers.map((u) => [u.id, u.displayName]));

    const elements = pieces.map((p) => {
      const group = p.drawingGroupLinks[0]?.group ?? null;
      const result = classifyElement({
        group: group ? { status: group.status, fileCount: group._count.attachments } : null,
        individualFileCount: p._count.attachments,
        releasedToProductionAt: p.releasedToProductionAt,
      });
      return {
        id: p.id,
        boqItemId: p.boqItemId,
        boqItemSortOrder: p.boqItem.sortOrder,
        boqItemDescription: p.boqItem.description,
        pieceNo: p.pieceNo,
        pieceCode: p.pieceCode,
        drawingNo: p.drawingNo,
        currentStatus: p.currentStatus,
        group: group ? { id: group.id, drawingNo: group.drawingNo, calculationRef: group.calculationRef, groupTitle: group.groupTitle, status: group.status, fileCount: group._count.attachments } : null,
        individualFileCount: p._count.attachments,
        releasedToProductionAt: p.releasedToProductionAt,
        // FMP-TECH-31 — release details for the Release page; null when the data does not hold them.
        releasedAt: result.releaseState === 'RELEASED' ? (group?.status === S.RELEASED_TO_PRODUCTION ? group.releasedAt : p.releasedToProductionAt) : null,
        releasedByName:
          result.releaseState === 'RELEASED'
            ? group?.status === S.RELEASED_TO_PRODUCTION
              ? (group.releasedByUser?.displayName ?? null)
              : (p.releasedToProductionById ? (releaserName.get(p.releasedToProductionById) ?? null) : null)
            : null,
        releasedVia: result.releaseState === 'RELEASED' ? (group?.status === S.RELEASED_TO_PRODUCTION ? ('GROUP' as const) : ('INDIVIDUAL' as const)) : null,
        ...result,
      };
    });
    return { summary: summarizeCoverage(elements), elements };
  }

  async listFiles(contractId: string, pieceId: string, actor: AuthUser) {
    this.requireRead(actor);
    await this.assertContractAccess(contractId, actor);
    await this.loadElement(contractId, pieceId);
    return this.db.getClient().contractBoqPieceAttachment.findMany({ where: { pieceId }, orderBy: { createdAt: 'asc' }, select: { ...FILE_SELECT } });
  }

  async upload(
    contractId: string,
    pieceId: string,
    input: { drawingRefNo: string | undefined; revision: string | undefined; remarks: string | undefined },
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
    actor: AuthUser,
  ) {
    this.requireWrite(actor);
    await this.assertContractAccess(contractId, actor);
    const piece = await this.loadElement(contractId, pieceId);
    if (piece.isCancelled) throw new NotFoundException({ code: 'BOQ_PIECE_NOT_FOUND', message: ELEMENT_DRAWING_MESSAGES.elementNotFound });
    if (piece.releasedToProductionAt !== null) throw new ConflictException({ code: 'ELEMENT_ALREADY_RELEASED', message: ELEMENT_DRAWING_MESSAGES.released });
    if (piece.drawingGroupLinks.length > 0) throw new ConflictException({ code: 'ELEMENT_IN_GROUP', message: ELEMENT_DRAWING_MESSAGES.inGroup });

    if (!file) throw new UnprocessableEntityException({ code: 'ELEMENT_DRAWING_NO_FILE', message: ELEMENT_DRAWING_MESSAGES.noFile });
    const mimeType = resolveTechnicalAttachmentMimeType(file);
    if (mimeType === null) throw new UnprocessableEntityException({ code: 'ELEMENT_DRAWING_INVALID_TYPE', message: ELEMENT_DRAWING_MESSAGES.badType });
    if (file.size > TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES) throw new UnprocessableEntityException({ code: 'ELEMENT_DRAWING_TOO_LARGE', message: ELEMENT_DRAWING_MESSAGES.tooLarge });

    const { fileName, storagePath } = await this.storage.save(`${FOLDER}/${pieceId}`, file.buffer, file.originalname);
    try {
      return await this.db.getClient().contractBoqPieceAttachment.create({
        data: {
          pieceId,
          contractId,
          boqItemId: piece.boqItemId,
          fileName,
          originalName: file.originalname.slice(0, 255),
          mimeType,
          fileSize: file.size,
          storagePath,
          ...(input.drawingRefNo ? { drawingRefNo: input.drawingRefNo } : {}),
          ...(input.revision ? { revision: input.revision } : {}),
          ...(input.remarks ? { remarks: input.remarks } : {}),
          uploadedById: actor.id,
        },
        select: { ...FILE_SELECT },
      });
    } catch (err) {
      await this.storage.deleteFile(storagePath);
      throw err;
    }
  }

  async getForDownload(contractId: string, pieceId: string, attachmentId: string, actor: AuthUser) {
    this.requireRead(actor);
    await this.assertContractAccess(contractId, actor);
    const file = await this.db.getClient().contractBoqPieceAttachment.findFirst({
      where: { id: attachmentId, pieceId, contractId },
      select: { storagePath: true, originalName: true, mimeType: true },
    });
    if (!file) throw new NotFoundException({ code: 'ELEMENT_DRAWING_NOT_FOUND', message: ELEMENT_DRAWING_MESSAGES.fileNotFound });
    return file;
  }

  async remove(contractId: string, pieceId: string, attachmentId: string, actor: AuthUser): Promise<void> {
    this.requireWrite(actor);
    await this.assertContractAccess(contractId, actor);
    const piece = await this.loadElement(contractId, pieceId);
    if (piece.releasedToProductionAt !== null) throw new ConflictException({ code: 'ELEMENT_ALREADY_RELEASED', message: ELEMENT_DRAWING_MESSAGES.released });
    const file = await this.db.getClient().contractBoqPieceAttachment.findFirst({
      where: { id: attachmentId, pieceId, contractId },
      select: { id: true, storagePath: true, uploadedById: true },
    });
    if (!file) throw new NotFoundException({ code: 'ELEMENT_DRAWING_NOT_FOUND', message: ELEMENT_DRAWING_MESSAGES.fileNotFound });
    if (file.uploadedById !== actor.id && !canDeleteOthersTechnicalFiles(actor.permissions)) {
      throw new ForbiddenException({ code: 'ELEMENT_DRAWING_NOT_OWNER', message: ELEMENT_DRAWING_MESSAGES.notOwner });
    }
    await this.db.getClient().contractBoqPieceAttachment.delete({ where: { id: file.id } });
    await this.storage.deleteFile(file.storagePath);
  }

  /**
   * Releases individually covered elements to Production. Each element must have its own final drawing
   * file and must not be in a Drawing Group (a grouped element is released with its group). All-or-nothing:
   * if any selected element cannot be released, nothing is released and the reason is returned.
   */
  async release(contractId: string, pieceIds: string[], actor: AuthUser): Promise<{ released: number }> {
    this.requireWrite(actor);
    await this.assertContractAccess(contractId, actor);
    const ids = [...new Set(pieceIds)];
    if (ids.length === 0) throw new UnprocessableEntityException({ code: 'ELEMENTS_NONE_SELECTED', message: ELEMENT_DRAWING_MESSAGES.noneSelected });

    const client = this.db.getClient();
    const pieces = await client.contractBoqPiece.findMany({
      where: { id: { in: ids }, contractId },
      select: {
        id: true,
        pieceCode: true,
        isCancelled: true,
        currentStatus: true,
        releasedToProductionAt: true,
        drawingGroupLinks: { where: { activeSlot: 1 }, take: 1, select: { group: { select: { status: true, _count: { select: { attachments: true } } } } } },
        _count: { select: { attachments: true } },
      },
    });
    if (pieces.length !== ids.length) throw new NotFoundException({ code: 'BOQ_PIECE_NOT_FOUND', message: ELEMENT_DRAWING_MESSAGES.elementNotFound });

    for (const p of pieces) {
      const group = p.drawingGroupLinks[0]?.group ?? null;
      const blocker = individualReleaseBlocker({
        cancelled: p.isCancelled,
        group: group ? { status: group.status, fileCount: group._count.attachments } : null,
        individualFileCount: p._count.attachments,
        releasedToProductionAt: p.releasedToProductionAt,
      });
      if (blocker) throw new ConflictException({ code: 'ELEMENT_NOT_RELEASABLE', message: `${p.pieceCode}: ${blocker}` });
    }

    const now = new Date();
    const result = await client.contractBoqPiece.updateMany({
      // The same conditions again, so two people releasing at once cannot release an element twice.
      where: { id: { in: ids }, releasedToProductionAt: null, isCancelled: false, currentStatus: { not: ContractBoqPieceStatus.CANCELLED } },
      data: { releasedToProductionAt: now, releasedToProductionById: actor.id },
    });
    return { released: result.count };
  }
}
