import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { MaintenanceStatus, MaintenancePriority, DepartmentAccessScope } from '@recafco/database';
import { MaintenanceService } from './maintenance.service';
import type { DatabaseService } from '../database/database.service';
import type { MaintenanceRefService } from './maintenance-ref.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';

// ---------------------------------------------------------------------------
// Mock infrastructure
// ---------------------------------------------------------------------------

const mockTxFindUniqueOrThrow = vi.fn();
const mockTxUpdateMany = vi.fn();
const mockTxCreate = vi.fn();
const mockTxActivityCreate = vi.fn();
const mockTxAuditCreate = vi.fn();
const mockTxCommentCreate = vi.fn();

const mockTx = {
  maintenanceRequest: {
    findUniqueOrThrow: mockTxFindUniqueOrThrow,
    updateMany: mockTxUpdateMany,
    create: mockTxCreate,
  },
  maintenanceRequestActivity: { create: mockTxActivityCreate },
  maintenanceRequestComment: { create: mockTxCommentCreate },
  securityAuditEvent: { create: mockTxAuditCreate },
};

const mockMrFindUnique = vi.fn();
const mockMrFindMany = vi.fn();
const mockMrCount = vi.fn();
const mockUserFindUnique = vi.fn();
const mockLocationFindUnique = vi.fn();
const mockDepartmentFindMany = vi.fn();
const mockGetScope = vi.fn();
const mockTransaction = vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

const mockClient = {
  maintenanceRequest: {
    findUnique: mockMrFindUnique,
    findMany: mockMrFindMany,
    count: mockMrCount,
    update: vi.fn(),
  },
  user: { findUnique: mockUserFindUnique },
  location: { findUnique: mockLocationFindUnique },
  department: { findMany: mockDepartmentFindMany },
  $transaction: mockTransaction,
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockRef = {
  nextRef: vi.fn().mockResolvedValue('MR-2026-000001'),
} as unknown as MaintenanceRefService;

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

const ACTOR_BASE: AuthUser = {
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
  permissions: [
    'maintenance.read', 'maintenance.create', 'maintenance.start',
    'maintenance.complete', 'maintenance.comment',
  ],
};

const ACTOR_MANAGE: AuthUser = {
  id: 'user-manager-1',
  username: 'bob',
  displayName: 'Bob',
  roleId: 'role-2',
  roleCode: 'ADMIN',
  roleName: 'Admin',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-2',
  departmentId: null,
  permissions: [
    'maintenance.read', 'maintenance.create', 'maintenance.review',
    'maintenance.approve', 'maintenance.reject', 'maintenance.assign',
    'maintenance.start', 'maintenance.complete', 'maintenance.close',
    'maintenance.comment', 'maintenance.manage',
  ],
};

const ACTOR_ASSIGNEE: AuthUser = {
  id: 'user-assignee-1',
  username: 'charlie',
  displayName: 'Charlie',
  roleId: 'role-1',
  roleCode: 'TECHNICIAN',
  roleName: 'Technician',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-3',
  departmentId: null,
  permissions: ['maintenance.read', 'maintenance.start', 'maintenance.complete', 'maintenance.comment'],
};

function makeMr(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'mr-id-1',
    referenceNumber: 'MR-2026-000001',
    title: 'Fix conveyor belt',
    problemDescription: 'Conveyor belt is slipping.',
    priority: MaintenancePriority.MEDIUM,
    status: MaintenanceStatus.DRAFT,
    createdByUserId: 'user-actor-1',
    requestedByUserId: 'user-actor-1',
    assignedToUserId: null,
    affectedDepartmentId: null,
    plantId: null,
    locationId: null,
    equipmentDescription: null,
    requestedCompletionAt: null,
    startedAt: null,
    waitingForPartsAt: null,
    waitingForPartsReason: null,
    completedAt: null,
    completedByUserId: null,
    completionSummary: null,
    closedAt: null,
    closedByUserId: null,
    rejectedAt: null,
    rejectedByUserId: null,
    rejectionReason: null,
    cancelledAt: null,
    cancelledByUserId: null,
    cancellationReason: null,
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
    createdByUser: { id: 'user-actor-1', displayName: 'Alice', username: 'alice' },
    requestedByUser: { id: 'user-actor-1', displayName: 'Alice', username: 'alice' },
    assignedToUser: null,
    affectedDepartment: null,
    plant: null,
    location: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MaintenanceService', () => {
  let service: MaintenanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (cb) => cb(mockTx));
    service = new MaintenanceService(mockDb, mockRef, mockDeptAccess);
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a DRAFT request and sets createdByUserId from actor', async () => {
      mockLocationFindUnique.mockResolvedValue(null);
      const mr = makeMr();
      mockTxCreate.mockResolvedValue(mr);
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      const result = await service.create(
        { title: 'Fix belt', problemDescription: 'Belt slipping' },
        ACTOR_BASE,
      );

      expect(result).toBeDefined();
      expect(mockTxCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          createdByUserId: 'user-actor-1',
          requestedByUserId: 'user-actor-1',
        }),
      }));
    });

    it('prevents impersonation of requestedByUserId without maintenance.manage', async () => {
      await expect(
        service.create(
          { title: 'T', problemDescription: 'P', requestedByUserId: 'other-user' },
          ACTOR_BASE,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows maintenance.manage to set requestedByUserId to another active user', async () => {
      mockUserFindUnique.mockResolvedValue({ id: 'other-user', isActive: true });
      mockLocationFindUnique.mockResolvedValue(null);
      const mr = makeMr({ requestedByUserId: 'other-user' });
      mockTxCreate.mockResolvedValue(mr);
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      await service.create(
        { title: 'T', problemDescription: 'P', requestedByUserId: 'other-user' },
        ACTOR_MANAGE,
      );
      expect(mockTxCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ requestedByUserId: 'other-user' }),
      }));
    });

    it('throws MR_ASSIGNMENT_INVALID when requestedBy user is inactive', async () => {
      mockUserFindUnique.mockResolvedValue({ id: 'other-user', isActive: false });
      await expect(
        service.create(
          { title: 'T', problemDescription: 'P', requestedByUserId: 'other-user' },
          ACTOR_MANAGE,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('derives plantId from location if location belongs to a plant', async () => {
      mockLocationFindUnique.mockResolvedValue({ id: 'loc-1', plantId: 'plant-1' });
      const mr = makeMr({ plantId: 'plant-1', locationId: 'loc-1' });
      mockTxCreate.mockResolvedValue(mr);
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      await service.create(
        { title: 'T', problemDescription: 'P', locationId: 'loc-1' },
        ACTOR_BASE,
      );
      expect(mockTxCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ plantId: 'plant-1', locationId: 'loc-1' }),
      }));
    });

    it('throws MR_LOCATION_INVALID when location does not exist', async () => {
      mockLocationFindUnique.mockResolvedValue(null);
      await expect(
        service.create({ title: 'T', problemDescription: 'P', locationId: 'bad-loc' }, ACTOR_BASE),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ── updateDraft ──────────────────────────────────────────────────────────────

  describe('updateDraft', () => {
    it('throws MR_NOT_EDITABLE when request is not DRAFT', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.SUBMITTED }));
      await expect(
        service.updateDraft('mr-id-1', { title: 'New title' }, ACTOR_BASE),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws MR_NOT_OWN_DRAFT when actor is not creator and lacks manage', async () => {
      const otherActor: AuthUser = { ...ACTOR_BASE, id: 'other-user-999' };
      mockMrFindUnique.mockResolvedValue(makeMr());
      await expect(
        service.updateDraft('mr-id-1', { title: 'X' }, otherActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates the draft when actor is creator', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr());
      mockLocationFindUnique.mockResolvedValue(null);
      const updated = makeMr({ title: 'New title' });
      (mockClient.maintenanceRequest.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await service.updateDraft('mr-id-1', { title: 'New title' }, ACTOR_BASE);
      expect((result as Record<string, unknown>)['title']).toBe('New title');
    });
  });

  // ── submit ───────────────────────────────────────────────────────────────────

  describe('submit', () => {
    it('throws INVALID_MR_TRANSITION when not DRAFT', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.SUBMITTED }));
      await expect(service.submit('mr-id-1', ACTOR_BASE)).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws MR_PERMISSION_DENIED when actor is not creator and lacks manage', async () => {
      const otherActor: AuthUser = { ...ACTOR_BASE, id: 'other-user-999' };
      mockMrFindUnique.mockResolvedValue(makeMr());
      await expect(service.submit('mr-id-1', otherActor)).rejects.toThrow(ForbiddenException);
    });

    it('transitions DRAFT → SUBMITTED for creator', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr());
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(makeMr({ status: MaintenanceStatus.SUBMITTED }));
      mockTxActivityCreate.mockResolvedValue({});

      const result = await service.submit('mr-id-1', ACTOR_BASE);
      expect((result as Record<string, unknown>)['status']).toBe(MaintenanceStatus.SUBMITTED);
    });

    it('throws MR_CONCURRENT_MODIFICATION when updateMany returns count 0', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr());
      mockTxUpdateMany.mockResolvedValue({ count: 0 });
      await expect(service.submit('mr-id-1', ACTOR_BASE)).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ── review ───────────────────────────────────────────────────────────────────

  describe('review', () => {
    it('throws INVALID_MR_TRANSITION when not SUBMITTED', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.DRAFT }));
      await expect(service.review('mr-id-1', ACTOR_MANAGE)).rejects.toThrow(UnprocessableEntityException);
    });

    it('transitions SUBMITTED → UNDER_REVIEW', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.SUBMITTED }));
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(makeMr({ status: MaintenanceStatus.UNDER_REVIEW }));
      mockTxActivityCreate.mockResolvedValue({});

      const result = await service.review('mr-id-1', ACTOR_MANAGE);
      expect((result as Record<string, unknown>)['status']).toBe(MaintenanceStatus.UNDER_REVIEW);
    });
  });

  // ── approve ──────────────────────────────────────────────────────────────────

  describe('approve', () => {
    it('throws INVALID_MR_TRANSITION when not UNDER_REVIEW', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.SUBMITTED }));
      await expect(service.approve('mr-id-1', ACTOR_MANAGE)).rejects.toThrow(UnprocessableEntityException);
    });

    it('transitions UNDER_REVIEW → APPROVED', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.UNDER_REVIEW }));
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(makeMr({ status: MaintenanceStatus.APPROVED }));
      mockTxActivityCreate.mockResolvedValue({});

      const result = await service.approve('mr-id-1', ACTOR_MANAGE);
      expect((result as Record<string, unknown>)['status']).toBe(MaintenanceStatus.APPROVED);
    });
  });

  // ── reject ───────────────────────────────────────────────────────────────────

  describe('reject', () => {
    it('throws INVALID_MR_TRANSITION when not SUBMITTED or UNDER_REVIEW', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.APPROVED }));
      await expect(
        service.reject('mr-id-1', { rejectionReason: 'Not valid' }, ACTOR_MANAGE),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects from SUBMITTED with reason', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.SUBMITTED }));
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.REJECTED, rejectionReason: 'Not valid' }),
      );
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      const result = await service.reject('mr-id-1', { rejectionReason: 'Not valid' }, ACTOR_MANAGE);
      expect((result as Record<string, unknown>)['status']).toBe(MaintenanceStatus.REJECTED);
    });

    it('throws MR_REJECTION_REASON_REQUIRED when reason is blank', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.SUBMITTED }));
      await expect(
        service.reject('mr-id-1', { rejectionReason: '   ' }, ACTOR_MANAGE),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ── assign ───────────────────────────────────────────────────────────────────

  describe('assign', () => {
    it('throws INVALID_MR_TRANSITION when not APPROVED or ASSIGNED', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.SUBMITTED }));
      await expect(
        service.assign('mr-id-1', { assignedToUserId: 'user-assignee-1' }, ACTOR_MANAGE),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('transitions APPROVED → ASSIGNED', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.APPROVED }));
      mockUserFindUnique.mockResolvedValue({ id: 'user-assignee-1', isActive: true });
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.ASSIGNED, assignedToUserId: 'user-assignee-1' }),
      );
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      const result = await service.assign('mr-id-1', { assignedToUserId: 'user-assignee-1' }, ACTOR_MANAGE);
      expect((result as Record<string, unknown>)['status']).toBe(MaintenanceStatus.ASSIGNED);
    });

    it('preserves ASSIGNED status when reassigning', async () => {
      mockMrFindUnique.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.ASSIGNED, assignedToUserId: 'user-assignee-1' }),
      );
      mockUserFindUnique.mockResolvedValue({ id: 'user-assignee-2', isActive: true });
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.ASSIGNED, assignedToUserId: 'user-assignee-2' }),
      );
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      const result = await service.assign('mr-id-1', { assignedToUserId: 'user-assignee-2' }, ACTOR_MANAGE);
      expect((result as Record<string, unknown>)['status']).toBe(MaintenanceStatus.ASSIGNED);
    });

    it('throws MR_ASSIGNMENT_INVALID when user is inactive', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.APPROVED }));
      mockUserFindUnique.mockResolvedValue({ id: 'user-assignee-1', isActive: false });
      await expect(
        service.assign('mr-id-1', { assignedToUserId: 'user-assignee-1' }, ACTOR_MANAGE),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ── unassign ─────────────────────────────────────────────────────────────────

  describe('unassign', () => {
    it('throws INVALID_MR_TRANSITION when not ASSIGNED', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.IN_PROGRESS }));
      await expect(service.unassign('mr-id-1', ACTOR_MANAGE)).rejects.toThrow(UnprocessableEntityException);
    });

    it('transitions ASSIGNED → APPROVED and clears assignedToUserId', async () => {
      mockMrFindUnique.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.ASSIGNED, assignedToUserId: 'user-assignee-1' }),
      );
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.APPROVED, assignedToUserId: null }),
      );
      mockTxActivityCreate.mockResolvedValue({});

      const result = await service.unassign('mr-id-1', ACTOR_MANAGE);
      expect((result as Record<string, unknown>)['status']).toBe(MaintenanceStatus.APPROVED);
    });
  });

  // ── start ─────────────────────────────────────────────────────────────────────

  describe('start', () => {
    it('throws INVALID_MR_TRANSITION when not ASSIGNED', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.APPROVED }));
      await expect(service.start('mr-id-1', ACTOR_ASSIGNEE)).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws MR_NOT_ASSIGNEE when actor is not assignee and lacks manage', async () => {
      mockMrFindUnique.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.ASSIGNED, assignedToUserId: 'someone-else' }),
      );
      await expect(service.start('mr-id-1', ACTOR_ASSIGNEE)).rejects.toThrow(ForbiddenException);
    });

    it('transitions ASSIGNED → IN_PROGRESS for assignee', async () => {
      mockMrFindUnique.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.ASSIGNED, assignedToUserId: 'user-assignee-1' }),
      );
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(makeMr({ status: MaintenanceStatus.IN_PROGRESS }));
      mockTxActivityCreate.mockResolvedValue({});

      const result = await service.start('mr-id-1', ACTOR_ASSIGNEE);
      expect((result as Record<string, unknown>)['status']).toBe(MaintenanceStatus.IN_PROGRESS);
    });

    it('allows maintenance.manage to start even when not assignee', async () => {
      mockMrFindUnique.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.ASSIGNED, assignedToUserId: 'someone-else' }),
      );
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(makeMr({ status: MaintenanceStatus.IN_PROGRESS }));
      mockTxActivityCreate.mockResolvedValue({});

      const result = await service.start('mr-id-1', ACTOR_MANAGE);
      expect((result as Record<string, unknown>)['status']).toBe(MaintenanceStatus.IN_PROGRESS);
    });
  });

  // ── waitingForParts ───────────────────────────────────────────────────────────

  describe('waitingForParts', () => {
    it('throws INVALID_MR_TRANSITION when not IN_PROGRESS', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.ASSIGNED }));
      await expect(
        service.waitingForParts('mr-id-1', { waitingForPartsReason: 'Need part X' }, ACTOR_ASSIGNEE),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws MR_WAITING_REASON_REQUIRED when reason is blank', async () => {
      mockMrFindUnique.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.IN_PROGRESS, assignedToUserId: 'user-assignee-1' }),
      );
      await expect(
        service.waitingForParts('mr-id-1', { waitingForPartsReason: '  ' }, ACTOR_ASSIGNEE),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('transitions IN_PROGRESS → WAITING_FOR_PARTS', async () => {
      mockMrFindUnique.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.IN_PROGRESS, assignedToUserId: 'user-assignee-1' }),
      );
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.WAITING_FOR_PARTS, waitingForPartsReason: 'Need part X' }),
      );
      mockTxActivityCreate.mockResolvedValue({});

      const result = await service.waitingForParts(
        'mr-id-1', { waitingForPartsReason: 'Need part X' }, ACTOR_ASSIGNEE,
      );
      expect((result as Record<string, unknown>)['status']).toBe(MaintenanceStatus.WAITING_FOR_PARTS);
    });
  });

  // ── resume ────────────────────────────────────────────────────────────────────

  describe('resume', () => {
    it('throws INVALID_MR_TRANSITION when not WAITING_FOR_PARTS', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.IN_PROGRESS }));
      await expect(service.resume('mr-id-1', ACTOR_ASSIGNEE)).rejects.toThrow(UnprocessableEntityException);
    });

    it('transitions WAITING_FOR_PARTS → IN_PROGRESS and clears reason', async () => {
      mockMrFindUnique.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.WAITING_FOR_PARTS, assignedToUserId: 'user-assignee-1' }),
      );
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.IN_PROGRESS, waitingForPartsReason: null }),
      );
      mockTxActivityCreate.mockResolvedValue({});

      const result = await service.resume('mr-id-1', ACTOR_ASSIGNEE);
      expect((result as Record<string, unknown>)['status']).toBe(MaintenanceStatus.IN_PROGRESS);
    });
  });

  // ── complete ──────────────────────────────────────────────────────────────────

  describe('complete', () => {
    it('throws INVALID_MR_TRANSITION when not IN_PROGRESS or WAITING_FOR_PARTS', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.ASSIGNED }));
      await expect(
        service.complete('mr-id-1', { completionSummary: 'Done' }, ACTOR_ASSIGNEE),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws MR_NOT_ASSIGNEE when actor is not assignee and lacks manage', async () => {
      const other: AuthUser = { ...ACTOR_ASSIGNEE, id: 'some-other' };
      mockMrFindUnique.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.IN_PROGRESS, assignedToUserId: 'user-assignee-1' }),
      );
      await expect(
        service.complete('mr-id-1', { completionSummary: 'Done' }, other),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws MR_COMPLETION_REQUIRED when summary is blank', async () => {
      mockMrFindUnique.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.IN_PROGRESS, assignedToUserId: 'user-assignee-1' }),
      );
      await expect(
        service.complete('mr-id-1', { completionSummary: '   ' }, ACTOR_ASSIGNEE),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('completes from IN_PROGRESS', async () => {
      mockMrFindUnique.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.IN_PROGRESS, assignedToUserId: 'user-assignee-1' }),
      );
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.COMPLETED, completionSummary: 'Fixed' }),
      );
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      const result = await service.complete('mr-id-1', { completionSummary: 'Fixed' }, ACTOR_ASSIGNEE);
      expect((result as Record<string, unknown>)['status']).toBe(MaintenanceStatus.COMPLETED);
    });

    it('completes from WAITING_FOR_PARTS', async () => {
      mockMrFindUnique.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.WAITING_FOR_PARTS, assignedToUserId: 'user-assignee-1' }),
      );
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.COMPLETED }),
      );
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      const result = await service.complete('mr-id-1', { completionSummary: 'Done' }, ACTOR_ASSIGNEE);
      expect((result as Record<string, unknown>)['status']).toBe(MaintenanceStatus.COMPLETED);
    });
  });

  // ── close ─────────────────────────────────────────────────────────────────────

  describe('close', () => {
    it('throws INVALID_MR_TRANSITION when not COMPLETED', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.IN_PROGRESS }));
      await expect(service.close('mr-id-1', ACTOR_MANAGE)).rejects.toThrow(UnprocessableEntityException);
    });

    it('transitions COMPLETED → CLOSED', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.COMPLETED }));
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(makeMr({ status: MaintenanceStatus.CLOSED }));
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      const result = await service.close('mr-id-1', ACTOR_MANAGE);
      expect((result as Record<string, unknown>)['status']).toBe(MaintenanceStatus.CLOSED);
    });
  });

  // ── cancel ────────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('throws INVALID_MR_TRANSITION when already terminal', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.CLOSED }));
      await expect(
        service.cancel('mr-id-1', { reason: 'reason' }, ACTOR_BASE),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws MR_PERMISSION_DENIED for non-creator in progress state without manage', async () => {
      const other: AuthUser = { ...ACTOR_BASE, id: 'other-999' };
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.IN_PROGRESS }));
      await expect(
        service.cancel('mr-id-1', { reason: 'reason' }, other),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows creator to cancel own DRAFT', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.DRAFT }));
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(makeMr({ status: MaintenanceStatus.CANCELLED }));
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      const result = await service.cancel('mr-id-1', { reason: 'Changed mind' }, ACTOR_BASE);
      expect((result as Record<string, unknown>)['status']).toBe(MaintenanceStatus.CANCELLED);
    });

    it('allows creator to cancel own SUBMITTED request', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.SUBMITTED }));
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(makeMr({ status: MaintenanceStatus.CANCELLED }));
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      const result = await service.cancel('mr-id-1', { reason: 'Changed mind' }, ACTOR_BASE);
      expect((result as Record<string, unknown>)['status']).toBe(MaintenanceStatus.CANCELLED);
    });

    it('throws MR_CANCEL_REASON_REQUIRED when reason is blank', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.DRAFT }));
      await expect(
        service.cancel('mr-id-1', { reason: '   ' }, ACTOR_BASE),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ── reopen ────────────────────────────────────────────────────────────────────

  describe('reopen', () => {
    it('throws INVALID_MR_TRANSITION when not COMPLETED, CLOSED, or REJECTED', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.CANCELLED }));
      await expect(
        service.reopen('mr-id-1', { reason: 'Reopening' }, ACTOR_MANAGE),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('reopens from CLOSED → IN_PROGRESS', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.CLOSED }));
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(makeMr({ status: MaintenanceStatus.IN_PROGRESS }));
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      const result = await service.reopen('mr-id-1', { reason: 'Parts not installed' }, ACTOR_MANAGE);
      expect((result as Record<string, unknown>)['status']).toBe(MaintenanceStatus.IN_PROGRESS);
    });

    it('reopens from REJECTED → SUBMITTED', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.REJECTED }));
      mockTxUpdateMany.mockResolvedValue({ count: 1 });
      mockTxFindUniqueOrThrow.mockResolvedValue(makeMr({ status: MaintenanceStatus.SUBMITTED }));
      mockTxActivityCreate.mockResolvedValue({});
      mockTxAuditCreate.mockResolvedValue({});

      const result = await service.reopen('mr-id-1', { reason: 'Re-evaluate' }, ACTOR_MANAGE);
      expect((result as Record<string, unknown>)['status']).toBe(MaintenanceStatus.SUBMITTED);
    });

    it('throws MR_REOPEN_REASON_REQUIRED when reason is blank', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.COMPLETED }));
      await expect(
        service.reopen('mr-id-1', { reason: '   ' }, ACTOR_MANAGE),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws MR_NOT_FOUND when request does not exist', async () => {
      mockMrFindUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id', ACTOR_BASE)).rejects.toThrow(NotFoundException);
    });

    it('returns the request when found', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr());
      const result = await service.findOne('mr-id-1', ACTOR_BASE);
      expect((result as Record<string, unknown>)['id']).toBe('mr-id-1');
    });
  });

  // ── addComment ────────────────────────────────────────────────────────────────

  describe('addComment', () => {
    it('throws VALIDATION_ERROR when body is blank', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr());
      await expect(
        service.addComment('mr-id-1', { body: '   ' }, ACTOR_BASE),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('adds a comment and logs activity', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr());
      const comment = { id: 'comment-1', requestId: 'mr-id-1', body: 'Looks urgent', createdAt: new Date() };
      mockTxCommentCreate.mockResolvedValue(comment);
      mockTxActivityCreate.mockResolvedValue({});

      const result = await service.addComment('mr-id-1', { body: 'Looks urgent' }, ACTOR_BASE);
      expect(result).toEqual(comment);
      expect(mockTxActivityCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ event: 'COMMENT_ADDED' }),
      }));
    });
  });

  // ── getSummary ────────────────────────────────────────────────────────────────

  describe('getSummary', () => {
    it('returns summary metrics', async () => {
      mockMrCount
        .mockResolvedValueOnce(3)   // openRequests
        .mockResolvedValueOnce(1)   // assignedToMe
        .mockResolvedValueOnce(0)   // overdueRequests
        .mockResolvedValueOnce(2)   // waitingForParts
        .mockResolvedValueOnce(5);  // completedThisMonth

      const result = await service.getSummary(ACTOR_BASE);
      expect(result).toEqual({
        openRequests: 3,
        assignedToMe: 1,
        overdueRequests: 0,
        waitingForParts: 2,
        completedThisMonth: 5,
      });
    });
  });

  // ── concurrency guard ─────────────────────────────────────────────────────────

  describe('concurrency guard (MR_CONCURRENT_MODIFICATION)', () => {
    it('submit: throws when updateMany returns count 0', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.DRAFT }));
      mockTxUpdateMany.mockResolvedValue({ count: 0 });
      await expect(service.submit('mr-id-1', ACTOR_BASE)).rejects.toThrow(UnprocessableEntityException);
    });

    it('close: throws when updateMany returns count 0', async () => {
      mockMrFindUnique.mockResolvedValue(makeMr({ status: MaintenanceStatus.COMPLETED }));
      mockTxUpdateMany.mockResolvedValue({ count: 0 });
      await expect(service.close('mr-id-1', ACTOR_MANAGE)).rejects.toThrow(UnprocessableEntityException);
    });

    it('complete: throws when updateMany returns count 0', async () => {
      mockMrFindUnique.mockResolvedValue(
        makeMr({ status: MaintenanceStatus.IN_PROGRESS, assignedToUserId: 'user-assignee-1' }),
      );
      mockTxUpdateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.complete('mr-id-1', { completionSummary: 'Done' }, ACTOR_ASSIGNEE),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ── getDashboard ──────────────────────────────────────────────────────────────

  describe('getDashboard', () => {
    it('returns ALL_DEPARTMENTS scope and correct metrics when no dept filter', async () => {
      mockGetScope.mockResolvedValueOnce(DepartmentAccessScope.ALL_DEPARTMENTS);
      mockMrCount
        .mockResolvedValueOnce(8)  // openRequests
        .mockResolvedValueOnce(3)  // assignedToMe
        .mockResolvedValueOnce(2)  // overdueRequests
        .mockResolvedValueOnce(1)  // waitingForParts
        .mockResolvedValueOnce(5); // completedThisMonth
      mockMrFindMany.mockResolvedValueOnce([
        { id: 'mr-r1', referenceNumber: 'MR-001', title: 'Fix Pump', status: 'SUBMITTED', updatedAt: new Date('2026-07-01T08:00:00Z') },
      ]);

      const result = await service.getDashboard(ACTOR_BASE);

      expect(result.scope.type).toBe(DepartmentAccessScope.ALL_DEPARTMENTS);
      expect(result.scope.departmentNames).toEqual([]);
      expect(result.metrics.openRequests).toBe(8);
      expect(result.metrics.assignedToMe).toBe(3);
      expect(result.metrics.overdueRequests).toBe(2);
      expect(result.metrics.waitingForParts).toBe(1);
      expect(result.metrics.completedThisMonth).toBe(5);
      expect(result.recent).toHaveLength(1);
      expect(result.recent[0]?.referenceNumber).toBe('MR-001');
      expect(result.recent[0]?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
