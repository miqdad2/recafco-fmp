import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, UnprocessableEntityException, ConflictException } from '@nestjs/common';
import {
  ContractErectionChecklistService,
  assertCommentsPresentForHoldOrReturn,
  assertSubmitRequirementsMet,
  computeErectionChecklistActivityEvent,
  computeChecklistItemsSummary,
} from './contract-erection-checklist.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { ErectionChecklistAttachmentStorageService } from './erection-checklist-attachment-storage.service';

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('assertCommentsPresentForHoldOrReturn', () => {
  it('does not throw for DRAFT with no comments', () => {
    expect(() => assertCommentsPresentForHoldOrReturn('DRAFT', undefined)).not.toThrow();
  });

  it('does not throw for SUBMITTED_FOR_VERIFICATION with no comments', () => {
    expect(() => assertCommentsPresentForHoldOrReturn('SUBMITTED_FOR_VERIFICATION', undefined)).not.toThrow();
  });

  it('throws for HOLD with no comments', () => {
    expect(() => assertCommentsPresentForHoldOrReturn('HOLD', undefined)).toThrow(UnprocessableEntityException);
  });

  it('throws for RETURNED with only whitespace comments', () => {
    expect(() => assertCommentsPresentForHoldOrReturn('RETURNED', '   ')).toThrow(UnprocessableEntityException);
  });

  it('does not throw for HOLD with real comments', () => {
    expect(() => assertCommentsPresentForHoldOrReturn('HOLD', 'Awaiting client acknowledgement.')).not.toThrow();
  });
});

describe('assertSubmitRequirementsMet', () => {
  it('does not throw for DRAFT/HOLD/RETURNED/VERIFIED regardless of item rows', () => {
    expect(() => assertSubmitRequirementsMet('DRAFT', undefined)).not.toThrow();
    expect(() => assertSubmitRequirementsMet('HOLD', [])).not.toThrow();
    expect(() => assertSubmitRequirementsMet('RETURNED', undefined)).not.toThrow();
    expect(() => assertSubmitRequirementsMet('VERIFIED', [])).not.toThrow();
  });

  it('throws for SUBMITTED_FOR_VERIFICATION with no item rows', () => {
    expect(() => assertSubmitRequirementsMet('SUBMITTED_FOR_VERIFICATION', undefined)).toThrow(UnprocessableEntityException);
    expect(() => assertSubmitRequirementsMet('SUBMITTED_FOR_VERIFICATION', [])).toThrow(UnprocessableEntityException);
  });

  it('does not throw for SUBMITTED_FOR_VERIFICATION with at least one item row', () => {
    expect(() => assertSubmitRequirementsMet('SUBMITTED_FOR_VERIFICATION', [{ checklistItem: 'Approved Erection Method Statement Available' }])).not.toThrow();
  });
});

describe('computeErectionChecklistActivityEvent', () => {
  it('maps SUBMITTED_FOR_VERIFICATION to the submitted event', () => {
    expect(computeErectionChecklistActivityEvent('SUBMITTED_FOR_VERIFICATION')).toBe('erection_checklist_submitted_for_verification');
  });

  it('maps VERIFIED to the verified event', () => {
    expect(computeErectionChecklistActivityEvent('VERIFIED')).toBe('erection_checklist_verified');
  });

  it('maps HOLD to the hold event', () => {
    expect(computeErectionChecklistActivityEvent('HOLD')).toBe('erection_checklist_hold');
  });

  it('maps RETURNED to the returned event', () => {
    expect(computeErectionChecklistActivityEvent('RETURNED')).toBe('erection_checklist_returned');
  });

  it('maps DRAFT to the draft-saved event', () => {
    expect(computeErectionChecklistActivityEvent('DRAFT')).toBe('erection_checklist_draft_saved');
  });
});

describe('computeChecklistItemsSummary', () => {
  it('returns all-zero for an empty item list — never fabricates a total', () => {
    expect(computeChecklistItemsSummary([])).toEqual({ totalItems: 0, completed: 0, inProgress: 0, notCompleted: 0, notApplicable: 0 });
  });

  it('matches the unit demo data exactly (12 items: 10 Completed, 1 In Progress, 1 Not Completed)', () => {
    const items = [
      ...Array(10).fill({ status: 'COMPLETED' }),
      { status: 'IN_PROGRESS' },
      { status: 'NOT_COMPLETED' },
    ];
    expect(computeChecklistItemsSummary(items)).toEqual({ totalItems: 12, completed: 10, inProgress: 1, notCompleted: 1, notApplicable: 0 });
  });

  it('counts Not Applicable rows separately', () => {
    const items = [{ status: 'COMPLETED' }, { status: 'NOT_APPLICABLE' }, { status: 'NOT_APPLICABLE' }];
    expect(computeChecklistItemsSummary(items)).toEqual({ totalItems: 3, completed: 1, inProgress: 0, notCompleted: 0, notApplicable: 2 });
  });
});

// ---------------------------------------------------------------------------
// Service-level tests
// ---------------------------------------------------------------------------

const mockContractFindUnique = vi.fn();
const mockErectionStartFindUnique = vi.fn();
const mockChecklistFindUnique = vi.fn();
const mockChecklistFindUniqueOrThrow = vi.fn();
const mockActivityCreate = vi.fn().mockResolvedValue({ id: 'activity-1' });

const mockTx = {
  contractErectionChecklist: { create: vi.fn(), update: vi.fn() },
  contractErectionChecklistItem: { createMany: vi.fn().mockResolvedValue({ count: 0 }), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
};

const mockClient = {
  contract: { findUnique: mockContractFindUnique },
  contractErectionStart: { findUnique: mockErectionStartFindUnique },
  contractErectionChecklist: { findUnique: mockChecklistFindUnique, findUniqueOrThrow: mockChecklistFindUniqueOrThrow },
  contractActivity: { create: mockActivityCreate },
  $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};

const mockDb = { getClient: () => mockClient } as unknown as DatabaseService;
const mockAttachmentStorage = {} as unknown as ErectionChecklistAttachmentStorageService;

function actor(permissions: string[]): AuthUser {
  return { id: 'user-1', displayName: 'QA/QC Engineer', permissions } as AuthUser;
}

const VALID_DTO = {
  checklistRefNo: 'CL-GRM-001',
  checklistDate: '2026-11-02',
  checklistType: 'QA/QC Verification Checklist',
  preparedBy: 'Site Supervisor',
};

describe('ContractErectionChecklistService', () => {
  let deptAccess: DepartmentAccessService;
  let service: ContractErectionChecklistService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.$transaction = vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));
    deptAccess = { assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined) } as unknown as DepartmentAccessService;
    service = new ContractErectionChecklistService(mockDb, deptAccess, mockAttachmentStorage);
  });

  it('rejects a read without contracts.read', async () => {
    await expect(service.getForContract('c1', actor([]))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects create without contracts.update', async () => {
    await expect(service.create('c1', VALID_DTO, actor(['contracts.read']))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to create Step 6 before Step 5 (erection start) exists', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null, jobOrder: 'JO-004/26' });
    mockErectionStartFindUnique.mockResolvedValue(null);

    await expect(service.create('c1', VALID_DTO, actor(['contracts.update']))).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(mockTx.contractErectionChecklist.create).not.toHaveBeenCalled();
  });

  it('refuses to create Step 6 while Step 5 exists but is not yet Started', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null, jobOrder: 'JO-004/26' });
    mockErectionStartFindUnique.mockResolvedValue({ id: 'erection-start-1', status: 'DRAFT', jobOrderNo: 'JO-004/26' });

    await expect(service.create('c1', VALID_DTO, actor(['contracts.update']))).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(mockTx.contractErectionChecklist.create).not.toHaveBeenCalled();
  });

  it('refuses to create a second checklist once one already exists for the contract', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null, jobOrder: 'JO-004/26' });
    mockErectionStartFindUnique.mockResolvedValue({ id: 'erection-start-1', status: 'STARTED', jobOrderNo: 'JO-004/26' });
    mockChecklistFindUnique.mockResolvedValue({ id: 'existing-1' });

    await expect(service.create('c1', VALID_DTO, actor(['contracts.update']))).rejects.toBeInstanceOf(ConflictException);
    expect(mockTx.contractErectionChecklist.create).not.toHaveBeenCalled();
  });

  it('refuses to create with status HOLD and no comments (server-side floor, not just client-side)', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null, jobOrder: 'JO-004/26' });
    mockErectionStartFindUnique.mockResolvedValue({ id: 'erection-start-1', status: 'STARTED', jobOrderNo: 'JO-004/26' });
    mockChecklistFindUnique.mockResolvedValue(null);

    await expect(
      service.create('c1', { ...VALID_DTO, status: 'HOLD' }, actor(['contracts.update'])),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(mockTx.contractErectionChecklist.create).not.toHaveBeenCalled();
  });

  it('creates a Draft checklist, auto-linking Step 5 and the contract job order, seeding default checklist items', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null, jobOrder: 'JO-004/26' });
    mockErectionStartFindUnique.mockResolvedValue({ id: 'erection-start-1', status: 'STARTED', jobOrderNo: 'JO-004/26' });
    mockChecklistFindUnique.mockResolvedValue(null);
    mockTx.contractErectionChecklist.create.mockResolvedValue({ id: 'checklist-1' });
    mockChecklistFindUniqueOrThrow.mockResolvedValue({
      id: 'checklist-1', contractId: 'c1', erectionStartId: 'erection-start-1',
      checklistRefNo: 'CL-GRM-001', checklistDate: new Date('2026-11-02'), jobOrderNo: 'JO-004/26',
      checklistType: 'QA/QC Verification Checklist', preparedBy: 'Site Supervisor',
      reviewedByQaqc: null, verifiedByClientRepresentative: null,
      status: 'DRAFT', workLocationYard: null, comments: null, submittedAt: null, verifiedAt: null,
      createdByUser: { id: 'user-1', displayName: 'QA/QC Engineer' }, updatedByUser: null,
      createdAt: new Date(), updatedAt: new Date(),
      items: [{ id: 'item-1', checklistItem: 'Approved Erection Method Statement Available', status: 'NOT_COMPLETED', remarks: null, attachmentRef: null }],
      attachments: [],
    });

    const result = (await service.create('c1', VALID_DTO, actor(['contracts.update']))) as { status: string; erectionStartId: string; jobOrderNo: string };
    expect(result.status).toBe('DRAFT');
    expect(result.erectionStartId).toBe('erection-start-1');
    expect(result.jobOrderNo).toBe('JO-004/26');
    expect(mockTx.contractErectionChecklistItem.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([expect.objectContaining({ checklistItem: 'Approved Erection Method Statement Available' })]),
      }),
    );
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'erection_checklist_draft_saved' }) }),
    );
  });
});
