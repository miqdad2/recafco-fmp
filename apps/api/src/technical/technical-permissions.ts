/**
 * FMP-ACCESS-02 — Technical has its own permissions (technical.read / technical.update /
 * technical.manage). The older Contract Management codes still open the same Technical routes so
 * existing Contract Managers, Contract Staff and Full Platform Access users keep working;
 * only the *new* way in is technical.*.
 */
export const TECHNICAL_READ_PERMISSIONS = ['technical.read', 'contracts.read'] as const;
export const TECHNICAL_WRITE_PERMISSIONS = [
  'technical.update',
  'contracts.update',
  'contracts.workflow_update',
] as const;

export function hasTechnicalRead(permissions: string[]): boolean {
  return TECHNICAL_READ_PERMISSIONS.some((p) => permissions.includes(p));
}

/** technical.manage is always granted together with technical.update, but is accepted on its own too so a manager is never locked out. */
export function hasTechnicalWrite(permissions: string[]): boolean {
  return permissions.includes('technical.manage') || TECHNICAL_WRITE_PERMISSIONS.some((p) => permissions.includes(p));
}

/** Deleting a file someone else uploaded: contracts.manage (as before) or technical.manage. */
export function canDeleteOthersTechnicalFiles(permissions: string[]): boolean {
  return permissions.includes('contracts.manage') || permissions.includes('technical.manage');
}
