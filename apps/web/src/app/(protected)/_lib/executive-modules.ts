import {
  FileText,
  Calculator,
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
 * modules). Neither has a dedicated permission yet, which is why
 * `requiredPermission: string` became `isVisible: (permissions) => boolean`
 * — a single permission string couldn't express "Executive Manager or
 * Admin" the way the other real modules' single read-permission check
 * could.
 *
 * FMP-UI-23 — reordered to the exact required sequence (Contract
 * Management, Estimation, Technical, Erection, Safety & Compliance,
 * Incident Management, Production & Planning, Maintenance Management,
 * Storage Yard & Delivery, Quality Control, Task Management) and extended
 * with a new Estimation placeholder module (same `isVisible` shape as
 * QA/QC and Storage & Delivery — no dedicated permission was created).
 * Titles renamed: "Incident Report" → "Incident Management", "Production
 * Planning" → "Production & Planning", "Quality Assurance & Control" →
 * "Quality Control". `code`/`landingHref` values are UNCHANGED for every
 * existing module (technical slugs, not user-facing) — only `title` and
 * array position moved, per this unit's own "do not rename routes" rule.
 *
 * FMP-UI-23B — this array is the ONE frontend source of truth for order
 * (sidebar's `EXECUTIVE_SIDEBAR_ITEMS`, the module switcher, Previous/Next
 * all read from it), but `apps/api/src/platform/platform-dashboard.service.ts`
 * cannot import it (different package, no JSX/lucide-react on the backend)
 * — that file hand-duplicates this exact same order in its own
 * `getDashboard()` push sequence. If this array's order/titles ever change
 * again, update that file's push order in the same change, not later.
 */
export const EXECUTIVE_MODULES: ExecutiveModuleMeta[] = [
  { code: 'CONTRACTS_MANAGEMENT', title: 'Contract Management', landingHref: '/contracts/executive', icon: FileText, accent: 'contracts', isVisible: permissionGate('contracts.read') },
  { code: 'ESTIMATION', title: 'Estimation', landingHref: '/executive/estimation', icon: Calculator, accent: 'estimation', isVisible: isExecutiveManagerOrAdminAccess },
  // FMP-TECH-01 — repointed from /contracts/technical to the new Technical module (see that route's own history for why).
  { code: 'TECHNICAL', title: 'Technical', landingHref: '/technical', icon: Ruler, accent: 'technical', isVisible: (permissions) => permissions.includes('technical.read') || permissions.includes('contracts.read') },
  { code: 'ERECTION', title: 'Erection', landingHref: '/contracts/erection-executive', icon: HardHat, accent: 'erection', isVisible: permissionGate('contracts.read') },
  { code: 'SAFETY_COMPLIANCE', title: 'Safety & Compliance', landingHref: '/safety-compliance/executive', icon: ShieldCheck, accent: 'safety', isVisible: permissionGate('safety.read') },
  { code: 'INCIDENT_REPORT', title: 'Incident Management', landingHref: '/incidents/executive', icon: AlertTriangle, accent: 'incident', isVisible: permissionGate('incidents.read') },
  { code: 'PRODUCTION_DASHBOARD', title: 'Production & Planning', landingHref: '/production/executive', icon: Factory, accent: 'production', isVisible: permissionGate('production.read') },
  { code: 'MAINTENANCE_REQUESTS', title: 'Maintenance Management', landingHref: '/maintenance/executive', icon: Wrench, accent: 'maintenance', isVisible: permissionGate('maintenance.read') },
  { code: 'STORAGE_DELIVERY', title: 'Storage Yard & Delivery', landingHref: '/executive/storage-delivery', icon: Warehouse, accent: 'storage', isVisible: isExecutiveManagerOrAdminAccess },
  { code: 'QA_QC', title: 'Quality Control', landingHref: '/executive/qaqc', icon: BadgeCheck, accent: 'qaqc', isVisible: isExecutiveManagerOrAdminAccess },
  { code: 'FACTORY_TASKS', title: 'Task Management', landingHref: '/factory-tasks/executive', icon: ClipboardList, accent: 'tasks', isVisible: permissionGate('tasks.read') },
];

/** FMP-UI-07 (nav access pass) — the module-switcher chips and Previous/Next must only ever offer modules the viewer actually holds real access to, matching PlatformDashboardService's own per-card gating exactly. An Executive Manager holds all 6 underlying permissions (plus Estimation, QA/QC, and Storage & Delivery via isExecutiveManagerOrAdminAccess), so sees all 11; a single-module viewer sees only their own. */
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
