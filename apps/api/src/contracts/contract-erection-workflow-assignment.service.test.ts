import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, UnprocessableEntityException, NotFoundException } from '@nestjs/common';
import {
  ContractErectionWorkflowAssignmentService,
  assertAssigneeProvided,
  computeAssignmentActivityEvent,
} from './contract-erection-workflow-assignment.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('assertAssigneeProvided', () => {
  it('throws when neither assignedToUserId nor assignedToName is present', () => {
    expect(() => assertAssigneeProvided({})).toThrow(UnprocessableEntityException);
  });

  it('throws when assignedToName is only whitespace and no user id given', () => {
    expect(() => assertAssigneeProvided({ assignedToName: '   ' })).toThrow(UnprocessableEntityException);
  });

  it('does not throw when assignedToUserId is present', () => {
    expect(() => assertAssigneeProvided({ assignedToUserId: 'user-9' })).not.toThrow();
  });

  it('does not throw when assignedToName is present', () => {
    expect(() => assertAssigneeProvided({ assignedToName: 'M. Rahman' })).not.toThrow();
  });
});

describe('computeAssignmentActivityEvent', () => {
  it('maps a first-time assignment to erection_workflow_assigned', () => {
    expect(computeAssignmentActivityEvent(false)).toBe('erection_workflow_assigned');
  });

  it('maps reassignment (an existing row already present) to erection_workflow_reassigned', () => {
    expect(computeAssignmentActivityEvent(true)).toBe('erection_workflow_reassigned');
  });
});

// ---------------------------------------------------------------------------
// Service-level tests
// ---------------------------------------------------------------------------

const mockContractFindUnique = vi.fn();
const mockUserFindUnique = vi.fn();
const mockAssignmentFindUnique = vi.fn();
const mockAssignmentFindUniqueOrThrow = vi.fn();
const mockAssignmentCreate = vi.fn();
const mockAssignmentUpdate = vi.fn();
const mockActivityCreate = vi.fn().mockResolvedValue({ id: 'activity-1' });

const mockClient = {
  contract: { findUnique: mockContractFindUnique },
  user: { findUnique: mockUserFindUnique },
  contractErectionWorkflowAssignment: {
    findUnique: mockAssignmentFindUnique,
    findUniqueOrThrow: mockAssignmentFindUniqueOrThrow,
    create: mockAssignmentCreate,
    update: mockAssignmentUpdate,
  },
  contractActivity: { create: mockActivityCreate },
};

const mockDb = { getClient: () => mockClient } as unknown as DatabaseService;

function actor(permissions: string[]): AuthUser {
  return { id: 'manager-1', displayName: 'Contract Manager', permissions } as AuthUser;
}

const SAVED_ROW = {
  id: 'assignment-1',
  contractId: 'c1',
  assignedToUserId: 'em-1',
  assignedToName: null,
  assignedDepartment: 'Erection Department',
  assignedByUserId: 'manager-1',
  assignedAt: new Date('2026-09-14'),
  status: 'ASSIGNED',
  remarks: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  assignedToUser: { id: 'em-1', displayName: 'Erection Manager' },
  assignedByUser: { id: 'manager-1', displayName: 'Contract Manager' },
};

describe('ContractErectionWorkflowAssignmentService', () => {
  let deptAccess: DepartmentAccessService;
  let service: ContractErectionWorkflowAssignmentService;

  beforeEach(() => {
    vi.clearAllMocks();
    deptAccess = { assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined) } as unknown as DepartmentAccessService;
    service = new ContractErectionWorkflowAssignmentService(mockDb, deptAccess);
  });

  it('rejects a read without contracts.read', async () => {
    await expect(service.getForContract('c1', actor([]))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns null (not 404) when no assignment exists yet for the contract', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
    mockAssignmentFindUnique.mockResolvedValue(null);

    const result = await service.getForContract('c1', actor(['contracts.read']));
    expect(result).toBeNull();
  });

  it('404s a read against a contract that does not exist', async () => {
    mockContractFindUnique.mockResolvedValue(null);
    await expect(service.getForContract('missing', actor(['contracts.read']))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects assign without contracts.update (contracts.read alone is not enough)', async () => {
    await expect(
      service.assign('c1', { assignedToUserId: 'em-1' }, actor(['contracts.read'])),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to assign with neither a user id nor a name', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
    await expect(service.assign('c1', {}, actor(['contracts.update']))).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('refuses to assign to a user id that does not exist', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
    mockUserFindUnique.mockResolvedValue(null);

    await expect(
      service.assign('c1', { assignedToUserId: 'ghost' }, actor(['contracts.update'])),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('creates the assignment (first-time Assign) and logs erection_workflow_assigned', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
    mockUserFindUnique.mockResolvedValue({ id: 'em-1' });
    mockAssignmentFindUnique.mockResolvedValue(null);
    mockAssignmentCreate.mockResolvedValue({ id: 'assignment-1' });
    mockAssignmentFindUniqueOrThrow.mockResolvedValue(SAVED_ROW);

    const result = (await service.assign('c1', { assignedToUserId: 'em-1' }, actor(['contracts.update']))) as { assignedToUserId: string };
    expect(result.assignedToUserId).toBe('em-1');
    expect(mockAssignmentCreate).toHaveBeenCalled();
    expect(mockAssignmentUpdate).not.toHaveBeenCalled();
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'erection_workflow_assigned' }) }),
    );
  });

  it('updates the existing row in place (Change Assignment) and logs erection_workflow_reassigned', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
    mockUserFindUnique.mockResolvedValue({ id: 'em-2' });
    mockAssignmentFindUnique.mockResolvedValue({ id: 'assignment-1' });
    mockAssignmentUpdate.mockResolvedValue({ id: 'assignment-1' });
    mockAssignmentFindUniqueOrThrow.mockResolvedValue({ ...SAVED_ROW, assignedToUserId: 'em-2' });

    const result = (await service.assign('c1', { assignedToUserId: 'em-2' }, actor(['contracts.update']))) as { assignedToUserId: string };
    expect(result.assignedToUserId).toBe('em-2');
    expect(mockAssignmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'assignment-1' } }),
    );
    expect(mockAssignmentCreate).not.toHaveBeenCalled();
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'erection_workflow_reassigned' }) }),
    );
  });

  it('defaults assignedDepartment to "Erection Department" when not supplied', async () => {
    mockContractFindUnique.mockResolvedValue({ id: 'c1', departmentId: null });
    mockAssignmentFindUnique.mockResolvedValue(null);
    mockAssignmentCreate.mockResolvedValue({ id: 'assignment-1' });
    mockAssignmentFindUniqueOrThrow.mockResolvedValue(SAVED_ROW);

    await service.assign('c1', { assignedToName: 'M. Rahman' }, actor(['contracts.update']));
    expect(mockAssignmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedDepartment: 'Erection Department' }) }),
    );
  });
});
