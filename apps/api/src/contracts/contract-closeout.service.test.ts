import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import {
  ContractCloseoutService,
  computeCloseoutChecks,
  toRiskSnapshot,
  computeCloseoutListSummary,
  buildCloseoutListWhere,
  toCloseoutListItem,
} from './contract-closeout.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { CloseoutAttachmentStorageService } from './closeout-attachment-storage.service';

// ---------------------------------------------------------------------------
// Client / transaction mocks
// ---------------------------------------------------------------------------

const mockRequestFindUnique = vi.fn();
const mockRequestFindFirst = vi.fn();
const mockRequestFindMany = vi.fn();
const mockRequestCount = vi.fn();
const mockContractFindUnique = vi.fn();
const mockWorkflowTaskFindMany = vi.fn();
const mockIssueFindMany = vi.fn();
const mockClaimFindMany = vi.fn();
const mockPaymentFindMany = vi.fn();
const mockAttachmentFindMany = vi.fn();
const mockAttachmentFindFirst = vi.fn();

const mockTxRequestCreate = vi.fn();
const mockTxRequestUpdate = vi.fn();
const mockTxRequestCount = vi.fn();
const mockTxActivityCreate = vi.fn();
const mockTxContractUpdateMany = vi.fn();
const mockTxSecurityAuditEventCreate = vi.fn();
const mockTxAttachmentCreate = vi.fn();

const mockTx = {
  contractCloseoutRequest: { create: mockTxRequestCreate, update: mockTxRequestUpdate, count: mockTxRequestCount },
  contractActivity: { create: mockTxActivityCreate },
  contract: { updateMany: mockTxContractUpdateMany },
  securityAuditEvent: { create: mockTxSecurityAuditEventCreate },
  contractCloseoutAttachment: { create: mockTxAttachmentCreate },
};

const mockTransaction = vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

const mockClient = {
  contractCloseoutRequest: {
    findUnique: mockRequestFindUnique,
    findFirst: mockRequestFindFirst,
    findMany: mockRequestFindMany,
    count: mockRequestCount,
  },
  contract: { findUnique: mockContractFindUnique },
  contractWorkflowTask: { findMany: mockWorkflowTaskFindMany },
  contractIssue: { findMany: mockIssueFindMany },
  contractClaim: { findMany: mockClaimFindMany },
  contractPayment: { findMany: mockPaymentFindMany },
  contractCloseoutAttachment: { findMany: mockAttachmentFindMany, findFirst: mockAttachmentFindFirst },
  $transaction: mockTransaction,
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockAssertCanAccessDepartment = vi.fn().mockResolvedValue(undefined);
const mockBuildDeptFilter = vi.fn().mockResolvedValue(null);
const mockDeptAccess = {
  assertCanAccessDepartment: mockAssertCanAccessDepartment,
  buildDeptFilter: mockBuildDeptFilter,
} as unknown as DepartmentAccessService;

const mockStorageSave = vi.fn().mockResolvedValue({ fileName: 'stored-file.pdf', storagePath: 'request-1/stored-file.pdf' });
const mockAttachmentStorage = { save: mockStorageSave } as unknown as CloseoutAttachmentStorageService;

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
  id: 'user-cm-1',
  username: 'cmuser',
  displayName: 'CM User',
  roleId: 'role-cm',
  roleCode: 'CM',
  roleName: 'Contract Management User',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-2',
  departmentId: null,
  permissions: ['contracts.read', 'contracts.update'],
};

const ACTOR_REVIEWER: AuthUser = {
  id: 'user-manager-1',
  username: 'manager',
  displayName: 'Manager',
  roleId: 'role-admin',
  roleCode: 'ADMIN',
  roleName: 'Admin',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-3',
  departmentId: null,
  permissions: ['contracts.read', 'contracts.update', 'contracts.close'],
};

function makeContractRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'contract-1',
    referenceNumber: 'CONTRACT-2026-000001',
    status: 'ACTIVE',
    departmentId: null,
    version: 1,
    ownerUserId: 'user-manager-1',
    ...overrides,
  };
}

function makeRequestRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'request-1',
    contractId: 'contract-1',
    requestNo: 'CONTRACT-2026-000001-CLO-01',
    status: 'SUBMITTED',
    requestedByUserId: 'user-cm-1',
    requestedAt: new Date('2026-08-01T00:00:00Z'),
    reviewedByUserId: null,
    reviewedAt: null,
    approvedAt: null,
    rejectedAt: null,
    closedAt: null,
    closeoutSummary: 'Ready to close',
    requestedRemarks: null,
    reviewRemarks: null,
    rejectionReason: null,
    riskSnapshot: {},
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    requestedByUser: { id: 'user-cm-1', displayName: 'CM User' },
    reviewedByUser: null,
    _count: { attachments: 0 },
    ...overrides,
  };
}

function makeRequestForLookup(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'request-1',
    contractId: 'contract-1',
    status: 'SUBMITTED',
    closeoutSummary: 'Ready to close',
    requestedRemarks: null,
    reviewRemarks: null,
    contract: makeContractRow(),
    ...overrides,
  };
}

let service: ContractCloseoutService;

beforeEach(() => {
  vi.clearAllMocks();
  mockAssertCanAccessDepartment.mockResolvedValue(undefined);
  mockBuildDeptFilter.mockResolvedValue(null);
  mockStorageSave.mockResolvedValue({ fileName: 'stored-file.pdf', storagePath: 'request-1/stored-file.pdf' });
  service = new ContractCloseoutService(mockDb, mockDeptAccess, mockAttachmentStorage);
});

// ---------------------------------------------------------------------------
// computeCloseoutChecks
// ---------------------------------------------------------------------------

describe('computeCloseoutChecks', () => {
  const today = new Date('2026-08-20T00:00:00Z');

  it('counts open/overdue/completed workflow tasks using the closeout-specific ready set (APPROVED/COMPLETED)', () => {
    const checks = computeCloseoutChecks({
      workflowTasks: [
        { status: 'NOT_STARTED', dueDate: new Date('2026-08-01') }, // open + overdue
        { status: 'REJECTED', dueDate: new Date('2099-01-01') }, // open, not overdue
        { status: 'APPROVED', dueDate: new Date('2026-08-01') }, // ready, never overdue
        { status: 'COMPLETED', dueDate: null }, // ready
      ],
      issues: [], claims: [], payments: [], documentsCount: 0, today,
    });
    expect(checks.workflow).toEqual({ total: 4, open: 2, overdue: 1, completed: 2 });
  });

  it('treats RESOLVED issues as still open (documented conservative choice)', () => {
    const checks = computeCloseoutChecks({
      workflowTasks: [],
      issues: [
        { status: 'OPEN' }, { status: 'IN_PROGRESS' }, { status: 'WAITING_RESPONSE' },
        { status: 'RESOLVED' }, { status: 'CLOSED' }, { status: 'CANCELLED' },
      ],
      claims: [], payments: [], documentsCount: 0, today,
    });
    expect(checks.issues).toEqual({ total: 6, open: 4, final: 2 });
  });

  it('classifies all 10 claim statuses into exactly open (5) or final (5)', () => {
    const checks = computeCloseoutChecks({
      workflowTasks: [], issues: [],
      claims: [
        { status: 'DRAFT' }, { status: 'UNDER_REVIEW' }, { status: 'SUBMITTED' },
        { status: 'UNDER_NEGOTIATION' }, { status: 'PARTIALLY_APPROVED' },
        { status: 'APPROVED' }, { status: 'REJECTED' }, { status: 'SETTLED' },
        { status: 'CLOSED' }, { status: 'CANCELLED' },
      ],
      payments: [], documentsCount: 0, today,
    });
    expect(checks.claims).toEqual({ total: 10, open: 5, final: 5 });
  });

  it('computes payments breakdown and outstanding amount, excluding PAID/CANCELLED', () => {
    const checks = computeCloseoutChecks({
      workflowTasks: [], issues: [], claims: [],
      payments: [
        { status: 'PAID', submittedAmount: 1000, certifiedAmount: 1000, paidAmount: 1000 },
        { status: 'CANCELLED', submittedAmount: 500, certifiedAmount: null, paidAmount: 0 },
        { status: 'PARTIALLY_PAID', submittedAmount: 1000, certifiedAmount: 1000, paidAmount: 400 },
        { status: 'OVERDUE', submittedAmount: 800, certifiedAmount: null, paidAmount: 0 },
        { status: 'SUBMITTED', submittedAmount: 200, certifiedAmount: null, paidAmount: 0 },
      ],
      documentsCount: 0, today,
    });
    expect(checks.payments.nonFinalCount).toBe(3);
    expect(checks.payments.partiallyPaidCount).toBe(1);
    expect(checks.payments.overdueCount).toBe(1);
    expect(checks.payments.outstandingAmount).toBe('1600.000'); // 600 + 800 + 200
  });

  it('isReadyForClosure is true only when workflow/issues/claims/payments are all clear (documents excluded from the gate)', () => {
    const clear = computeCloseoutChecks({
      workflowTasks: [{ status: 'COMPLETED', dueDate: null }],
      issues: [{ status: 'CLOSED' }],
      claims: [{ status: 'SETTLED' }],
      payments: [{ status: 'PAID', submittedAmount: 100, certifiedAmount: 100, paidAmount: 100 }],
      documentsCount: 0, today,
    });
    expect(clear.isReadyForClosure).toBe(true);

    const notClear = computeCloseoutChecks({
      workflowTasks: [{ status: 'NOT_STARTED', dueDate: null }],
      issues: [], claims: [], payments: [], documentsCount: 5, today,
    });
    expect(notClear.isReadyForClosure).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toRiskSnapshot
// ---------------------------------------------------------------------------

describe('toRiskSnapshot', () => {
  it('flattens checks into the exact spec-required snapshot fields', () => {
    const checks = computeCloseoutChecks({
      workflowTasks: [{ status: 'NOT_STARTED', dueDate: new Date('2020-01-01') }],
      issues: [{ status: 'OPEN' }],
      claims: [{ status: 'DRAFT' }],
      payments: [{ status: 'SUBMITTED', submittedAmount: 500, certifiedAmount: null, paidAmount: 0 }],
      documentsCount: 0,
      today: new Date('2026-08-20T00:00:00Z'),
    });
    const snapshot = toRiskSnapshot(checks);
    expect(snapshot).toEqual({
      openWorkflowTasksCount: 1,
      overdueWorkflowTasksCount: 1,
      openIssuesCount: 1,
      openClaimsCount: 1,
      outstandingPaymentAmount: '500.000',
      unpaidPaymentsCount: 1,
      missingCloseoutDocumentsCount: 1,
      checkedAt: checks.checkedAt,
    });
  });

  it('missingCloseoutDocumentsCount is 0 when at least one document exists', () => {
    const checks = computeCloseoutChecks({
      workflowTasks: [], issues: [], claims: [], payments: [], documentsCount: 2,
    });
    expect(toRiskSnapshot(checks).missingCloseoutDocumentsCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ContractCloseoutService.getCloseoutChecks
// ---------------------------------------------------------------------------

describe('ContractCloseoutService.getCloseoutChecks', () => {
  it('rejects actors without contracts.read', async () => {
    const noReadActor: AuthUser = { ...ACTOR_READ_ONLY, permissions: [] };
    await expect(service.getCloseoutChecks('contract-1', noReadActor)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the contract does not exist', async () => {
    mockContractFindUnique.mockResolvedValue(null);
    await expect(service.getCloseoutChecks('missing', ACTOR_READ_ONLY)).rejects.toThrow(NotFoundException);
  });

  it('asserts department access using the contract department', async () => {
    mockContractFindUnique.mockResolvedValue(makeContractRow({ departmentId: 'dept-1' }));
    mockWorkflowTaskFindMany.mockResolvedValue([]);
    mockIssueFindMany.mockResolvedValue([]);
    mockClaimFindMany.mockResolvedValue([]);
    mockPaymentFindMany.mockResolvedValue([]);
    mockRequestFindFirst.mockResolvedValue(null);

    await service.getCloseoutChecks('contract-1', ACTOR_READ_ONLY);

    expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_READ_ONLY, expect.anything(), 'dept-1');
  });

  it('returns zeroed checks with no crash for an old contract with nothing recorded', async () => {
    mockContractFindUnique.mockResolvedValue(makeContractRow());
    mockWorkflowTaskFindMany.mockResolvedValue([]);
    mockIssueFindMany.mockResolvedValue([]);
    mockClaimFindMany.mockResolvedValue([]);
    mockPaymentFindMany.mockResolvedValue([]);
    mockRequestFindFirst.mockResolvedValue(null);

    const checks = await service.getCloseoutChecks('contract-1', ACTOR_READ_ONLY);

    expect(checks).toMatchObject({
      workflow: { total: 0, open: 0, overdue: 0, completed: 0 },
      issues: { total: 0, open: 0, final: 0 },
      claims: { total: 0, open: 0, final: 0 },
      documents: { count: 0 },
      isReadyForClosure: true,
    });
  });
});

// ---------------------------------------------------------------------------
// ContractCloseoutService.createRequest
// ---------------------------------------------------------------------------

describe('ContractCloseoutService.createRequest', () => {
  const dto = { closeoutSummary: 'All work completed' };

  beforeEach(() => {
    mockWorkflowTaskFindMany.mockResolvedValue([]);
    mockIssueFindMany.mockResolvedValue([]);
    mockClaimFindMany.mockResolvedValue([]);
    mockPaymentFindMany.mockResolvedValue([]);
    mockRequestFindFirst.mockResolvedValue(null);
  });

  it('rejects actors without contracts.update', async () => {
    await expect(service.createRequest('contract-1', dto as never, ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the contract does not exist', async () => {
    mockContractFindUnique.mockResolvedValue(null);
    await expect(service.createRequest('missing', dto as never, ACTOR_UPDATE)).rejects.toThrow(NotFoundException);
  });

  it('rejects when the contract is already CLOSED', async () => {
    mockContractFindUnique.mockResolvedValue(makeContractRow({ status: 'CLOSED' }));
    await expect(service.createRequest('contract-1', dto as never, ACTOR_UPDATE)).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects a duplicate active request (Scenario C)', async () => {
    mockContractFindUnique.mockResolvedValue(makeContractRow());
    mockRequestFindFirst.mockResolvedValueOnce({ id: 'existing-request', requestNo: 'CONTRACT-2026-000001-CLO-01' });

    await expect(service.createRequest('contract-1', dto as never, ACTOR_UPDATE)).rejects.toThrow(ConflictException);
  });

  it('creates a SUBMITTED request directly (draft flow skipped) with a generated requestNo and riskSnapshot, and writes an activity entry', async () => {
    mockContractFindUnique.mockResolvedValue(makeContractRow());
    mockTxRequestCount.mockResolvedValue(0);
    mockTxRequestCreate.mockResolvedValue(makeRequestRow());

    const result = await service.createRequest('contract-1', dto as never, ACTOR_UPDATE) as { status: string; attachmentsCount: number };

    expect(result.status).toBe('SUBMITTED');
    expect(result.attachmentsCount).toBe(0);
    const createArgs = mockTxRequestCreate.mock.calls[0]![0];
    expect(createArgs.data.status).toBe('SUBMITTED');
    expect(createArgs.data.requestNo).toBe('CONTRACT-2026-000001-CLO-01');
    expect(createArgs.data.requestedByUserId).toBe(ACTOR_UPDATE.id);
    expect(createArgs.data.riskSnapshot).toBeDefined();
    expect(mockTxActivityCreate).toHaveBeenCalledTimes(1);
    const activityArgs = mockTxActivityCreate.mock.calls[0]![0];
    expect(activityArgs.data.event).toBe('closeout_requested');
  });

  it('allows a new request after the previous one was REJECTED', async () => {
    mockContractFindUnique.mockResolvedValue(makeContractRow());
    mockRequestFindFirst.mockResolvedValueOnce(null); // no ACTIVE request (REJECTED is not in the active set)
    mockTxRequestCount.mockResolvedValue(1);
    mockTxRequestCreate.mockResolvedValue(makeRequestRow({ requestNo: 'CONTRACT-2026-000001-CLO-02' }));

    await expect(service.createRequest('contract-1', dto as never, ACTOR_UPDATE)).resolves.toBeDefined();
    const createArgs = mockTxRequestCreate.mock.calls[0]![0];
    expect(createArgs.data.requestNo).toBe('CONTRACT-2026-000001-CLO-02');
  });
});

// ---------------------------------------------------------------------------
// ContractCloseoutService.approve / reject / review
// ---------------------------------------------------------------------------

describe('ContractCloseoutService.review', () => {
  beforeEach(() => {
    mockWorkflowTaskFindMany.mockResolvedValue([]);
    mockIssueFindMany.mockResolvedValue([]);
    mockClaimFindMany.mockResolvedValue([]);
    mockPaymentFindMany.mockResolvedValue([]);
    mockRequestFindFirst.mockResolvedValue(null);
  });

  it('rejects actors without contracts.close (Scenario D)', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequestForLookup());
    await expect(service.review('request-1', {}, ACTOR_UPDATE)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the request is not SUBMITTED', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequestForLookup({ status: 'APPROVED' }));
    await expect(service.review('request-1', {}, ACTOR_REVIEWER)).rejects.toThrow(UnprocessableEntityException);
  });

  it('moves SUBMITTED -> UNDER_REVIEW and stamps reviewedBy/reviewedAt', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequestForLookup());
    mockTxRequestUpdate.mockResolvedValue(makeRequestRow({ status: 'UNDER_REVIEW' }));

    const result = await service.review('request-1', { reviewRemarks: 'Looks fine' }, ACTOR_REVIEWER) as { status: string };
    expect(result.status).toBe('UNDER_REVIEW');
    const updateArgs = mockTxRequestUpdate.mock.calls[0]![0];
    expect(updateArgs.data.status).toBe('UNDER_REVIEW');
    expect(updateArgs.data.reviewedByUserId).toBe(ACTOR_REVIEWER.id);
    expect(updateArgs.data.reviewedAt).toBeInstanceOf(Date);
  });

  it('asserts department access using the parent contract department', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequestForLookup({ contract: makeContractRow({ departmentId: 'dept-1' }) }));
    mockTxRequestUpdate.mockResolvedValue(makeRequestRow());

    await service.review('request-1', {}, ACTOR_REVIEWER);

    expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_REVIEWER, expect.anything(), 'dept-1');
  });
});

describe('ContractCloseoutService.approve', () => {
  it('rejects actors without contracts.close', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequestForLookup());
    await expect(service.approve('request-1', {}, ACTOR_UPDATE)).rejects.toThrow(ForbiddenException);
  });

  it('rejects a request that is REJECTED/CANCELLED/CLOSED', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequestForLookup({ status: 'REJECTED' }));
    await expect(service.approve('request-1', {}, ACTOR_REVIEWER)).rejects.toThrow(UnprocessableEntityException);
  });

  it('approves from SUBMITTED and does not touch the contract itself (Scenario E)', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequestForLookup({ status: 'SUBMITTED' }));
    mockTxRequestUpdate.mockResolvedValue(makeRequestRow({ status: 'APPROVED', approvedAt: new Date() }));

    const result = await service.approve('request-1', {}, ACTOR_REVIEWER) as { status: string };

    expect(result.status).toBe('APPROVED');
    expect(mockTxContractUpdateMany).not.toHaveBeenCalled();
    const updateArgs = mockTxRequestUpdate.mock.calls[0]![0];
    expect(updateArgs.data.status).toBe('APPROVED');
    expect(updateArgs.data.approvedAt).toBeInstanceOf(Date);
  });

  it('approves from UNDER_REVIEW without re-stamping reviewedAt', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequestForLookup({ status: 'UNDER_REVIEW' }));
    mockTxRequestUpdate.mockResolvedValue(makeRequestRow({ status: 'APPROVED' }));

    await service.approve('request-1', {}, ACTOR_REVIEWER);

    const updateArgs = mockTxRequestUpdate.mock.calls[0]![0];
    expect(updateArgs.data.reviewedAt).toBeUndefined();
  });
});

describe('ContractCloseoutService.reject', () => {
  it('rejects actors without contracts.close', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequestForLookup());
    await expect(service.reject('request-1', { rejectionReason: 'Missing docs' } as never, ACTOR_UPDATE)).rejects.toThrow(ForbiddenException);
  });

  it('requires and stores a rejectionReason (Scenario G)', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequestForLookup());
    mockTxRequestUpdate.mockResolvedValue(makeRequestRow({ status: 'REJECTED', rejectionReason: 'Outstanding payments' }));

    const result = await service.reject('request-1', { rejectionReason: 'Outstanding payments' } as never, ACTOR_REVIEWER) as { status: string };

    expect(result.status).toBe('REJECTED');
    const updateArgs = mockTxRequestUpdate.mock.calls[0]![0];
    expect(updateArgs.data.rejectionReason).toBe('Outstanding payments');
    expect(updateArgs.data.status).toBe('REJECTED');
  });
});

// ---------------------------------------------------------------------------
// ContractCloseoutService.closeContract
// ---------------------------------------------------------------------------

describe('ContractCloseoutService.closeContract', () => {
  it('rejects actors without contracts.close', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequestForLookup({ status: 'APPROVED' }));
    await expect(service.closeContract('request-1', ACTOR_UPDATE)).rejects.toThrow(ForbiddenException);
  });

  it('blocks closing without an APPROVED request (Scenario H)', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequestForLookup({ status: 'SUBMITTED' }));
    await expect(service.closeContract('request-1', ACTOR_REVIEWER)).rejects.toThrow(UnprocessableEntityException);
    expect(mockTxContractUpdateMany).not.toHaveBeenCalled();
  });

  it('blocks closing a request that was REJECTED', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequestForLookup({ status: 'REJECTED' }));
    await expect(service.closeContract('request-1', ACTOR_REVIEWER)).rejects.toThrow(UnprocessableEntityException);
  });

  it('closes the contract and the request together, and writes activity + audit entries (Scenario F)', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequestForLookup({ status: 'APPROVED', contract: makeContractRow({ status: 'ACTIVE' }) }));
    mockTxContractUpdateMany.mockResolvedValue({ count: 1 });
    mockTxRequestUpdate.mockResolvedValue(makeRequestRow({ status: 'CLOSED', closedAt: new Date() }));

    const result = await service.closeContract('request-1', ACTOR_REVIEWER) as { status: string };

    expect(result.status).toBe('CLOSED');
    const contractUpdateArgs = mockTxContractUpdateMany.mock.calls[0]![0];
    expect(contractUpdateArgs.data.status).toBe('CLOSED');
    const requestUpdateArgs = mockTxRequestUpdate.mock.calls[0]![0];
    expect(requestUpdateArgs.data.status).toBe('CLOSED');
    expect(requestUpdateArgs.data.closedAt).toBeInstanceOf(Date);
    expect(mockTxActivityCreate).toHaveBeenCalledTimes(1);
    expect(mockTxSecurityAuditEventCreate).toHaveBeenCalledTimes(1);
  });

  it('throws ConflictException on a contract version race', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequestForLookup({ status: 'APPROVED', contract: makeContractRow({ status: 'ACTIVE' }) }));
    mockTxContractUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.closeContract('request-1', ACTOR_REVIEWER)).rejects.toThrow(ConflictException);
  });

  it('rejects closing a contract that is not ACTIVE/TERMINATED (e.g. already CLOSED)', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequestForLookup({ status: 'APPROVED', contract: makeContractRow({ status: 'CLOSED' }) }));
    await expect(service.closeContract('request-1', ACTOR_REVIEWER)).rejects.toThrow(UnprocessableEntityException);
  });
});

// ---------------------------------------------------------------------------
// ContractCloseoutService attachments
// ---------------------------------------------------------------------------

const VALID_FILE = { buffer: Buffer.from('test'), originalname: 'closeout-report.pdf', mimetype: 'application/pdf', size: 1024 };

describe('ContractCloseoutService.createAttachment', () => {
  it('rejects an unsupported mime type before writing anything', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequestForLookup());
    await expect(
      service.createAttachment('request-1', { ...VALID_FILE, mimetype: 'application/zip' }, ACTOR_UPDATE),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mockStorageSave).not.toHaveBeenCalled();
  });

  it('saves to storage, creates the DB row, and logs activity for a valid PDF', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequestForLookup());
    mockTxAttachmentCreate.mockResolvedValue({
      id: 'att-1', closeoutRequestId: 'request-1', fileName: 'stored-file.pdf', originalFileName: 'closeout-report.pdf',
      mimeType: 'application/pdf', fileSize: 1024, uploadedByUserId: ACTOR_UPDATE.id, createdAt: new Date(),
      uploadedByUser: { id: ACTOR_UPDATE.id, displayName: 'CM User' },
    });

    const result = await service.createAttachment('request-1', VALID_FILE, ACTOR_UPDATE) as { originalFileName: string };

    expect(mockStorageSave).toHaveBeenCalledWith('request-1', VALID_FILE.buffer, 'closeout-report.pdf');
    expect(result.originalFileName).toBe('closeout-report.pdf');
    expect(mockTxActivityCreate).toHaveBeenCalledTimes(1);
  });
});

describe('ContractCloseoutService.getAttachmentForDownload', () => {
  it('rejects when the attachment does not exist', async () => {
    mockAttachmentFindFirst.mockResolvedValue(null);
    await expect(service.getAttachmentForDownload('request-1', 'missing', ACTOR_READ_ONLY)).rejects.toThrow(NotFoundException);
  });

  it('blocks download when the actor cannot access the department (Scenario I/K)', async () => {
    mockAttachmentFindFirst.mockResolvedValue({
      storagePath: 'request-1/file.pdf', originalFileName: 'report.pdf', mimeType: 'application/pdf',
      closeoutRequest: { contract: { departmentId: 'other-dept' } },
    });
    mockAssertCanAccessDepartment.mockRejectedValue(new ForbiddenException({ code: 'CONTRACTS_DEPARTMENT_ACCESS_DENIED' }));

    await expect(service.getAttachmentForDownload('request-1', 'att-1', ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
  });

  it('returns storage path + display metadata for an accessible attachment', async () => {
    mockAttachmentFindFirst.mockResolvedValue({
      storagePath: 'request-1/file.pdf', originalFileName: 'report.pdf', mimeType: 'application/pdf',
      closeoutRequest: { contract: { departmentId: null } },
    });

    const result = await service.getAttachmentForDownload('request-1', 'att-1', ACTOR_READ_ONLY);

    expect(result).toEqual({ storagePath: 'request-1/file.pdf', originalFileName: 'report.pdf', mimeType: 'application/pdf' });
  });
});

// ---------------------------------------------------------------------------
// CM-38 — module-level Closeout Requests register
// ---------------------------------------------------------------------------

describe('computeCloseoutListSummary', () => {
  it('counts each status independently and totals pendingReview as SUBMITTED + UNDER_REVIEW', () => {
    const summary = computeCloseoutListSummary([
      { status: 'SUBMITTED' }, { status: 'SUBMITTED' }, { status: 'UNDER_REVIEW' },
      { status: 'APPROVED' }, { status: 'REJECTED' }, { status: 'CLOSED' },
    ]);
    expect(summary).toEqual({
      totalRequests: 6, submitted: 2, underReview: 1, approved: 1, rejected: 1, closed: 1, pendingReview: 3,
    });
  });

  it('returns all zeros for an empty list (no fake data)', () => {
    expect(computeCloseoutListSummary([])).toEqual({
      totalRequests: 0, submitted: 0, underReview: 0, approved: 0, rejected: 0, closed: 0, pendingReview: 0,
    });
  });
});

describe('buildCloseoutListWhere', () => {
  it('returns an empty object for an empty query', () => {
    expect(buildCloseoutListWhere({})).toEqual({});
  });

  it('maps contractId to a direct where.contractId', () => {
    expect(buildCloseoutListWhere({ contractId: 'contract-1' })).toEqual({ contractId: 'contract-1' });
  });

  it('maps pendingOnly to status IN [SUBMITTED, UNDER_REVIEW]', () => {
    const where = buildCloseoutListWhere({ pendingOnly: true });
    expect(where['AND']).toContainEqual({ status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } });
  });

  it('nests departmentId under a contract filter', () => {
    const where = buildCloseoutListWhere({ departmentId: 'dept-1' });
    expect(where['AND']).toContainEqual({ contract: { departmentId: 'dept-1' } });
  });

  it('builds an OR search across requestNo and contract reference/title/counterpartyName', () => {
    const where = buildCloseoutListWhere({ search: 'CONTRACT-2026' });
    const and = where['AND'] as Record<string, unknown>[];
    const orClause = and.find((c) => 'OR' in c) as { OR: unknown[] };
    expect(orClause.OR).toHaveLength(4);
  });

  it('applies requestedDateFrom/To as a range on requestedAt', () => {
    const where = buildCloseoutListWhere({ requestedDateFrom: '2026-08-01', requestedDateTo: '2026-08-31' });
    const and = where['AND'] as Record<string, unknown>[];
    expect(and).toContainEqual({
      requestedAt: { gte: new Date('2026-08-01'), lte: new Date('2026-08-31') },
    });
  });
});

describe('toCloseoutListItem', () => {
  it('maps a raw row into the flat register item shape, deriving actionUrl from the parent contract', () => {
    const row = {
      id: 'request-1', requestNo: 'CONTRACT-2026-000001-CLO-01', status: 'SUBMITTED',
      requestedAt: new Date('2026-08-20'), reviewedAt: null, approvedAt: null, rejectedAt: null, closedAt: null,
      closeoutSummary: 'Ready to close', requestedRemarks: null, reviewRemarks: null, rejectionReason: null,
      riskSnapshot: { openWorkflowTasksCount: 0, overdueWorkflowTasksCount: 0, openIssuesCount: 0, openClaimsCount: 0, outstandingPaymentAmount: '0.000', unpaidPaymentsCount: 0, missingCloseoutDocumentsCount: 0, checkedAt: '2026-08-20T00:00:00.000Z' },
      requestedByUser: { id: 'user-1', displayName: 'Manager' },
      reviewedByUser: null,
      _count: { attachments: 2 },
      contract: { id: 'contract-1', referenceNumber: 'CONTRACT-2026-000001', title: 'Test Contract', counterpartyName: 'Acme Co', department: { id: 'dept-1', name: 'Engineering' } },
    };

    const item = toCloseoutListItem(row);

    expect(item.requestId).toBe('request-1');
    expect(item.contractId).toBe('contract-1');
    expect(item.contractReference).toBe('CONTRACT-2026-000001');
    expect(item.companyName).toBe('Acme Co');
    expect(item.attachmentsCount).toBe(2);
    expect(item.actionUrl).toBe('/contracts/contract-1/closeout');
    expect(item.reviewedBy).toBeNull();
    expect(item.reviewedAt).toBeNull();
  });
});

describe('ContractCloseoutService.findAll', () => {
  it('rejects actors without contracts.read', async () => {
    const noReadActor: AuthUser = { ...ACTOR_READ_ONLY, permissions: [] };
    await expect(service.findAll({}, noReadActor)).rejects.toThrow(ForbiddenException);
  });

  it('applies the department filter to the where clause', async () => {
    mockBuildDeptFilter.mockResolvedValue({ in: ['dept-1'] });
    mockRequestFindMany.mockResolvedValue([]);
    mockRequestCount.mockResolvedValue(0);

    await service.findAll({}, ACTOR_READ_ONLY);

    const callArgs = mockRequestFindMany.mock.calls[0]![0];
    expect(callArgs.where.AND).toContainEqual({ contract: { departmentId: { in: ['dept-1'] } } });
  });

  it('returns paginated items mapped via toCloseoutListItem plus a summary computed over the full filtered set', async () => {
    const row = {
      id: 'request-1', requestNo: 'CONTRACT-2026-000001-CLO-01', status: 'SUBMITTED',
      requestedAt: new Date('2026-08-20'), reviewedAt: null, approvedAt: null, rejectedAt: null, closedAt: null,
      closeoutSummary: null, requestedRemarks: null, reviewRemarks: null, rejectionReason: null,
      riskSnapshot: null,
      requestedByUser: { id: 'user-1', displayName: 'Manager' },
      reviewedByUser: null,
      _count: { attachments: 0 },
      contract: { id: 'contract-1', referenceNumber: 'CONTRACT-2026-000001', title: 'Test Contract', counterpartyName: 'Acme Co', department: null },
    };
    mockRequestFindMany.mockImplementation((args: { select?: unknown }) =>
      Promise.resolve(args.select && 'requestNo' in (args.select as object) ? [row] : [{ status: 'SUBMITTED' }, { status: 'APPROVED' }]),
    );
    mockRequestCount.mockResolvedValue(1);

    const result = await service.findAll({}, ACTOR_READ_ONLY);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.requestId).toBe('request-1');
    expect(result.total).toBe(1);
    expect(result.summary.totalRequests).toBe(2);
    expect(result.summary.pendingReview).toBe(1);
  });

  it('does not leak another department\'s requests — where.AND scopes every query to the actor\'s department filter', async () => {
    mockBuildDeptFilter.mockResolvedValue({ in: ['dept-1'] });
    mockRequestFindMany.mockResolvedValue([]);
    mockRequestCount.mockResolvedValue(0);

    await service.findAll({ departmentId: 'dept-2' }, ACTOR_READ_ONLY);

    const callArgs = mockRequestFindMany.mock.calls[0]![0];
    const and = callArgs.where.AND as Record<string, unknown>[];
    // Both the actor's own scope filter AND the (irrelevant, out-of-scope) requested departmentId filter are present —
    // Prisma ANDs them together, so an out-of-scope departmentId filter can only narrow results further, never leak beyond scope.
    expect(and).toContainEqual({ contract: { departmentId: { in: ['dept-1'] } } });
    expect(and).toContainEqual({ contract: { departmentId: 'dept-2' } });
  });
});
