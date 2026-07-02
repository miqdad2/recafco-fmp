import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InspectionStatus, FindingSeverity, FindingStatus } from '@recafco/database';
import { SafetyService } from './safety.service';
import type { DatabaseService } from '../database/database.service';
import type { SafetyRefService } from './safety-ref.service';
import type { AuthUser } from '../common/types/auth-user';

// ---------------------------------------------------------------------------
// Transaction mocks
// ---------------------------------------------------------------------------

const mockTxInspectionUpdateMany = vi.fn();
const mockTxInspectionCreate = vi.fn();
const mockTxInspectionFindUniqueOrThrow = vi.fn();
const mockTxFindingUpdateMany = vi.fn();
const mockTxFindingCreate = vi.fn();
const mockTxFindingFindUniqueOrThrow = vi.fn();
const mockTxActivityCreate = vi.fn();
const mockTxCommentCreate = vi.fn();
const mockTxAuditCreate = vi.fn();

const mockTx = {
  safetyInspection: {
    updateMany: mockTxInspectionUpdateMany,
    create: mockTxInspectionCreate,
    findUniqueOrThrow: mockTxInspectionFindUniqueOrThrow,
  },
  safetyFinding: {
    updateMany: mockTxFindingUpdateMany,
    create: mockTxFindingCreate,
    findUniqueOrThrow: mockTxFindingFindUniqueOrThrow,
  },
  safetyInspectionActivity: { create: mockTxActivityCreate },
  safetyInspectionComment: { create: mockTxCommentCreate },
  securityAuditEvent: { create: mockTxAuditCreate },
};

// ---------------------------------------------------------------------------
// Client mocks
// ---------------------------------------------------------------------------

const mockInspectionFindUnique = vi.fn();
const mockInspectionFindMany = vi.fn();
const mockInspectionCount = vi.fn();
const mockFindingFindUnique = vi.fn();
const mockFindingFindMany = vi.fn();
const mockFindingCount = vi.fn();
const mockCommentFindMany = vi.fn();
const mockActivityFindMany = vi.fn();
const mockUserFindUnique = vi.fn();
const mockLocationFindUnique = vi.fn();
const mockTransaction = vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

const mockClient = {
  safetyInspection: {
    findUnique: mockInspectionFindUnique,
    findMany: mockInspectionFindMany,
    count: mockInspectionCount,
    update: vi.fn(),
  },
  safetyFinding: {
    findUnique: mockFindingFindUnique,
    findMany: mockFindingFindMany,
    count: mockFindingCount,
  },
  safetyInspectionComment: { findMany: mockCommentFindMany },
  safetyInspectionActivity: { findMany: mockActivityFindMany },
  user: { findUnique: mockUserFindUnique, findMany: vi.fn() },
  location: { findUnique: mockLocationFindUnique },
  $transaction: mockTransaction,
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;
const mockRef = { nextRef: vi.fn().mockResolvedValue('SAFE-2026-000001') } as unknown as SafetyRefService;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR_VIEWER: AuthUser = {
  id: 'user-viewer-1',
  username: 'alice',
  displayName: 'Alice',
  roleId: 'role-viewer',
  roleCode: 'VIEWER',
  roleName: 'Viewer',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-1',
  permissions: ['safety.read', 'safety.create', 'safety.comment'],
};

const ACTOR_ADMIN: AuthUser = {
  id: 'user-admin-1',
  username: 'admin',
  displayName: 'Admin',
  roleId: 'role-admin',
  roleCode: 'ADMIN',
  roleName: 'Admin',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-2',
  permissions: [
    'safety.read', 'safety.create', 'safety.schedule', 'safety.inspect',
    'safety.finding_create', 'safety.finding_assign', 'safety.finding_resolve',
    'safety.verify', 'safety.close', 'safety.comment', 'safety.manage',
  ],
};

const ACTOR_INSPECTOR: AuthUser = {
  id: 'user-inspector-1',
  username: 'inspector',
  displayName: 'Inspector',
  roleId: 'role-viewer',
  roleCode: 'VIEWER',
  roleName: 'Viewer',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-3',
  permissions: [
    'safety.read', 'safety.create', 'safety.inspect', 'safety.finding_create',
    'safety.finding_resolve', 'safety.comment',
  ],
};

function makeInspection(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'insp-id-1',
    referenceNumber: 'SAFE-2026-000001',
    title: 'Annual safety audit',
    summary: null,
    status: InspectionStatus.DRAFT,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    completedByUserId: null,
    closedAt: null,
    closedByUserId: null,
    cancelledAt: null,
    cancelledByUserId: null,
    cancellationReason: null,
    createdByUserId: 'user-viewer-1',
    inspectorUserId: null,
    departmentId: null,
    plantId: null,
    locationId: null,
    checklistSummary: null,
    conclusion: null,
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
    createdByUser: { id: 'user-viewer-1', displayName: 'Alice', username: 'alice' },
    inspector: null,
    completedByUser: null,
    closedByUser: null,
    cancelledByUser: null,
    department: null,
    plant: null,
    location: null,
    ...overrides,
  };
}

function makeFinding(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'finding-id-1',
    inspectionId: 'insp-id-1',
    title: 'Missing safety signage',
    description: 'Exit signs are missing in corridor B.',
    severity: FindingSeverity.HIGH,
    status: FindingStatus.OPEN,
    assignedToUserId: null,
    dueAt: null,
    actionRequired: null,
    resolutionSummary: null,
    resolvedAt: null,
    resolvedByUserId: null,
    verifiedAt: null,
    verifiedByUserId: null,
    closedAt: null,
    closedByUserId: null,
    reopenedAt: null,
    reopenedByUserId: null,
    reopenReason: null,
    createdByUserId: 'user-inspector-1',
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
    createdByUser: { id: 'user-inspector-1', displayName: 'Inspector', username: 'inspector' },
    assignedToUser: null,
    resolvedByUser: null,
    verifiedByUser: null,
    closedByUser: null,
    reopenedByUser: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let service: SafetyService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new SafetyService(mockDb, mockRef);
});

// ---------------------------------------------------------------------------
// Reference service
// ---------------------------------------------------------------------------

describe('SafetyRefService.nextRef', () => {
  it('formats reference as SAFE-YYYY-NNNNNN', async () => {
    const { SafetyRefService: RefSvc } = await import('./safety-ref.service');
    const refService = new RefSvc(mockDb);
    const mockTxLocal = {
      $queryRaw: vi.fn().mockResolvedValue([{ last_seq: BigInt(1) }]),
    };
    const ref = await refService.nextRef(mockTxLocal as never, 2026);
    expect(ref).toBe('SAFE-2026-000001');
  });

  it('pads sequence to 6 digits', async () => {
    const { SafetyRefService: RefSvc } = await import('./safety-ref.service');
    const refService = new RefSvc(mockDb);
    const mockTxLocal = {
      $queryRaw: vi.fn().mockResolvedValue([{ last_seq: BigInt(42) }]),
    };
    const ref = await refService.nextRef(mockTxLocal as never, 2026);
    expect(ref).toBe('SAFE-2026-000042');
  });

  it('throws SAFETY_SEQUENCE_EXHAUSTED when seq > 999999', async () => {
    const { SafetyRefService: RefSvc } = await import('./safety-ref.service');
    const refService = new RefSvc(mockDb);
    const mockTxLocal = {
      $queryRaw: vi.fn().mockResolvedValue([{ last_seq: BigInt(1000000) }]),
    };
    await expect(refService.nextRef(mockTxLocal as never, 2026)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});

// ---------------------------------------------------------------------------
// Create inspection
// ---------------------------------------------------------------------------

describe('SafetyService.create', () => {
  it('creates a DRAFT inspection and returns reference number', async () => {
    mockUserFindUnique.mockResolvedValue(null); // no inspector specified
    mockLocationFindUnique.mockResolvedValue(null);
    const expected = makeInspection();
    mockTxInspectionCreate.mockResolvedValue(expected);
    mockTxActivityCreate.mockResolvedValue({});
    mockTxAuditCreate.mockResolvedValue({});

    const result = await service.create({ title: 'Annual safety audit' }, ACTOR_VIEWER);

    expect(mockRef.nextRef).toHaveBeenCalled();
    expect(mockTxInspectionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Annual safety audit',
          createdByUserId: ACTOR_VIEWER.id,
        }),
      }),
    );
    expect(result).toEqual(expected);
  });

  it('validates inspector is active when provided', async () => {
    mockUserFindUnique.mockResolvedValue(null); // user not found → inactive

    await expect(
      service.create({ title: 'Audit', inspectorUserId: 'nonexistent-user' }, ACTOR_VIEWER),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects inactive inspector', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'inactive-user', isActive: false });

    await expect(
      service.create({ title: 'Audit', inspectorUserId: 'inactive-user' }, ACTOR_VIEWER),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});

// ---------------------------------------------------------------------------
// Update DRAFT
// ---------------------------------------------------------------------------

describe('SafetyService.updateDraft', () => {
  it('allows creator to update own DRAFT', async () => {
    const insp = makeInspection();
    mockInspectionFindUnique.mockResolvedValue(insp);
    mockClient.safetyInspection.update = vi.fn().mockResolvedValue({ ...insp, title: 'Updated' });

    const result = await service.updateDraft('insp-id-1', { title: 'Updated' }, ACTOR_VIEWER);
    expect(result).toMatchObject({ title: 'Updated' });
  });

  it('denies non-creator without safety.manage', async () => {
    const insp = makeInspection({ createdByUserId: 'someone-else' });
    mockInspectionFindUnique.mockResolvedValue(insp);

    await expect(
      service.updateDraft('insp-id-1', { title: 'Updated' }, ACTOR_VIEWER),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows safety.manage user to update any DRAFT', async () => {
    const insp = makeInspection({ createdByUserId: 'someone-else' });
    mockInspectionFindUnique.mockResolvedValue(insp);
    mockClient.safetyInspection.update = vi.fn().mockResolvedValue(insp);

    await expect(
      service.updateDraft('insp-id-1', { title: 'Updated' }, ACTOR_ADMIN),
    ).resolves.not.toThrow();
  });

  it('rejects updating non-DRAFT inspection', async () => {
    const insp = makeInspection({ status: InspectionStatus.SCHEDULED });
    mockInspectionFindUnique.mockResolvedValue(insp);

    await expect(
      service.updateDraft('insp-id-1', { title: 'Updated' }, ACTOR_VIEWER),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

describe('SafetyService.schedule', () => {
  it('transitions DRAFT to SCHEDULED with inspector and date', async () => {
    const insp = makeInspection();
    mockInspectionFindUnique.mockResolvedValue(insp);
    mockUserFindUnique.mockResolvedValue({ id: 'user-inspector-1', isActive: true });
    mockTxInspectionUpdateMany.mockResolvedValue({ count: 1 });
    const scheduled = makeInspection({
      status: InspectionStatus.SCHEDULED,
      inspectorUserId: 'user-inspector-1',
    });
    mockTxInspectionFindUniqueOrThrow.mockResolvedValue(scheduled);
    mockTxActivityCreate.mockResolvedValue({});
    mockTxAuditCreate.mockResolvedValue({});

    const result = await service.schedule(
      'insp-id-1',
      { scheduledAt: '2026-08-01T09:00:00Z', inspectorUserId: 'user-inspector-1' },
      ACTOR_ADMIN,
    );

    expect(mockTxInspectionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'insp-id-1', status: InspectionStatus.DRAFT },
      }),
    );
    expect(result).toMatchObject({ status: InspectionStatus.SCHEDULED });
  });

  it('rejects scheduling non-DRAFT inspection', async () => {
    const insp = makeInspection({ status: InspectionStatus.SCHEDULED });
    mockInspectionFindUnique.mockResolvedValue(insp);
    mockUserFindUnique.mockResolvedValue({ id: 'user-inspector-1', isActive: true });

    await expect(
      service.schedule(
        'insp-id-1',
        { scheduledAt: '2026-08-01T09:00:00Z', inspectorUserId: 'user-inspector-1' },
        ACTOR_ADMIN,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects inactive inspector', async () => {
    const insp = makeInspection();
    mockInspectionFindUnique.mockResolvedValue(insp);
    mockUserFindUnique.mockResolvedValue({ id: 'bad-user', isActive: false });

    await expect(
      service.schedule(
        'insp-id-1',
        { scheduledAt: '2026-08-01T09:00:00Z', inspectorUserId: 'bad-user' },
        ACTOR_ADMIN,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('throws SAFETY_CONCURRENT_MODIFICATION when updateMany returns count 0', async () => {
    const insp = makeInspection();
    mockInspectionFindUnique.mockResolvedValue(insp);
    mockUserFindUnique.mockResolvedValue({ id: 'user-inspector-1', isActive: true });
    mockTxInspectionUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.schedule(
        'insp-id-1',
        { scheduledAt: '2026-08-01T09:00:00Z', inspectorUserId: 'user-inspector-1' },
        ACTOR_ADMIN,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

describe('SafetyService.start', () => {
  it('transitions SCHEDULED to IN_PROGRESS for assigned inspector', async () => {
    const insp = makeInspection({
      status: InspectionStatus.SCHEDULED,
      inspectorUserId: ACTOR_INSPECTOR.id,
    });
    mockInspectionFindUnique.mockResolvedValue(insp);
    mockTxInspectionUpdateMany.mockResolvedValue({ count: 1 });
    const started = makeInspection({ status: InspectionStatus.IN_PROGRESS });
    mockTxInspectionFindUniqueOrThrow.mockResolvedValue(started);
    mockTxActivityCreate.mockResolvedValue({});

    const result = await service.start('insp-id-1', ACTOR_INSPECTOR);
    expect(result).toMatchObject({ status: InspectionStatus.IN_PROGRESS });
  });

  it('denies start from non-inspector without safety.manage', async () => {
    const insp = makeInspection({
      status: InspectionStatus.SCHEDULED,
      inspectorUserId: 'someone-else',
    });
    mockInspectionFindUnique.mockResolvedValue(insp);

    await expect(service.start('insp-id-1', ACTOR_INSPECTOR)).rejects.toThrow(ForbiddenException);
  });

  it('allows safety.manage to start even if not inspector', async () => {
    const insp = makeInspection({
      status: InspectionStatus.SCHEDULED,
      inspectorUserId: 'someone-else',
    });
    mockInspectionFindUnique.mockResolvedValue(insp);
    mockTxInspectionUpdateMany.mockResolvedValue({ count: 1 });
    const started = makeInspection({ status: InspectionStatus.IN_PROGRESS });
    mockTxInspectionFindUniqueOrThrow.mockResolvedValue(started);
    mockTxActivityCreate.mockResolvedValue({});

    await expect(service.start('insp-id-1', ACTOR_ADMIN)).resolves.not.toThrow();
  });

  it('rejects starting non-SCHEDULED inspection', async () => {
    const insp = makeInspection({ status: InspectionStatus.DRAFT });
    mockInspectionFindUnique.mockResolvedValue(insp);

    await expect(service.start('insp-id-1', ACTOR_INSPECTOR)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});

// ---------------------------------------------------------------------------
// Complete
// ---------------------------------------------------------------------------

describe('SafetyService.complete', () => {
  it('transitions IN_PROGRESS to COMPLETED with conclusion', async () => {
    const insp = makeInspection({
      status: InspectionStatus.IN_PROGRESS,
      inspectorUserId: ACTOR_INSPECTOR.id,
    });
    mockInspectionFindUnique.mockResolvedValue(insp);
    mockTxInspectionUpdateMany.mockResolvedValue({ count: 1 });
    const completed = makeInspection({
      status: InspectionStatus.COMPLETED,
      conclusion: 'No critical findings.',
    });
    mockTxInspectionFindUniqueOrThrow.mockResolvedValue(completed);
    mockTxActivityCreate.mockResolvedValue({});
    mockTxAuditCreate.mockResolvedValue({});

    const result = await service.complete(
      'insp-id-1',
      { conclusion: 'No critical findings.' },
      ACTOR_INSPECTOR,
    );
    expect(result).toMatchObject({ status: InspectionStatus.COMPLETED });
  });

  it('rejects blank conclusion', async () => {
    const insp = makeInspection({
      status: InspectionStatus.IN_PROGRESS,
      inspectorUserId: ACTOR_INSPECTOR.id,
    });
    mockInspectionFindUnique.mockResolvedValue(insp);

    await expect(
      service.complete('insp-id-1', { conclusion: '   ' }, ACTOR_INSPECTOR),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('denies non-inspector without safety.manage', async () => {
    const insp = makeInspection({
      status: InspectionStatus.IN_PROGRESS,
      inspectorUserId: 'someone-else',
    });
    mockInspectionFindUnique.mockResolvedValue(insp);

    await expect(
      service.complete('insp-id-1', { conclusion: 'Done.' }, ACTOR_INSPECTOR),
    ).rejects.toThrow(ForbiddenException);
  });
});

// ---------------------------------------------------------------------------
// Close
// ---------------------------------------------------------------------------

describe('SafetyService.close', () => {
  it('transitions COMPLETED to CLOSED', async () => {
    const insp = makeInspection({ status: InspectionStatus.COMPLETED });
    mockInspectionFindUnique.mockResolvedValue(insp);
    mockTxInspectionUpdateMany.mockResolvedValue({ count: 1 });
    const closed = makeInspection({ status: InspectionStatus.CLOSED });
    mockTxInspectionFindUniqueOrThrow.mockResolvedValue(closed);
    mockTxActivityCreate.mockResolvedValue({});
    mockTxAuditCreate.mockResolvedValue({});

    const result = await service.close('insp-id-1', ACTOR_ADMIN);
    expect(result).toMatchObject({ status: InspectionStatus.CLOSED });
  });

  it('rejects closing non-COMPLETED inspection', async () => {
    const insp = makeInspection({ status: InspectionStatus.IN_PROGRESS });
    mockInspectionFindUnique.mockResolvedValue(insp);

    await expect(service.close('insp-id-1', ACTOR_ADMIN)).rejects.toThrow(UnprocessableEntityException);
  });
});

// ---------------------------------------------------------------------------
// Reopen inspection
// ---------------------------------------------------------------------------

describe('SafetyService.reopen', () => {
  it('transitions CLOSED to IN_PROGRESS and clears lifecycle timestamps', async () => {
    const insp = makeInspection({
      status: InspectionStatus.CLOSED,
      closedAt: new Date('2026-07-01'),
      completedAt: new Date('2026-07-01'),
    });
    mockInspectionFindUnique.mockResolvedValue(insp);
    mockTxInspectionUpdateMany.mockResolvedValue({ count: 1 });
    const reopened = makeInspection({
      status: InspectionStatus.IN_PROGRESS,
      closedAt: null,
      completedAt: null,
    });
    mockTxInspectionFindUniqueOrThrow.mockResolvedValue(reopened);
    mockTxActivityCreate.mockResolvedValue({});
    mockTxAuditCreate.mockResolvedValue({});

    const result = await service.reopen('insp-id-1', { reason: 'New information found' }, ACTOR_ADMIN);
    expect(result).toMatchObject({ status: InspectionStatus.IN_PROGRESS, closedAt: null });
  });

  it('requires a non-empty reason', async () => {
    const insp = makeInspection({ status: InspectionStatus.CLOSED });
    mockInspectionFindUnique.mockResolvedValue(insp);

    await expect(
      service.reopen('insp-id-1', { reason: '   ' }, ACTOR_ADMIN),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects reopening non-CLOSED inspection', async () => {
    const insp = makeInspection({ status: InspectionStatus.COMPLETED });
    mockInspectionFindUnique.mockResolvedValue(insp);

    await expect(
      service.reopen('insp-id-1', { reason: 'Reason' }, ACTOR_ADMIN),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

describe('SafetyService.cancel', () => {
  it('allows creator to cancel own DRAFT', async () => {
    const insp = makeInspection({ createdByUserId: ACTOR_VIEWER.id });
    mockInspectionFindUnique.mockResolvedValue(insp);
    mockTxInspectionUpdateMany.mockResolvedValue({ count: 1 });
    const cancelled = makeInspection({ status: InspectionStatus.CANCELLED });
    mockTxInspectionFindUniqueOrThrow.mockResolvedValue(cancelled);
    mockTxActivityCreate.mockResolvedValue({});
    mockTxAuditCreate.mockResolvedValue({});

    const result = await service.cancel('insp-id-1', { reason: 'Not needed' }, ACTOR_VIEWER);
    expect(result).toMatchObject({ status: InspectionStatus.CANCELLED });
  });

  it('denies non-creator without safety.manage cancelling SCHEDULED', async () => {
    const insp = makeInspection({
      status: InspectionStatus.SCHEDULED,
      createdByUserId: 'someone-else',
    });
    mockInspectionFindUnique.mockResolvedValue(insp);

    await expect(
      service.cancel('insp-id-1', { reason: 'Cancelling' }, ACTOR_VIEWER),
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires a non-empty cancellation reason', async () => {
    const insp = makeInspection({ createdByUserId: ACTOR_VIEWER.id });
    mockInspectionFindUnique.mockResolvedValue(insp);

    await expect(
      service.cancel('insp-id-1', { reason: '' }, ACTOR_VIEWER),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects cancelling COMPLETED inspection', async () => {
    const insp = makeInspection({ status: InspectionStatus.COMPLETED });
    mockInspectionFindUnique.mockResolvedValue(insp);

    await expect(
      service.cancel('insp-id-1', { reason: 'Reason' }, ACTOR_ADMIN),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});

// ---------------------------------------------------------------------------
// Findings — Create
// ---------------------------------------------------------------------------

describe('SafetyService.createFinding', () => {
  it('creates a finding when inspection is IN_PROGRESS', async () => {
    const insp = makeInspection({ status: InspectionStatus.IN_PROGRESS });
    mockInspectionFindUnique.mockResolvedValue(insp);
    const finding = makeFinding();
    mockTxFindingCreate.mockResolvedValue(finding);
    mockTxActivityCreate.mockResolvedValue({});
    mockTxAuditCreate.mockResolvedValue({});

    const result = await service.createFinding(
      'insp-id-1',
      { title: 'Missing signage', description: 'Exit signs missing', severity: 'HIGH' },
      ACTOR_INSPECTOR,
    );
    expect(result).toEqual(finding);
  });

  it('creates a finding when inspection is COMPLETED', async () => {
    const insp = makeInspection({ status: InspectionStatus.COMPLETED });
    mockInspectionFindUnique.mockResolvedValue(insp);
    const finding = makeFinding();
    mockTxFindingCreate.mockResolvedValue(finding);
    mockTxActivityCreate.mockResolvedValue({});
    mockTxAuditCreate.mockResolvedValue({});

    await expect(
      service.createFinding(
        'insp-id-1',
        { title: 'Missing signage', description: 'Exit signs missing', severity: 'MEDIUM' },
        ACTOR_INSPECTOR,
      ),
    ).resolves.not.toThrow();
  });

  it('rejects finding creation on DRAFT inspection', async () => {
    const insp = makeInspection({ status: InspectionStatus.DRAFT });
    mockInspectionFindUnique.mockResolvedValue(insp);

    await expect(
      service.createFinding(
        'insp-id-1',
        { title: 'Finding', description: 'Description', severity: 'LOW' },
        ACTOR_INSPECTOR,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects invalid severity', async () => {
    const insp = makeInspection({ status: InspectionStatus.IN_PROGRESS });
    mockInspectionFindUnique.mockResolvedValue(insp);

    await expect(
      service.createFinding(
        'insp-id-1',
        { title: 'Finding', description: 'Description', severity: 'EXTREME' },
        ACTOR_INSPECTOR,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});

// ---------------------------------------------------------------------------
// Findings — Assign
// ---------------------------------------------------------------------------

describe('SafetyService.assignFinding', () => {
  it('assigns an active user to an OPEN finding', async () => {
    const insp = makeInspection({ status: InspectionStatus.IN_PROGRESS });
    mockInspectionFindUnique.mockResolvedValue(insp);
    const finding = makeFinding();
    mockFindingFindUnique.mockResolvedValue(finding);
    mockUserFindUnique.mockResolvedValue({ id: 'user-inspector-1', isActive: true });
    mockTxFindingUpdateMany.mockResolvedValue({ count: 1 });
    const assigned = makeFinding({ assignedToUserId: 'user-inspector-1' });
    mockTxFindingFindUniqueOrThrow.mockResolvedValue(assigned);
    mockTxActivityCreate.mockResolvedValue({});
    mockTxAuditCreate.mockResolvedValue({});

    const result = await service.assignFinding(
      'insp-id-1', 'finding-id-1',
      { assignedToUserId: 'user-inspector-1' },
      ACTOR_ADMIN,
    );
    expect(result).toMatchObject({ assignedToUserId: 'user-inspector-1' });
  });

  it('rejects assigning inactive user', async () => {
    const insp = makeInspection({ status: InspectionStatus.IN_PROGRESS });
    mockInspectionFindUnique.mockResolvedValue(insp);
    const finding = makeFinding();
    mockFindingFindUnique.mockResolvedValue(finding);
    mockUserFindUnique.mockResolvedValue({ id: 'inactive-user', isActive: false });

    await expect(
      service.assignFinding(
        'insp-id-1', 'finding-id-1',
        { assignedToUserId: 'inactive-user' },
        ACTOR_ADMIN,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects assigning RESOLVED finding', async () => {
    const insp = makeInspection({ status: InspectionStatus.IN_PROGRESS });
    mockInspectionFindUnique.mockResolvedValue(insp);
    const finding = makeFinding({ status: FindingStatus.RESOLVED });
    mockFindingFindUnique.mockResolvedValue(finding);
    mockUserFindUnique.mockResolvedValue({ id: 'user-inspector-1', isActive: true });

    await expect(
      service.assignFinding(
        'insp-id-1', 'finding-id-1',
        { assignedToUserId: 'user-inspector-1' },
        ACTOR_ADMIN,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});

// ---------------------------------------------------------------------------
// Findings — Resolve
// ---------------------------------------------------------------------------

describe('SafetyService.resolveFinding', () => {
  it('resolves an OPEN finding with resolution summary', async () => {
    const insp = makeInspection({ status: InspectionStatus.IN_PROGRESS });
    mockInspectionFindUnique.mockResolvedValue(insp);
    const finding = makeFinding({ assignedToUserId: ACTOR_INSPECTOR.id });
    mockFindingFindUnique.mockResolvedValue(finding);
    mockTxFindingUpdateMany.mockResolvedValue({ count: 1 });
    const resolved = makeFinding({
      status: FindingStatus.RESOLVED,
      resolutionSummary: 'Installed new signs.',
      resolvedByUserId: ACTOR_INSPECTOR.id,
    });
    mockTxFindingFindUniqueOrThrow.mockResolvedValue(resolved);
    mockTxActivityCreate.mockResolvedValue({});
    mockTxAuditCreate.mockResolvedValue({});

    const result = await service.resolveFinding(
      'insp-id-1', 'finding-id-1',
      { resolutionSummary: 'Installed new signs.' },
      ACTOR_INSPECTOR,
    );
    expect(result).toMatchObject({ status: FindingStatus.RESOLVED });
  });

  it('requires non-empty resolution summary', async () => {
    const insp = makeInspection({ status: InspectionStatus.IN_PROGRESS });
    mockInspectionFindUnique.mockResolvedValue(insp);
    const finding = makeFinding({ assignedToUserId: ACTOR_INSPECTOR.id });
    mockFindingFindUnique.mockResolvedValue(finding);

    await expect(
      service.resolveFinding(
        'insp-id-1', 'finding-id-1',
        { resolutionSummary: '   ' },
        ACTOR_INSPECTOR,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('denies non-assignee without safety.manage', async () => {
    const insp = makeInspection({ status: InspectionStatus.IN_PROGRESS });
    mockInspectionFindUnique.mockResolvedValue(insp);
    const finding = makeFinding({ assignedToUserId: 'someone-else' });
    mockFindingFindUnique.mockResolvedValue(finding);

    await expect(
      service.resolveFinding(
        'insp-id-1', 'finding-id-1',
        { resolutionSummary: 'Fixed.' },
        ACTOR_INSPECTOR,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

// ---------------------------------------------------------------------------
// Findings — Verify
// ---------------------------------------------------------------------------

describe('SafetyService.verifyFinding', () => {
  it('verifies a RESOLVED finding by a different user', async () => {
    const insp = makeInspection({ status: InspectionStatus.IN_PROGRESS });
    mockInspectionFindUnique.mockResolvedValue(insp);
    const finding = makeFinding({
      status: FindingStatus.RESOLVED,
      resolvedByUserId: 'user-inspector-1',
    });
    mockFindingFindUnique.mockResolvedValue(finding);
    mockTxFindingUpdateMany.mockResolvedValue({ count: 1 });
    const verified = makeFinding({ status: FindingStatus.VERIFIED });
    mockTxFindingFindUniqueOrThrow.mockResolvedValue(verified);
    mockTxActivityCreate.mockResolvedValue({});
    mockTxAuditCreate.mockResolvedValue({});

    const result = await service.verifyFinding('insp-id-1', 'finding-id-1', ACTOR_ADMIN);
    expect(result).toMatchObject({ status: FindingStatus.VERIFIED });
  });

  it('enforces verifier separation of duties — same user as resolver rejected', async () => {
    const insp = makeInspection({ status: InspectionStatus.IN_PROGRESS });
    mockInspectionFindUnique.mockResolvedValue(insp);
    const finding = makeFinding({
      status: FindingStatus.RESOLVED,
      resolvedByUserId: ACTOR_INSPECTOR.id,
    });
    mockFindingFindUnique.mockResolvedValue(finding);

    await expect(
      service.verifyFinding('insp-id-1', 'finding-id-1', ACTOR_INSPECTOR),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows safety.manage to verify own resolution', async () => {
    const insp = makeInspection({ status: InspectionStatus.IN_PROGRESS });
    mockInspectionFindUnique.mockResolvedValue(insp);
    const finding = makeFinding({
      status: FindingStatus.RESOLVED,
      resolvedByUserId: ACTOR_ADMIN.id,
    });
    mockFindingFindUnique.mockResolvedValue(finding);
    mockTxFindingUpdateMany.mockResolvedValue({ count: 1 });
    const verified = makeFinding({ status: FindingStatus.VERIFIED });
    mockTxFindingFindUniqueOrThrow.mockResolvedValue(verified);
    mockTxActivityCreate.mockResolvedValue({});
    mockTxAuditCreate.mockResolvedValue({});

    await expect(
      service.verifyFinding('insp-id-1', 'finding-id-1', ACTOR_ADMIN),
    ).resolves.not.toThrow();
  });

  it('rejects verifying non-RESOLVED finding', async () => {
    const insp = makeInspection({ status: InspectionStatus.IN_PROGRESS });
    mockInspectionFindUnique.mockResolvedValue(insp);
    const finding = makeFinding({ status: FindingStatus.OPEN });
    mockFindingFindUnique.mockResolvedValue(finding);

    await expect(
      service.verifyFinding('insp-id-1', 'finding-id-1', ACTOR_ADMIN),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});

// ---------------------------------------------------------------------------
// Findings — Close
// ---------------------------------------------------------------------------

describe('SafetyService.closeFinding', () => {
  it('closes a VERIFIED finding', async () => {
    const insp = makeInspection({ status: InspectionStatus.COMPLETED });
    mockInspectionFindUnique.mockResolvedValue(insp);
    const finding = makeFinding({ status: FindingStatus.VERIFIED });
    mockFindingFindUnique.mockResolvedValue(finding);
    mockTxFindingUpdateMany.mockResolvedValue({ count: 1 });
    const closed = makeFinding({ status: FindingStatus.CLOSED });
    mockTxFindingFindUniqueOrThrow.mockResolvedValue(closed);
    mockTxActivityCreate.mockResolvedValue({});

    const result = await service.closeFinding('insp-id-1', 'finding-id-1', ACTOR_ADMIN);
    expect(result).toMatchObject({ status: FindingStatus.CLOSED });
  });

  it('rejects closing non-VERIFIED finding', async () => {
    const insp = makeInspection({ status: InspectionStatus.COMPLETED });
    mockInspectionFindUnique.mockResolvedValue(insp);
    const finding = makeFinding({ status: FindingStatus.RESOLVED });
    mockFindingFindUnique.mockResolvedValue(finding);

    await expect(service.closeFinding('insp-id-1', 'finding-id-1', ACTOR_ADMIN)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});

// ---------------------------------------------------------------------------
// Findings — Reopen
// ---------------------------------------------------------------------------

describe('SafetyService.reopenFinding', () => {
  it('reopens a RESOLVED finding to ACTION_REQUIRED', async () => {
    const insp = makeInspection({ status: InspectionStatus.COMPLETED });
    mockInspectionFindUnique.mockResolvedValue(insp);
    const finding = makeFinding({
      status: FindingStatus.RESOLVED,
      resolvedByUserId: 'some-user',
    });
    mockFindingFindUnique.mockResolvedValue(finding);
    mockTxFindingUpdateMany.mockResolvedValue({ count: 1 });
    const reopened = makeFinding({ status: FindingStatus.ACTION_REQUIRED });
    mockTxFindingFindUniqueOrThrow.mockResolvedValue(reopened);
    mockTxActivityCreate.mockResolvedValue({});
    mockTxAuditCreate.mockResolvedValue({});

    const result = await service.reopenFinding(
      'insp-id-1', 'finding-id-1',
      { reason: 'Not fully resolved' },
      ACTOR_ADMIN,
    );
    expect(result).toMatchObject({ status: FindingStatus.ACTION_REQUIRED });
  });

  it('requires a non-empty reopen reason', async () => {
    const insp = makeInspection({ status: InspectionStatus.COMPLETED });
    mockInspectionFindUnique.mockResolvedValue(insp);
    const finding = makeFinding({ status: FindingStatus.VERIFIED });
    mockFindingFindUnique.mockResolvedValue(finding);

    await expect(
      service.reopenFinding('insp-id-1', 'finding-id-1', { reason: '   ' }, ACTOR_ADMIN),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects reopening OPEN finding', async () => {
    const insp = makeInspection({ status: InspectionStatus.IN_PROGRESS });
    mockInspectionFindUnique.mockResolvedValue(insp);
    const finding = makeFinding({ status: FindingStatus.OPEN });
    mockFindingFindUnique.mockResolvedValue(finding);

    await expect(
      service.reopenFinding('insp-id-1', 'finding-id-1', { reason: 'Reason' }, ACTOR_ADMIN),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

describe('SafetyService.addComment', () => {
  it('adds a non-blank comment', async () => {
    const insp = makeInspection({ status: InspectionStatus.IN_PROGRESS });
    mockInspectionFindUnique.mockResolvedValue(insp);
    const comment = { id: 'cmt-1', body: 'Looks good.', createdAt: new Date(), authorUser: null };
    mockTxCommentCreate.mockResolvedValue(comment);
    mockTxActivityCreate.mockResolvedValue({});

    const result = await service.addComment('insp-id-1', { body: 'Looks good.' }, ACTOR_VIEWER);
    expect(result).toEqual(comment);
  });

  it('rejects blank comment body', async () => {
    const insp = makeInspection({ status: InspectionStatus.IN_PROGRESS });
    mockInspectionFindUnique.mockResolvedValue(insp);

    await expect(
      service.addComment('insp-id-1', { body: '   ' }, ACTOR_VIEWER),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});

// ---------------------------------------------------------------------------
// Not found
// ---------------------------------------------------------------------------

describe('SafetyService.findOne', () => {
  it('throws SAFETY_NOT_FOUND for unknown id', async () => {
    mockInspectionFindUnique.mockResolvedValue(null);

    await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

describe('SafetyService.getSummary', () => {
  it('returns 5 metrics', async () => {
    mockInspectionCount.mockResolvedValue(3);
    mockFindingCount.mockResolvedValue(7);

    const result = await service.getSummary();
    expect(result).toHaveProperty('scheduledInspections');
    expect(result).toHaveProperty('openFindings');
    expect(result).toHaveProperty('criticalFindings');
    expect(result).toHaveProperty('overdueFindings');
    expect(result).toHaveProperty('inProgressInspections');
  });
});

// ---------------------------------------------------------------------------
// findAll
// ---------------------------------------------------------------------------

describe('SafetyService.findAll', () => {
  it('returns paginated results with defaults', async () => {
    mockInspectionFindMany.mockResolvedValue([makeInspection()]);
    mockInspectionCount.mockResolvedValue(1);

    const result = await service.findAll({});
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('applies status filter', async () => {
    mockInspectionFindMany.mockResolvedValue([]);
    mockInspectionCount.mockResolvedValue(0);

    await service.findAll({ status: 'SCHEDULED' });
    expect(mockInspectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'SCHEDULED' }),
      }),
    );
  });
});
