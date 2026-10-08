/**
 * FMP-ACCESS-01C — Full Platform Access is a VIEW grant, not a role change.
 *
 * When User.fullPlatformAccess is true, the request's effective permission list gets exactly these
 * read codes added (once, in JwtAuthGuard), so every existing guard, dashboard and the web sidebar
 * see the module dashboards as readable. It never adds a write/manage/approve code, nothing from
 * Administration (users/roles/org/audit/access_scope) and never contracts.manage. Department scoping
 * is a separate layer and is untouched. The role's stored permissions are not modified.
 */
export const FULL_PLATFORM_READ_PERMISSIONS = [
  'contracts.read', // Contract Management, Schedule Planning
  'technical.read', // FMP-ACCESS-02 — Technical module
  'production.read',
  'storage_delivery.read',
  'erection.read',
  'tasks.read',
  'incidents.read',
  'maintenance.read',
  'safety.read',
] as const;

export function applyFullPlatformAccess(permissions: string[], fullPlatformAccess: boolean | null | undefined): string[] {
  if (fullPlatformAccess !== true) return permissions;
  return Array.from(new Set([...permissions, ...FULL_PLATFORM_READ_PERMISSIONS]));
}
