/**
 * FMP-MIC-01 — Management Intelligence Center access rules (pure, no I/O).
 *
 * The Center is gated by one explicit permission. A "management-only" account is one whose
 * EVERY effective permission is a management_intelligence.* code: it holds no operational,
 * administration or access_scope permission at all, and no explicit Full Platform Access flag.
 * Anyone with any other permission keeps their existing landing page and sidebar unchanged —
 * the management permission never overrides an operational user's homepage.
 */
export const MANAGEMENT_PERMISSION = 'management_intelligence.read';
export const MANAGEMENT_HOME_PATH = '/management/intelligence';

const MANAGEMENT_PREFIX = 'management_intelligence.';

export function hasManagementAccess(permissions: readonly string[]): boolean {
  return permissions.includes(MANAGEMENT_PERMISSION);
}

export function isManagementOnlyAccess(permissions: readonly string[], fullPlatformAccess = false): boolean {
  if (fullPlatformAccess || !hasManagementAccess(permissions)) return false;
  return permissions.every((p) => p.startsWith(MANAGEMENT_PREFIX));
}
