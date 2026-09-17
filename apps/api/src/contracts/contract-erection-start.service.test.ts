import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, UnprocessableEntityException, ConflictException } from '@nestjs/common';
import {
  ContractErectionStartService,
  assertCommentsPresentForHoldOrReturn,
  assertConfirmRequirementsMet,
  computeErectionStartActivityEvent,
  computeResourcesSummary,
} from './contract-erection-start.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { ErectionStartAttachmentStorageService } from './erection-start-attachment-storage.service';

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('assertCommentsPresentForHoldOrReturn', () => {
  it('does not throw for DRAFT with no comments', () => {
    expect(() => assertCommentsPresentForHoldOrReturn('DRAFT', undefined)).not.toThrow();
  });

  it('does not throw for STARTED with no comments', () => {
    expect(() => assertCommentsPresentForHoldOrReturn('STARTED', undefined)).not.toThrow();
  });

  it('throws for HOLD with no comments', () => {
    expect(() => assertCommentsPresentForHoldOrReturn('HOLD', undefined)).toThrow(UnprocessableEntityException);
  });

  it('throws for RETURNED with only whitespace comments', () => {
    expect(() => assertCommentsPresentForHoldOrReturn('RETURNED', '   ')).toThrow(UnprocessableEntityException);
  });

  it('does not throw for HOLD with real comments', () => {
    expect(() => assertCommentsPresentForHoldOrReturn('HOLD', 'Crane arrival delayed.')).not.toThrow();
  });
});

describe('assertConfirmRequirementsMet', () => {
  it('does not throw for DRAFT/HOLD/RETURNED regardless of missing fields', () => {
    expect(() => assertConfirmRequirementsMet('DRAFT', undefined, undefined)).not.toThrow();
    expect(() => assertConfirmRequirementsMet('HOLD', undefined, undefined)).not.toThrow();
    expect(() => assertConfirmRequirementsMet('RETURNED', undefined, [])).not.toThrow();
  });

  it('throws for STARTED with no actualStartDateTime', () => {
    expect(() => assertConfirmRequirementsMet('STARTED', undefined, [{ actualDeployedNos: 2 }])).toThrow(UnprocessableEntityException);
  });

  it('throws for STARTED with no manpower rows at all', () => {
    expect(() => assertConfirmRequirementsMet('STARTED', '2026-11-01T08:30:00', undefined)).toThrow(UnprocessableEntityException);
  });

  it('throws for STARTED when every manpower row has 0 actual deployed', () => {
    expect(() =>
      assertConfirmRequirementsMet('STARTED', '2026-11-01T08:30:00', [{ actualDeployedNos: 0 }, { actualDeployedNos: 0 }]),
    ).toThrow(UnprocessableEntityException);
  });

  it('does not throw for STARTED with actualStartDateTime and at least one positive manpower row', () => {
    expect(() =>
      assertConfirmRequirementsMet('STARTED', '2026-11-01T08:30:00', [{ actualDeployedNos: 0 }, { actualDeployedNos: 2 }]),
    ).not.toThrow();
  });
});

describe('computeErectionStartActivityEvent', () => {
  it('maps STARTED to the confirmed event', () => {
    expect(computeErectionStartActivityEvent('STARTED')).toBe('erection_start_confirmed');
  });

  it('maps HOLD to the hold event', () => {
    expect(computeErectionStartActivityEvent('HOLD')).toBe('erection_start_hold');
  });

  it('maps RETURNED to the returned event', () => {
    expect(computeErectionStartActivityEvent('RETURNED')).toBe('erection_start_returned');
  });

  it('maps DRAFT to the draft-saved event', () => {
    expect(computeErectionStartActivityEvent('DRAFT')).toBe('erection_start_draft_saved');
  });
});

describe('computeResourcesSummary', () => {
  it('returns all-zero for empty rows — never fabricates a total', () => {
    expect(computeResourcesSummary([], [])).toEqual({ totalManpower: 0, totalEquipment: 0, craneAssigned: 0, trailerAssigned: 0 });
  });

  it('matches the unit demo data exactly', () => {
    const manpower = [
      { actualDeployedNos: 1 }, { actualDeployedNos: 2 }, { actualDeployedNos: 3 }, { actualDeployedNos: 1 },
      { actualDeployedNos: 6 }, { actualDeployedNos: 2 }, { actualDeployedNos: 2 }, { actualDeployedNos: 1 },
      { actualDeployedNos: 1 }, { actualDeployedNos: 0 },
    ];
    const equipment = [
      { equipmentType: 'Crane', assignedQty: 1 },
      { equipmentType: 'Trailer', assignedQty: 1 },
      { equipmentType: 'Tools & Tackles', assignedQty: 1 },
      { equipmentType: 'Rental Equipment', assignedQty: 1 },
    ];
    expect(computeResourcesSummary(manpower, equipment)).toEqual({
      totalManpower: 19, totalEquipment: 4, craneAssigned: 1, trailerAssigned: 1,
    });
  });

  it('matches Crane/Trailer case-insensitively by substring, since equipmentType is free text', () => {
    const equipment = [
      { equipmentType: '50T Mobile Crane', assignedQty: 1 },
      { equipmentType: 'flatbed trailer', assignedQty: 2 },
      { equipmentType: 'Manlift', assignedQty: 1 },
    ];
    expect(computeResourcesSummary([], equipment)).toEqual({ totalManpower: 0, totalEquipment: 4, craneAssigned: 1, trailerAssigned: 1 });
  });
});

// ---------------------------------------------------------------------------
// Service-level tests
// ---------------------------------------------------------------------------

const mockContractFindUnique = vi.fn();
const mockDeliveryStartFindUnique = vi.fn();
const mockScheduleFindUnique = vi.fn();
const mockMethodStatementFindUnique = vi.fn();
const mockErectionStartFindUnique = vi.fn();
const mockErectionStartFindUniqueOrThrow = vi.fn();
const mockActivityCreate = vi.fn().mockResolvedValue({ id: 'activity-1' });

const mockTx = {
  contractErectionStart: { create: vi.fn(), update: vi.fn() },
  contractErectionStartManpower: { createMany: vi.fn().mockResolvedValue({ count: 0 }), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  contractErectionStartEquipment: { createMany: vi.fn().mockResolvedValue({ count: 0 }), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  contractErectionStartChecklist: { upsert: vi.fn().mockResolvedValue({}) },
};

const mockClient = {
  contract: { findUnique: mockContractFindUnique },
  contractErectionDeliveryStart: { findUnique: mockDeliveryStartFindUnique },
  contractErectionSchedule: { findUnique: mockScheduleFindUnique },
  contractErectionMethodStatement: { findUnique: mockMethodStatementFindUnique },
  contractErectionStart: { findUnique: mockErectionStartFindUnique, findUniqueOrThrow: mockErectionStartFindUniqueOrThrow },
  contractActivity: { create: mockActivityCreate },
  $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};

const mockDb = { getClient: () => mockClient } as unknown as DatabaseService;
const mockAttachmentStorage = {} as unknown as ErectionStartAttachmentStorageService;

function actor(permissions: string[]): AuthUser {
  return { id: 'user-1', displayName: 'Site Supervisor', permissions } as AuthUser;
}

const VALID_DTO = {
  workLocationYard: 'GRM Site - Boundary Wall Zone A',
  erectionCrewTeam: 'Erection Crew A',
  supervisor: 'Site Supervisor',
  scopeOfWorkToday: 'Start erection of precast boundary wall panels in Zone A.',
};

describe('ContractErectionStartService', () => {
  let deptAccess: DepartmentAccessService;
  let service: ContractErectionStartService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.$transaction = vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));
    deptAccess = { assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined) } as unknown as DepartmentAccessService;
    service = new ContractErectionStartService(mockDb, deptAccess, mockAttachmentStorage);
  });

  it('rejects a read without contracts.read', async () => {
    await expect(service.getForContract('c1', actor([]))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects create without contracts.update', async () => {
    await expect(service.create('c1', VALID_DTO, actor(['contracts.read']))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to create Step 5 before Step 4 (delivery start) exists', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null, jobOrder: 'JO-004/26' });
    mockDeliveryStartFindUnique.mockResolvedValue(null);
    mockScheduleFindUnique.mockResolvedValue(null);
    mockMethodStatementFindUnique.mockResolvedValue(null);

    await expect(service.create('c1', VALID_DTO, actor(['contracts.update']))).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(mockTx.contractErectionStart.create).not.toHaveBeenCalled();
  });

  it('refuses to create Step 5 while Step 4 exists but is not yet Started', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null, jobOrder: 'JO-004/26' });
    mockDeliveryStartFindUnique.mockResolvedValue({ id: 'delivery-1', status: 'DRAFT' });
    mockScheduleFindUnique.mockResolvedValue(null);
    mockMethodStatementFindUnique.mockResolvedValue(null);

    await expect(service.create('c1', VALID_DTO, actor(['contracts.update']))).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(mockTx.contractErectionStart.create).not.toHaveBeenCalled();
  });

  it('refuses to create a second erection-start record once one already exists for the contract', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null, jobOrder: 'JO-004/26' });
    mockDeliveryStartFindUnique.mockResolvedValue({ id: 'delivery-1', status: 'STARTED' });
    mockScheduleFindUnique.mockResolvedValue(null);
    mockMethodStatementFindUnique.mockResolvedValue(null);
    mockErectionStartFindUnique.mockResolvedValue({ id: 'existing-1' });

    await expect(service.create('c1', VALID_DTO, actor(['contracts.update']))).rejects.toBeInstanceOf(ConflictException);
    expect(mockTx.contractErectionStart.create).not.toHaveBeenCalled();
  });

  it('refuses to create with status HOLD and no comments (server-side floor, not just client-side)', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null, jobOrder: 'JO-004/26' });
    mockDeliveryStartFindUnique.mockResolvedValue({ id: 'delivery-1', status: 'STARTED' });
    mockScheduleFindUnique.mockResolvedValue(null);
    mockMethodStatementFindUnique.mockResolvedValue(null);
    mockErectionStartFindUnique.mockResolvedValue(null);

    await expect(
      service.create('c1', { ...VALID_DTO, status: 'HOLD' }, actor(['contracts.update'])),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(mockTx.contractErectionStart.create).not.toHaveBeenCalled();
  });

  it('refuses to create with status STARTED but no actualStartDateTime or positive manpower row', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null, jobOrder: 'JO-004/26' });
    mockDeliveryStartFindUnique.mockResolvedValue({ id: 'delivery-1', status: 'STARTED' });
    mockScheduleFindUnique.mockResolvedValue(null);
    mockMethodStatementFindUnique.mockResolvedValue(null);
    mockErectionStartFindUnique.mockResolvedValue(null);

    await expect(
      service.create('c1', { ...VALID_DTO, status: 'STARTED' }, actor(['contracts.update'])),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(mockTx.contractErectionStart.create).not.toHaveBeenCalled();
  });

  it('creates a Draft erection-start record, auto-linking Step 3/4 and the contract job order, seeding default manpower trades', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null, jobOrder: 'JO-004/26' });
    mockDeliveryStartFindUnique.mockResolvedValue({ id: 'delivery-1', status: 'STARTED' });
    mockScheduleFindUnique.mockResolvedValue({ id: 'schedule-1', plannedStartDate: new Date('2026-10-31'), jobOrderNo: 'JO-004/26' });
    mockMethodStatementFindUnique.mockResolvedValue({ methodStatementRefNo: 'EMS-GRM-001' });
    mockErectionStartFindUnique.mockResolvedValue(null);
    mockTx.contractErectionStart.create.mockResolvedValue({ id: 'erection-start-1' });
    mockErectionStartFindUniqueOrThrow.mockResolvedValue({
      id: 'erection-start-1', contractId: 'c1', deliveryStartId: 'delivery-1', erectionScheduleId: 'schedule-1',
      jobOrderNo: 'JO-004/26', plannedStartDate: new Date('2026-10-31'), actualStartDateTime: null,
      workLocationYard: 'GRM Site - Boundary Wall Zone A', erectionCrewTeam: 'Erection Crew A', supervisor: 'Site Supervisor',
      weatherCondition: null, windSpeed: null, methodStatementRefNo: 'EMS-GRM-001',
      scopeOfWorkToday: 'Start erection of precast boundary wall panels in Zone A.',
      status: 'DRAFT', comments: null, confirmedAt: null,
      createdByUser: { id: 'user-1', displayName: 'Site Supervisor' }, updatedByUser: null,
      createdAt: new Date(), updatedAt: new Date(),
      manpowerRows: [], equipmentRows: [], checklistRows: [], attachments: [],
    });

    const result = (await service.create('c1', VALID_DTO, actor(['contracts.update']))) as {
      status: string; jobOrderNo: string; deliveryStartId: string; erectionScheduleId: string; methodStatementRefNo: string;
    };
    expect(result.status).toBe('DRAFT');
    expect(result.jobOrderNo).toBe('JO-004/26');
    expect(result.deliveryStartId).toBe('delivery-1');
    expect(result.erectionScheduleId).toBe('schedule-1');
    expect(result.methodStatementRefNo).toBe('EMS-GRM-001');
    expect(mockTx.contractErectionStartManpower.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([expect.objectContaining({ trade: 'Rigger' }), expect.objectContaining({ trade: 'Other' })]),
      }),
    );
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'erection_start_draft_saved' }) }),
    );
  });
});
