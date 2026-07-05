export const MODULE_READ_PERMISSIONS = [
  'tasks.read',
  'incidents.read',
  'maintenance.read',
  'safety.read',
  'contracts.read',
  'production.read',
] as const;

export type ModuleReadPermission = (typeof MODULE_READ_PERMISSIONS)[number];

export function getAccessibleModulePermissions(
  permissions: string[],
): ModuleReadPermission[] {
  return MODULE_READ_PERMISSIONS.filter((p) => permissions.includes(p));
}

export function moduleDashStatus(
  result: PromiseSettledResult<unknown>,
): 'ok' | 'unavailable' {
  return result.status === 'rejected' ? 'unavailable' : 'ok';
}
