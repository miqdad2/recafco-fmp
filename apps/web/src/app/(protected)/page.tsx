import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import {
  Activity,
  Database,
  Users,
  Building2,
  Factory,
  MapPin,
  Shield,
  Boxes,
  ClipboardList,
  AlertTriangle,
  AlertOctagon,
  Search,
  Wrench,
  ShieldCheck,
  FileText,
  CheckCircle2,
  Circle,
  Play,
  PauseCircle,
} from 'lucide-react';
import { authApi } from '@/lib/auth-api';
import { rolesApi } from '@/lib/roles-api';
import { usersApi } from '@/lib/users-api';
import { departments, plants, locations } from '@/lib/organizations-api';
import { incidentsApi } from '@/lib/incidents-api';
import type { IncidentDashboardData } from '@/lib/incidents-api';
import { tasksApi } from '@/lib/factory-tasks-api';
import type { TaskDashboardData } from '@/lib/factory-tasks-api';
import { maintenanceApi } from '@/lib/maintenance-api';
import type { MrDashboardData } from '@/lib/maintenance-api';
import { safetyApi } from '@/lib/safety-api';
import type { SafetyDashboardData } from '@/lib/safety-api';
import { contractsApi } from '@/lib/contracts-api';
import type { ContractDashboardData } from '@/lib/contracts-api';
import { productionApi } from '@/lib/production-api';
import type { ProductionDashboardData } from '@/lib/production-api';
import { MetricCard } from './_components/metric-card';
import type { MetricStatus } from './_components/metric-card';
import { ModuleCard } from './_components/module-card';

export const metadata: Metadata = { title: 'Dashboard — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

async function fetchApiStatus(): Promise<'online' | 'offline'> {
  try {
    const res = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
    return res.ok ? 'online' : 'offline';
  } catch {
    return 'offline';
  }
}

async function fetchDbStatus(): Promise<'ok' | 'unavailable' | 'offline'> {
  try {
    const res = await fetch(`${API_BASE}/ready`, { cache: 'no-store' });
    if (!res.ok) return 'unavailable';
    const body = (await res.json()) as {
      data?: { checks?: { database?: string } };
    };
    return body.data?.checks?.database === 'ok' ? 'ok' : 'unavailable';
  } catch {
    return 'offline';
  }
}

const PROGRESS_STEPS = [
  { label: 'Foundation', detail: 'Monorepo, PostgreSQL, Prisma, environment', done: true },
  { label: 'Authentication', detail: 'Session tokens, refresh, change-password flow', done: true },
  { label: 'RBAC', detail: 'Roles, permissions, permission-aware guards', done: true },
  { label: 'Application Shell', detail: 'Navigation, dashboard, module landing pages', done: true },
  { label: 'Factory Tasks Management', detail: 'Full lifecycle: Draft → Open → Assigned → In Progress → Completed → Closed', done: true },
  { label: 'Incident Report', detail: 'Incident reporting, investigation workflow, corrective actions', done: true },
  { label: 'Maintenance Requests', detail: 'Full 11-status lifecycle: Draft → Submitted → Approved → Assigned → In Progress → Completed → Closed', done: true },
  { label: 'Safety & Compliance', detail: 'Safety inspections with findings, verification, and compliance lifecycle', done: true },
  { label: 'Contracts Management', detail: 'Contract lifecycle: Draft → Active → Terminated/Closed with derived EXPIRING/EXPIRED states', done: true },
  { label: 'Production Dashboard', detail: 'Production orders and lines: Output, Downtime, and Adjustment entries with live KPI metrics', done: true },
  { label: 'Platform Hardening', detail: 'Security regression tests, PM2 deployment config, release documentation', done: true },
];

const MODULE_CARDS = [
  {
    title: 'Factory Tasks Management',
    description: 'Assign, track, and complete recurring operational tasks across the factory floor.',
    href: '/factory-tasks/dashboard',
    icon: ClipboardList,
    phase: 'Phase 4',
    status: 'available' as const,
    readPermission: 'tasks.read',
  },
  {
    title: 'Incident Report',
    description: 'Report and manage incidents, near-misses, and corrective actions.',
    href: '/incidents/dashboard',
    icon: AlertTriangle,
    phase: 'Phase 5',
    status: 'available' as const,
    readPermission: 'incidents.read',
  },
  {
    title: 'Maintenance Requests',
    description: 'Submit and track maintenance requests through the full review and repair lifecycle.',
    href: '/maintenance/dashboard',
    icon: Wrench,
    phase: 'Phase 6',
    status: 'available' as const,
    readPermission: 'maintenance.read',
  },
  {
    title: 'Safety & Compliance',
    description: 'Safety inspections, findings tracking, and compliance lifecycle management.',
    href: '/safety-compliance/dashboard',
    icon: ShieldCheck,
    phase: 'Phase 7',
    status: 'available' as const,
    readPermission: 'safety.read',
  },
  {
    title: 'Contracts Management',
    description: 'Vendor contract register with lifecycle tracking and approval workflow.',
    href: '/contracts/dashboard',
    icon: FileText,
    phase: 'Phase 8',
    status: 'available' as const,
    readPermission: 'contracts.read',
  },
  {
    title: 'Production Dashboard',
    description: 'Production orders and lines: Output, Downtime, and Adjustment entries with live KPI metrics.',
    href: '/production/dashboard',
    icon: Factory,
    phase: 'Phase 9',
    status: 'available' as const,
    readPermission: 'production.read',
  },
];

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  // Resolve user profile + permissions (sequential — needed before parallel fetch)
  const meResult = await authApi.me(accessToken);
  let displayName = 'there';
  let permissions: string[] = [];

  if (meResult.ok) {
    displayName = meResult.data.displayName;
    permissions = meResult.data.permissions;
  }

  const canReadUsers = permissions.includes('users.read');
  const canReadDepts = permissions.includes('org.departments.read');
  const canReadPlants = permissions.includes('org.plants.read');
  const canReadLocs = permissions.includes('org.locations.read');
  const canReadRoles = permissions.includes('roles.read');
  const canReadIncidents = permissions.includes('incidents.read');
  const canReadTasks = permissions.includes('tasks.read');
  const canReadMaintenance = permissions.includes('maintenance.read');
  const canReadSafety = permissions.includes('safety.read');
  const canReadContracts = permissions.includes('contracts.read');
  const canReadProduction = permissions.includes('production.read');

  // Parallel fetches — each module only fetched if the user has the relevant read permission
  const [
    apiStatus, dbStatus,
    usersRes, deptsRes, plantsRes, locsRes, rolesRes,
    incidentsDashRes, tasksDashRes, mrDashRes, safetyDashRes, contractsDashRes, productionDashRes,
  ] = await Promise.allSettled([
    fetchApiStatus(),
    fetchDbStatus(),
    canReadUsers ? usersApi.list(accessToken, { pageSize: 1 }) : Promise.resolve(null),
    canReadDepts ? departments.list({ pageSize: 1 }) : Promise.resolve(null),
    canReadPlants ? plants.list({ pageSize: 1 }) : Promise.resolve(null),
    canReadLocs ? locations.list({ pageSize: 1 }) : Promise.resolve(null),
    canReadRoles ? rolesApi.list(accessToken) : Promise.resolve(null),
    canReadIncidents ? incidentsApi.dashboard() : Promise.resolve(null),
    canReadTasks ? tasksApi.dashboard() : Promise.resolve(null),
    canReadMaintenance ? maintenanceApi.dashboard() : Promise.resolve(null),
    canReadSafety ? safetyApi.dashboard() : Promise.resolve(null),
    canReadContracts ? contractsApi.dashboard() : Promise.resolve(null),
    canReadProduction ? productionApi.dashboard() : Promise.resolve(null),
  ]);

  const resolvedApiStatus =
    apiStatus.status === 'fulfilled' ? apiStatus.value : 'offline';
  const resolvedDbStatus =
    dbStatus.status === 'fulfilled' ? dbStatus.value : 'offline';

  function resolveCount(
    result: PromiseSettledResult<
      | { ok: true; data: { pagination: { total: number } } }
      | { ok: false; code: string; message: string }
      | { items: unknown[]; pagination: { total: number } }
      | null
    >,
    hasPermission: boolean,
  ): { status: MetricStatus; value?: number } {
    if (!hasPermission) return { status: 'restricted' };
    if (result.status === 'rejected') return { status: 'unavailable' };
    const val = result.value;
    if (val === null) return { status: 'restricted' };
    if ('ok' in val) {
      if (!val.ok) return { status: 'unavailable' };
      return { status: 'ok', value: val.data.pagination.total };
    }
    if ('pagination' in val) {
      return { status: 'ok', value: val.pagination.total };
    }
    return { status: 'unavailable' };
  }

  function resolveRolesCount(
    result: PromiseSettledResult<
      | { ok: true; data: unknown[] }
      | { ok: false; code: string; message: string }
      | null
    >,
    hasPermission: boolean,
  ): { status: MetricStatus; value?: number } {
    if (!hasPermission) return { status: 'restricted' };
    if (result.status === 'rejected') return { status: 'unavailable' };
    const val = result.value;
    if (val === null) return { status: 'restricted' };
    if ('ok' in val && val.ok) return { status: 'ok', value: (val.data as unknown[]).length };
    return { status: 'unavailable' };
  }

  const usersMetric = resolveCount(
    usersRes as PromiseSettledResult<{ ok: true; data: { pagination: { total: number } } } | { ok: false; code: string; message: string } | null>,
    canReadUsers,
  );
  const deptsMetric = resolveCount(
    deptsRes as PromiseSettledResult<{ items: unknown[]; pagination: { total: number } } | null>,
    canReadDepts,
  );
  const plantsMetric = resolveCount(
    plantsRes as PromiseSettledResult<{ items: unknown[]; pagination: { total: number } } | null>,
    canReadPlants,
  );
  const locsMetric = resolveCount(
    locsRes as PromiseSettledResult<{ items: unknown[]; pagination: { total: number } } | null>,
    canReadLocs,
  );
  const rolesMetric = resolveRolesCount(
    rolesRes as PromiseSettledResult<{ ok: true; data: unknown[] } | { ok: false; code: string; message: string } | null>,
    canReadRoles,
  );

  // Module dashboard data extraction — section rendered only when canReadX is true
  const incidentsDash: IncidentDashboardData | null =
    incidentsDashRes.status === 'fulfilled' ? incidentsDashRes.value : null;
  const incS: 'ok' | 'unavailable' =
    incidentsDashRes.status === 'rejected' ? 'unavailable' : 'ok';

  const tasksDash: TaskDashboardData | null =
    tasksDashRes.status === 'fulfilled' ? tasksDashRes.value : null;
  const tS: 'ok' | 'unavailable' =
    tasksDashRes.status === 'rejected' ? 'unavailable' : 'ok';

  const mrDash: MrDashboardData | null =
    mrDashRes.status === 'fulfilled' ? mrDashRes.value : null;
  const mrS: 'ok' | 'unavailable' =
    mrDashRes.status === 'rejected' ? 'unavailable' : 'ok';

  const safetyDash: SafetyDashboardData | null =
    safetyDashRes.status === 'fulfilled' ? safetyDashRes.value : null;
  const sfS: 'ok' | 'unavailable' =
    safetyDashRes.status === 'rejected' ? 'unavailable' : 'ok';

  const contractsDash: ContractDashboardData | null =
    contractsDashRes.status === 'fulfilled' ? contractsDashRes.value : null;
  const cS: 'ok' | 'unavailable' =
    contractsDashRes.status === 'rejected' ? 'unavailable' : 'ok';

  const productionDash: ProductionDashboardData | null =
    productionDashRes.status === 'fulfilled' ? productionDashRes.value : null;
  const pS: 'ok' | 'unavailable' =
    productionDashRes.status === 'rejected' ? 'unavailable' : 'ok';

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Welcome back, {displayName}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          RECAFCO Factory Management Platform — internal operations dashboard
        </p>
      </div>

      {/* Platform Status */}
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          Platform Status
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="API"
            value={resolvedApiStatus === 'online' ? 'Online' : 'Offline'}
            icon={Activity}
            iconColor={resolvedApiStatus === 'online' ? 'text-success' : 'text-error'}
            status="ok"
            source="Source: /health"
          />
          <MetricCard
            label="Database"
            value={resolvedDbStatus === 'ok' ? 'Operational' : resolvedDbStatus === 'unavailable' ? 'Unavailable' : 'Offline'}
            icon={Database}
            iconColor={resolvedDbStatus === 'ok' ? 'text-success' : 'text-error'}
            status="ok"
            source="Source: /ready"
          />
          <MetricCard
            label="Active Users"
            value={usersMetric.value}
            icon={Users}
            iconColor="text-info"
            href="/administration/users"
            status={usersMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Roles"
            value={rolesMetric.value}
            icon={Shield}
            iconColor="text-secondary-accent"
            href="/administration/roles"
            status={rolesMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Departments"
            value={deptsMetric.value}
            icon={Building2}
            iconColor="text-accent"
            href="/administration/departments"
            status={deptsMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Plants"
            value={plantsMetric.value}
            icon={Factory}
            iconColor="text-accent"
            href="/administration/plants"
            status={plantsMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Locations"
            value={locsMetric.value}
            icon={MapPin}
            iconColor="text-accent"
            href="/administration/locations"
            status={locsMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Platform Modules"
            value={7}
            icon={Boxes}
            iconColor="text-text-secondary"
            status="ok"
            source="9 planned phases"
          />
        </div>
      </section>

      {/* Incidents — only rendered when user has incidents.read */}
      {canReadIncidents && (
        <section aria-labelledby="incidents-heading">
          <h2 id="incidents-heading" className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
            Incidents
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Open Incidents"
              value={incidentsDash?.metrics.totalOpen}
              icon={AlertTriangle}
              iconColor="text-warning"
              href="/incidents?status=open"
              status={incS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="Critical Open"
              value={incidentsDash?.metrics.criticalOpen}
              icon={AlertOctagon}
              iconColor="text-danger"
              href="/incidents?status=open&severity=CRITICAL"
              status={incS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="Under Investigation"
              value={incidentsDash?.metrics.underInvestigation}
              icon={Search}
              iconColor="text-info"
              href="/incidents?status=INVESTIGATION"
              status={incS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="Resolved This Month"
              value={incidentsDash?.metrics.resolvedThisMonth}
              icon={CheckCircle2}
              iconColor="text-success"
              href="/incidents?status=RESOLVED"
              status={incS}
              source="Source: FMP Database"
            />
          </div>
        </section>
      )}

      {/* Factory Tasks — only rendered when user has tasks.read */}
      {canReadTasks && (
        <section aria-labelledby="factory-tasks-heading">
          <h2 id="factory-tasks-heading" className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
            Factory Tasks
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Open Tasks"
              value={tasksDash?.metrics.openTasks}
              icon={ClipboardList}
              iconColor="text-accent"
              href="/factory-tasks?status=active"
              status={tS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="My Open Tasks"
              value={tasksDash?.metrics.assignedToMe}
              icon={Users}
              iconColor="text-info"
              href="/factory-tasks/my"
              status={tS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="Overdue Tasks"
              value={tasksDash?.metrics.overdueTasks}
              icon={AlertTriangle}
              iconColor="text-warning"
              href="/factory-tasks?overdue=true"
              status={tS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="Blocked Tasks"
              value={tasksDash?.metrics.blockedTasks}
              icon={AlertOctagon}
              iconColor="text-danger"
              href="/factory-tasks?status=BLOCKED"
              status={tS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="Completed This Month"
              value={tasksDash?.metrics.completedThisMonth}
              icon={CheckCircle2}
              iconColor="text-success"
              href="/factory-tasks?status=COMPLETED"
              status={tS}
              source="Source: FMP Database"
            />
          </div>
        </section>
      )}

      {/* Maintenance Requests — only rendered when user has maintenance.read */}
      {canReadMaintenance && (
        <section aria-labelledby="maintenance-heading">
          <h2 id="maintenance-heading" className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
            Maintenance Requests
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Open Requests"
              value={mrDash?.metrics.openRequests}
              icon={Wrench}
              iconColor="text-accent"
              href="/maintenance?status=active"
              status={mrS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="Assigned to Me"
              value={mrDash?.metrics.assignedToMe}
              icon={Users}
              iconColor="text-info"
              href="/maintenance/my"
              status={mrS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="Overdue"
              value={mrDash?.metrics.overdueRequests}
              icon={AlertTriangle}
              iconColor="text-warning"
              href="/maintenance?overdue=true"
              status={mrS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="Waiting for Parts"
              value={mrDash?.metrics.waitingForParts}
              icon={AlertOctagon}
              iconColor="text-danger"
              href="/maintenance?status=WAITING_FOR_PARTS"
              status={mrS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="Completed This Month"
              value={mrDash?.metrics.completedThisMonth}
              icon={CheckCircle2}
              iconColor="text-success"
              href="/maintenance?status=COMPLETED"
              status={mrS}
              source="Source: FMP Database"
            />
          </div>
        </section>
      )}

      {/* Safety & Compliance — only rendered when user has safety.read */}
      {canReadSafety && (
        <section aria-labelledby="safety-heading">
          <h2 id="safety-heading" className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
            Safety &amp; Compliance
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Scheduled"
              value={safetyDash?.metrics.scheduledInspections}
              icon={ShieldCheck}
              iconColor="text-info"
              href="/safety-compliance?status=SCHEDULED"
              status={sfS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="In Progress"
              value={safetyDash?.metrics.inProgressInspections}
              icon={ShieldCheck}
              iconColor="text-warning"
              href="/safety-compliance?status=IN_PROGRESS"
              status={sfS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="Open Findings"
              value={safetyDash?.metrics.openFindings}
              icon={AlertTriangle}
              iconColor="text-accent"
              href="/safety-compliance"
              status={sfS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="Critical Findings"
              value={safetyDash?.metrics.criticalFindings}
              icon={AlertOctagon}
              iconColor="text-danger"
              href="/safety-compliance"
              status={sfS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="Overdue Findings"
              value={safetyDash?.metrics.overdueFindings}
              icon={AlertTriangle}
              iconColor="text-warning"
              href="/safety-compliance"
              status={sfS}
              source="Source: FMP Database"
            />
          </div>
        </section>
      )}

      {/* Contracts — only rendered when user has contracts.read */}
      {canReadContracts && (
        <section aria-labelledby="contracts-heading">
          <h2 id="contracts-heading" className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
            Contracts
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Active Contracts"
              value={contractsDash?.metrics.totalActive}
              icon={FileText}
              iconColor="text-success"
              href="/contracts?status=ACTIVE"
              status={cS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="Expiring Soon"
              value={contractsDash?.metrics.totalExpiring}
              icon={FileText}
              iconColor="text-warning"
              href="/contracts?lifecycleStatus=EXPIRING"
              status={cS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="Expired"
              value={contractsDash?.metrics.totalExpired}
              icon={FileText}
              iconColor="text-danger"
              href="/contracts?lifecycleStatus=EXPIRED"
              status={cS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="Draft"
              value={contractsDash?.metrics.totalDraft}
              icon={FileText}
              iconColor="text-text-secondary"
              href="/contracts?status=DRAFT"
              status={cS}
              source="Source: FMP Database"
            />
          </div>
        </section>
      )}

      {/* Production — only rendered when user has production.read */}
      {canReadProduction && (
        <section aria-labelledby="production-heading">
          <h2 id="production-heading" className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
            Production
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Scheduled Orders"
              value={productionDash?.metrics.scheduledOrders}
              icon={Factory}
              iconColor="text-info"
              href="/production?status=SCHEDULED"
              status={pS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="In Progress"
              value={productionDash?.metrics.inProgressOrders}
              icon={Play}
              iconColor="text-accent"
              href="/production?status=IN_PROGRESS"
              status={pS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="Paused"
              value={productionDash?.metrics.pausedOrders}
              icon={PauseCircle}
              iconColor="text-warning"
              href="/production?status=PAUSED"
              status={pS}
              source="Source: FMP Database"
            />
            <MetricCard
              label="Completed This Month"
              value={productionDash?.metrics.completedThisMonth}
              icon={CheckCircle2}
              iconColor="text-success"
              href="/production?status=COMPLETED"
              status={pS}
              source="Source: FMP Database"
            />
          </div>
        </section>
      )}

      {/* Operational Modules */}
      <section aria-labelledby="modules-heading">
        <h2 id="modules-heading" className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          Operational Modules
        </h2>
        {MODULE_CARDS.filter((c) => permissions.includes(c.readPermission)).length === 0 ? (
          <p className="text-sm text-text-muted py-4">
            You do not have access to any operational modules. Contact your administrator to request access.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODULE_CARDS.filter((c) => permissions.includes(c.readPermission)).map((c) => (
              <ModuleCard
                key={c.href}
                title={c.title}
                description={c.description}
                href={c.href}
                icon={c.icon}
                status={c.status ?? 'planned'}
                phase={c.phase}
              />
            ))}
          </div>
        )}
      </section>

      {/* Implementation progress */}
      <section aria-labelledby="progress-heading">
        <h2 id="progress-heading" className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          Implementation Progress
        </h2>
        <div className="bg-surface rounded-lg border border-border p-5">
          <ol className="space-y-3">
            {PROGRESS_STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5">
                  {step.done ? (
                    <CheckCircle2 className="size-5 text-success" aria-label="Complete" />
                  ) : (
                    <Circle className="size-5 text-border-strong" aria-label="Planned" />
                  )}
                </span>
                <div>
                  <p className={`text-sm font-medium ${step.done ? 'text-text-primary' : 'text-text-muted'}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 pt-4 border-t border-border text-xs text-text-muted">
            This platform is under active development. Operational modules will be enabled in sequence as each phase completes.
            All data displayed above is live from the FMP database. No SAP data is currently connected.
          </p>
        </div>
      </section>
    </div>
  );
}
