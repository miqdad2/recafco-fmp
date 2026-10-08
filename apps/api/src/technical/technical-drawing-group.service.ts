import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ModuleIdentifier, TechnicalDrawingGroupStatus as S } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';
import type { SaveDrawingGroupDto } from './dto/drawing-group.dto';
import {
  GROUP_MESSAGES,
  allowedGroupActions,
  commonDrawingConfirmationId,
  piecesAlreadyGroupedMessage,
  summarizeGroupAssignments,
} from './drawing-group-rules';

function unprocessable(code: string, message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({ code, message });
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === 'P2002' || /unique constraint|duplicate key/i.test(e.message ?? '');
}

const GROUP_SELECT = {
  id: true,
  contractId: true,
  boqItemId: true,
  drawingNo: true,
  calculationRef: true,
  groupTitle: true,
  status: true,
  remarks: true,
  approvedAt: true,
  releasedAt: true,
  createdAt: true,
  updatedAt: true,
  createdByUser: { select: { id: true, displayName: true } },
  approvedByUser: { select: { id: true, displayName: true } },
  releasedByUser: { select: { id: true, displayName: true } },
  _count: { select: { pieces: true, attachments: true } },
} as const;

/**
 * FMP-BOQ-11 — Technical Drawing / Calculation Groups. A group ties one drawing
 * (and optional calculation) to one, many or all generated pieces of a BOQ item.
 * This unit only RECORDS the group and its status: no piece status is changed,
 * Production is not blocked, no file is uploaded. Nothing is ever deleted — a
 * cancelled group simply frees its pieces for a new group.
 */
@Injectable()
export class TechnicalDrawingGroupService {
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

  private async loadGroup(contractId: string, groupId: string) {
    const group = await this.db.getClient().technicalDrawingGroup.findFirst({
      where: { id: groupId, contractId },
      select: { ...GROUP_SELECT },
    });
    if (!group) throw new NotFoundException({ code: 'DRAWING_GROUP_NOT_FOUND', message: GROUP_MESSAGES.notFound });
    return group;
  }

  /** Every BOQ item with its groups and assigned / unassigned / approved / released piece counts. */
  async list(contractId: string, actor: AuthUser) {
    this.requireRead(actor);
    await this.loadContract(contractId, actor);
    const client = this.db.getClient();

    const [items, generated, links] = await Promise.all([
      client.contractBoqItem.findMany({
        where: { contractId },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          sortOrder: true,
          description: true,
          technicalDrawingGroups: { orderBy: { createdAt: 'asc' }, select: { ...GROUP_SELECT } },
        },
      }),
      client.contractBoqPiece.groupBy({ by: ['boqItemId'], where: { contractId, isCancelled: false }, _count: { _all: true } }),
      client.technicalDrawingGroupPiece.findMany({
        where: { activeSlot: 1, group: { contractId } },
        select: { group: { select: { boqItemId: true, status: true } } },
      }),
    ]);

    return items.map((item) => {
      const generatedCount = generated.find((g) => g.boqItemId === item.id)?._count._all ?? 0;
      const activeStatuses = links.filter((l) => l.group.boqItemId === item.id).map((l) => l.group.status);
      return {
        boqItemId: item.id,
        sortOrder: item.sortOrder,
        description: item.description,
        ...summarizeGroupAssignments(generatedCount, activeStatuses),
        groups: item.technicalDrawingGroups.map((g) => ({
          ...g,
          pieceCount: g._count.pieces,
          fileCount: g._count.attachments ?? 0,
          actions: allowedGroupActions(g.status),
        })),
      };
    });
  }

  /** Generated (non-cancelled) pieces of one BOQ item with the group each currently belongs to — for the Add Drawing Group picker. */
  async piecesForItem(contractId: string, boqItemId: string, actor: AuthUser) {
    this.requireRead(actor);
    await this.loadContract(contractId, actor);
    return this.db.getClient().contractBoqPiece.findMany({
      where: { contractId, boqItemId, isCancelled: false },
      orderBy: { pieceCode: 'asc' },
      select: {
        id: true,
        pieceNo: true,
        pieceCode: true,
        currentStatus: true,
        drawingGroupLinks: {
          where: { activeSlot: 1 },
          take: 1,
          select: { group: { select: { id: true, drawingNo: true, calculationRef: true, status: true } } },
        },
      },
    });
  }

  /** One group with the pieces it covers. */
  async getGroup(contractId: string, groupId: string, actor: AuthUser) {
    this.requireRead(actor);
    await this.loadContract(contractId, actor);
    const group = await this.loadGroup(contractId, groupId);
    const links = await this.db.getClient().technicalDrawingGroupPiece.findMany({
      where: { groupId },
      orderBy: { piece: { pieceCode: 'asc' } },
      select: { piece: { select: { id: true, pieceCode: true, currentStatus: true } } },
    });
    return { ...group, pieceCount: group._count.pieces, fileCount: group._count.attachments ?? 0, actions: allowedGroupActions(group.status), pieces: links.map((l) => l.piece) };
  }

  private assertSubmittable(drawingNo: string | undefined, pieceCount: number): void {
    if (!drawingNo?.trim()) throw unprocessable('DRAWING_GROUP_DRAWING_NO_REQUIRED', GROUP_MESSAGES.drawingNoRequired);
    if (pieceCount === 0) throw unprocessable('DRAWING_GROUP_PIECES_REQUIRED', GROUP_MESSAGES.piecesRequired);
  }

  /** Checks the selected pieces belong to this BOQ item and are free, returns their drawing confirmation ids. */
  private async checkPieces(
    tx: ReturnType<DatabaseService['getClient']>,
    contractId: string,
    boqItemId: string,
    pieceIds: string[],
    excludeGroupId?: string,
  ): Promise<{ id: string; drawingConfirmationId: string }[]> {
    if (pieceIds.length === 0) return [];
    const pieces = await tx.contractBoqPiece.findMany({
      where: { id: { in: pieceIds }, contractId, boqItemId, isCancelled: false },
      select: { id: true, drawingConfirmationId: true },
    });
    if (pieces.length !== pieceIds.length) throw unprocessable('DRAWING_GROUP_PIECES_UNAVAILABLE', GROUP_MESSAGES.piecesUnavailable);

    const taken = await tx.technicalDrawingGroupPiece.findMany({
      where: { pieceId: { in: pieceIds }, activeSlot: 1, ...(excludeGroupId ? { groupId: { not: excludeGroupId } } : {}) },
      select: { pieceId: true },
    });
    if (taken.length > 0) {
      throw new ConflictException({ code: 'DRAWING_GROUP_PIECE_ALREADY_GROUPED', message: piecesAlreadyGroupedMessage(taken.length) });
    }
    return pieces;
  }

  async create(contractId: string, dto: SaveDrawingGroupDto, actor: AuthUser) {
    this.requireWrite(actor);
    await this.loadContract(contractId, actor);

    if (!dto.boqItemId) throw unprocessable('DRAWING_GROUP_BOQ_ITEM_REQUIRED', GROUP_MESSAGES.boqItemRequired);
    const pieceIds = dto.pieceIds ?? [];
    if (!dto.drawingNo?.trim()) throw unprocessable('DRAWING_GROUP_DRAWING_NO_REQUIRED', GROUP_MESSAGES.drawingNoRequired);
    if (dto.action === 'SUBMIT') this.assertSubmittable(dto.drawingNo, pieceIds.length);

    const client = this.db.getClient();
    const item = await client.contractBoqItem.findFirst({ where: { id: dto.boqItemId, contractId }, select: { id: true } });
    if (!item) throw unprocessable('DRAWING_GROUP_BOQ_ITEM_REQUIRED', GROUP_MESSAGES.boqItemRequired);

    try {
      return await client.$transaction(async (tx) => {
        const pieces = await this.checkPieces(tx as never, contractId, item.id, pieceIds);
        const group = await tx.technicalDrawingGroup.create({
          data: {
            contractId,
            boqItemId: item.id,
            drawingNo: dto.drawingNo!.trim(),
            status: dto.action === 'SUBMIT' ? S.SUBMITTED : S.DRAFT,
            createdById: actor.id,
            ...(dto.calculationRef ? { calculationRef: dto.calculationRef } : {}),
            ...(dto.groupTitle ? { groupTitle: dto.groupTitle } : {}),
            ...(dto.remarks ? { remarks: dto.remarks } : {}),
            ...((): { drawingConfirmationId?: string } => {
              const confirmationId = commonDrawingConfirmationId(pieces);
              return confirmationId ? { drawingConfirmationId: confirmationId } : {};
            })(),
          },
          select: { ...GROUP_SELECT },
        });
        if (pieces.length > 0) {
          await tx.technicalDrawingGroupPiece.createMany({
            data: pieces.map((p) => ({ groupId: group.id, pieceId: p.id, activeSlot: 1 })),
          });
        }
        return group;
      });
    } catch (err) {
      // Two people grouping the same piece at once: the unique (piece, active) link stops the second.
      if (isUniqueViolation(err)) {
        throw new ConflictException({ code: 'DRAWING_GROUP_PIECE_ALREADY_GROUPED', message: piecesAlreadyGroupedMessage(1) });
      }
      throw err;
    }
  }

  /** Edit a DRAFT (details and pieces); optionally submit it in the same step. */
  async updateDraft(contractId: string, groupId: string, dto: SaveDrawingGroupDto, actor: AuthUser) {
    this.requireWrite(actor);
    await this.loadContract(contractId, actor);
    const group = await this.loadGroup(contractId, groupId);
    if (group.status !== S.DRAFT) throw new ConflictException({ code: 'DRAWING_GROUP_LOCKED', message: GROUP_MESSAGES.onlyDraftChange });

    if (!dto.drawingNo?.trim()) throw unprocessable('DRAWING_GROUP_DRAWING_NO_REQUIRED', GROUP_MESSAGES.drawingNoRequired);
    const pieceIds = dto.pieceIds ?? [];
    if (dto.action === 'SUBMIT') this.assertSubmittable(dto.drawingNo, pieceIds.length);

    const client = this.db.getClient();
    try {
      return await client.$transaction(async (tx) => {
        const pieces = await this.checkPieces(tx as never, contractId, group.boqItemId, pieceIds, groupId);
        // A draft's piece list is simply replaced; groups and pieces themselves are never deleted.
        await tx.technicalDrawingGroupPiece.deleteMany({ where: { groupId } });
        if (pieces.length > 0) {
          await tx.technicalDrawingGroupPiece.createMany({
            data: pieces.map((p) => ({ groupId, pieceId: p.id, activeSlot: 1 })),
          });
        }
        return tx.technicalDrawingGroup.update({
          where: { id: groupId },
          data: {
            drawingNo: dto.drawingNo!.trim(),
            calculationRef: dto.calculationRef ?? null,
            groupTitle: dto.groupTitle ?? null,
            remarks: dto.remarks ?? null,
            drawingConfirmationId: commonDrawingConfirmationId(pieces),
            ...(dto.action === 'SUBMIT' ? { status: S.SUBMITTED } : {}),
          },
          select: { ...GROUP_SELECT },
        });
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException({ code: 'DRAWING_GROUP_PIECE_ALREADY_GROUPED', message: piecesAlreadyGroupedMessage(1) });
      }
      throw err;
    }
  }

  async submit(contractId: string, groupId: string, actor: AuthUser) {
    this.requireWrite(actor);
    await this.loadContract(contractId, actor);
    const group = await this.loadGroup(contractId, groupId);
    if (group.status !== S.DRAFT) throw new ConflictException({ code: 'DRAWING_GROUP_NOT_DRAFT', message: GROUP_MESSAGES.onlyDraftSubmit });
    this.assertSubmittable(group.drawingNo, group._count.pieces);
    return this.moveTo(groupId, S.DRAFT, { status: S.SUBMITTED }, GROUP_MESSAGES.onlyDraftSubmit);
  }

  async approve(contractId: string, groupId: string, actor: AuthUser) {
    this.requireWrite(actor);
    await this.loadContract(contractId, actor);
    const group = await this.loadGroup(contractId, groupId);
    if (group.status !== S.SUBMITTED) throw new ConflictException({ code: 'DRAWING_GROUP_NOT_SUBMITTED', message: GROUP_MESSAGES.onlySubmittedApprove });
    return this.moveTo(groupId, S.SUBMITTED, { status: S.APPROVED, approvedById: actor.id, approvedAt: new Date() }, GROUP_MESSAGES.onlySubmittedApprove);
  }

  /** Records the release only — no piece status changes and Production is not blocked or notified. */
  async release(contractId: string, groupId: string, actor: AuthUser) {
    this.requireWrite(actor);
    await this.loadContract(contractId, actor);
    const group = await this.loadGroup(contractId, groupId);
    if (group.status !== S.APPROVED) throw new ConflictException({ code: 'DRAWING_GROUP_NOT_APPROVED', message: GROUP_MESSAGES.onlyApprovedRelease });
    return this.moveTo(groupId, S.APPROVED, { status: S.RELEASED_TO_PRODUCTION, releasedById: actor.id, releasedAt: new Date() }, GROUP_MESSAGES.onlyApprovedRelease);
  }

  /** Cancel a group before it is released: it is kept (never deleted) and its pieces become free for a new group. */
  async cancel(contractId: string, groupId: string, actor: AuthUser) {
    this.requireWrite(actor);
    await this.loadContract(contractId, actor);
    const group = await this.loadGroup(contractId, groupId);
    if (!([S.DRAFT, S.SUBMITTED, S.APPROVED] as S[]).includes(group.status)) {
      throw new ConflictException({ code: 'DRAWING_GROUP_NOT_CANCELLABLE', message: GROUP_MESSAGES.notCancellable });
    }
    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.technicalDrawingGroup.updateMany({ where: { id: groupId, status: group.status }, data: { status: S.CANCELLED } });
      if (result.count === 0) throw new ConflictException({ code: 'DRAWING_GROUP_CHANGED', message: GROUP_MESSAGES.notCancellable });
      // activeSlot NULL = the pieces are no longer held by this group.
      await tx.technicalDrawingGroupPiece.updateMany({ where: { groupId }, data: { activeSlot: null } });
      return tx.technicalDrawingGroup.findUniqueOrThrow({ where: { id: groupId }, select: { ...GROUP_SELECT } });
    });
  }

  /** Status change guarded by the expected current status, so two people clicking at once cannot both win. */
  private async moveTo(groupId: string, from: S, data: Record<string, unknown>, conflictMessage: string) {
    const client = this.db.getClient();
    const result = await client.technicalDrawingGroup.updateMany({ where: { id: groupId, status: from }, data });
    if (result.count === 0) throw new ConflictException({ code: 'DRAWING_GROUP_CHANGED', message: conflictMessage });
    return client.technicalDrawingGroup.findUniqueOrThrow({ where: { id: groupId }, select: { ...GROUP_SELECT } });
  }
}
