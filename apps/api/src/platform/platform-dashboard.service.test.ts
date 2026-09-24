import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformDashboardService } from './platform-dashboard.service';
import type { DatabaseService } from '../database/database.service';
import type { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';
import type { ContractDashboardService } from '../contracts/contract-dashboard.service';
import type { ContractErectionDashboardService } from '../contracts/contract-erection-dashboard.service';
import type { FactoryTasksService } from '../factory-tasks/factory-tasks.service';
import type { IncidentsService } from '../incidents/incidents.service';
import type { MaintenanceService } from '../maintenance/maintenance.service';
import type { SafetyService } from '../safety/safety.service';
import type { ProductionOrdersService } from '../production/production-orders.service';

function actor(permissions: string[]): AuthUser {
  return { id: 'user-1', displayName: 'Jane Manager', permissions } as AuthUser;
}

const mockWorkflowTaskCount = vi.fn();
const mockClient = { contractWorkflowTask: { count: mockWorkflowTaskCount } };
const mockDb = { getClient: () => mockClient } as unknown as DatabaseService;

const mockContractDashboardService = { getDashboard: vi.fn() } as unknown as ContractDashboardService;
const mockContractErectionDashboardService = { getDashboard: vi.fn() } as unknown as ContractErectionDashboardService;
const mockTasksService = { getDashboard: vi.fn() } as unknown as FactoryTasksService;
const mockIncidentsService = { getDashboard: vi.fn() } as unknown as IncidentsService;
const mockMaintenanceService = { getDashboard: vi.fn() } as unknown as MaintenanceService;
const mockSafetyService = { getDashboard: vi.fn() } as unknown as SafetyService;
const mockProductionOrdersService = { getDashboard: vi.fn() } as unknown as ProductionOrdersService;

describe('PlatformDashboardService', () => {
  let deptAccess: DepartmentAccessService;
  let service: PlatformDashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    deptAccess = { buildDeptFilter: vi.fn().mockResolvedValue(null) } as unknown as DepartmentAccessService;
    mockWorkflowTaskCount.mockResolvedValue(0);
    service = new PlatformDashboardService(
      mockDb,
      deptAccess,
      mockContractDashboardService,
      mockContractErectionDashboardService,
      mockTasksService,
      mockIncidentsService,
      mockMaintenanceService,
      mockSafetyService,
      mockProductionOrdersService,
    );
  });

  it('returns no cards for a user with no module permissions', async () => {
    const result = await service.getDashboard(actor([]));
    expect(result.cards).toEqual([]);
    expect(result.displayName).toBe('Jane Manager');
  });

  it('returns exactly the Task Management card for a tasks.read-only user, with honest metric mapping', async () => {
    (mockTasksService.getDashboard as ReturnType<typeof vi.fn>).mockResolvedValue({
      metrics: { openTasks: 9, assignedToMe: 4, overdueTasks: 2, blockedTasks: 1, completedThisMonth: 6, dueToday: 3, completedThisWeek: 5 },
    });

    const result = await service.getDashboard(actor(['tasks.read']));

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.code).toBe('FACTORY_TASKS');
    expect(result.cards[0]?.route).toBe('/factory-tasks/executive');
    expect(result.cards[0]?.metrics).toEqual([
      { label: 'Open', value: 4 },
      { label: 'Today', value: 3 },
      { label: 'Overdue', value: 2 },
      { label: 'Completed', value: 5 },
    ]);
  });

  it('builds the Contract Management, Technical, and Erection cards together for a contracts.read user', async () => {
    (mockContractDashboardService.getDashboard as ReturnType<typeof vi.fn>).mockResolvedValue({
      metrics: { totalDraft: 3, totalActive: 10, totalExpiring: 1, totalExpired: 2, totalTerminated: 0, totalClosed: 4, totalCancelled: 1 },
      manager: { summary: { outstandingPayments: 7 } },
    });
    (mockContractErectionDashboardService.getDashboard as ReturnType<typeof vi.fn>).mockResolvedValue({
      kpis: { totalErectionContracts: 5, methodStatementPending: 2, erectionInProgress: 1, checklistPending: 3 },
    });
    mockWorkflowTaskCount
      .mockResolvedValueOnce(4) // pendingDrawings
      .mockResolvedValueOnce(2) // sdCalculationPending
      .mockResolvedValueOnce(1) // approvalsPending
      .mockResolvedValueOnce(8); // completedTechnicalTasks

    const result = await service.getDashboard(actor(['contracts.read']));

    expect(result.cards.map((c) => c.code)).toEqual(['CONTRACTS_MANAGEMENT', 'TECHNICAL', 'ERECTION']);

    const contractCard = result.cards[0]!;
    expect(contractCard.metrics).toEqual([
      { label: 'Total', value: 21 }, // 3+10+1+2+0+4+1
      { label: 'Active', value: 10 },
      { label: 'Pending', value: 3 },
      { label: 'Outstanding', value: 7 },
    ]);

    const technicalCard = result.cards[1]!;
    expect(technicalCard.route).toBe('/contracts/technical');
    expect(technicalCard.metrics).toEqual([
      { label: 'Drawings', value: 4 },
      { label: 'SD / Calc.', value: 2 },
      { label: 'Approvals', value: 1 },
      { label: 'Completed', value: 8 },
    ]);

    const erectionCard = result.cards[2]!;
    expect(erectionCard.route).toBe('/contracts/erection-executive');
    expect(erectionCard.metrics).toEqual([
      { label: 'Contracts', value: 5 },
      { label: 'Method', value: 2 },
      { label: 'Progress', value: 1 },
      { label: 'Checklist', value: 3 },
    ]);
  });

  it('shows Outstanding Payments as not available (null) for a Contract Staff-tier viewer with no manager summary', async () => {
    (mockContractDashboardService.getDashboard as ReturnType<typeof vi.fn>).mockResolvedValue({
      metrics: { totalDraft: 0, totalActive: 2, totalExpiring: 0, totalExpired: 0, totalTerminated: 0, totalClosed: 0, totalCancelled: 0 },
      staff: { summary: { myOpenTasks: 1 } },
    });
    (mockContractErectionDashboardService.getDashboard as ReturnType<typeof vi.fn>).mockResolvedValue({
      kpis: { totalErectionContracts: 0, methodStatementPending: 0, erectionInProgress: 0, checklistPending: 0 },
    });

    const result = await service.getDashboard(actor(['contracts.read', 'contracts.workflow_update']));

    const contractCard = result.cards[0]!;
    expect(contractCard.metrics.find((m) => m.label === 'Outstanding')?.value).toBeNull(); // still 'Outstanding' — unchanged by FMP-UI-04C
  });

  it('combines real Safety metrics honestly (Open Safety Checks / Attention Required are sums of two real counts)', async () => {
    (mockSafetyService.getDashboard as ReturnType<typeof vi.fn>).mockResolvedValue({
      metrics: { scheduledInspections: 3, inProgressInspections: 2, openFindings: 5, criticalFindings: 1, overdueFindings: 4, completedInspections: 9 },
    });

    const result = await service.getDashboard(actor(['safety.read']));

    expect(result.cards[0]?.metrics).toEqual([
      { label: 'Checks', value: 5 },
      { label: 'Pending', value: 5 },
      { label: 'Inspections', value: 9 },
      { label: 'Attention', value: 5 },
    ]);
  });

  it('marks Production metrics with no real underlying data as not available (null), never a fabricated 0', async () => {
    (mockProductionOrdersService.getDashboard as ReturnType<typeof vi.fn>).mockResolvedValue({
      metrics: { scheduledOrders: 6, inProgressOrders: 2, pausedOrders: 1, completedThisMonth: 9 },
    });

    const result = await service.getDashboard(actor(['production.read']));

    expect(result.cards[0]?.metrics).toEqual([
      { label: 'Active Jobs', value: 2 },
      { label: 'Schedules', value: 6 },
      { label: 'Delayed', value: null },
      { label: 'Ready', value: null },
    ]);
  });

  it('maps Maintenance and Incident metrics from their real dashboard fields', async () => {
    (mockMaintenanceService.getDashboard as ReturnType<typeof vi.fn>).mockResolvedValue({
      metrics: { openRequests: 4, assignedToMe: 1, overdueRequests: 2, waitingForParts: 3, completedThisMonth: 5, inProgressRequests: 6 },
    });
    (mockIncidentsService.getDashboard as ReturnType<typeof vi.fn>).mockResolvedValue({
      metrics: { totalOpen: 7, criticalOpen: 2, underInvestigation: 3, resolvedThisMonth: 4, closedTotal: 11 },
    });

    const result = await service.getDashboard(actor(['maintenance.read', 'incidents.read']));

    const maintenanceCard = result.cards.find((c) => c.code === 'MAINTENANCE_REQUESTS')!;
    expect(maintenanceCard.metrics).toEqual([
      { label: 'Open', value: 4 },
      { label: 'Progress', value: 6 },
      { label: 'Parts', value: 3 },
      { label: 'Overdue', value: 2 },
    ]);

    const incidentCard = result.cards.find((c) => c.code === 'INCIDENT_REPORT')!;
    expect(incidentCard.metrics).toEqual([
      { label: 'Open', value: 7 },
      { label: 'Investigating', value: 3 },
      { label: 'Closed', value: 11 },
      { label: 'High', value: 2 },
    ]);
  });

  describe('QA/QC and Storage & Delivery placeholder modules (FMP-UI-10)', () => {
    it('does not include QA/QC or Storage & Delivery for a single-module viewer', async () => {
      (mockSafetyService.getDashboard as ReturnType<typeof vi.fn>).mockResolvedValue({
        metrics: { scheduledInspections: 0, inProgressInspections: 0, openFindings: 0, criticalFindings: 0, overdueFindings: 0, completedInspections: 0 },
      });

      const result = await service.getDashboard(actor(['safety.read']));

      expect(result.cards.map((c) => c.code)).toEqual(['SAFETY_COMPLIANCE']);
    });

    it('includes honest not-available QA/QC and Storage & Delivery cards for an Executive-Manager-shaped actor (all 6 operational read permissions)', async () => {
      (mockContractDashboardService.getDashboard as ReturnType<typeof vi.fn>).mockResolvedValue({
        metrics: { totalDraft: 0, totalActive: 0, totalExpiring: 0, totalExpired: 0, totalTerminated: 0, totalClosed: 0, totalCancelled: 0 },
        manager: { summary: { outstandingPayments: 0 } },
      });
      (mockContractErectionDashboardService.getDashboard as ReturnType<typeof vi.fn>).mockResolvedValue({
        kpis: { totalErectionContracts: 0, methodStatementPending: 0, erectionInProgress: 0, checklistPending: 0 },
      });
      (mockSafetyService.getDashboard as ReturnType<typeof vi.fn>).mockResolvedValue({ metrics: { scheduledInspections: 0, inProgressInspections: 0, openFindings: 0, criticalFindings: 0, overdueFindings: 0, completedInspections: 0 } });
      (mockIncidentsService.getDashboard as ReturnType<typeof vi.fn>).mockResolvedValue({ metrics: { totalOpen: 0, criticalOpen: 0, underInvestigation: 0, resolvedThisMonth: 0, closedTotal: 0 } });
      (mockProductionOrdersService.getDashboard as ReturnType<typeof vi.fn>).mockResolvedValue({ metrics: { scheduledOrders: 0, inProgressOrders: 0, pausedOrders: 0, completedThisMonth: 0 } });
      (mockMaintenanceService.getDashboard as ReturnType<typeof vi.fn>).mockResolvedValue({ metrics: { openRequests: 0, assignedToMe: 0, overdueRequests: 0, waitingForParts: 0, completedThisMonth: 0, inProgressRequests: 0 } });
      (mockTasksService.getDashboard as ReturnType<typeof vi.fn>).mockResolvedValue({ metrics: { openTasks: 0, assignedToMe: 0, overdueTasks: 0, blockedTasks: 0, completedThisMonth: 0, dueToday: 0, completedThisWeek: 0 } });

      const result = await service.getDashboard(
        actor(['contracts.read', 'safety.read', 'incidents.read', 'production.read', 'maintenance.read', 'tasks.read']),
      );

      expect(result.cards.map((c) => c.code)).toEqual([
        'CONTRACTS_MANAGEMENT', 'TECHNICAL', 'ERECTION', 'QA_QC', 'STORAGE_DELIVERY',
        'SAFETY_COMPLIANCE', 'INCIDENT_REPORT', 'PRODUCTION_DASHBOARD', 'MAINTENANCE_REQUESTS', 'FACTORY_TASKS',
      ]);

      const qaQcCard = result.cards.find((c) => c.code === 'QA_QC')!;
      expect(qaQcCard.route).toBe('/executive/qaqc');
      expect(qaQcCard.metrics).toEqual([
        { label: 'Inspections', value: null },
        { label: 'Pending Checks', value: null },
        { label: 'Approvals', value: null },
        { label: 'NCR / Issues', value: null },
      ]);

      const storageCard = result.cards.find((c) => c.code === 'STORAGE_DELIVERY')!;
      expect(storageCard.route).toBe('/executive/storage-delivery');
      expect(storageCard.metrics).toEqual([
        { label: 'Stored Items', value: null },
        { label: 'Ready to Dispatch', value: null },
        { label: 'Deliveries', value: null },
        { label: 'Pending', value: null },
      ]);
    });

    it('includes QA/QC and Storage & Delivery for an Admin-shaped actor even without all 6 operational read permissions', async () => {
      const result = await service.getDashboard(actor(['users.read']));

      expect(result.cards.map((c) => c.code)).toEqual(['QA_QC', 'STORAGE_DELIVERY']);
    });
  });
});
