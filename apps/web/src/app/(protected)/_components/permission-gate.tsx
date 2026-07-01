interface PermissionGateProps {
  permission: string;
  permissions: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({
  permission,
  permissions,
  children,
  fallback = null,
}: PermissionGateProps): React.JSX.Element {
  if (!permissions.includes(permission)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
