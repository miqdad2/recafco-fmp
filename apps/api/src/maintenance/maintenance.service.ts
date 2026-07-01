import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MaintenanceStatus, MaintenancePriority } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { MaintenanceRefService } from './maintenance-ref.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateMrDto } from './dto/create-mr.dto';
import type { UpdateMrDto } from './dto/update-mr.dto';
import type { MrListQueryDto, PaginatedResult } from './dto/mr-list-query.dto';
import type {
  AssignMrDto,
  RejectMrDto,
  WaitingForPartsMrDto,
  CompleteMrDto,
  ReopenMrDto,
  CancelMrDto,
} from './dto/transition.dto';
import type { AddMrCommentDto } from './dto/add-comment.dto';

// "Active" statuses for dashboard metrics (pre-completion, post-submission)
const ACTIVE_STATUSES: MaintenanceStatus[] = [
  MaintenanceStatus.SUBMITTED,
  MaintenanceStatus.UNDER_REVIEW,
  MaintenanceStatus.APPROVED,
  MaintenanceStatus.ASSIGNED,
  MaintenanceStatus.IN_PROGRESS,
  MaintenanceStatus.WAITING_FOR_PARTS,
];

const TERMINAL_STATUSES: MaintenanceStatus[] = [
  MaintenanceStatus.COMPLETED,
  MaintenanceStatus.CLOSED,
  MaintenanceStatus.REJECTED,
  MaintenanceStatus.CANCELLED,
];

const MR_SELECT = {
  id: true,
  referenceNumber: true,
  title: true,
  problemDescription: true,
  priority: true,
  status: true,
  createdByUserId: true,
  requestedByUserId: true,
  assignedToUserId: true,
  affectedDepartmentId: true,
  plantId: true,
  locationId: true,
  equipmentDescription: true,
  requestedCompletionAt: true,
  startedAt: true,
  waitingForPartsAt: true,
  waitingForPartsReason: true,
  completedAt: true,
  completedByUserId: true,
  completionSummary: true,
  closedAt: true,
  closedByUserId: true,
  rejectedAt: true,
  rejectedByUserId: true,
  rejectionReason: true,
  cancelledAt: true,
  cancelledByUserId: true,
  cancellationReason: true,
  createdAt: true,
  updatedAt: true,
  createdByUser: { select: { id: true, displayName: true, username: true } },
  requestedByUser: { select: { id: true, displayName: true, username: true } },
  assignedToUser: { select: { id: true, displayName: true, username: true } },
  affectedDepartment: { select: { id: true, code: true, name: true } },
  plant: { select: { id: true, code: true, name: true } },
  location: { select: { id: true, code: true, name: true } },
} as const;

type MrRecord = Awaited<
  ReturnType<ReturnType<DatabaseService['getClient']>['maintenanceRequest']['findUniqueOrThrow']>
>;

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ref: MaintenanceRefService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create (saves as DRAFT)
  // ---------------------------------------------------------------------------

  async create(dto: CreateMrDto, actor: AuthUser): Promise<MrRecord> {
    const requestedByUserId = dto.requestedByUserId ?? actor.id;
    if (dto.requestedByUserId && dto.requestedByUserId !== actor.id) {
      if (!actor.permissions.includes('maintenance.manage')) {
        throw new ForbiddenException({
          code: 'MR_PERMISSION_DENIED',
          message: 'Only users with maintenance.manage may set requestedByUserId to another user',
        });
      }
      await this.requireActiveUser(dto.requestedByUserId, 'requestedByUserId');
    }

    const { resolvedPlantId, resolvedLocationId } = await this.resolvePlantLocation(
      dto.plantId,
      dto.locationId,
    );

    const now = new Date();
    const year = now.getUTCFullYear();

    return this.db.getClient().$transaction(async (tx) => {
      const referenceNumber = await this.ref.nextRef(tx, year);

      const mr = await tx.maintenanceRequest.create({
        data: {
          referenceNumber,
          title: dto.title,
          problemDescription: dto.problemDescription,
          priority: dto.priority ?? MaintenancePriority.MEDIUM,
          createdByUserId: actor.id,
          requestedByUserId,
          ...(dto.affectedDepartmentId ? { affectedDepartmentId: dto.affectedDepartmentId } : {}),
          ...(resolvedPlantId ? { plantId: resolvedPlantId } : {}),
          ...(resolvedLocationId ? { locationId: resolvedLocationId } : {}),
          ...(dto.equipmentDescription ? { equipmentDescription: dto.equipmentDescription } : {}),
          ...(dto.requestedCompletionAt ? { requestedCompletionAt: new Date(dto.requestedCompletionAt) } : {}),
        },
        select: MR_SELECT,
      });

      await tx.maintenanceRequestActivity.create({
        data: {
          requestId: mr.id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'MR_CREATED',
          newStatus: MaintenanceStatus.DRAFT,
          metadata: { referenceNumber },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'MR_CREATED',
          userId: actor.id,
          actorId: actor.id,
          metadata: { mrId: mr.id, referenceNumber },
        },
      });

      return mr as MrRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Update own DRAFT
  // ---------------------------------------------------------------------------

  async updateDraft(id: string, dto: UpdateMrDto, actor: AuthUser): Promise<MrRecord> {
    const mr = await this.findOneOrThrow(id);

    if (mr.status !== MaintenanceStatus.DRAFT) {
      throw new UnprocessableEntityException({
        code: 'MR_NOT_EDITABLE',
        message: 'Only DRAFT maintenance requests can be edited via this endpoint',
      });
    }
    if (mr.createdByUserId !== actor.id && !actor.permissions.includes('maintenance.manage')) {
      throw new ForbiddenException({
        code: 'MR_NOT_OWN_DRAFT',
        message: 'You can only edit your own DRAFT maintenance requests',
      });
    }

    if (dto.requestedByUserId && dto.requestedByUserId !== actor.id) {
      if (!actor.permissions.includes('maintenance.manage')) {
        throw new ForbiddenException({
          code: 'MR_PERMISSION_DENIED',
          message: 'Only users with maintenance.manage may set requestedByUserId to another user',
        });
      }
      await this.requireActiveUser(dto.requestedByUserId, 'requestedByUserId');
    }

    const currentPlantId = dto.plantId !== undefined ? dto.plantId : (mr.plantId as string | null);
    const currentLocationId =
      dto.locationId !== undefined ? dto.locationId : (mr.locationId as string | null);
    const { resolvedPlantId, resolvedLocationId } = await this.resolvePlantLocation(
      currentPlantId ?? undefined,
      currentLocationId ?? undefined,
    );

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data['title'] = dto.title;
    if (dto.problemDescription !== undefined) data['problemDescription'] = dto.problemDescription;
    if (dto.priority !== undefined) data['priority'] = dto.priority;
    if (dto.requestedByUserId !== undefined) data['requestedByUserId'] = dto.requestedByUserId;
    if (dto.affectedDepartmentId !== undefined) data['affectedDepartmentId'] = dto.affectedDepartmentId;
    if (dto.plantId !== undefined) data['plantId'] = resolvedPlantId;
    if (dto.locationId !== undefined) data['locationId'] = resolvedLocationId;
    if (dto.equipmentDescription !== undefined) data['equipmentDescription'] = dto.equipmentDescription;
    if (dto.requestedCompletionAt !== undefined) {
      data['requestedCompletionAt'] = dto.requestedCompletionAt ? new Date(dto.requestedCompletionAt) : null;
    }

    return this.db.getClient().maintenanceRequest.update({
      where: { id },
      data,
      select: MR_SELECT,
    }) as Promise<MrRecord>;
  }

  // ---------------------------------------------------------------------------
  // Transitions
  // ---------------------------------------------------------------------------

  async submit(id: string, actor: AuthUser): Promise<MrRecord> {
    const mr = await this.findOneOrThrow(id);

    if (mr.status !== MaintenanceStatus.DRAFT) {
      throw new UnprocessableEntityException({
        code: 'INVALID_MR_TRANSITION',
        message: 'Only DRAFT maintenance requests can be submitted',
      });
    }
    if (mr.createdByUserId !== actor.id && !actor.permissions.includes('maintenance.manage')) {
      throw new ForbiddenException({
        code: 'MR_PERMISSION_DENIED',
        message: 'You can only submit your own maintenance requests',
      });
    }

    return this.transitionStatus(mr, MaintenanceStatus.SUBMITTED, actor, {}, 'MR_SUBMITTED');
  }

  async review(id: string, actor: AuthUser): Promise<MrRecord> {
    const mr = await this.findOneOrThrow(id);

    if (mr.status !== MaintenanceStatus.SUBMITTED) {
      throw new UnprocessableEntityException({
        code: 'INVALID_MR_TRANSITION',
        message: 'Only SUBMITTED maintenance requests can be taken under review',
      });
    }

    return this.transitionStatus(mr, MaintenanceStatus.UNDER_REVIEW, actor, {}, 'MR_UNDER_REVIEW');
  }

  async approve(id: string, actor: AuthUser): Promise<MrRecord> {
    const mr = await this.findOneOrThrow(id);

    if (mr.status !== MaintenanceStatus.UNDER_REVIEW) {
      throw new UnprocessableEntityException({
        code: 'INVALID_MR_TRANSITION',
        message: 'Only UNDER_REVIEW maintenance requests can be approved',
      });
    }

    return this.transitionStatus(mr, MaintenanceStatus.APPROVED, actor, {}, 'MR_APPROVED');
  }

  async reject(id: string, dto: RejectMrDto, actor: AuthUser): Promise<MrRecord> {
    const mr = await this.findOneOrThrow(id);

    const rejectableStatuses: MaintenanceStatus[] = [
      MaintenanceStatus.SUBMITTED,
      MaintenanceStatus.UNDER_REVIEW,
    ];
    if (!rejectableStatuses.includes(mr.status as MaintenanceStatus)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_MR_TRANSITION',
        message: 'Only SUBMITTED or UNDER_REVIEW maintenance requests can be rejected',
      });
    }

    const reason = dto.rejectionReason.trim();
    if (!reason) {
      throw new UnprocessableEntityException({
        code: 'MR_REJECTION_REASON_REQUIRED',
        message: 'A rejection reason is required',
      });
    }

    const now = new Date();
    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.maintenanceRequest.updateMany({
        where: { id, status: mr.status },
        data: {
          status: MaintenanceStatus.REJECTED,
          rejectionReason: reason,
          rejectedAt: now,
          rejectedByUserId: actor.id,
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'MR_CONCURRENT_MODIFICATION',
          message: 'Maintenance request was modified concurrently; please retry',
        });
      }

      const updated = await tx.maintenanceRequest.findUniqueOrThrow({ where: { id }, select: MR_SELECT });

      await tx.maintenanceRequestActivity.create({
        data: {
          requestId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'MR_REJECTED',
          previousStatus: mr.status as MaintenanceStatus,
          newStatus: MaintenanceStatus.REJECTED,
          metadata: { hasRejectionReason: true },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'MR_REJECTED',
          userId: mr.createdByUserId as string,
          actorId: actor.id,
          metadata: { mrId: id, referenceNumber: mr.referenceNumber },
        },
      });

      return updated as MrRecord;
    });
  }

  async assign(id: string, dto: AssignMrDto, actor: AuthUser): Promise<MrRecord> {
    const mr = await this.findOneOrThrow(id);

    const assignableStatuses: MaintenanceStatus[] = [
      MaintenanceStatus.APPROVED,
      MaintenanceStatus.ASSIGNED,
    ];
    if (!assignableStatuses.includes(mr.status as MaintenanceStatus)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_MR_TRANSITION',
        message: 'Assignment is only allowed when status is APPROVED or ASSIGNED',
      });
    }

    await this.requireActiveUser(dto.assignedToUserId, 'assignedToUserId');

    const previousAssignee = mr.assignedToUserId as string | null;
    const isStatusChange = mr.status === MaintenanceStatus.APPROVED;

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.maintenanceRequest.updateMany({
        where: { id, status: mr.status },
        data: {
          assignedToUserId: dto.assignedToUserId,
          ...(isStatusChange ? { status: MaintenanceStatus.ASSIGNED } : {}),
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'MR_CONCURRENT_MODIFICATION',
          message: 'Maintenance request was modified concurrently; please retry',
        });
      }

      const updated = await tx.maintenanceRequest.findUniqueOrThrow({ where: { id }, select: MR_SELECT });

      await tx.maintenanceRequestActivity.create({
        data: {
          requestId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'MR_ASSIGNED',
          ...(isStatusChange
            ? { previousStatus: MaintenanceStatus.APPROVED, newStatus: MaintenanceStatus.ASSIGNED }
            : {}),
          metadata: {
            assignedToUserId: dto.assignedToUserId,
            ...(previousAssignee ? { previousAssignedToUserId: previousAssignee } : {}),
          },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'MR_ASSIGNED',
          userId: mr.createdByUserId as string,
          actorId: actor.id,
          metadata: { mrId: id, referenceNumber: mr.referenceNumber, assignedToUserId: dto.assignedToUserId },
        },
      });

      return updated as MrRecord;
    });
  }

  async unassign(id: string, actor: AuthUser): Promise<MrRecord> {
    const mr = await this.findOneOrThrow(id);

    if (mr.status !== MaintenanceStatus.ASSIGNED) {
      throw new UnprocessableEntityException({
        code: 'INVALID_MR_TRANSITION',
        message: 'Only ASSIGNED maintenance requests can be unassigned',
      });
    }

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.maintenanceRequest.updateMany({
        where: { id, status: MaintenanceStatus.ASSIGNED },
        data: { status: MaintenanceStatus.APPROVED, assignedToUserId: null },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'MR_CONCURRENT_MODIFICATION',
          message: 'Maintenance request was modified concurrently; please retry',
        });
      }

      const updated = await tx.maintenanceRequest.findUniqueOrThrow({ where: { id }, select: MR_SELECT });

      await tx.maintenanceRequestActivity.create({
        data: {
          requestId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'MR_UNASSIGNED',
          previousStatus: MaintenanceStatus.ASSIGNED,
          newStatus: MaintenanceStatus.APPROVED,
        },
      });

      return updated as MrRecord;
    });
  }

  async start(id: string, actor: AuthUser): Promise<MrRecord> {
    const mr = await this.findOneOrThrow(id);

    if (mr.status !== MaintenanceStatus.ASSIGNED) {
      throw new UnprocessableEntityException({
        code: 'INVALID_MR_TRANSITION',
        message: 'Only ASSIGNED maintenance requests can be started',
      });
    }

    this.requireAssigneeOwnership(mr, actor, 'start');

    const now = new Date();
    return this.transitionStatus(mr, MaintenanceStatus.IN_PROGRESS, actor, { startedAt: now }, 'MR_STARTED');
  }

  async waitingForParts(id: string, dto: WaitingForPartsMrDto, actor: AuthUser): Promise<MrRecord> {
    const mr = await this.findOneOrThrow(id);

    if (mr.status !== MaintenanceStatus.IN_PROGRESS) {
      throw new UnprocessableEntityException({
        code: 'INVALID_MR_TRANSITION',
        message: 'Only IN_PROGRESS maintenance requests can be set to WAITING_FOR_PARTS',
      });
    }

    this.requireAssigneeOwnership(mr, actor, 'set waiting for parts');

    const reason = dto.waitingForPartsReason.trim();
    if (!reason) {
      throw new UnprocessableEntityException({
        code: 'MR_WAITING_REASON_REQUIRED',
        message: 'A reason is required when waiting for parts',
      });
    }

    const now = new Date();
    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.maintenanceRequest.updateMany({
        where: { id, status: MaintenanceStatus.IN_PROGRESS },
        data: {
          status: MaintenanceStatus.WAITING_FOR_PARTS,
          waitingForPartsReason: reason,
          waitingForPartsAt: now,
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'MR_CONCURRENT_MODIFICATION',
          message: 'Maintenance request was modified concurrently; please retry',
        });
      }

      const updated = await tx.maintenanceRequest.findUniqueOrThrow({ where: { id }, select: MR_SELECT });

      await tx.maintenanceRequestActivity.create({
        data: {
          requestId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'MR_WAITING_FOR_PARTS',
          previousStatus: MaintenanceStatus.IN_PROGRESS,
          newStatus: MaintenanceStatus.WAITING_FOR_PARTS,
          metadata: { hasReason: true },
        },
      });

      return updated as MrRecord;
    });
  }

  async resume(id: string, actor: AuthUser): Promise<MrRecord> {
    const mr = await this.findOneOrThrow(id);

    if (mr.status !== MaintenanceStatus.WAITING_FOR_PARTS) {
      throw new UnprocessableEntityException({
        code: 'INVALID_MR_TRANSITION',
        message: 'Only WAITING_FOR_PARTS maintenance requests can be resumed',
      });
    }

    this.requireAssigneeOwnership(mr, actor, 'resume');

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.maintenanceRequest.updateMany({
        where: { id, status: MaintenanceStatus.WAITING_FOR_PARTS },
        data: {
          status: MaintenanceStatus.IN_PROGRESS,
          waitingForPartsReason: null,
          waitingForPartsAt: null,
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'MR_CONCURRENT_MODIFICATION',
          message: 'Maintenance request was modified concurrently; please retry',
        });
      }

      const updated = await tx.maintenanceRequest.findUniqueOrThrow({ where: { id }, select: MR_SELECT });

      await tx.maintenanceRequestActivity.create({
        data: {
          requestId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'MR_RESUMED',
          previousStatus: MaintenanceStatus.WAITING_FOR_PARTS,
          newStatus: MaintenanceStatus.IN_PROGRESS,
        },
      });

      return updated as MrRecord;
    });
  }

  async complete(id: string, dto: CompleteMrDto, actor: AuthUser): Promise<MrRecord> {
    const mr = await this.findOneOrThrow(id);

    const completableStatuses: MaintenanceStatus[] = [
      MaintenanceStatus.IN_PROGRESS,
      MaintenanceStatus.WAITING_FOR_PARTS,
    ];
    if (!completableStatuses.includes(mr.status as MaintenanceStatus)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_MR_TRANSITION',
        message: 'Only IN_PROGRESS or WAITING_FOR_PARTS maintenance requests can be completed',
      });
    }

    this.requireAssigneeOwnership(mr, actor, 'complete');

    const summary = dto.completionSummary.trim();
    if (!summary) {
      throw new UnprocessableEntityException({
        code: 'MR_COMPLETION_REQUIRED',
        message: 'A completion summary is required',
      });
    }

    const now = new Date();
    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.maintenanceRequest.updateMany({
        where: { id, status: mr.status },
        data: {
          status: MaintenanceStatus.COMPLETED,
          completionSummary: summary,
          completedAt: now,
          completedByUserId: actor.id,
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'MR_CONCURRENT_MODIFICATION',
          message: 'Maintenance request was modified concurrently; please retry',
        });
      }

      const updated = await tx.maintenanceRequest.findUniqueOrThrow({ where: { id }, select: MR_SELECT });

      await tx.maintenanceRequestActivity.create({
        data: {
          requestId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'MR_COMPLETED',
          previousStatus: mr.status as MaintenanceStatus,
          newStatus: MaintenanceStatus.COMPLETED,
          metadata: { hasCompletionSummary: true },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'MR_COMPLETED',
          userId: mr.createdByUserId as string,
          actorId: actor.id,
          metadata: { mrId: id, referenceNumber: mr.referenceNumber },
        },
      });

      return updated as MrRecord;
    });
  }

  async close(id: string, actor: AuthUser): Promise<MrRecord> {
    const mr = await this.findOneOrThrow(id);

    if (mr.status !== MaintenanceStatus.COMPLETED) {
      throw new UnprocessableEntityException({
        code: 'INVALID_MR_TRANSITION',
        message: 'Only COMPLETED maintenance requests can be closed',
      });
    }

    const now = new Date();
    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.maintenanceRequest.updateMany({
        where: { id, status: MaintenanceStatus.COMPLETED },
        data: { status: MaintenanceStatus.CLOSED, closedAt: now, closedByUserId: actor.id },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'MR_CONCURRENT_MODIFICATION',
          message: 'Maintenance request was modified concurrently; please retry',
        });
      }

      const updated = await tx.maintenanceRequest.findUniqueOrThrow({ where: { id }, select: MR_SELECT });

      await tx.maintenanceRequestActivity.create({
        data: {
          requestId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'MR_CLOSED',
          previousStatus: MaintenanceStatus.COMPLETED,
          newStatus: MaintenanceStatus.CLOSED,
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'MR_CLOSED',
          userId: mr.createdByUserId as string,
          actorId: actor.id,
          metadata: { mrId: id, referenceNumber: mr.referenceNumber },
        },
      });

      return updated as MrRecord;
    });
  }

  async cancel(id: string, dto: CancelMrDto, actor: AuthUser): Promise<MrRecord> {
    const mr = await this.findOneOrThrow(id);

    if (TERMINAL_STATUSES.includes(mr.status as MaintenanceStatus)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_MR_TRANSITION',
        message: `Cannot cancel a maintenance request with status ${mr.status}`,
      });
    }

    const isOwnDraft = mr.createdByUserId === actor.id && mr.status === MaintenanceStatus.DRAFT;
    const isOwnSubmitted = mr.createdByUserId === actor.id && mr.status === MaintenanceStatus.SUBMITTED;

    if (!isOwnDraft && !isOwnSubmitted && !actor.permissions.includes('maintenance.manage')) {
      throw new ForbiddenException({
        code: 'MR_PERMISSION_DENIED',
        message: 'Cancelling a maintenance request in this state requires maintenance.manage',
      });
    }

    const reason = dto.reason.trim();
    if (!reason) {
      throw new UnprocessableEntityException({
        code: 'MR_CANCEL_REASON_REQUIRED',
        message: 'A reason is required to cancel a maintenance request',
      });
    }

    const previousStatus = mr.status as MaintenanceStatus;
    const now = new Date();

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.maintenanceRequest.updateMany({
        where: { id, status: mr.status },
        data: {
          status: MaintenanceStatus.CANCELLED,
          cancellationReason: reason,
          cancelledAt: now,
          cancelledByUserId: actor.id,
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'MR_CONCURRENT_MODIFICATION',
          message: 'Maintenance request was modified concurrently; please retry',
        });
      }

      const updated = await tx.maintenanceRequest.findUniqueOrThrow({ where: { id }, select: MR_SELECT });

      await tx.maintenanceRequestActivity.create({
        data: {
          requestId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'MR_CANCELLED',
          previousStatus,
          newStatus: MaintenanceStatus.CANCELLED,
          metadata: { reason },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'MR_CANCELLED',
          userId: mr.createdByUserId as string,
          actorId: actor.id,
          metadata: { mrId: id, referenceNumber: mr.referenceNumber, previousStatus, reason },
        },
      });

      return updated as MrRecord;
    });
  }

  async reopen(id: string, dto: ReopenMrDto, actor: AuthUser): Promise<MrRecord> {
    const mr = await this.findOneOrThrow(id);

    const reopenableStatuses: MaintenanceStatus[] = [
      MaintenanceStatus.COMPLETED,
      MaintenanceStatus.CLOSED,
      MaintenanceStatus.REJECTED,
    ];
    if (!reopenableStatuses.includes(mr.status as MaintenanceStatus)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_MR_TRANSITION',
        message: 'Only COMPLETED, CLOSED, or REJECTED maintenance requests can be reopened',
      });
    }

    const reason = dto.reason.trim();
    if (!reason) {
      throw new UnprocessableEntityException({
        code: 'MR_REOPEN_REASON_REQUIRED',
        message: 'A non-empty reason is required to reopen a maintenance request',
      });
    }

    const previousStatus = mr.status as MaintenanceStatus;
    // Rejected requests go back to SUBMITTED; others go back to IN_PROGRESS
    const newStatus =
      previousStatus === MaintenanceStatus.REJECTED
        ? MaintenanceStatus.SUBMITTED
        : MaintenanceStatus.IN_PROGRESS;

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.maintenanceRequest.updateMany({
        where: { id, status: mr.status },
        data: {
          status: newStatus,
          completedAt: null,
          completedByUserId: null,
          closedAt: null,
          closedByUserId: null,
          rejectedAt: null,
          rejectedByUserId: null,
          rejectionReason: null,
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'MR_CONCURRENT_MODIFICATION',
          message: 'Maintenance request was modified concurrently; please retry',
        });
      }

      const updated = await tx.maintenanceRequest.findUniqueOrThrow({ where: { id }, select: MR_SELECT });

      await tx.maintenanceRequestActivity.create({
        data: {
          requestId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'MR_REOPENED',
          previousStatus,
          newStatus,
          metadata: { reason, previousStatus },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'MR_REOPENED',
          userId: mr.createdByUserId as string,
          actorId: actor.id,
          metadata: { mrId: id, referenceNumber: mr.referenceNumber, previousStatus, reason },
        },
      });

      return updated as MrRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------------

  async addComment(requestId: string, dto: AddMrCommentDto, actor: AuthUser): Promise<unknown> {
    await this.findOneOrThrow(requestId);

    const body = dto.body.trim();
    if (!body) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'Comment body cannot be empty',
      });
    }

    return this.db.getClient().$transaction(async (tx) => {
      const comment = await tx.maintenanceRequestComment.create({
        data: { requestId, authorUserId: actor.id, body },
        select: {
          id: true,
          requestId: true,
          body: true,
          createdAt: true,
          authorUser: { select: { id: true, displayName: true, username: true } },
        },
      });

      await tx.maintenanceRequestActivity.create({
        data: {
          requestId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'COMMENT_ADDED',
        },
      });

      return comment;
    });
  }

  async listComments(requestId: string): Promise<unknown[]> {
    await this.findOneOrThrow(requestId);
    return this.db.getClient().maintenanceRequestComment.findMany({
      where: { requestId },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        requestId: true,
        body: true,
        createdAt: true,
        authorUser: { select: { id: true, displayName: true, username: true } },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Activities
  // ---------------------------------------------------------------------------

  async listActivities(requestId: string): Promise<unknown[]> {
    await this.findOneOrThrow(requestId);
    return this.db.getClient().maintenanceRequestActivity.findMany({
      where: { requestId },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  // ---------------------------------------------------------------------------
  // Find / List / Summary
  // ---------------------------------------------------------------------------

  async findAll(query: MrListQueryDto, actor: AuthUser): Promise<PaginatedResult<MrRecord>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = buildListWhere(query, actor);

    const [items, total] = await Promise.all([
      this.db.getClient().maintenanceRequest.findMany({
        where,
        select: MR_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.db.getClient().maintenanceRequest.count({ where }),
    ]);

    return {
      items: items as MrRecord[],
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string): Promise<MrRecord> {
    return this.findOneOrThrow(id);
  }

  async findMy(query: MrListQueryDto, actor: AuthUser): Promise<PaginatedResult<MrRecord>> {
    const myQuery = { ...query, assignedToUserId: actor.id };
    const page = myQuery.page ?? 1;
    const pageSize = myQuery.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = buildListWhere(myQuery, actor);

    const [items, total] = await Promise.all([
      this.db.getClient().maintenanceRequest.findMany({
        where,
        select: MR_SELECT,
        orderBy: [{ requestedCompletionAt: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.db.getClient().maintenanceRequest.count({ where }),
    ]);

    return {
      items: items as MrRecord[],
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async getSummary(actor: AuthUser): Promise<{
    openRequests: number;
    assignedToMe: number;
    overdueRequests: number;
    waitingForParts: number;
    completedThisMonth: number;
  }> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const openStatuses: MaintenanceStatus[] = [
      MaintenanceStatus.SUBMITTED,
      MaintenanceStatus.UNDER_REVIEW,
      MaintenanceStatus.APPROVED,
    ];

    const [openRequests, assignedToMe, overdueRequests, waitingForParts, completedThisMonth] =
      await Promise.all([
        this.db.getClient().maintenanceRequest.count({ where: { status: { in: openStatuses } } }),
        this.db.getClient().maintenanceRequest.count({
          where: { assignedToUserId: actor.id, status: { in: ACTIVE_STATUSES } },
        }),
        this.db.getClient().maintenanceRequest.count({
          where: {
            status: { in: ACTIVE_STATUSES },
            requestedCompletionAt: { lt: now },
          },
        }),
        this.db.getClient().maintenanceRequest.count({
          where: { status: MaintenanceStatus.WAITING_FOR_PARTS },
        }),
        this.db.getClient().maintenanceRequest.count({
          where: {
            status: { in: [MaintenanceStatus.COMPLETED, MaintenanceStatus.CLOSED] },
            completedAt: { gte: monthStart, lt: monthEnd },
          },
        }),
      ]);

    return { openRequests, assignedToMe, overdueRequests, waitingForParts, completedThisMonth };
  }

  // ---------------------------------------------------------------------------
  // People picker
  // ---------------------------------------------------------------------------

  async listPeople(search?: string): Promise<{ id: string; displayName: string; username: string }[]> {
    const where: Record<string, unknown> = { isActive: true };
    if (search?.trim()) {
      where['OR'] = [
        { displayName: { contains: search.trim(), mode: 'insensitive' } },
        { username: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }
    return this.db.getClient().user.findMany({
      where,
      select: { id: true, displayName: true, username: true },
      orderBy: [{ displayName: 'asc' }],
      take: 20,
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async findOneOrThrow(id: string): Promise<MrRecord> {
    const mr = await this.db.getClient().maintenanceRequest.findUnique({
      where: { id },
      select: MR_SELECT,
    });
    if (!mr) {
      throw new NotFoundException({ code: 'MR_NOT_FOUND', message: 'Maintenance request not found' });
    }
    return mr as MrRecord;
  }

  private requireAssigneeOwnership(mr: MrRecord, actor: AuthUser, action: string): void {
    if (mr.assignedToUserId !== actor.id && !actor.permissions.includes('maintenance.manage')) {
      throw new ForbiddenException({
        code: 'MR_NOT_ASSIGNEE',
        message: `Only the assigned user can ${action} this maintenance request`,
      });
    }
  }

  private async transitionStatus(
    mr: MrRecord,
    newStatus: MaintenanceStatus,
    actor: AuthUser,
    extraData: Record<string, unknown>,
    eventName: string,
  ): Promise<MrRecord> {
    const previousStatus = mr.status as MaintenanceStatus;

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.maintenanceRequest.updateMany({
        where: { id: mr.id as string, status: previousStatus },
        data: { status: newStatus, ...extraData },
      });

      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'MR_CONCURRENT_MODIFICATION',
          message: 'Maintenance request was modified concurrently; please retry',
        });
      }

      const updated = await tx.maintenanceRequest.findUniqueOrThrow({
        where: { id: mr.id as string },
        select: MR_SELECT,
      });

      await tx.maintenanceRequestActivity.create({
        data: {
          requestId: mr.id as string,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: eventName,
          previousStatus,
          newStatus,
        },
      });

      return updated as MrRecord;
    });
  }

  private async requireActiveUser(userId: string, field: string): Promise<void> {
    const user = await this.db.getClient().user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new UnprocessableEntityException({
        code: 'MR_ASSIGNMENT_INVALID',
        message: `${field}: user does not exist or is inactive`,
      });
    }
  }

  private async resolvePlantLocation(
    plantId?: string,
    locationId?: string,
  ): Promise<{ resolvedPlantId: string | null; resolvedLocationId: string | null }> {
    if (!locationId) {
      return { resolvedPlantId: plantId ?? null, resolvedLocationId: null };
    }

    const location = await this.db.getClient().location.findUnique({
      where: { id: locationId },
      select: { id: true, plantId: true },
    });

    if (!location) {
      throw new UnprocessableEntityException({
        code: 'MR_LOCATION_INVALID',
        message: 'The specified location does not exist',
      });
    }

    if (plantId && location.plantId && location.plantId !== plantId) {
      throw new UnprocessableEntityException({
        code: 'MR_LOCATION_INVALID',
        message: 'The specified location does not belong to the specified plant',
      });
    }

    const resolvedPlantId = plantId ?? location.plantId ?? null;
    return { resolvedPlantId, resolvedLocationId: locationId };
  }
}

function buildListWhere(
  query: MrListQueryDto,
  actor: AuthUser,
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (query.status) {
    const statuses = Array.isArray(query.status) ? query.status : [query.status];
    where['status'] = { in: statuses };
  }

  if (query.priority) {
    const priorities = Array.isArray(query.priority) ? query.priority : [query.priority];
    where['priority'] = { in: priorities };
  }

  if (query.assignedToUserId) {
    const userId = query.assignedToUserId === 'me' ? actor.id : query.assignedToUserId;
    where['assignedToUserId'] = userId;
  }

  if (query.affectedDepartmentId) where['affectedDepartmentId'] = query.affectedDepartmentId;
  if (query.plantId) where['plantId'] = query.plantId;
  if (query.locationId) where['locationId'] = query.locationId;

  if (query.requestedCompletionFrom || query.requestedCompletionTo) {
    const requestedCompletionAt: Record<string, Date> = {};
    if (query.requestedCompletionFrom) requestedCompletionAt['gte'] = new Date(query.requestedCompletionFrom);
    if (query.requestedCompletionTo) requestedCompletionAt['lte'] = new Date(query.requestedCompletionTo);
    where['requestedCompletionAt'] = requestedCompletionAt;
  }

  if (query.overdue) {
    where['status'] = { in: ACTIVE_STATUSES };
    where['requestedCompletionAt'] = { lt: new Date() };
  }

  if (query.search?.trim()) {
    where['OR'] = [
      { title: { contains: query.search.trim(), mode: 'insensitive' } },
      { referenceNumber: { contains: query.search.trim(), mode: 'insensitive' } },
    ];
  }

  return where;
}
