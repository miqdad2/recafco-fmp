import {
  FileText,
  Ruler,
  HardHat,
  BadgeCheck,
  Warehouse,
  ShieldCheck,
  AlertTriangle,
  Factory,
  Wrench,
  ClipboardList,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PlatformModuleCode } from '@/lib/platform-api';
import type { ModuleAccent } from './module-accent';
import { isExecutiveManagerOrAdminAccess } from './module-visibility';

export interface ExecutiveModuleMeta {
  code: PlatformModuleCode;
  title: string;
  /** The Executive Module Landing Page route for this module (FMP-UI-07) — this is what the Executive Dashboard's card button, the executive sidebar, and every landing page's Previous/Next/switcher nav all point to. */
  landingHref: string;
  icon: LucideIcon;
  accent: ModuleAccent;
  /** Real permission-based visibility check for this module — never a role code. Used to filter the module-switcher chips and Previous/Next to only what the current viewer can actually open. */
  isVisible: (permissions: string[]) => boolean;
}

function permissionGate(permission: string): (permissions: string[]) => boolean {
  return (permissions) => permissions.includes(permission);
}

/**
 * FMP-UI-07 — fixed order and metadata for the Executive Module Landing
 * Pages, matching the Executive Dashboard's own card order
 * (PlatformDashboardService.getDashboard()). Drives the Previous/Next
 * navigation and module-switcher chips on every landing page — a single
 * source of truth so all pages stay consistent.
 *
 * FMP-UI-10 — extended with QA/QC and Storage & Delivery (placeholder
 * modules, positioned right after Erection per this unit's own spec).
 * Neither has a dedicated permission yet, which is why `requiredPermission:
 * string` became `isVisible: (permissions) => boolean` — a single permission
 * string couldn't express "Executive Manager or Admin" the way the other 8
 * modules' single real read-permission check could.
 */
export const EXECUTIVE_MODULES: ExecutiveModuleMeta[] = [
  { code: 'CONTRACTS_MANAGEMENT', title: 'Contract Management', landingHref: '/contracts/executive', icon: FileText, accent: 'contracts', isVisible: permissionGate('contracts.read') },
  { code: 'TECHNICAL', title: 'Technical', landingHref: '/contracts/technical', icon: Ruler, accent: 'technical', isVisible: permissionGate('contracts.read') },
  { code: 'ERECTION', title: 'Erection', landingHref: '/contracts/erection-executive', icon: HardHat, accent: 'erection', isVisible: permissionGate('contracts.read') },
  { code: 'QA_QC', title: 'Quality Assurance & Control', landingHref: '/executive/qaqc', icon: BadgeCheck, accent: 'qaqc', isVisible: isExecutiveManagerOrAdminAccess },
  { code: 'STORAGE_DELIVERY', title: 'Storage Yard & Delivery', landingHref: '/executive/storage-delivery', icon: Warehouse, accent: 'storage', isVisible: isExecutiveManagerOrAdminAccess },
  { code: 'SAFETY_COMPLIANCE', title: 'Safety & Compliance', landingHref: '/safety-compliance/executive', icon: ShieldCheck, accent: 'safety', isVisible: permissionGate('safety.read') },
  { code: 'INCIDENT_REPORT', title: 'Incident Report', landingHref: '/incidents/executive', icon: AlertTriangle, accent: 'incident', isVisible: permissionGate('incidents.read') },
  { code: 'PRODUCTION_DASHBOARD', title: 'Production Planning', landingHref: '/production/executive', icon: Factory, accent: 'production', isVisible: permissionGate('production.read') },
  { code: 'MAINTENANCE_REQUESTS', title: 'Maintenance Management', landingHref: '/maintenance/executive', icon: Wrench, accent: 'maintenance', isVisible: permissionGate('maintenance.read') },
  { code: 'FACTORY_TASKS', title: 'Task Management', landingHref: '/factory-tasks/executive', icon: ClipboardList, accent: 'tasks', isVisible: permissionGate('tasks.read') },
];

/** FMP-UI-07 (nav access pass) — the module-switcher chips and Previous/Next must only ever offer modules the viewer actually holds real access to, matching PlatformDashboardService's own per-card gating exactly. An Executive Manager holds all 6 underlying permissions (plus QA/QC and Storage & Delivery via isExecutiveManagerOrAdminAccess), so sees all 10; a single-module viewer sees only their own. */
export function getVisibleModules(permissions: string[]): ExecutiveModuleMeta[] {
  return EXECUTIVE_MODULES.filter((m) => m.isVisible(permissions));
}

export interface ModuleNeighbors {
  current: ExecutiveModuleMeta;
  prev: ExecutiveModuleMeta | null;
  next: ExecutiveModuleMeta | null;
}

/** Previous/Next are computed over the viewer's own VISIBLE modules only, so they never link to a module the viewer would just get a 404 (or an access-denied) from. */
export function getModuleNeighbors(code: PlatformModuleCode, permissions: string[]): ModuleNeighbors {
  const visible = getVisibleModules(permissions);
  const idx = visible.findIndex((m) => m.code === code);
  const current = visible[idx] ?? EXECUTIVE_MODULES.find((m) => m.code === code) ?? EXECUTIVE_MODULES[0]!;
  return {
    current,
    prev: idx > 0 ? visible[idx - 1]! : null,
    next: idx >= 0 && idx < visible.length - 1 ? visible[idx + 1]! : null,
  };
}
