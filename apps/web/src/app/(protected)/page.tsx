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
} from 'lucide-react';
import { authApi } from '@/lib/auth-api';
import { rolesApi } from '@/lib/roles-api';
import { usersApi } from '@/lib/users-api';
import { departments, plants, locations } from '@/lib/organizations-api';
import { incidentsApi } from '@/lib/incidents-api';
import { tasksApi } from '@/lib/factory-tasks-api';
import { maintenanceApi } from '@/lib/maintenance-api';
import { safetyApi } from '@/lib/safety-api';
import { contractsApi } from '@/lib/contracts-api';
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
  { label: 'Factory Tasks', detail: 'Full lifecycle: Draft → Open → Assigned → In Progress → Completed → Closed', done: true },
  { label: 'Incidents', detail: 'Incident reporting, investigation workflow, corrective actions', done: true },
  { label: 'Maintenance Requests', detail: 'Full 11-status lifecycle: Draft → Submitted → Approved → Assigned → In Progress → Completed → Closed', done: true },
  { label: 'Safety & Compliance', detail: 'Safety inspections with findings, verification, and compliance lifecycle', done: true },
  { label: 'Contracts', detail: 'Contract lifecycle: Draft → Active → Terminated/Closed with derived EXPIRING/EXPIRED states', done: true },
  { label: 'Production', detail: 'Production orders, production lines, entries (Output/Downtime/Adjustment), KPI metrics', done: true },
  { label: 'Platform Hardening', detail: 'Security regression tests, PM2 deployment config, release documentation', done: true },
];

const MODULE_CARDS = [
  {
    title: 'Factory Tasks',
    description: 'Assign, track, and complete recurring operational tasks across the factory floor.',
    href: '/factory-tasks',
    icon: ClipboardList,
    phase: 'Phase 4',
    status: 'available' as const,
  },
  {
    title: 'Incidents',
    description: 'Report and manage incidents, near-misses, and corrective actions.',
    href: '/incidents',
    icon: AlertTriangle,
    phase: 'Phase 5',
    status: 'available' as const,
  },
  {
    title: 'Maintenance',
    description: 'Submit and track maintenance requests through the full review and repair lifecycle.',
    href: '/maintenance',
    icon: Wrench,
    phase: 'Phase 6',
    status: 'available' as const,
  },
  {
    title: 'Safety & Compliance',
    description: 'Safety inspections, findings tracking, and compliance lifecycle management.',
    href: '/safety-compliance',
    icon: ShieldCheck,
    phase: 'Phase 7',
    status: 'available' as const,
  },
  {
    title: 'Contracts',
    description: 'Vendor contract register with lifecycle tracking and approval workflow.',
    href: '/contracts',
    icon: FileText,
    phase: 'Phase 8',
    status: 'available' as const,
  },
  {
    title: 'Production',
    description: 'Production orders and lines: Output, Downtime, and Adjustment entries with live KPI metrics.',
    href: '/production',
    icon: Factory,
    phase: 'Phase 9',
    status: 'available' as const,
  },
];

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  // Resolve user profile + permissions
  const meResult = await authApi.me(accessToken);
  let displayName = 'there';
  let permissions: string[] = [];

  if (meResult.ok) {
    displayName = meResult.data.displayName;
    const roleResult = await rolesApi.get(accessToken, meResult.data.roleId);
    if (roleResult.ok) {
      permissions = roleResult.data.permissions.map((p) => p.code);
    }
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

  // Parallel fetches
  const [apiStatus, dbStatus, usersRes, deptsRes, plantsRes, locsRes, rolesRes, incidentSummaryRes, taskSummaryRes, mrSummaryRes, safetySummaryRes, contractSummaryRes] =
    await Promise.allSettled([
      fetchApiStatus(),
      fetchDbStatus(),
      canReadUsers
        ? usersApi.list(accessToken, { pageSize: 1 })
        : Promise.resolve(null),
      canReadDepts
        ? departments.list({ pageSize: 1 })
        : Promise.resolve(null),
      canReadPlants
        ? plants.list({ pageSize: 1 })
        : Promise.resolve(null),
      canReadLocs
        ? locations.list({ pageSize: 1 })
        : Promise.resolve(null),
      canReadRoles
        ? rolesApi.list(accessToken)
        : Promise.resolve(null),
      canReadIncidents
        ? incidentsApi.summary()
        : Promise.resolve(null),
      canReadTasks
        ? tasksApi.summary()
        : Promise.resolve(null),
      canReadMaintenance
        ? maintenanceApi.summary()
        : Promise.resolve(null),
      canReadSafety
        ? safetyApi.summary()
        : Promise.resolve(null),
      canReadContracts
        ? contractsApi.summary()
        : Promise.resolve(null),
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
    // organizations-api shape
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

  type IncidentSummaryShape = { totalOpen: number; criticalOpen: number; underInvestigation: number; resolvedThisMonth: number };
  function resolveIncidentMetric(
    key: keyof IncidentSummaryShape,
  ): { status: MetricStatus; value?: number } {
    if (!canReadIncidents) return { status: 'restricted' };
    if (incidentSummaryRes.status === 'rejected') return { status: 'unavailable' };
    const val = incidentSummaryRes.value;
    if (val === null) return { status: 'restricted' };
    return { status: 'ok', value: (val as IncidentSummaryShape)[key] };
  }

  const incOpenMetric = resolveIncidentMetric('totalOpen');
  const incCriticalMetric = resolveIncidentMetric('criticalOpen');
  const incInvestigationMetric = resolveIncidentMetric('underInvestigation');
  const incResolvedMetric = resolveIncidentMetric('resolvedThisMonth');

  type TaskSummaryShape = { openTasks: number; myOpenTasks: number; overdueTasks: number; completedThisMonth: number; blockedTasks: number };
  function resolveTaskMetric(
    key: keyof TaskSummaryShape,
  ): { status: MetricStatus; value?: number } {
    if (!canReadTasks) return { status: 'restricted' };
    if (taskSummaryRes.status === 'rejected') return { status: 'unavailable' };
    const val = taskSummaryRes.value;
    if (val === null) return { status: 'restricted' };
    return { status: 'ok', value: (val as TaskSummaryShape)[key] };
  }

  const taskOpenMetric = resolveTaskMetric('openTasks');
  const taskMyMetric = resolveTaskMetric('myOpenTasks');
  const taskOverdueMetric = resolveTaskMetric('overdueTasks');
  const taskCompletedMetric = resolveTaskMetric('completedThisMonth');
  const taskBlockedMetric = resolveTaskMetric('blockedTasks');

  type MrSummaryShape = { openRequests: number; assignedToMe: number; overdueRequests: number; waitingForParts: number; completedThisMonth: number };
  function resolveMrMetric(
    key: keyof MrSummaryShape,
  ): { status: MetricStatus; value?: number } {
    if (!canReadMaintenance) return { status: 'restricted' };
    if (mrSummaryRes.status === 'rejected') return { status: 'unavailable' };
    const val = mrSummaryRes.value;
    if (val === null) return { status: 'restricted' };
    return { status: 'ok', value: (val as MrSummaryShape)[key] };
  }

  const mrOpenMetric = resolveMrMetric('openRequests');
  const mrMyMetric = resolveMrMetric('assignedToMe');
  const mrOverdueMetric = resolveMrMetric('overdueRequests');
  const mrWaitingMetric = resolveMrMetric('waitingForParts');
  const mrCompletedMetric = resolveMrMetric('completedThisMonth');

  type SafetySummaryShape = { scheduledInspections: number; openFindings: number; criticalFindings: number; overdueFindings: number; inProgressInspections: number };
  function resolveSafetyMetric(
    key: keyof SafetySummaryShape,
  ): { status: MetricStatus; value?: number } {
    if (!canReadSafety) return { status: 'restricted' };
    if (safetySummaryRes.status === 'rejected') return { status: 'unavailable' };
    const val = safetySummaryRes.value;
    if (val === null) return { status: 'restricted' };
    return { status: 'ok', value: (val as SafetySummaryShape)[key] };
  }

  const safetyScheduledMetric = resolveSafetyMetric('scheduledInspections');
  const safetyInProgressMetric = resolveSafetyMetric('inProgressInspections');
  const safetyOpenFindingsMetric = resolveSafetyMetric('openFindings');
  const safetyCriticalFindingsMetric = resolveSafetyMetric('criticalFindings');
  const safetyOverdueFindingsMetric = resolveSafetyMetric('overdueFindings');

  type ContractSummaryShape = { totalDraft: number; totalActive: number; totalExpiring: number; totalExpired: number; totalTerminated: number; totalClosed: number };
  function resolveContractMetric(
    key: keyof ContractSummaryShape,
  ): { status: MetricStatus; value?: number } {
    if (!canReadContracts) return { status: 'restricted' };
    if (contractSummaryRes.status === 'rejected') return { status: 'unavailable' };
    const val = contractSummaryRes.value;
    if (val === null) return { status: 'restricted' };
    return { status: 'ok', value: (val as ContractSummaryShape)[key] };
  }

  const contractActiveMetric = resolveContractMetric('totalActive');
  const contractExpiringMetric = resolveContractMetric('totalExpiring');
  const contractExpiredMetric = resolveContractMetric('totalExpired');
  const contractDraftMetric = resolveContractMetric('totalDraft');

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Welcome back, {displayName}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          RECAFCO Factory Management Platform — internal operations dashboard
        </p>
      </div>

      {/* Metric cards */}
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

      {/* Incidents */}
      <section aria-labelledby="incidents-heading">
        <h2 id="incidents-heading" className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          Incidents
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Open Incidents"
            value={incOpenMetric.value}
            icon={AlertTriangle}
            iconColor="text-warning"
            href="/incidents?status=open"
            status={incOpenMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Critical Open"
            value={incCriticalMetric.value}
            icon={AlertOctagon}
            iconColor="text-danger"
            href="/incidents?status=open&severity=CRITICAL"
            status={incCriticalMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Under Investigation"
            value={incInvestigationMetric.value}
            icon={Search}
            iconColor="text-info"
            href="/incidents?status=INVESTIGATION"
            status={incInvestigationMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Resolved This Month"
            value={incResolvedMetric.value}
            icon={CheckCircle2}
            iconColor="text-success"
            href="/incidents?status=RESOLVED"
            status={incResolvedMetric.status}
            source="Source: FMP Database"
          />
        </div>
      </section>

      {/* Factory Tasks */}
      <section aria-labelledby="factory-tasks-heading">
        <h2 id="factory-tasks-heading" className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          Factory Tasks
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Open Tasks"
            value={taskOpenMetric.value}
            icon={ClipboardList}
            iconColor="text-accent"
            href="/factory-tasks?status=active"
            status={taskOpenMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="My Open Tasks"
            value={taskMyMetric.value}
            icon={Users}
            iconColor="text-info"
            href="/factory-tasks/my"
            status={taskMyMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Overdue Tasks"
            value={taskOverdueMetric.value}
            icon={AlertTriangle}
            iconColor="text-warning"
            href="/factory-tasks?overdue=true"
            status={taskOverdueMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Blocked Tasks"
            value={taskBlockedMetric.value}
            icon={AlertOctagon}
            iconColor="text-danger"
            href="/factory-tasks?status=BLOCKED"
            status={taskBlockedMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Completed This Month"
            value={taskCompletedMetric.value}
            icon={CheckCircle2}
            iconColor="text-success"
            href="/factory-tasks?status=COMPLETED"
            status={taskCompletedMetric.status}
            source="Source: FMP Database"
          />
        </div>
      </section>

      {/* Maintenance */}
      <section aria-labelledby="maintenance-heading">
        <h2 id="maintenance-heading" className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          Maintenance Requests
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Open Requests"
            value={mrOpenMetric.value}
            icon={Wrench}
            iconColor="text-accent"
            href="/maintenance?status=active"
            status={mrOpenMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Assigned to Me"
            value={mrMyMetric.value}
            icon={Users}
            iconColor="text-info"
            href="/maintenance/my"
            status={mrMyMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Overdue"
            value={mrOverdueMetric.value}
            icon={AlertTriangle}
            iconColor="text-warning"
            href="/maintenance?overdue=true"
            status={mrOverdueMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Waiting for Parts"
            value={mrWaitingMetric.value}
            icon={AlertOctagon}
            iconColor="text-danger"
            href="/maintenance?status=WAITING_FOR_PARTS"
            status={mrWaitingMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Completed This Month"
            value={mrCompletedMetric.value}
            icon={CheckCircle2}
            iconColor="text-success"
            href="/maintenance?status=COMPLETED"
            status={mrCompletedMetric.status}
            source="Source: FMP Database"
          />
        </div>
      </section>

      {/* Safety & Compliance */}
      <section aria-labelledby="safety-heading">
        <h2 id="safety-heading" className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          Safety & Compliance
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Scheduled"
            value={safetyScheduledMetric.value}
            icon={ShieldCheck}
            iconColor="text-info"
            href="/safety-compliance?status=SCHEDULED"
            status={safetyScheduledMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="In Progress"
            value={safetyInProgressMetric.value}
            icon={ShieldCheck}
            iconColor="text-warning"
            href="/safety-compliance?status=IN_PROGRESS"
            status={safetyInProgressMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Open Findings"
            value={safetyOpenFindingsMetric.value}
            icon={AlertTriangle}
            iconColor="text-accent"
            href="/safety-compliance"
            status={safetyOpenFindingsMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Critical Findings"
            value={safetyCriticalFindingsMetric.value}
            icon={AlertOctagon}
            iconColor="text-danger"
            href="/safety-compliance"
            status={safetyCriticalFindingsMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Overdue Findings"
            value={safetyOverdueFindingsMetric.value}
            icon={AlertTriangle}
            iconColor="text-warning"
            href="/safety-compliance"
            status={safetyOverdueFindingsMetric.status}
            source="Source: FMP Database"
          />
        </div>
      </section>

      {/* Contracts */}
      <section aria-labelledby="contracts-heading">
        <h2 id="contracts-heading" className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          Contracts
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Active Contracts"
            value={contractActiveMetric.value}
            icon={FileText}
            iconColor="text-success"
            href="/contracts?status=ACTIVE"
            status={contractActiveMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Expiring Soon"
            value={contractExpiringMetric.value}
            icon={FileText}
            iconColor="text-warning"
            href="/contracts?lifecycleStatus=EXPIRING"
            status={contractExpiringMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Expired"
            value={contractExpiredMetric.value}
            icon={FileText}
            iconColor="text-danger"
            href="/contracts?lifecycleStatus=EXPIRED"
            status={contractExpiredMetric.status}
            source="Source: FMP Database"
          />
          <MetricCard
            label="Draft"
            value={contractDraftMetric.value}
            icon={FileText}
            iconColor="text-text-secondary"
            href="/contracts?status=DRAFT"
            status={contractDraftMetric.status}
            source="Source: FMP Database"
          />
        </div>
      </section>

      {/* Modules */}
      <section aria-labelledby="modules-heading">
        <h2 id="modules-heading" className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          Operational Modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODULE_CARDS.map((m) => (
            <ModuleCard
              key={m.href}
              title={m.title}
              description={m.description}
              href={m.href}
              icon={m.icon}
              status={m.status ?? 'planned'}
              phase={m.phase}
            />
          ))}
        </div>
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
