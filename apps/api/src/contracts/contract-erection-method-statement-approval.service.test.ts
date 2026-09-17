import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, UnprocessableEntityException, ConflictException } from '@nestjs/common';
import {
  ContractErectionMethodStatementApprovalService,
  assertCommentsPresentForFinalDecision,
  computeApprovalActivityEvent,
} from './contract-erection-method-statement-approval.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { ErectionMethodStatementApprovalAttachmentStorageService } from './erection-method-statement-approval-attachment-storage.service';

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('assertCommentsPresentForFinalDecision', () => {
  it('does not throw for Draft Review with no comments', () => {
    expect(() => assertCommentsPresentForFinalDecision('DRAFT_REVIEW', undefined)).not.toThrow();
  });

  it('does not throw when reviewStatus is not provided at all (a partial-field save)', () => {
    expect(() => assertCommentsPresentForFinalDecision(undefined, undefined)).not.toThrow();
  });

  it('throws for APPROVED with no comments', () => {
    expect(() => assertCommentsPresentForFinalDecision('APPROVED', undefined)).toThrow(UnprocessableEntityException);
  });

  it('throws for REVISION_REQUESTED with only whitespace comments', () => {
    expect(() => assertCommentsPresentForFinalDecision('REVISION_REQUESTED', '   ')).toThrow(UnprocessableEntityException);
  });

  it('throws for REJECTED with no comments', () => {
    expect(() => assertCommentsPresentForFinalDecision('REJECTED', '')).toThrow(UnprocessableEntityException);
  });

  it('does not throw for APPROVED with real comments', () => {
    expect(() => assertCommentsPresentForFinalDecision('APPROVED', 'Looks good.')).not.toThrow();
  });
});

describe('computeApprovalActivityEvent', () => {
  it('maps APPROVED to the approved event', () => {
    expect(computeApprovalActivityEvent('APPROVED')).toBe('erection_method_statement_approval_approved');
  });

  it('maps REVISION_REQUESTED to the revision-requested event', () => {
    expect(computeApprovalActivityEvent('REVISION_REQUESTED')).toBe('erection_method_statement_approval_revision_requested');
  });

  it('maps REJECTED to the rejected event', () => {
    expect(computeApprovalActivityEvent('REJECTED')).toBe('erection_method_statement_approval_rejected');
  });

  it('maps every non-final status (DRAFT_REVIEW, PENDING_APPROVAL) to the draft-saved event', () => {
    expect(computeApprovalActivityEvent('DRAFT_REVIEW')).toBe('erection_method_statement_approval_draft_saved');
    expect(computeApprovalActivityEvent('PENDING_APPROVAL')).toBe('erection_method_statement_approval_draft_saved');
  });
});

// ---------------------------------------------------------------------------
// Service-level tests
// ---------------------------------------------------------------------------

const mockContractFindUnique = vi.fn();
const mockStatementFindUnique = vi.fn();
const mockApprovalFindUnique = vi.fn();
const mockApprovalCreate = vi.fn();
const mockActivityCreate = vi.fn().mockResolvedValue({ id: 'activity-1' });

const mockClient = {
  contract: { findUnique: mockContractFindUnique },
  contractErectionMethodStatement: { findUnique: mockStatementFindUnique },
  contractErectionMethodStatementApproval: { findUnique: mockApprovalFindUnique, create: mockApprovalCreate },
  contractActivity: { create: mockActivityCreate },
};

const mockDb = { getClient: () => mockClient } as unknown as DatabaseService;
const mockAttachmentStorage = {} as unknown as ErectionMethodStatementApprovalAttachmentStorageService;

function actor(permissions: string[]): AuthUser {
  return { id: 'user-1', displayName: 'QA Engineer', permissions } as AuthUser;
}

describe('ContractErectionMethodStatementApprovalService', () => {
  let deptAccess: DepartmentAccessService;
  let service: ContractErectionMethodStatementApprovalService;

  beforeEach(() => {
    vi.clearAllMocks();
    deptAccess = { assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined) } as unknown as DepartmentAccessService;
    service = new ContractErectionMethodStatementApprovalService(mockDb, deptAccess, mockAttachmentStorage);
  });

  it('rejects a read without contracts.read', async () => {
    await expect(service.getForContract('c1', actor([]))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects create without contracts.update', async () => {
    await expect(service.create('c1', {}, actor(['contracts.read']))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to create Step 2 before Step 1 (the method statement) exists', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
    mockStatementFindUnique.mockResolvedValue(null);

    await expect(service.create('c1', {}, actor(['contracts.update']))).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(mockApprovalCreate).not.toHaveBeenCalled();
  });

  it('refuses to create a second approval once one already exists for the same method statement', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
    mockStatementFindUnique.mockResolvedValue({ id: 'stmt-1' });
    mockApprovalFindUnique.mockResolvedValue({ id: 'approval-existing' });

    await expect(service.create('c1', {}, actor(['contracts.update']))).rejects.toBeInstanceOf(ConflictException);
    expect(mockApprovalCreate).not.toHaveBeenCalled();
  });

  it('refuses to create with a final decision and no comments (server-side floor, not just client-side)', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
    mockStatementFindUnique.mockResolvedValue({ id: 'stmt-1' });
    mockApprovalFindUnique.mockResolvedValue(null);

    await expect(
      service.create('c1', { reviewStatus: 'APPROVED' }, actor(['contracts.update'])),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(mockApprovalCreate).not.toHaveBeenCalled();
  });

  it('creates a Draft Review with no comments required', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
    mockStatementFindUnique.mockResolvedValue({ id: 'stmt-1' });
    mockApprovalFindUnique.mockResolvedValue(null);
    mockApprovalCreate.mockResolvedValue({
      id: 'approval-1', contractId: 'c1', methodStatementId: 'stmt-1', reviewRequiredBy: null,
      reviewingEngineer: null, reviewType: null, priority: 'MEDIUM', reviewStatus: 'DRAFT_REVIEW', decision: null,
      requiresClientApproval: true, comments: null, approvedAt: null, revisionRequestedAt: null, rejectedAt: null,
      reviewedByUser: null, createdByUser: { id: 'user-1', displayName: 'QA Engineer' }, updatedByUser: null,
      createdAt: new Date(), updatedAt: new Date(), attachments: [],
    });

    const result = (await service.create('c1', { reviewStatus: 'DRAFT_REVIEW' }, actor(['contracts.update']))) as { reviewStatus: string };
    expect(result.reviewStatus).toBe('DRAFT_REVIEW');
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'erection_method_statement_approval_draft_saved' }) }),
    );
  });
});
