import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import { IncidentStatus, IncidentActionStatus, IncidentSeverity, ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import { IncidentsRefService } from './incidents-ref.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateIncidentDto } from './dto/create-incident.dto';
import type { UpdateIncidentDto } from './dto/update-incident.dto';
import type { IncidentListQueryDto } from './dto/incident-list-query.dto';
import type { PaginatedResult } from '../organizations/dto/org-list-query.dto';
import type {
  ResolveIncidentDto,
  ReopenIncidentDto,
  CancelIncidentDto,
  AssignIncidentDto,
  UpdateInvestigationDto,
} from './dto/transition.dto';
import type { AddCommentDto } from './dto/add-comment.dto';
import type { AddActionDto, UpdateActionDto } from './dto/action.dto';

// ---------------------------------------------------------------------------
// Valid status transitions map.
// Key = current status; value = set of allowed target statuses.
// ---------------------------------------------------------------------------
const VALID_TRANSITIONS: Record<IncidentStatus, Set<IncidentStatus>> = {
  [IncidentStatus.DRAFT]: new Set([IncidentStatus.SUBMITTED, IncidentStatus.CANCELLED]),
  [IncidentStatus.SUBMITTED]: new Set([IncidentStatus.UNDER_REVIEW, IncidentStatus.CANCELLED]),
  [IncidentStatus.UNDER_REVIEW]: new Set([
    IncidentStatus.INVESTIGATION,
    IncidentStatus.ACTION_REQUIRED,
    IncidentStatus.RESOLVED,
    IncidentStatus.CANCELLED,
  ]),
  [IncidentStatus.INVESTIGATION]: new Set([
    IncidentStatus.ACTION_REQUIRED,
    IncidentStatus.RESOLVED,
    IncidentStatus.CANCELLED,
  ]),
  [IncidentStatus.ACTION_REQUIRED]: new Set([
    IncidentStatus.INVESTIGATION,
    IncidentStatus.RESOLVED,
    IncidentStatus.CANCELLED,
  ]),
  [IncidentStatus.RESOLVED]: new Set([IncidentStatus.CLOSED, IncidentStatus.UNDER_REVIEW]),
  [IncidentStatus.CLOSED]: new Set([IncidentStatus.UNDER_REVIEW]),
  [IncidentStatus.CANCELLED]: new Set(),
};

// Valid action status transitions
const VALID_ACTION_TRANSITIONS: Record<IncidentActionStatus, Set<IncidentActionStatus>> = {
  [IncidentActionStatus.OPEN]: new Set([
    IncidentActionStatus.IN_PROGRESS,
    IncidentActionStatus.CANCELLED,
  ]),
  [IncidentActionStatus.IN_PROGRESS]: new Set([
    IncidentActionStatus.COMPLETED,
    IncidentActionStatus.CANCELLED,
  ]),
  [IncidentActionStatus.COMPLETED]: new Set(),
  [IncidentActionStatus.CANCELLED]: new Set(),
};

// Statuses in which corrective actions may be created
const ACTION_ALLOWED_STATUSES: Set<IncidentStatus> = new Set([
  IncidentStatus.UNDER_REVIEW,
  IncidentStatus.INVESTIGATION,
  IncidentStatus.ACTION_REQUIRED,
]);

// The incident select shape returned by most endpoints
const INCIDENT_SELECT = {
  id: true,
  referenceNumber: true,
  title: true,
  description: true,
  severity: true,
  status: true,
  occurredAt: true,
  immediateAction: true,
  reportedByUserId: true,
  reportedForUserId: true,
  affectedPlantId: true,
  affectedLocationId: true,
  affectedDepartmentId: true,
  assignedToUserId: true,
  reviewedByUserId: true,
  rootCause: true,
  investigationSummary: true,
  resolutionSummary: true,
  resolvedByUserId: true,
  closedByUserId: true,
  resolvedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  reportedByUser: { select: { id: true, displayName: true, username: true } },
  reportedForUser: { select: { id: true, displayName: true, username: true } },
  affectedPlant: { select: { id: true, code: true, name: true } },
  affectedLocation: { select: { id: true, code: true, name: true } },
  affectedDept: { select: { id: true, code: true, name: true } },
  assignedToUser: { select: { id: true, displayName: true, username: true } },
} as const;

type IncidentRecord = Awaited<
  ReturnType<ReturnType<DatabaseService['getClient']>['incident']['findUniqueOrThrow']>
>;

@Injectable()
export class IncidentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ref: IncidentsRefService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(dto: CreateIncidentDto, actor: AuthUser): Promise<IncidentRecord> {
    const occurredAt = new Date(dto.occurredAt);
    this.validateOccurredAt(occurredAt);

    if (dto.reportedForUserId) {
      await this.requireActiveUser(dto.reportedForUserId, 'reportedForUserId');
    }
    if (dto.affectedPlantId && dto.affectedLocationId) {
      await this.validateLocationBelongsToPlant(dto.affectedLocationId, dto.affectedPlantId);
    }

    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.INCIDENT_REPORT, dto.affectedDepartmentId ?? null);

    const now = new Date();
    const year = now.getUTCFullYear();

    return this.db.getClient().$transaction(async (tx) => {
      const referenceNumber = await this.ref.nextRef(tx, year);

      const incident = await tx.incident.create({
        data: {
          referenceNumber,
          title: dto.title,
          description: dto.description,
          severity: dto.severity,
          occurredAt,
          immediateAction: dto.immediateAction ?? null,
          reportedByUserId: actor.id,
          reportedForUserId: dto.reportedForUserId ?? null,
          affectedPlantId: dto.affectedPlantId ?? null,
          affectedLocationId: dto.affectedLocationId ?? null,
          affectedDepartmentId: dto.affectedDepartmentId ?? null,
        },
        select: INCIDENT_SELECT,
      });

      await tx.incidentActivity.create({
        data: {
          incidentId: incident.id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'INCIDENT_CREATED',
          newStatus: IncidentStatus.DRAFT,
          metadata: { referenceNumber },
        },
      });

      return incident as IncidentRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Update own DRAFT
  // ---------------------------------------------------------------------------

  async updateDraft(id: string, dto: UpdateIncidentDto, actor: AuthUser): Promise<IncidentRecord> {
    const incident = await this.findOneOrThrow(id, actor);

    if (incident.status !== IncidentStatus.DRAFT) {
      throw new UnprocessableEntityException({
        code: 'INCIDENT_NOT_DRAFT',
        message: 'Only DRAFT incidents can be edited via this endpoint',
      });
    }
    if (incident.reportedByUserId !== actor.id && !actor.permissions.includes('incidents.manage')) {
      throw new ForbiddenException({
        code: 'INCIDENT_NOT_OWN_DRAFT',
        message: 'You can only edit your own DRAFT incidents',
      });
    }

    if (dto.occurredAt !== undefined) {
      this.validateOccurredAt(new Date(dto.occurredAt));
    }
    if (dto.reportedForUserId) {
      await this.requireActiveUser(dto.reportedForUserId, 'reportedForUserId');
    }

    const plantId = dto.affectedPlantId !== undefined ? dto.affectedPlantId : incident.affectedPlantId as string | null;
    const locationId = dto.affectedLocationId !== undefined ? dto.affectedLocationId : incident.affectedLocationId as string | null;
    if (plantId && locationId) {
      await this.validateLocationBelongsToPlant(locationId, plantId);
    }

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data['title'] = dto.title;
    if (dto.description !== undefined) data['description'] = dto.description;
    if (dto.severity !== undefined) data['severity'] = dto.severity;
    if (dto.occurredAt !== undefined) data['occurredAt'] = new Date(dto.occurredAt);
    if (dto.immediateAction !== undefined) data['immediateAction'] = dto.immediateAction;
    if (dto.reportedForUserId !== undefined) data['reportedForUserId'] = dto.reportedForUserId;
    if (dto.affectedPlantId !== undefined) data['affectedPlantId'] = dto.affectedPlantId;
    if (dto.affectedLocationId !== undefined) data['affectedLocationId'] = dto.affectedLocationId;
    if (dto.affectedDepartmentId !== undefined) data['affectedDepartmentId'] = dto.affectedDepartmentId;

    return this.db.getClient().incident.update({
      where: { id },
      data,
      select: INCIDENT_SELECT,
    }) as Promise<IncidentRecord>;
  }

  // ---------------------------------------------------------------------------
  // Update severity (status-specific permission rules per approval A)
  // ---------------------------------------------------------------------------

  async updateSeverity(id: string, severity: IncidentSeverity, actor: AuthUser): Promise<IncidentRecord> {
    const incident = await this.findOneOrThrow(id, actor);
    const isTerminal = incident.status === IncidentStatus.RESOLVED
      || incident.status === IncidentStatus.CLOSED
      || incident.status === IncidentStatus.CANCELLED;

    if (isTerminal) {
      throw new UnprocessableEntityException({
        code: 'INCIDENT_INVALID_TRANSITION',
        message: 'Cannot change severity of a closed, resolved, or cancelled incident',
      });
    }

    // SUBMITTED or UNDER_REVIEW: incidents.review is sufficient
    // INVESTIGATION or later: requires incidents.manage
    const earlyStates: IncidentStatus[] = [IncidentStatus.DRAFT, IncidentStatus.SUBMITTED, IncidentStatus.UNDER_REVIEW];
    const needsManage = !earlyStates.includes(incident.status as IncidentStatus);

    if (needsManage && !actor.permissions.includes('incidents.manage')) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Changing severity after investigation has started requires incidents.manage',
      });
    }

    const previousSeverity = incident.severity;

    return this.db.getClient().$transaction(async (tx) => {
      const updated = await tx.incident.update({
        where: { id },
        data: { severity },
        select: INCIDENT_SELECT,
      });

      await tx.incidentActivity.create({
        data: {
          incidentId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'SEVERITY_CHANGED',
          metadata: { previousSeverity, newSeverity: severity },
        },
      });

      return updated as IncidentRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Update investigation fields
  // ---------------------------------------------------------------------------

  async updateInvestigation(id: string, dto: UpdateInvestigationDto, actor: AuthUser): Promise<IncidentRecord> {
    const incident = await this.findOneOrThrow(id, actor);

    const allowed: IncidentStatus[] = [
      IncidentStatus.INVESTIGATION,
      IncidentStatus.ACTION_REQUIRED,
      IncidentStatus.UNDER_REVIEW,
    ];
    if (!allowed.includes(incident.status as IncidentStatus)) {
      throw new UnprocessableEntityException({
        code: 'INCIDENT_INVALID_STATE',
        message: 'Investigation fields can only be updated during UNDER_REVIEW, INVESTIGATION, or ACTION_REQUIRED',
      });
    }

    const data: Record<string, unknown> = {};
    if (dto.rootCause !== undefined) data['rootCause'] = dto.rootCause;
    if (dto.investigationSummary !== undefined) data['investigationSummary'] = dto.investigationSummary;

    if (Object.keys(data).length === 0) {
      return this.findOneOrThrow(id) as Promise<IncidentRecord>;
    }

    return this.db.getClient().$transaction(async (tx) => {
      const updated = await tx.incident.update({
        where: { id },
        data,
        select: INCIDENT_SELECT,
      });

      await tx.incidentActivity.create({
        data: {
          incidentId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'INVESTIGATION_UPDATED',
          metadata: { fields: Object.keys(data) },
        },
      });

      return updated as IncidentRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Find / List
  // ---------------------------------------------------------------------------

  async findAll(query: IncidentListQueryDto, actor: AuthUser): Promise<PaginatedResult<IncidentRecord>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    // Validate date range if both supplied
    if (query.dateFrom && query.dateTo && new Date(query.dateFrom) > new Date(query.dateTo)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'dateFrom must be before or equal to dateTo',
      });
    }

    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.INCIDENT_REPORT);
    const where: Record<string, unknown> = { ...buildListWhere(query) };
    if (deptFilter !== null) {
      where['affectedDepartmentId'] = deptFilter;
    }

    const [items, total] = await Promise.all([
      this.db.getClient().incident.findMany({
        where,
        select: INCIDENT_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.db.getClient().incident.count({ where }),
    ]);

    return {
      items: items as IncidentRecord[],
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string, actor: AuthUser): Promise<IncidentRecord> {
    return this.findOneOrThrow(id, actor);
  }

  async getSummary(actor: AuthUser): Promise<{
    totalOpen: number;
    criticalOpen: number;
    underInvestigation: number;
    resolvedThisMonth: number;
  }> {
    const openStatuses = [
      IncidentStatus.SUBMITTED,
      IncidentStatus.UNDER_REVIEW,
      IncidentStatus.INVESTIGATION,
      IncidentStatus.ACTION_REQUIRED,
    ];

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.INCIDENT_REPORT);
    const deptWhere = deptFilter !== null ? { affectedDepartmentId: deptFilter } : {};

    const [totalOpen, criticalOpen, underInvestigation, resolvedThisMonth] = await Promise.all([
      this.db.getClient().incident.count({ where: { ...deptWhere, status: { in: openStatuses } } }),
      this.db.getClient().incident.count({
        where: { ...deptWhere, status: { in: openStatuses }, severity: IncidentSeverity.CRITICAL },
      }),
      this.db.getClient().incident.count({ where: { ...deptWhere, status: IncidentStatus.INVESTIGATION } }),
      this.db.getClient().incident.count({
        where: {
          ...deptWhere,
          status: IncidentStatus.RESOLVED,
          resolvedAt: { gte: monthStart, lt: monthEnd },
        },
      }),
    ]);

    return { totalOpen, criticalOpen, underInvestigation, resolvedThisMonth };
  }

  // ---------------------------------------------------------------------------
  // Status transitions
  // ---------------------------------------------------------------------------

  async submit(id: string, actor: AuthUser): Promise<IncidentRecord> {
    const incident = await this.findOneOrThrow(id, actor);

    if (incident.status !== IncidentStatus.DRAFT) {
      throw new UnprocessableEntityException({ code: 'INCIDENT_INVALID_TRANSITION', message: 'Only DRAFT incidents can be submitted' });
    }
    if (incident.reportedByUserId !== actor.id && !actor.permissions.includes('incidents.manage')) {
      throw new ForbiddenException({ code: 'INCIDENT_NOT_OWN_DRAFT', message: 'You can only submit your own incidents' });
    }

    return this.transitionStatus(incident, IncidentStatus.SUBMITTED, actor, {});
  }

  async startReview(id: string, actor: AuthUser): Promise<IncidentRecord> {
    const incident = await this.findOneOrThrow(id, actor);
    this.assertValidTransition(incident, IncidentStatus.UNDER_REVIEW);
    return this.transitionStatus(incident, IncidentStatus.UNDER_REVIEW, actor, {
      reviewedByUserId: actor.id,
    });
  }

  async assign(id: string, dto: AssignIncidentDto, actor: AuthUser): Promise<IncidentRecord> {
    const incident = await this.findOneOrThrow(id, actor);

    const assignableStatuses: IncidentStatus[] = [
      IncidentStatus.SUBMITTED,
      IncidentStatus.UNDER_REVIEW,
      IncidentStatus.INVESTIGATION,
      IncidentStatus.ACTION_REQUIRED,
    ];
    if (!assignableStatuses.includes(incident.status as IncidentStatus)) {
      throw new UnprocessableEntityException({
        code: 'INCIDENT_INVALID_STATE',
        message: 'Assignment is only allowed on open incidents (SUBMITTED through ACTION_REQUIRED)',
      });
    }

    await this.requireActiveUser(dto.assignedToUserId, 'assignedToUserId');

    const previousAssignee = incident.assignedToUserId as string | null;

    return this.db.getClient().$transaction(async (tx) => {
      const updated = await tx.incident.update({
        where: { id, status: incident.status },
        data: { assignedToUserId: dto.assignedToUserId },
        select: INCIDENT_SELECT,
      });

      if (!updated) {
        throw new UnprocessableEntityException({ code: 'INCIDENT_CONCURRENT_MODIFICATION', message: 'Incident was modified concurrently; please retry' });
      }

      await tx.incidentActivity.create({
        data: {
          incidentId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'INVESTIGATOR_ASSIGNED',
          metadata: {
            assignedToUserId: dto.assignedToUserId,
            previousAssignedToUserId: previousAssignee,
          },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'INCIDENT_INVESTIGATOR_ASSIGNED',
          userId: incident.reportedByUserId as string,
          actorId: actor.id,
          metadata: {
            incidentId: id,
            referenceNumber: incident.referenceNumber,
            assignedToUserId: dto.assignedToUserId,
          },
        },
      });

      return updated as IncidentRecord;
    });
  }

  async beginInvestigation(id: string, actor: AuthUser): Promise<IncidentRecord> {
    const incident = await this.findOneOrThrow(id, actor);
    this.assertValidTransition(incident, IncidentStatus.INVESTIGATION);
    return this.transitionStatus(incident, IncidentStatus.INVESTIGATION, actor, {});
  }

  async requestActions(id: string, actor: AuthUser): Promise<IncidentRecord> {
    const incident = await this.findOneOrThrow(id, actor);
    this.assertValidTransition(incident, IncidentStatus.ACTION_REQUIRED);
    return this.transitionStatus(incident, IncidentStatus.ACTION_REQUIRED, actor, {});
  }

  async resolve(id: string, dto: ResolveIncidentDto, actor: AuthUser): Promise<IncidentRecord> {
    const incident = await this.findOneOrThrow(id, actor);

    const resolvableStatuses: IncidentStatus[] = [
      IncidentStatus.UNDER_REVIEW,
      IncidentStatus.INVESTIGATION,
      IncidentStatus.ACTION_REQUIRED,
    ];
    if (!resolvableStatuses.includes(incident.status as IncidentStatus)) {
      throw new UnprocessableEntityException({
        code: 'INCIDENT_INVALID_TRANSITION',
        message: `Cannot resolve from status ${incident.status}`,
      });
    }

    const trimmedSummary = dto.resolutionSummary.trim();
    if (!trimmedSummary) {
      throw new UnprocessableEntityException({
        code: 'INCIDENT_RESOLUTION_REQUIRED',
        message: 'Resolution summary is required',
      });
    }

    // Check for open actions
    const openActionCount = await this.db.getClient().incidentAction.count({
      where: {
        incidentId: id,
        status: { in: [IncidentActionStatus.OPEN, IncidentActionStatus.IN_PROGRESS] },
      },
    });

    if (openActionCount > 0 && !dto.confirmOpenActions) {
      throw new UnprocessableEntityException({
        code: 'INCIDENT_OPEN_ACTIONS',
        message: `This incident has ${openActionCount} open corrective action(s). Set confirmOpenActions=true to resolve anyway.`,
        // Include count in the response for the UI
      });
    }

    const now = new Date();
    return this.transitionStatus(incident, IncidentStatus.RESOLVED, actor, {
      resolutionSummary: trimmedSummary,
      resolvedByUserId: actor.id,
      resolvedAt: now,
    });
  }

  async close(id: string, actor: AuthUser): Promise<IncidentRecord> {
    const incident = await this.findOneOrThrow(id, actor);
    this.assertValidTransition(incident, IncidentStatus.CLOSED);
    return this.transitionStatus(incident, IncidentStatus.CLOSED, actor, {
      closedByUserId: actor.id,
      closedAt: new Date(),
    });
  }

  async cancel(id: string, dto: CancelIncidentDto, actor: AuthUser): Promise<IncidentRecord> {
    const incident = await this.findOneOrThrow(id, actor);

    // Reporter can cancel own DRAFT or SUBMITTED (approved correction B)
    const isOwnEarlyState =
      incident.reportedByUserId === actor.id &&
      (incident.status === IncidentStatus.DRAFT || incident.status === IncidentStatus.SUBMITTED);

    if (!isOwnEarlyState && !actor.permissions.includes('incidents.manage')) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only the reporter can cancel their own draft/submission; other cancellations require incidents.manage',
      });
    }

    const terminalStates: IncidentStatus[] = [IncidentStatus.CANCELLED, IncidentStatus.CLOSED];
    if (terminalStates.includes(incident.status as IncidentStatus)) {
      throw new UnprocessableEntityException({
        code: 'INCIDENT_INVALID_TRANSITION',
        message: `Cannot cancel an incident with status ${incident.status}`,
      });
    }

    if (!isOwnEarlyState && !dto.reason?.trim()) {
      throw new UnprocessableEntityException({
        code: 'INCIDENT_CANCEL_REASON_REQUIRED',
        message: 'A reason is required when cancelling another user\'s incident',
      });
    }

    return this.db.getClient().$transaction(async (tx) => {
      const previousStatus = incident.status;

      const updated = await tx.incident.updateMany({
        where: { id, status: incident.status },
        data: { status: IncidentStatus.CANCELLED },
      });

      if (updated.count === 0) {
        throw new UnprocessableEntityException({ code: 'INCIDENT_CONCURRENT_MODIFICATION', message: 'Incident was modified concurrently; please retry' });
      }

      const result = await tx.incident.findUniqueOrThrow({
        where: { id },
        select: INCIDENT_SELECT,
      });

      await tx.incidentActivity.create({
        data: {
          incidentId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'STATUS_CHANGED',
          previousStatus: previousStatus as IncidentStatus,
          newStatus: IncidentStatus.CANCELLED,
          ...(dto.reason?.trim() ? { metadata: { reason: dto.reason.trim() } } : {}),
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'INCIDENT_CANCELLED',
          userId: incident.reportedByUserId as string,
          actorId: actor.id,
          metadata: {
            incidentId: id,
            referenceNumber: incident.referenceNumber,
            reason: dto.reason?.trim() ?? null,
          },
        },
      });

      return result as IncidentRecord;
    });
  }

  async reopen(id: string, dto: ReopenIncidentDto, actor: AuthUser): Promise<IncidentRecord> {
    const incident = await this.findOneOrThrow(id, actor);

    const reopenableStatuses: IncidentStatus[] = [IncidentStatus.RESOLVED, IncidentStatus.CLOSED];
    if (!reopenableStatuses.includes(incident.status as IncidentStatus)) {
      throw new UnprocessableEntityException({
        code: 'INCIDENT_INVALID_TRANSITION',
        message: 'Only RESOLVED or CLOSED incidents can be reopened',
      });
    }

    const reason = dto.reason.trim();
    if (!reason) {
      throw new UnprocessableEntityException({
        code: 'INCIDENT_REOPEN_REASON_REQUIRED',
        message: 'A non-empty reason is required to reopen an incident',
      });
    }

    const previousStatus = incident.status;

    return this.db.getClient().$transaction(async (tx) => {
      const updated = await tx.incident.updateMany({
        where: { id, status: incident.status },
        data: {
          status: IncidentStatus.UNDER_REVIEW,
          // Clear lifecycle timestamps; preserve historical text fields
          resolvedAt: null,
          closedAt: null,
          resolvedByUserId: null,
          closedByUserId: null,
        },
      });

      if (updated.count === 0) {
        throw new UnprocessableEntityException({ code: 'INCIDENT_CONCURRENT_MODIFICATION', message: 'Incident was modified concurrently; please retry' });
      }

      const result = await tx.incident.findUniqueOrThrow({
        where: { id },
        select: INCIDENT_SELECT,
      });

      await tx.incidentActivity.create({
        data: {
          incidentId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'INCIDENT_REOPENED',
          previousStatus: previousStatus as IncidentStatus,
          newStatus: IncidentStatus.UNDER_REVIEW,
          metadata: { reason },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'INCIDENT_REOPENED',
          userId: incident.reportedByUserId as string,
          actorId: actor.id,
          metadata: {
            incidentId: id,
            referenceNumber: incident.referenceNumber,
            previousStatus,
            reason,
          },
        },
      });

      return result as IncidentRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------------

  async listComments(incidentId: string, actor: AuthUser): Promise<unknown[]> {
    await this.findOneOrThrow(incidentId, actor);
    return this.db.getClient().incidentComment.findMany({
      where: { incidentId },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        incidentId: true,
        body: true,
        createdAt: true,
        authorUser: { select: { id: true, displayName: true, username: true } },
      },
    });
  }

  async addComment(incidentId: string, dto: AddCommentDto, actor: AuthUser): Promise<unknown> {
    await this.findOneOrThrow(incidentId, actor);

    const body = dto.body.trim();
    if (!body) {
      throw new UnprocessableEntityException({ code: 'VALIDATION_ERROR', message: 'Comment body cannot be empty' });
    }

    return this.db.getClient().$transaction(async (tx) => {
      const comment = await tx.incidentComment.create({
        data: { incidentId, authorUserId: actor.id, body },
        select: {
          id: true,
          incidentId: true,
          body: true,
          createdAt: true,
          authorUser: { select: { id: true, displayName: true, username: true } },
        },
      });

      await tx.incidentActivity.create({
        data: {
          incidentId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'COMMENT_ADDED',
        },
      });

      return comment;
    });
  }

  // ---------------------------------------------------------------------------
  // Activities
  // ---------------------------------------------------------------------------

  async listActivities(incidentId: string, actor: AuthUser): Promise<unknown[]> {
    await this.findOneOrThrow(incidentId, actor);
    return this.db.getClient().incidentActivity.findMany({
      where: { incidentId },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  // ---------------------------------------------------------------------------
  // Corrective actions
  // ---------------------------------------------------------------------------

  async listActions(incidentId: string, actor: AuthUser): Promise<unknown[]> {
    await this.findOneOrThrow(incidentId, actor);
    return this.db.getClient().incidentAction.findMany({
      where: { incidentId },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        incidentId: true,
        title: true,
        description: true,
        status: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        assignedToUser: { select: { id: true, displayName: true, username: true } },
        completedByUser: { select: { id: true, displayName: true, username: true } },
        createdByUser: { select: { id: true, displayName: true, username: true } },
      },
    });
  }

  async addAction(incidentId: string, dto: AddActionDto, actor: AuthUser): Promise<unknown> {
    const incident = await this.findOneOrThrow(incidentId, actor);

    if (!ACTION_ALLOWED_STATUSES.has(incident.status as IncidentStatus)) {
      throw new UnprocessableEntityException({
        code: 'INCIDENT_INVALID_STATE',
        message: `Corrective actions can only be added during UNDER_REVIEW, INVESTIGATION, or ACTION_REQUIRED`,
      });
    }

    if (dto.assignedToUserId) {
      await this.requireActiveUser(dto.assignedToUserId, 'assignedToUserId');
    }

    return this.db.getClient().$transaction(async (tx) => {
      const action = await tx.incidentAction.create({
        data: {
          incidentId,
          title: dto.title,
          description: dto.description ?? null,
          assignedToUserId: dto.assignedToUserId ?? null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          createdByUserId: actor.id,
        },
        select: {
          id: true,
          incidentId: true,
          title: true,
          description: true,
          status: true,
          dueDate: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
          assignedToUser: { select: { id: true, displayName: true, username: true } },
          createdByUser: { select: { id: true, displayName: true, username: true } },
        },
      });

      await tx.incidentActivity.create({
        data: {
          incidentId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'ACTION_ADDED',
          metadata: { actionId: action.id, title: dto.title },
        },
      });

      return action;
    });
  }

  async updateAction(incidentId: string, actionId: string, dto: UpdateActionDto, actor: AuthUser): Promise<unknown> {
    await this.findOneOrThrow(incidentId, actor);

    const action = await this.db.getClient().incidentAction.findFirst({
      where: { id: actionId, incidentId },
    });
    if (!action) {
      throw new NotFoundException({ code: 'INCIDENT_ACTION_NOT_FOUND', message: 'Action not found' });
    }

    // Enforce explicit transition rules
    if (dto.status !== undefined && dto.status !== action.status) {
      const terminalStatuses: IncidentActionStatus[] = [IncidentActionStatus.COMPLETED, IncidentActionStatus.CANCELLED];
      if (terminalStatuses.includes(action.status)) {
        throw new UnprocessableEntityException({
          code: 'INCIDENT_ACTION_TERMINAL',
          message: `Action is in terminal status ${action.status} and cannot be transitioned`,
        });
      }
      if (!VALID_ACTION_TRANSITIONS[action.status].has(dto.status)) {
        throw new UnprocessableEntityException({
          code: 'INCIDENT_ACTION_INVALID_TRANSITION',
          message: `Cannot transition action from ${action.status} to ${dto.status}`,
        });
      }
    }

    if (dto.assignedToUserId) {
      await this.requireActiveUser(dto.assignedToUserId, 'assignedToUserId');
    }

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data['title'] = dto.title;
    if (dto.description !== undefined) data['description'] = dto.description;
    if (dto.assignedToUserId !== undefined) data['assignedToUserId'] = dto.assignedToUserId;
    if (dto.dueDate !== undefined) data['dueDate'] = dto.dueDate ? new Date(dto.dueDate) : null;

    if (dto.status !== undefined && dto.status !== action.status) {
      data['status'] = dto.status;
      if (dto.status === IncidentActionStatus.COMPLETED) {
        data['completedAt'] = new Date();
        data['completedByUserId'] = actor.id;
      }
    }

    return this.db.getClient().$transaction(async (tx) => {
      // Concurrency-safe: only update if status hasn't changed underneath us
      const result = await tx.incidentAction.updateMany({
        where: { id: actionId, incidentId, status: action.status },
        data,
      });

      if (result.count === 0) {
        throw new UnprocessableEntityException({ code: 'INCIDENT_CONCURRENT_MODIFICATION', message: 'Action was modified concurrently; please retry' });
      }

      const updated = await tx.incidentAction.findUniqueOrThrow({
        where: { id: actionId },
        select: {
          id: true,
          incidentId: true,
          title: true,
          description: true,
          status: true,
          dueDate: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
          assignedToUser: { select: { id: true, displayName: true, username: true } },
          completedByUser: { select: { id: true, displayName: true, username: true } },
          createdByUser: { select: { id: true, displayName: true, username: true } },
        },
      });

      if (dto.status !== undefined && dto.status !== action.status) {
        await tx.incidentActivity.create({
          data: {
            incidentId,
            actorUserId: actor.id,
            actorName: actor.displayName,
            event: 'ACTION_STATUS_CHANGED',
            metadata: { actionId, previousStatus: action.status, newStatus: dto.status },
          },
        });
      }

      return updated;
    });
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

  private async findOneOrThrow(id: string, actor?: AuthUser): Promise<IncidentRecord> {
    const incident = await this.db.getClient().incident.findUnique({
      where: { id },
      select: INCIDENT_SELECT,
    });
    if (!incident) {
      throw new NotFoundException({ code: 'INCIDENT_NOT_FOUND', message: 'Incident not found' });
    }
    if (actor) {
      await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.INCIDENT_REPORT, incident.affectedDepartmentId as string | null);
    }
    return incident as IncidentRecord;
  }

  private assertValidTransition(
    incident: IncidentRecord,
    target: IncidentStatus,
  ): void {
    const allowed = VALID_TRANSITIONS[incident.status as IncidentStatus];
    if (!allowed?.has(target)) {
      throw new UnprocessableEntityException({
        code: 'INCIDENT_INVALID_TRANSITION',
        message: `Cannot transition from ${incident.status} to ${target}`,
      });
    }
  }

  private async transitionStatus(
    incident: IncidentRecord,
    newStatus: IncidentStatus,
    actor: AuthUser,
    extraData: Record<string, unknown>,
  ): Promise<IncidentRecord> {
    const previousStatus = incident.status as IncidentStatus;

    return this.db.getClient().$transaction(async (tx) => {
      // Concurrency-safe: only update if status hasn't changed underneath us
      const updated = await tx.incident.updateMany({
        where: { id: incident.id as string, status: previousStatus },
        data: { status: newStatus, ...extraData },
      });

      if (updated.count === 0) {
        throw new UnprocessableEntityException({ code: 'INCIDENT_CONCURRENT_MODIFICATION', message: 'Incident was modified concurrently; please retry' });
      }

      const result = await tx.incident.findUniqueOrThrow({
        where: { id: incident.id as string },
        select: INCIDENT_SELECT,
      });

      await tx.incidentActivity.create({
        data: {
          incidentId: incident.id as string,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'STATUS_CHANGED',
          previousStatus,
          newStatus,
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'INCIDENT_STATUS_CHANGED',
          userId: incident.reportedByUserId as string,
          actorId: actor.id,
          metadata: {
            incidentId: incident.id,
            referenceNumber: incident.referenceNumber,
            previousStatus,
            newStatus,
          },
        },
      });

      return result as IncidentRecord;
    });
  }

  private validateOccurredAt(date: Date): void {
    const now = new Date();
    const toleranceMs = 60_000; // 1 minute tolerance for clock skew
    if (date.getTime() > now.getTime() + toleranceMs) {
      throw new UnprocessableEntityException({
        code: 'INCIDENT_OCCURRED_IN_FUTURE',
        message: 'occurredAt cannot be in the future',
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
        code: 'VALIDATION_ERROR',
        message: `${field}: user does not exist or is inactive`,
      });
    }
  }

  private async validateLocationBelongsToPlant(locationId: string, plantId: string): Promise<void> {
    const location = await this.db.getClient().location.findUnique({
      where: { id: locationId },
      select: { plantId: true },
    });
    if (!location) {
      throw new UnprocessableEntityException({
        code: 'INCIDENT_INVALID_LOCATION',
        message: 'The specified location does not exist',
      });
    }
    if (location.plantId !== plantId) {
      throw new UnprocessableEntityException({
        code: 'INCIDENT_INVALID_LOCATION',
        message: 'The specified location does not belong to the specified plant',
      });
    }
  }
}

function buildListWhere(query: IncidentListQueryDto): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (query.status) {
    const statuses = Array.isArray(query.status) ? query.status : [query.status];
    where['status'] = { in: statuses };
  }
  if (query.severity) {
    const severities = Array.isArray(query.severity) ? query.severity : [query.severity];
    where['severity'] = { in: severities };
  }
  if (query.affectedPlantId) where['affectedPlantId'] = query.affectedPlantId;
  if (query.affectedDepartmentId) where['affectedDepartmentId'] = query.affectedDepartmentId;
  if (query.assignedToUserId) where['assignedToUserId'] = query.assignedToUserId;

  if (query.dateFrom || query.dateTo) {
    const occurredAt: Record<string, Date> = {};
    if (query.dateFrom) occurredAt['gte'] = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setUTCHours(23, 59, 59, 999);
      occurredAt['lte'] = end;
    }
    where['occurredAt'] = occurredAt;
  }

  if (query.search?.trim()) {
    where['OR'] = [
      { title: { contains: query.search.trim(), mode: 'insensitive' } },
      { referenceNumber: { contains: query.search.trim(), mode: 'insensitive' } },
    ];
  }

  return where;
}
