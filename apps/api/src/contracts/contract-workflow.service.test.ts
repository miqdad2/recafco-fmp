import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import {
  ContractWorkflowService,
  computeWorkflowProgress,
  computeTaskIsOverdue,
  resolveWorkflowTaskCompletedDate,
  assertWorkflowTaskDatesValid,
  buildWorkflowContractWhere,
  sanitizeWorkflowTaskFormData,
} from './contract-workflow.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { WorkflowAttachmentStorageService } from './workflow-attachment-storage.service';

// ---------------------------------------------------------------------------
// Client mocks
// ---------------------------------------------------------------------------

const mockContractFindUnique = vi.fn();
const mockContractFindMany = vi.fn();
const mockTaskFindMany = vi.fn();
const mockTaskFindUnique = vi.fn();
const mockTaskCreateMany = vi.fn();
const mockTaskUpdate = vi.fn();
const mockUserFindUnique = vi.fn();
const mockCommentFindMany = vi.fn();
const mockCommentCreate = vi.fn();
const mockAttachmentFindMany = vi.fn();
const mockAttachmentFindFirst = vi.fn();
const mockAttachmentCreate = vi.fn();
const mockTransaction = vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops));

const mockClient = {
  contract: { findUnique: mockContractFindUnique, findMany: mockContractFindMany },
  contractWorkflowTask: {
    findMany: mockTaskFindMany,
    findUnique: mockTaskFindUnique,
    createMany: mockTaskCreateMany,
    update: mockTaskUpdate,
  },
  contractWorkflowTaskComment: { findMany: mockCommentFindMany, create: mockCommentCreate },
  contractWorkflowTaskAttachment: {
    findMany: mockAttachmentFindMany,
    findFirst: mockAttachmentFindFirst,
    create: mockAttachmentCreate,
  },
  user: { findUnique: mockUserFindUnique },
  $transaction: mockTransaction,
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockBuildDeptFilter = vi.fn().mockResolvedValue(null);
const mockAssertCanAccessDepartment = vi.fn().mockResolvedValue(undefined);

const mockDeptAccess = {
  buildDeptFilter: mockBuildDeptFilter,
  assertCanAccessDepartment: mockAssertCanAccessDepartment,
} as unknown as DepartmentAccessService;

const mockStorageSave = vi.fn().mockResolvedValue({ fileName: 'stored-file.pdf', storagePath: 'task-1/stored-file.pdf' });
const mockAttachmentStorage = { save: mockStorageSave } as unknown as WorkflowAttachmentStorageService;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR_READ_ONLY: AuthUser = {
  id: 'user-viewer-1',
  username: 'viewer',
  displayName: 'Viewer',
  roleId: 'role-viewer',
  roleCode: 'VIEWER',
  roleName: 'Viewer',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-1',
  departmentId: null,
  permissions: ['contracts.read'],
};

const ACTOR_UPDATE: AuthUser = {
  id: 'user-manager-1',
  username: 'manager',
  displayName: 'Manager',
  roleId: 'role-admin',
  roleCode: 'ADMIN',
  roleName: 'Admin',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-2',
  departmentId: null,
  permissions: ['contracts.read', 'contracts.update'],
};

// CM-35 — Contract Staff: contracts.read/comment/workflow_update only, no
// contracts.update. May only touch tasks assigned to them (responsibleUserId
// === this actor's id), and only the staff-allowed field subset.
const ACTOR_STAFF: AuthUser = {
  id: 'user-staff-1',
  username: 'staff',
  displayName: 'Staff',
  roleId: 'role-contract-staff',
  roleCode: 'CONTRACT_STAFF',
  roleName: 'Contract Staff',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-3',
  departmentId: null,
  permissions: ['contracts.read', 'contracts.comment', 'contracts.workflow_update'],
};

function makeContractRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'contract-1',
    referenceNumber: 'CONTRACT-2026-000001',
    title: 'Test Contract',
    counterpartyName: 'Acme Co',
    status: 'ACTIVE',
    scopeOfWork: { shopDrawing: true, production: true },
    paymentTerms: null,
    contractValue: 5000,
    departmentId: 'dept-1',
    department: { id: 'dept-1', name: 'Engineering' },
    ownerUser: { id: 'user-manager-1', displayName: 'Manager' },
    ...overrides,
  };
}

function makeTaskRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'task-1',
    contractId: 'contract-1',
    team: 'TECHNICAL',
    taskKey: 'technical_drawing_received',
    taskName: 'Drawing Received',
    sortOrder: 1,
    status: 'NOT_STARTED',
    priority: 'MEDIUM',
    delayReason: null,
    responsibleUserId: null,
    startDate: null,
    dueDate: null,
    completedDate: null,
    remarks: null,
    formData: null,
    lastActivityAt: new Date('2026-08-01T00:00:00Z'),
    createdByUserId: 'user-manager-1',
    updatedByUserId: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    responsibleUser: null,
    createdByUser: { id: 'user-manager-1', displayName: 'Manager' },
    updatedByUser: null,
    _count: { attachments: 0, comments: 0 },
    ...overrides,
  };
}

let service: ContractWorkflowService;

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildDeptFilter.mockResolvedValue(null);
  mockAssertCanAccessDepartment.mockResolvedValue(undefined);
  mockStorageSave.mockResolvedValue({ fileName: 'stored-file.pdf', storagePath: 'task-1/stored-file.pdf' });
  service = new ContractWorkflowService(mockDb, mockDeptAccess, mockAttachmentStorage);
});

// ---------------------------------------------------------------------------
// computeWorkflowProgress
// ---------------------------------------------------------------------------

describe('computeWorkflowProgress', () => {
  const today = new Date('2026-08-20T00:00:00Z');

  it('returns NOT_GENERATED for zero tasks', () => {
    const progress = computeWorkflowProgress([], today);
    expect(progress.workflowStatus).toBe('NOT_GENERATED');
    expect(progress.total).toBe(0);
  });

  it('returns NOT_STARTED when every task is NOT_STARTED', () => {
    const progress = computeWorkflowProgress([{ status: 'NOT_STARTED', dueDate: null }], today);
    expect(progress.workflowStatus).toBe('NOT_STARTED');
  });

  it('returns COMPLETED when every task is COMPLETED', () => {
    const progress = computeWorkflowProgress(
      [{ status: 'COMPLETED', dueDate: null }, { status: 'COMPLETED', dueDate: null }],
      today,
    );
    expect(progress.workflowStatus).toBe('COMPLETED');
    expect(progress.completed).toBe(2);
  });

  it('returns IN_PROGRESS for a mix of statuses', () => {
    const progress = computeWorkflowProgress(
      [{ status: 'NOT_STARTED', dueDate: null }, { status: 'COMPLETED', dueDate: null }],
      today,
    );
    expect(progress.workflowStatus).toBe('IN_PROGRESS');
  });

  it('counts overdue tasks (past due date, not completed/rejected)', () => {
    const progress = computeWorkflowProgress(
      [
        { status: 'IN_PROGRESS', dueDate: new Date('2026-08-01') },
        { status: 'COMPLETED', dueDate: new Date('2026-08-01') },
        { status: 'NOT_STARTED', dueDate: new Date('2026-09-01') },
      ],
      today,
    );
    expect(progress.overdue).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// assertWorkflowTaskDatesValid
// ---------------------------------------------------------------------------

describe('assertWorkflowTaskDatesValid', () => {
  it('allows status=COMPLETED without a completedDate (auto-resolved upstream by resolveWorkflowTaskCompletedDate)', () => {
    expect(() =>
      assertWorkflowTaskDatesValid({ status: 'COMPLETED', startDate: null, dueDate: null, completedDate: null }),
    ).not.toThrow();
  });

  it('allows status=COMPLETED with a completedDate', () => {
    expect(() =>
      assertWorkflowTaskDatesValid({
        status: 'COMPLETED',
        startDate: null,
        dueDate: null,
        completedDate: new Date('2026-08-10'),
      }),
    ).not.toThrow();
  });

  it('rejects completedDate before startDate', () => {
    expect(() =>
      assertWorkflowTaskDatesValid({
        status: 'IN_PROGRESS',
        startDate: new Date('2026-08-10'),
        dueDate: null,
        completedDate: new Date('2026-08-05'),
      }),
    ).toThrow(UnprocessableEntityException);
  });

  it('rejects dueDate before startDate', () => {
    expect(() =>
      assertWorkflowTaskDatesValid({
        status: 'IN_PROGRESS',
        startDate: new Date('2026-08-10'),
        dueDate: new Date('2026-08-05'),
        completedDate: null,
      }),
    ).toThrow(UnprocessableEntityException);
  });

  it('allows a fully valid set of dates', () => {
    expect(() =>
      assertWorkflowTaskDatesValid({
        status: 'IN_PROGRESS',
        startDate: new Date('2026-08-01'),
        dueDate: new Date('2026-08-10'),
        completedDate: null,
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// computeTaskIsOverdue
// ---------------------------------------------------------------------------

describe('computeTaskIsOverdue', () => {
  const today = new Date('2026-08-20T00:00:00Z');

  it('returns false for COMPLETED and APPROVED statuses', () => {
    expect(computeTaskIsOverdue({ status: 'COMPLETED', dueDate: new Date('2026-08-01') }, today)).toBe(false);
    expect(computeTaskIsOverdue({ status: 'APPROVED', dueDate: new Date('2026-08-01') }, today)).toBe(false);
  });

  it('returns true for REJECTED with a past due date (unlike the contract-level progress definition)', () => {
    expect(computeTaskIsOverdue({ status: 'REJECTED', dueDate: new Date('2026-08-01') }, today)).toBe(true);
  });

  it('returns false when dueDate is missing', () => {
    expect(computeTaskIsOverdue({ status: 'IN_PROGRESS', dueDate: null }, today)).toBe(false);
  });

  it('returns false when dueDate is today or in the future', () => {
    expect(computeTaskIsOverdue({ status: 'IN_PROGRESS', dueDate: new Date('2026-08-25') }, today)).toBe(false);
  });

  it('returns true when overdue and not COMPLETED/APPROVED', () => {
    expect(computeTaskIsOverdue({ status: 'IN_PROGRESS', dueDate: new Date('2026-08-10') }, today)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveWorkflowTaskCompletedDate
// ---------------------------------------------------------------------------

describe('resolveWorkflowTaskCompletedDate', () => {
  const today = new Date('2026-08-20T00:00:00Z');

  it('uses the explicit dto value when provided', () => {
    expect(resolveWorkflowTaskCompletedDate('COMPLETED', '2026-08-15', null, today)).toEqual(new Date('2026-08-15'));
  });

  it('auto-sets to today when status becomes COMPLETED with no existing completedDate', () => {
    expect(resolveWorkflowTaskCompletedDate('COMPLETED', undefined, null, today)).toEqual(today);
  });

  it('does not touch completedDate when one already exists', () => {
    expect(resolveWorkflowTaskCompletedDate('COMPLETED', undefined, new Date('2026-08-01'), today)).toBeUndefined();
  });

  it('retains (does not clear) completedDate when status moves away from COMPLETED without an explicit value', () => {
    expect(resolveWorkflowTaskCompletedDate('IN_PROGRESS', undefined, new Date('2026-08-01'), today)).toBeUndefined();
  });

  it('does not touch completedDate for a non-terminal status with none set', () => {
    expect(resolveWorkflowTaskCompletedDate('IN_PROGRESS', undefined, null, today)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// sanitizeWorkflowTaskFormData
// ---------------------------------------------------------------------------

describe('sanitizeWorkflowTaskFormData', () => {
  it('returns undefined when the dto did not include formData at all (leaves existing value untouched)', () => {
    expect(sanitizeWorkflowTaskFormData(undefined)).toBeUndefined();
  });

  it('returns null when every field is blank (clears the column back to null)', () => {
    expect(sanitizeWorkflowTaskFormData({})).toBeNull();
    expect(sanitizeWorkflowTaskFormData({ receivedFrom: '', senderName: '   ' })).toBeNull();
  });

  it('keeps allow-listed text fields, trimmed', () => {
    expect(sanitizeWorkflowTaskFormData({ receivedFrom: '  QS Team  ', drawingReferenceNo: 'DWG-100' })).toEqual({
      receivedFrom: 'QS Team',
      drawingReferenceNo: 'DWG-100',
    });
  });

  it('keeps allow-listed SD & Calculation Submission text fields (CM-49), alongside reused drawingReferenceNo/revisionNo', () => {
    expect(sanitizeWorkflowTaskFormData({
      submissionDate: '2026-08-25',
      submissionType: 'First Submission',
      submittedTo: 'Client QS',
      targetApprovalDate: '2026-09-05',
      drawingReferenceNo: 'DWG-200',
      revisionNo: 'R1',
      relatedDrawingReceived: 'DWG-100',
      calculationType: 'Structural',
      numberOfSheetsFiles: '12',
      scopeDescription: 'Shop drawings and structural calculations for Block A',
      submittedBy: 'Jane Staff',
      designation: 'Structural Engineer',
      submissionMethod: 'Email',
      submissionReferenceNo: 'SUB-0042',
      contactNo: '+974 5555 1234',
      email: 'jane.staff@example.com',
    })).toEqual({
      submissionDate: '2026-08-25',
      submissionType: 'First Submission',
      submittedTo: 'Client QS',
      targetApprovalDate: '2026-09-05',
      drawingReferenceNo: 'DWG-200',
      revisionNo: 'R1',
      relatedDrawingReceived: 'DWG-100',
      calculationType: 'Structural',
      numberOfSheetsFiles: '12',
      scopeDescription: 'Shop drawings and structural calculations for Block A',
      submittedBy: 'Jane Staff',
      designation: 'Structural Engineer',
      submissionMethod: 'Email',
      submissionReferenceNo: 'SUB-0042',
      contactNo: '+974 5555 1234',
      email: 'jane.staff@example.com',
    });
  });

  it('keeps allow-listed Getting Approval text/boolean fields (CM-50), alongside reused submittedBy/revisionNo', () => {
    expect(sanitizeWorkflowTaskFormData({
      submittedOn: '2026-08-20',
      submittedBy: 'Jane Staff',
      submittedToReviewerClient: 'Client Engineer',
      approvalStatus: 'Approved with Comments',
      expectedApprovalDate: '2026-09-01',
      reviewedOn: '2026-08-28',
      reviewedBy: 'Client Reviewer',
      revisionNo: 'R2',
      clientReviewerComments: 'Minor clarifications required on Sheet 3.',
      resubmissionRequired: true,
      resubmissionDate: '2026-09-10',
      resubmissionReasonComments: 'Update rebar schedule per comment.',
    })).toEqual({
      submittedOn: '2026-08-20',
      submittedBy: 'Jane Staff',
      submittedToReviewerClient: 'Client Engineer',
      approvalStatus: 'Approved with Comments',
      expectedApprovalDate: '2026-09-01',
      reviewedOn: '2026-08-28',
      reviewedBy: 'Client Reviewer',
      revisionNo: 'R2',
      clientReviewerComments: 'Minor clarifications required on Sheet 3.',
      resubmissionRequired: true,
      resubmissionDate: '2026-09-10',
      resubmissionReasonComments: 'Update rebar schedule per comment.',
    });
  });

  it('keeps allow-listed FD Issuance text fields (CM-51), alongside reused drawingReferenceNo/revisionNo/numberOfSheetsFiles/designation/contactNo/email', () => {
    expect(sanitizeWorkflowTaskFormData({
      fdIssueDate: '2026-09-15',
      issuedTo: 'Production Team',
      purposeFor: 'Production',
      issueType: 'Final Drawing (FD)',
      drawingReferenceNo: 'DWG-200',
      revisionNo: 'R2',
      approvedReferenceNo: 'APR-0042',
      approvedDate: '2026-09-05',
      numberOfSheetsFiles: '14',
      scale: 'As Per Drawing',
      distribution: 'Electronic + Hard Copy',
      issueMethod: 'Email',
      issuedBy: 'Jane Staff',
      designation: 'Structural Engineer',
      contactNo: '+974 5555 1234',
      email: 'jane.staff@example.com',
    })).toEqual({
      fdIssueDate: '2026-09-15',
      issuedTo: 'Production Team',
      purposeFor: 'Production',
      issueType: 'Final Drawing (FD)',
      drawingReferenceNo: 'DWG-200',
      revisionNo: 'R2',
      approvedReferenceNo: 'APR-0042',
      approvedDate: '2026-09-05',
      numberOfSheetsFiles: '14',
      scale: 'As Per Drawing',
      distribution: 'Electronic + Hard Copy',
      issueMethod: 'Email',
      issuedBy: 'Jane Staff',
      designation: 'Structural Engineer',
      contactNo: '+974 5555 1234',
      email: 'jane.staff@example.com',
    });
  });

  it('keeps allow-listed boolean fields only when true (drops explicit false, same as blank)', () => {
    expect(sanitizeWorkflowTaskFormData({ requiresImmediateReview: true, additionalDocumentsReceived: false })).toEqual({
      requiresImmediateReview: true,
    });
  });

  it('drops keys not on the allow-list — never a backdoor for core workflow state', () => {
    expect(sanitizeWorkflowTaskFormData({
      status: 'COMPLETED',
      remarks: 'should not persist here',
      dueDate: '2026-01-01',
      priority: 'CRITICAL',
      responsibleUserId: 'some-user-id',
      receivedFrom: 'Site Office',
    })).toEqual({ receivedFrom: 'Site Office' });
  });

  it('drops non-string values for text keys and non-boolean values for boolean keys', () => {
    expect(sanitizeWorkflowTaskFormData({ receivedFrom: 123 as unknown as string, requiresImmediateReview: 'yes' as unknown as boolean })).toBeNull();
  });

  it('truncates an overlong text value to 500 characters', () => {
    const long = 'a'.repeat(600);
    const result = sanitizeWorkflowTaskFormData({ internalNotes: long });
    expect(result?.internalNotes).toHaveLength(500);
  });
});

// ---------------------------------------------------------------------------
// buildWorkflowContractWhere
// ---------------------------------------------------------------------------

describe('buildWorkflowContractWhere', () => {
  it('returns an empty where for no filters', () => {
    expect(buildWorkflowContractWhere({})).toEqual({});
  });

  it('filters by status/departmentId/ownerUserId via AND', () => {
    const where = buildWorkflowContractWhere({ status: 'ACTIVE', departmentId: 'dept-1', ownerUserId: 'user-1' });
    expect(where['AND']).toEqual([
      { status: 'ACTIVE' },
      { departmentId: 'dept-1' },
      { ownerUserId: 'user-1' },
    ]);
  });

  it('search matches title, referenceNumber, or counterpartyName', () => {
    const where = buildWorkflowContractWhere({ search: 'Acme' });
    expect(where['AND']).toEqual([
      {
        OR: [
          { title: { contains: 'Acme', mode: 'insensitive' } },
          { referenceNumber: { contains: 'Acme', mode: 'insensitive' } },
          { counterpartyName: { contains: 'Acme', mode: 'insensitive' } },
        ],
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// ContractWorkflowService.findAll
// ---------------------------------------------------------------------------

describe('ContractWorkflowService.findAll', () => {
  it('rejects actors without contracts.read', async () => {
    const noReadActor: AuthUser = { ...ACTOR_READ_ONLY, permissions: [] };
    await expect(service.findAll({}, noReadActor)).rejects.toThrow(ForbiddenException);
  });

  it('applies the department scope filter when the actor is not ALL_DEPARTMENTS', async () => {
    mockBuildDeptFilter.mockResolvedValue({ in: ['dept-1'] });
    mockContractFindMany.mockResolvedValue([]);

    await service.findAll({}, ACTOR_READ_ONLY);

    const callArgs = mockContractFindMany.mock.calls[0]![0];
    expect(callArgs.where['AND']).toContainEqual({ departmentId: { in: ['dept-1'] } });
  });

  it('returns per-contract openTasks/overdueTasks/workflowStatus derived from tasks', async () => {
    mockContractFindMany.mockResolvedValue([makeContractRow()]);
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ status: 'NOT_STARTED' }),
      makeTaskRow({ id: 'task-2', status: 'COMPLETED' }),
    ]);

    const result = await service.findAll({}, ACTOR_READ_ONLY) as {
      items: { workflowStatus: string; openTasks: number; overdueTasks: number }[];
      summary: { totalContractsWithWorkflow: number };
    };

    expect(result.items[0]?.workflowStatus).toBe('IN_PROGRESS');
    expect(result.items[0]?.openTasks).toBe(1);
    expect(result.summary.totalContractsWithWorkflow).toBe(1);
  });

  it('filters by team', async () => {
    mockContractFindMany.mockResolvedValue([makeContractRow(), makeContractRow({ id: 'contract-2' })]);
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ contractId: 'contract-1', team: 'TECHNICAL' }),
      makeTaskRow({ contractId: 'contract-2', team: 'PRODUCTION' }),
    ]);

    const result = await service.findAll({ team: 'PRODUCTION' }, ACTOR_READ_ONLY) as { items: { id: string }[] };
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('contract-2');
  });

  it('filters by overdueOnly', async () => {
    mockContractFindMany.mockResolvedValue([makeContractRow(), makeContractRow({ id: 'contract-2' })]);
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ contractId: 'contract-1', status: 'IN_PROGRESS', dueDate: new Date('2020-01-01') }),
      makeTaskRow({ contractId: 'contract-2', status: 'NOT_STARTED', dueDate: new Date('2099-01-01') }),
    ]);

    const result = await service.findAll({ overdueOnly: true }, ACTOR_READ_ONLY) as { items: { id: string }[] };
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('contract-1');
  });

  it('computes myOpenTasks across all accessible contracts regardless of myTasksOnly', async () => {
    mockContractFindMany.mockResolvedValue([makeContractRow(), makeContractRow({ id: 'contract-2' })]);
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ contractId: 'contract-1', responsibleUserId: ACTOR_READ_ONLY.id, status: 'IN_PROGRESS' }),
      makeTaskRow({ contractId: 'contract-2', responsibleUserId: ACTOR_READ_ONLY.id, status: 'COMPLETED' }),
      makeTaskRow({ contractId: 'contract-2', responsibleUserId: 'someone-else', status: 'NOT_STARTED' }),
    ]);

    const result = await service.findAll({}, ACTOR_READ_ONLY) as { summary: { myOpenTasks: number } };
    expect(result.summary.myOpenTasks).toBe(1); // the COMPLETED one and the other user's task don't count
  });

  it('filters by taskStatus: contract matches if any of its tasks has that status', async () => {
    mockContractFindMany.mockResolvedValue([makeContractRow(), makeContractRow({ id: 'contract-2' })]);
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ contractId: 'contract-1', status: 'ON_HOLD' }),
      makeTaskRow({ contractId: 'contract-2', status: 'NOT_STARTED' }),
    ]);

    const result = await service.findAll({ taskStatus: 'ON_HOLD' }, ACTOR_READ_ONLY) as { items: { id: string }[] };
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('contract-1');
  });

  it('filters by responsibleUserId: contract matches if any of its tasks is assigned to that user', async () => {
    mockContractFindMany.mockResolvedValue([makeContractRow(), makeContractRow({ id: 'contract-2' })]);
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ contractId: 'contract-1', responsibleUserId: 'user-9' }),
      makeTaskRow({ contractId: 'contract-2', responsibleUserId: 'user-8' }),
    ]);

    const result = await service.findAll({ responsibleUserId: 'user-9' }, ACTOR_READ_ONLY) as { items: { id: string }[] };
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('contract-1');
  });

  it('filters by myTasksOnly: only contracts/tasks assigned to the actor remain, progress reflects the filtered subset', async () => {
    mockContractFindMany.mockResolvedValue([makeContractRow(), makeContractRow({ id: 'contract-2' })]);
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ contractId: 'contract-1', responsibleUserId: ACTOR_READ_ONLY.id, status: 'IN_PROGRESS' }),
      makeTaskRow({ id: 'task-2', contractId: 'contract-1', responsibleUserId: 'someone-else', status: 'NOT_STARTED' }),
      makeTaskRow({ id: 'task-3', contractId: 'contract-2', responsibleUserId: 'someone-else', status: 'NOT_STARTED' }),
    ]);

    const result = await service.findAll({ myTasksOnly: true }, ACTOR_READ_ONLY) as {
      items: { id: string; openTasks: number }[];
    };

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('contract-1');
    expect(result.items[0]?.openTasks).toBe(1); // only the actor's own task counted, not the other one on contract-1
  });
});

// ---------------------------------------------------------------------------
// ContractWorkflowService.findAssignmentQueue (CM-40)
// ---------------------------------------------------------------------------

describe('ContractWorkflowService.findAssignmentQueue', () => {
  it('rejects actors without contracts.update (contracts.read alone is not enough)', async () => {
    await expect(service.findAssignmentQueue({}, ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
  });

  it('rejects Contract Staff (contracts.workflow_update alone is not enough)', async () => {
    await expect(service.findAssignmentQueue({}, ACTOR_STAFF)).rejects.toThrow(ForbiddenException);
  });

  it('applies the department scope filter when the actor is not ALL_DEPARTMENTS', async () => {
    mockBuildDeptFilter.mockResolvedValue({ in: ['dept-1'] });
    mockContractFindMany.mockResolvedValue([]);

    await service.findAssignmentQueue({}, ACTOR_UPDATE);

    const callArgs = mockContractFindMany.mock.calls[0]![0];
    expect(callArgs.where['AND']).toContainEqual({ departmentId: { in: ['dept-1'] } });
  });

  it('includes only tasks with a null responsibleUserId, joined with contract info', async () => {
    mockContractFindMany.mockResolvedValue([makeContractRow()]);
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ id: 'task-unassigned', responsibleUserId: null }),
      makeTaskRow({ id: 'task-assigned', responsibleUserId: 'user-9' }),
    ]);

    const result = await service.findAssignmentQueue({}, ACTOR_UPDATE) as {
      items: { taskId: string; contractReference: string }[];
    };

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.taskId).toBe('task-unassigned');
    expect(result.items[0]?.contractReference).toBe('CONTRACT-2026-000001');
  });

  it('summary counts reflect ALL unassigned tasks in scope, unaffected by the team display filter', async () => {
    mockContractFindMany.mockResolvedValue([makeContractRow(), makeContractRow({ id: 'contract-2' })]);
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ id: 'task-1', contractId: 'contract-1', team: 'TECHNICAL', responsibleUserId: null }),
      makeTaskRow({ id: 'task-2', contractId: 'contract-2', team: 'PRODUCTION', responsibleUserId: null }),
    ]);

    const result = await service.findAssignmentQueue({ team: 'TECHNICAL' }, ACTOR_UPDATE) as {
      items: unknown[];
      summary: { unassignedTasksTotal: number; contractsNeedingAssignment: number; technicalUnassigned: number; productionUnassigned: number };
    };

    expect(result.items).toHaveLength(1); // display list narrowed to TECHNICAL
    expect(result.summary.unassignedTasksTotal).toBe(2); // but summary counts both
    expect(result.summary.contractsNeedingAssignment).toBe(2);
    expect(result.summary.technicalUnassigned).toBe(1);
    expect(result.summary.productionUnassigned).toBe(1);
  });

  it('filters the display list by priority', async () => {
    mockContractFindMany.mockResolvedValue([makeContractRow()]);
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ id: 'task-low', priority: 'LOW', responsibleUserId: null }),
      makeTaskRow({ id: 'task-high', priority: 'HIGH', responsibleUserId: null }),
    ]);

    const result = await service.findAssignmentQueue({ priority: 'HIGH' }, ACTOR_UPDATE) as { items: { taskId: string }[] };
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.taskId).toBe('task-high');
  });

  it('filters the display list by dueDateMissing', async () => {
    mockContractFindMany.mockResolvedValue([makeContractRow()]);
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ id: 'task-no-due', dueDate: null, responsibleUserId: null }),
      makeTaskRow({ id: 'task-has-due', dueDate: new Date('2026-09-01'), responsibleUserId: null }),
    ]);

    const result = await service.findAssignmentQueue({ dueDateMissing: true }, ACTOR_UPDATE) as { items: { taskId: string }[] };
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.taskId).toBe('task-no-due');
  });

  it('sorts by due date ascending, with tasks missing a due date last', async () => {
    mockContractFindMany.mockResolvedValue([makeContractRow()]);
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ id: 'task-none', dueDate: null, responsibleUserId: null }),
      makeTaskRow({ id: 'task-later', dueDate: new Date('2026-09-10'), responsibleUserId: null }),
      makeTaskRow({ id: 'task-soon', dueDate: new Date('2026-08-25'), responsibleUserId: null }),
    ]);

    const result = await service.findAssignmentQueue({}, ACTOR_UPDATE) as { items: { taskId: string }[] };
    expect(result.items.map((i) => i.taskId)).toEqual(['task-soon', 'task-later', 'task-none']);
  });

  it('lists ACTIVE contracts with a non-empty scope and zero generated tasks as needing setup', async () => {
    mockContractFindMany.mockResolvedValue([
      makeContractRow({ id: 'needs-setup', status: 'ACTIVE', scopeOfWork: { shopDrawing: true } }),
    ]);
    mockTaskFindMany.mockResolvedValue([]);

    const result = await service.findAssignmentQueue({}, ACTOR_UPDATE) as {
      contractsNeedingSetup: { id: string }[];
    };
    expect(result.contractsNeedingSetup).toHaveLength(1);
    expect(result.contractsNeedingSetup[0]?.id).toBe('needs-setup');
  });

  it('excludes DRAFT contracts from contractsNeedingSetup (workflow is only expected after activation)', async () => {
    mockContractFindMany.mockResolvedValue([
      makeContractRow({ id: 'still-draft', status: 'DRAFT', scopeOfWork: { shopDrawing: true } }),
    ]);
    mockTaskFindMany.mockResolvedValue([]);

    const result = await service.findAssignmentQueue({}, ACTOR_UPDATE) as { contractsNeedingSetup: unknown[] };
    expect(result.contractsNeedingSetup).toHaveLength(0);
  });

  it('excludes ACTIVE contracts whose scope produces zero task templates (nothing to generate)', async () => {
    mockContractFindMany.mockResolvedValue([
      makeContractRow({ id: 'empty-scope', status: 'ACTIVE', scopeOfWork: { notApplicable: true }, paymentTerms: null, contractValue: null }),
    ]);
    mockTaskFindMany.mockResolvedValue([]);

    const result = await service.findAssignmentQueue({}, ACTOR_UPDATE) as { contractsNeedingSetup: unknown[] };
    expect(result.contractsNeedingSetup).toHaveLength(0);
  });

  it('excludes ACTIVE contracts that already have generated tasks', async () => {
    mockContractFindMany.mockResolvedValue([
      makeContractRow({ id: 'already-has-tasks', status: 'ACTIVE', scopeOfWork: { shopDrawing: true } }),
    ]);
    mockTaskFindMany.mockResolvedValue([makeTaskRow({ contractId: 'already-has-tasks' })]);

    const result = await service.findAssignmentQueue({}, ACTOR_UPDATE) as { contractsNeedingSetup: unknown[] };
    expect(result.contractsNeedingSetup).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ContractWorkflowService.getWorkflowForContract
// ---------------------------------------------------------------------------

describe('ContractWorkflowService.getWorkflowForContract', () => {
  it('rejects actors without contracts.read', async () => {
    const noReadActor: AuthUser = { ...ACTOR_READ_ONLY, permissions: [] };
    await expect(service.getWorkflowForContract('contract-1', noReadActor)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the contract does not exist', async () => {
    mockContractFindUnique.mockResolvedValue(null);
    await expect(service.getWorkflowForContract('missing', ACTOR_READ_ONLY)).rejects.toThrow(NotFoundException);
  });

  it('asserts department access using the contract department', async () => {
    mockContractFindUnique.mockResolvedValue(makeContractRow());
    mockTaskFindMany.mockResolvedValue([makeTaskRow()]);

    await service.getWorkflowForContract('contract-1', ACTOR_READ_ONLY);

    expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_READ_ONLY, expect.anything(), 'dept-1');
  });

  it('lazily generates tasks from scope when none exist yet', async () => {
    mockContractFindUnique.mockResolvedValue(
      makeContractRow({ scopeOfWork: { shopDrawing: true }, paymentTerms: null, contractValue: null }),
    );
    mockTaskFindMany
      .mockResolvedValueOnce([]) // initial fetch: no tasks
      .mockResolvedValueOnce([makeTaskRow()]); // after generation
    mockTaskCreateMany.mockResolvedValue({ count: 4 });

    const result = await service.getWorkflowForContract('contract-1', ACTOR_READ_ONLY) as { tasks: unknown[] };

    expect(mockTaskCreateMany).toHaveBeenCalledTimes(1);
    const createArgs = mockTaskCreateMany.mock.calls[0]![0];
    expect(createArgs.data.length).toBe(4); // Technical templates only
    expect(createArgs.skipDuplicates).toBe(true);
    expect(result.tasks).toHaveLength(1);
  });

  it('does not attempt to create tasks when no templates apply (no scope, no value)', async () => {
    mockContractFindUnique.mockResolvedValue(
      makeContractRow({ scopeOfWork: null, paymentTerms: null, contractValue: null }),
    );
    mockTaskFindMany.mockResolvedValue([]);

    const result = await service.getWorkflowForContract('contract-1', ACTOR_READ_ONLY) as {
      tasks: unknown[];
      progress: { workflowStatus: string };
    };

    expect(mockTaskCreateMany).not.toHaveBeenCalled();
    expect(result.tasks).toHaveLength(0);
    expect(result.progress.workflowStatus).toBe('NOT_GENERATED');
  });

  it('does not regenerate when tasks already exist', async () => {
    mockContractFindUnique.mockResolvedValue(makeContractRow());
    mockTaskFindMany.mockResolvedValue([makeTaskRow()]);

    await service.getWorkflowForContract('contract-1', ACTOR_READ_ONLY);

    expect(mockTaskCreateMany).not.toHaveBeenCalled();
  });

  it('filters to only the actor\'s own tasks (and recomputes progress from that subset) when myTasksOnly is true', async () => {
    mockContractFindUnique.mockResolvedValue(makeContractRow());
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ id: 'task-1', responsibleUserId: ACTOR_READ_ONLY.id, status: 'IN_PROGRESS' }),
      makeTaskRow({ id: 'task-2', responsibleUserId: 'someone-else', status: 'NOT_STARTED' }),
    ]);

    const result = await service.getWorkflowForContract('contract-1', ACTOR_READ_ONLY, true) as {
      tasks: { id: string }[];
      progress: { total: number };
    };

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]?.id).toBe('task-1');
    expect(result.progress.total).toBe(1);
  });

  it('returns all tasks when myTasksOnly is not set', async () => {
    mockContractFindUnique.mockResolvedValue(makeContractRow());
    mockTaskFindMany.mockResolvedValue([
      makeTaskRow({ id: 'task-1', responsibleUserId: ACTOR_READ_ONLY.id }),
      makeTaskRow({ id: 'task-2', responsibleUserId: 'someone-else' }),
    ]);

    const result = await service.getWorkflowForContract('contract-1', ACTOR_READ_ONLY) as { tasks: { id: string }[] };

    expect(result.tasks).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// CM-57 — ContractWorkflowService.getWorkflowSummaryForContract
// ---------------------------------------------------------------------------

describe('ContractWorkflowService.getWorkflowSummaryForContract', () => {
  it('rejects actors without contracts.read', async () => {
    const noReadActor: AuthUser = { ...ACTOR_READ_ONLY, permissions: [] };
    await expect(service.getWorkflowSummaryForContract('contract-1', noReadActor)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the contract does not exist', async () => {
    mockContractFindUnique.mockResolvedValue(null);
    await expect(service.getWorkflowSummaryForContract('missing', ACTOR_READ_ONLY)).rejects.toThrow(NotFoundException);
  });

  it('asserts department access using the contract department', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: 'dept-1' });
    mockTaskFindMany.mockResolvedValue([]);

    await service.getWorkflowSummaryForContract('contract-1', ACTOR_READ_ONLY);

    expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_READ_ONLY, expect.anything(), 'dept-1');
  });

  it('never creates tasks, even when none exist yet (no lazy-generation side effect)', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: 'dept-1' });
    mockTaskFindMany.mockResolvedValue([]);

    const result = await service.getWorkflowSummaryForContract('contract-1', ACTOR_READ_ONLY);

    expect(mockTaskCreateMany).not.toHaveBeenCalled();
    expect(result.tasks).toHaveLength(0);
  });

  it('returns team/status/isOverdue/attachmentsCount for each existing task, without regenerating', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: 'dept-1' });
    mockTaskFindMany.mockResolvedValue([
      { id: 'task-1', taskName: 'Delivery Note', team: 'PRODUCTION', status: 'COMPLETED', priority: 'NORMAL', dueDate: new Date('2020-01-01T00:00:00Z'), _count: { attachments: 2 } },
      { id: 'task-2', taskName: 'Site Handover', team: 'PRODUCTION', status: 'NOT_STARTED', priority: 'URGENT', dueDate: new Date('2020-01-01T00:00:00Z'), _count: { attachments: 0 } },
    ]);

    const result = await service.getWorkflowSummaryForContract('contract-1', ACTOR_READ_ONLY);

    expect(mockTaskCreateMany).not.toHaveBeenCalled();
    expect(result.tasks).toEqual([
      { id: 'task-1', taskName: 'Delivery Note', team: 'PRODUCTION', status: 'COMPLETED', priority: 'NORMAL', dueDate: '2020-01-01T00:00:00.000Z', isOverdue: false, attachmentsCount: 2 },
      { id: 'task-2', taskName: 'Site Handover', team: 'PRODUCTION', status: 'NOT_STARTED', priority: 'URGENT', dueDate: '2020-01-01T00:00:00.000Z', isOverdue: true, attachmentsCount: 0 },
    ]);
  });

  it('returns a null dueDate when the task has none stored', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: 'dept-1' });
    mockTaskFindMany.mockResolvedValue([
      { id: 'task-3', taskName: 'Final Sign-off', team: 'TECHNICAL', status: 'IN_PROGRESS', priority: 'NORMAL', dueDate: null, _count: { attachments: 0 } },
    ]);

    const result = await service.getWorkflowSummaryForContract('contract-1', ACTOR_READ_ONLY);

    expect(result.tasks[0]?.dueDate).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ContractWorkflowService.regenerate
// ---------------------------------------------------------------------------

describe('ContractWorkflowService.regenerate', () => {
  it('rejects actors without contracts.update', async () => {
    await expect(service.regenerate('contract-1', ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
  });

  it('only inserts missing template tasks, never touching existing ones', async () => {
    mockContractFindUnique.mockResolvedValue(
      makeContractRow({
        scopeOfWork: { shopDrawing: true, production: true },
        paymentTerms: null,
        contractValue: null,
      }),
    );
    mockTaskFindMany.mockResolvedValue([{ taskKey: 'technical_drawing_received' }]);
    mockTaskCreateMany.mockResolvedValue({ count: 8 });

    const result = await service.regenerate('contract-1', ACTOR_UPDATE);

    expect(mockTaskUpdate).not.toHaveBeenCalled();
    const createArgs = mockTaskCreateMany.mock.calls[0]![0];
    // 4 technical + 5 production = 9 templates, minus the 1 already existing = 8 missing
    expect(createArgs.data).toHaveLength(8);
    expect(createArgs.data.every((d: { taskKey: string }) => d.taskKey !== 'technical_drawing_received')).toBe(true);
    expect(result.added).toBe(8);
  });

  it('adds nothing when all applicable tasks already exist', async () => {
    mockContractFindUnique.mockResolvedValue(
      makeContractRow({ scopeOfWork: { shopDrawing: true }, paymentTerms: null, contractValue: null }),
    );
    mockTaskFindMany.mockResolvedValue([
      { taskKey: 'technical_drawing_received' },
      { taskKey: 'technical_sd_calculation_submission' },
      { taskKey: 'technical_getting_approval' },
      { taskKey: 'technical_fd_issuance' },
    ]);

    const result = await service.regenerate('contract-1', ACTOR_UPDATE);

    expect(mockTaskCreateMany).not.toHaveBeenCalled();
    expect(result.added).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ContractWorkflowService.updateTask
// ---------------------------------------------------------------------------

describe('ContractWorkflowService.updateTask', () => {
  it('rejects actors without contracts.update', async () => {
    await expect(service.updateTask('task-1', {}, ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the task does not exist', async () => {
    mockTaskFindUnique.mockResolvedValue(null);
    await expect(service.updateTask('missing', {}, ACTOR_UPDATE)).rejects.toThrow(NotFoundException);
  });

  it('asserts department access using the parent contract department', async () => {
    mockTaskFindUnique.mockResolvedValue({
      id: 'task-1', status: 'NOT_STARTED', startDate: null, dueDate: null, completedDate: null,
      contract: { departmentId: 'dept-1' },
    });
    mockTaskUpdate.mockResolvedValue(makeTaskRow());

    await service.updateTask('task-1', { remarks: 'note' }, ACTOR_UPDATE);

    expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_UPDATE, expect.anything(), 'dept-1');
  });

  it('rejects an invalid responsibleUserId', async () => {
    mockTaskFindUnique.mockResolvedValue({
      id: 'task-1', status: 'NOT_STARTED', startDate: null, dueDate: null, completedDate: null,
      contract: { departmentId: null },
    });
    mockUserFindUnique.mockResolvedValue(null);

    await expect(
      service.updateTask('task-1', { responsibleUserId: 'not-a-real-user' }, ACTOR_UPDATE),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('accepts a valid responsibleUserId', async () => {
    mockTaskFindUnique.mockResolvedValue({
      id: 'task-1', status: 'NOT_STARTED', startDate: null, dueDate: null, completedDate: null,
      contract: { departmentId: null },
    });
    mockUserFindUnique.mockResolvedValue({ id: 'user-2' });
    mockTaskUpdate.mockResolvedValue(makeTaskRow({ responsibleUserId: 'user-2' }));

    const result = await service.updateTask('task-1', { responsibleUserId: 'user-2' }, ACTOR_UPDATE) as { responsibleUserId: string };
    expect(result.responsibleUserId).toBe('user-2');
  });

  it('auto-sets completedDate to today when completing a task without one', async () => {
    mockTaskFindUnique.mockResolvedValue({
      id: 'task-1', status: 'IN_PROGRESS', startDate: null, dueDate: null, completedDate: null,
      contract: { departmentId: null },
    });
    mockTaskUpdate.mockResolvedValue(makeTaskRow({ status: 'COMPLETED', completedDate: new Date() }));

    await service.updateTask('task-1', { status: 'COMPLETED' }, ACTOR_UPDATE);

    const callArgs = mockTaskUpdate.mock.calls[0]![0];
    expect(callArgs.data.completedDate).toBeInstanceOf(Date);
  });

  it('retains an existing completedDate when status moves away from COMPLETED without an explicit value', async () => {
    const existingCompletedDate = new Date('2026-08-05');
    mockTaskFindUnique.mockResolvedValue({
      id: 'task-1', status: 'COMPLETED', startDate: null, dueDate: null, completedDate: existingCompletedDate,
      contract: { departmentId: null },
    });
    mockTaskUpdate.mockResolvedValue(makeTaskRow({ status: 'IN_PROGRESS', completedDate: existingCompletedDate }));

    await service.updateTask('task-1', { status: 'IN_PROGRESS' }, ACTOR_UPDATE);

    const callArgs = mockTaskUpdate.mock.calls[0]![0];
    expect(callArgs.data.completedDate).toBeUndefined();
  });

  it('accepts priority and delayReason updates and stamps lastActivityAt', async () => {
    mockTaskFindUnique.mockResolvedValue({
      id: 'task-1', status: 'ON_HOLD', startDate: null, dueDate: null, completedDate: null,
      contract: { departmentId: null },
    });
    mockTaskUpdate.mockResolvedValue(makeTaskRow({ priority: 'HIGH', delayReason: 'Waiting on client approval' }));

    await service.updateTask('task-1', { priority: 'HIGH', delayReason: 'Waiting on client approval' }, ACTOR_UPDATE);

    const callArgs = mockTaskUpdate.mock.calls[0]![0];
    expect(callArgs.data.priority).toBe('HIGH');
    expect(callArgs.data.delayReason).toBe('Waiting on client approval');
    expect(callArgs.data.lastActivityAt).toBeInstanceOf(Date);
  });

  it('allows completing a task with a completedDate, and stamps updatedByUserId', async () => {
    mockTaskFindUnique.mockResolvedValue({
      id: 'task-1', status: 'IN_PROGRESS', startDate: null, dueDate: null, completedDate: null,
      contract: { departmentId: null },
    });
    mockTaskUpdate.mockResolvedValue(makeTaskRow({ status: 'COMPLETED', completedDate: new Date('2026-08-15') }));

    const result = await service.updateTask(
      'task-1',
      { status: 'COMPLETED', completedDate: '2026-08-15' },
      ACTOR_UPDATE,
    ) as { status: string };

    expect(result.status).toBe('COMPLETED');
    const callArgs = mockTaskUpdate.mock.calls[0]![0];
    expect(callArgs.data.updatedByUserId).toBe(ACTOR_UPDATE.id);
  });

  it('validates dates against the merged effective values (existing startDate + new dueDate)', async () => {
    mockTaskFindUnique.mockResolvedValue({
      id: 'task-1', status: 'NOT_STARTED', startDate: new Date('2026-08-10'), dueDate: null, completedDate: null,
      contract: { departmentId: null },
    });

    await expect(
      service.updateTask('task-1', { dueDate: '2026-08-01' }, ACTOR_UPDATE),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // -------------------------------------------------------------------------
  // CM-35 — staff (contracts.workflow_update) assignment + field-scope rules
  // -------------------------------------------------------------------------

  it('rejects an actor with neither contracts.update nor contracts.workflow_update', async () => {
    const noPermActor: AuthUser = { ...ACTOR_READ_ONLY, permissions: ['contracts.read'] };
    await expect(service.updateTask('task-1', { remarks: 'note' }, noPermActor)).rejects.toThrow(ForbiddenException);
  });

  it('staff can update status/completedDate/remarks/delayReason on a task assigned to them', async () => {
    mockTaskFindUnique.mockResolvedValue({
      id: 'task-1', status: 'IN_PROGRESS', startDate: null, dueDate: null, completedDate: null,
      responsibleUserId: ACTOR_STAFF.id, contract: { departmentId: null },
    });
    mockTaskUpdate.mockResolvedValue(makeTaskRow({ status: 'COMPLETED', remarks: 'Done' }));

    const result = await service.updateTask(
      'task-1',
      { status: 'COMPLETED', completedDate: '2026-08-15', remarks: 'Done', delayReason: 'n/a' },
      ACTOR_STAFF,
    ) as { status: string };

    expect(result.status).toBe('COMPLETED');
  });

  it('staff is blocked (403) from updating a task assigned to someone else', async () => {
    mockTaskFindUnique.mockResolvedValue({
      id: 'task-1', status: 'IN_PROGRESS', startDate: null, dueDate: null, completedDate: null,
      responsibleUserId: 'some-other-user', contract: { departmentId: null },
    });

    await expect(
      service.updateTask('task-1', { remarks: 'note' }, ACTOR_STAFF),
    ).rejects.toThrow(ForbiddenException);
    expect(mockTaskUpdate).not.toHaveBeenCalled();
  });

  // CM-46B — formData (optional Receipt Details / Drawing-Task Information /
  // Follow-up fields) is not in MANAGER_ONLY_WORKFLOW_FIELDS, so staff may
  // set it on their own assigned task, same as remarks/delayReason.

  it('staff can save formData on a task assigned to them, sanitized to the allow-list', async () => {
    mockTaskFindUnique.mockResolvedValue({
      id: 'task-1', status: 'IN_PROGRESS', startDate: null, dueDate: null, completedDate: null,
      responsibleUserId: ACTOR_STAFF.id, contract: { departmentId: null },
    });
    mockTaskUpdate.mockResolvedValue(makeTaskRow());

    await service.updateTask(
      'task-1',
      { formData: { receivedFrom: 'Site Office', drawingReferenceNo: 'DWG-100', priority: 'CRITICAL' } },
      ACTOR_STAFF,
    );

    const callArgs = mockTaskUpdate.mock.calls[0]![0];
    expect(callArgs.data.formData).toEqual({ receivedFrom: 'Site Office', drawingReferenceNo: 'DWG-100' });
    expect(callArgs.data.priority).toBeUndefined();
  });

  it('does not touch formData when the dto omits it entirely', async () => {
    mockTaskFindUnique.mockResolvedValue({
      id: 'task-1', status: 'IN_PROGRESS', startDate: null, dueDate: null, completedDate: null,
      responsibleUserId: ACTOR_STAFF.id, contract: { departmentId: null },
    });
    mockTaskUpdate.mockResolvedValue(makeTaskRow());

    await service.updateTask('task-1', { remarks: 'note only' }, ACTOR_STAFF);

    const callArgs = mockTaskUpdate.mock.calls[0]![0];
    expect('formData' in callArgs.data).toBe(false);
  });

  it('clears formData to null when every field is submitted blank', async () => {
    mockTaskFindUnique.mockResolvedValue({
      id: 'task-1', status: 'IN_PROGRESS', startDate: null, dueDate: null, completedDate: null,
      responsibleUserId: ACTOR_STAFF.id, contract: { departmentId: null },
    });
    mockTaskUpdate.mockResolvedValue(makeTaskRow());

    await service.updateTask('task-1', { formData: {} }, ACTOR_STAFF);

    const callArgs = mockTaskUpdate.mock.calls[0]![0];
    expect(callArgs.data.formData).toBeNull();
  });

  it('staff is blocked (403) from updating an unassigned task', async () => {
    mockTaskFindUnique.mockResolvedValue({
      id: 'task-1', status: 'IN_PROGRESS', startDate: null, dueDate: null, completedDate: null,
      responsibleUserId: null, contract: { departmentId: null },
    });

    await expect(
      service.updateTask('task-1', { remarks: 'note' }, ACTOR_STAFF),
    ).rejects.toThrow(ForbiddenException);
  });

  it.each(['responsibleUserId', 'dueDate', 'priority', 'startDate'] as const)(
    'staff is blocked (403) from changing manager-only field %s, even on their own assigned task',
    async (field) => {
      mockTaskFindUnique.mockResolvedValue({
        id: 'task-1', status: 'IN_PROGRESS', startDate: null, dueDate: null, completedDate: null,
        responsibleUserId: ACTOR_STAFF.id, contract: { departmentId: null },
      });

      const value = field === 'dueDate' || field === 'startDate' ? '2026-09-01' : field === 'priority' ? 'HIGH' : 'user-2';
      await expect(
        service.updateTask('task-1', { [field]: value }, ACTOR_STAFF),
      ).rejects.toThrow(ForbiddenException);
      expect(mockTaskUpdate).not.toHaveBeenCalled();
    },
  );

  it('manager (contracts.update) may update any task in scope regardless of assignment, including manager-only fields', async () => {
    mockTaskFindUnique.mockResolvedValue({
      id: 'task-1', status: 'NOT_STARTED', startDate: null, dueDate: null, completedDate: null,
      responsibleUserId: 'some-other-user', contract: { departmentId: null },
    });
    mockUserFindUnique.mockResolvedValue({ id: 'user-2' });
    mockTaskUpdate.mockResolvedValue(makeTaskRow({ responsibleUserId: 'user-2', dueDate: new Date('2026-09-01'), priority: 'HIGH' }));

    const result = await service.updateTask(
      'task-1',
      { responsibleUserId: 'user-2', dueDate: '2026-09-01', priority: 'HIGH' },
      ACTOR_UPDATE,
    ) as { responsibleUserId: string };

    expect(result.responsibleUserId).toBe('user-2');
  });
});

// ---------------------------------------------------------------------------
// ContractWorkflowService.listComments / addComment
// ---------------------------------------------------------------------------

describe('ContractWorkflowService.listComments', () => {
  it('rejects actors without contracts.read', async () => {
    const noReadActor: AuthUser = { ...ACTOR_READ_ONLY, permissions: [] };
    await expect(service.listComments('task-1', noReadActor)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the task does not exist', async () => {
    mockTaskFindUnique.mockResolvedValue(null);
    await expect(service.listComments('missing', ACTOR_READ_ONLY)).rejects.toThrow(NotFoundException);
  });

  it('asserts department access using the parent contract department', async () => {
    mockTaskFindUnique.mockResolvedValue({ contract: { departmentId: 'dept-1' } });
    mockCommentFindMany.mockResolvedValue([]);

    await service.listComments('task-1', ACTOR_READ_ONLY);

    expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_READ_ONLY, expect.anything(), 'dept-1');
  });
});

describe('ContractWorkflowService.addComment', () => {
  it('rejects actors without contracts.update', async () => {
    await expect(service.addComment('task-1', { comment: 'note' }, ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the task does not exist', async () => {
    mockTaskFindUnique.mockResolvedValue(null);
    await expect(service.addComment('missing', { comment: 'note' }, ACTOR_UPDATE)).rejects.toThrow(NotFoundException);
  });

  it('creates the comment and bumps the task lastActivityAt in the same transaction', async () => {
    mockTaskFindUnique.mockResolvedValue({ contract: { departmentId: null } });
    mockCommentCreate.mockResolvedValue({
      id: 'comment-1', taskId: 'task-1', comment: 'Progressing well', createdByUserId: 'user-manager-1',
      createdAt: new Date(), updatedAt: new Date(), createdByUser: { id: 'user-manager-1', displayName: 'Manager' },
    });
    mockTaskUpdate.mockResolvedValue({ id: 'task-1' });

    const result = await service.addComment('task-1', { comment: 'Progressing well' }, ACTOR_UPDATE) as { comment: string };

    expect(result.comment).toBe('Progressing well');
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    const commentCreateArgs = mockCommentCreate.mock.calls[0]![0];
    expect(commentCreateArgs.data).toEqual({ taskId: 'task-1', comment: 'Progressing well', createdByUserId: ACTOR_UPDATE.id });
    const taskUpdateArgs = mockTaskUpdate.mock.calls[0]![0];
    expect(taskUpdateArgs.data.lastActivityAt).toBeInstanceOf(Date);
  });

  // -------------------------------------------------------------------------
  // CM-35 — staff may comment only on tasks assigned to them
  // -------------------------------------------------------------------------

  it('staff can comment on a task assigned to them', async () => {
    mockTaskFindUnique.mockResolvedValue({ responsibleUserId: ACTOR_STAFF.id, contract: { departmentId: null } });
    mockCommentCreate.mockResolvedValue({
      id: 'comment-1', taskId: 'task-1', comment: 'On it', createdByUserId: ACTOR_STAFF.id,
      createdAt: new Date(), updatedAt: new Date(), createdByUser: { id: ACTOR_STAFF.id, displayName: 'Staff' },
    });
    mockTaskUpdate.mockResolvedValue({ id: 'task-1' });

    const result = await service.addComment('task-1', { comment: 'On it' }, ACTOR_STAFF) as { comment: string };
    expect(result.comment).toBe('On it');
  });

  it('staff is blocked (403) from commenting on a task assigned to someone else', async () => {
    mockTaskFindUnique.mockResolvedValue({ responsibleUserId: 'some-other-user', contract: { departmentId: null } });

    await expect(
      service.addComment('task-1', { comment: 'note' }, ACTOR_STAFF),
    ).rejects.toThrow(ForbiddenException);
    expect(mockCommentCreate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ContractWorkflowService.listAttachments / createAttachment / getAttachmentForDownload
// ---------------------------------------------------------------------------

describe('ContractWorkflowService.listAttachments', () => {
  it('rejects actors without contracts.read', async () => {
    const noReadActor: AuthUser = { ...ACTOR_READ_ONLY, permissions: [] };
    await expect(service.listAttachments('task-1', noReadActor)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the task does not exist', async () => {
    mockTaskFindUnique.mockResolvedValue(null);
    await expect(service.listAttachments('missing', ACTOR_READ_ONLY)).rejects.toThrow(NotFoundException);
  });

  it('asserts department access using the parent contract department', async () => {
    mockTaskFindUnique.mockResolvedValue({ contract: { departmentId: 'dept-1' } });
    mockAttachmentFindMany.mockResolvedValue([]);

    await service.listAttachments('task-1', ACTOR_READ_ONLY);

    expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_READ_ONLY, expect.anything(), 'dept-1');
  });
});

const VALID_FILE = { buffer: Buffer.from('test'), originalname: 'drawing.pdf', mimetype: 'application/pdf', size: 1024 };

describe('ContractWorkflowService.createAttachment', () => {
  it('rejects actors without contracts.update', async () => {
    await expect(service.createAttachment('task-1', VALID_FILE, ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the task does not exist', async () => {
    mockTaskFindUnique.mockResolvedValue(null);
    await expect(service.createAttachment('missing', VALID_FILE, ACTOR_UPDATE)).rejects.toThrow(NotFoundException);
  });

  it('rejects an unsupported mime type before writing anything to storage or the DB', async () => {
    mockTaskFindUnique.mockResolvedValue({ contract: { departmentId: null } });

    await expect(
      service.createAttachment('task-1', { ...VALID_FILE, mimetype: 'application/zip' }, ACTOR_UPDATE),
    ).rejects.toThrow(UnprocessableEntityException);

    expect(mockStorageSave).not.toHaveBeenCalled();
    expect(mockAttachmentCreate).not.toHaveBeenCalled();
  });

  it('rejects a file over the size limit before writing anything to storage or the DB', async () => {
    mockTaskFindUnique.mockResolvedValue({ contract: { departmentId: null } });

    await expect(
      service.createAttachment('task-1', { ...VALID_FILE, size: 11 * 1024 * 1024 }, ACTOR_UPDATE),
    ).rejects.toThrow(UnprocessableEntityException);

    expect(mockStorageSave).not.toHaveBeenCalled();
    expect(mockAttachmentCreate).not.toHaveBeenCalled();
  });

  it('saves to storage, creates the DB row, and bumps lastActivityAt for a valid PDF', async () => {
    mockTaskFindUnique.mockResolvedValue({ contract: { departmentId: null } });
    mockAttachmentCreate.mockResolvedValue({
      id: 'att-1', taskId: 'task-1', fileName: 'stored-file.pdf', originalFileName: 'drawing.pdf',
      mimeType: 'application/pdf', fileSize: 1024, uploadedByUserId: 'user-manager-1', createdAt: new Date(),
      uploadedByUser: { id: 'user-manager-1', displayName: 'Manager' },
    });
    mockTaskUpdate.mockResolvedValue({ id: 'task-1' });

    const result = await service.createAttachment('task-1', VALID_FILE, ACTOR_UPDATE) as { originalFileName: string };

    expect(mockStorageSave).toHaveBeenCalledWith('task-1', VALID_FILE.buffer, 'drawing.pdf');
    expect(result.originalFileName).toBe('drawing.pdf');
    const taskUpdateArgs = mockTaskUpdate.mock.calls[0]![0];
    expect(taskUpdateArgs.data.lastActivityAt).toBeInstanceOf(Date);
  });

  it('asserts department access using the parent contract department before touching storage', async () => {
    mockTaskFindUnique.mockResolvedValue({ contract: { departmentId: 'dept-1' } });
    mockAttachmentCreate.mockResolvedValue({ id: 'att-1' });
    mockTaskUpdate.mockResolvedValue({ id: 'task-1' });

    await service.createAttachment('task-1', VALID_FILE, ACTOR_UPDATE);

    expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_UPDATE, expect.anything(), 'dept-1');
  });

  // -------------------------------------------------------------------------
  // CM-35 — staff may upload attachments only on tasks assigned to them
  // -------------------------------------------------------------------------

  it('staff can upload an attachment on a task assigned to them', async () => {
    mockTaskFindUnique.mockResolvedValue({ responsibleUserId: ACTOR_STAFF.id, contract: { departmentId: null } });
    mockAttachmentCreate.mockResolvedValue({
      id: 'att-1', taskId: 'task-1', fileName: 'stored-file.pdf', originalFileName: 'drawing.pdf',
      mimeType: 'application/pdf', fileSize: 1024, uploadedByUserId: ACTOR_STAFF.id, createdAt: new Date(),
      uploadedByUser: { id: ACTOR_STAFF.id, displayName: 'Staff' },
    });
    mockTaskUpdate.mockResolvedValue({ id: 'task-1' });

    const result = await service.createAttachment('task-1', VALID_FILE, ACTOR_STAFF) as { originalFileName: string };
    expect(result.originalFileName).toBe('drawing.pdf');
  });

  it('staff is blocked (403) from uploading an attachment on a task assigned to someone else', async () => {
    mockTaskFindUnique.mockResolvedValue({ responsibleUserId: 'some-other-user', contract: { departmentId: null } });

    await expect(
      service.createAttachment('task-1', VALID_FILE, ACTOR_STAFF),
    ).rejects.toThrow(ForbiddenException);
    expect(mockStorageSave).not.toHaveBeenCalled();
  });
});

describe('ContractWorkflowService.getAttachmentForDownload', () => {
  it('rejects actors without contracts.read', async () => {
    const noReadActor: AuthUser = { ...ACTOR_READ_ONLY, permissions: [] };
    await expect(service.getAttachmentForDownload('task-1', 'att-1', noReadActor)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the attachment does not exist (or does not belong to the given task)', async () => {
    mockAttachmentFindFirst.mockResolvedValue(null);
    await expect(service.getAttachmentForDownload('task-1', 'missing', ACTOR_READ_ONLY)).rejects.toThrow(NotFoundException);
  });

  it('blocks download when the actor cannot access the attachment task\'s department', async () => {
    mockAttachmentFindFirst.mockResolvedValue({
      storagePath: 'task-1/file.pdf', originalFileName: 'drawing.pdf', mimeType: 'application/pdf',
      task: { contract: { departmentId: 'other-dept' } },
    });
    mockAssertCanAccessDepartment.mockRejectedValue(new ForbiddenException({ code: 'CONTRACTS_DEPARTMENT_ACCESS_DENIED' }));

    await expect(service.getAttachmentForDownload('task-1', 'att-1', ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
  });

  it('returns the storage path and display metadata for an accessible attachment', async () => {
    mockAttachmentFindFirst.mockResolvedValue({
      storagePath: 'task-1/file.pdf', originalFileName: 'drawing.pdf', mimeType: 'application/pdf',
      task: { contract: { departmentId: null } },
    });

    const result = await service.getAttachmentForDownload('task-1', 'att-1', ACTOR_READ_ONLY);

    expect(result).toEqual({ storagePath: 'task-1/file.pdf', originalFileName: 'drawing.pdf', mimeType: 'application/pdf' });
  });
});
