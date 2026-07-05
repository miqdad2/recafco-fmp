import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DepartmentAccessScope } from '@recafco/database';
import { IncidentsService } from './incidents.service';
import type { DatabaseService } from '../database/database.service';
import type { IncidentsRefService } from './incidents-ref.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';

// ---------------------------------------------------------------------------
// Mock infrastructure
// ---------------------------------------------------------------------------

const mockIncidentFindMany = vi.fn();
const mockIncidentCount = vi.fn();
const mockDepartmentFindMany = vi.fn();
const mockGetScope = vi.fn();
const mockTransaction = vi.fn();

const mockClient = {
  incident: {
    findMany: mockIncidentFindMany,
    count: mockIncidentCount,
  },
  department: { findMany: mockDepartmentFindMany },
  $transaction: mockTransaction,
};

const mockDb = { getClient: vi.fn(() => mockClient) } as unknown as DatabaseService;
const mockRef = { nextRef: vi.fn().mockResolvedValue('INC-2026-000001') } as unknown as IncidentsRefService;

const mockDeptAccess = {
  buildDeptFilter: vi.fn().mockResolvedValue(null),
  getScope: mockGetScope,
  canAccessDepartment: vi.fn().mockResolvedValue(true),
  assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined),
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
  departmentId: null,
  permissions: ['incidents.read'],
};

let service: IncidentsService;

beforeEach(() => {
  vi.clearAllMocks();
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
});
