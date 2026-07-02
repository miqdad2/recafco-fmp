import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InspectionStatus, FindingSeverity, FindingStatus } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { SafetyRefService } from './safety-ref.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateInspectionDto } from './dto/create-inspection.dto';
import type { UpdateInspectionDto } from './dto/update-inspection.dto';
import type { InspectionListQueryDto, PaginatedResult } from './dto/inspection-list-query.dto';
import type { ScheduleInspectionDto } from './dto/schedule-inspection.dto';
import type {
  CompleteInspectionDto,
  CancelInspectionDto,
  ReopenInspectionDto,
  CreateFindingDto,
  AssignFindingDto,
  RequireActionDto,
  ResolveFindingDto,
  ReopenFindingDto,
} from './dto/transition.dto';
import type { AddInspectionCommentDto } from './dto/add-comment.dto';

const INSPECTION_SELECT = {
  id: true,
  referenceNumber: true,
  title: true,
  summary: true,
  status: true,
  scheduledAt: true,
  startedAt: true,
  completedAt: true,
  completedByUserId: true,
  closedAt: true,
  closedByUserId: true,
  cancelledAt: true,
  cancelledByUserId: true,
  cancellationReason: true,
  createdByUserId: true,
  inspectorUserId: true,
  departmentId: true,
  plantId: true,
  locationId: true,
  checklistSummary: true,
  conclusion: true,
  createdAt: true,
  updatedAt: true,
  createdByUser: { select: { id: true, displayName: true, username: true } },
  inspector: { select: { id: true, displayName: true, username: true } },
  completedByUser: { select: { id: true, displayName: true, username: true } },
  closedByUser: { select: { id: true, displayName: true, username: true } },
  cancelledByUser: { select: { id: true, displayName: true, username: true } },
  department: { select: { id: true, code: true, name: true } },
  plant: { select: { id: true, code: true, name: true } },
  location: { select: { id: true, code: true, name: true } },
} as const;

const FINDING_SELECT = {
  id: true,
  inspectionId: true,
  title: true,
  description: true,
  severity: true,
  status: true,
  assignedToUserId: true,
  dueAt: true,
  actionRequired: true,
  resolutionSummary: true,
  resolvedAt: true,
  resolvedByUserId: true,
  verifiedAt: true,
  verifiedByUserId: true,
  closedAt: true,
  closedByUserId: true,
  reopenedAt: true,
  reopenedByUserId: true,
  reopenReason: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
  createdByUser: { select: { id: true, displayName: true, username: true } },
  assignedToUser: { select: { id: true, displayName: true, username: true } },
  resolvedByUser: { select: { id: true, displayName: true, username: true } },
  verifiedByUser: { select: { id: true, displayName: true, username: true } },
  closedByUser: { select: { id: true, displayName: true, username: true } },
  reopenedByUser: { select: { id: true, displayName: true, username: true } },
} as const;

type InspectionRecord = Awaited<
  ReturnType<ReturnType<DatabaseService['getClient']>['safetyInspection']['findUniqueOrThrow']>
>;

type FindingRecord = Awaited<
  ReturnType<ReturnType<DatabaseService['getClient']>['safetyFinding']['findUniqueOrThrow']>
>;

@Injectable()
export class SafetyService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ref: SafetyRefService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create (saves as DRAFT)
  // ---------------------------------------------------------------------------

  async create(dto: CreateInspectionDto, actor: AuthUser): Promise<InspectionRecord> {
    if (dto.inspectorUserId) {
      await this.requireActiveUser(dto.inspectorUserId, 'inspectorUserId');
    }

    const { resolvedPlantId, resolvedLocationId } = await this.resolvePlantLocation(
      dto.plantId,
      dto.locationId,
    );

    const now = new Date();
    const year = now.getUTCFullYear();

    return this.db.getClient().$transaction(async (tx) => {
      const referenceNumber = await this.ref.nextRef(tx, year);

      const inspection = await tx.safetyInspection.create({
        data: {
          referenceNumber,
          title: dto.title,
          ...(dto.summary ? { summary: dto.summary } : {}),
          createdByUserId: actor.id,
          ...(dto.inspectorUserId ? { inspectorUserId: dto.inspectorUserId } : {}),
          ...(dto.departmentId ? { departmentId: dto.departmentId } : {}),
          ...(resolvedPlantId ? { plantId: resolvedPlantId } : {}),
          ...(resolvedLocationId ? { locationId: resolvedLocationId } : {}),
        },
        select: INSPECTION_SELECT,
      });

      await tx.safetyInspectionActivity.create({
        data: {
          inspectionId: inspection.id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'INSPECTION_CREATED',
          newStatus: InspectionStatus.DRAFT,
          metadata: { referenceNumber },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'SAFETY_INSPECTION_CREATED',
          userId: actor.id,
          actorId: actor.id,
          metadata: { inspectionId: inspection.id, referenceNumber },
        },
      });

      return inspection as InspectionRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Update own DRAFT
  // ---------------------------------------------------------------------------

  async updateDraft(id: string, dto: UpdateInspectionDto, actor: AuthUser): Promise<InspectionRecord> {
    const inspection = await this.findOneOrThrow(id);

    if (inspection.status !== InspectionStatus.DRAFT) {
      throw new UnprocessableEntityException({
        code: 'INVALID_INSPECTION_TRANSITION',
        message: 'Only DRAFT inspections can be edited via this endpoint',
      });
    }

    if (
      (inspection.createdByUserId as string) !== actor.id &&
      !actor.permissions.includes('safety.manage')
    ) {
      throw new ForbiddenException({
        code: 'SAFETY_PERMISSION_DENIED',
        message: 'You can only edit your own DRAFT inspections',
      });
    }

    if (dto.inspectorUserId) {
      await this.requireActiveUser(dto.inspectorUserId, 'inspectorUserId');
    }

    const currentPlantId = dto.plantId !== undefined ? dto.plantId : (inspection.plantId as string | null);
    const currentLocationId =
      dto.locationId !== undefined ? dto.locationId : (inspection.locationId as string | null);
    const { resolvedPlantId, resolvedLocationId } = await this.resolvePlantLocation(
      currentPlantId ?? undefined,
      currentLocationId ?? undefined,
    );

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data['title'] = dto.title;
    if (dto.summary !== undefined) data['summary'] = dto.summary;
    if (dto.inspectorUserId !== undefined) data['inspectorUserId'] = dto.inspectorUserId;
    if (dto.departmentId !== undefined) data['departmentId'] = dto.departmentId;
    if (dto.plantId !== undefined) data['plantId'] = resolvedPlantId;
    if (dto.locationId !== undefined) data['locationId'] = resolvedLocationId;
    if (dto.checklistSummary !== undefined) data['checklistSummary'] = dto.checklistSummary;
    if (dto.conclusion !== undefined) data['conclusion'] = dto.conclusion;

    return this.db.getClient().safetyInspection.update({
      where: { id },
      data,
      select: INSPECTION_SELECT,
    }) as Promise<InspectionRecord>;
  }

  // ---------------------------------------------------------------------------
  // Schedule: DRAFT â†’ SCHEDULED
  // ---------------------------------------------------------------------------

  async schedule(id: string, dto: ScheduleInspectionDto, actor: AuthUser): Promise<InspectionRecord> {
    const inspection = await this.findOneOrThrow(id);

    if (inspection.status !== InspectionStatus.DRAFT) {
      throw new UnprocessableEntityException({
        code: 'INVALID_INSPECTION_TRANSITION',
        message: 'Only DRAFT inspections can be scheduled',
      });
    }

    await this.requireActiveUser(dto.inspectorUserId, 'inspectorUserId');

    const scheduledAt = new Date(dto.scheduledAt);
    const previousStatus = inspection.status as InspectionStatus;

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.safetyInspection.updateMany({
        where: { id, status: InspectionStatus.DRAFT },
        data: {
          status: InspectionStatus.SCHEDULED,
          scheduledAt,
          inspectorUserId: dto.inspectorUserId,
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'SAFETY_CONCURRENT_MODIFICATION',
          message: 'Inspection was modified concurrently; please retry',
        });
      }

      const updated = await tx.safetyInspection.findUniqueOrThrow({ where: { id }, select: INSPECTION_SELECT });

      await tx.safetyInspectionActivity.create({
        data: {
          inspectionId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'INSPECTION_SCHEDULED',
          previousStatus,
          newStatus: InspectionStatus.SCHEDULED,
          metadata: { inspectorUserId: dto.inspectorUserId, scheduledAt: scheduledAt.toISOString() },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'SAFETY_INSPECTION_SCHEDULED',
          userId: inspection.createdByUserId as string,
          actorId: actor.id,
          metadata: {
            inspectionId: id,
            referenceNumber: inspection.referenceNumber,
            inspectorUserId: dto.inspectorUserId,
          },
        },
      });

      return updated as InspectionRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Start: SCHEDULED â†’ IN_PROGRESS
  // ---------------------------------------------------------------------------

  async start(id: string, actor: AuthUser): Promise<InspectionRecord> {
    const inspection = await this.findOneOrThrow(id);

    if (inspection.status !== InspectionStatus.SCHEDULED) {
      throw new UnprocessableEntityException({
        code: 'INVALID_INSPECTION_TRANSITION',
        message: 'Only SCHEDULED inspections can be started',
      });
    }

    this.requireInspectorOwnership(inspection, actor, 'start');

    const now = new Date();
    const previousStatus = inspection.status as InspectionStatus;

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.safetyInspection.updateMany({
        where: { id, status: InspectionStatus.SCHEDULED },
        data: { status: InspectionStatus.IN_PROGRESS, startedAt: now },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'SAFETY_CONCURRENT_MODIFICATION',
          message: 'Inspection was modified concurrently; please retry',
        });
      }

      const updated = await tx.safetyInspection.findUniqueOrThrow({ where: { id }, select: INSPECTION_SELECT });

      await tx.safetyInspectionActivity.create({
        data: {
          inspectionId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'INSPECTION_STARTED',
          previousStatus,
          newStatus: InspectionStatus.IN_PROGRESS,
        },
      });

      return updated as InspectionRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Complete: IN_PROGRESS â†’ COMPLETED
  // ---------------------------------------------------------------------------

  async complete(id: string, dto: CompleteInspectionDto, actor: AuthUser): Promise<InspectionRecord> {
    const inspection = await this.findOneOrThrow(id);

    if (inspection.status !== InspectionStatus.IN_PROGRESS) {
      throw new UnprocessableEntityException({
        code: 'INVALID_INSPECTION_TRANSITION',
        message: 'Only IN_PROGRESS inspections can be completed',
      });
    }

    this.requireInspectorOwnership(inspection, actor, 'complete');

    const conclusion = dto.conclusion.trim();
    if (!conclusion) {
      throw new UnprocessableEntityException({
        code: 'SAFETY_CONCLUSION_REQUIRED',
        message: 'A conclusion is required to complete an inspection',
      });
    }

    const now = new Date();
    const previousStatus = inspection.status as InspectionStatus;

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.safetyInspection.updateMany({
        where: { id, status: InspectionStatus.IN_PROGRESS },
        data: {
          status: InspectionStatus.COMPLETED,
          conclusion,
          completedAt: now,
          completedByUserId: actor.id,
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'SAFETY_CONCURRENT_MODIFICATION',
          message: 'Inspection was modified concurrently; please retry',
        });
      }

      const updated = await tx.safetyInspection.findUniqueOrThrow({ where: { id }, select: INSPECTION_SELECT });

      await tx.safetyInspectionActivity.create({
        data: {
          inspectionId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'INSPECTION_COMPLETED',
          previousStatus,
          newStatus: InspectionStatus.COMPLETED,
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'SAFETY_INSPECTION_COMPLETED',
          userId: inspection.createdByUserId as string,
          actorId: actor.id,
          metadata: { inspectionId: id, referenceNumber: inspection.referenceNumber },
        },
      });

      return updated as InspectionRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Close: COMPLETED â†’ CLOSED
  // ---------------------------------------------------------------------------

  async close(id: string, actor: AuthUser): Promise<InspectionRecord> {
    const inspection = await this.findOneOrThrow(id);

    if (inspection.status !== InspectionStatus.COMPLETED) {
      throw new UnprocessableEntityException({
        code: 'INVALID_INSPECTION_TRANSITION',
        message: 'Only COMPLETED inspections can be closed',
      });
    }

    const now = new Date();
    const previousStatus = inspection.status as InspectionStatus;

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.safetyInspection.updateMany({
        where: { id, status: InspectionStatus.COMPLETED },
        data: { status: InspectionStatus.CLOSED, closedAt: now, closedByUserId: actor.id },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'SAFETY_CONCURRENT_MODIFICATION',
          message: 'Inspection was modified concurrently; please retry',
        });
      }

      const updated = await tx.safetyInspection.findUniqueOrThrow({ where: { id }, select: INSPECTION_SELECT });

      await tx.safetyInspectionActivity.create({
        data: {
          inspectionId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'INSPECTION_CLOSED',
          previousStatus,
          newStatus: InspectionStatus.CLOSED,
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'SAFETY_INSPECTION_CLOSED',
          userId: inspection.createdByUserId as string,
          actorId: actor.id,
          metadata: { inspectionId: id, referenceNumber: inspection.referenceNumber },
        },
      });

      return updated as InspectionRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Cancel: DRAFT/SCHEDULED/IN_PROGRESS â†’ CANCELLED
  // ---------------------------------------------------------------------------

  async cancel(id: string, dto: CancelInspectionDto, actor: AuthUser): Promise<InspectionRecord> {
    const inspection = await this.findOneOrThrow(id);

    const cancellableStatuses: InspectionStatus[] = [
      InspectionStatus.DRAFT,
      InspectionStatus.SCHEDULED,
      InspectionStatus.IN_PROGRESS,
    ];
    if (!cancellableStatuses.includes(inspection.status as InspectionStatus)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_INSPECTION_TRANSITION',
        message: `Cannot cancel an inspection with status ${inspection.status}`,
      });
    }

    const isOwnDraft =
      (inspection.createdByUserId as string) === actor.id &&
      inspection.status === InspectionStatus.DRAFT;

    if (!isOwnDraft && !actor.permissions.includes('safety.manage')) {
      throw new ForbiddenException({
        code: 'SAFETY_PERMISSION_DENIED',
        message: 'Cancelling an inspection in this state requires safety.manage',
      });
    }

    const reason = dto.reason.trim();
    if (!reason) {
      throw new UnprocessableEntityException({
        code: 'SAFETY_CANCEL_REASON_REQUIRED',
        message: 'A reason is required to cancel an inspection',
      });
    }

    const previousStatus = inspection.status as InspectionStatus;
    const now = new Date();

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.safetyInspection.updateMany({
        where: { id, status: inspection.status },
        data: {
          status: InspectionStatus.CANCELLED,
          cancellationReason: reason,
          cancelledAt: now,
          cancelledByUserId: actor.id,
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'SAFETY_CONCURRENT_MODIFICATION',
          message: 'Inspection was modified concurrently; please retry',
        });
      }

      const updated = await tx.safetyInspection.findUniqueOrThrow({ where: { id }, select: INSPECTION_SELECT });

      await tx.safetyInspectionActivity.create({
        data: {
          inspectionId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'INSPECTION_CANCELLED',
          previousStatus,
          newStatus: InspectionStatus.CANCELLED,
          metadata: { reason },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'SAFETY_INSPECTION_CANCELLED',
          userId: inspection.createdByUserId as string,
          actorId: actor.id,
          metadata: { inspectionId: id, referenceNumber: inspection.referenceNumber, previousStatus, reason },
        },
      });

      return updated as InspectionRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Reopen: CLOSED â†’ IN_PROGRESS
  // ---------------------------------------------------------------------------

  async reopen(id: string, dto: ReopenInspectionDto, actor: AuthUser): Promise<InspectionRecord> {
    const inspection = await this.findOneOrThrow(id);

    if (inspection.status !== InspectionStatus.CLOSED) {
      throw new UnprocessableEntityException({
        code: 'INVALID_INSPECTION_TRANSITION',
        message: 'Only CLOSED inspections can be reopened',
      });
    }

    const reason = dto.reason.trim();
    if (!reason) {
      throw new UnprocessableEntityException({
        code: 'SAFETY_REOPEN_REASON_REQUIRED',
        message: 'A non-empty reason is required to reopen an inspection',
      });
    }

    const previousStatus = inspection.status as InspectionStatus;

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.safetyInspection.updateMany({
        where: { id, status: InspectionStatus.CLOSED },
        data: {
          status: InspectionStatus.IN_PROGRESS,
          completedAt: null,
          completedByUserId: null,
          closedAt: null,
          closedByUserId: null,
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'SAFETY_CONCURRENT_MODIFICATION',
          message: 'Inspection was modified concurrently; please retry',
        });
      }

      const updated = await tx.safetyInspection.findUniqueOrThrow({ where: { id }, select: INSPECTION_SELECT });

      await tx.safetyInspectionActivity.create({
        data: {
          inspectionId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'INSPECTION_REOPENED',
          previousStatus,
          newStatus: InspectionStatus.IN_PROGRESS,
          metadata: { reason, previousStatus },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'SAFETY_INSPECTION_REOPENED',
          userId: inspection.createdByUserId as string,
          actorId: actor.id,
          metadata: { inspectionId: id, referenceNumber: inspection.referenceNumber, previousStatus, reason },
        },
      });

      return updated as InspectionRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Findings â€” Create
  // ---------------------------------------------------------------------------

  async createFinding(inspectionId: string, dto: CreateFindingDto, actor: AuthUser): Promise<FindingRecord> {
    const inspection = await this.findOneOrThrow(inspectionId);

    const allowedStatuses: InspectionStatus[] = [
      InspectionStatus.IN_PROGRESS,
      InspectionStatus.COMPLETED,
    ];
    if (!allowedStatuses.includes(inspection.status as InspectionStatus)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_INSPECTION_TRANSITION',
        message: 'Findings can only be created when inspection is IN_PROGRESS or COMPLETED',
      });
    }

    const severityValue = dto.severity.toUpperCase() as FindingSeverity;
    if (!Object.values(FindingSeverity).includes(severityValue)) {
      throw new UnprocessableEntityException({
        code: 'SAFETY_INVALID_SEVERITY',
        message: `Invalid severity value: ${dto.severity}`,
      });
    }

    return this.db.getClient().$transaction(async (tx) => {
      const finding = await tx.safetyFinding.create({
        data: {
          inspectionId,
          title: dto.title,
          description: dto.description,
          severity: severityValue,
          createdByUserId: actor.id,
          ...(dto.actionRequired ? { actionRequired: dto.actionRequired } : {}),
          ...(dto.dueAt ? { dueAt: new Date(dto.dueAt) } : {}),
        },
        select: FINDING_SELECT,
      });

      await tx.safetyInspectionActivity.create({
        data: {
          inspectionId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'FINDING_CREATED',
          metadata: { findingId: finding.id, title: dto.title, severity: severityValue },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'SAFETY_FINDING_CREATED',
          userId: actor.id,
          actorId: actor.id,
          metadata: { inspectionId, findingId: finding.id, severity: severityValue },
        },
      });

      return finding as FindingRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Findings â€” List
  // ---------------------------------------------------------------------------

  async listFindings(inspectionId: string): Promise<FindingRecord[]> {
    await this.findOneOrThrow(inspectionId);
    return this.db.getClient().safetyFinding.findMany({
      where: { inspectionId },
      orderBy: [{ createdAt: 'asc' }],
      select: FINDING_SELECT,
    }) as Promise<FindingRecord[]>;
  }

  // ---------------------------------------------------------------------------
  // Findings â€” Assign
  // ---------------------------------------------------------------------------

  async assignFinding(
    inspectionId: string,
    findingId: string,
    dto: AssignFindingDto,
    actor: AuthUser,
  ): Promise<FindingRecord> {
    await this.findOneOrThrow(inspectionId);
    const finding = await this.findFindingOrThrow(inspectionId, findingId);

    const assignableStatuses: FindingStatus[] = [FindingStatus.OPEN, FindingStatus.ACTION_REQUIRED];
    if (!assignableStatuses.includes(finding.status as FindingStatus)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_FINDING_TRANSITION',
        message: 'Finding can only be assigned when status is OPEN or ACTION_REQUIRED',
      });
    }

    await this.requireActiveUser(dto.assignedToUserId, 'assignedToUserId');

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.safetyFinding.updateMany({
        where: { id: findingId, inspectionId, status: finding.status },
        data: { assignedToUserId: dto.assignedToUserId },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'SAFETY_CONCURRENT_MODIFICATION',
          message: 'Finding was modified concurrently; please retry',
        });
      }

      const updated = await tx.safetyFinding.findUniqueOrThrow({ where: { id: findingId }, select: FINDING_SELECT });

      await tx.safetyInspectionActivity.create({
        data: {
          inspectionId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'FINDING_ASSIGNED',
          metadata: {
            findingId,
            assignedToUserId: dto.assignedToUserId,
            ...(finding.assignedToUserId ? { previousAssignedToUserId: finding.assignedToUserId } : {}),
          },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'SAFETY_FINDING_ASSIGNED',
          userId: actor.id,
          actorId: actor.id,
          metadata: { inspectionId, findingId, assignedToUserId: dto.assignedToUserId },
        },
      });

      return updated as FindingRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Findings â€” Require Action: OPEN â†’ ACTION_REQUIRED
  // ---------------------------------------------------------------------------

  async requireAction(
    inspectionId: string,
    findingId: string,
    dto: RequireActionDto,
    actor: AuthUser,
  ): Promise<FindingRecord> {
    await this.findOneOrThrow(inspectionId);
    const finding = await this.findFindingOrThrow(inspectionId, findingId);

    if (finding.status !== FindingStatus.OPEN) {
      throw new UnprocessableEntityException({
        code: 'INVALID_FINDING_TRANSITION',
        message: 'Only OPEN findings can be transitioned to ACTION_REQUIRED',
      });
    }

    const actionRequired = dto.actionRequired.trim();
    if (!actionRequired) {
      throw new UnprocessableEntityException({
        code: 'SAFETY_ACTION_REQUIRED_TEXT_REQUIRED',
        message: 'actionRequired text is mandatory',
      });
    }

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.safetyFinding.updateMany({
        where: { id: findingId, inspectionId, status: FindingStatus.OPEN },
        data: { status: FindingStatus.ACTION_REQUIRED, actionRequired },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'SAFETY_CONCURRENT_MODIFICATION',
          message: 'Finding was modified concurrently; please retry',
        });
      }

      const updated = await tx.safetyFinding.findUniqueOrThrow({ where: { id: findingId }, select: FINDING_SELECT });

      await tx.safetyInspectionActivity.create({
        data: {
          inspectionId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'FINDING_ACTION_REQUIRED',
          metadata: { findingId, previousFindingStatus: FindingStatus.OPEN, newFindingStatus: FindingStatus.ACTION_REQUIRED },
        },
      });

      return updated as FindingRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Findings â€” Resolve: OPEN | ACTION_REQUIRED â†’ RESOLVED
  // ---------------------------------------------------------------------------

  async resolveFinding(
    inspectionId: string,
    findingId: string,
    dto: ResolveFindingDto,
    actor: AuthUser,
  ): Promise<FindingRecord> {
    await this.findOneOrThrow(inspectionId);
    const finding = await this.findFindingOrThrow(inspectionId, findingId);

    const resolvableStatuses: FindingStatus[] = [FindingStatus.OPEN, FindingStatus.ACTION_REQUIRED];
    if (!resolvableStatuses.includes(finding.status as FindingStatus)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_FINDING_TRANSITION',
        message: 'Only OPEN or ACTION_REQUIRED findings can be resolved',
      });
    }

    this.requireFindingOwnership(finding, actor, 'resolve');

    const resolutionSummary = dto.resolutionSummary.trim();
    if (!resolutionSummary) {
      throw new UnprocessableEntityException({
        code: 'SAFETY_RESOLUTION_SUMMARY_REQUIRED',
        message: 'A resolution summary is required to resolve a finding',
      });
    }

    const now = new Date();
    const previousFindingStatus = finding.status as FindingStatus;

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.safetyFinding.updateMany({
        where: { id: findingId, inspectionId, status: finding.status },
        data: {
          status: FindingStatus.RESOLVED,
          resolutionSummary,
          resolvedAt: now,
          resolvedByUserId: actor.id,
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'SAFETY_CONCURRENT_MODIFICATION',
          message: 'Finding was modified concurrently; please retry',
        });
      }

      const updated = await tx.safetyFinding.findUniqueOrThrow({ where: { id: findingId }, select: FINDING_SELECT });

      await tx.safetyInspectionActivity.create({
        data: {
          inspectionId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'FINDING_RESOLVED',
          metadata: { findingId, previousFindingStatus, newFindingStatus: FindingStatus.RESOLVED },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'SAFETY_FINDING_RESOLVED',
          userId: actor.id,
          actorId: actor.id,
          metadata: { inspectionId, findingId },
        },
      });

      return updated as FindingRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Findings â€” Verify: RESOLVED â†’ VERIFIED
  // ---------------------------------------------------------------------------

  async verifyFinding(
    inspectionId: string,
    findingId: string,
    actor: AuthUser,
  ): Promise<FindingRecord> {
    await this.findOneOrThrow(inspectionId);
    const finding = await this.findFindingOrThrow(inspectionId, findingId);

    if (finding.status !== FindingStatus.RESOLVED) {
      throw new UnprocessableEntityException({
        code: 'INVALID_FINDING_TRANSITION',
        message: 'Only RESOLVED findings can be verified',
      });
    }

    // Separation of duties: verifier cannot be same as resolver unless actor has safety.manage
    if (
      finding.resolvedByUserId &&
      finding.resolvedByUserId === actor.id &&
      !actor.permissions.includes('safety.manage')
    ) {
      throw new ForbiddenException({
        code: 'SAFETY_VERIFIER_SAME_AS_RESOLVER',
        message: 'The verifier cannot be the same user who resolved the finding',
      });
    }

    const now = new Date();

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.safetyFinding.updateMany({
        where: { id: findingId, inspectionId, status: FindingStatus.RESOLVED },
        data: {
          status: FindingStatus.VERIFIED,
          verifiedAt: now,
          verifiedByUserId: actor.id,
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'SAFETY_CONCURRENT_MODIFICATION',
          message: 'Finding was modified concurrently; please retry',
        });
      }

      const updated = await tx.safetyFinding.findUniqueOrThrow({ where: { id: findingId }, select: FINDING_SELECT });

      await tx.safetyInspectionActivity.create({
        data: {
          inspectionId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'FINDING_VERIFIED',
          metadata: { findingId, previousFindingStatus: FindingStatus.RESOLVED, newFindingStatus: FindingStatus.VERIFIED },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'SAFETY_FINDING_VERIFIED',
          userId: actor.id,
          actorId: actor.id,
          metadata: { inspectionId, findingId },
        },
      });

      return updated as FindingRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Findings â€” Close: VERIFIED â†’ CLOSED
  // ---------------------------------------------------------------------------

  async closeFinding(
    inspectionId: string,
    findingId: string,
    actor: AuthUser,
  ): Promise<FindingRecord> {
    await this.findOneOrThrow(inspectionId);
    const finding = await this.findFindingOrThrow(inspectionId, findingId);

    if (finding.status !== FindingStatus.VERIFIED) {
      throw new UnprocessableEntityException({
        code: 'INVALID_FINDING_TRANSITION',
        message: 'Only VERIFIED findings can be closed',
      });
    }

    const now = new Date();

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.safetyFinding.updateMany({
        where: { id: findingId, inspectionId, status: FindingStatus.VERIFIED },
        data: {
          status: FindingStatus.CLOSED,
          closedAt: now,
          closedByUserId: actor.id,
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'SAFETY_CONCURRENT_MODIFICATION',
          message: 'Finding was modified concurrently; please retry',
        });
      }

      const updated = await tx.safetyFinding.findUniqueOrThrow({ where: { id: findingId }, select: FINDING_SELECT });

      await tx.safetyInspectionActivity.create({
        data: {
          inspectionId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'FINDING_CLOSED',
          metadata: { findingId, previousFindingStatus: FindingStatus.VERIFIED, newFindingStatus: FindingStatus.CLOSED },
        },
      });

      return updated as FindingRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Findings â€” Reopen: RESOLVED/VERIFIED/CLOSED â†’ ACTION_REQUIRED
  // ---------------------------------------------------------------------------

  async reopenFinding(
    inspectionId: string,
    findingId: string,
    dto: ReopenFindingDto,
    actor: AuthUser,
  ): Promise<FindingRecord> {
    await this.findOneOrThrow(inspectionId);
    const finding = await this.findFindingOrThrow(inspectionId, findingId);

    const reopenableStatuses: FindingStatus[] = [
      FindingStatus.RESOLVED,
      FindingStatus.VERIFIED,
      FindingStatus.CLOSED,
    ];
    if (!reopenableStatuses.includes(finding.status as FindingStatus)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_FINDING_TRANSITION',
        message: 'Only RESOLVED, VERIFIED, or CLOSED findings can be reopened',
      });
    }

    const reason = dto.reason.trim();
    if (!reason) {
      throw new UnprocessableEntityException({
        code: 'SAFETY_REOPEN_REASON_REQUIRED',
        message: 'A non-empty reason is required to reopen a finding',
      });
    }

    const previousFindingStatus = finding.status as FindingStatus;
    const now = new Date();

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.safetyFinding.updateMany({
        where: { id: findingId, inspectionId, status: finding.status },
        data: {
          status: FindingStatus.ACTION_REQUIRED,
          resolvedAt: null,
          resolvedByUserId: null,
          verifiedAt: null,
          verifiedByUserId: null,
          closedAt: null,
          closedByUserId: null,
          reopenedAt: now,
          reopenedByUserId: actor.id,
          reopenReason: reason,
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'SAFETY_CONCURRENT_MODIFICATION',
          message: 'Finding was modified concurrently; please retry',
        });
      }

      const updated = await tx.safetyFinding.findUniqueOrThrow({ where: { id: findingId }, select: FINDING_SELECT });

      await tx.safetyInspectionActivity.create({
        data: {
          inspectionId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'FINDING_REOPENED',
          metadata: { findingId, previousFindingStatus, newFindingStatus: FindingStatus.ACTION_REQUIRED, reason },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'SAFETY_FINDING_REOPENED',
          userId: actor.id,
          actorId: actor.id,
          metadata: { inspectionId, findingId, previousFindingStatus, reason },
        },
      });

      return updated as FindingRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------------

  async addComment(inspectionId: string, dto: AddInspectionCommentDto, actor: AuthUser): Promise<unknown> {
    await this.findOneOrThrow(inspectionId);

    const body = dto.body.trim();
    if (!body) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'Comment body cannot be empty',
      });
    }

    return this.db.getClient().$transaction(async (tx) => {
      const comment = await tx.safetyInspectionComment.create({
        data: { inspectionId, authorUserId: actor.id, body },
        select: {
          id: true,
          inspectionId: true,
          body: true,
          createdAt: true,
          authorUser: { select: { id: true, displayName: true, username: true } },
        },
      });

      await tx.safetyInspectionActivity.create({
        data: {
          inspectionId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'COMMENT_ADDED',
        },
      });

      return comment;
    });
  }

  async listComments(inspectionId: string): Promise<unknown[]> {
    await this.findOneOrThrow(inspectionId);
    return this.db.getClient().safetyInspectionComment.findMany({
      where: { inspectionId },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        inspectionId: true,
        body: true,
        createdAt: true,
        authorUser: { select: { id: true, displayName: true, username: true } },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Activities
  // ---------------------------------------------------------------------------

  async listActivities(inspectionId: string): Promise<unknown[]> {
    await this.findOneOrThrow(inspectionId);
    return this.db.getClient().safetyInspectionActivity.findMany({
      where: { inspectionId },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  // ---------------------------------------------------------------------------
  // Find / List / Summary
  // ---------------------------------------------------------------------------

  async findAll(
    query: InspectionListQueryDto,
  ): Promise<PaginatedResult<InspectionRecord>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = buildListWhere(query);

    const [items, total] = await Promise.all([
      this.db.getClient().safetyInspection.findMany({
        where,
        select: INSPECTION_SELECT,
        orderBy: [
          { scheduledAt: 'asc' },
          { createdAt: 'desc' },
          { referenceNumber: 'desc' },
        ],
        skip,
        take: pageSize,
      }),
      this.db.getClient().safetyInspection.count({ where }),
    ]);

    return {
      items: items as InspectionRecord[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string): Promise<InspectionRecord> {
    return this.findOneOrThrow(id);
  }

  async getSummary(): Promise<{
    scheduledInspections: number;
    openFindings: number;
    criticalFindings: number;
    overdueFindings: number;
    inProgressInspections: number;
  }> {
    const now = new Date();

    const openFindingStatuses: FindingStatus[] = [
      FindingStatus.OPEN,
      FindingStatus.ACTION_REQUIRED,
      FindingStatus.RESOLVED,
      FindingStatus.VERIFIED,
    ];

    const [
      scheduledInspections,
      openFindings,
      criticalFindings,
      overdueFindings,
      inProgressInspections,
    ] = await Promise.all([
      this.db.getClient().safetyInspection.count({
        where: { status: InspectionStatus.SCHEDULED },
      }),
      this.db.getClient().safetyFinding.count({
        where: { status: { in: openFindingStatuses } },
      }),
      this.db.getClient().safetyFinding.count({
        where: {
          severity: FindingSeverity.CRITICAL,
          status: { not: FindingStatus.CLOSED },
        },
      }),
      this.db.getClient().safetyFinding.count({
        where: {
          dueAt: { lt: now },
          status: { in: [FindingStatus.OPEN, FindingStatus.ACTION_REQUIRED] },
        },
      }),
      this.db.getClient().safetyInspection.count({
        where: { status: InspectionStatus.IN_PROGRESS },
      }),
    ]);

    return {
      scheduledInspections,
      openFindings,
      criticalFindings,
      overdueFindings,
      inProgressInspections,
    };
  }

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

  private async findOneOrThrow(id: string): Promise<InspectionRecord> {
    const inspection = await this.db.getClient().safetyInspection.findUnique({
      where: { id },
      select: INSPECTION_SELECT,
    });
    if (!inspection) {
      throw new NotFoundException({
        code: 'SAFETY_NOT_FOUND',
        message: 'Safety inspection not found',
      });
    }
    return inspection as InspectionRecord;
  }

  private async findFindingOrThrow(inspectionId: string, findingId: string): Promise<FindingRecord> {
    const finding = await this.db.getClient().safetyFinding.findUnique({
      where: { id: findingId, inspectionId },
      select: FINDING_SELECT,
    });
    if (!finding) {
      throw new NotFoundException({
        code: 'SAFETY_FINDING_NOT_FOUND',
        message: 'Safety finding not found',
      });
    }
    return finding as FindingRecord;
  }

  private requireInspectorOwnership(inspection: InspectionRecord, actor: AuthUser, action: string): void {
    if (
      (inspection.inspectorUserId as string | null) !== actor.id &&
      !actor.permissions.includes('safety.manage')
    ) {
      throw new ForbiddenException({
        code: 'SAFETY_NOT_INSPECTOR',
        message: `Only the assigned inspector can ${action} this inspection`,
      });
    }
  }

  private requireFindingOwnership(finding: FindingRecord, actor: AuthUser, action: string): void {
    if (
      (finding.assignedToUserId as string | null) !== actor.id &&
      !actor.permissions.includes('safety.manage')
    ) {
      throw new ForbiddenException({
        code: 'SAFETY_NOT_ASSIGNEE',
        message: `Only the assigned user can ${action} this finding`,
      });
    }
  }

  private async requireActiveUser(userId: string, field: string): Promise<void> {
    const user = await this.db.getClient().user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new UnprocessableEntityException({
        code: 'SAFETY_USER_INVALID',
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
        code: 'SAFETY_LOCATION_INVALID',
        message: 'The specified location does not exist',
      });
    }

    if (plantId && location.plantId && location.plantId !== plantId) {
      throw new UnprocessableEntityException({
        code: 'SAFETY_LOCATION_INVALID',
        message: 'The specified location does not belong to the specified plant',
      });
    }

    const resolvedPlantId = plantId ?? location.plantId ?? null;
    return { resolvedPlantId, resolvedLocationId: locationId };
  }
}

export function buildListWhere(
  query: InspectionListQueryDto,
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (query.status) {
    where['status'] = query.status;
  }

  if (query.inspectorUserId) {
    where['inspectorUserId'] = query.inspectorUserId;
  }

  if (query.departmentId) where['departmentId'] = query.departmentId;
  if (query.plantId) where['plantId'] = query.plantId;
  if (query.locationId) where['locationId'] = query.locationId;

  if (query.scheduledFrom || query.scheduledTo) {
    const scheduledAt: Record<string, Date> = {};
    if (query.scheduledFrom) scheduledAt['gte'] = new Date(query.scheduledFrom);
    if (query.scheduledTo) scheduledAt['lte'] = new Date(query.scheduledTo);
    where['scheduledAt'] = scheduledAt;
  }

  if (query.search?.trim()) {
    where['OR'] = [
      { title: { contains: query.search.trim(), mode: 'insensitive' } },
      { referenceNumber: { contains: query.search.trim(), mode: 'insensitive' } },
    ];
  }

  return where;
}


