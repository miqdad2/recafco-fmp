import type { DepartmentAccessScope } from '@/lib/users-api';

export type ScopeOrNoAccess = DepartmentAccessScope | 'NO_ACCESS';

const SCOPE_STYLES: Record<ScopeOrNoAccess, string> = {
  OWN_DEPARTMENT: 'bg-info-light text-info border-info/30',
  SELECTED_DEPARTMENTS: 'bg-warning-light text-warning border-warning/30',
  ALL_DEPARTMENTS: 'bg-error-light text-error border-error/30',
  NO_ACCESS: 'bg-surface-secondary text-text-muted border-border',
};

const SCOPE_LABELS: Record<ScopeOrNoAccess, string> = {
  OWN_DEPARTMENT: 'My Department',
  SELECTED_DEPARTMENTS: 'Selected Depts',
  ALL_DEPARTMENTS: 'All Departments',
  NO_ACCESS: 'No Role Access',
};

interface Props {
  scope: ScopeOrNoAccess;
  className?: string;
}

export function ScopeBadge({ scope, className }: Props): React.JSX.Element {
  const cls = [
    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border',
    SCOPE_STYLES[scope],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return <span className={cls}>{SCOPE_LABELS[scope]}</span>;
}
