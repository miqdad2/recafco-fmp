import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import {
  ContractDocumentObligationsService,
  computeDocumentObligationDaysRemaining,
  computeDocumentObligationIsExpiredOverdue,
  computeDocumentObligationIsExpiringSoon,
  computeDocumentObligationSummary,
  type DocumentObligationStatusFields,
  type DocumentObligationSummaryRow,
} from './contract-document-obligations.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { DocumentObligationAttachmentStorageService } from './document-obligation-attachment-storage.service';

// ---------------------------------------------------------------------------
// Client mocks
// ---------------------------------------------------------------------------

const mockDocFindMany = vi.fn();
const mockDocFindUnique = vi.fn();
const mockDocFindFirst = vi.fn();
const mockDocCreate = vi.fn();
const mockDocUpdate = vi.fn();
const mockContractFindUnique = vi.fn();
const mockAttachmentFindMany = vi.fn();
const mockAttachmentFindFirst = vi.fn();
const mockAttachmentCreate = vi.fn();
const mockActivityCreate = vi.fn().mockResolvedValue({ id: 'activity-1' });

const mockClient = {
  contractDocumentObligation: {
    findMany: mockDocFindMany,
    findUnique: mockDocFindUnique,
    findFirst: mockDocFindFirst,
    create: mockDocCreate,
    update: mockDocUpdate,
  },
  contractDocumentObligationAttachment: {
    findMany: mockAttachmentFindMany,
    findFirst: mockAttachmentFindFirst,
    create: mockAttachmentCreate,
  },
  contract: { findUnique: mockContractFindUnique },
  contractActivity: { create: mockActivityCreate },
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockAssertCanAccessDepartment = vi.fn().mockResolvedValue(undefined);

const mockDeptAccess = {
  assertCanAccessDepartment: mockAssertCanAccessDepartment,
} as unknown as DepartmentAccessService;

const mockAttachmentSave = vi.fn().mockResolvedValue({ fileName: 'random-uuid.pdf', storagePath: 'doc-1/random-uuid.pdf' });

const mockAttachmentStorage = {
  save: mockAttachmentSave,
} as unknown as DocumentObligationAttachmentStorageService;

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

function makeDocRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'doc-1',
    contractId: 'contract-1',
    itemNo: 'DOC-001',
    title: 'Performance Bond',
    category: 'PERFORMANCE_BOND',
    responsibleParty: 'Contractor',
    requiredDate: new Date('2026-01-15'),
    submissionOrExpiryDate: new Date('2027-01-15'),
    status: 'SUBMITTED',
    remarks: null,
    createdByUser: { id: 'user-manager-1', displayName: 'Manager' },
    updatedByUser: null,
    createdAt: new Date('2026-01-05'),
    updatedAt: new Date('2026-01-05'),
    attachments: [],
    ...overrides,
  };
}

const TODAY = new Date(Date.UTC(2026, 0, 15));

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('computeDocumentObligationDaysRemaining', () => {
  it('returns a negative number once the date is past', () => {
    expect(computeDocumentObligationDaysRemaining({ submissionOrExpiryDate: new Date(Date.UTC(2026, 0, 5)) }, TODAY)).toBe(-10);
  });

  it('returns a positive number for a future date', () => {
    expect(computeDocumentObligationDaysRemaining({ submissionOrExpiryDate: new Date(Date.UTC(2026, 0, 25)) }, TODAY)).toBe(10);
  });

  it('returns null when there is no date at all (never a fabricated number)', () => {
    expect(computeDocumentObligationDaysRemaining({ submissionOrExpiryDate: null }, TODAY)).toBeNull();
  });

  describe('CM-70E — expiryDate preference', () => {
    it('prefers the real expiryDate over the legacy submissionOrExpiryDate when both are set', () => {
      const result = computeDocumentObligationDaysRemaining(
        { submissionOrExpiryDate: new Date(Date.UTC(2020, 0, 1)), expiryDate: new Date(Date.UTC(2026, 0, 25)) },
        TODAY,
      );
      expect(result).toBe(10);
    });

    it('falls back to the legacy submissionOrExpiryDate for an old record with no real expiryDate', () => {
      const result = computeDocumentObligationDaysRemaining(
        { submissionOrExpiryDate: new Date(Date.UTC(2026, 0, 25)), expiryDate: null },
        TODAY,
      );
      expect(result).toBe(10);
    });

    it('returns null when neither expiryDate nor the legacy field is set', () => {
      expect(computeDocumentObligationDaysRemaining({ submissionOrExpiryDate: null, expiryDate: null }, TODAY)).toBeNull();
    });
  });
});

describe('computeDocumentObligationIsExpiredOverdue', () => {
  const past: DocumentObligationStatusFields = { status: 'PENDING', submissionOrExpiryDate: new Date(Date.UTC(2026, 0, 1)) };

  it('is true for a past date on a PENDING item', () => {
    expect(computeDocumentObligationIsExpiredOverdue(past, TODAY)).toBe(true);
  });

  it('is false for a past date once the item is SUBMITTED (manual status never overridden)', () => {
    expect(computeDocumentObligationIsExpiredOverdue({ ...past, status: 'SUBMITTED' }, TODAY)).toBe(false);
  });

  it('is false for a past date once the item is CANCELLED', () => {
    expect(computeDocumentObligationIsExpiredOverdue({ ...past, status: 'CANCELLED' }, TODAY)).toBe(false);
  });

  it('is false for a past date once the item is NOT_REQUIRED', () => {
    expect(computeDocumentObligationIsExpiredOverdue({ ...past, status: 'NOT_REQUIRED' }, TODAY)).toBe(false);
  });

  it('is false when there is no date at all', () => {
    expect(computeDocumentObligationIsExpiredOverdue({ status: 'PENDING', submissionOrExpiryDate: null }, TODAY)).toBe(false);
  });

  it('is false for a future date', () => {
    expect(
      computeDocumentObligationIsExpiredOverdue({ status: 'PENDING', submissionOrExpiryDate: new Date(Date.UTC(2026, 1, 1)) }, TODAY),
    ).toBe(false);
  });
});

describe('computeDocumentObligationIsExpiringSoon', () => {
  it('is true for a date exactly 30 days out on a PENDING item', () => {
    const row: DocumentObligationStatusFields = { status: 'PENDING', submissionOrExpiryDate: new Date(Date.UTC(2026, 1, 14)) };
    expect(computeDocumentObligationIsExpiringSoon(row, TODAY)).toBe(true);
  });

  it('is false for a date 31 days out (past the 30-day window)', () => {
    const row: DocumentObligationStatusFields = { status: 'PENDING', submissionOrExpiryDate: new Date(Date.UTC(2026, 1, 15)) };
    expect(computeDocumentObligationIsExpiringSoon(row, TODAY)).toBe(false);
  });

  it('is true on the due date itself (0 days remaining)', () => {
    const row: DocumentObligationStatusFields = { status: 'PENDING', submissionOrExpiryDate: TODAY };
    expect(computeDocumentObligationIsExpiringSoon(row, TODAY)).toBe(true);
  });

  it('is false once the item is SUBMITTED even if the date is within 30 days', () => {
    const row: DocumentObligationStatusFields = { status: 'SUBMITTED', submissionOrExpiryDate: new Date(Date.UTC(2026, 0, 20)) };
    expect(computeDocumentObligationIsExpiringSoon(row, TODAY)).toBe(false);
  });

  it('is false for an already-overdue date (that belongs to Expired / Overdue, not Expiring Soon)', () => {
    const row: DocumentObligationStatusFields = { status: 'PENDING', submissionOrExpiryDate: new Date(Date.UTC(2026, 0, 1)) };
    expect(computeDocumentObligationIsExpiringSoon(row, TODAY)).toBe(false);
  });
});

describe('computeDocumentObligationSummary', () => {
  it('counts totalItems as every row, regardless of status', () => {
    const rows: DocumentObligationSummaryRow[] = [
      { status: 'SUBMITTED', submissionOrExpiryDate: null },
      { status: 'PENDING', submissionOrExpiryDate: null },
    ];
    expect(computeDocumentObligationSummary(rows, TODAY).totalItems).toBe(2);
  });

  it('counts submitted as a raw status===SUBMITTED count', () => {
    const rows: DocumentObligationSummaryRow[] = [
      { status: 'SUBMITTED', submissionOrExpiryDate: null },
      { status: 'SUBMITTED', submissionOrExpiryDate: null },
      { status: 'PENDING', submissionOrExpiryDate: null },
    ];
    expect(computeDocumentObligationSummary(rows, TODAY).submitted).toBe(2);
  });

  it('counts pending as a raw status===PENDING count', () => {
    const rows: DocumentObligationSummaryRow[] = [
      { status: 'PENDING', submissionOrExpiryDate: null },
      { status: 'SUBMITTED', submissionOrExpiryDate: null },
    ];
    expect(computeDocumentObligationSummary(rows, TODAY).pending).toBe(1);
  });

  it('counts expiringSoon/expiredOverdue from date + status, and a PENDING item can count toward both pending and one of these (honest overlap, not a bug)', () => {
    const rows: DocumentObligationSummaryRow[] = [
      { status: 'PENDING', submissionOrExpiryDate: new Date(Date.UTC(2026, 0, 1)) }, // overdue AND pending
      { status: 'PENDING', submissionOrExpiryDate: new Date(Date.UTC(2026, 0, 20)) }, // expiring soon AND pending
    ];
    const summary = computeDocumentObligationSummary(rows, TODAY);
    expect(summary.pending).toBe(2);
    expect(summary.expiredOverdue).toBe(1);
    expect(summary.expiringSoon).toBe(1);
  });

  it('never counts a SUBMITTED/CANCELLED/NOT_REQUIRED item toward expiringSoon or expiredOverdue, however old its date is', () => {
    const rows: DocumentObligationSummaryRow[] = [
      { status: 'SUBMITTED', submissionOrExpiryDate: new Date(Date.UTC(2020, 0, 1)) },
      { status: 'CANCELLED', submissionOrExpiryDate: new Date(Date.UTC(2020, 0, 1)) },
      { status: 'NOT_REQUIRED', submissionOrExpiryDate: new Date(Date.UTC(2020, 0, 1)) },
    ];
    const summary = computeDocumentObligationSummary(rows, TODAY);
    expect(summary.expiredOverdue).toBe(0);
    expect(summary.expiringSoon).toBe(0);
  });

  it('returns all zeros for an empty item list (no items — never fake rows)', () => {
    expect(computeDocumentObligationSummary([], TODAY)).toEqual({
      totalItems: 0,
      submitted: 0,
      pending: 0,
      expiringSoon: 0,
      expiredOverdue: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// Service tests
// ---------------------------------------------------------------------------

describe('ContractDocumentObligationsService', () => {
  let service: ContractDocumentObligationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertCanAccessDepartment.mockResolvedValue(undefined);
    service = new ContractDocumentObligationsService(mockDb, mockDeptAccess, mockAttachmentStorage);
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
      mockDocFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      await service.findAllForContract('contract-1', ACTOR_READ_ONLY);
      expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_READ_ONLY, expect.anything(), 'dept-1');
    });

    it('returns an empty item list and zeroed summary when the contract has no items', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockDocFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await service.findAllForContract('contract-1', ACTOR_READ_ONLY);
      expect(result.items).toEqual([]);
      expect(result.summary.totalItems).toBe(0);
    });

    it('attaches daysRemaining to every item', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      const row = makeDocRow({ submissionOrExpiryDate: new Date(Date.UTC(2026, 1, 14)) });
      mockDocFindMany.mockResolvedValueOnce([row]).mockResolvedValueOnce([row]);

      const result = await service.findAllForContract('contract-1', ACTOR_READ_ONLY);
      expect((result.items[0] as { daysRemaining: number | null }).daysRemaining).toBeTypeOf('number');
    });

    describe('CM-70F — date-only string serialization (root cause of the empty Edit-modal date fields)', () => {
      it('returns requiredDate/submissionDate/expiryDate as plain "YYYY-MM-DD" strings, never a full ISO datetime', async () => {
        mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
        const row = makeDocRow({
          requiredDate: new Date(Date.UTC(2026, 8, 6)),
          submissionDate: new Date(Date.UTC(2026, 8, 6)),
          expiryDate: new Date(Date.UTC(2027, 8, 6)),
          submissionOrExpiryDate: null,
        });
        mockDocFindMany.mockResolvedValueOnce([row]).mockResolvedValueOnce([row]);

        const result = await service.findAllForContract('contract-1', ACTOR_READ_ONLY);
        const item = result.items[0] as Record<string, unknown>;
        expect(item['requiredDate']).toBe('2026-09-06');
        expect(item['submissionDate']).toBe('2026-09-06');
        expect(item['expiryDate']).toBe('2027-09-06');
      });

      it('returns undefined (never a fabricated date) for an unset date field', async () => {
        mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
        const row = makeDocRow({ requiredDate: null, submissionDate: null, expiryDate: null, submissionOrExpiryDate: null });
        mockDocFindMany.mockResolvedValueOnce([row]).mockResolvedValueOnce([row]);

        const result = await service.findAllForContract('contract-1', ACTOR_READ_ONLY);
        const item = result.items[0] as Record<string, unknown>;
        expect(item['requiredDate']).toBeUndefined();
        expect(item['submissionDate']).toBeUndefined();
        expect(item['expiryDate']).toBeUndefined();
      });
    });
  });

  describe('create', () => {
    it('throws ForbiddenException without contracts.update', async () => {
      await expect(service.create('contract-1', { title: 'x' }, ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for a missing contract', async () => {
      mockContractFindUnique.mockResolvedValueOnce(null);
      await expect(service.create('missing', { title: 'x' }, ACTOR_UPDATE)).rejects.toThrow(NotFoundException);
    });

    it('enforces department scope via assertCanAccessDepartment', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockDocCreate.mockResolvedValueOnce(makeDocRow());
      await service.create('contract-1', { title: 'x' }, ACTOR_UPDATE);
      expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_UPDATE, expect.anything(), 'dept-1');
    });

    it('throws ConflictException for a duplicate itemNo within the same contract', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockDocFindUnique.mockResolvedValueOnce({ id: 'existing-doc' });

      await expect(service.create('contract-1', { itemNo: 'DOC-001', title: 'x' }, ACTOR_UPDATE)).rejects.toThrow(
        ConflictException,
      );
      expect(mockDocCreate).not.toHaveBeenCalled();
    });

    it('defaults category/status via Prisma column defaults when omitted (never sent explicitly)', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockDocCreate.mockResolvedValueOnce(makeDocRow());

      await service.create('contract-1', { title: 'x' }, ACTOR_UPDATE);
      const callArg = mockDocCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(callArg.data['category']).toBeUndefined();
      expect(callArg.data['status']).toBeUndefined();
    });

    it('passes title/category/responsibleParty through when provided', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockDocCreate.mockResolvedValueOnce(makeDocRow());

      await service.create(
        'contract-1',
        { title: 'Performance Bond', category: 'PERFORMANCE_BOND', responsibleParty: 'Contractor' },
        ACTOR_UPDATE,
      );
      expect(mockDocCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Performance Bond', category: 'PERFORMANCE_BOND', responsibleParty: 'Contractor' }),
        }),
      );
    });

    it('passes submissionDate/expiryDate through independently when provided (CM-70E)', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockDocCreate.mockResolvedValueOnce(makeDocRow());

      await service.create(
        'contract-1',
        { title: 'Insurance Certificate', submissionDate: '2026-02-01', expiryDate: '2027-02-01' },
        ACTOR_UPDATE,
      );
      expect(mockDocCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ submissionDate: new Date('2026-02-01'), expiryDate: new Date('2027-02-01') }),
        }),
      );
    });

    it('returns the newly created item with date-only "YYYY-MM-DD" strings, never a full ISO datetime (CM-70F)', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockDocCreate.mockResolvedValueOnce(makeDocRow({
        requiredDate: new Date(Date.UTC(2026, 8, 6)),
        submissionDate: new Date(Date.UTC(2026, 8, 6)),
        expiryDate: null,
        submissionOrExpiryDate: null,
      }));

      const result = await service.create('contract-1', { title: 'Signed Contract Agreement' }, ACTOR_UPDATE) as Record<string, unknown>;
      expect(result['requiredDate']).toBe('2026-09-06');
      expect(result['submissionDate']).toBe('2026-09-06');
      expect(result['expiryDate']).toBeUndefined();
    });

    it('logs a document_obligation_created contract activity entry (CM-66)', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockDocCreate.mockResolvedValueOnce(makeDocRow());

      await service.create('contract-1', { title: 'Performance Bond' }, ACTOR_UPDATE);

      expect(mockActivityCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contractId: 'contract-1', actorUserId: ACTOR_UPDATE.id, event: 'document_obligation_created' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('throws ForbiddenException without contracts.update', async () => {
      await expect(service.update('doc-1', {}, ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for a missing item', async () => {
      mockDocFindUnique.mockResolvedValueOnce(null);
      await expect(service.update('missing', {}, ACTOR_UPDATE)).rejects.toThrow(NotFoundException);
    });

    it('enforces department scope via assertCanAccessDepartment', async () => {
      mockDocFindUnique.mockResolvedValueOnce({ id: 'doc-1', contractId: 'contract-1', itemNo: 'DOC-001', contract: { departmentId: 'dept-1' } });
      mockDocUpdate.mockResolvedValueOnce(makeDocRow());

      await service.update('doc-1', { status: 'SUBMITTED' }, ACTOR_UPDATE);
      expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_UPDATE, expect.anything(), 'dept-1');
    });

    it('throws ConflictException when renaming to an itemNo already used by another item in the same contract', async () => {
      mockDocFindUnique.mockResolvedValueOnce({ id: 'doc-1', contractId: 'contract-1', itemNo: 'DOC-001', contract: { departmentId: 'dept-1' } });
      mockDocFindUnique.mockResolvedValueOnce({ id: 'other-doc' });

      await expect(service.update('doc-1', { itemNo: 'DOC-002' }, ACTOR_UPDATE)).rejects.toThrow(ConflictException);
      expect(mockDocUpdate).not.toHaveBeenCalled();
    });

    it('allows manually setting status without any date-based auto-override', async () => {
      mockDocFindUnique.mockResolvedValueOnce({ id: 'doc-1', contractId: 'contract-1', itemNo: 'DOC-001', contract: { departmentId: 'dept-1' } });
      mockDocUpdate.mockResolvedValueOnce(makeDocRow({ status: 'EXPIRED_OVERDUE' }));

      const result = await service.update('doc-1', { status: 'EXPIRED_OVERDUE' }, ACTOR_UPDATE);
      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'EXPIRED_OVERDUE', updatedByUserId: 'user-manager-1' }) }),
      );
      expect(result).toMatchObject({ status: 'EXPIRED_OVERDUE' });
      expect(mockActivityCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contractId: 'contract-1', actorUserId: ACTOR_UPDATE.id, event: 'document_obligation_updated' }),
        }),
      );
    });

    it('returns the updated item with date-only "YYYY-MM-DD" strings, never a full ISO datetime (CM-70F)', async () => {
      mockDocFindUnique.mockResolvedValueOnce({ id: 'doc-1', contractId: 'contract-1', itemNo: 'DOC-001', contract: { departmentId: 'dept-1' } });
      mockDocUpdate.mockResolvedValueOnce(makeDocRow({
        requiredDate: new Date(Date.UTC(2026, 8, 6)),
        submissionDate: new Date(Date.UTC(2026, 8, 6)),
        expiryDate: null,
        submissionOrExpiryDate: null,
      }));

      const result = await service.update('doc-1', { requiredDate: '2026-09-06', submissionDate: '2026-09-06' }, ACTOR_UPDATE) as Record<string, unknown>;
      expect(result['requiredDate']).toBe('2026-09-06');
      expect(result['submissionDate']).toBe('2026-09-06');
      expect(result['expiryDate']).toBeUndefined();
    });
  });

  describe('listAttachments', () => {
    it('throws ForbiddenException without contracts.read', async () => {
      await expect(service.listAttachments('contract-1', 'doc-1', { ...ACTOR_READ_ONLY, permissions: [] })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when the item does not belong to the given contract', async () => {
      mockDocFindFirst.mockResolvedValueOnce(null);
      await expect(service.listAttachments('contract-1', 'doc-from-another-contract', ACTOR_READ_ONLY)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('enforces department scope via assertCanAccessDepartment', async () => {
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1', contract: { departmentId: 'dept-1' } });
      mockAttachmentFindMany.mockResolvedValueOnce([]);

      await service.listAttachments('contract-1', 'doc-1', ACTOR_READ_ONLY);
      expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_READ_ONLY, expect.anything(), 'dept-1');
      expect(mockAttachmentFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { documentObligationId: 'doc-1' } }));
    });
  });

  describe('createAttachment', () => {
    const fileFixture = { buffer: Buffer.from('test'), originalname: 'performance-bond.pdf', mimetype: 'application/pdf', size: 1024 };

    it('throws ForbiddenException without contracts.update', async () => {
      await expect(service.createAttachment('contract-1', 'doc-1', fileFixture, ACTOR_READ_ONLY)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when the item does not belong to the given contract', async () => {
      mockDocFindFirst.mockResolvedValueOnce(null);
      await expect(service.createAttachment('contract-1', 'doc-from-another-contract', fileFixture, ACTOR_UPDATE)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('enforces department scope via assertCanAccessDepartment', async () => {
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1', contract: { departmentId: 'dept-1' } });
      mockAttachmentCreate.mockResolvedValueOnce({ id: 'attachment-1' });

      await service.createAttachment('contract-1', 'doc-1', fileFixture, ACTOR_UPDATE);
      expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_UPDATE, expect.anything(), 'dept-1');
    });

    it('throws UnprocessableEntityException for a disallowed MIME type', async () => {
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1', contract: { departmentId: 'dept-1' } });

      await expect(
        service.createAttachment('contract-1', 'doc-1', { ...fileFixture, mimetype: 'application/zip' }, ACTOR_UPDATE),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(mockAttachmentStorage.save).not.toHaveBeenCalled();
    });

    it('throws UnprocessableEntityException when the file exceeds the size limit', async () => {
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1', contract: { departmentId: 'dept-1' } });

      await expect(
        service.createAttachment('contract-1', 'doc-1', { ...fileFixture, size: 11 * 1024 * 1024 }, ACTOR_UPDATE),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(mockAttachmentStorage.save).not.toHaveBeenCalled();
    });

    it('saves the file to storage and records the metadata row', async () => {
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1', contract: { departmentId: 'dept-1' } });
      mockAttachmentCreate.mockResolvedValueOnce({ id: 'attachment-1', originalFileName: 'performance-bond.pdf' });

      const result = await service.createAttachment('contract-1', 'doc-1', fileFixture, ACTOR_UPDATE);
      expect(mockAttachmentStorage.save).toHaveBeenCalledWith('doc-1', fileFixture.buffer, 'performance-bond.pdf');
      expect(mockAttachmentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentObligationId: 'doc-1',
            originalFileName: 'performance-bond.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024,
            uploadedByUserId: 'user-manager-1',
          }),
        }),
      );
      expect(result).toMatchObject({ id: 'attachment-1' });
      expect(mockActivityCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contractId: 'contract-1', actorUserId: ACTOR_UPDATE.id, event: 'document_obligation_attachment_uploaded' }),
        }),
      );
    });
  });

  describe('getAttachmentForDownload', () => {
    it('throws ForbiddenException without contracts.read', async () => {
      await expect(
        service.getAttachmentForDownload('contract-1', 'doc-1', 'attachment-1', { ...ACTOR_READ_ONLY, permissions: [] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the attachment/item/contract triple does not match', async () => {
      mockAttachmentFindFirst.mockResolvedValueOnce(null);
      await expect(
        service.getAttachmentForDownload('contract-1', 'doc-1', 'attachment-from-elsewhere', ACTOR_READ_ONLY),
      ).rejects.toThrow(NotFoundException);
    });

    it('scopes the lookup by attachmentId, documentObligationId, AND the item-contract relation together', async () => {
      mockAttachmentFindFirst.mockResolvedValueOnce({
        storagePath: 'doc-1/file.pdf',
        originalFileName: 'performance-bond.pdf',
        mimeType: 'application/pdf',
        documentObligation: { contract: { departmentId: 'dept-1' } },
      });

      await service.getAttachmentForDownload('contract-1', 'doc-1', 'attachment-1', ACTOR_READ_ONLY);
      expect(mockAttachmentFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'attachment-1', documentObligationId: 'doc-1', documentObligation: { contractId: 'contract-1' } },
        }),
      );
      expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_READ_ONLY, expect.anything(), 'dept-1');
    });

    it('returns storagePath/originalFileName/mimeType only, never the raw filesystem path structure', async () => {
      mockAttachmentFindFirst.mockResolvedValueOnce({
        storagePath: 'doc-1/file.pdf',
        originalFileName: 'performance-bond.pdf',
        mimeType: 'application/pdf',
        documentObligation: { contract: { departmentId: 'dept-1' } },
      });

      const result = await service.getAttachmentForDownload('contract-1', 'doc-1', 'attachment-1', ACTOR_READ_ONLY);
      expect(result).toEqual({
        storagePath: 'doc-1/file.pdf',
        originalFileName: 'performance-bond.pdf',
        mimeType: 'application/pdf',
      });
    });
  });
});
