import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { TaskStatus, TaskPriority, DepartmentAccessScope } from '@recafco/database';
import { FactoryTasksService } from './factory-tasks.service';
import type { DatabaseService } from '../database/database.service';
import type { TasksRefService } from './tasks-ref.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';

// ---------------------------------------------------------------------------
// Mock infrastructure
// ---------------------------------------------------------------------------

const mockTxFindUnique = vi.fn();
const mockTxFindUniqueOrThrow = vi.fn();
const mockTxUpdateMany = vi.fn();
const mockTxCreate = vi.fn();
const mockTxActivityCreate = vi.fn();
const mockTxProgressCreate = vi.fn();
const mockTxCommentCreate = vi.fn();
const mockTxAuditCreate = vi.fn();

const mockTx = {
  factoryTask: {
    findUnique: mockTxFindUnique,
    findUniqueOrThrow: mockTxFindUniqueOrThrow,
    updateMany: mockTxUpdateMany,
    create: mockTxCreate,
  },
  factoryTaskActivity: { create: mockTxActivityCreate },
  factoryTaskProgress: { create: mockTxProgressCreate },
  factoryTaskComment: { create: mockTxCommentCreate },
  securityAuditEvent: { create: mockTxAuditCreate },
};

const mockFactoryTaskFindUnique = vi.fn();
const mockFactoryTaskFindMany = vi.fn();
const mockFactoryTaskCount = vi.fn();
const mockUserFindUnique = vi.fn();
const mockIncidentFindUnique = vi.fn();
const mockLocationFindUnique = vi.fn();
const mockDepartmentFindMany = vi.fn();
const mockGetScope = vi.fn();
const mockTransaction = vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

const mockClient = {
  factoryTask: {
    findUnique: mockFactoryTaskFindUnique,
    findMany: mockFactoryTaskFindMany,
    count: mockFactoryTaskCount,
  },
  user: { findUnique: mockUserFindUnique },
  incident: { findUnique: mockIncidentFindUnique },
  location: { findUnique: mockLocationFindUnique },
  department: { findMany: mockDepartmentFindMany },
  $transaction: mockTransaction,
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockRef = {
  nextRef: vi.fn().mockResolvedValue('TASK-2026-000001'),
} as unknown as TasksRefService;

const mockDeptAccess = {
  buildDeptFilter: vi.fn().mockResolvedValue(null),
  getScope: mockGetScope,
  canAccessDepartment: vi.fn().mockResolvedValue(true),
  assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined),
  canGrantScope: vi.fn().mockReturnValue(true),
  getUserModuleAccessConfig: vi.fn(),
  setUserModuleAccess: vi.fn(),
} as unknown as DepartmentAccessService;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR_NO_MANAGE: AuthUser = {
  id: 'user-actor-1',
  username: 'alice',
  displayName: 'Alice',
  roleId: 'role-1',
  roleCode: 'OPERATOR',
  roleName: 'Operator',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-1',
  departmentId: null,
  permissions: ['tasks.create', 'tasks.read', 'tasks.start', 'tasks.block', 'tasks.complete', 'tasks.update_progress', 'tasks.comment'],
};

// Actor with tasks.manage but without incidents.read
const ACTOR_MANAGE: AuthUser = {
  id: 'user-manager-1',
  username: 'bob',
  displayName: 'Bob',
  roleId: 'role-2',
  roleCode: 'SUPERVISOR',
  roleName: 'Supervisor',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-2',
  departmentId: null,
  permissions: ['tasks.manage', 'tasks.create', 'tasks.read', 'tasks.assign', 'tasks.start', 'tasks.block', 'tasks.complete', 'tasks.close', 'tasks.update_progress', 'tasks.comment'],
};

// Actor with incidents.read (and tasks.create) — used for incident-link authorization tests
const ACTOR_WITH_INCIDENTS: AuthUser = {
  id: 'user-admin-1',
  username: 'carol',
  displayName: 'Carol',
  roleId: 'role-3',
  roleCode: 'ADMIN',
  roleName: 'Admin',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-3',
  departmentId: null,
  permissions: ['tasks.create', 'tasks.read', 'tasks.manage', 'tasks.assign', 'incidents.read'],
};

function makeTask(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'task-id-1',
    referenceNumber: 'TASK-2026-000001',
    title: 'Test Task',
    description: null,
    priority: TaskPriority.MEDIUM,
    status: TaskStatus.DRAFT,
    createdByUserId: 'user-actor-1',
    requestedByUserId: 'user-actor-1',
    assignedToUserId: null,
    responsibleDepartmentId: 'dept-1',
    requestingDepartmentId: null,
    plantId: null,
    locationId: null,
    incidentId: null,
    dueAt: null,
    startedAt: null,
    completedAt: null,
    completedByUserId: null,
    closedAt: null,
    closedByUserId: null,
    blockedAt: null,
    blockedByUserId: null,
    blockedReason: null,
    completionSummary: null,
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
    createdByUser: { id: 'user-actor-1', displayName: 'Alice', username: 'alice' },
    requestedByUser: { id: 'user-actor-1', displayName: 'Alice', username: 'alice' },
    assignedToUser: null,
    responsibleDepartment: { id: 'dept-1', code: 'OPS', name: 'Operations' },
    requestingDepartment: null,
    plant: null,
    location: null,
    incident: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FactoryTasksService', () => {
  let service: FactoryTasksService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (cb) => cb(mockTx));
    service = new FactoryTasksService(mockDb, mockRef, mockDeptAccess);
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a DRAFT task and sets createdByUserId from actor', async () => {
      mockUserFindUnique.mockResolvedValue(null); // not called for own user
      mockIncidentFindUnique.mockResolvedValue(null); // no incident
      mockLocationFindUnique.mockResolvedValue(null); // no location
      const task = makeTask();
      mockTxCreate.mockResolvedValue(task);
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      const result = await service.create({ title: 'Test Task' }, ACTOR_NO_MANAGE);

      expect(result).toBeDefined();
      expect(mockTxCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          createdByUserId: 'user-actor-1',
          requestedByUserId: 'user-actor-1',
        }),
      }));
    });

    it('prevents impersonation of requestedByUserId without tasks.manage', async () => {
      await expect(
        service.create({ title: 'T', requestedByUserId: 'other-user-id' }, ACTOR_NO_MANAGE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows tasks.manage to set requestedByUserId to another active user', async () => {
      mockUserFindUnique.mockResolvedValue({ id: 'other-user-id', isActive: true });
      mockLocationFindUnique.mockResolvedValue(null);
      const task = makeTask({ requestedByUserId: 'other-user-id' });
      mockTxCreate.mockResolvedValue(task);
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      await service.create({ title: 'T', requestedByUserId: 'other-user-id' }, ACTOR_MANAGE);
      expect(mockTxCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ requestedByUserId: 'other-user-id' }),
      }));
    });

    it('throws TASK_ASSIGNMENT_INVALID when requestedBy user is inactive', async () => {
      mockUserFindUnique.mockResolvedValue({ id: 'other-user-id', isActive: false });
      await expect(
        service.create({ title: 'T', requestedByUserId: 'other-user-id' }, ACTOR_MANAGE),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws TASK_INCIDENT_PERMISSION_DENIED when incidentId is present but actor lacks incidents.read', async () => {
      // Permission check fires before any DB lookup — mockIncidentFindUnique must not be called
      await expect(
        service.create({ title: 'T', incidentId: 'some-incident-id' }, ACTOR_NO_MANAGE),
      ).rejects.toThrow(ForbiddenException);
      expect(mockIncidentFindUnique).not.toHaveBeenCalled();
    });

    it('throws TASK_INCIDENT_NOT_FOUND for authorized caller when incidentId does not exist', async () => {
      mockIncidentFindUnique.mockResolvedValue(null);
      mockLocationFindUnique.mockResolvedValue(null);
      await expect(
        service.create({ title: 'T', incidentId: 'bad-incident-id' }, ACTOR_WITH_INCIDENTS),
      ).rejects.toThrow(NotFoundException);
    });

    it('links incident when actor has incidents.read and incident exists', async () => {
      mockIncidentFindUnique.mockResolvedValue({ id: 'incident-1' });
      mockLocationFindUnique.mockResolvedValue(null);
      const taskWithIncident = makeTask({
        incidentId: 'incident-1',
        incident: { id: 'incident-1', referenceNumber: 'INC-2026-000001', title: 'Incident A' },
      });
      mockTxCreate.mockResolvedValue(taskWithIncident);
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      const result = await service.create({ title: 'T', incidentId: 'incident-1' }, ACTOR_WITH_INCIDENTS);
      expect(mockTxCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ incidentId: 'incident-1' }),
      }));
      // Authorized caller receives incident metadata
      expect((result as Record<string, unknown>)['incident']).not.toBeNull();
    });
  });

  // ── open ────────────────────────────────────────────────────────────────────

  describe('open', () => {
    it('throws INVALID_TASK_TRANSITION when task is not DRAFT', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(makeTask({ status: TaskStatus.OPEN }));
      await expect(service.open('task-id-1', ACTOR_NO_MANAGE)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('throws TASK_RESPONSIBLE_DEPT_REQUIRED when responsibleDepartmentId is missing', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(
        makeTask({ responsibleDepartmentId: null }),
      );
      await expect(service.open('task-id-1', ACTOR_NO_MANAGE)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('opens the task when DRAFT and responsible dept is set', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(makeTask());
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(makeTask({ status: TaskStatus.OPEN }));
      mockTxActivityCreate.mockResolvedValue({});

      const result = await service.open('task-id-1', ACTOR_NO_MANAGE);
      expect((result as Record<string, unknown>)['status']).toBe(TaskStatus.OPEN);
    });

    it('throws TASK_PERMISSION_DENIED when actor is not creator and lacks tasks.manage', async () => {
      const otherActor: AuthUser = { ...ACTOR_NO_MANAGE, id: 'other-user-999' };
      mockFactoryTaskFindUnique.mockResolvedValue(makeTask());
      await expect(service.open('task-id-1', otherActor)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── assign ───────────────────────────────────────────────────────────────────

  describe('assign', () => {
    it('transitions OPEN → ASSIGNED when assigning from OPEN', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(makeTask({ status: TaskStatus.OPEN }));
      mockUserFindUnique.mockResolvedValue({ id: 'assignee-1', isActive: true });
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(
        makeTask({ status: TaskStatus.ASSIGNED, assignedToUserId: 'assignee-1' }),
      );
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      const result = await service.assign('task-id-1', { assignedToUserId: 'assignee-1' }, ACTOR_MANAGE);
      expect((result as Record<string, unknown>)['status']).toBe(TaskStatus.ASSIGNED);
    });

    it('preserves status when reassigning from ASSIGNED', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.ASSIGNED, assignedToUserId: 'old-assignee' }),
      );
      mockUserFindUnique.mockResolvedValue({ id: 'new-assignee', isActive: true });
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(
        makeTask({ status: TaskStatus.ASSIGNED, assignedToUserId: 'new-assignee' }),
      );
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      const result = await service.assign('task-id-1', { assignedToUserId: 'new-assignee' }, ACTOR_MANAGE);
      // Status stays ASSIGNED (not changed to IN_PROGRESS)
      expect((result as Record<string, unknown>)['status']).toBe(TaskStatus.ASSIGNED);
    });

    it('preserves status when reassigning from IN_PROGRESS', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.IN_PROGRESS, assignedToUserId: 'old-assignee' }),
      );
      mockUserFindUnique.mockResolvedValue({ id: 'new-assignee', isActive: true });
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(
        makeTask({ status: TaskStatus.IN_PROGRESS, assignedToUserId: 'new-assignee' }),
      );
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      const result = await service.assign('task-id-1', { assignedToUserId: 'new-assignee' }, ACTOR_MANAGE);
      expect((result as Record<string, unknown>)['status']).toBe(TaskStatus.IN_PROGRESS);
    });

    it('throws INVALID_TASK_TRANSITION when assigning from DRAFT', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(makeTask({ status: TaskStatus.DRAFT }));
      await expect(
        service.assign('task-id-1', { assignedToUserId: 'assignee-1' }, ACTOR_MANAGE),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ── unassign ─────────────────────────────────────────────────────────────────

  describe('unassign', () => {
    it('unassigns ASSIGNED task to OPEN', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.ASSIGNED, assignedToUserId: 'assignee-1' }),
      );
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(makeTask({ status: TaskStatus.OPEN, assignedToUserId: null }));
      mockTxActivityCreate.mockResolvedValue({});

      const result = await service.unassign('task-id-1', ACTOR_MANAGE);
      expect((result as Record<string, unknown>)['status']).toBe(TaskStatus.OPEN);
      expect((result as Record<string, unknown>)['assignedToUserId']).toBeNull();
    });

    it('throws when task is not ASSIGNED', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(makeTask({ status: TaskStatus.IN_PROGRESS }));
      await expect(service.unassign('task-id-1', ACTOR_MANAGE)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  // ── start ────────────────────────────────────────────────────────────────────

  describe('start', () => {
    it('throws TASK_NOT_ASSIGNEE when actor is not assignee and lacks tasks.manage', async () => {
      const otherActor: AuthUser = { ...ACTOR_NO_MANAGE, id: 'not-the-assignee' };
      mockFactoryTaskFindUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.ASSIGNED, assignedToUserId: 'actual-assignee' }),
      );
      await expect(service.start('task-id-1', otherActor)).rejects.toThrow(ForbiddenException);
    });

    it('starts task when actor is the assignee', async () => {
      const assigneeActor: AuthUser = { ...ACTOR_NO_MANAGE, id: 'actual-assignee' };
      mockFactoryTaskFindUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.ASSIGNED, assignedToUserId: 'actual-assignee' }),
      );
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(
        makeTask({ status: TaskStatus.IN_PROGRESS, assignedToUserId: 'actual-assignee' }),
      );
      mockTxActivityCreate.mockResolvedValue({});

      const result = await service.start('task-id-1', assigneeActor);
      expect((result as Record<string, unknown>)['status']).toBe(TaskStatus.IN_PROGRESS);
    });

    it('allows tasks.manage to start even if not assignee', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.ASSIGNED, assignedToUserId: 'actual-assignee' }),
      );
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(
        makeTask({ status: TaskStatus.IN_PROGRESS, assignedToUserId: 'actual-assignee' }),
      );
      mockTxActivityCreate.mockResolvedValue({});

      await service.start('task-id-1', ACTOR_MANAGE);
      // should not throw
    });
  });

  // ── block ────────────────────────────────────────────────────────────────────

  describe('block', () => {
    it('throws when actor is not assignee and lacks tasks.manage', async () => {
      const other: AuthUser = { ...ACTOR_NO_MANAGE, id: 'not-assignee' };
      mockFactoryTaskFindUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.IN_PROGRESS, assignedToUserId: 'assignee-1' }),
      );
      await expect(
        service.block('task-id-1', { blockedReason: 'waiting on parts' }, other),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks the task with reason and sets metadata.hasBlockedReason', async () => {
      const assignee: AuthUser = { ...ACTOR_NO_MANAGE, id: 'assignee-1' };
      mockFactoryTaskFindUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.IN_PROGRESS, assignedToUserId: 'assignee-1' }),
      );
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(
        makeTask({ status: TaskStatus.BLOCKED, blockedReason: 'waiting on parts' }),
      );
      mockTxActivityCreate.mockResolvedValue({});

      await service.block('task-id-1', { blockedReason: 'waiting on parts' }, assignee);

      const activityCall = mockTxActivityCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
      expect(activityCall?.data?.['metadata']).toEqual({ hasBlockedReason: true });
    });
  });

  // ── complete ─────────────────────────────────────────────────────────────────

  describe('complete', () => {
    it('requires completionSummary (non-empty)', async () => {
      const assignee: AuthUser = { ...ACTOR_NO_MANAGE, id: 'assignee-1' };
      mockFactoryTaskFindUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.IN_PROGRESS, assignedToUserId: 'assignee-1' }),
      );
      await expect(
        service.complete('task-id-1', { completionSummary: '   ' }, assignee),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('completes task and does not put completionSummary in activity metadata', async () => {
      const assignee: AuthUser = { ...ACTOR_NO_MANAGE, id: 'assignee-1' };
      mockFactoryTaskFindUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.IN_PROGRESS, assignedToUserId: 'assignee-1' }),
      );
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(
        makeTask({ status: TaskStatus.COMPLETED }),
      );
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      await service.complete('task-id-1', { completionSummary: 'Done everything.' }, assignee);

      const activityCall = mockTxActivityCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
      const metadata = activityCall?.data?.['metadata'] as Record<string, unknown>;
      expect(metadata['hasCompletionSummary']).toBe(true);
      expect(metadata).not.toHaveProperty('completionSummary');
    });
  });

  // ── reopen ───────────────────────────────────────────────────────────────────

  describe('reopen', () => {
    it('requires a reason', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(makeTask({ status: TaskStatus.COMPLETED }));
      await expect(
        service.reopen('task-id-1', { reason: '  ' }, ACTOR_MANAGE),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('clears lifecycle timestamps but preserves completionSummary text', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(
        makeTask({
          status: TaskStatus.COMPLETED,
          completedAt: new Date('2026-06-30'),
          completedByUserId: 'assignee-1',
          completionSummary: 'Previous completion notes',
        }),
      );
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(
        makeTask({
          status: TaskStatus.IN_PROGRESS,
          completedAt: null,
          completedByUserId: null,
          completionSummary: 'Previous completion notes', // text preserved
        }),
      );
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      await service.reopen('task-id-1', { reason: 'Work not fully done' }, ACTOR_MANAGE);

      // The updateMany call should clear timestamps but not touch completionSummary
      const updateCall = mockTxUpdateMany.mock.calls[0]?.[0] as { data: Record<string, unknown> };
      expect(updateCall?.data?.['completedAt']).toBeNull();
      expect(updateCall?.data?.['completedByUserId']).toBeNull();
      expect(updateCall?.data?.['closedAt']).toBeNull();
      expect(updateCall?.data?.['closedByUserId']).toBeNull();
      expect(updateCall?.data).not.toHaveProperty('completionSummary');
    });

    it('throws INVALID_TASK_TRANSITION when task is OPEN', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(makeTask({ status: TaskStatus.OPEN }));
      await expect(
        service.reopen('task-id-1', { reason: 'reopen' }, ACTOR_MANAGE),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ── cancel ───────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('requires reason always (even for DRAFT by creator)', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(makeTask());
      await expect(
        service.cancel('task-id-1', { reason: '' }, ACTOR_NO_MANAGE),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('allows creator to cancel own DRAFT with reason', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(makeTask());
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(makeTask({ status: TaskStatus.CANCELLED }));
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      await service.cancel('task-id-1', { reason: 'Task is no longer needed' }, ACTOR_NO_MANAGE);
    });

    it('throws TASK_PERMISSION_DENIED when non-creator tries to cancel ASSIGNED without tasks.manage', async () => {
      const other: AuthUser = { ...ACTOR_NO_MANAGE, id: 'not-creator' };
      mockFactoryTaskFindUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.ASSIGNED, assignedToUserId: 'some-assignee' }),
      );
      await expect(
        service.cancel('task-id-1', { reason: 'cancel' }, other),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws when task is already CANCELLED', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(makeTask({ status: TaskStatus.CANCELLED }));
      await expect(
        service.cancel('task-id-1', { reason: 'reason' }, ACTOR_MANAGE),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ── addProgress ──────────────────────────────────────────────────────────────

  describe('addProgress', () => {
    it('throws TASK_PROGRESS_INVALID_STATE when task is not IN_PROGRESS or BLOCKED', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(makeTask({ status: TaskStatus.ASSIGNED, assignedToUserId: 'user-actor-1' }));
      await expect(
        service.addProgress('task-id-1', { note: 'some progress' }, ACTOR_NO_MANAGE),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws TASK_NOT_ASSIGNEE when actor is not assignee and lacks tasks.manage', async () => {
      const other: AuthUser = { ...ACTOR_NO_MANAGE, id: 'not-assignee' };
      mockFactoryTaskFindUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.IN_PROGRESS, assignedToUserId: 'assignee-1' }),
      );
      await expect(
        service.addProgress('task-id-1', { note: 'progress note' }, other),
      ).rejects.toThrow(ForbiddenException);
    });

    it('does not duplicate note text into activity metadata', async () => {
      const assignee: AuthUser = { ...ACTOR_NO_MANAGE, id: 'assignee-1' };
      mockFactoryTaskFindUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.IN_PROGRESS, assignedToUserId: 'assignee-1' }),
      );
      const progressRecord = { id: 'prog-1', taskId: 'task-id-1', note: 'some progress', progressPercent: 50 };
      mockTxProgressCreate.mockResolvedValue(progressRecord);
      mockTxActivityCreate.mockResolvedValue({});

      await service.addProgress('task-id-1', { note: 'some progress', progressPercent: 50 }, assignee);

      const activityCall = mockTxActivityCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
      const metadata = activityCall?.data?.['metadata'] as Record<string, unknown>;
      expect(metadata).not.toHaveProperty('note');
      expect(metadata['hasPercent']).toBe(true);
    });
  });

  // ── concurrency ──────────────────────────────────────────────────────────────

  describe('concurrency', () => {
    it('throws TASK_CONCURRENT_MODIFICATION when updateMany returns count=0', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(makeTask());
      mockTxUpdateMany.mockResolvedValue({ count: 0 });

      await expect(service.open('task-id-1', ACTOR_NO_MANAGE)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  // ── updatePriority ───────────────────────────────────────────────────────────

  describe('updatePriority', () => {
    it('allows creator to change priority on own DRAFT', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(makeTask());
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(makeTask({ priority: TaskPriority.HIGH }));
      mockTxActivityCreate.mockResolvedValue({});

      const result = await service.updatePriority('task-id-1', TaskPriority.HIGH, ACTOR_NO_MANAGE);
      expect((result as Record<string, unknown>)['priority']).toBe(TaskPriority.HIGH);
    });

    it('requires tasks.manage to change priority of IN_PROGRESS task', async () => {
      const other: AuthUser = { ...ACTOR_NO_MANAGE, id: 'non-manager' };
      mockFactoryTaskFindUnique.mockResolvedValue(
        makeTask({ status: TaskStatus.IN_PROGRESS, assignedToUserId: 'other' }),
      );
      await expect(
        service.updatePriority('task-id-1', TaskPriority.URGENT, other),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws on COMPLETED tasks (terminal)', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(makeTask({ status: TaskStatus.COMPLETED }));
      await expect(
        service.updatePriority('task-id-1', TaskPriority.HIGH, ACTOR_MANAGE),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ── getSummary ───────────────────────────────────────────────────────────────

  describe('getSummary', () => {
    it('returns correct field names with UTC month boundaries applied', async () => {
      mockFactoryTaskCount
        .mockResolvedValueOnce(5)  // openTasks
        .mockResolvedValueOnce(2)  // assignedToMe
        .mockResolvedValueOnce(1)  // overdueTasks
        .mockResolvedValueOnce(0)  // blockedTasks
        .mockResolvedValueOnce(3); // completedThisMonth

      const result = await service.getSummary(ACTOR_NO_MANAGE);

      expect(result.openTasks).toBe(5);
      expect(result.assignedToMe).toBe(2);
      expect(result.overdueTasks).toBe(1);
      expect(result.blockedTasks).toBe(0);
      expect(result.completedThisMonth).toBe(3);

      // Verify UTC month boundary is used for completedThisMonth query
      const countCalls = mockFactoryTaskCount.mock.calls;
      const completedCall = countCalls[4]?.[0] as { where: { completedAt: { gte: Date; lt: Date } } };
      const gte = completedCall?.where?.completedAt?.gte;
      const lt = completedCall?.where?.completedAt?.lt;
      expect(gte).toBeInstanceOf(Date);
      expect(lt).toBeInstanceOf(Date);
      // gte should be the first of the current month (UTC day 1, hour 0, minute 0)
      expect(gte!.getUTCDate()).toBe(1);
      expect(gte!.getUTCHours()).toBe(0);
      expect(gte!.getUTCMinutes()).toBe(0);
      expect(gte!.getUTCSeconds()).toBe(0);
    });
  });

  // ── findOneOrThrow (via findOne) ─────────────────────────────────────────────

  describe('findOne', () => {
    it('throws TASK_NOT_FOUND when task does not exist', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent-id', ACTOR_NO_MANAGE)).rejects.toThrow(NotFoundException);
    });

    it('returns task when found', async () => {
      const task = makeTask();
      mockFactoryTaskFindUnique.mockResolvedValue(task);
      const result = await service.findOne('task-id-1', ACTOR_NO_MANAGE);
      expect((result as Record<string, unknown>)['id']).toBe('task-id-1');
    });
  });

  // ── incident authorization — create / updateDraft ────────────────────────────

  describe('incident link authorization', () => {
    it('create: actor without incidents.read cannot link an incident', async () => {
      await expect(
        service.create({ title: 'T', incidentId: 'inc-uuid' }, ACTOR_NO_MANAGE),
      ).rejects.toMatchObject({ response: { code: 'TASK_INCIDENT_PERMISSION_DENIED' } });
      // DB must never be queried for the incident
      expect(mockIncidentFindUnique).not.toHaveBeenCalled();
    });

    it('updateDraft: actor without incidents.read cannot set incidentId', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(makeTask());
      await expect(
        service.updateDraft('task-id-1', { incidentId: 'inc-uuid' }, ACTOR_NO_MANAGE),
      ).rejects.toMatchObject({ response: { code: 'TASK_INCIDENT_PERMISSION_DENIED' } });
      expect(mockIncidentFindUnique).not.toHaveBeenCalled();
    });

    it('updateDraft: actor without incidents.read may update other fields (incidentId omitted)', async () => {
      mockFactoryTaskFindUnique.mockResolvedValue(makeTask());
      const updated = makeTask({ title: 'Updated Title' });
      // factoryTask.update is called directly (not via transaction)
      mockClient.factoryTask = { ...mockClient.factoryTask, update: vi.fn().mockResolvedValue(updated) } as unknown as typeof mockClient.factoryTask;

      const result = await service.updateDraft('task-id-1', { title: 'Updated Title' }, ACTOR_NO_MANAGE);
      // No incident permission check needed when incidentId is not in the request
      expect(mockIncidentFindUnique).not.toHaveBeenCalled();
      expect((result as Record<string, unknown>)['title']).toBe('Updated Title');
    });

    it('create: authorized caller receives incident metadata in response', async () => {
      mockIncidentFindUnique.mockResolvedValue({ id: 'inc-1' });
      mockLocationFindUnique.mockResolvedValue(null);
      const linkedTask = makeTask({
        incidentId: 'inc-1',
        incident: { id: 'inc-1', referenceNumber: 'INC-2026-000001', title: 'Safety Issue' },
      });
      mockTxCreate.mockResolvedValue(linkedTask);
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      const result = await service.create({ title: 'T', incidentId: 'inc-1' }, ACTOR_WITH_INCIDENTS);
      const incident = (result as Record<string, unknown>)['incident'] as Record<string, unknown> | null;
      expect(incident).not.toBeNull();
      expect(incident?.['referenceNumber']).toBe('INC-2026-000001');
    });

    it('findOne: actor without incidents.read receives incident: null even when task has incidentId', async () => {
      const taskWithIncident = makeTask({
        incidentId: 'inc-1',
        incident: { id: 'inc-1', referenceNumber: 'INC-2026-000001', title: 'Safety Issue' },
      });
      mockFactoryTaskFindUnique.mockResolvedValue(taskWithIncident);

      const result = await service.findOne('task-id-1', ACTOR_NO_MANAGE);
      expect((result as Record<string, unknown>)['incident']).toBeNull();
      // incidentId FK field is still present — only the joined relation is stripped
      expect((result as Record<string, unknown>)['incidentId']).toBe('inc-1');
    });

    it('findOne: actor with incidents.read receives safe incident projection', async () => {
      const taskWithIncident = makeTask({
        incidentId: 'inc-1',
        incident: { id: 'inc-1', referenceNumber: 'INC-2026-000001', title: 'Safety Issue' },
      });
      mockFactoryTaskFindUnique.mockResolvedValue(taskWithIncident);

      const result = await service.findOne('task-id-1', ACTOR_WITH_INCIDENTS);
      const incident = (result as Record<string, unknown>)['incident'] as Record<string, unknown>;
      expect(incident).not.toBeNull();
      expect(incident['referenceNumber']).toBe('INC-2026-000001');
      expect(incident['title']).toBe('Safety Issue');
    });
  });

  // ── getDashboard ──────────────────────────────────────────────────────────────

  describe('getDashboard', () => {
    it('returns ALL_DEPARTMENTS scope and correct metrics when no dept filter', async () => {
      mockGetScope.mockResolvedValueOnce(DepartmentAccessScope.ALL_DEPARTMENTS);
      // buildDeptFilter returns null by default — no department lookup
      mockFactoryTaskCount
        .mockResolvedValueOnce(12) // openTasks
        .mockResolvedValueOnce(4)  // assignedToMe
        .mockResolvedValueOnce(2)  // overdueTasks
        .mockResolvedValueOnce(1)  // blockedTasks
        .mockResolvedValueOnce(7); // completedThisMonth
      mockFactoryTaskFindMany.mockResolvedValueOnce([
        { id: 'task-r1', referenceNumber: 'TASK-001', title: 'Inspect Belt', status: 'OPEN', updatedAt: new Date('2026-07-01T10:00:00Z') },
      ]);

      const result = await service.getDashboard(ACTOR_NO_MANAGE);

      expect(result.scope.type).toBe(DepartmentAccessScope.ALL_DEPARTMENTS);
      expect(result.scope.departmentNames).toEqual([]);
      expect(result.metrics.openTasks).toBe(12);
      expect(result.metrics.assignedToMe).toBe(4);
      expect(result.metrics.overdueTasks).toBe(2);
      expect(result.metrics.blockedTasks).toBe(1);
      expect(result.metrics.completedThisMonth).toBe(7);
      expect(result.recent).toHaveLength(1);
      expect(result.recent[0]?.referenceNumber).toBe('TASK-001');
      expect(result.recent[0]?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
