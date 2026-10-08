import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { DepartmentAccessScope, TechnicalStage, TechnicalWorkflowStatus, TechnicalDrawingStatus, TechnicalSdSubmissionStatus, TechnicalApprovalStatus, TechnicalApprovalRecordStatus, TechnicalFdStatus } from '@recafco/database';
import { TechnicalService, nextStageOf, TECHNICAL_STAGE_LABELS } from './technical.service';
import type { SaveDrawingReceivedDto } from './dto/save-drawing-received.dto';
import type { SaveSdCalculationSubmissionDto } from './dto/save-sd-calculation-submission.dto';
import type { SaveGettingApprovalDto } from './dto/save-getting-approval.dto';
import type { SaveFdIssuanceDto } from './dto/save-fd-issuance.dto';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { TechnicalAttachmentStorageService } from './technical-attachment-storage.service';

// ---------------------------------------------------------------------------
// Mock infrastructure — mirrors incidents.service.test.ts's own shape.
// ---------------------------------------------------------------------------

const mockContractFindUnique = vi.fn();
const mockContractFindMany = vi.fn();
const mockContractCount = vi.fn();
const mockWorkflowFindUnique = vi.fn();
const mockWorkflowCreate = vi.fn();
const mockWorkflowUpdate = vi.fn();
const mockWorkflowCount = vi.fn();
const mockDrawingFindFirst = vi.fn();
const mockDrawingFindMany = vi.fn();
const mockDrawingCreate = vi.fn();
const mockDrawingUpdate = vi.fn();
const mockWorkflowFindMany = vi.fn();
const mockActivityCreate = vi.fn();
const mockActivityFindMany = vi.fn();
const mockAttachmentFindMany = vi.fn();
const mockAttachmentFindFirst = vi.fn();
const mockAttachmentCreate = vi.fn();
const mockAttachmentDelete = vi.fn();
const mockSdFindFirst = vi.fn();
const mockSdFindMany = vi.fn();
const mockSdCreate = vi.fn();
const mockSdUpdate = vi.fn();
const mockSdCount = vi.fn();
const mockSdAttachmentFindMany = vi.fn();
const mockSdAttachmentFindFirst = vi.fn();
const mockSdAttachmentCreate = vi.fn();
const mockSdAttachmentDelete = vi.fn();
const mockApprovalFindFirst = vi.fn();
const mockApprovalFindMany = vi.fn();
const mockApprovalCreate = vi.fn();
const mockApprovalUpdate = vi.fn();
const mockApprovalAttachmentFindMany = vi.fn();
const mockApprovalAttachmentFindFirst = vi.fn();
const mockApprovalAttachmentCreate = vi.fn();
const mockApprovalAttachmentDelete = vi.fn();
const mockFdFindFirst = vi.fn();
const mockFdFindMany = vi.fn();
const mockFdCreate = vi.fn();
const mockFdUpdate = vi.fn();
const mockFdCount = vi.fn();
const mockFdAttachmentFindMany = vi.fn();
const mockFdAttachmentFindFirst = vi.fn();
const mockFdAttachmentCreate = vi.fn();
const mockFdAttachmentDelete = vi.fn();
// FMP-UI-31 — TechnicalBoqAttentionSummary's own read-only queries.
const mockBoqConfirmationFindMany = vi.fn();
const mockBoqConfirmationGroupBy = vi.fn();
const mockBoqPieceGroupBy = vi.fn();

const mockClient = {
  contract: {
    findUnique: mockContractFindUnique,
    findMany: mockContractFindMany,
    count: mockContractCount,
  },
  technicalWorkflow: {
    findUnique: mockWorkflowFindUnique,
    findMany: mockWorkflowFindMany,
    create: mockWorkflowCreate,
    update: mockWorkflowUpdate,
    count: mockWorkflowCount,
  },
  technicalDrawing: {
    findFirst: mockDrawingFindFirst,
    findMany: mockDrawingFindMany,
    create: mockDrawingCreate,
    update: mockDrawingUpdate,
  },
  technicalWorkflowActivity: {
    create: mockActivityCreate,
    findMany: mockActivityFindMany,
  },
  technicalDrawingAttachment: {
    findMany: mockAttachmentFindMany,
    findFirst: mockAttachmentFindFirst,
    create: mockAttachmentCreate,
    delete: mockAttachmentDelete,
  },
  technicalSdCalculationSubmission: {
    findFirst: mockSdFindFirst,
    findMany: mockSdFindMany,
    create: mockSdCreate,
    update: mockSdUpdate,
  },
  technicalSdSubmissionAttachment: {
    findMany: mockSdAttachmentFindMany,
    findFirst: mockSdAttachmentFindFirst,
    create: mockSdAttachmentCreate,
    delete: mockSdAttachmentDelete,
    count: mockSdCount,
  },
  technicalApproval: {
    findFirst: mockApprovalFindFirst,
    findMany: mockApprovalFindMany,
    create: mockApprovalCreate,
    update: mockApprovalUpdate,
  },
  technicalApprovalAttachment: {
    findMany: mockApprovalAttachmentFindMany,
    findFirst: mockApprovalAttachmentFindFirst,
    create: mockApprovalAttachmentCreate,
    delete: mockApprovalAttachmentDelete,
  },
  technicalFdIssuance: {
    findFirst: mockFdFindFirst,
    findMany: mockFdFindMany,
    create: mockFdCreate,
    update: mockFdUpdate,
  },
  technicalFdIssuanceAttachment: {
    findMany: mockFdAttachmentFindMany,
    findFirst: mockFdAttachmentFindFirst,
    create: mockFdAttachmentCreate,
    delete: mockFdAttachmentDelete,
    count: mockFdCount,
  },
  contractBoqDrawingConfirmation: { findMany: mockBoqConfirmationFindMany, groupBy: mockBoqConfirmationGroupBy },
  contractBoqPiece: { groupBy: mockBoqPieceGroupBy },
  technicalDrawingGroup: { findMany: vi.fn().mockResolvedValue([]) },
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockBuildDeptFilter = vi.fn().mockResolvedValue(null);
const mockAssertCanAccessDept = vi.fn().mockResolvedValue(undefined);
const mockDeptAccess = {
  buildDeptFilter: mockBuildDeptFilter,
  getScope: vi.fn().mockResolvedValue(DepartmentAccessScope.ALL_DEPARTMENTS),
  canAccessDepartment: vi.fn().mockResolvedValue(true),
  assertCanAccessDepartment: mockAssertCanAccessDept,
} as unknown as DepartmentAccessService;

const mockAttachmentSave = vi.fn().mockResolvedValue({ fileName: 'abc.pdf', storagePath: 'drawing-1/abc.pdf' });
const mockAttachmentDeleteFile = vi.fn().mockResolvedValue(undefined);
const mockAttachmentStorage = {
  save: mockAttachmentSave,
  deleteFile: mockAttachmentDeleteFile,
  createReadStream: vi.fn(),
} as unknown as TechnicalAttachmentStorageService;

const ACTOR_READER: AuthUser = {
  id: 'user-1',
  username: 'alice',
  displayName: 'Alice',
  roleId: 'role-1',
  roleCode: 'VIEWER',
  roleName: 'Viewer',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-1',
  departmentId: 'dept-a',
  permissions: ['contracts.read'],
};

const ACTOR_MANAGER: AuthUser = {
  ...ACTOR_READER,
  id: 'user-manager',
  username: 'manager',
  displayName: 'Manager Mo',
  permissions: ['contracts.read', 'contracts.update'],
};

const ACTOR_STAFF: AuthUser = {
  ...ACTOR_READER,
  id: 'user-staff',
  username: 'staff',
  displayName: 'Staff Sam',
  permissions: ['contracts.read', 'contracts.workflow_update'],
};

const CONTRACT_ROW = {
  id: 'contract-1',
  referenceNumber: 'CT-2026-0001',
  title: 'Admin Building Precast Works',
  jobOrder: 'JO-1001',
  quotationNumber: 'QTN-1',
  counterpartyName: 'Acme Group',
  departmentId: 'dept-a',
  status: 'ACTIVE',
  updatedAt: new Date('2026-09-01T00:00:00Z'),
  ownerUser: { id: 'owner-1', displayName: 'Owner Olivia' },
};

const WORKFLOW_ROW = {
  id: 'wf-1',
  contractId: 'contract-1',
  currentStage: TechnicalStage.DRAWING_RECEIVED,
  status: TechnicalWorkflowStatus.IN_PROGRESS,
  priority: 'NORMAL',
  assignedDepartment: 'TECHNICAL',
  assignedToUserId: null,
  createdByUserId: 'user-manager',
  startedAt: new Date('2026-09-01T00:00:00Z'),
  completedAt: null,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-01T00:00:00Z'),
};

const WORKFLOW_AT_SD = { ...WORKFLOW_ROW, currentStage: TechnicalStage.SD_CALCULATION_SUBMISSION };
const WORKFLOW_AT_APPROVAL = { ...WORKFLOW_ROW, currentStage: TechnicalStage.GETTING_APPROVAL };
const WORKFLOW_AT_FD = { ...WORKFLOW_ROW, currentStage: TechnicalStage.FD_ISSUANCE };

const COMPLETED_DRAWING_ROW = {
  id: 'drawing-1',
  technicalWorkflowId: 'wf-1',
  status: TechnicalDrawingStatus.COMPLETED,
};

const SUBMITTED_SD_ROW = {
  id: 'sd-1',
  technicalWorkflowId: 'wf-1',
  status: TechnicalSdSubmissionStatus.SUBMITTED,
};

function buildService(): TechnicalService {
  return new TechnicalService(mockDb, mockDeptAccess, mockAttachmentStorage);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildDeptFilter.mockResolvedValue(null);
  mockAssertCanAccessDept.mockResolvedValue(undefined);
  mockContractFindUnique.mockResolvedValue(CONTRACT_ROW);
  // Dashboard's Needs Attention / Recent Activity queries — empty by
  // default so tests that don't care about them don't need to mock each one.
  mockDrawingFindMany.mockResolvedValue([]);
  mockWorkflowFindMany.mockResolvedValue([]);
  mockActivityFindMany.mockResolvedValue([]);
  // SD & Calculation Submission defaults — a completed Drawing Received
  // record exists (the common case once a workflow reaches this stage).
  mockDrawingFindFirst.mockResolvedValue(COMPLETED_DRAWING_ROW);
  mockSdCount.mockResolvedValue(1);
  mockSdFindMany.mockResolvedValue([]);
  // Getting Approval defaults — a submitted SD & Calculation record exists
  // (the common case once a workflow reaches this stage).
  mockSdFindFirst.mockResolvedValue(SUBMITTED_SD_ROW);
  mockApprovalFindMany.mockResolvedValue([]);
  // FD Issuance defaults — dashboard's overdue-FD-issue-date query is empty
  // by default, and a completed-count fallback matches the SD/Approval ones.
  mockFdFindMany.mockResolvedValue([]);
  mockFdCount.mockResolvedValue(1);
  mockBoqConfirmationFindMany.mockResolvedValue([]);
  mockBoqConfirmationGroupBy.mockResolvedValue([]);
  mockBoqPieceGroupBy.mockResolvedValue([]);
});

describe('nextStageOf', () => {
  it('walks the 4 stages in order and returns null after FD Issuance', () => {
    expect(nextStageOf(TechnicalStage.DRAWING_RECEIVED)).toBe(TechnicalStage.SD_CALCULATION_SUBMISSION);
    expect(nextStageOf(TechnicalStage.SD_CALCULATION_SUBMISSION)).toBe(TechnicalStage.GETTING_APPROVAL);
    expect(nextStageOf(TechnicalStage.GETTING_APPROVAL)).toBe(TechnicalStage.FD_ISSUANCE);
    expect(nextStageOf(TechnicalStage.FD_ISSUANCE)).toBeNull();
  });

  it('has a human label for every stage', () => {
    for (const stage of Object.values(TechnicalStage)) {
      expect(TECHNICAL_STAGE_LABELS[stage]).toBeTruthy();
    }
  });
});

describe('TechnicalService — permissions', () => {
  it('getDashboard rejects an actor without contracts.read', async () => {
    const service = buildService();
    const noAccess: AuthUser = { ...ACTOR_READER, permissions: [] };
    await expect(service.getDashboard(noAccess)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('startWorkflow rejects an actor without contracts.update or contracts.workflow_update', async () => {
    const service = buildService();
    await expect(service.startWorkflow('contract-1', ACTOR_READER)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('startWorkflow accepts contracts.workflow_update alone (Contract Staff)', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(null);
    mockWorkflowCreate.mockResolvedValue(WORKFLOW_ROW);
    await expect(service.startWorkflow('contract-1', ACTOR_STAFF)).resolves.toEqual(WORKFLOW_ROW);
  });
});

describe('TechnicalService — getDashboard', () => {
  it('computes every metric from real counts, never fabricated', async () => {
    const service = buildService();
    mockContractCount.mockResolvedValue(3);
    mockWorkflowCount.mockResolvedValue(2);
    mockContractFindMany.mockResolvedValue([
      { ...CONTRACT_ROW, technicalWorkflow: null },
      {
        ...CONTRACT_ROW,
        id: 'contract-2',
        technicalWorkflow: {
          currentStage: TechnicalStage.GETTING_APPROVAL,
          status: TechnicalWorkflowStatus.IN_PROGRESS,
          priority: 'HIGH',
          updatedAt: CONTRACT_ROW.updatedAt,
          drawings: [{ plannedReviewStart: new Date('2026-09-10T00:00:00Z'), assignedToUser: { displayName: 'Rana Reviewer' } }],
        },
      },
    ]);

    const result = await service.getDashboard(ACTOR_MANAGER);

    expect(result.metrics.pendingTechnicalReview).toBe(3);
    expect(result.metrics.drawingReceived).toBe(2);
    expect(result.jobs).toHaveLength(2);
    expect(result.jobs[0]!.workflowStarted).toBe(false);
    expect(result.jobs[0]!.nextStage).toBe(TechnicalStage.DRAWING_RECEIVED);
    expect(result.jobs[0]!.dueDate).toBeNull();
    expect(result.jobs[0]!.assignedTo).toBeNull();
    expect(result.jobs[1]!.workflowStarted).toBe(true);
    expect(result.jobs[1]!.currentStage).toBe(TechnicalStage.GETTING_APPROVAL);
    expect(result.jobs[1]!.nextStage).toBe(TechnicalStage.FD_ISSUANCE);
    // Due date / assignee come from the latest real TechnicalDrawing row — never invented.
    expect(result.jobs[1]!.dueDate).toBe('2026-09-10T00:00:00.000Z');
    expect(result.jobs[1]!.assignedTo).toBe('Rana Reviewer');
    // Job Order No comes straight from the real contract row — never invented.
    expect(result.jobs[0]!.jobOrderNo).toBe('JO-1001');
  });

  it('computes the stage breakdown from the same real per-stage counts as the metrics (no extra query)', async () => {
    const service = buildService();
    mockContractCount.mockResolvedValue(0);
    mockWorkflowCount
      .mockResolvedValueOnce(4) // drawingReceived
      .mockResolvedValueOnce(3) // sdCalculationPending
      .mockResolvedValueOnce(2) // waitingApproval
      .mockResolvedValueOnce(1) // fdIssued
      .mockResolvedValueOnce(0); // readyForProductionRelease
    mockContractFindMany.mockResolvedValue([]);

    const result = await service.getDashboard(ACTOR_MANAGER);

    expect(result.stageBreakdown).toEqual({
      DRAWING_RECEIVED: 4,
      SD_CALCULATION_SUBMISSION: 3,
      GETTING_APPROVAL: 2,
      FD_ISSUANCE: 1,
    });
  });

  it('builds Needs Attention from real overdue/urgent/stale/clarification rows, not fabricated data', async () => {
    const service = buildService();
    mockContractCount.mockResolvedValue(0);
    mockWorkflowCount.mockResolvedValue(0);
    mockContractFindMany.mockResolvedValue([]);
    mockDrawingFindMany
      .mockResolvedValueOnce([
        { contractId: 'c-overdue', plannedReviewStart: new Date('2026-09-01T00:00:00Z'), contract: { jobOrder: 'JO-9', referenceNumber: 'CT-9', title: 'Overdue Job' } },
      ])
      .mockResolvedValueOnce([
        { contractId: 'c-stale', contract: { jobOrder: 'JO-8', referenceNumber: 'CT-8', title: 'Stale Job' } },
      ]);
    mockWorkflowFindMany
      .mockResolvedValueOnce([
        { contractId: 'c-urgent', contract: { jobOrder: 'JO-7', referenceNumber: 'CT-7', title: 'Urgent Job' } },
      ])
      .mockResolvedValueOnce([
        { contractId: 'c-waiting', updatedAt: new Date('2026-08-01T00:00:00Z'), contract: { jobOrder: 'JO-6', referenceNumber: 'CT-6', title: 'Waiting Job' } },
      ]);
    mockActivityFindMany.mockResolvedValue([
      {
        id: 'act-1',
        event: 'CLARIFICATION_REQUESTED',
        actorName: 'Cathy Clarifier',
        createdAt: new Date('2026-09-05T00:00:00Z'),
        previousStage: null,
        newStage: null,
        technicalWorkflowId: 'wf-clar',
        technicalWorkflow: { contractId: 'c-clarify', currentStage: TechnicalStage.DRAWING_RECEIVED, contract: { jobOrder: 'JO-5', referenceNumber: 'CT-5', title: 'Clarify Job' } },
      },
    ]);

    const result = await service.getDashboard(ACTOR_MANAGER);

    const reasons = result.needsAttention.map((i) => i.reason);
    expect(reasons).toEqual(
      expect.arrayContaining(['OVERDUE_PLANNED_REVIEW', 'URGENT_PRIORITY', 'DRAWING_RECEIVED_NOT_COMPLETED', 'WAITING_APPROVAL_TOO_LONG', 'CLARIFICATION_REQUESTED']),
    );
    expect(result.needsAttention).toHaveLength(5);
    expect(result.metrics.needsAttention).toBe(5);
    expect(result.needsAttention.find((i) => i.reason === 'CLARIFICATION_REQUESTED')?.jobOrderNo).toBe('JO-5');
  });

  it('builds Recent Activity from real technical_workflow_activities rows', async () => {
    const service = buildService();
    mockContractCount.mockResolvedValue(0);
    mockWorkflowCount.mockResolvedValue(0);
    mockContractFindMany.mockResolvedValue([]);
    mockActivityFindMany.mockResolvedValue([
      {
        id: 'act-1',
        event: 'DRAWING_RECEIVED_COMPLETED',
        actorName: 'Manager Mo',
        createdAt: new Date('2026-09-05T00:00:00Z'),
        previousStage: TechnicalStage.DRAWING_RECEIVED,
        newStage: TechnicalStage.SD_CALCULATION_SUBMISSION,
        technicalWorkflowId: 'wf-1',
        technicalWorkflow: { contractId: 'contract-1', currentStage: TechnicalStage.SD_CALCULATION_SUBMISSION, contract: { jobOrder: 'JO-1001', referenceNumber: 'CT-2026-0001', title: 'Admin Building Precast Works' } },
      },
    ]);

    const result = await service.getDashboard(ACTOR_MANAGER);

    expect(result.recentActivities).toHaveLength(1);
    expect(result.recentActivities[0]).toMatchObject({
      event: 'DRAWING_RECEIVED_COMPLETED',
      jobOrderNo: 'JO-1001',
      stage: TechnicalStage.SD_CALCULATION_SUBMISSION,
      actorName: 'Manager Mo',
    });
  });

  it('applies the department filter to every count and the jobs list', async () => {
    const service = buildService();
    mockBuildDeptFilter.mockResolvedValue('dept-a');
    mockContractCount.mockResolvedValue(0);
    mockWorkflowCount.mockResolvedValue(0);
    mockContractFindMany.mockResolvedValue([]);

    await service.getDashboard(ACTOR_MANAGER);

    expect(mockContractFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ departmentId: 'dept-a' }) }),
    );
  });

  describe('boqAttention', () => {
    it('is all zero, and queries nothing, when no job has a started workflow', async () => {
      const service = buildService();
      mockContractCount.mockResolvedValue(0);
      mockWorkflowCount.mockResolvedValue(0);
      mockContractFindMany.mockResolvedValue([{ ...CONTRACT_ROW, technicalWorkflow: null }]);

      const result = await service.getDashboard(ACTOR_MANAGER);

      expect(result.boqAttention).toEqual({ missingBoqConfirmation: 0, confirmedPiecesNotGenerated: 0, rejectedOrHoldPieces: 0 });
      expect(mockBoqConfirmationFindMany).not.toHaveBeenCalled();
    });

    it('scopes every BOQ query to only the jobs with a started workflow', async () => {
      const service = buildService();
      mockContractCount.mockResolvedValue(0);
      mockWorkflowCount.mockResolvedValue(0);
      mockContractFindMany.mockResolvedValue([
        { ...CONTRACT_ROW, id: 'c-not-started', technicalWorkflow: null },
        {
          ...CONTRACT_ROW,
          id: 'c-started',
          technicalWorkflow: {
            currentStage: TechnicalStage.DRAWING_RECEIVED, status: TechnicalWorkflowStatus.IN_PROGRESS,
            priority: 'MEDIUM', updatedAt: CONTRACT_ROW.updatedAt, drawings: [],
          },
        },
      ]);

      await service.getDashboard(ACTOR_MANAGER);

      expect(mockBoqConfirmationFindMany.mock.calls[0]![0].where.contractId).toEqual({ in: ['c-started'] });
      expect(mockBoqConfirmationGroupBy.mock.calls[0]![0].where.contractId).toEqual({ in: ['c-started'] });
      expect(mockBoqPieceGroupBy.mock.calls[0]![0].where.contractId).toEqual({ in: ['c-started'] });
    });

    it('counts missingBoqConfirmation as jobs with no CONFIRMED confirmation at all', async () => {
      const service = buildService();
      mockContractCount.mockResolvedValue(0);
      mockWorkflowCount.mockResolvedValue(0);
      mockContractFindMany.mockResolvedValue([
        { ...CONTRACT_ROW, id: 'c-1', technicalWorkflow: { currentStage: TechnicalStage.DRAWING_RECEIVED, status: TechnicalWorkflowStatus.IN_PROGRESS, priority: null, updatedAt: CONTRACT_ROW.updatedAt, drawings: [] } },
        { ...CONTRACT_ROW, id: 'c-2', technicalWorkflow: { currentStage: TechnicalStage.DRAWING_RECEIVED, status: TechnicalWorkflowStatus.IN_PROGRESS, priority: null, updatedAt: CONTRACT_ROW.updatedAt, drawings: [] } },
      ]);
      mockBoqConfirmationFindMany.mockResolvedValue([{ contractId: 'c-1' }]);

      const result = await service.getDashboard(ACTOR_MANAGER);

      // c-1 has a confirmation, c-2 doesn't -> 1 of 2 missing.
      expect(result.boqAttention.missingBoqConfirmation).toBe(1);
    });

    it('counts confirmedPiecesNotGenerated when confirmed exceeds generated for a job', async () => {
      const service = buildService();
      mockContractCount.mockResolvedValue(0);
      mockWorkflowCount.mockResolvedValue(0);
      mockContractFindMany.mockResolvedValue([
        { ...CONTRACT_ROW, id: 'c-1', technicalWorkflow: { currentStage: TechnicalStage.DRAWING_RECEIVED, status: TechnicalWorkflowStatus.IN_PROGRESS, priority: null, updatedAt: CONTRACT_ROW.updatedAt, drawings: [] } },
      ]);
      mockBoqConfirmationGroupBy.mockResolvedValue([{ contractId: 'c-1', _sum: { confirmedPieces: 10 } }]);
      mockBoqPieceGroupBy.mockImplementation((args: { by: string[] }) =>
        args.by[0] === 'contractId'
          ? Promise.resolve([{ contractId: 'c-1', _count: { _all: 4 } }])
          : Promise.resolve([]),
      );

      const result = await service.getDashboard(ACTOR_MANAGER);

      expect(result.boqAttention.confirmedPiecesNotGenerated).toBe(1);
    });

    it('sums rejectedOrHoldPieces across ON_HOLD and REJECTED statuses', async () => {
      const service = buildService();
      mockContractCount.mockResolvedValue(0);
      mockWorkflowCount.mockResolvedValue(0);
      mockContractFindMany.mockResolvedValue([
        { ...CONTRACT_ROW, id: 'c-1', technicalWorkflow: { currentStage: TechnicalStage.DRAWING_RECEIVED, status: TechnicalWorkflowStatus.IN_PROGRESS, priority: null, updatedAt: CONTRACT_ROW.updatedAt, drawings: [] } },
      ]);
      mockBoqPieceGroupBy.mockImplementation((args: { by: string[] }) =>
        args.by[0] === 'currentStatus'
          ? Promise.resolve([
              { currentStatus: 'ON_HOLD', _count: { _all: 2 } },
              { currentStatus: 'REJECTED', _count: { _all: 3 } },
            ])
          : Promise.resolve([]),
      );

      const result = await service.getDashboard(ACTOR_MANAGER);

      expect(result.boqAttention.rejectedOrHoldPieces).toBe(5);
    });
  });
});

describe('TechnicalService — startWorkflow', () => {
  it('is idempotent — returns the existing workflow instead of creating a duplicate', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_ROW);

    const result = await service.startWorkflow('contract-1', ACTOR_MANAGER);

    expect(result).toEqual(WORKFLOW_ROW);
    expect(mockWorkflowCreate).not.toHaveBeenCalled();
  });

  it('creates a new workflow and logs a WORKFLOW_STARTED activity when none exists', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(null);
    mockWorkflowCreate.mockResolvedValue(WORKFLOW_ROW);

    await service.startWorkflow('contract-1', ACTOR_MANAGER);

    expect(mockWorkflowCreate).toHaveBeenCalledWith({ data: { contractId: 'contract-1', createdByUserId: ACTOR_MANAGER.id } });
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'WORKFLOW_STARTED', technicalWorkflowId: 'wf-1' }) }),
    );
  });

  it('throws NotFound for a contract that does not exist', async () => {
    const service = buildService();
    mockContractFindUnique.mockResolvedValue(null);
    await expect(service.startWorkflow('missing', ACTOR_MANAGER)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TechnicalService — getDrawingReceived', () => {
  it('throws a clear TECHNICAL_WORKFLOW_NOT_STARTED error when no workflow exists yet', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(null);
    await expect(service.getDrawingReceived('contract-1', ACTOR_READER)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TechnicalService — saveDrawingReceivedDraft', () => {
  it('creates the drawing record on first save and logs DRAWING_PACKAGE_RECEIVED', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_ROW);
    mockDrawingFindFirst.mockResolvedValue(null);
    mockDrawingCreate.mockResolvedValue({ id: 'drawing-1' });
    mockDrawingUpdate.mockResolvedValue({ id: 'drawing-1', drawingReferenceNo: 'DR-1' });

    const dto: SaveDrawingReceivedDto = { drawingReferenceNo: 'DR-1' };
    await service.saveDrawingReceivedDraft('contract-1', dto, ACTOR_MANAGER);

    expect(mockDrawingCreate).toHaveBeenCalledWith({ data: { technicalWorkflowId: 'wf-1', contractId: 'contract-1', createdByUserId: ACTOR_MANAGER.id } });
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'DRAWING_PACKAGE_RECEIVED' }) }),
    );
  });

  it('updates the existing drawing record on a later save and logs DETAILS_SAVED, not a duplicate create', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_ROW);
    mockDrawingFindFirst.mockResolvedValue({ id: 'drawing-1' });
    mockDrawingUpdate.mockResolvedValue({ id: 'drawing-1' });

    await service.saveDrawingReceivedDraft('contract-1', { remarks: 'follow up' }, ACTOR_MANAGER);

    expect(mockDrawingCreate).not.toHaveBeenCalled();
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'DETAILS_SAVED' }) }),
    );
  });

  it('only writes the fields actually provided — never nulls out untouched fields', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_ROW);
    mockDrawingFindFirst.mockResolvedValue({ id: 'drawing-1' });
    mockDrawingUpdate.mockResolvedValue({ id: 'drawing-1' });

    await service.saveDrawingReceivedDraft('contract-1', { remarks: 'only this' }, ACTOR_MANAGER);

    const callArg = mockDrawingUpdate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(callArg.data).toEqual({ remarks: 'only this' });
  });

  it('rejects a draft save once the stage has already advanced past Drawing Received', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue({ ...WORKFLOW_ROW, currentStage: TechnicalStage.SD_CALCULATION_SUBMISSION });

    await expect(service.saveDrawingReceivedDraft('contract-1', {}, ACTOR_MANAGER)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('TechnicalService — completeDrawingReceived', () => {
  const FULL_DTO: SaveDrawingReceivedDto = {
    receivedDate: '2026-09-01',
    receivedFrom: 'CLIENT' as never,
    drawingType: 'SHOP_DRAWING' as never,
    drawingReferenceNo: 'DR-100',
    revisionNo: 'R0',
    numberOfSheets: 5,
    drawingDescription: 'Precast panel shop drawings',
    relatedAreaPackage: 'Area A',
    linkedWorkflowStage: 'TECHNICAL_REVIEW' as never,
    internalReferenceNo: 'INT-1',
    assignedToUserId: 'user-reviewer',
    plannedReviewStart: '2099-01-01',
  };

  beforeEach(() => {
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_ROW);
    mockDrawingFindFirst.mockResolvedValue({ id: 'drawing-1' });
    mockDrawingUpdate.mockResolvedValue({ id: 'drawing-1', status: TechnicalDrawingStatus.COMPLETED });
    mockWorkflowUpdate.mockResolvedValue({ ...WORKFLOW_ROW, currentStage: TechnicalStage.SD_CALCULATION_SUBMISSION });
  });

  it('rejects when required fields are missing, listing exactly what is missing', async () => {
    const service = buildService();
    const { drawingReferenceNo, ...incomplete } = FULL_DTO;
    void drawingReferenceNo;

    await expect(service.completeDrawingReceived('contract-1', incomplete, ACTOR_MANAGER)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TECHNICAL_DRAWING_RECEIVED_INCOMPLETE', details: { missing: ['drawingReferenceNo'] } }),
    });
  });

  const MINIMAL_DTO: SaveDrawingReceivedDto = {
    receivedDate: '2026-09-01',
    receivedFrom: 'CLIENT' as never,
    drawingType: 'SHOP_DRAWING' as never,
    drawingReferenceNo: 'DR-100',
    revisionNo: 'R0',
    numberOfSheets: 5,
  };

  it('succeeds with only the 6 required fields (no description/area/internal ref/assignee/review start, no attachments)', async () => {
    const service = buildService();

    const result = await service.completeDrawingReceived('contract-1', MINIMAL_DTO, ACTOR_MANAGER);

    expect(mockWorkflowUpdate).toHaveBeenCalledWith({
      where: { id: 'wf-1' },
      data: { currentStage: TechnicalStage.SD_CALCULATION_SUBMISSION },
    });
    expect(result.nextStage).toBe(TechnicalStage.GETTING_APPROVAL);
  });

  it.each(['drawingDescription', 'relatedAreaPackage', 'internalReferenceNo', 'assignedToUserId', 'plannedReviewStart'] as const)(
    'succeeds without optional %s',
    async (field) => {
      const service = buildService();
      const dto = { ...FULL_DTO };
      delete dto[field];

      await expect(service.completeDrawingReceived('contract-1', dto, ACTOR_MANAGER)).resolves.toBeDefined();
    },
  );

  it.each(['receivedDate', 'receivedFrom', 'drawingType', 'drawingReferenceNo', 'revisionNo', 'numberOfSheets'] as const)(
    'fails when required %s is missing, with a friendly-label message',
    async (field) => {
      const service = buildService();
      const dto = { ...MINIMAL_DTO };
      delete dto[field];

      await expect(service.completeDrawingReceived('contract-1', dto, ACTOR_MANAGER)).rejects.toMatchObject({
        response: expect.objectContaining({ details: { missing: [field] }, message: expect.not.stringContaining(field) }),
      });
    },
  );

  it('rejects a received date in the future', async () => {
    const service = buildService();
    await expect(
      service.completeDrawingReceived('contract-1', { ...FULL_DTO, receivedDate: '2099-01-01' }, ACTOR_MANAGER),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TECHNICAL_RECEIVED_DATE_IN_FUTURE' }) });
  });

  it('rejects a planned review start in the past', async () => {
    const service = buildService();
    await expect(
      service.completeDrawingReceived('contract-1', { ...FULL_DTO, plannedReviewStart: '2020-01-01' }, ACTOR_MANAGER),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TECHNICAL_PLANNED_REVIEW_START_IN_PAST' }) });
  });

  it('moves the workflow from Drawing Received to SD & Calculation Submission on success', async () => {
    const service = buildService();

    const result = await service.completeDrawingReceived('contract-1', FULL_DTO, ACTOR_MANAGER);

    expect(mockDrawingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: TechnicalDrawingStatus.COMPLETED }) }),
    );
    expect(mockWorkflowUpdate).toHaveBeenCalledWith({
      where: { id: 'wf-1' },
      data: { currentStage: TechnicalStage.SD_CALCULATION_SUBMISSION },
    });
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event: 'DRAWING_RECEIVED_COMPLETED',
          previousStage: TechnicalStage.DRAWING_RECEIVED,
          newStage: TechnicalStage.SD_CALCULATION_SUBMISSION,
        }),
      }),
    );
    expect(result.nextStage).toBe(TechnicalStage.GETTING_APPROVAL);
  });

  it('rejects completing a stage that has already been completed', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue({ ...WORKFLOW_ROW, currentStage: TechnicalStage.FD_ISSUANCE });

    await expect(service.completeDrawingReceived('contract-1', FULL_DTO, ACTOR_MANAGER)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('TechnicalService — requestClarification', () => {
  it('logs a CLARIFICATION_REQUESTED activity without touching the workflow stage', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_ROW);

    await service.requestClarification('contract-1', 'Please confirm sheet count', ACTOR_MANAGER);

    expect(mockWorkflowUpdate).not.toHaveBeenCalled();
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event: 'CLARIFICATION_REQUESTED', metadata: { note: 'Please confirm sheet count' } }),
      }),
    );
  });
});

describe('TechnicalService — attachments', () => {
  it('createAttachment rejects a disallowed MIME type', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_ROW);

    await expect(
      service.createAttachment('contract-1', { buffer: Buffer.from(''), originalname: 'x.exe', mimetype: 'application/x-msdownload', size: 10 }, ACTOR_MANAGER),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('createAttachment does not reject a .tif upload as an unsupported type', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_ROW);

    // Passes the type check; any later failure comes from unmocked storage/DB, never the type gate.
    const result = await service
      .createAttachment('contract-1', { buffer: Buffer.from('II* '), originalname: 'scan.tif', mimetype: 'image/tiff', size: 10 }, ACTOR_MANAGER)
      .catch((e: unknown) => e);
    expect((result as { response?: { code?: string } })?.response?.code).not.toBe('TECHNICAL_ATTACHMENT_INVALID_TYPE');
  });

  it('createAttachment rejects an oversized file', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_ROW);

    await expect(
      service.createAttachment('contract-1', { buffer: Buffer.from(''), originalname: 'x.pdf', mimetype: 'application/pdf', size: 100 * 1024 * 1024 }, ACTOR_MANAGER),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('deleteAttachment allows the uploader to delete their own file', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_ROW);
    mockAttachmentFindFirst.mockResolvedValue({ id: 'att-1', storagePath: 'drawing-1/abc.pdf', originalFileName: 'abc.pdf', uploadedByUserId: ACTOR_MANAGER.id });

    await service.deleteAttachment('contract-1', 'att-1', ACTOR_MANAGER);

    expect(mockAttachmentDelete).toHaveBeenCalledWith({ where: { id: 'att-1' } });
    expect(mockAttachmentDeleteFile).toHaveBeenCalledWith('drawing-1/abc.pdf');
  });

  it('deleteAttachment blocks a non-owner without contracts.manage', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_ROW);
    mockAttachmentFindFirst.mockResolvedValue({ id: 'att-1', storagePath: 'drawing-1/abc.pdf', originalFileName: 'abc.pdf', uploadedByUserId: 'someone-else' });

    await expect(service.deleteAttachment('contract-1', 'att-1', ACTOR_MANAGER)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deleteAttachment allows a non-owner with contracts.manage', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_ROW);
    mockAttachmentFindFirst.mockResolvedValue({ id: 'att-1', storagePath: 'drawing-1/abc.pdf', originalFileName: 'abc.pdf', uploadedByUserId: 'someone-else' });
    const managerWithOverride: AuthUser = { ...ACTOR_MANAGER, permissions: [...ACTOR_MANAGER.permissions, 'contracts.manage'] };

    await expect(service.deleteAttachment('contract-1', 'att-1', managerWithOverride)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// FMP-TECH-02 — SD & Calculation Submission (Technical Stage 2)
// ---------------------------------------------------------------------------

const SD_ROW = { id: 'sd-1', technicalWorkflowId: 'wf-1', contractId: 'contract-1', status: TechnicalSdSubmissionStatus.DRAFT };

const FULL_SD_DTO: SaveSdCalculationSubmissionDto = {
  submissionDate: '2026-09-05',
  submissionType: 'SHOP_DRAWING' as never,
  submittedTo: 'Consultant XYZ',
  targetApprovalDate: '2026-09-20',
  drawingReferenceNo: 'DR-100',
  revisionNo: 'R1',
  relatedDrawingId: 'drawing-1',
  calculationType: 'STRUCTURAL_CALCULATION' as never,
  numberOfSheetsOrFiles: 3,
  scopeDescription: 'Precast panel SD and structural calculations',
  submissionMethod: 'EMAIL' as never,
  referenceSubmissionNo: 'SUB-1',
};

describe('TechnicalService — getSdCalculationSubmission', () => {
  it('throws NotFound when no workflow exists yet', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(null);
    await expect(service.getSdCalculationSubmission('contract-1', ACTOR_READER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the completed Drawing Received records for the Related Drawing Received picker', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_SD);
    mockSdFindFirst.mockResolvedValue(null);
    mockDrawingFindMany.mockResolvedValue([{ id: 'drawing-1', drawingReferenceNo: 'DR-100', revisionNo: 'R0', receivedDate: new Date('2026-09-01T00:00:00Z') }]);

    const result = await service.getSdCalculationSubmission('contract-1', ACTOR_READER);

    expect(result.completedDrawings).toHaveLength(1);
    expect(mockDrawingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ technicalWorkflowId: 'wf-1', status: TechnicalDrawingStatus.COMPLETED }) }),
    );
  });
});

describe('TechnicalService — saveSdSubmissionDraft', () => {
  // FMP-TECH-05K — internal staff can prepare a future stage's data ahead
  // of time; only Submit/Complete (still gated by assertSdStageIsCurrent)
  // require this to actually be the current stage.
  it('allows draft save before this stage is reached', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_ROW); // still DRAWING_RECEIVED
    mockSdFindFirst.mockResolvedValue(null);
    mockSdCreate.mockResolvedValue(SD_ROW);
    mockSdUpdate.mockResolvedValue(SD_ROW);
    await expect(service.saveSdSubmissionDraft('contract-1', {}, ACTOR_MANAGER)).resolves.toBeDefined();
  });

  it('rejects once the workflow has already advanced past this stage', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue({ ...WORKFLOW_ROW, currentStage: TechnicalStage.GETTING_APPROVAL });
    await expect(service.saveSdSubmissionDraft('contract-1', {}, ACTOR_MANAGER)).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates the submission record on first save and only writes provided fields', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_SD);
    mockSdFindFirst.mockResolvedValue(null);
    mockSdCreate.mockResolvedValue(SD_ROW);
    mockSdUpdate.mockResolvedValue(SD_ROW);

    await service.saveSdSubmissionDraft('contract-1', { submittedTo: 'Consultant XYZ' }, ACTOR_MANAGER);

    expect(mockSdCreate).toHaveBeenCalledWith({ data: { technicalWorkflowId: 'wf-1', contractId: 'contract-1', createdByUserId: ACTOR_MANAGER.id } });
    const callArg = mockSdUpdate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(callArg.data).toEqual({ submittedTo: 'Consultant XYZ' });
    expect(mockActivityCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ event: 'SD_SUBMISSION_SAVED' }) }));
  });

  it('validates relatedDrawingId belongs to this workflow and is completed, when provided', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_SD);
    mockDrawingFindFirst.mockResolvedValue(null); // no matching drawing for this workflow

    await expect(
      service.saveSdSubmissionDraft('contract-1', { relatedDrawingId: 'someone-elses-drawing' }, ACTOR_MANAGER),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TECHNICAL_RELATED_DRAWING_INVALID' }) });
  });
});

describe('TechnicalService — submitSdCalculation', () => {
  beforeEach(() => {
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_SD);
    mockSdFindFirst.mockResolvedValue(SD_ROW);
    mockSdUpdate.mockResolvedValue({ ...SD_ROW, status: TechnicalSdSubmissionStatus.SUBMITTED });
  });

  it('rejects when core submission fields are missing', async () => {
    const service = buildService();
    const { drawingReferenceNo, ...incomplete } = FULL_SD_DTO;
    void drawingReferenceNo;
    await expect(service.submitSdCalculation('contract-1', incomplete, ACTOR_MANAGER)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TECHNICAL_SD_SUBMISSION_INCOMPLETE', details: { missing: ['drawingReferenceNo'] } }),
    });
  });

  it('does NOT require targetApprovalDate or relatedDrawingId (core fields only)', async () => {
    const service = buildService();
    const { targetApprovalDate, relatedDrawingId, ...coreOnly } = FULL_SD_DTO;
    void targetApprovalDate;
    void relatedDrawingId;

    await expect(service.submitSdCalculation('contract-1', coreOnly, ACTOR_MANAGER)).resolves.toBeDefined();
  });

  it('sets status to SUBMITTED and logs SD_CALCULATION_SUBMITTED without advancing the workflow stage', async () => {
    const service = buildService();

    await service.submitSdCalculation('contract-1', FULL_SD_DTO, ACTOR_MANAGER);

    expect(mockSdUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: TechnicalSdSubmissionStatus.SUBMITTED }) }),
    );
    expect(mockWorkflowUpdate).not.toHaveBeenCalled();
    expect(mockActivityCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ event: 'SD_CALCULATION_SUBMITTED' }) }));
  });

  it('rejects a submission date in the future', async () => {
    const service = buildService();
    await expect(
      service.submitSdCalculation('contract-1', { ...FULL_SD_DTO, submissionDate: '2099-01-01' }, ACTOR_MANAGER),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TECHNICAL_SUBMISSION_DATE_IN_FUTURE' }) });
  });

  it('rejects a target approval date before the submission date', async () => {
    const service = buildService();
    await expect(
      service.submitSdCalculation('contract-1', { ...FULL_SD_DTO, submissionDate: '2026-09-10', targetApprovalDate: '2026-09-05' }, ACTOR_MANAGER),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TECHNICAL_TARGET_APPROVAL_BEFORE_SUBMISSION' }) });
  });
});

describe('TechnicalService — completeSdCalculationSubmission', () => {
  beforeEach(() => {
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_SD);
    mockSdFindFirst.mockResolvedValue(SD_ROW);
    mockSdUpdate.mockResolvedValue({ ...SD_ROW, status: TechnicalSdSubmissionStatus.COMPLETED });
    mockWorkflowUpdate.mockResolvedValue({ ...WORKFLOW_AT_SD, currentStage: TechnicalStage.GETTING_APPROVAL });
    mockDrawingFindFirst.mockResolvedValue(COMPLETED_DRAWING_ROW);
    mockSdCount.mockResolvedValue(1); // at least one attachment
  });

  it('requires targetApprovalDate and relatedDrawingId, unlike Submit', async () => {
    const service = buildService();
    const { targetApprovalDate, ...incomplete } = FULL_SD_DTO;
    void targetApprovalDate;
    await expect(service.completeSdCalculationSubmission('contract-1', incomplete, ACTOR_MANAGER)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TECHNICAL_SD_SUBMISSION_INCOMPLETE', details: { missing: ['targetApprovalDate'] } }),
    });
  });

  it('rejects when the related drawing does not belong to this workflow', async () => {
    const service = buildService();
    mockDrawingFindFirst.mockResolvedValue(null);
    await expect(service.completeSdCalculationSubmission('contract-1', FULL_SD_DTO, ACTOR_MANAGER)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TECHNICAL_RELATED_DRAWING_INVALID' }),
    });
  });

  it('rejects when the related drawing is not completed', async () => {
    const service = buildService();
    mockDrawingFindFirst.mockResolvedValue({ ...COMPLETED_DRAWING_ROW, status: TechnicalDrawingStatus.DRAFT });
    await expect(service.completeSdCalculationSubmission('contract-1', FULL_SD_DTO, ACTOR_MANAGER)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TECHNICAL_RELATED_DRAWING_NOT_COMPLETED' }),
    });
  });

  it('rejects when no attachment has been uploaded yet', async () => {
    const service = buildService();
    mockSdCount.mockResolvedValue(0);
    await expect(service.completeSdCalculationSubmission('contract-1', FULL_SD_DTO, ACTOR_MANAGER)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TECHNICAL_SD_SUBMISSION_ATTACHMENT_REQUIRED' }),
    });
  });

  it('advances TechnicalWorkflow.currentStage to GETTING_APPROVAL and logs SD_CALCULATION_STAGE_COMPLETED', async () => {
    const service = buildService();

    const result = await service.completeSdCalculationSubmission('contract-1', FULL_SD_DTO, ACTOR_MANAGER);

    expect(mockSdUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: TechnicalSdSubmissionStatus.COMPLETED }) }),
    );
    expect(mockWorkflowUpdate).toHaveBeenCalledWith({ where: { id: 'wf-1' }, data: { currentStage: TechnicalStage.GETTING_APPROVAL } });
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event: 'SD_CALCULATION_STAGE_COMPLETED',
          previousStage: TechnicalStage.SD_CALCULATION_SUBMISSION,
          newStage: TechnicalStage.GETTING_APPROVAL,
        }),
      }),
    );
    expect(result.nextStage).toBe(TechnicalStage.FD_ISSUANCE);
  });

  it('rejects completing a stage that is not current (already advanced)', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue({ ...WORKFLOW_AT_SD, currentStage: TechnicalStage.FD_ISSUANCE });
    await expect(service.completeSdCalculationSubmission('contract-1', FULL_SD_DTO, ACTOR_MANAGER)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('TechnicalService — requestSdClarification', () => {
  it('sets the submission status to CLARIFICATION_REQUESTED and logs the activity, without advancing the workflow', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_SD);
    mockSdFindFirst.mockResolvedValue(SD_ROW);

    await service.requestSdClarification('contract-1', 'Please confirm calc method', ACTOR_MANAGER);

    expect(mockSdUpdate).toHaveBeenCalledWith({ where: { id: 'sd-1' }, data: { status: TechnicalSdSubmissionStatus.CLARIFICATION_REQUESTED } });
    expect(mockWorkflowUpdate).not.toHaveBeenCalled();
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'SD_CLARIFICATION_REQUESTED', metadata: { note: 'Please confirm calc method' } }) }),
    );
  });

  it('does not fail when no submission record exists yet — just logs the activity', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_SD);
    mockSdFindFirst.mockResolvedValue(null);

    await expect(service.requestSdClarification('contract-1', 'note', ACTOR_MANAGER)).resolves.toBeUndefined();
    expect(mockSdUpdate).not.toHaveBeenCalled();
  });
});

describe('TechnicalService — SD attachments', () => {
  it('createSdAttachment rejects a disallowed MIME type', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_SD);

    await expect(
      service.createSdAttachment('contract-1', { buffer: Buffer.from(''), originalname: 'x.exe', mimetype: 'application/x-msdownload', size: 10 }, ACTOR_MANAGER),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('deleteSdAttachment blocks a non-owner without contracts.manage', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_SD);
    mockSdAttachmentFindFirst.mockResolvedValue({ id: 'att-1', storagePath: 'sd-1/abc.pdf', originalFileName: 'abc.pdf', uploadedByUserId: 'someone-else' });

    await expect(service.deleteSdAttachment('contract-1', 'att-1', ACTOR_MANAGER)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deleteSdAttachment allows the uploader to delete their own file', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_SD);
    mockSdAttachmentFindFirst.mockResolvedValue({ id: 'att-1', storagePath: 'sd-1/abc.pdf', originalFileName: 'abc.pdf', uploadedByUserId: ACTOR_MANAGER.id });

    await service.deleteSdAttachment('contract-1', 'att-1', ACTOR_MANAGER);

    expect(mockSdAttachmentDelete).toHaveBeenCalledWith({ where: { id: 'att-1' } });
    expect(mockAttachmentDeleteFile).toHaveBeenCalledWith('sd-1/abc.pdf');
  });
});

// ---------------------------------------------------------------------------
// FMP-TECH-03 — Getting Approval (Technical Stage 3)
// ---------------------------------------------------------------------------

const APPROVAL_ROW = { id: 'appr-1', technicalWorkflowId: 'wf-1', contractId: 'contract-1', status: TechnicalApprovalRecordStatus.DRAFT };

const FULL_APPROVAL_DTO: SaveGettingApprovalDto = {
  relatedSdSubmissionId: 'sd-1',
  submittedOn: '2026-09-10',
  submittedTo: 'Client Reviewer',
  approvalStatus: 'APPROVED' as never,
  expectedApprovalDate: '2026-09-20',
  revisionNo: 'R1',
};

describe('TechnicalService — getGettingApproval', () => {
  it('throws NotFound when no workflow exists yet', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(null);
    await expect(service.getGettingApproval('contract-1', ACTOR_READER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the submitted/completed SD & Calculation records for the Related SD Submission picker', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_APPROVAL);
    mockApprovalFindFirst.mockResolvedValue(null);
    mockSdFindMany.mockResolvedValue([{ id: 'sd-1', drawingReferenceNo: 'DR-100', revisionNo: 'R1', submissionDate: new Date('2026-09-05T00:00:00Z') }]);

    const result = await service.getGettingApproval('contract-1', ACTOR_READER);

    expect(result.eligibleSdSubmissions).toHaveLength(1);
    expect(mockSdFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          technicalWorkflowId: 'wf-1',
          status: { in: [TechnicalSdSubmissionStatus.SUBMITTED, TechnicalSdSubmissionStatus.COMPLETED] },
        }),
      }),
    );
  });
});

describe('TechnicalService — saveApprovalDraft', () => {
  // FMP-TECH-05K — same "prepare ahead" reasoning as saveSdSubmissionDraft.
  it('allows draft save before this stage is reached', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_SD); // still SD_CALCULATION_SUBMISSION
    mockApprovalFindFirst.mockResolvedValue(null);
    mockApprovalCreate.mockResolvedValue(APPROVAL_ROW);
    mockApprovalUpdate.mockResolvedValue(APPROVAL_ROW);
    await expect(service.saveApprovalDraft('contract-1', {}, ACTOR_MANAGER)).resolves.toBeDefined();
  });

  it('rejects once the workflow has already advanced past this stage', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue({ ...WORKFLOW_ROW, currentStage: TechnicalStage.FD_ISSUANCE });
    await expect(service.saveApprovalDraft('contract-1', {}, ACTOR_MANAGER)).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates the approval record on first save and only writes provided fields', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_APPROVAL);
    mockApprovalFindFirst.mockResolvedValue(null);
    mockApprovalCreate.mockResolvedValue(APPROVAL_ROW);
    mockApprovalUpdate.mockResolvedValue(APPROVAL_ROW);

    await service.saveApprovalDraft('contract-1', { submittedTo: 'Client Reviewer' }, ACTOR_MANAGER);

    expect(mockApprovalCreate).toHaveBeenCalledWith({ data: { technicalWorkflowId: 'wf-1', contractId: 'contract-1', createdByUserId: ACTOR_MANAGER.id } });
    const callArg = mockApprovalUpdate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(callArg.data).toEqual({ submittedTo: 'Client Reviewer' });
    expect(mockActivityCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ event: 'APPROVAL_DETAILS_SAVED' }) }));
  });

  it('validates relatedSdSubmissionId belongs to this workflow and is submitted/completed, when provided', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_APPROVAL);
    mockSdFindFirst.mockResolvedValue(null); // no matching SD submission for this workflow

    await expect(
      service.saveApprovalDraft('contract-1', { relatedSdSubmissionId: 'someone-elses-submission' }, ACTOR_MANAGER),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TECHNICAL_RELATED_SD_SUBMISSION_INVALID' }) });
  });

  it('rejects a related SD submission that is still only a draft', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_APPROVAL);
    mockSdFindFirst.mockResolvedValue({ ...SUBMITTED_SD_ROW, status: TechnicalSdSubmissionStatus.DRAFT });

    await expect(
      service.saveApprovalDraft('contract-1', { relatedSdSubmissionId: 'sd-1' }, ACTOR_MANAGER),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TECHNICAL_RELATED_SD_SUBMISSION_NOT_READY' }) });
  });
});

describe('TechnicalService — requestApprovalClarification', () => {
  it('logs an activity without touching the approval status or the workflow stage', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_APPROVAL);

    await service.requestApprovalClarification('contract-1', 'Please confirm reviewer', ACTOR_MANAGER);

    expect(mockApprovalUpdate).not.toHaveBeenCalled();
    expect(mockWorkflowUpdate).not.toHaveBeenCalled();
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'APPROVAL_CLARIFICATION_REQUESTED', metadata: { note: 'Please confirm reviewer' } }) }),
    );
  });
});

describe('TechnicalService — sendApprovalBackForChanges', () => {
  beforeEach(() => {
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_APPROVAL);
    mockApprovalFindFirst.mockResolvedValue(APPROVAL_ROW);
    mockApprovalUpdate.mockResolvedValue({ ...APPROVAL_ROW, status: TechnicalApprovalRecordStatus.CHANGES_REQUIRED });
    mockWorkflowUpdate.mockResolvedValue({ ...WORKFLOW_AT_APPROVAL, currentStage: TechnicalStage.SD_CALCULATION_SUBMISSION });
  });

  it('rejects without a resubmission reason', async () => {
    const service = buildService();
    await expect(service.sendApprovalBackForChanges('contract-1', {}, ACTOR_MANAGER)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TECHNICAL_RESUBMISSION_REASON_REQUIRED' }),
    });
  });

  it('sets approvalStatus/status to CHANGES_REQUIRED, resubmissionRequired true, and REVERTS the workflow to SD & Calculation Submission for revision', async () => {
    const service = buildService();

    await service.sendApprovalBackForChanges('contract-1', { resubmissionReason: 'Missing rebar detail on sheet 3' }, ACTOR_MANAGER);

    expect(mockApprovalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resubmissionReason: 'Missing rebar detail on sheet 3',
          approvalStatus: TechnicalApprovalStatus.CHANGES_REQUIRED,
          resubmissionRequired: true,
          status: TechnicalApprovalRecordStatus.CHANGES_REQUIRED,
        }),
      }),
    );
    // The real revision-flow behavior — not the ticket's own fallback — since
    // this architecture's SD write-gate already supports it cleanly.
    expect(mockWorkflowUpdate).toHaveBeenCalledWith({ where: { id: 'wf-1' }, data: { currentStage: TechnicalStage.SD_CALCULATION_SUBMISSION } });
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event: 'CHANGES_REQUESTED', previousStage: TechnicalStage.GETTING_APPROVAL, newStage: TechnicalStage.SD_CALCULATION_SUBMISSION }),
      }),
    );
  });

  it('never deletes the approval or SD submission rows', async () => {
    const service = buildService();
    await service.sendApprovalBackForChanges('contract-1', { resubmissionReason: 'Revise loads' }, ACTOR_MANAGER);

    expect(mockApprovalCreate).not.toHaveBeenCalled(); // approval already existed — no new/duplicate row either
    expect(mockSdUpdate).not.toHaveBeenCalled();
  });
});

describe('TechnicalService — rejectApproval', () => {
  beforeEach(() => {
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_APPROVAL);
    mockApprovalFindFirst.mockResolvedValue(APPROVAL_ROW);
    mockApprovalUpdate.mockResolvedValue({ ...APPROVAL_ROW, status: TechnicalApprovalRecordStatus.REJECTED });
  });

  it('rejects without reviewer comments', async () => {
    const service = buildService();
    await expect(service.rejectApproval('contract-1', {}, ACTOR_MANAGER)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TECHNICAL_REVIEWER_COMMENTS_REQUIRED' }),
    });
  });

  it('sets approvalStatus/status to REJECTED, logs REJECTED, and never advances or deletes the workflow', async () => {
    const service = buildService();

    await service.rejectApproval('contract-1', { reviewerComments: 'Structural capacity insufficient' }, ACTOR_MANAGER);

    expect(mockApprovalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ approvalStatus: TechnicalApprovalStatus.REJECTED, status: TechnicalApprovalRecordStatus.REJECTED }) }),
    );
    expect(mockWorkflowUpdate).not.toHaveBeenCalled();
    expect(mockActivityCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ event: 'REJECTED' }) }));
  });
});

describe('TechnicalService — approveAndMoveToFdIssuance', () => {
  beforeEach(() => {
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_APPROVAL);
    mockApprovalFindFirst.mockResolvedValue(APPROVAL_ROW);
    mockApprovalUpdate.mockResolvedValue({ ...APPROVAL_ROW, status: TechnicalApprovalRecordStatus.COMPLETED });
    mockWorkflowUpdate.mockResolvedValue({ ...WORKFLOW_AT_APPROVAL, currentStage: TechnicalStage.FD_ISSUANCE });
    mockSdFindFirst.mockResolvedValue(SUBMITTED_SD_ROW);
  });

  it('rejects when required fields are missing', async () => {
    const service = buildService();
    const { revisionNo, ...incomplete } = FULL_APPROVAL_DTO;
    void revisionNo;
    await expect(service.approveAndMoveToFdIssuance('contract-1', incomplete, ACTOR_MANAGER)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TECHNICAL_APPROVAL_INCOMPLETE', details: { missing: ['revisionNo'] } }),
    });
  });

  it('rejects when approvalStatus is not Approved or Approved with Comments', async () => {
    const service = buildService();
    await expect(
      service.approveAndMoveToFdIssuance('contract-1', { ...FULL_APPROVAL_DTO, approvalStatus: 'UNDER_REVIEW' as never }, ACTOR_MANAGER),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TECHNICAL_APPROVAL_STATUS_NOT_APPROVED' }) });
  });

  it('requires reviewer comments when approvalStatus is Approved with Comments', async () => {
    const service = buildService();
    await expect(
      service.approveAndMoveToFdIssuance('contract-1', { ...FULL_APPROVAL_DTO, approvalStatus: 'APPROVED_WITH_COMMENTS' as never }, ACTOR_MANAGER),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TECHNICAL_REVIEWER_COMMENTS_REQUIRED' }) });
  });

  it('rejects when the related SD submission does not belong to this workflow', async () => {
    const service = buildService();
    mockSdFindFirst.mockResolvedValue(null);
    await expect(service.approveAndMoveToFdIssuance('contract-1', FULL_APPROVAL_DTO, ACTOR_MANAGER)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TECHNICAL_RELATED_SD_SUBMISSION_INVALID' }),
    });
  });

  it('rejects Reviewed On before Submitted On', async () => {
    const service = buildService();
    await expect(
      service.approveAndMoveToFdIssuance('contract-1', { ...FULL_APPROVAL_DTO, reviewedOn: '2026-09-01' }, ACTOR_MANAGER),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TECHNICAL_REVIEWED_ON_BEFORE_SUBMITTED_ON' }) });
  });

  it('rejects Expected Approval Date before Submitted On', async () => {
    const service = buildService();
    await expect(
      service.approveAndMoveToFdIssuance('contract-1', { ...FULL_APPROVAL_DTO, expectedApprovalDate: '2026-09-01' }, ACTOR_MANAGER),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TECHNICAL_EXPECTED_APPROVAL_BEFORE_SUBMITTED_ON' }) });
  });

  it('rejects Resubmission Date before Reviewed On', async () => {
    const service = buildService();
    await expect(
      service.approveAndMoveToFdIssuance('contract-1', { ...FULL_APPROVAL_DTO, reviewedOn: '2026-09-12', resubmissionDate: '2026-09-05' }, ACTOR_MANAGER),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TECHNICAL_RESUBMISSION_BEFORE_REVIEWED_ON' }) });
  });

  it('advances TechnicalWorkflow.currentStage to FD_ISSUANCE and logs both APPROVAL_RECEIVED and GETTING_APPROVAL_STAGE_COMPLETED', async () => {
    const service = buildService();

    const result = await service.approveAndMoveToFdIssuance('contract-1', FULL_APPROVAL_DTO, ACTOR_MANAGER);

    expect(mockApprovalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: TechnicalApprovalRecordStatus.COMPLETED }) }),
    );
    expect(mockWorkflowUpdate).toHaveBeenCalledWith({ where: { id: 'wf-1' }, data: { currentStage: TechnicalStage.FD_ISSUANCE } });
    expect(mockActivityCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ event: 'APPROVAL_RECEIVED' }) }));
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event: 'GETTING_APPROVAL_STAGE_COMPLETED', previousStage: TechnicalStage.GETTING_APPROVAL, newStage: TechnicalStage.FD_ISSUANCE }),
      }),
    );
    expect(result.nextStage).toBeNull(); // FD_ISSUANCE is the final stage
  });

  it('accepts APPROVED_WITH_COMMENTS when reviewer comments are provided', async () => {
    const service = buildService();
    await expect(
      service.approveAndMoveToFdIssuance('contract-1', { ...FULL_APPROVAL_DTO, approvalStatus: 'APPROVED_WITH_COMMENTS' as never, reviewerComments: 'Minor note, proceed' }, ACTOR_MANAGER),
    ).resolves.toBeDefined();
  });

  it('rejects completing a stage that is not current (already advanced)', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue({ ...WORKFLOW_AT_APPROVAL, currentStage: TechnicalStage.FD_ISSUANCE });
    await expect(service.approveAndMoveToFdIssuance('contract-1', FULL_APPROVAL_DTO, ACTOR_MANAGER)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('TechnicalService — Approval attachments', () => {
  it('createApprovalAttachment rejects a disallowed MIME type', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_APPROVAL);

    await expect(
      service.createApprovalAttachment('contract-1', { buffer: Buffer.from(''), originalname: 'x.exe', mimetype: 'application/x-msdownload', size: 10 }, ACTOR_MANAGER),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('deleteApprovalAttachment blocks a non-owner without contracts.manage', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_APPROVAL);
    mockApprovalAttachmentFindFirst.mockResolvedValue({ id: 'att-1', storagePath: 'appr-1/abc.pdf', originalFileName: 'abc.pdf', uploadedByUserId: 'someone-else' });

    await expect(service.deleteApprovalAttachment('contract-1', 'att-1', ACTOR_MANAGER)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deleteApprovalAttachment allows the uploader to delete their own file', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_APPROVAL);
    mockApprovalAttachmentFindFirst.mockResolvedValue({ id: 'att-1', storagePath: 'appr-1/abc.pdf', originalFileName: 'abc.pdf', uploadedByUserId: ACTOR_MANAGER.id });

    await service.deleteApprovalAttachment('contract-1', 'att-1', ACTOR_MANAGER);

    expect(mockApprovalAttachmentDelete).toHaveBeenCalledWith({ where: { id: 'att-1' } });
    expect(mockAttachmentDeleteFile).toHaveBeenCalledWith('appr-1/abc.pdf');
  });
});

// ---------------------------------------------------------------------------
// FMP-TECH-04 — FD Issuance (Technical Stage 4, the final stage)
// ---------------------------------------------------------------------------

const FD_ROW = { id: 'fd-1', technicalWorkflowId: 'wf-1', contractId: 'contract-1', status: TechnicalFdStatus.DRAFT };

const APPROVED_APPROVAL_ROW = { id: 'appr-1', technicalWorkflowId: 'wf-1', approvalStatus: TechnicalApprovalStatus.APPROVED };

const FULL_FD_DTO: SaveFdIssuanceDto = {
  relatedApprovalId: 'appr-1',
  fdIssueDate: '2026-09-25',
  issuedTo: 'Site Engineer',
  purposeFor: 'PRODUCTION' as never,
  issueType: 'FINAL_DRAWING' as never,
  drawingReferenceNo: 'DR-100',
  revisionNo: 'R2',
  approvedReferenceNo: 'APR-100',
  approvedDate: '2026-09-20',
  numberOfSheetsOrFiles: 5,
  distribution: 'ELECTRONIC' as never,
  issueMethod: 'EMAIL' as never,
};

describe('TechnicalService — getFdIssuance', () => {
  it('throws NotFound when no workflow exists yet', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(null);
    await expect(service.getFdIssuance('contract-1', ACTOR_READER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the approved/approved-with-comments approval records for the Related Approval picker', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_FD);
    mockFdFindFirst.mockResolvedValue(null);
    mockApprovalFindMany.mockResolvedValue([{ id: 'appr-1', approvalStatus: TechnicalApprovalStatus.APPROVED, revisionNo: 'R1', reviewedOn: new Date('2026-09-15T00:00:00Z') }]);

    const result = await service.getFdIssuance('contract-1', ACTOR_READER);

    expect(result.eligibleApprovals).toHaveLength(1);
    expect(mockApprovalFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          technicalWorkflowId: 'wf-1',
          approvalStatus: { in: [TechnicalApprovalStatus.APPROVED, TechnicalApprovalStatus.APPROVED_WITH_COMMENTS] },
        }),
      }),
    );
  });
});

describe('TechnicalService — saveFdIssuanceDraft', () => {
  // FMP-TECH-05K — same "prepare ahead" reasoning as saveSdSubmissionDraft.
  it('allows draft save before this stage is reached', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_APPROVAL);
    mockFdFindFirst.mockResolvedValue(null);
    mockFdCreate.mockResolvedValue(FD_ROW);
    mockFdUpdate.mockResolvedValue(FD_ROW);
    await expect(service.saveFdIssuanceDraft('contract-1', {}, ACTOR_MANAGER)).resolves.toBeDefined();
  });

  it('rejects once the Technical workflow has already been completed', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue({ ...WORKFLOW_AT_FD, status: TechnicalWorkflowStatus.COMPLETED });
    await expect(service.saveFdIssuanceDraft('contract-1', {}, ACTOR_MANAGER)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TECHNICAL_WORKFLOW_ALREADY_COMPLETED' }),
    });
  });

  it('creates the FD issuance record on first save and only writes provided fields', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_FD);
    mockFdFindFirst.mockResolvedValue(null);
    mockFdCreate.mockResolvedValue(FD_ROW);
    mockFdUpdate.mockResolvedValue(FD_ROW);

    await service.saveFdIssuanceDraft('contract-1', { issuedTo: 'Site Engineer' }, ACTOR_MANAGER);

    expect(mockFdCreate).toHaveBeenCalledWith({ data: { technicalWorkflowId: 'wf-1', contractId: 'contract-1', createdByUserId: ACTOR_MANAGER.id } });
    const callArg = mockFdUpdate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(callArg.data).toEqual({ issuedTo: 'Site Engineer' });
    expect(mockActivityCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ event: 'FD_DETAILS_SAVED' }) }));
  });

  it('validates relatedApprovalId belongs to this workflow and is approved, when provided', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_FD);
    mockApprovalFindFirst.mockResolvedValue(null); // no matching approval for this workflow

    await expect(
      service.saveFdIssuanceDraft('contract-1', { relatedApprovalId: 'someone-elses-approval' }, ACTOR_MANAGER),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TECHNICAL_RELATED_APPROVAL_INVALID' }) });
  });

  it('rejects a related approval that is still Under Review', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_FD);
    mockApprovalFindFirst.mockResolvedValue({ id: 'appr-1', approvalStatus: TechnicalApprovalStatus.UNDER_REVIEW });

    await expect(
      service.saveFdIssuanceDraft('contract-1', { relatedApprovalId: 'appr-1' }, ACTOR_MANAGER),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TECHNICAL_RELATED_APPROVAL_NOT_APPROVED' }) });
  });
});

describe('TechnicalService — submitFdIssue', () => {
  beforeEach(() => {
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_FD);
    mockFdFindFirst.mockResolvedValue(FD_ROW);
    mockFdUpdate.mockResolvedValue({ ...FD_ROW, status: TechnicalFdStatus.SUBMITTED });
  });

  it('rejects when a core field is missing', async () => {
    const service = buildService();
    const { issuedTo, ...incomplete } = FULL_FD_DTO;
    void issuedTo;
    await expect(service.submitFdIssue('contract-1', incomplete, ACTOR_MANAGER)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TECHNICAL_FD_ISSUANCE_INCOMPLETE', details: { missing: ['issuedTo'] } }),
    });
  });

  it('sets status SUBMITTED and does not complete the Technical workflow', async () => {
    const service = buildService();
    const { relatedApprovalId, approvedReferenceNo, approvedDate, ...coreOnly } = FULL_FD_DTO;
    void relatedApprovalId;
    void approvedReferenceNo;
    void approvedDate;

    await service.submitFdIssue('contract-1', coreOnly, ACTOR_MANAGER);

    expect(mockFdUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: TechnicalFdStatus.SUBMITTED }) }));
    expect(mockWorkflowUpdate).not.toHaveBeenCalled();
    expect(mockActivityCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ event: 'FD_ISSUE_SUBMITTED' }) }));
  });
});

describe('TechnicalService — returnOrReopenFd', () => {
  beforeEach(() => {
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_FD);
    mockFdFindFirst.mockResolvedValue(FD_ROW);
    mockFdUpdate.mockResolvedValue({ ...FD_ROW, status: TechnicalFdStatus.RETURNED_REOPENED });
    mockWorkflowUpdate.mockResolvedValue({ ...WORKFLOW_AT_FD, currentStage: TechnicalStage.GETTING_APPROVAL });
  });

  it('sets status RETURNED_REOPENED and REVERTS the workflow to Getting Approval for revision', async () => {
    const service = buildService();

    await service.returnOrReopenFd('contract-1', 'Missing approval signature on sheet 2', ACTOR_MANAGER);

    expect(mockFdUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: TechnicalFdStatus.RETURNED_REOPENED } }));
    // The real revision-flow behavior — same reasoning as
    // sendApprovalBackForChanges() — since this architecture's Getting
    // Approval write-gate already supports it cleanly.
    expect(mockWorkflowUpdate).toHaveBeenCalledWith({ where: { id: 'wf-1' }, data: { currentStage: TechnicalStage.GETTING_APPROVAL } });
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event: 'FD_RETURNED_REOPENED',
          previousStage: TechnicalStage.FD_ISSUANCE,
          newStage: TechnicalStage.GETTING_APPROVAL,
          metadata: { reason: 'Missing approval signature on sheet 2' },
        }),
      }),
    );
  });

  it('never deletes the FD issuance or approval rows', async () => {
    const service = buildService();
    await service.returnOrReopenFd('contract-1', 'Revise distribution list', ACTOR_MANAGER);

    expect(mockFdCreate).not.toHaveBeenCalled(); // FD issuance already existed — no new/duplicate row either
    expect(mockApprovalUpdate).not.toHaveBeenCalled();
  });

  it('rejects once the Technical workflow has already been completed', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue({ ...WORKFLOW_AT_FD, status: TechnicalWorkflowStatus.COMPLETED });
    await expect(service.returnOrReopenFd('contract-1', 'Too late', ACTOR_MANAGER)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TECHNICAL_WORKFLOW_ALREADY_COMPLETED' }),
    });
  });
});

describe('TechnicalService — issueFdAndCompleteWorkflow', () => {
  beforeEach(() => {
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_FD);
    mockFdFindFirst.mockResolvedValue(FD_ROW);
    mockFdUpdate.mockResolvedValue({ ...FD_ROW, status: TechnicalFdStatus.COMPLETED });
    mockWorkflowUpdate.mockResolvedValue({ ...WORKFLOW_AT_FD, status: TechnicalWorkflowStatus.COMPLETED });
    mockApprovalFindFirst.mockResolvedValue(APPROVED_APPROVAL_ROW);
    mockFdCount.mockResolvedValue(1);
  });

  it('rejects when required fields are missing', async () => {
    const service = buildService();
    const { approvedDate, ...incomplete } = FULL_FD_DTO;
    void approvedDate;
    await expect(service.issueFdAndCompleteWorkflow('contract-1', incomplete, ACTOR_MANAGER)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TECHNICAL_FD_ISSUANCE_INCOMPLETE', details: { missing: ['approvedDate'] } }),
    });
  });

  it('rejects when the related approval does not belong to this workflow', async () => {
    const service = buildService();
    mockApprovalFindFirst.mockResolvedValue(null);
    await expect(service.issueFdAndCompleteWorkflow('contract-1', FULL_FD_DTO, ACTOR_MANAGER)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TECHNICAL_RELATED_APPROVAL_INVALID' }),
    });
  });

  it('rejects FD Issue Date before Approved Date', async () => {
    const service = buildService();
    await expect(
      service.issueFdAndCompleteWorkflow('contract-1', { ...FULL_FD_DTO, fdIssueDate: '2026-09-10', approvedDate: '2026-09-20' }, ACTOR_MANAGER),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TECHNICAL_FD_ISSUE_DATE_BEFORE_APPROVED_DATE' }) });
  });

  it('rejects FD Issue Date in the future', async () => {
    const service = buildService();
    await expect(
      service.issueFdAndCompleteWorkflow('contract-1', { ...FULL_FD_DTO, fdIssueDate: '2099-01-01' }, ACTOR_MANAGER),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TECHNICAL_FD_ISSUE_DATE_IN_FUTURE' }) });
  });

  it('rejects completion when no attachment has been uploaded yet', async () => {
    const service = buildService();
    mockFdCount.mockResolvedValue(0);
    await expect(service.issueFdAndCompleteWorkflow('contract-1', FULL_FD_DTO, ACTOR_MANAGER)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TECHNICAL_FD_ATTACHMENT_REQUIRED' }),
    });
  });

  it('completes the FD issuance, marks the Technical workflow COMPLETED without changing currentStage, and logs TECHNICAL_WORKFLOW_COMPLETED', async () => {
    const service = buildService();

    const result = await service.issueFdAndCompleteWorkflow('contract-1', FULL_FD_DTO, ACTOR_MANAGER);

    expect(mockFdUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: TechnicalFdStatus.COMPLETED }) }),
    );
    // FD_ISSUANCE has no next stage — completion marks the whole workflow
    // done instead of advancing currentStage.
    expect(mockWorkflowUpdate).toHaveBeenCalledWith({
      where: { id: 'wf-1' },
      data: { status: TechnicalWorkflowStatus.COMPLETED, completedAt: expect.any(Date) },
    });
    expect(mockActivityCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ event: 'TECHNICAL_WORKFLOW_COMPLETED' }) }));
    expect(result.nextStage).toBeNull();
  });

  it('rejects completing a stage that is not current (already reverted to Getting Approval)', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_APPROVAL);
    await expect(service.issueFdAndCompleteWorkflow('contract-1', FULL_FD_DTO, ACTOR_MANAGER)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects completing a workflow that has already been completed', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue({ ...WORKFLOW_AT_FD, status: TechnicalWorkflowStatus.COMPLETED });
    await expect(service.issueFdAndCompleteWorkflow('contract-1', FULL_FD_DTO, ACTOR_MANAGER)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TECHNICAL_WORKFLOW_ALREADY_COMPLETED' }),
    });
  });
});

describe('TechnicalService — FD attachments', () => {
  it('createFdAttachment rejects a disallowed MIME type', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_FD);

    await expect(
      service.createFdAttachment('contract-1', { buffer: Buffer.from(''), originalname: 'x.exe', mimetype: 'application/x-msdownload', size: 10 }, ACTOR_MANAGER),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('deleteFdAttachment blocks a non-owner without contracts.manage', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_FD);
    mockFdAttachmentFindFirst.mockResolvedValue({ id: 'att-1', storagePath: 'fd-1/abc.pdf', originalFileName: 'abc.pdf', uploadedByUserId: 'someone-else' });

    await expect(service.deleteFdAttachment('contract-1', 'att-1', ACTOR_MANAGER)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deleteFdAttachment allows the uploader to delete their own file', async () => {
    const service = buildService();
    mockWorkflowFindUnique.mockResolvedValue(WORKFLOW_AT_FD);
    mockFdAttachmentFindFirst.mockResolvedValue({ id: 'att-1', storagePath: 'fd-1/abc.pdf', originalFileName: 'abc.pdf', uploadedByUserId: ACTOR_MANAGER.id });

    await service.deleteFdAttachment('contract-1', 'att-1', ACTOR_MANAGER);

    expect(mockFdAttachmentDelete).toHaveBeenCalledWith({ where: { id: 'att-1' } });
    expect(mockAttachmentDeleteFile).toHaveBeenCalledWith('fd-1/abc.pdf');
  });
});
