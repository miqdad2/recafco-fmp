import { Globe, Building2, LayoutList } from 'lucide-react';

export type DashboardScopeType = 'OWN_DEPARTMENT' | 'SELECTED_DEPARTMENTS' | 'ALL_DEPARTMENTS';

interface Props {
  scope: { type: DashboardScopeType; departmentNames: string[] } | undefined;
}

export function DashboardScopeBadge({ scope }: Props): React.JSX.Element | null {
  if (!scope) return null;

  if (scope.type === 'ALL_DEPARTMENTS') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface border border-border text-text-secondary">
        <Globe className="size-3.5 shrink-0" aria-hidden="true" />
        All Departments
      </span>
    );
  }

  if (scope.type === 'OWN_DEPARTMENT') {
    const dept = scope.departmentNames[0];
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-info-light border border-info/20 text-info">
        <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
        My Department{dept ? ` — ${dept}` : ''}
      </span>
    );
  }

  const count = scope.departmentNames.length;
  const label = count > 2
    ? `${count} Departments`
    : count > 0
      ? scope.departmentNames.join(', ')
      : 'Selected Departments';

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-secondary border border-border text-text-primary"
      title={scope.departmentNames.join(', ')}
    >
      <LayoutList className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="max-w-[220px] truncate">{label}</span>
    </span>
  );
}
