import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ContractAttachmentsService, ATTACHMENT_SOURCE_LABELS } from './contract-attachments.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';

const mockWorkflowAttachmentFindMany = vi.fn();
const mockCloseoutAttachmentFindMany = vi.fn();
const mockVariationAttachmentFindMany = vi.fn();
const mockDocumentObligationAttachmentFindMany = vi.fn();
const mockContractFindUnique = vi.fn();

const mockClient = {
  contractWorkflowTaskAttachment: { findMany: mockWorkflowAttachmentFindMany },
  contractCloseoutAttachment: { findMany: mockCloseoutAttachmentFindMany },
  contractVariationAttachment: { findMany: mockVariationAttachmentFindMany },
  contractDocumentObligationAttachment: { findMany: mockDocumentObligationAttachmentFindMany },
  contract: { findUnique: mockContractFindUnique },
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;

const mockAssertCanAccessDepartment = vi.fn().mockResolvedValue(undefined);

const mockDeptAccess = {
  assertCanAccessDepartment: mockAssertCanAccessDepartment,
} as unknown as DepartmentAccessService;

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

function mockAllSourcesEmpty(): void {
  mockWorkflowAttachmentFindMany.mockResolvedValueOnce([]);
  mockCloseoutAttachmentFindMany.mockResolvedValueOnce([]);
  mockVariationAttachmentFindMany.mockResolvedValueOnce([]);
  mockDocumentObligationAttachmentFindMany.mockResolvedValueOnce([]);
}

describe('ContractAttachmentsService', () => {
  let service: ContractAttachmentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertCanAccessDepartment.mockResolvedValue(undefined);
    service = new ContractAttachmentsService(mockDb, mockDeptAccess);
  });

  it('throws ForbiddenException without contracts.read', async () => {
    await expect(service.listAllForContract('contract-1', { ...ACTOR_READ_ONLY, permissions: [] })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws NotFoundException for a missing contract', async () => {
    mockContractFindUnique.mockResolvedValueOnce(null);
    await expect(service.listAllForContract('missing', ACTOR_READ_ONLY)).rejects.toThrow(NotFoundException);
  });

  it('enforces department scope via assertCanAccessDepartment', async () => {
    mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
    mockAllSourcesEmpty();

    await service.listAllForContract('contract-1', ACTOR_READ_ONLY);
    expect(mockAssertCanAccessDepartment).toHaveBeenCalledWith(ACTOR_READ_ONLY, expect.anything(), 'dept-1');
  });

  it('scopes each sub-query to the given contract via its parent relation', async () => {
    mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
    mockAllSourcesEmpty();

    await service.listAllForContract('contract-1', ACTOR_READ_ONLY);
    expect(mockWorkflowAttachmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { task: { contractId: 'contract-1' } } }),
    );
    expect(mockCloseoutAttachmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { closeoutRequest: { contractId: 'contract-1' } } }),
    );
    expect(mockVariationAttachmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { variation: { contractId: 'contract-1' } } }),
    );
    expect(mockDocumentObligationAttachmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { documentObligation: { contractId: 'contract-1' } } }),
    );
  });

  it('merges all 4 sources, tags each with its real source label + related item title, and builds a real download path per source', async () => {
    mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
    mockWorkflowAttachmentFindMany.mockResolvedValueOnce([
      { id: 'wf-1', taskId: 'task-1', originalFileName: 'drawing.pdf', mimeType: 'application/pdf', fileSize: 100, createdAt: new Date('2026-01-01'), uploadedByUser: { id: 'u1', displayName: 'A' }, task: { taskName: 'Shop Drawing Approval' } },
    ]);
    mockCloseoutAttachmentFindMany.mockResolvedValueOnce([
      { id: 'co-1', closeoutRequestId: 'request-1', originalFileName: 'signoff.pdf', mimeType: 'application/pdf', fileSize: 200, createdAt: new Date('2026-01-02'), uploadedByUser: { id: 'u2', displayName: 'B' }, closeoutRequest: { requestNo: 'CLR-001' } },
    ]);
    mockVariationAttachmentFindMany.mockResolvedValueOnce([
      { id: 'vr-1', variationId: 'variation-1', originalFileName: 'site-instruction.pdf', mimeType: 'application/pdf', fileSize: 300, createdAt: new Date('2026-01-03'), uploadedByUser: { id: 'u3', displayName: 'C' }, variation: { description: 'Additional Reinforcement' } },
    ]);
    mockDocumentObligationAttachmentFindMany.mockResolvedValueOnce([
      { id: 'do-1', documentObligationId: 'doc-1', originalFileName: 'Bond_78945.pdf', mimeType: 'application/pdf', fileSize: 400, createdAt: new Date('2026-01-04'), uploadedByUser: { id: 'u4', displayName: 'D' }, documentObligation: { title: 'Performance Bond', category: 'PERFORMANCE_BOND' } },
    ]);

    const result = await service.listAllForContract('contract-1', ACTOR_READ_ONLY);
    expect(result).toHaveLength(4);

    const wf = result.find((a) => a.id === 'wf-1')!;
    expect(wf.source).toBe('WORKFLOW_TASK');
    expect(wf.sourceLabel).toBe(ATTACHMENT_SOURCE_LABELS.WORKFLOW_TASK);
    expect(wf.relatedItemTitle).toBe('Shop Drawing Approval');
    expect(wf.documentObligationCategory).toBeNull();
    expect(wf.downloadPath).toBe('/contracts/workflow/tasks/task-1/attachments/wf-1/download');

    const co = result.find((a) => a.id === 'co-1')!;
    expect(co.source).toBe('CLOSEOUT');
    expect(co.relatedItemTitle).toBe('Closeout Request CLR-001');
    expect(co.documentObligationCategory).toBeNull();
    expect(co.downloadPath).toBe('/contracts/closeout/request-1/attachments/co-1/download');

    const vr = result.find((a) => a.id === 'vr-1')!;
    expect(vr.source).toBe('VARIATION');
    expect(vr.sourceLabel).toBe('Variation / Change Order');
    expect(vr.relatedItemTitle).toBe('Additional Reinforcement');
    expect(vr.documentObligationCategory).toBeNull();
    expect(vr.downloadPath).toBe('/contracts/contract-1/variations/variation-1/attachments/vr-1/download');

    const doItem = result.find((a) => a.id === 'do-1')!;
    expect(doItem.source).toBe('DOCUMENT_OBLIGATION');
    expect(doItem.sourceLabel).toBe('Documents & Obligations');
    expect(doItem.relatedItemTitle).toBe('Performance Bond');
    expect(doItem.documentObligationCategory).toBe('PERFORMANCE_BOND');
    expect(doItem.downloadPath).toBe('/contracts/contract-1/document-obligations/doc-1/attachments/do-1/download');
  });

  it('sorts the merged list newest first', async () => {
    mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
    mockWorkflowAttachmentFindMany.mockResolvedValueOnce([
      { id: 'old', taskId: 't1', originalFileName: 'a.pdf', mimeType: 'application/pdf', fileSize: 1, createdAt: new Date('2026-01-01'), uploadedByUser: null, task: { taskName: 'Old Task' } },
    ]);
    mockCloseoutAttachmentFindMany.mockResolvedValueOnce([
      { id: 'new', closeoutRequestId: 'r1', originalFileName: 'b.pdf', mimeType: 'application/pdf', fileSize: 1, createdAt: new Date('2026-06-01'), uploadedByUser: null, closeoutRequest: { requestNo: 'CLR-002' } },
    ]);
    mockVariationAttachmentFindMany.mockResolvedValueOnce([]);
    mockDocumentObligationAttachmentFindMany.mockResolvedValueOnce([]);

    const result = await service.listAllForContract('contract-1', ACTOR_READ_ONLY);
    expect(result.map((a) => a.id)).toEqual(['new', 'old']);
  });

  it('returns an empty list when the contract has no attachments in any source (never fake rows)', async () => {
    mockContractFindUnique.mockResolvedValueOnce({ id: 'contract-1', departmentId: 'dept-1' });
    mockAllSourcesEmpty();

    const result = await service.listAllForContract('contract-1', ACTOR_READ_ONLY);
    expect(result).toEqual([]);
  });
});
