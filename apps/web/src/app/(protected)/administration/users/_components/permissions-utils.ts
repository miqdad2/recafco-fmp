export function resolvePermissions(permissions: unknown): string[] {
  return Array.isArray(permissions) ? (permissions as string[]) : [];
}
