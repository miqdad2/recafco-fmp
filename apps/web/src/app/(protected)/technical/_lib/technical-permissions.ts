// FMP-ACCESS-02 — Technical has its own technical.* permissions. The older Contract Management
// codes keep opening the same screens (Contract Managers, Contract Staff, Full Platform Access),
// mirroring apps/api/src/technical/technical-permissions.ts. Keep the two in sync.

export function canReadTechnical(permissions: string[]): boolean {
  return permissions.includes('technical.read') || permissions.includes('contracts.read');
}

export function canWriteTechnical(permissions: string[]): boolean {
  return (
    permissions.includes('technical.update') ||
    permissions.includes('technical.manage') ||
    permissions.includes('contracts.update') ||
    permissions.includes('contracts.workflow_update')
  );
}

/** Deleting files uploaded by others. */
export function canManageTechnical(permissions: string[]): boolean {
  return permissions.includes('technical.manage') || permissions.includes('contracts.manage');
}
