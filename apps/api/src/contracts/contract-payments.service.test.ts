import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import {
  ContractPaymentsService,
  buildPaymentListWhere,
  computeOutstandingAmount,
  computeOverdueDays,
  computePaymentSummary,
  assertPaymentAmountsValid,
} from './contract-payments.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';

// ---------------------------------------------------------------------------
// Client mocks
// ---------------------------------------------------------------------------

const mockPaymentFindMany = vi.fn();
const mockPaymentCount = vi.fn();
const mockPaymentFindUnique = vi.fn();
const mockPaymentCreate = vi.fn();
const mockPaymentUpdate = vi.fn();
const mockContractFindUnique = vi.fn();

const mockClient = {
  contractPayment: {
    findMany: mockPaymentFindMany,
    count: mockPaymentCount,
    findUnique: mockPaymentFindUnique,
    create: mockPaymentCreate,
    update: mockPaymentUpdate,
  },
  contract: { findUnique: mockContractFindUnique },
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockBuildDeptFilter = vi.fn().mockResolvedValue(null);
const mockAssertCanAccessDepartment = vi.fn().mockResolvedValue(undefined);

const mockDeptAccess = {
  buildDeptFilter: mockBuildDeptFilter,
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

function makePaymentRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'payment-1',
    contractId: 'contract-1',
    paymentNo: 'PAY-001',
    invoiceNumber: 'INV-001',
    invoiceDate: new Date('2026-08-01'),
    paymentTerm: 'Net 30',
    submittedAmount: 1000,
    certifiedAmount: 900,
    paidAmount: 400,
    dueDate: new Date('2026-08-10'),
    paidDate: null,
    status: 'PARTIALLY_PAID',
    remarks: null,
    createdByUserId: 'user-manager-1',
    updatedByUserId: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    createdByUser: { id: 'user-manager-1', displayName: 'Manager' },
    updatedByUser: null,
    contract: {
      id: 'contract-1',
      referenceNumber: 'CONTRACT-2026-000001',
      title: 'Test Contract',
      counterpartyName: 'Acme Co',
      contractValue: 5000,
      currency: 'KWD',
      ownerUser: { id: 'user-manager-1', displayName: 'Manager' },
      department: { id: 'dept-1', name: 'Engineering' },
    },
    ...overrides,
  };
}

let service: ContractPaymentsService;

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildDeptFilter.mockResolvedValue(null);
  mockAssertCanAccessDepartment.mockResolvedValue(undefined);
  service = new ContractPaymentsService(mockDb, mockDeptAccess);
});

// ---------------------------------------------------------------------------
// computeOutstandingAmount
// ---------------------------------------------------------------------------

describe('computeOutstandingAmount', () => {
  it('uses certifiedAmount minus paidAmount when certified is present', () => {
    expect(computeOutstandingAmount({ submittedAmount: 1000, certifiedAmount: 900, paidAmount: 400 })).toBe(500);
  });

  it('falls back to submittedAmount minus paidAmount when certified is null', () => {
    expect(computeOutstandingAmount({ submittedAmount: 1000, certifiedAmount: null, paidAmount: 300 })).toBe(700);
  });

  it('treats missing paidAmount as zero', () => {
    expect(computeOutstandingAmount({ submittedAmount: 1000, certifiedAmount: null, paidAmount: null })).toBe(1000);
  });

  it('returns null when neither submitted nor certified exists', () => {
    expect(computeOutstandingAmount({ submittedAmount: null, certifiedAmount: null, paidAmount: null })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeOverdueDays
// ---------------------------------------------------------------------------

describe('computeOverdueDays', () => {
  const today = new Date('2026-08-20T00:00:00Z');

  it('returns null for PAID status', () => {
    expect(computeOverdueDays({ dueDate: new Date('2026-08-01'), status: 'PAID' }, today)).toBeNull();
  });

  it('returns null for CANCELLED status', () => {
    expect(computeOverdueDays({ dueDate: new Date('2026-08-01'), status: 'CANCELLED' }, today)).toBeNull();
  });

  it('returns null when dueDate is missing', () => {
    expect(computeOverdueDays({ dueDate: null, status: 'SUBMITTED' }, today)).toBeNull();
  });

  it('returns null when dueDate is today or in the future', () => {
    expect(computeOverdueDays({ dueDate: new Date('2026-08-20'), status: 'SUBMITTED' }, today)).toBeNull();
    expect(computeOverdueDays({ dueDate: new Date('2026-08-25'), status: 'SUBMITTED' }, today)).toBeNull();
  });

  it('returns the number of days overdue when dueDate has passed and not paid', () => {
    expect(computeOverdueDays({ dueDate: new Date('2026-08-10'), status: 'SUBMITTED' }, today)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// computePaymentSummary
// ---------------------------------------------------------------------------

describe('computePaymentSummary', () => {
  it('sums submitted, certified, paid, outstanding, and counts overdue', () => {
    const today = new Date('2026-08-20T00:00:00Z');
    const rows = [
      { submittedAmount: 1000, certifiedAmount: 900, paidAmount: 400, dueDate: new Date('2026-08-10'), status: 'PARTIALLY_PAID' },
      { submittedAmount: 500, certifiedAmount: null, paidAmount: 500, dueDate: new Date('2026-08-01'), status: 'PAID' },
      { submittedAmount: 200, certifiedAmount: null, paidAmount: null, dueDate: new Date('2026-09-01'), status: 'SUBMITTED' },
    ] as never;

    const summary = computePaymentSummary(rows, today);

    expect(summary.totalSubmitted).toBe('1700.000');
    expect(summary.totalCertified).toBe('900.000');
    expect(summary.totalPaid).toBe('900.000');
    // outstanding: (900-400) + (500-500) + (200-0) = 500 + 0 + 200 = 700
    expect(summary.totalOutstanding).toBe('700.000');
    // only row 1 is overdue (PARTIALLY_PAID, due 2026-08-10 < today)
    expect(summary.overdueCount).toBe(1);
    expect(summary.overdueValue).toBe('500.000');
  });

  it('returns all-zero summary for an empty result set', () => {
    const summary = computePaymentSummary([] as never);
    expect(summary).toEqual({
      totalSubmitted: '0.000',
      totalCertified: '0.000',
      totalPaid: '0.000',
      totalOutstanding: '0.000',
      overdueCount: 0,
      overdueValue: '0.000',
    });
  });
});

// ---------------------------------------------------------------------------
// assertPaymentAmountsValid
// ---------------------------------------------------------------------------

describe('assertPaymentAmountsValid', () => {
  it('rejects paidAmount exceeding certifiedAmount', () => {
    expect(() => assertPaymentAmountsValid({ certifiedAmount: 900, paidAmount: 1000 })).toThrow(UnprocessableEntityException);
  });

  it('rejects paidAmount exceeding submittedAmount when certifiedAmount is absent', () => {
    expect(() => assertPaymentAmountsValid({ submittedAmount: 500, paidAmount: 600 })).toThrow(UnprocessableEntityException);
  });

  it('allows paidAmount equal to the cap', () => {
    expect(() => assertPaymentAmountsValid({ certifiedAmount: 900, paidAmount: 900 })).not.toThrow();
  });

  it('allows any paidAmount when no cap is set', () => {
    expect(() => assertPaymentAmountsValid({ paidAmount: 100 })).not.toThrow();
  });

  it('allows missing paidAmount', () => {
    expect(() => assertPaymentAmountsValid({ certifiedAmount: 900 })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// buildPaymentListWhere
// ---------------------------------------------------------------------------

describe('buildPaymentListWhere', () => {
  it('returns an empty where for no filters', () => {
    expect(buildPaymentListWhere({})).toEqual({});
  });

  it('filters by contractId directly', () => {
    expect(buildPaymentListWhere({ contractId: 'contract-1' })).toEqual({ contractId: 'contract-1' });
  });

  it('filters by status via AND', () => {
    const where = buildPaymentListWhere({ status: 'PAID' });
    expect(where['AND']).toEqual([{ status: 'PAID' }]);
  });

  it('combines overdueOnly with an implicit not-paid/cancelled status filter', () => {
    const today = new Date('2026-08-20T00:00:00Z');
    const where = buildPaymentListWhere({ overdueOnly: true }, today);
    expect(where['AND']).toEqual([
      { dueDate: { lt: today } },
      { status: { notIn: ['PAID', 'CANCELLED'] } },
    ]);
  });

  it('does not add the implicit status filter when an explicit status is also set', () => {
    const today = new Date('2026-08-20T00:00:00Z');
    const where = buildPaymentListWhere({ overdueOnly: true, status: 'SUBMITTED' }, today);
    expect(where['AND']).toEqual([
      { status: 'SUBMITTED' },
      { dueDate: { lt: today } },
    ]);
  });

  it('filters by company via contract.counterpartyName', () => {
    const where = buildPaymentListWhere({ company: 'Acme' });
    expect(where['AND']).toEqual([
      { contract: { counterpartyName: { contains: 'Acme', mode: 'insensitive' } } },
    ]);
  });

  it('search matches paymentNo, invoiceNumber, contract reference, or contract title', () => {
    const where = buildPaymentListWhere({ search: 'PAY-001' });
    expect(where['AND']).toEqual([
      {
        OR: [
          { paymentNo: { contains: 'PAY-001', mode: 'insensitive' } },
          { invoiceNumber: { contains: 'PAY-001', mode: 'insensitive' } },
          { contract: { referenceNumber: { contains: 'PAY-001', mode: 'insensitive' } } },
          { contract: { title: { contains: 'PAY-001', mode: 'insensitive' } } },
        ],
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// ContractPaymentsService.findAll
// ---------------------------------------------------------------------------

describe('ContractPaymentsService.findAll', () => {
  it('rejects actors without contracts.read', async () => {
    const noReadActor: AuthUser = { ...ACTOR_READ_ONLY, permissions: [] };
    await expect(service.findAll({}, noReadActor)).rejects.toThrow(ForbiddenException);
  });

  it('applies the department scope filter when the actor is not ALL_DEPARTMENTS', async () => {
    mockBuildDeptFilter.mockResolvedValue({ in: ['dept-1'] });
    mockPaymentFindMany.mockResolvedValue([]);
    mockPaymentCount.mockResolvedValue(0);

    await service.findAll({}, ACTOR_READ_ONLY);

    const callArgs = mockPaymentFindMany.mock.calls[0]![0];
    expect(callArgs.where['AND']).toContainEqual({ contract: { departmentId: { in: ['dept-1'] } } });
  });

  it('does not add a department filter when the actor has ALL_DEPARTMENTS scope', async () => {
    mockBuildDeptFilter.mockResolvedValue(null);
    mockPaymentFindMany.mockResolvedValue([]);
    mockPaymentCount.mockResolvedValue(0);

    await service.findAll({}, ACTOR_READ_ONLY);

    const callArgs = mockPaymentFindMany.mock.calls[0]![0];
    expect(callArgs.where['AND']).toBeUndefined();
  });

  it('returns paginated items with derived fields and a summary', async () => {
    mockPaymentFindMany.mockResolvedValue([makePaymentRow()]);
    mockPaymentCount.mockResolvedValue(1);

    const result = await service.findAll({}, ACTOR_READ_ONLY) as {
      items: { outstandingAmount: string | null; overdueDays: number | null }[];
      total: number;
      summary: { totalSubmitted: string };
    };

    expect(result.total).toBe(1);
    expect(result.items[0]?.outstandingAmount).toBe('500.000');
    expect(result.summary.totalSubmitted).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ContractPaymentsService.create
// ---------------------------------------------------------------------------

describe('ContractPaymentsService.create', () => {
  it('rejects actors without contracts.update', async () => {
    await expect(service.create('contract-1', {}, ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the contract does not exist', async () => {
    mockContractFindUnique.mockResolvedValue(null);
    await expect(service.create('missing-contract', {}, ACTOR_UPDATE)).rejects.toThrow(NotFoundException);
  });

  it('asserts department access using the contract department', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: 'dept-1' });
    mockPaymentFindUnique.mockResolvedValue(null);
    mockPaymentCreate.mockResolvedValue(makePaymentRow());

    await service.create('contract-1', { paidAmount: 100 }, ACTOR_UPDATE);

    expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_UPDATE, expect.anything(), 'dept-1');
  });

  it('rejects paidAmount exceeding certifiedAmount', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: null });
    await expect(
      service.create('contract-1', { certifiedAmount: 100, paidAmount: 200 }, ACTOR_UPDATE),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects a duplicate paymentNo within the same contract', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: null });
    mockPaymentFindUnique.mockResolvedValue({ id: 'existing-payment' });

    await expect(
      service.create('contract-1', { paymentNo: 'PAY-001' }, ACTOR_UPDATE),
    ).rejects.toThrow(ConflictException);
  });

  it('creates the payment with createdByUserId set to the actor', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'contract-1', departmentId: null });
    mockPaymentFindUnique.mockResolvedValue(null);
    mockPaymentCreate.mockResolvedValue(makePaymentRow());

    await service.create('contract-1', { paymentNo: 'PAY-001', submittedAmount: 1000 }, ACTOR_UPDATE);

    const callArgs = mockPaymentCreate.mock.calls[0]![0];
    expect(callArgs.data.createdByUserId).toBe(ACTOR_UPDATE.id);
    expect(callArgs.data.contractId).toBe('contract-1');
  });
});

// ---------------------------------------------------------------------------
// ContractPaymentsService.update
// ---------------------------------------------------------------------------

describe('ContractPaymentsService.update', () => {
  it('rejects actors without contracts.update', async () => {
    await expect(service.update('payment-1', {}, ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the payment does not exist', async () => {
    mockPaymentFindUnique.mockResolvedValue(null);
    await expect(service.update('missing-payment', {}, ACTOR_UPDATE)).rejects.toThrow(NotFoundException);
  });

  it('validates paidAmount against the merged effective amounts (existing + dto)', async () => {
    mockPaymentFindUnique.mockResolvedValue({
      id: 'payment-1',
      contractId: 'contract-1',
      paymentNo: 'PAY-001',
      submittedAmount: 1000,
      certifiedAmount: 900,
      paidAmount: 400,
      contract: { departmentId: null },
    });

    await expect(
      service.update('payment-1', { paidAmount: 950 }, ACTOR_UPDATE),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('allows cancelling a payment via status update', async () => {
    mockPaymentFindUnique.mockResolvedValue({
      id: 'payment-1',
      contractId: 'contract-1',
      paymentNo: 'PAY-001',
      submittedAmount: 1000,
      certifiedAmount: 900,
      paidAmount: 400,
      contract: { departmentId: null },
    });
    mockPaymentUpdate.mockResolvedValue(makePaymentRow({ status: 'CANCELLED' }));

    const result = await service.update('payment-1', { status: 'CANCELLED' }, ACTOR_UPDATE) as { status: string };

    expect(result.status).toBe('CANCELLED');
    const callArgs = mockPaymentUpdate.mock.calls[0]![0];
    expect(callArgs.data.status).toBe('CANCELLED');
    expect(callArgs.data.updatedByUserId).toBe(ACTOR_UPDATE.id);
  });

  it('rejects renaming paymentNo to one already used by another payment on the same contract', async () => {
    mockPaymentFindUnique
      .mockResolvedValueOnce({
        id: 'payment-1',
        contractId: 'contract-1',
        paymentNo: 'PAY-001',
        submittedAmount: 1000,
        certifiedAmount: null,
        paidAmount: null,
        contract: { departmentId: null },
      })
      .mockResolvedValueOnce({ id: 'other-payment' });

    await expect(
      service.update('payment-1', { paymentNo: 'PAY-002' }, ACTOR_UPDATE),
    ).rejects.toThrow(ConflictException);
  });

  it('does not re-check uniqueness when paymentNo is unchanged', async () => {
    mockPaymentFindUnique.mockResolvedValueOnce({
      id: 'payment-1',
      contractId: 'contract-1',
      paymentNo: 'PAY-001',
      submittedAmount: 1000,
      certifiedAmount: null,
      paidAmount: null,
      contract: { departmentId: null },
    });
    mockPaymentUpdate.mockResolvedValue(makePaymentRow());

    await service.update('payment-1', { paymentNo: 'PAY-001', remarks: 'note' }, ACTOR_UPDATE);

    expect(mockPaymentFindUnique).toHaveBeenCalledTimes(1);
  });
});
