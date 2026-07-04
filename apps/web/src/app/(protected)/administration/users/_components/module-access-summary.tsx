import type { UserModuleAccessConfig } from '@/lib/users-api';
import { ScopeBadge } from './scope-badge';

const MODULE_SHORT: Record<string, string> = {
  FACTORY_TASKS: 'Tasks',
  INCIDENT_REPORT: 'Incidents',
  MAINTENANCE_REQUESTS: 'Maintenance',
  SAFETY_COMPLIANCE: 'Safety',
  CONTRACTS_MANAGEMENT: 'Contracts',
  PRODUCTION_DASHBOARD: 'Production',
  ADMINISTRATION: 'Admin',
};

interface Props {
  moduleAccess: UserModuleAccessConfig[];
  maxVisible?: number;
}

export function ModuleAccessSummary({ moduleAccess, maxVisible = 3 }: Props): React.JSX.Element {
  const elevated = moduleAccess.filter((m) => m.scope !== 'OWN_DEPARTMENT');
  if (elevated.length === 0) {
    return <span className="text-xs text-text-muted">All defaults</span>;
  }
  const visible = elevated.slice(0, maxVisible);
  const overflow = elevated.length - maxVisible;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((m) => (
        <span key={m.module} className="inline-flex items-center gap-1">
          <span className="text-xs text-text-muted">{MODULE_SHORT[m.module] ?? m.module}:</span>
          <ScopeBadge scope={m.scope} />
        </span>
      ))}
      {overflow > 0 && (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-surface-secondary text-text-muted border border-border">
          +{overflow} more
        </span>
      )}
    </div>
  );
}
