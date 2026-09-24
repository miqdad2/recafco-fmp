import { MODULE_READ_PERMISSION } from '../../../_lib/module-visibility';
import type { ModuleCode } from '../../../_lib/module-visibility';

// ---------------------------------------------------------------------------
// CM-42 — "N users have access to module X" computed entirely from data the
// Users page already fetches (user list + each active role's permissions) —
// no new backend field. A user "has access" to a module when their role
// carries that module's single read permission (the exact same rule
// module-visibility.ts uses to decide sidebar visibility for that user).
//
// Manager/Staff breakdown is only meaningful for Contract Management: it's
// the only module with a dedicated Staff/Manager role split today (CM-35's
// CONTRACT_STAFF/CONTRACT_MANAGER) — confirmed by auditing every migration's
// seeded roles before writing this. Every other module currently grants
// access only via broad roles (Admin/Super Admin/custom), so no
// staff/manager split is shown for them per the "only if supported by
// roles" instruction.
// ---------------------------------------------------------------------------

export interface ModuleCountUser {
  roleCode: string;
}

/** Permission codes granted to each role, keyed by role code. */
export type RolePermissionMap = Record<string, string[]>;

export interface ModuleUserCounts {
  total: number;
  /** Present only for CONTRACTS_MANAGEMENT. */
  staffCount?: number;
  managerCount?: number;
}

const OPERATIONAL_MODULES: Exclude<ModuleCode, 'ADMINISTRATION'>[] = [
  'CONTRACTS_MANAGEMENT',
  'FACTORY_TASKS',
  'INCIDENT_REPORT',
  'MAINTENANCE_REQUESTS',
  'SAFETY_COMPLIANCE',
  'PRODUCTION_DASHBOARD',
];

export function computeModuleUserCounts(
  users: ModuleCountUser[],
  rolePermissions: RolePermissionMap,
): Record<string, ModuleUserCounts> {
  const result: Record<string, ModuleUserCounts> = {};

  for (const mod of OPERATIONAL_MODULES) {
    const readPermission = MODULE_READ_PERMISSION[mod];
    const withAccess = users.filter((u) => (rolePermissions[u.roleCode] ?? []).includes(readPermission));

    const counts: ModuleUserCounts = { total: withAccess.length };
    if (mod === 'CONTRACTS_MANAGEMENT') {
      counts.staffCount = withAccess.filter((u) => u.roleCode === 'CONTRACT_STAFF').length;
      counts.managerCount = withAccess.length - counts.staffCount;
    }
    result[mod] = counts;
  }

  return result;
}

/**
 * FMP-UI-02 — count for the Executive / Management card. Deliberately
 * role-code based, not permission based: EXECUTIVE_MANAGER carries the same
 * per-module read permissions as ADMIN for every operational module (see
 * the role's own migration), so a permission-based count (like
 * computeModuleUserCounts above) would double-count ADMIN/SUPER_ADMIN users
 * who happen to also hold every one of those permissions but are not
 * "Executive Manager" users at all.
 */
export function computeExecutiveManagerCount(users: ModuleCountUser[]): number {
  return users.filter((u) => u.roleCode === 'EXECUTIVE_MANAGER').length;
}
