import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import {
  ContractVariationsService,
  computeVariationSummary,
  type VariationRow,
} from './contract-variations.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { VariationAttachmentStorageService } from './variation-attachment-storage.service';

// ---------------------------------------------------------------------------
// Client mocks
// ---------------------------------------------------------------------------

const mockVariationFindMany = vi.fn();
const mockVariationFindUnique = vi.fn();
const mockVariationFindFirst = vi.fn();
const mockVariationCreate = vi.fn();
const mockVariationUpdate = vi.fn();
const mockContractFindUnique = vi.fn();
const mockAttachmentFindMany = vi.fn();
const mockAttachmentFindFirst = vi.fn();
const mockAttachmentCreate = vi.fn();
const mockActivityCreate = vi.fn().mockResolvedValue({ id: 'activity-1' });

const mockClient = {
  contractVariation: {
    findMany: mockVariationFindMany,
    findUnique: mockVariationFindUnique,
    findFirst: mockVariationFindFirst,
    create: mockVariationCreate,
    update: mockVariationUpdate,
  },
  contractVariationAttachment: {
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

const mockAttachmentSave = vi.fn().mockResolvedValue({ fileName: 'random-uuid.pdf', storagePath: 'variation-1/random-uuid.pdf' });

const mockAttachmentStorage = {
  save: mockAttachmentSave,
} as unknown as VariationAttachmentStorageService;

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

function makeVariationRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'variation-1',
    contractId: 'contract-1',
    variationNo: 'VO-001',
    description: 'Additional Reinforcement for Column C1-C10',
    amount: 25750,
    currency: 'KWD',
    affectsContractValue: true,
    status: 'APPROVED',
    submittedDate: new Date('2026-01-05'),
    approvedDate: new Date('2026-01-12'),
    supportingDocumentName: null,
    supportingDocumentUrl: null,
    remarks: null,
    createdByUser: { id: 'user-manager-1', displayName: 'Manager' },
    updatedByUser: null,
    createdAt: new Date('2026-01-05'),
    updatedAt: new Date('2026-01-05'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('computeVariationSummary', () => {
  it('sums APPROVED amounts into approvedValue', () => {
    const items: VariationRow[] = [
      { status: 'APPROVED', amount: 25750, affectsContractValue: true },
      { status: 'APPROVED', amount: 32000, affectsContractValue: true },
    ];
    const summary = computeVariationSummary(items);
    expect(summary.approvedValue).toBe('57750.000');
    expect(summary.totalVariations).toBe(2);
  });

  it('sums SUBMITTED and PENDING_APPROVAL amounts into pendingValue', () => {
    const items: VariationRow[] = [
      { status: 'SUBMITTED', amount: 18600, affectsContractValue: true },
      { status: 'PENDING_APPROVAL', amount: 12300, affectsContractValue: true },
    ];
    const summary = computeVariationSummary(items);
    expect(summary.pendingValue).toBe('30900.000');
  });

  it('sums REJECTED and CANCELLED amounts into rejectedCancelledValue, preserving sign', () => {
    const items: VariationRow[] = [
      { status: 'REJECTED', amount: 15800, affectsContractValue: true },
      { status: 'CANCELLED', amount: -12000, affectsContractValue: true },
    ];
    const summary = computeVariationSummary(items);
    expect(summary.rejectedCancelledValue).toBe('3800.000');
  });

  it('excludes DRAFT variations from every value bucket but counts them in totalVariations', () => {
    const items: VariationRow[] = [
      { status: 'DRAFT', amount: 5000, affectsContractValue: true },
      { status: 'APPROVED', amount: 1000, affectsContractValue: true },
    ];
    const summary = computeVariationSummary(items);
    expect(summary.totalVariations).toBe(2);
    expect(summary.approvedValue).toBe('1000.000');
  });

  it('excludes affectsContractValue=false variations from every value bucket but counts them in totalVariations', () => {
    const items: VariationRow[] = [
      { status: 'APPROVED', amount: 5000, affectsContractValue: false },
      { status: 'APPROVED', amount: 1000, affectsContractValue: true },
    ];
    const summary = computeVariationSummary(items);
    expect(summary.totalVariations).toBe(2);
    expect(summary.approvedValue).toBe('1000.000');
  });

  it('computes netVariationImpact as approved + pending only (never rejected/cancelled)', () => {
    const items: VariationRow[] = [
      { status: 'APPROVED', amount: 100000, affectsContractValue: true },
      { status: 'SUBMITTED', amount: 20000, affectsContractValue: true },
      { status: 'REJECTED', amount: 999999, affectsContractValue: true },
    ];
    const summary = computeVariationSummary(items);
    expect(summary.netVariationImpact).toBe('120000.000');
  });

  it('returns all zeros for an empty item list (no variations — never fake rows)', () => {
    const summary = computeVariationSummary([]);
    expect(summary).toEqual({
      totalVariations: 0,
      approvedValue: '0.000',
      pendingValue: '0.000',
      rejectedCancelledValue: '0.000',
      netVariationImpact: '0.000',
    });
  });

  it('handles a deductive (negative) approved amount honestly, never clamped', () => {
    const items: VariationRow[] = [
      { status: 'APPROVED', amount: 100000, affectsContractValue: true },
      { status: 'APPROVED', amount: -12000, affectsContractValue: true },
    ];
    const summary = computeVariationSummary(items);
    expect(summary.approvedValue).toBe('88000.000');
  });
});

// ---------------------------------------------------------------------------
// Service tests
// ---------------------------------------------------------------------------

describe('ContractVariationsService', () => {
  let service: ContractVariationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertCanAccessDepartment.mockResolvedValue(undefined);
    service = new ContractVariationsService(mockDb, mockDeptAccess, mockAttachmentStorage);
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
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1', originalContractValue: 500000 });
      mockVariationFindMany.mockResolvedValueOnce([]);
      await service.findAllForContract('contract-1', ACTOR_READ_ONLY);
      expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_READ_ONLY, expect.anything(), 'dept-1');
    });

    it('computes computedCurrentValue as originalContractValue + approvedValue', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1', originalContractValue: 500000 });
      mockVariationFindMany.mockResolvedValueOnce([makeVariationRow({ status: 'APPROVED', amount: 165750 })]);

      const result = await service.findAllForContract('contract-1', ACTOR_READ_ONLY);
      expect(result.originalContractValue).toBe('500000.000');
      expect(result.summary.approvedValue).toBe('165750.000');
      expect(result.computedCurrentValue).toBe('665750.000');
    });

    it('returns null computedCurrentValue when the contract has no originalContractValue (never a fabricated number)', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1', originalContractValue: null });
      mockVariationFindMany.mockResolvedValueOnce([]);

      const result = await service.findAllForContract('contract-1', ACTOR_READ_ONLY);
      expect(result.originalContractValue).toBeNull();
      expect(result.computedCurrentValue).toBeNull();
    });

    it('returns an empty item list and zeroed summary when the contract has no variations', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1', originalContractValue: 500000 });
      mockVariationFindMany.mockResolvedValueOnce([]);

      const result = await service.findAllForContract('contract-1', ACTOR_READ_ONLY);
      expect(result.items).toEqual([]);
      expect(result.summary.totalVariations).toBe(0);
    });
  });

  describe('create', () => {
    it('throws ForbiddenException without contracts.update', async () => {
      await expect(service.create('contract-1', { description: 'x', amount: 100 }, ACTOR_READ_ONLY)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException for a missing contract', async () => {
      mockContractFindUnique.mockResolvedValueOnce(null);
      await expect(service.create('missing', { description: 'x', amount: 100 }, ACTOR_UPDATE)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('enforces department scope via assertCanAccessDepartment', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockVariationCreate.mockResolvedValueOnce(makeVariationRow());
      await service.create('contract-1', { description: 'x', amount: 100 }, ACTOR_UPDATE);
      expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_UPDATE, expect.anything(), 'dept-1');
    });

    it('throws ConflictException for a duplicate variationNo within the same contract', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockVariationFindUnique.mockResolvedValueOnce({ id: 'existing-variation' });

      await expect(
        service.create('contract-1', { variationNo: 'VO-001', description: 'x', amount: 100 }, ACTOR_UPDATE),
      ).rejects.toThrow(ConflictException);
      expect(mockVariationCreate).not.toHaveBeenCalled();
    });

    it('allows a negative (deductive) amount', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockVariationCreate.mockResolvedValueOnce(makeVariationRow({ amount: -12000 }));

      await service.create('contract-1', { description: 'Delete Light Poles', amount: -12000 }, ACTOR_UPDATE);
      expect(mockVariationCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: -12000 }) }),
      );
    });

    it('defaults status/affectsContractValue via Prisma column defaults when omitted (never sent explicitly)', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockVariationCreate.mockResolvedValueOnce(makeVariationRow());

      await service.create('contract-1', { description: 'x', amount: 100 }, ACTOR_UPDATE);
      const callArg = mockVariationCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(callArg.data['status']).toBeUndefined();
      expect(callArg.data['affectsContractValue']).toBeUndefined();
    });

    it('logs a variation_created contract activity entry (CM-66)', async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
      mockVariationCreate.mockResolvedValueOnce(makeVariationRow());

      await service.create('contract-1', { description: 'x', amount: 100 }, ACTOR_UPDATE);

      expect(mockActivityCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contractId: 'contract-1', actorUserId: ACTOR_UPDATE.id, event: 'variation_created' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('throws ForbiddenException without contracts.update', async () => {
      await expect(service.update('variation-1', {}, ACTOR_READ_ONLY)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for a missing variation', async () => {
      mockVariationFindUnique.mockResolvedValueOnce(null);
      await expect(service.update('missing', {}, ACTOR_UPDATE)).rejects.toThrow(NotFoundException);
    });

    it('enforces department scope via assertCanAccessDepartment', async () => {
      mockVariationFindUnique.mockResolvedValueOnce({
        id: 'variation-1',
        contractId: 'contract-1',
        variationNo: 'VO-001',
        contract: { departmentId: 'dept-1' },
      });
      mockVariationUpdate.mockResolvedValueOnce(makeVariationRow());

      await service.update('variation-1', { status: 'APPROVED' }, ACTOR_UPDATE);
      expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_UPDATE, expect.anything(), 'dept-1');
    });

    it('throws ConflictException when renaming to a variationNo already used by another variation in the same contract', async () => {
      mockVariationFindUnique.mockResolvedValueOnce({
        id: 'variation-1',
        contractId: 'contract-1',
        variationNo: 'VO-001',
        contract: { departmentId: 'dept-1' },
      });
      mockVariationFindUnique.mockResolvedValueOnce({ id: 'other-variation' });

      await expect(service.update('variation-1', { variationNo: 'VO-002' }, ACTOR_UPDATE)).rejects.toThrow(ConflictException);
      expect(mockVariationUpdate).not.toHaveBeenCalled();
    });

    it('allows changing status to APPROVED, moving the variation into the approved bucket on next read', async () => {
      mockVariationFindUnique.mockResolvedValueOnce({
        id: 'variation-1',
        contractId: 'contract-1',
        variationNo: 'VO-001',
        contract: { departmentId: 'dept-1' },
      });
      mockVariationUpdate.mockResolvedValueOnce(makeVariationRow({ status: 'APPROVED' }));

      const result = await service.update('variation-1', { status: 'APPROVED', approvedDate: '2026-01-12' }, ACTOR_UPDATE);
      expect(mockVariationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'APPROVED', updatedByUserId: 'user-manager-1' }),
        }),
      );
      expect(result).toMatchObject({ status: 'APPROVED' });
      expect(mockActivityCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contractId: 'contract-1', actorUserId: ACTOR_UPDATE.id, event: 'variation_updated' }),
        }),
      );
    });
  });

  describe('listAttachments', () => {
    it('throws ForbiddenException without contracts.read', async () => {
      await expect(
        service.listAttachments('contract-1', 'variation-1', { ...ACTOR_READ_ONLY, permissions: [] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the variation does not belong to the given contract', async () => {
      mockVariationFindFirst.mockResolvedValueOnce(null);
      await expect(service.listAttachments('contract-1', 'variation-from-another-contract', ACTOR_READ_ONLY)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('enforces department scope via assertCanAccessDepartment', async () => {
      mockVariationFindFirst.mockResolvedValueOnce({ id: 'variation-1', contract: { departmentId: 'dept-1' } });
      mockAttachmentFindMany.mockResolvedValueOnce([]);

      await service.listAttachments('contract-1', 'variation-1', ACTOR_READ_ONLY);
      expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_READ_ONLY, expect.anything(), 'dept-1');
      expect(mockAttachmentFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { variationId: 'variation-1' } }));
    });
  });

  describe('createAttachment', () => {
    const fileFixture = { buffer: Buffer.from('test'), originalname: 'site-instruction.pdf', mimetype: 'application/pdf', size: 1024 };

    it('throws ForbiddenException without contracts.update', async () => {
      await expect(service.createAttachment('contract-1', 'variation-1', fileFixture, ACTOR_READ_ONLY)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when the variation does not belong to the given contract', async () => {
      mockVariationFindFirst.mockResolvedValueOnce(null);
      await expect(service.createAttachment('contract-1', 'variation-from-another-contract', fileFixture, ACTOR_UPDATE)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('enforces department scope via assertCanAccessDepartment', async () => {
      mockVariationFindFirst.mockResolvedValueOnce({ id: 'variation-1', contract: { departmentId: 'dept-1' } });
      mockAttachmentCreate.mockResolvedValueOnce({ id: 'attachment-1' });

      await service.createAttachment('contract-1', 'variation-1', fileFixture, ACTOR_UPDATE);
      expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_UPDATE, expect.anything(), 'dept-1');
    });

    it('throws UnprocessableEntityException for a disallowed MIME type', async () => {
      mockVariationFindFirst.mockResolvedValueOnce({ id: 'variation-1', contract: { departmentId: 'dept-1' } });

      await expect(
        service.createAttachment('contract-1', 'variation-1', { ...fileFixture, mimetype: 'application/zip' }, ACTOR_UPDATE),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(mockAttachmentStorage.save).not.toHaveBeenCalled();
    });

    it('throws UnprocessableEntityException when the file exceeds the size limit', async () => {
      mockVariationFindFirst.mockResolvedValueOnce({ id: 'variation-1', contract: { departmentId: 'dept-1' } });

      await expect(
        service.createAttachment('contract-1', 'variation-1', { ...fileFixture, size: 11 * 1024 * 1024 }, ACTOR_UPDATE),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(mockAttachmentStorage.save).not.toHaveBeenCalled();
    });

    it('saves the file to storage and records the metadata row', async () => {
      mockVariationFindFirst.mockResolvedValueOnce({ id: 'variation-1', contract: { departmentId: 'dept-1' } });
      mockAttachmentCreate.mockResolvedValueOnce({ id: 'attachment-1', originalFileName: 'site-instruction.pdf' });

      const result = await service.createAttachment('contract-1', 'variation-1', fileFixture, ACTOR_UPDATE);
      expect(mockAttachmentStorage.save).toHaveBeenCalledWith('variation-1', fileFixture.buffer, 'site-instruction.pdf');
      expect(mockAttachmentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            variationId: 'variation-1',
            originalFileName: 'site-instruction.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024,
            uploadedByUserId: 'user-manager-1',
          }),
        }),
      );
      expect(result).toMatchObject({ id: 'attachment-1' });
      expect(mockActivityCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contractId: 'contract-1', actorUserId: ACTOR_UPDATE.id, event: 'variation_attachment_uploaded' }),
        }),
      );
    });
  });

  describe('getAttachmentForDownload', () => {
    it('throws ForbiddenException without contracts.read', async () => {
      await expect(
        service.getAttachmentForDownload('contract-1', 'variation-1', 'attachment-1', { ...ACTOR_READ_ONLY, permissions: [] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the attachment/variation/contract triple does not match', async () => {
      mockAttachmentFindFirst.mockResolvedValueOnce(null);
      await expect(
        service.getAttachmentForDownload('contract-1', 'variation-1', 'attachment-from-elsewhere', ACTOR_READ_ONLY),
      ).rejects.toThrow(NotFoundException);
    });

    it('scopes the lookup by attachmentId, variationId, AND the variation-contract relation together', async () => {
      mockAttachmentFindFirst.mockResolvedValueOnce({
        storagePath: 'variation-1/file.pdf',
        originalFileName: 'site-instruction.pdf',
        mimeType: 'application/pdf',
        variation: { contract: { departmentId: 'dept-1' } },
      });

      await service.getAttachmentForDownload('contract-1', 'variation-1', 'attachment-1', ACTOR_READ_ONLY);
      expect(mockAttachmentFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'attachment-1', variationId: 'variation-1', variation: { contractId: 'contract-1' } },
        }),
      );
      expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_READ_ONLY, expect.anything(), 'dept-1');
    });

    it('returns storagePath/originalFileName/mimeType only, never the raw filesystem path structure', async () => {
      mockAttachmentFindFirst.mockResolvedValueOnce({
        storagePath: 'variation-1/file.pdf',
        originalFileName: 'site-instruction.pdf',
        mimeType: 'application/pdf',
        variation: { contract: { departmentId: 'dept-1' } },
      });

      const result = await service.getAttachmentForDownload('contract-1', 'variation-1', 'attachment-1', ACTOR_READ_ONLY);
      expect(result).toEqual({
        storagePath: 'variation-1/file.pdf',
        originalFileName: 'site-instruction.pdf',
        mimeType: 'application/pdf',
      });
    });
  });
});
