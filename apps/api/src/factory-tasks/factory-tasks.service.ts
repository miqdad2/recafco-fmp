import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TaskStatus, TaskPriority } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { TasksRefService } from './tasks-ref.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateTaskDto } from './dto/create-task.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';
import type { TaskListQueryDto, PaginatedResult } from './dto/task-list-query.dto';
import type {
  AssignTaskDto,
  BlockTaskDto,
  CompleteTaskDto,
  ReopenTaskDto,
  CancelTaskDto,
} from './dto/transition.dto';
import type { AddCommentDto } from './dto/add-comment.dto';
import type { AddProgressDto } from './dto/add-progress.dto';

// Statuses that are considered "active" for metrics (excludes DRAFT)
const ACTIVE_STATUSES: TaskStatus[] = [
  TaskStatus.OPEN,
  TaskStatus.ASSIGNED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.BLOCKED,
];

// Statuses that are "overdue-eligible" (non-terminal, non-draft)
const OVERDUE_STATUSES: TaskStatus[] = [
  TaskStatus.OPEN,
  TaskStatus.ASSIGNED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.BLOCKED,
];

// Terminal statuses
const TERMINAL_STATUSES: TaskStatus[] = [TaskStatus.COMPLETED, TaskStatus.CLOSED, TaskStatus.CANCELLED];

const TASK_SELECT = {
  id: true,
  referenceNumber: true,
  title: true,
  description: true,
  priority: true,
  status: true,
  createdByUserId: true,
  requestedByUserId: true,
  assignedToUserId: true,
  requestingDepartmentId: true,
  responsibleDepartmentId: true,
  plantId: true,
  locationId: true,
  incidentId: true,
  dueAt: true,
  startedAt: true,
  completedAt: true,
  completedByUserId: true,
  closedAt: true,
  closedByUserId: true,
  blockedAt: true,
  blockedByUserId: true,
  blockedReason: true,
  completionSummary: true,
  createdAt: true,
  updatedAt: true,
  createdByUser: { select: { id: true, displayName: true, username: true } },
  requestedByUser: { select: { id: true, displayName: true, username: true } },
  assignedToUser: { select: { id: true, displayName: true, username: true } },
  requestingDepartment: { select: { id: true, code: true, name: true } },
  responsibleDepartment: { select: { id: true, code: true, name: true } },
  plant: { select: { id: true, code: true, name: true } },
  location: { select: { id: true, code: true, name: true } },
  incident: { select: { id: true, referenceNumber: true, title: true } },
} as const;

type TaskRecord = Awaited<
  ReturnType<ReturnType<DatabaseService['getClient']>['factoryTask']['findUniqueOrThrow']>
>;

@Injectable()
export class FactoryTasksService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ref: TasksRefService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create (creates DRAFT)
  // ---------------------------------------------------------------------------

  async create(dto: CreateTaskDto, actor: AuthUser): Promise<TaskRecord> {
    // requestedByUserId defaults to actor; only tasks.manage may select another
    const requestedByUserId = dto.requestedByUserId ?? actor.id;
    if (dto.requestedByUserId && dto.requestedByUserId !== actor.id) {
      if (!actor.permissions.includes('tasks.manage')) {
        throw new ForbiddenException({
          code: 'TASK_PERMISSION_DENIED',
          message: 'Only users with tasks.manage may set requestedByUserId to another user',
        });
      }
    }

    if (dto.requestedByUserId && dto.requestedByUserId !== actor.id) {
      await this.requireActiveUser(dto.requestedByUserId, 'requestedByUserId');
    }

    const { resolvedPlantId, resolvedLocationId } = await this.resolvePlantLocation(
      dto.plantId,
      dto.locationId,
    );

    if (dto.incidentId) {
      // incidents.read is required to link an incident — check before querying the Incident table
      if (!actor.permissions.includes('incidents.read')) {
        throw new ForbiddenException({
          code: 'TASK_INCIDENT_PERMISSION_DENIED',
          message: 'incidents.read permission is required to link an incident to a task',
        });
      }
      await this.requireIncidentExists(dto.incidentId);
    }

    const now = new Date();
    const year = now.getUTCFullYear();

    return this.db.getClient().$transaction(async (tx) => {
      const referenceNumber = await this.ref.nextRef(tx, year);

      const task = await tx.factoryTask.create({
        data: {
          referenceNumber,
          title: dto.title,
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          priority: dto.priority ?? TaskPriority.MEDIUM,
          createdByUserId: actor.id,
          requestedByUserId,
          ...(dto.requestingDepartmentId ? { requestingDepartmentId: dto.requestingDepartmentId } : {}),
          ...(dto.responsibleDepartmentId ? { responsibleDepartmentId: dto.responsibleDepartmentId } : {}),
          ...(resolvedPlantId ? { plantId: resolvedPlantId } : {}),
          ...(resolvedLocationId ? { locationId: resolvedLocationId } : {}),
          ...(dto.incidentId ? { incidentId: dto.incidentId } : {}),
          ...(dto.dueAt ? { dueAt: new Date(dto.dueAt) } : {}),
        },
        select: TASK_SELECT,
      });

      await tx.factoryTaskActivity.create({
        data: {
          taskId: task.id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'TASK_CREATED',
          newStatus: TaskStatus.DRAFT,
          metadata: { referenceNumber },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'TASK_CREATED',
          userId: actor.id,
          actorId: actor.id,
          metadata: { taskId: task.id, referenceNumber },
        },
      });

      return this.filterTaskIncident(task as TaskRecord, actor);
    });
  }

  // ---------------------------------------------------------------------------
  // Update own DRAFT
  // ---------------------------------------------------------------------------

  async updateDraft(id: string, dto: UpdateTaskDto, actor: AuthUser): Promise<TaskRecord> {
    const task = await this.findOneOrThrow(id);

    if (task.status !== TaskStatus.DRAFT) {
      throw new UnprocessableEntityException({
        code: 'TASK_NOT_EDITABLE',
        message: 'Only DRAFT tasks can be edited via this endpoint',
      });
    }
    if (task.createdByUserId !== actor.id && !actor.permissions.includes('tasks.manage')) {
      throw new ForbiddenException({
        code: 'TASK_NOT_OWN_DRAFT',
        message: 'You can only edit your own DRAFT tasks',
      });
    }

    if (dto.requestedByUserId && dto.requestedByUserId !== actor.id) {
      if (!actor.permissions.includes('tasks.manage')) {
        throw new ForbiddenException({
          code: 'TASK_PERMISSION_DENIED',
          message: 'Only users with tasks.manage may set requestedByUserId to another user',
        });
      }
      await this.requireActiveUser(dto.requestedByUserId, 'requestedByUserId');
    }

    const currentPlantId = dto.plantId !== undefined ? dto.plantId : (task.plantId as string | null);
    const currentLocationId =
      dto.locationId !== undefined ? dto.locationId : (task.locationId as string | null);
    const { resolvedPlantId, resolvedLocationId } = await this.resolvePlantLocation(
      currentPlantId ?? undefined,
      currentLocationId ?? undefined,
    );

    if (dto.incidentId) {
      // incidents.read is required to set or replace incidentId — check before querying the Incident table
      if (!actor.permissions.includes('incidents.read')) {
        throw new ForbiddenException({
          code: 'TASK_INCIDENT_PERMISSION_DENIED',
          message: 'incidents.read permission is required to link an incident to a task',
        });
      }
      await this.requireIncidentExists(dto.incidentId);
    }

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data['title'] = dto.title;
    if (dto.description !== undefined) data['description'] = dto.description;
    if (dto.priority !== undefined) data['priority'] = dto.priority;
    if (dto.requestedByUserId !== undefined) data['requestedByUserId'] = dto.requestedByUserId;
    if (dto.requestingDepartmentId !== undefined) data['requestingDepartmentId'] = dto.requestingDepartmentId;
    if (dto.responsibleDepartmentId !== undefined) data['responsibleDepartmentId'] = dto.responsibleDepartmentId;
    if (dto.plantId !== undefined) data['plantId'] = resolvedPlantId;
    if (dto.locationId !== undefined) data['locationId'] = resolvedLocationId;
    if (dto.incidentId !== undefined) data['incidentId'] = dto.incidentId;
    if (dto.dueAt !== undefined) data['dueAt'] = dto.dueAt ? new Date(dto.dueAt) : null;

    const updated = await this.db.getClient().factoryTask.update({
      where: { id },
      data,
      select: TASK_SELECT,
    });
    return this.filterTaskIncident(updated as TaskRecord, actor);
  }

  // ---------------------------------------------------------------------------
  // Update priority (status-specific permission check)
  // ---------------------------------------------------------------------------

  async updatePriority(id: string, priority: TaskPriority, actor: AuthUser): Promise<TaskRecord> {
    const task = await this.findOneOrThrow(id);

    if (TERMINAL_STATUSES.includes(task.status as TaskStatus)) {
      throw new UnprocessableEntityException({
        code: 'TASK_NOT_EDITABLE',
        message: 'Cannot change priority of a completed, closed, or cancelled task',
      });
    }

    const earlyStates: TaskStatus[] = [TaskStatus.DRAFT, TaskStatus.OPEN];
    if (!earlyStates.includes(task.status as TaskStatus)) {
      if (!actor.permissions.includes('tasks.manage')) {
        throw new ForbiddenException({
          code: 'TASK_PERMISSION_DENIED',
          message: 'Changing priority after assignment requires tasks.manage',
        });
      }
    } else {
      if (task.createdByUserId !== actor.id && !actor.permissions.includes('tasks.manage')) {
        throw new ForbiddenException({
          code: 'TASK_NOT_OWN_DRAFT',
          message: 'You can only change priority on your own DRAFT/OPEN tasks',
        });
      }
    }

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.factoryTask.updateMany({
        where: { id, status: task.status },
        data: { priority },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'TASK_CONCURRENT_MODIFICATION',
          message: 'Task was modified concurrently; please retry',
        });
      }
      const updated = await tx.factoryTask.findUniqueOrThrow({ where: { id }, select: TASK_SELECT });
      await tx.factoryTaskActivity.create({
        data: {
          taskId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'TASK_PRIORITY_CHANGED',
          metadata: { previousPriority: task.priority, newPriority: priority },
        },
      });
      return this.filterTaskIncident(updated as TaskRecord, actor);
    });
  }

  // ---------------------------------------------------------------------------
  // Update due date (tasks.assign permission)
  // ---------------------------------------------------------------------------

  async updateDueDate(id: string, dueAt: string | null | undefined, actor: AuthUser): Promise<TaskRecord> {
    const task = await this.findOneOrThrow(id);

    if (TERMINAL_STATUSES.includes(task.status as TaskStatus)) {
      throw new UnprocessableEntityException({
        code: 'TASK_NOT_EDITABLE',
        message: 'Cannot change due date of a completed, closed, or cancelled task',
      });
    }

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.factoryTask.updateMany({
        where: { id, status: task.status },
        data: { dueAt: dueAt ? new Date(dueAt) : null },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'TASK_CONCURRENT_MODIFICATION',
          message: 'Task was modified concurrently; please retry',
        });
      }
      const updated = await tx.factoryTask.findUniqueOrThrow({ where: { id }, select: TASK_SELECT });
      await tx.factoryTaskActivity.create({
        data: {
          taskId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'TASK_DUE_DATE_CHANGED',
          metadata: { hasDueDate: dueAt != null },
        },
      });
      return this.filterTaskIncident(updated as TaskRecord, actor);
    });
  }

  // ---------------------------------------------------------------------------
  // Transitions
  // ---------------------------------------------------------------------------

  async open(id: string, actor: AuthUser): Promise<TaskRecord> {
    const task = await this.findOneOrThrow(id);

    if (task.status !== TaskStatus.DRAFT) {
      throw new UnprocessableEntityException({
        code: 'INVALID_TASK_TRANSITION',
        message: 'Only DRAFT tasks can be opened',
      });
    }
    if (task.createdByUserId !== actor.id && !actor.permissions.includes('tasks.manage')) {
      throw new ForbiddenException({
        code: 'TASK_PERMISSION_DENIED',
        message: 'You can only open your own tasks',
      });
    }
    if (!task.responsibleDepartmentId) {
      throw new UnprocessableEntityException({
        code: 'TASK_RESPONSIBLE_DEPT_REQUIRED',
        message: 'A responsible department must be set before opening a task',
      });
    }

    return this.transitionStatus(task, TaskStatus.OPEN, actor, {}, 'TASK_OPENED');
  }

  async assign(id: string, dto: AssignTaskDto, actor: AuthUser): Promise<TaskRecord> {
    const task = await this.findOneOrThrow(id);

    const assignableStatuses: TaskStatus[] = [
      TaskStatus.OPEN,
      TaskStatus.ASSIGNED,
      TaskStatus.IN_PROGRESS,
      TaskStatus.BLOCKED,
    ];
    if (!assignableStatuses.includes(task.status as TaskStatus)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_TASK_TRANSITION',
        message: `Assignment is only allowed when status is OPEN, ASSIGNED, IN_PROGRESS, or BLOCKED`,
      });
    }

    await this.requireActiveUser(dto.assignedToUserId, 'assignedToUserId');

    const previousAssignee = task.assignedToUserId as string | null;
    const isStatusChange = task.status === TaskStatus.OPEN;

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.factoryTask.updateMany({
        where: { id, status: task.status },
        data: {
          assignedToUserId: dto.assignedToUserId,
          ...(isStatusChange ? { status: TaskStatus.ASSIGNED } : {}),
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'TASK_CONCURRENT_MODIFICATION',
          message: 'Task was modified concurrently; please retry',
        });
      }

      const updated = await tx.factoryTask.findUniqueOrThrow({ where: { id }, select: TASK_SELECT });

      await tx.factoryTaskActivity.create({
        data: {
          taskId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'TASK_ASSIGNED',
          ...(isStatusChange ? { previousStatus: TaskStatus.OPEN, newStatus: TaskStatus.ASSIGNED } : {}),
          metadata: {
            assignedToUserId: dto.assignedToUserId,
            ...(previousAssignee ? { previousAssignedToUserId: previousAssignee } : {}),
          },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'TASK_ASSIGNED',
          userId: task.createdByUserId as string,
          actorId: actor.id,
          metadata: { taskId: id, referenceNumber: task.referenceNumber, assignedToUserId: dto.assignedToUserId },
        },
      });

      return this.filterTaskIncident(updated as TaskRecord, actor);
    });
  }

  async unassign(id: string, actor: AuthUser): Promise<TaskRecord> {
    const task = await this.findOneOrThrow(id);

    if (task.status !== TaskStatus.ASSIGNED) {
      throw new UnprocessableEntityException({
        code: 'INVALID_TASK_TRANSITION',
        message: 'Only ASSIGNED tasks can be unassigned',
      });
    }

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.factoryTask.updateMany({
        where: { id, status: TaskStatus.ASSIGNED },
        data: { status: TaskStatus.OPEN, assignedToUserId: null },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'TASK_CONCURRENT_MODIFICATION',
          message: 'Task was modified concurrently; please retry',
        });
      }

      const updated = await tx.factoryTask.findUniqueOrThrow({ where: { id }, select: TASK_SELECT });

      await tx.factoryTaskActivity.create({
        data: {
          taskId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'TASK_UNASSIGNED',
          previousStatus: TaskStatus.ASSIGNED,
          newStatus: TaskStatus.OPEN,
        },
      });

      return this.filterTaskIncident(updated as TaskRecord, actor);
    });
  }

  async start(id: string, actor: AuthUser): Promise<TaskRecord> {
    const task = await this.findOneOrThrow(id);

    if (task.status !== TaskStatus.ASSIGNED) {
      throw new UnprocessableEntityException({
        code: 'INVALID_TASK_TRANSITION',
        message: 'Only ASSIGNED tasks can be started',
      });
    }

    this.requireAssigneeOwnership(task, actor, 'start');

    const now = new Date();
    return this.transitionStatus(task, TaskStatus.IN_PROGRESS, actor, { startedAt: now }, 'TASK_STARTED');
  }

  async block(id: string, dto: BlockTaskDto, actor: AuthUser): Promise<TaskRecord> {
    const task = await this.findOneOrThrow(id);

    if (task.status !== TaskStatus.IN_PROGRESS) {
      throw new UnprocessableEntityException({
        code: 'INVALID_TASK_TRANSITION',
        message: 'Only IN_PROGRESS tasks can be blocked',
      });
    }

    this.requireAssigneeOwnership(task, actor, 'block');

    const reason = dto.blockedReason.trim();
    if (!reason) {
      throw new UnprocessableEntityException({
        code: 'TASK_BLOCK_REASON_REQUIRED',
        message: 'A blocked reason is required',
      });
    }

    const now = new Date();
    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.factoryTask.updateMany({
        where: { id, status: TaskStatus.IN_PROGRESS },
        data: {
          status: TaskStatus.BLOCKED,
          blockedReason: reason,
          blockedAt: now,
          blockedByUserId: actor.id,
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'TASK_CONCURRENT_MODIFICATION',
          message: 'Task was modified concurrently; please retry',
        });
      }

      const updated = await tx.factoryTask.findUniqueOrThrow({ where: { id }, select: TASK_SELECT });

      await tx.factoryTaskActivity.create({
        data: {
          taskId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'TASK_BLOCKED',
          previousStatus: TaskStatus.IN_PROGRESS,
          newStatus: TaskStatus.BLOCKED,
          // Do not duplicate the full blockedReason text into metadata
          metadata: { hasBlockedReason: true },
        },
      });

      return this.filterTaskIncident(updated as TaskRecord, actor);
    });
  }

  async unblock(id: string, actor: AuthUser): Promise<TaskRecord> {
    const task = await this.findOneOrThrow(id);

    if (task.status !== TaskStatus.BLOCKED) {
      throw new UnprocessableEntityException({
        code: 'INVALID_TASK_TRANSITION',
        message: 'Only BLOCKED tasks can be unblocked',
      });
    }

    this.requireAssigneeOwnership(task, actor, 'unblock');

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.factoryTask.updateMany({
        where: { id, status: TaskStatus.BLOCKED },
        data: {
          status: TaskStatus.IN_PROGRESS,
          blockedReason: null,
          blockedAt: null,
          blockedByUserId: null,
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'TASK_CONCURRENT_MODIFICATION',
          message: 'Task was modified concurrently; please retry',
        });
      }

      const updated = await tx.factoryTask.findUniqueOrThrow({ where: { id }, select: TASK_SELECT });

      await tx.factoryTaskActivity.create({
        data: {
          taskId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'TASK_UNBLOCKED',
          previousStatus: TaskStatus.BLOCKED,
          newStatus: TaskStatus.IN_PROGRESS,
        },
      });

      return this.filterTaskIncident(updated as TaskRecord, actor);
    });
  }

  async complete(id: string, dto: CompleteTaskDto, actor: AuthUser): Promise<TaskRecord> {
    const task = await this.findOneOrThrow(id);

    if (task.status !== TaskStatus.IN_PROGRESS) {
      throw new UnprocessableEntityException({
        code: 'INVALID_TASK_TRANSITION',
        message: 'Only IN_PROGRESS tasks can be completed',
      });
    }

    this.requireAssigneeOwnership(task, actor, 'complete');

    const summary = dto.completionSummary.trim();
    if (!summary) {
      throw new UnprocessableEntityException({
        code: 'TASK_COMPLETION_REQUIRED',
        message: 'A completion summary is required',
      });
    }

    const now = new Date();
    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.factoryTask.updateMany({
        where: { id, status: TaskStatus.IN_PROGRESS },
        data: {
          status: TaskStatus.COMPLETED,
          completionSummary: summary,
          completedAt: now,
          completedByUserId: actor.id,
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'TASK_CONCURRENT_MODIFICATION',
          message: 'Task was modified concurrently; please retry',
        });
      }

      const updated = await tx.factoryTask.findUniqueOrThrow({ where: { id }, select: TASK_SELECT });

      await tx.factoryTaskActivity.create({
        data: {
          taskId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'TASK_COMPLETED',
          previousStatus: TaskStatus.IN_PROGRESS,
          newStatus: TaskStatus.COMPLETED,
          // Do not duplicate completionSummary text into metadata
          metadata: { hasCompletionSummary: true },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'TASK_COMPLETED',
          userId: task.createdByUserId as string,
          actorId: actor.id,
          metadata: { taskId: id, referenceNumber: task.referenceNumber },
        },
      });

      return this.filterTaskIncident(updated as TaskRecord, actor);
    });
  }

  async close(id: string, actor: AuthUser): Promise<TaskRecord> {
    const task = await this.findOneOrThrow(id);

    if (task.status !== TaskStatus.COMPLETED) {
      throw new UnprocessableEntityException({
        code: 'INVALID_TASK_TRANSITION',
        message: 'Only COMPLETED tasks can be closed',
      });
    }

    const now = new Date();
    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.factoryTask.updateMany({
        where: { id, status: TaskStatus.COMPLETED },
        data: { status: TaskStatus.CLOSED, closedAt: now, closedByUserId: actor.id },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'TASK_CONCURRENT_MODIFICATION',
          message: 'Task was modified concurrently; please retry',
        });
      }

      const updated = await tx.factoryTask.findUniqueOrThrow({ where: { id }, select: TASK_SELECT });

      await tx.factoryTaskActivity.create({
        data: {
          taskId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'TASK_CLOSED',
          previousStatus: TaskStatus.COMPLETED,
          newStatus: TaskStatus.CLOSED,
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'TASK_CLOSED',
          userId: task.createdByUserId as string,
          actorId: actor.id,
          metadata: { taskId: id, referenceNumber: task.referenceNumber },
        },
      });

      return this.filterTaskIncident(updated as TaskRecord, actor);
    });
  }

  async reopen(id: string, dto: ReopenTaskDto, actor: AuthUser): Promise<TaskRecord> {
    const task = await this.findOneOrThrow(id);

    const reopenableStatuses: TaskStatus[] = [TaskStatus.COMPLETED, TaskStatus.CLOSED];
    if (!reopenableStatuses.includes(task.status as TaskStatus)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_TASK_TRANSITION',
        message: 'Only COMPLETED or CLOSED tasks can be reopened',
      });
    }

    const reason = dto.reason.trim();
    if (!reason) {
      throw new UnprocessableEntityException({
        code: 'TASK_REOPEN_REASON_REQUIRED',
        message: 'A non-empty reason is required to reopen a task',
      });
    }

    const previousStatus = task.status as TaskStatus;

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.factoryTask.updateMany({
        where: { id, status: task.status },
        data: {
          status: TaskStatus.IN_PROGRESS,
          // Clear lifecycle timestamps; preserve historical text (completionSummary, blockedReason)
          completedAt: null,
          completedByUserId: null,
          closedAt: null,
          closedByUserId: null,
        },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'TASK_CONCURRENT_MODIFICATION',
          message: 'Task was modified concurrently; please retry',
        });
      }

      const updated = await tx.factoryTask.findUniqueOrThrow({ where: { id }, select: TASK_SELECT });

      await tx.factoryTaskActivity.create({
        data: {
          taskId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'TASK_REOPENED',
          previousStatus,
          newStatus: TaskStatus.IN_PROGRESS,
          metadata: { reason, previousStatus },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'TASK_REOPENED',
          userId: task.createdByUserId as string,
          actorId: actor.id,
          metadata: { taskId: id, referenceNumber: task.referenceNumber, previousStatus, reason },
        },
      });

      return this.filterTaskIncident(updated as TaskRecord, actor);
    });
  }

  async cancel(id: string, dto: CancelTaskDto, actor: AuthUser): Promise<TaskRecord> {
    const task = await this.findOneOrThrow(id);

    if (TERMINAL_STATUSES.includes(task.status as TaskStatus)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_TASK_TRANSITION',
        message: `Cannot cancel a task with status ${task.status}`,
      });
    }

    // Creator can cancel own DRAFT with tasks.create; manage required for others' tasks
    const isOwnDraft =
      task.createdByUserId === actor.id && task.status === TaskStatus.DRAFT;

    if (!isOwnDraft && !actor.permissions.includes('tasks.manage')) {
      // Creator can also cancel their own OPEN task
      const isOwnOpen = task.createdByUserId === actor.id && task.status === TaskStatus.OPEN;
      if (!isOwnOpen) {
        throw new ForbiddenException({
          code: 'TASK_PERMISSION_DENIED',
          message: 'Cancelling a task in progress requires tasks.manage',
        });
      }
    }

    // All cancellations require a reason (1–1000 chars per requirement)
    const reason = dto.reason.trim();
    if (!reason) {
      throw new UnprocessableEntityException({
        code: 'TASK_CANCEL_REASON_REQUIRED',
        message: 'A reason is required to cancel a task',
      });
    }

    const previousStatus = task.status as TaskStatus;

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.factoryTask.updateMany({
        where: { id, status: task.status },
        data: { status: TaskStatus.CANCELLED },
      });
      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'TASK_CONCURRENT_MODIFICATION',
          message: 'Task was modified concurrently; please retry',
        });
      }

      const updated = await tx.factoryTask.findUniqueOrThrow({ where: { id }, select: TASK_SELECT });

      await tx.factoryTaskActivity.create({
        data: {
          taskId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'TASK_CANCELLED',
          previousStatus,
          newStatus: TaskStatus.CANCELLED,
          metadata: { reason },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'TASK_CANCELLED',
          userId: task.createdByUserId as string,
          actorId: actor.id,
          metadata: { taskId: id, referenceNumber: task.referenceNumber, previousStatus, reason },
        },
      });

      return this.filterTaskIncident(updated as TaskRecord, actor);
    });
  }

  // ---------------------------------------------------------------------------
  // Progress updates
  // ---------------------------------------------------------------------------

  async addProgress(id: string, dto: AddProgressDto, actor: AuthUser): Promise<unknown> {
    const task = await this.findOneOrThrow(id);

    const progressAllowedStatuses: TaskStatus[] = [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED];
    if (!progressAllowedStatuses.includes(task.status as TaskStatus)) {
      throw new UnprocessableEntityException({
        code: 'TASK_PROGRESS_INVALID_STATE',
        message: 'Progress updates can only be added when task is IN_PROGRESS or BLOCKED',
      });
    }

    this.requireAssigneeOwnership(task, actor, 'update_progress');

    const note = dto.note.trim();
    if (!note) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'Progress note cannot be empty',
      });
    }

    return this.db.getClient().$transaction(async (tx) => {
      const progress = await tx.factoryTaskProgress.create({
        data: {
          taskId: id,
          authorUserId: actor.id,
          authorName: actor.displayName,
          ...(dto.progressPercent !== undefined ? { progressPercent: dto.progressPercent } : {}),
          note,
        },
        select: {
          id: true,
          taskId: true,
          authorUserId: true,
          authorName: true,
          progressPercent: true,
          note: true,
          createdAt: true,
        },
      });

      await tx.factoryTaskActivity.create({
        data: {
          taskId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'TASK_PROGRESS_UPDATED',
          // Do not duplicate the note text into metadata
          metadata: { hasPercent: dto.progressPercent !== undefined },
        },
      });

      return progress;
    });
  }

  async listProgress(taskId: string): Promise<unknown[]> {
    await this.findOneOrThrow(taskId);
    return this.db.getClient().factoryTaskProgress.findMany({
      where: { taskId },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        taskId: true,
        authorUserId: true,
        authorName: true,
        progressPercent: true,
        note: true,
        createdAt: true,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------------

  async addComment(taskId: string, dto: AddCommentDto, actor: AuthUser): Promise<unknown> {
    await this.findOneOrThrow(taskId);

    const body = dto.body.trim();
    if (!body) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'Comment body cannot be empty',
      });
    }

    return this.db.getClient().$transaction(async (tx) => {
      const comment = await tx.factoryTaskComment.create({
        data: { taskId, authorUserId: actor.id, body },
        select: {
          id: true,
          taskId: true,
          body: true,
          createdAt: true,
          authorUser: { select: { id: true, displayName: true, username: true } },
        },
      });

      await tx.factoryTaskActivity.create({
        data: {
          taskId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'COMMENT_ADDED',
        },
      });

      return comment;
    });
  }

  async listComments(taskId: string): Promise<unknown[]> {
    await this.findOneOrThrow(taskId);
    return this.db.getClient().factoryTaskComment.findMany({
      where: { taskId },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        taskId: true,
        body: true,
        createdAt: true,
        authorUser: { select: { id: true, displayName: true, username: true } },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Activities
  // ---------------------------------------------------------------------------

  async listActivities(taskId: string): Promise<unknown[]> {
    await this.findOneOrThrow(taskId);
    return this.db.getClient().factoryTaskActivity.findMany({
      where: { taskId },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  // ---------------------------------------------------------------------------
  // Find / List / Summary
  // ---------------------------------------------------------------------------

  async findAll(query: TaskListQueryDto, actor: AuthUser): Promise<PaginatedResult<TaskRecord>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = buildListWhere(query, actor);

    const [items, total] = await Promise.all([
      this.db.getClient().factoryTask.findMany({
        where,
        select: TASK_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.db.getClient().factoryTask.count({ where }),
    ]);

    return {
      items: (items as TaskRecord[]).map((t) => this.filterTaskIncident(t, actor)),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string, actor: AuthUser): Promise<TaskRecord> {
    const task = await this.findOneOrThrow(id);
    return this.filterTaskIncident(task, actor);
  }

  async findMy(query: TaskListQueryDto, actor: AuthUser): Promise<PaginatedResult<TaskRecord>> {
    const myQuery = { ...query, assignedToUserId: actor.id };
    const page = myQuery.page ?? 1;
    const pageSize = myQuery.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = buildListWhere(myQuery, actor);

    const [items, total] = await Promise.all([
      this.db.getClient().factoryTask.findMany({
        where,
        select: TASK_SELECT,
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.db.getClient().factoryTask.count({ where }),
    ]);

    return {
      items: (items as TaskRecord[]).map((t) => this.filterTaskIncident(t, actor)),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async getSummary(actor: AuthUser): Promise<{
    openTasks: number;
    assignedToMe: number;
    overdueTasks: number;
    blockedTasks: number;
    completedThisMonth: number;
  }> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const [openTasks, assignedToMe, overdueTasks, blockedTasks, completedThisMonth] = await Promise.all([
      this.db.getClient().factoryTask.count({ where: { status: { in: ACTIVE_STATUSES } } }),
      this.db.getClient().factoryTask.count({
        where: { assignedToUserId: actor.id, status: { in: ACTIVE_STATUSES } },
      }),
      this.db.getClient().factoryTask.count({
        where: {
          status: { in: OVERDUE_STATUSES },
          dueAt: { lt: now },
        },
      }),
      this.db.getClient().factoryTask.count({ where: { status: TaskStatus.BLOCKED } }),
      this.db.getClient().factoryTask.count({
        where: {
          status: { in: [TaskStatus.COMPLETED, TaskStatus.CLOSED] },
          completedAt: { gte: monthStart, lt: monthEnd },
        },
      }),
    ]);

    return { openTasks, assignedToMe, overdueTasks, blockedTasks, completedThisMonth };
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

  private async findOneOrThrow(id: string): Promise<TaskRecord> {
    const task = await this.db.getClient().factoryTask.findUnique({
      where: { id },
      select: TASK_SELECT,
    });
    if (!task) {
      throw new NotFoundException({ code: 'TASK_NOT_FOUND', message: 'Task not found' });
    }
    return task as TaskRecord;
  }

  /**
   * Strip incident relation from task response when caller lacks incidents.read.
   * Prevents information disclosure: referenceNumber and title must not reach
   * unauthorized callers even though the task row stores the incidentId FK.
   */
  private filterTaskIncident(task: TaskRecord, actor: AuthUser): TaskRecord {
    if (actor.permissions.includes('incidents.read')) {
      return task;
    }
    return { ...task, incident: null } as TaskRecord;
  }

  private requireAssigneeOwnership(task: TaskRecord, actor: AuthUser, action: string): void {
    if (task.assignedToUserId !== actor.id && !actor.permissions.includes('tasks.manage')) {
      throw new ForbiddenException({
        code: 'TASK_NOT_ASSIGNEE',
        message: `Only the assigned user can ${action} this task`,
      });
    }
  }

  private async transitionStatus(
    task: TaskRecord,
    newStatus: TaskStatus,
    actor: AuthUser,
    extraData: Record<string, unknown>,
    eventName: string,
  ): Promise<TaskRecord> {
    const previousStatus = task.status as TaskStatus;

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.factoryTask.updateMany({
        where: { id: task.id as string, status: previousStatus },
        data: { status: newStatus, ...extraData },
      });

      if (result.count === 0) {
        throw new UnprocessableEntityException({
          code: 'TASK_CONCURRENT_MODIFICATION',
          message: 'Task was modified concurrently; please retry',
        });
      }

      const updated = await tx.factoryTask.findUniqueOrThrow({
        where: { id: task.id as string },
        select: TASK_SELECT,
      });

      await tx.factoryTaskActivity.create({
        data: {
          taskId: task.id as string,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: eventName,
          previousStatus,
          newStatus,
        },
      });

      return this.filterTaskIncident(updated as TaskRecord, actor);
    });
  }

  private async requireActiveUser(userId: string, field: string): Promise<void> {
    const user = await this.db.getClient().user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new UnprocessableEntityException({
        code: 'TASK_ASSIGNMENT_INVALID',
        message: `${field}: user does not exist or is inactive`,
      });
    }
  }

  private async requireIncidentExists(incidentId: string): Promise<void> {
    const incident = await this.db.getClient().incident.findUnique({
      where: { id: incidentId },
      select: { id: true },
    });
    if (!incident) {
      throw new NotFoundException({
        code: 'TASK_INCIDENT_NOT_FOUND',
        message: 'The specified incident does not exist',
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
        code: 'TASK_LOCATION_INVALID',
        message: 'The specified location does not exist',
      });
    }

    if (plantId && location.plantId && location.plantId !== plantId) {
      throw new UnprocessableEntityException({
        code: 'TASK_LOCATION_INVALID',
        message: 'The specified location does not belong to the specified plant',
      });
    }

    // Derive plantId from location if not provided
    const resolvedPlantId = plantId ?? location.plantId ?? null;
    return { resolvedPlantId, resolvedLocationId: locationId };
  }
}

function buildListWhere(
  query: TaskListQueryDto,
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

  if (query.responsibleDepartmentId) where['responsibleDepartmentId'] = query.responsibleDepartmentId;
  if (query.requestingDepartmentId) where['requestingDepartmentId'] = query.requestingDepartmentId;
  if (query.plantId) where['plantId'] = query.plantId;
  if (query.locationId) where['locationId'] = query.locationId;
  if (query.incidentId) where['incidentId'] = query.incidentId;

  if (query.dueFrom || query.dueTo) {
    const dueAt: Record<string, Date> = {};
    if (query.dueFrom) dueAt['gte'] = new Date(query.dueFrom);
    if (query.dueTo) dueAt['lte'] = new Date(query.dueTo);
    where['dueAt'] = dueAt;
  }

  if (query.overdue) {
    // Overdue: past due date, non-terminal, not DRAFT
    where['status'] = { in: [TaskStatus.OPEN, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] };
    where['dueAt'] = { lt: new Date() };
  }

  if (query.search?.trim()) {
    where['OR'] = [
      { title: { contains: query.search.trim(), mode: 'insensitive' } },
      { referenceNumber: { contains: query.search.trim(), mode: 'insensitive' } },
    ];
  }

  return where;
}
