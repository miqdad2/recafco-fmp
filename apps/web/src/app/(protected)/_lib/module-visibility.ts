/**
 * Single source of truth for "which sidebar modules can this user see", derived entirely
 * from live permission codes (never a role name). Keep in sync with the module list
 * documented in context/ui-registry.md and the ModuleIdentifier enum used by Module Access.
 */
export type ModuleCode =
  | 'FACTORY_TASKS'
  | 'INCIDENT_REPORT'
  | 'MAINTENANCE_REQUESTS'
  | 'SAFETY_COMPLIANCE'
  | 'CONTRACTS_MANAGEMENT'
  | 'PRODUCTION_DASHBOARD'
  | 'ADMINISTRATION';

/** Single read permission that gates each operational module. Exported (CM-42) so
 * Administration → Users can bucket existing users by module without a new backend
 * field — never duplicate this map elsewhere. */
export const MODULE_READ_PERMISSION: Record<Exclude<ModuleCode, 'ADMINISTRATION'>, string> = {
  FACTORY_TASKS: 'tasks.read',
  INCIDENT_REPORT: 'incidents.read',
  MAINTENANCE_REQUESTS: 'maintenance.read',
  SAFETY_COMPLIANCE: 'safety.read',
  CONTRACTS_MANAGEMENT: 'contracts.read',
  PRODUCTION_DASHBOARD: 'production.read',
};

/**
 * Administration has no single read permission — any of these grants entry to at least
 * one admin screen, so the section is visible if the user holds any one of them.
 */
const ADMINISTRATION_GATE_PERMISSIONS = [
  'users.read',
  'roles.read',
  'org.departments.read',
  'org.plants.read',
  'org.locations.read',
] as const;

export function canSeeModule(permissions: string[], module: ModuleCode): boolean {
  if (module === 'ADMINISTRATION') {
    return ADMINISTRATION_GATE_PERMISSIONS.some((p) => permissions.includes(p));
  }
  return permissions.includes(MODULE_READ_PERMISSION[module]);
}

const ALL_MODULES: ModuleCode[] = [
  'FACTORY_TASKS',
  'INCIDENT_REPORT',
  'MAINTENANCE_REQUESTS',
  'SAFETY_COMPLIANCE',
  'CONTRACTS_MANAGEMENT',
  'PRODUCTION_DASHBOARD',
  'ADMINISTRATION',
];

export function getVisibleModules(permissions: string[]): ModuleCode[] {
  return ALL_MODULES.filter((m) => canSeeModule(permissions, m));
}

/**
 * True only when Contract Management is the sole module this user can see — no other
 * operational module and no Administration access. Drives the root-dashboard redirect
 * to /contracts/dashboard instead of showing platform-wide data to a module-only user.
 */
export function isContractManagementOnlyAccess(permissions: string[]): boolean {
  const visible = getVisibleModules(permissions);
  return visible.length === 1 && visible[0] === 'CONTRACTS_MANAGEMENT';
}

/**
 * CM-41 — true only for Contract Staff (CM-35's contracts.workflow_update,
 * without contracts.update or contracts.close): they may update workflow
 * tasks assigned to them, but hold no manager-tier permission at all.
 * Drives the simplified Contract Management sidebar (Dashboard + My Tasks
 * only) and hides the "All Workflows" mode tab. Contract Manager, the legacy
 * CONTRACT_MANAGEMENT_USER role, and Admin/Super Admin all carry
 * contracts.update (CONTRACT_MANAGEMENT_USER also carries contracts.close),
 * so this is false for every one of them — never derived from a role code.
 */
export function isContractStaffOnlyAccess(permissions: string[]): boolean {
  return (
    permissions.includes('contracts.workflow_update') &&
    !permissions.includes('contracts.update') &&
    !permissions.includes('contracts.close')
  );
}

/**
 * CM-71H — "Contract Manager should not appear as the Erection Workflow's
 * main execution owner; monitor, not owner." No dedicated "Erection
 * Dashboard" permission exists yet (adding one would mean seeding a new
 * permission code and re-granting every existing role — a larger, riskier
 * change than this unit's own "additive/safe changes only" instruction
 * allows), so the sidebar keeps every existing user's access unchanged
 * (nothing hidden) and instead relabels the same link "Erection Status" for
 * a manager-tier actor (contracts.update) — Option B from this unit's own
 * task text, explicitly offered as an accepted alternative to hiding the
 * item. A non-manager actor (e.g. a future Erection Manager holding only
 * contracts.workflow_update) still sees it as "Erection Dashboard".
 */
export function isErectionDashboardMonitorOnly(permissions: string[]): boolean {
  return permissions.includes('contracts.update');
}

const OPERATIONAL_MODULES: Exclude<ModuleCode, 'ADMINISTRATION'>[] = [
  'FACTORY_TASKS', 'INCIDENT_REPORT', 'MAINTENANCE_REQUESTS', 'SAFETY_COMPLIANCE', 'CONTRACTS_MANAGEMENT', 'PRODUCTION_DASHBOARD',
];

/**
 * FMP-UI-03 — true for a user who can see every operational module but has
 * no Administration access at all: exactly the permission shape the
 * EXECUTIVE_MANAGER role produces (see that role's own migration,
 * 20260922000000_add_executive_manager_role — full read/write on all 6
 * operational modules, withholding every users/roles/org/audit permission
 * code), derived from permissions only, never a role code — any future role with the same
 * shape gets the same treatment automatically. Drives the Executive
 * Dashboard sidebar experience (hides the redundant "Dashboard" link since
 * that IS the landing page for this shape, and switches to a flat,
 * larger-type nav — see sidebar.tsx). Never true for SUPER_ADMIN/ADMIN
 * (both hold at least one ADMINISTRATION_GATE_PERMISSIONS code) or for any
 * single/partial-module role (Contract Manager/Staff, the legacy
 * CONTRACT_MANAGEMENT_USER, Viewer — none holds all 6 modules' own read
 * permission).
 */
export function isExecutiveManagerAccess(permissions: string[]): boolean {
  return OPERATIONAL_MODULES.every((m) => canSeeModule(permissions, m)) && !canSeeModule(permissions, 'ADMINISTRATION');
}

/**
 * FMP-UI-10 — QA/QC and Storage & Delivery are placeholder modules: no real
 * module exists yet, so there is no dedicated read permission to gate them
 * on. Per this unit's own explicit instruction, visibility instead mirrors
 * "Executive Manager OR Admin/Super Admin" — broader than
 * isExecutiveManagerAccess() alone (which is deliberately false for Admin/
 * Super Admin, see that function's own doc comment), since both should see
 * these placeholder cards/nav entries for now. Replace with a real
 * dedicated permission check once the QA/QC and Storage & Delivery modules
 * are actually built — this rule is not meant to be permanent. The API's
 * own PlatformDashboardService duplicates this exact shape server-side
 * (literal permission arrays, since the two packages don't share a
 * permission-utils module) — keep both in sync if this rule ever changes.
 */
export function isExecutiveManagerOrAdminAccess(permissions: string[]): boolean {
  return isExecutiveManagerAccess(permissions) || canSeeModule(permissions, 'ADMINISTRATION');
}
