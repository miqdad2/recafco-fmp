import { Injectable } from '@nestjs/common';
import { ModuleIdentifier, ContractStatus, ContractWorkflowTaskStatus } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import { ContractDashboardService } from '../contracts/contract-dashboard.service';
import { ContractErectionDashboardService } from '../contracts/contract-erection-dashboard.service';
import { FactoryTasksService } from '../factory-tasks/factory-tasks.service';
import { IncidentsService } from '../incidents/incidents.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { SafetyService } from '../safety/safety.service';
import { ProductionOrdersService } from '../production/production-orders.service';
import type { AuthUser } from '../common/types/auth-user';

// ---------------------------------------------------------------------------
// FMP-UI-01 — Executive Platform Dashboard. Deliberately NO new table and NO
// new business logic: every card below is built from the SAME per-module
// dashboard services already used by each module's own /dashboard page
// (audited before adding this endpoint — see the unit's own progress-tracker
// entry). Access is decided per-card from the actor's real permissions, the
// same permission codes each module's own controller already enforces
// (contracts.read, safety.read, incidents.read, production.read,
// maintenance.read, tasks.read) — never a role code, and never a new
// permission. Cards for modules the actor cannot read are simply omitted,
// never rendered with restricted/fake data.
//
// Technical and Erection are sub-views of Contract Management, not separate
// permissions — both gated by contracts.read, matching how the existing
// sidebar already gates the Erection Dashboard link (module-visibility.ts's
// CONTRACTS_MANAGEMENT gate). Erection's 4 metrics reuse
// ContractErectionDashboardService.getDashboard() (CM-71B) as-is. Technical
// has no existing dashboard service — its 4 metrics are new, additive counts
// over the already-real TECHNICAL-team ContractWorkflowTask rows
// (contract-workflow-templates.ts), scoped with the same
// DepartmentAccessService pattern every other contracts dashboard uses.
// ---------------------------------------------------------------------------

export interface PlatformMetric {
  label: string;
  /** null when the metric cannot be honestly computed yet — the frontend renders "Not available", never a fabricated 0. */
  value: number | null;
}

export interface PlatformModuleCard {
  code:
    | 'CONTRACTS_MANAGEMENT' | 'TECHNICAL' | 'ERECTION'
    | 'QA_QC' | 'STORAGE_DELIVERY'
    | 'SAFETY_COMPLIANCE' | 'INCIDENT_REPORT' | 'PRODUCTION_DASHBOARD' | 'MAINTENANCE_REQUESTS' | 'FACTORY_TASKS';
  title: string;
  description: string;
  route: string;
  metrics: PlatformMetric[];
}

export interface PlatformDashboardResult {
  displayName: string;
  cards: PlatformModuleCard[];
}

function metric(label: string, value: number | null): PlatformMetric {
  return { label, value };
}

// FMP-UI-10 — QA/QC and Storage & Delivery are placeholder modules: no real
// backend module exists yet, so there is no dedicated `qaqc.read`/
// `storage.read` permission to gate them on (inventing one now would mean
// seeding a permission nobody's role actually needs yet, ahead of the real
// module). Per this unit's own explicit instruction, visibility instead
// mirrors "Executive Manager or Admin/Super Admin" — the exact same shape
// apps/web's `isExecutiveManagerAccess()`/`canSeeModule(..., 'ADMINISTRATION')`
// already use, duplicated here as literal permission-code arrays because the
// API and web packages don't share a permission-utils module. Replace this
// with a real dedicated permission check once the QA/QC and Storage &
// Delivery modules are actually built — do not let this become the
// permanent access rule for real module data.
const ALL_OPERATIONAL_READ_PERMISSIONS = [
  'contracts.read', 'safety.read', 'incidents.read', 'production.read', 'maintenance.read', 'tasks.read',
];
const ADMINISTRATION_GATE_PERMISSIONS = [
  'users.read', 'roles.read', 'org.departments.read', 'org.plants.read', 'org.locations.read',
];

function isExecutiveManagerOrAdminAccess(permissions: string[]): boolean {
  const isAdmin = ADMINISTRATION_GATE_PERMISSIONS.some((p) => permissions.includes(p));
  const isExecutiveManager = ALL_OPERATIONAL_READ_PERMISSIONS.every((p) => permissions.includes(p));
  return isAdmin || isExecutiveManager;
}

function buildQaQcCard(): PlatformModuleCard {
  return {
    code: 'QA_QC',
    // FMP-UI-10C — renamed from "QA/QC" everywhere user-facing; the internal
    // code/route are unchanged (this unit's own instruction: routes stay as
    // technical slugs, only labels change).
    title: 'Quality Assurance & Control',
    description: 'Quality checks, inspections, and approvals.',
    route: '/executive/qaqc',
    // Module not built yet — every figure is honestly "Not available" (null), never a fabricated 0.
    metrics: [
      metric('Inspections', null),
      metric('Pending Checks', null),
      metric('Approvals', null),
      metric('NCR / Issues', null),
    ],
  };
}

function buildStorageDeliveryCard(): PlatformModuleCard {
  return {
    code: 'STORAGE_DELIVERY',
    // FMP-UI-10C — renamed from "Storage & Delivery" everywhere user-facing;
    // the internal code/route are unchanged.
    title: 'Storage Yard & Delivery',
    description: 'Storage status, dispatch, and delivery readiness.',
    route: '/executive/storage-delivery',
    // Module not built yet — every figure is honestly "Not available" (null), never a fabricated 0.
    metrics: [
      metric('Stored Items', null),
      metric('Ready to Dispatch', null),
      metric('Deliveries', null),
      metric('Pending', null),
    ],
  };
}

function sumContractStatusCounts(m: {
  totalDraft: number;
  totalActive: number;
  totalExpiring: number;
  totalExpired: number;
  totalTerminated: number;
  totalClosed: number;
  totalCancelled: number;
}): number {
  return m.totalDraft + m.totalActive + m.totalExpiring + m.totalExpired + m.totalTerminated + m.totalClosed + m.totalCancelled;
}

@Injectable()
export class PlatformDashboardService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
    private readonly contractDashboardService: ContractDashboardService,
    private readonly contractErectionDashboardService: ContractErectionDashboardService,
    private readonly tasksService: FactoryTasksService,
    private readonly incidentsService: IncidentsService,
    private readonly maintenanceService: MaintenanceService,
    private readonly safetyService: SafetyService,
    private readonly productionOrdersService: ProductionOrdersService,
  ) {}

  async getDashboard(actor: AuthUser): Promise<PlatformDashboardResult> {
    const cards: PlatformModuleCard[] = [];

    // Fixed order per FMP-UI-01 (extended in FMP-UI-10): Contract Management,
    // Technical, Erection, QA/QC, Storage & Delivery, Safety & Compliance,
    // Incident Report, Production Planning, Maintenance Management, Task
    // Management.
    if (actor.permissions.includes('contracts.read')) {
      const [contractCard, technicalCard, erectionCard] = await Promise.all([
        this.buildContractManagementCard(actor),
        this.buildTechnicalCard(actor),
        this.buildErectionCard(actor),
      ]);
      cards.push(contractCard, technicalCard, erectionCard);
    }
    // FMP-UI-10 — placeholder modules, gated on "Executive Manager or Admin"
    // rather than a per-module read permission — see isExecutiveManagerOrAdminAccess's own doc comment for why.
    if (isExecutiveManagerOrAdminAccess(actor.permissions)) {
      cards.push(buildQaQcCard(), buildStorageDeliveryCard());
    }
    if (actor.permissions.includes('safety.read')) {
      cards.push(await this.buildSafetyCard(actor));
    }
    if (actor.permissions.includes('incidents.read')) {
      cards.push(await this.buildIncidentCard(actor));
    }
    if (actor.permissions.includes('production.read')) {
      cards.push(await this.buildProductionCard(actor));
    }
    if (actor.permissions.includes('maintenance.read')) {
      cards.push(await this.buildMaintenanceCard(actor));
    }
    if (actor.permissions.includes('tasks.read')) {
      cards.push(await this.buildTaskCard(actor));
    }

    return { displayName: actor.displayName, cards };
  }

  private async buildContractManagementCard(actor: AuthUser): Promise<PlatformModuleCard> {
    const dashboard = await this.contractDashboardService.getDashboard(actor);
    // Outstanding Payments is only computed for the MANAGER-tier dashboard
    // (contracts.update or contracts.close) — a Contract Staff-tier viewer
    // (contracts.workflow_update only) never gets this figure computed, so it
    // is honestly "Not available" for them rather than guessed at.
    const outstandingPayments = dashboard.manager?.summary.outstandingPayments ?? null;

    return {
      code: 'CONTRACTS_MANAGEMENT',
      title: 'Contract Management',
      // FMP-UI-04C — shortened again (see progress-tracker.md for the earlier, longer versions) so a 4-per-row card never truncates.
      description: 'Contracts, payments, approvals.',
      // FMP-UI-07 — points to the new Executive Module Landing Page, not the
      // full Manager/Staff dashboard (still at /contracts/dashboard, reached
      // via this landing page's "View Contract List" / details flow).
      route: '/contracts/executive',
      metrics: [
        metric('Total', sumContractStatusCounts(dashboard.metrics)),
        metric('Active', dashboard.metrics.totalActive),
        metric('Pending', dashboard.metrics.totalDraft),
        metric('Outstanding', outstandingPayments),
      ],
    };
  }

  private async buildTechnicalCard(actor: AuthUser): Promise<PlatformModuleCard> {
    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT);
    const contractWhere = {
      status: { not: ContractStatus.CANCELLED },
      ...(deptFilter !== null ? { departmentId: deptFilter } : {}),
    };

    const [pendingDrawings, sdCalculationPending, approvalsPending, completedTechnicalTasks] = await Promise.all([
      this.db.getClient().contractWorkflowTask.count({
        where: {
          team: 'TECHNICAL', taskKey: 'technical_drawing_received',
          status: { not: ContractWorkflowTaskStatus.COMPLETED }, contract: contractWhere,
        },
      }),
      this.db.getClient().contractWorkflowTask.count({
        where: {
          team: 'TECHNICAL', taskKey: 'technical_sd_calculation_submission',
          status: { not: ContractWorkflowTaskStatus.COMPLETED }, contract: contractWhere,
        },
      }),
      this.db.getClient().contractWorkflowTask.count({
        where: {
          team: 'TECHNICAL', taskKey: 'technical_getting_approval',
          status: { not: ContractWorkflowTaskStatus.COMPLETED }, contract: contractWhere,
        },
      }),
      this.db.getClient().contractWorkflowTask.count({
        where: { team: 'TECHNICAL', status: ContractWorkflowTaskStatus.COMPLETED, contract: contractWhere },
      }),
    ]);

    return {
      code: 'TECHNICAL',
      title: 'Technical',
      description: 'Drawings and approvals.',
      route: '/contracts/technical',
      metrics: [
        metric('Drawings', pendingDrawings),
        metric('SD / Calc.', sdCalculationPending),
        metric('Approvals', approvalsPending),
        metric('Completed', completedTechnicalTasks),
      ],
    };
  }

  private async buildErectionCard(actor: AuthUser): Promise<PlatformModuleCard> {
    const { kpis } = await this.contractErectionDashboardService.getDashboard(actor);

    return {
      code: 'ERECTION',
      title: 'Erection',
      description: 'Schedules and site workflow.',
      // FMP-UI-07 — new Executive Module Landing Page; the full Erection
      // Manager Dashboard (work queue tables etc.) is untouched at its own
      // route, /contracts/erection-dashboard.
      route: '/contracts/erection-executive',
      metrics: [
        metric('Contracts', kpis.totalErectionContracts),
        metric('Method', kpis.methodStatementPending),
        metric('Progress', kpis.erectionInProgress),
        metric('Checklist', kpis.checklistPending),
      ],
    };
  }

  private async buildSafetyCard(actor: AuthUser): Promise<PlatformModuleCard> {
    const { metrics: m } = await this.safetyService.getDashboard(actor);

    return {
      code: 'SAFETY_COMPLIANCE',
      title: 'Safety & Compliance',
      description: 'Inspections and findings.',
      route: '/safety-compliance/executive', // FMP-UI-07 — Executive Module Landing Page; full dashboard unchanged at /safety-compliance/dashboard.
      metrics: [
        metric('Checks', m.scheduledInspections + m.inProgressInspections),
        metric('Pending', m.openFindings),
        metric('Inspections', m.completedInspections),
        metric('Attention', m.criticalFindings + m.overdueFindings),
      ],
    };
  }

  private async buildIncidentCard(actor: AuthUser): Promise<PlatformModuleCard> {
    const { metrics: m } = await this.incidentsService.getDashboard(actor);

    return {
      code: 'INCIDENT_REPORT',
      title: 'Incident Report',
      description: 'Incidents and closure.',
      route: '/incidents/executive', // FMP-UI-07 — Executive Module Landing Page; full dashboard unchanged at /incidents/dashboard.
      metrics: [
        metric('Open', m.totalOpen),
        metric('Investigating', m.underInvestigation),
        metric('Closed', m.closedTotal),
        metric('High', m.criticalOpen),
      ],
    };
  }

  private async buildProductionCard(actor: AuthUser): Promise<PlatformModuleCard> {
    const { metrics: m } = await this.productionOrdersService.getDashboard(actor);

    return {
      code: 'PRODUCTION_DASHBOARD',
      title: 'Production Planning',
      description: 'Production and readiness.',
      route: '/production/executive', // FMP-UI-07 — Executive Module Landing Page; full dashboard unchanged at /production/dashboard.
      metrics: [
        metric('Active Jobs', m.inProgressOrders),
        metric('Schedules', m.scheduledOrders),
        // No "delayed"/"ready for delivery" order state exists yet in the
        // production data model (ProductionOrderStatus has no such value) —
        // honestly "Not available" rather than a fabricated count.
        metric('Delayed', null),
        metric('Ready', null),
      ],
    };
  }

  private async buildMaintenanceCard(actor: AuthUser): Promise<PlatformModuleCard> {
    const { metrics: m } = await this.maintenanceService.getDashboard(actor);

    return {
      code: 'MAINTENANCE_REQUESTS',
      title: 'Maintenance Management',
      description: 'Work orders and parts.',
      route: '/maintenance/executive', // FMP-UI-07 — Executive Module Landing Page; full dashboard unchanged at /maintenance/dashboard.
      metrics: [
        metric('Open', m.openRequests),
        metric('Progress', m.inProgressRequests),
        metric('Parts', m.waitingForParts),
        metric('Overdue', m.overdueRequests),
      ],
    };
  }

  private async buildTaskCard(actor: AuthUser): Promise<PlatformModuleCard> {
    const { metrics: m } = await this.tasksService.getDashboard(actor);

    return {
      code: 'FACTORY_TASKS',
      title: 'Task Management',
      description: 'Tasks and due work.',
      route: '/factory-tasks/executive', // FMP-UI-07 — Executive Module Landing Page; full dashboard unchanged at /factory-tasks/dashboard.
      metrics: [
        metric('Open', m.assignedToMe),
        metric('Today', m.dueToday),
        metric('Overdue', m.overdueTasks),
        metric('Completed', m.completedThisWeek),
      ],
    };
  }
}
