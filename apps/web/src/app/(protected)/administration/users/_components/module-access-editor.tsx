'use client';

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
  scope: DepartmentAccessScope;
  deptIds: string[];
  onScopeChange: (module: ModuleIdentifier, scope: DepartmentAccessScope) => void;
  onDeptIdsChange: (module: ModuleIdentifier, deptIds: string[]) => void;
  emphasis?: 'highlighted' | 'dimmed' | undefined;
}

function ModuleRow({
  module,
  allDepartments,
  deptApiError,
  canManageAll,
  scope,
  deptIds,
  onScopeChange,
  onDeptIdsChange,
  emphasis,
}: ModuleRowProps): React.JSX.Element {
  function toggleDept(deptId: string, checked: boolean): void {
    const next = checked ? [...deptIds, deptId] : deptIds.filter((id) => id !== deptId);
    onDeptIdsChange(module, next);
  }

  return (
    <div
      className={[
        'rounded-md border px-3 py-2.5 transition-colors',
        emphasis === 'highlighted' ? 'border-accent bg-accent/5' : 'border-border bg-surface',
        emphasis === 'dimmed' ? 'opacity-50' : '',
      ].join(' ')}
    >
      {/* Compact single-line row — module name + scope select together, so the whole
          editor reads as a dense checklist rather than 7 stacked full-height blocks. */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-text-primary flex items-center gap-2 min-w-0 flex-1">
          <span className="truncate">{MODULE_LABELS[module]}</span>
          {emphasis === 'highlighted' && (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-accent text-accent-foreground rounded-full px-1.5 py-0.5">
              Selected
            </span>
          )}
        </p>
        <select
          name={`module_scope_${module}`}
          value={scope}
          onChange={(e) => onScopeChange(module, e.target.value as DepartmentAccessScope)}
          className="h-9 w-full sm:w-56 shrink-0 px-3 rounded-md border border-border bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <option value="OWN_DEPARTMENT">My Department (default)</option>
          <option value="SELECTED_DEPARTMENTS">Selected Departments</option>
          {canManageAll && <option value="ALL_DEPARTMENTS">All Departments</option>}
        </select>
      </div>

      {scope === 'ALL_DEPARTMENTS' && (
        <p className="mt-2 text-xs text-warning bg-warning-light border border-warning/30 rounded-md px-3 py-2">
          This gives company-wide access to this module.
        </p>
      )}

      {scope === 'SELECTED_DEPARTMENTS' && (
        <div className="mt-2">
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
                      checked={deptIds.includes(dept.id)}
                      onChange={(e) => toggleDept(dept.id, e.target.checked)}
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
  );
}

interface Props {
  allDepartments: DeptOption[];
  deptApiError?: boolean;
  canManageAll: boolean;
  /** Lifted state — the caller owns per-module scope/department selections (needed to build a Review-step summary and mismatch warnings). Modules absent from `scopes` are treated as OWN_DEPARTMENT (the same fail-closed default the backend applies to an absent UserModuleAccess row). */
  scopes: Partial<Record<ModuleIdentifier, DepartmentAccessScope>>;
  deptIdsByModule: Partial<Record<ModuleIdentifier, string[]>>;
  onScopeChange: (module: ModuleIdentifier, scope: DepartmentAccessScope) => void;
  onDeptIdsChange: (module: ModuleIdentifier, deptIds: string[]) => void;
  /** When set, visually highlights this module and dims the rest. Purely cosmetic — every module row still submits a real scope value, since "no access" is not yet a supported scope. */
  emphasizeModule?: ModuleIdentifier | undefined;
}

export function ModuleAccessEditor({
  allDepartments,
  deptApiError = false,
  canManageAll,
  scopes,
  deptIdsByModule,
  onScopeChange,
  onDeptIdsChange,
  emphasizeModule,
}: Props): React.JSX.Element {
  return (
    <div className="space-y-2">
      {ALL_MODULES.map((mod) => (
        <ModuleRow
          key={mod}
          module={mod}
          allDepartments={allDepartments}
          deptApiError={deptApiError}
          canManageAll={canManageAll}
          scope={scopes[mod] ?? 'OWN_DEPARTMENT'}
          deptIds={deptIdsByModule[mod] ?? []}
          onScopeChange={onScopeChange}
          onDeptIdsChange={onDeptIdsChange}
          emphasis={emphasizeModule ? (mod === emphasizeModule ? 'highlighted' : 'dimmed') : undefined}
        />
      ))}
    </div>
  );
}
