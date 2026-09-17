import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, UnprocessableEntityException, ConflictException } from '@nestjs/common';
import {
  ContractErectionScheduleService,
  assertRemarksPresentForHoldOrReturn,
  computeScheduleActivityEvent,
} from './contract-erection-schedule.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { ErectionScheduleAttachmentStorageService } from './erection-schedule-attachment-storage.service';

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('assertRemarksPresentForHoldOrReturn', () => {
  it('does not throw for DRAFT with no remarks', () => {
    expect(() => assertRemarksPresentForHoldOrReturn('DRAFT', undefined)).not.toThrow();
  });

  it('does not throw for ISSUED with no remarks', () => {
    expect(() => assertRemarksPresentForHoldOrReturn('ISSUED', undefined)).not.toThrow();
  });

  it('does not throw when status is not provided at all', () => {
    expect(() => assertRemarksPresentForHoldOrReturn(undefined, undefined)).not.toThrow();
  });

  it('throws for HOLD with no remarks', () => {
    expect(() => assertRemarksPresentForHoldOrReturn('HOLD', undefined)).toThrow(UnprocessableEntityException);
  });

  it('throws for RETURNED with only whitespace remarks', () => {
    expect(() => assertRemarksPresentForHoldOrReturn('RETURNED', '   ')).toThrow(UnprocessableEntityException);
  });

  it('does not throw for HOLD with real remarks', () => {
    expect(() => assertRemarksPresentForHoldOrReturn('HOLD', 'Waiting on crane availability.')).not.toThrow();
  });
});

describe('computeScheduleActivityEvent', () => {
  it('maps ISSUED to the issued event', () => {
    expect(computeScheduleActivityEvent('ISSUED')).toBe('erection_schedule_issued');
  });

  it('maps HOLD to the hold event', () => {
    expect(computeScheduleActivityEvent('HOLD')).toBe('erection_schedule_hold');
  });

  it('maps RETURNED to the returned event', () => {
    expect(computeScheduleActivityEvent('RETURNED')).toBe('erection_schedule_returned');
  });

  it('maps DRAFT to the draft-saved event', () => {
    expect(computeScheduleActivityEvent('DRAFT')).toBe('erection_schedule_draft_saved');
  });
});

// ---------------------------------------------------------------------------
// Service-level tests
// ---------------------------------------------------------------------------

const mockContractFindUnique = vi.fn();
const mockStatementFindUnique = vi.fn();
const mockScheduleFindUnique = vi.fn();
const mockScheduleCreate = vi.fn();
const mockActivityCreate = vi.fn().mockResolvedValue({ id: 'activity-1' });

const mockClient = {
  contract: { findUnique: mockContractFindUnique },
  contractErectionMethodStatement: { findUnique: mockStatementFindUnique },
  contractErectionSchedule: { findUnique: mockScheduleFindUnique, create: mockScheduleCreate },
  contractActivity: { create: mockActivityCreate },
};

const mockDb = { getClient: () => mockClient } as unknown as DatabaseService;
const mockAttachmentStorage = {} as unknown as ErectionScheduleAttachmentStorageService;

function actor(permissions: string[]): AuthUser {
  return { id: 'user-1', displayName: 'Erection Manager', permissions } as AuthUser;
}

const VALID_DTO = {
  scheduleReferenceNo: 'ESCH-GRM-001',
  scheduleDate: '2026-09-20',
  plannedStartDate: '2026-09-25',
  plannedEndDate: '2026-10-30',
  jobOrderNo: 'JO-004/26',
  erectionCrewTeam: 'Crew A',
  estimatedManpowerPlanned: 18,
  requiredEquipmentPlanned: 6,
  preparedBy: 'Site Engineer',
};

describe('ContractErectionScheduleService', () => {
  let deptAccess: DepartmentAccessService;
  let service: ContractErectionScheduleService;

  beforeEach(() => {
    vi.clearAllMocks();
    deptAccess = { assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined) } as unknown as DepartmentAccessService;
    service = new ContractErectionScheduleService(mockDb, deptAccess, mockAttachmentStorage);
  });

  it('rejects a read without contracts.read', async () => {
    await expect(service.getForContract('c1', actor([]))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects create without contracts.update', async () => {
    await expect(service.create('c1', VALID_DTO, actor(['contracts.read']))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to create Step 3 before Step 1 (the method statement) exists', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
    mockStatementFindUnique.mockResolvedValue(null);

    await expect(service.create('c1', VALID_DTO, actor(['contracts.update']))).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(mockScheduleCreate).not.toHaveBeenCalled();
  });

  it('refuses to create a second schedule once one already exists for the contract', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
    mockStatementFindUnique.mockResolvedValue({ id: 'stmt-1', approval: null });
    mockScheduleFindUnique.mockResolvedValue({ id: 'schedule-existing' });

    await expect(service.create('c1', VALID_DTO, actor(['contracts.update']))).rejects.toBeInstanceOf(ConflictException);
    expect(mockScheduleCreate).not.toHaveBeenCalled();
  });

  it('refuses to create with status HOLD and no remarks (server-side floor, not just client-side)', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
    mockStatementFindUnique.mockResolvedValue({ id: 'stmt-1', approval: null });
    mockScheduleFindUnique.mockResolvedValue(null);

    await expect(
      service.create('c1', { ...VALID_DTO, status: 'HOLD' }, actor(['contracts.update'])),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(mockScheduleCreate).not.toHaveBeenCalled();
  });

  it('creates a Draft schedule, linking the real Step 1 (and Step 2, if present) ids', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
    mockStatementFindUnique.mockResolvedValue({ id: 'stmt-1', approval: { id: 'approval-1' } });
    mockScheduleFindUnique.mockResolvedValue(null);
    mockScheduleCreate.mockResolvedValue({
      id: 'schedule-1', contractId: 'c1', methodStatementId: 'stmt-1', approvalId: 'approval-1',
      scheduleReferenceNo: 'ESCH-GRM-001', scheduleDate: new Date('2026-09-20'), plannedStartDate: new Date('2026-09-25'),
      plannedEndDate: new Date('2026-10-30'), jobOrderNo: 'JO-004/26', erectionCrewTeam: 'Crew A',
      estimatedManpowerPlanned: 18, requiredEquipmentPlanned: 6, preparedBy: 'Site Engineer',
      reviewedByErectionManager: null, reviewedOn: null, documentRevision: null, totalActivities: 0, criticalActivities: 0,
      status: 'DRAFT', remarks: null, issuedAt: null,
      createdByUser: { id: 'user-1', displayName: 'Erection Manager' }, updatedByUser: null,
      createdAt: new Date(), updatedAt: new Date(), attachments: [],
    });

    const result = (await service.create('c1', VALID_DTO, actor(['contracts.update']))) as { status: string; methodStatementId: string; approvalId: string };
    expect(result.status).toBe('DRAFT');
    expect(result.methodStatementId).toBe('stmt-1');
    expect(result.approvalId).toBe('approval-1');
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'erection_schedule_draft_saved' }) }),
    );
  });
});
