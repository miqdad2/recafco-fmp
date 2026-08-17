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

/** Single read permission that gates each operational module. */
const MODULE_READ_PERMISSION: Record<Exclude<ModuleCode, 'ADMINISTRATION'>, string> = {
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
