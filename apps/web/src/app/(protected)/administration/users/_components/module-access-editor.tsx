'use client';

import { useState } from 'react';
import type { DepartmentAccessScope, ModuleIdentifier } from '@/lib/users-api';
import { MODULE_LABELS } from './scope-utils';

export { getAvailableScopeOptions } from './scope-utils';

export const ALL_MODULES: ModuleIdentifier[] = [
  'FACTORY_TASKS',
  'INCIDENT_REPORT',
  'MAINTENANCE_REQUESTS',
  'SAFETY_COMPLIANCE',
  'CONTRACTS_MANAGEMENT',
  'PRODUCTION_DASHBOARD',
  'ADMINISTRATION',
];

export interface DeptOption {
  id: string;
  code: string;
  name: string;
}

interface ModuleRowProps {
  module: ModuleIdentifier;
  allDepartments: DeptOption[];
  deptApiError: boolean;
  canManageAll: boolean;
  defaultScope?: DepartmentAccessScope;
  defaultDeptIds?: string[];
  emphasis?: 'highlighted' | 'dimmed' | undefined;
}

function ModuleRow({
  module,
  allDepartments,
  deptApiError,
  canManageAll,
  defaultScope = 'OWN_DEPARTMENT',
  defaultDeptIds = [],
  emphasis,
}: ModuleRowProps): React.JSX.Element {
  const [scope, setScope] = useState<DepartmentAccessScope>(defaultScope);

  return (
    <div
      className={[
        'py-3 border-b border-border last:border-0 -mx-4 px-4',
        emphasis === 'highlighted' ? 'bg-accent/5' : '',
        emphasis === 'dimmed' ? 'opacity-50' : '',
      ].join(' ')}
    >
      <p className="text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
        {MODULE_LABELS[module]}
        {emphasis === 'highlighted' && (
          <span className="text-[10px] font-semibold uppercase tracking-wide bg-accent text-accent-foreground rounded-full px-1.5 py-0.5">
            Selected
          </span>
        )}
      </p>
      <div className="space-y-2">
        <select
          name={`module_scope_${module}`}
          value={scope}
          onChange={(e) => setScope(e.target.value as DepartmentAccessScope)}
          className="w-full h-9 px-3 rounded-md border border-border bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <option value="OWN_DEPARTMENT">My Department (default)</option>
          <option value="SELECTED_DEPARTMENTS">Selected Departments</option>
          {canManageAll && <option value="ALL_DEPARTMENTS">All Departments</option>}
        </select>

        {scope === 'ALL_DEPARTMENTS' && (
          <p className="text-xs text-warning bg-warning-light border border-warning/30 rounded-md px-3 py-2">
            This gives company-wide access to this module.
          </p>
        )}

        {scope === 'SELECTED_DEPARTMENTS' && (
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Departments</label>
            {deptApiError ? (
              <p className="text-xs text-error py-1">
                Unable to load departments — contact your administrator.
              </p>
            ) : (
              <div className="max-h-36 overflow-y-auto rounded-md border border-border bg-surface p-2 space-y-1">
                {allDepartments.length === 0 ? (
                  <p className="text-xs text-text-muted py-1 px-1">No active departments found.</p>
                ) : (
                  allDepartments.map((dept) => (
                    <label
                      key={dept.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-surface-secondary rounded px-1 py-0.5"
                    >
                      <input
                        type="checkbox"
                        name={`module_depts_${module}`}
                        value={dept.id}
                        defaultChecked={defaultDeptIds.includes(dept.id)}
                        className="rounded border-border text-accent focus:ring-accent"
                      />
                      <span className="text-sm text-text-primary">{dept.name}</span>
                      <span className="text-xs text-text-muted font-mono">{dept.code}</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface Props {
  allDepartments: DeptOption[];
  deptApiError?: boolean;
  canManageAll: boolean;
  defaultValues?: Partial<Record<ModuleIdentifier, { scope: DepartmentAccessScope; deptIds: string[] }>>;
  /** When set, visually highlights this module and dims the rest. Purely cosmetic — every module row still submits a real scope value, since "no access" is not yet a supported scope. */
  emphasizeModule?: ModuleIdentifier | undefined;
}

export function ModuleAccessEditor({
  allDepartments,
  deptApiError = false,
  canManageAll,
  defaultValues = {},
  emphasizeModule,
}: Props): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface px-4">
      {ALL_MODULES.map((mod) => (
        <ModuleRow
          key={mod}
          module={mod}
          allDepartments={allDepartments}
          deptApiError={deptApiError}
          canManageAll={canManageAll}
          defaultScope={defaultValues[mod]?.scope ?? 'OWN_DEPARTMENT'}
          defaultDeptIds={defaultValues[mod]?.deptIds ?? []}
          emphasis={emphasizeModule ? (mod === emphasizeModule ? 'highlighted' : 'dimmed') : undefined}
        />
      ))}
    </div>
  );
}
