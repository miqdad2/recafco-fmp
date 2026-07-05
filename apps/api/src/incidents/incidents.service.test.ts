import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DepartmentAccessScope, ModuleIdentifier } from '@recafco/database';
import { IncidentsService } from './incidents.service';
import type { DatabaseService } from '../database/database.service';
import type { IncidentsRefService } from './incidents-ref.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';

// ---------------------------------------------------------------------------
// Mock infrastructure
// ---------------------------------------------------------------------------

const mockIncidentFindUnique = vi.fn();
const mockIncidentFindMany = vi.fn();
const mockIncidentCount = vi.fn();
const mockDepartmentFindMany = vi.fn();
const mockGetScope = vi.fn();
const mockBuildDeptFilter = vi.fn();
const mockAssertCanAccessDept = vi.fn();
const mockTransaction = vi.fn();

const mockClient = {
  incident: {
    findUnique: mockIncidentFindUnique,
    findMany: mockIncidentFindMany,
    count: mockIncidentCount,
  },
  department: { findMany: mockDepartmentFindMany },
  $transaction: mockTransaction,
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;
const mockRef = { nextRef: vi.fn().mockResolvedValue('INC-2026-000001') } as unknown as IncidentsRefService;

const mockDeptAccess = {
  buildDeptFilter: mockBuildDeptFilter,
  getScope: mockGetScope,
  canAccessDepartment: vi.fn().mockResolvedValue(true),
  assertCanAccessDepartment: mockAssertCanAccessDept,
} as unknown as DepartmentAccessService;

const ACTOR_VIEWER: AuthUser = {
  id: 'user-1',
  username: 'alice',
  displayName: 'Alice',
  roleId: 'role-1',
  roleCode: 'VIEWER',
  roleName: 'Viewer',
  mustChangePassword: false,
  isActive: true,
  sessionId: 'session-1',
  departmentId: 'dept-a',
  permissions: ['incidents.read'],
};

const BASE_INCIDENT = {
  id: 'inc-001',
  referenceNumber: 'INC-2026-000001',
  title: 'Test Incident',
  description: 'desc',
  severity: 'LOW',
  status: 'DRAFT',
  occurredAt: new Date('2026-07-01T08:00:00Z'),
  immediateAction: null,
  reportedByUserId: 'user-1',
  reportedForUserId: null,
  affectedPlantId: null,
  affectedLocationId: null,
  affectedDepartmentId: 'dept-a',
  assignedToUserId: null,
  reviewedByUserId: null,
  rootCause: null,
  investigationSummary: null,
  resolutionSummary: null,
  resolvedByUserId: null,
  closedByUserId: null,
  resolvedAt: null,
  closedAt: null,
  createdAt: new Date('2026-07-01T08:00:00Z'),
  updatedAt: new Date('2026-07-01T08:00:00Z'),
  reportedByUser: { id: 'user-1', displayName: 'Alice', username: 'alice' },
  reportedForUser: null,
  affectedPlant: null,
  affectedLocation: null,
  affectedDept: { id: 'dept-a', code: 'DEPT-A', name: 'Department A' },
  assignedToUser: null,
};

let service: IncidentsService;

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildDeptFilter.mockResolvedValue(null); // default: ALL_DEPARTMENTS
  mockAssertCanAccessDept.mockResolvedValue(undefined); // default: access permitted
  service = new IncidentsService(mockDb, mockRef, mockDeptAccess);
});

// ---------------------------------------------------------------------------
// getDashboard
// ---------------------------------------------------------------------------

describe('IncidentsService.getDashboard', () => {
  it('returns ALL_DEPARTMENTS scope and correct metrics when no dept filter', async () => {
    mockGetScope.mockResolvedValueOnce(DepartmentAccessScope.ALL_DEPARTMENTS);
    // buildDeptFilter returns null by default — no department lookup
    mockIncidentCount
      .mockResolvedValueOnce(15) // totalOpen
      .mockResolvedValueOnce(4)  // criticalOpen
      .mockResolvedValueOnce(3)  // underInvestigation
      .mockResolvedValueOnce(7); // resolvedThisMonth
    mockIncidentFindMany.mockResolvedValueOnce([
      { id: 'inc-r1', referenceNumber: 'INC-001', title: 'Chemical Spill', status: 'SUBMITTED', updatedAt: new Date('2026-07-01T10:00:00Z') },
    ]);

    const result = await service.getDashboard(ACTOR_VIEWER);

    expect(result.scope.type).toBe(DepartmentAccessScope.ALL_DEPARTMENTS);
    expect(result.scope.departmentNames).toEqual([]);
    expect(result.metrics.totalOpen).toBe(15);
    expect(result.metrics.criticalOpen).toBe(4);
    expect(result.metrics.underInvestigation).toBe(3);
    expect(result.metrics.resolvedThisMonth).toBe(7);
    expect(result.recent).toHaveLength(1);
    expect(result.recent[0]?.referenceNumber).toBe('INC-001');
    expect(result.recent[0]?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('applies dept filter to getDashboard queries when scope is OWN_DEPARTMENT', async () => {
    mockGetScope.mockResolvedValueOnce(DepartmentAccessScope.OWN_DEPARTMENT);
    mockBuildDeptFilter.mockResolvedValueOnce({ in: ['dept-a'] });
    mockDepartmentFindMany.mockResolvedValueOnce([{ name: 'Department A' }]);
    mockIncidentCount
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);
    mockIncidentFindMany.mockResolvedValueOnce([]);

    const result = await service.getDashboard(ACTOR_VIEWER);

    expect(result.scope.type).toBe(DepartmentAccessScope.OWN_DEPARTMENT);
    expect(result.scope.departmentNames).toEqual(['Department A']);
  });
});

// ---------------------------------------------------------------------------
// findOne — direct URL protection
// ---------------------------------------------------------------------------

describe('IncidentsService.findOne — direct URL protection', () => {
  it('returns incident when assertCanAccessDepartment permits', async () => {
    mockIncidentFindUnique.mockResolvedValue(BASE_INCIDENT);
    mockAssertCanAccessDept.mockResolvedValue(undefined);

    const result = await service.findOne(BASE_INCIDENT.id, ACTOR_VIEWER);

    expect(result.id).toBe(BASE_INCIDENT.id);
    expect(mockAssertCanAccessDept).toHaveBeenCalledWith(
      ACTOR_VIEWER,
      ModuleIdentifier.INCIDENT_REPORT,
      BASE_INCIDENT.affectedDepartmentId,
    );
  });

  it('throws ForbiddenException when assertCanAccessDepartment denies access (cross-dept direct URL)', async () => {
    const crossDeptIncident = { ...BASE_INCIDENT, affectedDepartmentId: 'dept-b' };
    mockIncidentFindUnique.mockResolvedValue(crossDeptIncident);
    mockAssertCanAccessDept.mockRejectedValueOnce(
      new ForbiddenException({ code: 'DEPARTMENT_ACCESS_DENIED', message: 'denied' }),
    );

    await expect(service.findOne(crossDeptIncident.id, ACTOR_VIEWER)).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when incident does not exist', async () => {
    mockIncidentFindUnique.mockResolvedValue(null);

    await expect(service.findOne('nonexistent-id', ACTOR_VIEWER)).rejects.toThrow(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// findAll — department scope filter applied
// ---------------------------------------------------------------------------

describe('IncidentsService.findAll — department scope filter', () => {
  it('includes affectedDepartmentId filter when buildDeptFilter returns {in:[dept-a]}', async () => {
    mockBuildDeptFilter.mockResolvedValueOnce({ in: ['dept-a'] });
    mockIncidentFindMany.mockResolvedValueOnce([]);
    mockIncidentCount.mockResolvedValueOnce(0);

    await service.findAll({}, ACTOR_VIEWER);

    expect(mockIncidentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ affectedDepartmentId: { in: ['dept-a'] } }),
      }),
    );
  });

  it('includes affectedDepartmentId:{in:[]} when actor has no dept (fail-closed)', async () => {
    mockBuildDeptFilter.mockResolvedValueOnce({ in: [] });
    mockIncidentFindMany.mockResolvedValueOnce([]);
    mockIncidentCount.mockResolvedValueOnce(0);

    await service.findAll({}, { ...ACTOR_VIEWER, departmentId: null });

    expect(mockIncidentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ affectedDepartmentId: { in: [] } }),
      }),
    );
  });

  it('does NOT add affectedDepartmentId filter when buildDeptFilter returns null (ALL_DEPARTMENTS)', async () => {
    mockBuildDeptFilter.mockResolvedValueOnce(null);
    mockIncidentFindMany.mockResolvedValueOnce([]);
    mockIncidentCount.mockResolvedValueOnce(0);

    await service.findAll({}, ACTOR_VIEWER);

    const callArg = mockIncidentFindMany.mock.calls[0]?.[0] as { where?: Record<string, unknown> };
    expect(callArg?.where?.['affectedDepartmentId']).toBeUndefined();
  });
});
