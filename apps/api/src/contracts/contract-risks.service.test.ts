import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import {
  ContractRisksService,
  computeRiskDaysToDeadline,
  computeRiskIsDueSoon,
  computeRiskSummary,
  type RiskSummaryRow,
} from './contract-risks.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';

// ---------------------------------------------------------------------------
// Client mocks
// ---------------------------------------------------------------------------

const mockRiskFindMany = vi.fn();
const mockRiskFindUnique = vi.fn();
const mockRiskCreate = vi.fn();
const mockRiskUpdate = vi.fn();
const mockContractFindUnique = vi.fn();
const mockUserFindUnique = vi.fn();
const mockActivityCreate = vi.fn().mockResolvedValue({ id: 'activity-1' });

const mockClient = {
  contractRisk: {
    findMany: mockRiskFindMany,
    findUnique: mockRiskFindUnique,
    create: mockRiskCreate,
    update: mockRiskUpdate,
  },
  contract: { findUnique: mockContractFindUnique },
  user: { findUnique: mockUserFindUnique },
  contractActivity: { create: mockActivityCreate },
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockAssertCanAccessDepartment = vi.fn().mockResolvedValue(undefined);

const mockDeptAccess = {
  assertCanAccessDepartment: mockAssertCanAccessDepartment,
} as unknown as DepartmentAccessService;

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

function makeRiskRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'risk-1',
    contractId: 'contract-1',
    riskNo: 'RISK-001',
    description: 'Delay in material delivery from supplier',
    riskEvaluation: 'HIGH',
    riskResponse: 'MITIGATE',
    riskResponseDescription: 'Approved secondary supplier list.',
    residualRisk: 'MEDIUM',
    status: 'IN_PROGRESS',
    responsibleUserId: 'user-manager-1',
    responsibleUser: { id: 'user-manager-1', displayName: 'Manager' },
    actionDueDate: new Date('2026-05-25'),
    remarks: null,
    createdByUser: { id: 'user-manager-1', displayName: 'Manager' },
    updatedByUser: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('computeRiskDaysToDeadline', () => {
  const today = new Date('2026-08-20T00:00:00Z');

  it('returns a negative number of days once past the due date', () => {
    expect(computeRiskDaysToDeadline({ actionDueDate: new Date('2026-08-17') }, today)).toBe(-3);
  });

  it('returns a positive number of days before the due date', () => {
    expect(computeRiskDaysToDeadline({ actionDueDate: new Date('2026-09-05') }, today)).toBe(16);
  });

  it('returns null when actionDueDate is unset (never a fabricated number)', () => {
    expect(computeRiskDaysToDeadline({ actionDueDate: null }, today)).toBeNull();
  });
});

describe('computeRiskIsDueSoon', () => {
  const today = new Date('2026-08-20T00:00:00Z');

  it('is true for a due date within the next 30 days on an unresolved risk', () => {
    expect(computeRiskIsDueSoon({ actionDueDate: new Date('2026-09-05'), status: 'OPEN' }, today)).toBe(true);
  });

  it('is true on the exact 30-day boundary', () => {
    expect(computeRiskIsDueSoon({ actionDueDate: new Date('2026-09-19'), status: 'OPEN' }, today)).toBe(true);
  });

  it('is false beyond 30 days', () => {
    expect(computeRiskIsDueSoon({ actionDueDate: new Date('2026-09-25'), status: 'OPEN' }, today)).toBe(false);
  });

  it('is false once already overdue (negative days)', () => {
    expect(computeRiskIsDueSoon({ actionDueDate: new Date('2026-08-01'), status: 'OPEN' }, today)).toBe(false);
  });

  it('is false for a MITIGATED/CLOSED/CANCELLED risk even with a near due date', () => {
    expect(computeRiskIsDueSoon({ actionDueDate: new Date('2026-09-01'), status: 'MITIGATED' }, today)).toBe(false);
    expect(computeRiskIsDueSoon({ actionDueDate: new Date('2026-09-01'), status: 'CLOSED' }, today)).toBe(false);
    expect(computeRiskIsDueSoon({ actionDueDate: new Date('2026-09-01'), status: 'CANCELLED' }, today)).toBe(false);
  });

  it('is false when actionDueDate is unset', () => {
    expect(computeRiskIsDueSoon({ actionDueDate: null, status: 'OPEN' }, today)).toBe(false);
  });
});

describe('computeRiskSummary', () => {
  const today = new Date('2026-08-20T00:00:00Z');

  it('counts total/high-critical/open/mitigated correctly', () => {
    const rows: RiskSummaryRow[] = [
      { riskEvaluation: 'HIGH', residualRisk: 'MEDIUM', status: 'OPEN', actionDueDate: null },
      { riskEvaluation: 'CRITICAL', residualRisk: null, status: 'IN_PROGRESS', actionDueDate: null },
      { riskEvaluation: 'LOW', residualRisk: 'LOW', status: 'MITIGATED', actionDueDate: null },
      { riskEvaluation: 'MEDIUM', residualRisk: null, status: 'CLOSED', actionDueDate: null },
    ];
    const summary = computeRiskSummary(rows, today);
    expect(summary.totalRisks).toBe(4);
    expect(summary.highCriticalRisks).toBe(2); // HIGH + CRITICAL
    expect(summary.openRisks).toBe(2); // OPEN + IN_PROGRESS — not MITIGATED/CLOSED/CANCELLED
    expect(summary.mitigatedRisks).toBe(1);
  });

  it('returns all-zero/null summary for an empty result set (never fake rows)', () => {
    expect(computeRiskSummary([], today)).toEqual({
      totalRisks: 0,
      highCriticalRisks: 0,
      openRisks: 0,
      mitigatedRisks: 0,
      averageResidualRisk: null,
      risksDueSoon: 0,
    });
  });

  it('computes averageResidualRisk using the documented Low=1/Medium=2/High=3/Critical=4 mapping, rounded to the nearest label', () => {
    const rows: RiskSummaryRow[] = [
      { riskEvaluation: 'LOW', residualRisk: 'LOW', status: 'OPEN', actionDueDate: null }, // 1
      { riskEvaluation: 'LOW', residualRisk: 'MEDIUM', status: 'OPEN', actionDueDate: null }, // 2
      { riskEvaluation: 'LOW', residualRisk: 'MEDIUM', status: 'OPEN', actionDueDate: null }, // 2
    ];
    // avg = (1+2+2)/3 = 1.667 -> rounds to 2 -> MEDIUM
    expect(computeRiskSummary(rows, today).averageResidualRisk).toBe('MEDIUM');
  });

  it('excludes risks with no residualRisk set from the average (never fabricates a value for them)', () => {
    const rows: RiskSummaryRow[] = [
      { riskEvaluation: 'LOW', residualRisk: 'HIGH', status: 'OPEN', actionDueDate: null },
      { riskEvaluation: 'LOW', residualRisk: null, status: 'OPEN', actionDueDate: null },
      { riskEvaluation: 'LOW', residualRisk: null, status: 'OPEN', actionDueDate: null },
    ];
    // Only the one real HIGH value counts -> average is exactly HIGH, not diluted toward null.
    expect(computeRiskSummary(rows, today).averageResidualRisk).toBe('HIGH');
  });

  it('returns null averageResidualRisk when no risk has one set at all', () => {
    const rows: RiskSummaryRow[] = [
      { riskEvaluation: 'LOW', residualRisk: null, status: 'OPEN', actionDueDate: null },
    ];
    expect(computeRiskSummary(rows, today).averageResidualRisk).toBeNull();
  });

  it('counts risksDueSoon using the same 30-day/unresolved-status rule as computeRiskIsDueSoon', () => {
    const rows: RiskSummaryRow[] = [
      { riskEvaluation: 'LOW', residualRisk: null, status: 'OPEN', actionDueDate: new Date('2026-09-01') }, // due soon
      { riskEvaluation: 'LOW', residualRisk: null, status: 'MITIGATED', actionDueDate: new Date('2026-09-01') }, // resolved, excluded
      { riskEvaluation: 'LOW', residualRisk: null, status: 'OPEN', actionDueDate: new Date('2027-01-01') }, // too far out
    ];
    expect(computeRiskSummary(rows, today).risksDueSoon).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Service tests
// ---------------------------------------------------------------------------

describe('ContractRisksService', () => {
  let service: ContractRisksService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertCanAccessDepartment.mockResolvedValue(undefined);
    service = new ContractRisksService(mockDb, mockDeptAccess);
  });

  describe('findAllForContract', () => {
    it('throws ForbiddenException without contracts.read', async () => {
      await expect(service.findAllForContract('contract-1', { ...ACTOR_READ_ONLY, permissions: [] })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException for a missing contract', async () => {
      mockContractFindUnique.mockResolvedValueOnce(null);
      await expect(service.findAllForContract('missing', ACTOR_READ_ONLY)).rejects.toThrow(NotFoundException);
    });

    it('enforces department scope via assertCanAccessDepartment', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockRiskFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      await service.findAllForContract('contract-1', ACTOR_READ_ONLY);
      expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_READ_ONLY, expect.anything(), 'dept-1');
    });

    it('returns an empty item list and zeroed summary when the contract has no risks', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockRiskFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      const result = await service.findAllForContract('contract-1', ACTOR_READ_ONLY);
      expect(result.items).toEqual([]);
      expect(result.summary.totalRisks).toBe(0);
    });

    it('attaches real daysToDeadline to each returned item', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockRiskFindMany.mockResolvedValueOnce([makeRiskRow({ actionDueDate: new Date('2026-05-25') })]).mockResolvedValueOnce([]);
      const result = await service.findAllForContract('contract-1', ACTOR_READ_ONLY);
      expect((result.items[0] as { daysToDeadline: number }).daysToDeadline).not.toBeUndefined();
    });
  });

  describe('create', () => {
    it('throws ForbiddenException without contracts.update', async () => {
      await expect(service.create('contract-1', { description: 'x' }, ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for a missing contract', async () => {
      mockContractFindUnique.mockResolvedValueOnce(null);
      await expect(service.create('missing', { description: 'x' }, ACTOR_UPDATE)).rejects.toThrow(NotFoundException);
    });

    it('enforces department scope via assertCanAccessDepartment', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockRiskCreate.mockResolvedValueOnce(makeRiskRow());
      await service.create('contract-1', { description: 'x' }, ACTOR_UPDATE);
      expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_UPDATE, expect.anything(), 'dept-1');
    });

    it('throws NotFoundException for an invalid responsibleUserId', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockUserFindUnique.mockResolvedValueOnce(null);
      await expect(
        service.create('contract-1', { description: 'x', responsibleUserId: 'not-a-real-user' }, ACTOR_UPDATE),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException for a duplicate riskNo within the same contract', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockRiskFindUnique.mockResolvedValueOnce({ id: 'existing-risk' });
      await expect(
        service.create('contract-1', { riskNo: 'RISK-001', description: 'x' }, ACTOR_UPDATE),
      ).rejects.toThrow(ConflictException);
      expect(mockRiskCreate).not.toHaveBeenCalled();
    });

    it('never auto-populates residualRisk when the caller omits it — stays null, not derived from riskEvaluation', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockRiskCreate.mockResolvedValueOnce(makeRiskRow({ residualRisk: null }));

      await service.create('contract-1', { description: 'x', riskEvaluation: 'CRITICAL' }, ACTOR_UPDATE);
      const callArg = mockRiskCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(callArg.data['residualRisk']).toBeUndefined();
    });

    it('logs a risk_created contract activity entry (CM-66)', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockRiskCreate.mockResolvedValueOnce(makeRiskRow());

      await service.create('contract-1', { description: 'x' }, ACTOR_UPDATE);

      expect(mockActivityCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contractId: 'contract-1', actorUserId: ACTOR_UPDATE.id, event: 'risk_created' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('throws ForbiddenException without contracts.update', async () => {
      await expect(service.update('risk-1', {}, ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for a missing risk', async () => {
      mockRiskFindUnique.mockResolvedValueOnce(null);
      await expect(service.update('missing', {}, ACTOR_UPDATE)).rejects.toThrow(NotFoundException);
    });

    it('enforces department scope via assertCanAccessDepartment', async () => {
      mockRiskFindUnique.mockResolvedValueOnce({ id: 'risk-1', contractId: 'contract-1', riskNo: 'RISK-001', contract: { departmentId: 'dept-1' } });
      mockRiskUpdate.mockResolvedValueOnce(makeRiskRow());
      await service.update('risk-1', { status: 'MITIGATED' }, ACTOR_UPDATE);
      expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_UPDATE, expect.anything(), 'dept-1');
    });

    it('allows manually setting residualRisk on update — a real manager choice, never auto-derived', async () => {
      mockRiskFindUnique.mockResolvedValueOnce({ id: 'risk-1', contractId: 'contract-1', riskNo: 'RISK-001', contract: { departmentId: 'dept-1' } });
      mockRiskUpdate.mockResolvedValueOnce(makeRiskRow({ residualRisk: 'LOW' }));

      const result = await service.update('risk-1', { residualRisk: 'LOW' }, ACTOR_UPDATE);
      expect(mockRiskUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ residualRisk: 'LOW', updatedByUserId: 'user-manager-1' }) }),
      );
      expect(result).toMatchObject({ residualRisk: 'LOW' });
      expect(mockActivityCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contractId: 'contract-1', actorUserId: ACTOR_UPDATE.id, event: 'risk_updated' }),
        }),
      );
    });
  });
});
