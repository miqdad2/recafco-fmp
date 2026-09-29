import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DepartmentAccessScope, ModuleIdentifier, IncidentSeverity } from '@recafco/database';
import type { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentsService } from './incidents.service';
import type { DatabaseService } from '../database/database.service';
import type { IncidentsRefService } from './incidents-ref.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { IncidentAttachmentStorageService } from './incident-attachment-storage.service';

// ---------------------------------------------------------------------------
// Mock infrastructure
// ---------------------------------------------------------------------------

const mockIncidentFindUnique = vi.fn();
const mockIncidentFindMany = vi.fn();
const mockIncidentCount = vi.fn();
const mockIncidentCreate = vi.fn();
const mockDepartmentFindMany = vi.fn();
const mockPlantFindMany = vi.fn();
const mockLocationFindMany = vi.fn();
const mockGetScope = vi.fn();
const mockBuildDeptFilter = vi.fn();
const mockAssertCanAccessDept = vi.fn();
const mockTransaction = vi.fn();
const mockAttachmentFindMany = vi.fn();
const mockAttachmentCreate = vi.fn();
const mockAttachmentFindFirst = vi.fn();
const mockAttachmentDelete = vi.fn();
const mockActivityCreate = vi.fn();

const mockClient = {
  incident: {
    findUnique: mockIncidentFindUnique,
    findMany: mockIncidentFindMany,
    count: mockIncidentCount,
    create: mockIncidentCreate,
  },
  incidentAttachment: {
    findMany: mockAttachmentFindMany,
    create: mockAttachmentCreate,
    findFirst: mockAttachmentFindFirst,
    delete: mockAttachmentDelete,
  },
  incidentActivity: { create: mockActivityCreate },
  department: { findMany: mockDepartmentFindMany },
  plant: { findMany: mockPlantFindMany },
  location: { findMany: mockLocationFindMany },
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

const mockAttachmentSave = vi.fn().mockResolvedValue({ fileName: 'abc.jpg', storagePath: 'inc-001/abc.jpg' });
const mockAttachmentDeleteFile = vi.fn().mockResolvedValue(undefined);
const mockAttachmentStorage = {
  save: mockAttachmentSave,
  deleteFile: mockAttachmentDeleteFile,
  createReadStream: vi.fn(),
} as unknown as IncidentAttachmentStorageService;

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

const ACTOR_REPORTER: AuthUser = {
  ...ACTOR_VIEWER,
  id: 'user-reporter',
  username: 'bob',
  displayName: 'Bob',
  permissions: ['incidents.read', 'incidents.create'],
};

const ACTOR_MANAGER: AuthUser = {
  ...ACTOR_VIEWER,
  id: 'user-manager',
  username: 'mia',
  displayName: 'Mia',
  permissions: ['incidents.read', 'incidents.create', 'incidents.manage'],
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
  mockTransaction.mockImplementation(async (cb: (tx: typeof mockClient) => unknown) => cb(mockClient)); // default: $transaction runs its callback against mockClient directly, matching every real usage's shape
  service = new IncidentsService(mockDb, mockRef, mockDeptAccess, mockAttachmentStorage);
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
      .mockResolvedValueOnce(7)  // resolvedThisMonth
      .mockResolvedValueOnce(9); // closedTotal
    mockIncidentFindMany.mockResolvedValueOnce([
      { id: 'inc-r1', referenceNumber: 'INC-001', title: 'Chemical Spill', severity: 'HIGH', status: 'SUBMITTED', updatedAt: new Date('2026-07-01T10:00:00Z'), createdAt: new Date('2026-07-01T09:00:00Z') },
    ]).mockResolvedValueOnce([
      { id: 'inc-r1', referenceNumber: 'INC-001', title: 'Chemical Spill', severity: 'CRITICAL', status: 'SUBMITTED', createdAt: new Date('2026-07-01T09:00:00Z') },
    ]);

    const result = await service.getDashboard(ACTOR_VIEWER);

    expect(result.scope.type).toBe(DepartmentAccessScope.ALL_DEPARTMENTS);
    expect(result.scope.departmentNames).toEqual([]);
    expect(result.metrics.totalOpen).toBe(15);
    expect(result.metrics.criticalOpen).toBe(4);
    expect(result.metrics.underInvestigation).toBe(3);
    expect(result.metrics.resolvedThisMonth).toBe(7);
    expect(result.metrics.closedTotal).toBe(9);
    expect(result.recent).toHaveLength(1);
    expect(result.recent[0]?.referenceNumber).toBe('INC-001');
    expect(result.recent[0]?.severity).toBe('HIGH');
    expect(result.recent[0]?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.recent[0]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.needsAttention).toHaveLength(1);
    expect(result.needsAttention[0]?.referenceNumber).toBe('INC-001');
    expect(result.needsAttention[0]?.severity).toBe('CRITICAL');
  });

  it('applies dept filter to getDashboard queries when scope is OWN_DEPARTMENT', async () => {
    mockGetScope.mockResolvedValueOnce(DepartmentAccessScope.OWN_DEPARTMENT);
    mockBuildDeptFilter.mockResolvedValueOnce({ in: ['dept-a'] });
    mockDepartmentFindMany.mockResolvedValueOnce([{ name: 'Department A' }]);
    mockIncidentCount
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    mockIncidentFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.getDashboard(ACTOR_VIEWER);

    expect(result.scope.type).toBe(DepartmentAccessScope.OWN_DEPARTMENT);
    expect(result.scope.departmentNames).toEqual(['Department A']);
    expect(result.needsAttention).toEqual([]);
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

// ---------------------------------------------------------------------------
// listDepartments / listPlants / listLocations (FMP-UI-22)
// ---------------------------------------------------------------------------

describe('IncidentsService.listDepartments', () => {
  it('returns only active departments, ordered by name', async () => {
    mockDepartmentFindMany.mockResolvedValueOnce([{ id: 'dept-1', name: 'Engineering', code: 'ENG-01' }]);

    const result = await service.listDepartments();

    expect(result).toEqual([{ id: 'dept-1', name: 'Engineering', code: 'ENG-01' }]);
    const call = mockDepartmentFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(call.where).toEqual({ isActive: true });
  });
});

describe('IncidentsService.listPlants', () => {
  it('returns only active plants, ordered by name', async () => {
    mockPlantFindMany.mockResolvedValueOnce([{ id: 'plant-1', name: 'Main Plant', code: 'PLT1' }]);

    const result = await service.listPlants();

    expect(result).toEqual([{ id: 'plant-1', name: 'Main Plant', code: 'PLT1' }]);
    const call = mockPlantFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(call.where).toEqual({ isActive: true });
  });
});

describe('IncidentsService.listLocations', () => {
  it('returns only active locations, ordered by name', async () => {
    mockLocationFindMany.mockResolvedValueOnce([{ id: 'loc-1', name: 'Warehouse A', code: 'WH-A' }]);

    const result = await service.listLocations();

    expect(result).toEqual([{ id: 'loc-1', name: 'Warehouse A', code: 'WH-A' }]);
    const call = mockLocationFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(call.where).toEqual({ isActive: true });
  });
});

// ---------------------------------------------------------------------------
// Evidence Attachments (FMP-INC-01)
// ---------------------------------------------------------------------------

const SAMPLE_FILE = { buffer: Buffer.from('fake'), originalname: 'photo.jpg', mimetype: 'image/jpeg', size: 1024 };

describe('IncidentsService.listAttachments', () => {
  it('returns attachments for an accessible incident', async () => {
    mockIncidentFindUnique.mockResolvedValueOnce(BASE_INCIDENT);
    mockAttachmentFindMany.mockResolvedValueOnce([{ id: 'att-1', originalFileName: 'photo.jpg' }]);

    const result = await service.listAttachments('inc-001', ACTOR_VIEWER);

    expect(result).toEqual([{ id: 'att-1', originalFileName: 'photo.jpg' }]);
    expect(mockAttachmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { incidentId: 'inc-001' } }),
    );
  });

  it('throws NotFoundException when the incident does not exist', async () => {
    mockIncidentFindUnique.mockResolvedValueOnce(null);
    await expect(service.listAttachments('missing', ACTOR_VIEWER)).rejects.toThrow(NotFoundException);
  });
});

describe('IncidentsService.createAttachment', () => {
  it('rejects when the actor lacks incidents.create', async () => {
    await expect(service.createAttachment('inc-001', SAMPLE_FILE, ACTOR_VIEWER)).rejects.toThrow(ForbiddenException);
    expect(mockAttachmentSave).not.toHaveBeenCalled();
  });

  it('rejects an unsupported MIME type', async () => {
    mockIncidentFindUnique.mockResolvedValueOnce(BASE_INCIDENT);
    const badFile = { ...SAMPLE_FILE, mimetype: 'application/x-msdownload' };
    await expect(service.createAttachment('inc-001', badFile, ACTOR_REPORTER)).rejects.toThrow('Unsupported file type');
  });

  it('rejects a file over the size limit', async () => {
    mockIncidentFindUnique.mockResolvedValueOnce(BASE_INCIDENT);
    const bigFile = { ...SAMPLE_FILE, size: 26 * 1024 * 1024 };
    await expect(service.createAttachment('inc-001', bigFile, ACTOR_REPORTER)).rejects.toThrow('exceeds');
  });

  it('saves the file, creates the DB row, and logs EVIDENCE_UPLOADED', async () => {
    mockIncidentFindUnique.mockResolvedValueOnce(BASE_INCIDENT);
    mockAttachmentCreate.mockResolvedValueOnce({ id: 'att-1', originalFileName: 'photo.jpg' });

    const result = await service.createAttachment('inc-001', SAMPLE_FILE, ACTOR_REPORTER);

    expect(result).toEqual({ id: 'att-1', originalFileName: 'photo.jpg' });
    expect(mockAttachmentSave).toHaveBeenCalledWith('inc-001', SAMPLE_FILE.buffer, 'photo.jpg');
    expect(mockAttachmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          incidentId: 'inc-001',
          uploadedByUserId: ACTOR_REPORTER.id,
          mimeType: 'image/jpeg',
          fileSize: 1024,
        }),
      }),
    );
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'EVIDENCE_UPLOADED' }) }),
    );
  });
});

describe('IncidentsService.getAttachmentForDownload', () => {
  it('returns storage details for an existing attachment', async () => {
    mockIncidentFindUnique.mockResolvedValueOnce(BASE_INCIDENT);
    mockAttachmentFindFirst.mockResolvedValueOnce({ storagePath: 'inc-001/x.jpg', originalFileName: 'photo.jpg', mimeType: 'image/jpeg' });

    const result = await service.getAttachmentForDownload('inc-001', 'att-1', ACTOR_VIEWER);

    expect(result).toEqual({ storagePath: 'inc-001/x.jpg', originalFileName: 'photo.jpg', mimeType: 'image/jpeg' });
  });

  it('throws NotFoundException when the attachment does not exist', async () => {
    mockIncidentFindUnique.mockResolvedValueOnce(BASE_INCIDENT);
    mockAttachmentFindFirst.mockResolvedValueOnce(null);
    await expect(service.getAttachmentForDownload('inc-001', 'missing', ACTOR_VIEWER)).rejects.toThrow(NotFoundException);
  });
});

describe('IncidentsService.deleteAttachment', () => {
  it('rejects when the actor lacks incidents.create', async () => {
    await expect(service.deleteAttachment('inc-001', 'att-1', ACTOR_VIEWER)).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when the attachment does not exist', async () => {
    mockIncidentFindUnique.mockResolvedValueOnce(BASE_INCIDENT);
    mockAttachmentFindFirst.mockResolvedValueOnce(null);
    await expect(service.deleteAttachment('inc-001', 'missing', ACTOR_REPORTER)).rejects.toThrow(NotFoundException);
  });

  it('rejects deleting someone else\'s attachment without incidents.manage', async () => {
    mockIncidentFindUnique.mockResolvedValueOnce(BASE_INCIDENT);
    mockAttachmentFindFirst.mockResolvedValueOnce({ id: 'att-1', storagePath: 'inc-001/x.jpg', originalFileName: 'photo.jpg', uploadedByUserId: 'someone-else' });
    await expect(service.deleteAttachment('inc-001', 'att-1', ACTOR_REPORTER)).rejects.toThrow(ForbiddenException);
    expect(mockAttachmentDelete).not.toHaveBeenCalled();
  });

  it('allows the uploader to delete their own attachment', async () => {
    mockIncidentFindUnique.mockResolvedValueOnce(BASE_INCIDENT);
    mockAttachmentFindFirst.mockResolvedValueOnce({ id: 'att-1', storagePath: 'inc-001/x.jpg', originalFileName: 'photo.jpg', uploadedByUserId: ACTOR_REPORTER.id });

    await service.deleteAttachment('inc-001', 'att-1', ACTOR_REPORTER);

    expect(mockAttachmentDelete).toHaveBeenCalledWith({ where: { id: 'att-1' } });
    expect(mockAttachmentDeleteFile).toHaveBeenCalledWith('inc-001/x.jpg');
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ event: 'EVIDENCE_REMOVED' }) }),
    );
  });

  it('allows a manager to delete an attachment they did not upload', async () => {
    mockIncidentFindUnique.mockResolvedValueOnce(BASE_INCIDENT);
    mockAttachmentFindFirst.mockResolvedValueOnce({ id: 'att-1', storagePath: 'inc-001/x.jpg', originalFileName: 'photo.jpg', uploadedByUserId: 'someone-else' });

    await service.deleteAttachment('inc-001', 'att-1', ACTOR_MANAGER);

    expect(mockAttachmentDelete).toHaveBeenCalledWith({ where: { id: 'att-1' } });
  });
});

// ---------------------------------------------------------------------------
// create — occurredAt future-date validation (FMP-INC-01D)
// ---------------------------------------------------------------------------

describe('IncidentsService.create — occurredAt validation', () => {
  const baseDto: CreateIncidentDto = {
    title: 'Forklift near miss',
    description: 'A forklift nearly collided with a pedestrian near bay 3.',
    severity: IncidentSeverity.MEDIUM,
    occurredAt: '',
  };

  it('succeeds for a past occurrence date', async () => {
    mockIncidentCreate.mockResolvedValueOnce({ ...BASE_INCIDENT, id: 'inc-past' });
    const dto = { ...baseDto, occurredAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() }; // 1 hour ago

    const result = await service.create(dto, ACTOR_REPORTER);

    expect(result).toEqual(expect.objectContaining({ id: 'inc-past' }));
    expect(mockIncidentCreate).toHaveBeenCalled();
  });

  it('succeeds for a near-current occurrence date inside the 1-minute clock-skew tolerance', async () => {
    mockIncidentCreate.mockResolvedValueOnce({ ...BASE_INCIDENT, id: 'inc-now' });
    const dto = { ...baseDto, occurredAt: new Date(Date.now() + 30_000).toISOString() }; // 30s ahead — inside tolerance

    const result = await service.create(dto, ACTOR_REPORTER);

    expect(result).toEqual(expect.objectContaining({ id: 'inc-now' }));
  });

  it('rejects an occurrence date clearly in the future with INCIDENT_OCCURRED_IN_FUTURE and never reaches the transaction', async () => {
    const dto = { ...baseDto, occurredAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() }; // 2 days ahead

    await expect(service.create(dto, ACTOR_REPORTER)).rejects.toThrow(UnprocessableEntityException);
    expect(mockIncidentCreate).not.toHaveBeenCalled();
  });

  it('future-date rejection carries the exact code/message the frontend maps to a user-friendly error', async () => {
    const dto = { ...baseDto, occurredAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() };

    try {
      await service.create(dto, ACTOR_REPORTER);
      expect.fail('expected service.create() to throw for a future occurredAt');
    } catch (err) {
      expect(err).toBeInstanceOf(UnprocessableEntityException);
      const response = (err as UnprocessableEntityException).getResponse() as { code: string; message: string };
      expect(response.code).toBe('INCIDENT_OCCURRED_IN_FUTURE');
      expect(response.message).toBe('occurredAt cannot be in the future');
    }
  });

  it('correctly parses a UTC ISO occurredAt regardless of server timezone (no naive local-string comparison)', async () => {
    // A UTC-suffixed ISO string ("Z") parses to the same absolute instant
    // no matter what timezone the Node process itself runs in — this is
    // exactly why the frontend must send a real ISO string (via
    // `new Date(localValue).toISOString()`), never the raw
    // `datetime-local` input value, which has no timezone of its own.
    mockIncidentCreate.mockResolvedValueOnce({ ...BASE_INCIDENT, id: 'inc-utc' });
    const pastUtc = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(pastUtc.endsWith('Z')).toBe(true);

    const result = await service.create({ ...baseDto, occurredAt: pastUtc }, ACTOR_REPORTER);

    expect(result).toEqual(expect.objectContaining({ id: 'inc-utc' }));
  });
});
