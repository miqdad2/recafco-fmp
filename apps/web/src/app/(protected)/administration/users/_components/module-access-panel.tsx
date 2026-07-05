'use client';

import { useActionState, useState } from 'react';
import type { UserModuleAccessConfig, ModuleIdentifier, DepartmentAccessScope } from '@/lib/users-api';
import type { ModuleAccessActionState } from '../actions';

const MODULE_LABELS: Record<ModuleIdentifier, string> = {
  FACTORY_TASKS: 'Factory Tasks Management',
  INCIDENT_REPORT: 'Incident Report',
  MAINTENANCE_REQUESTS: 'Maintenance Requests',
  SAFETY_COMPLIANCE: 'Safety & Compliance',
  CONTRACTS_MANAGEMENT: 'Contracts Management',
  PRODUCTION_DASHBOARD: 'Production Dashboard',
  ADMINISTRATION: 'Administration',
};

const SCOPE_LABELS: Record<DepartmentAccessScope, string> = {
  OWN_DEPARTMENT: 'My Department',
  SELECTED_DEPARTMENTS: 'Selected Departments',
  ALL_DEPARTMENTS: 'All Departments',
};

const SCOPE_COLORS: Record<DepartmentAccessScope, string> = {
  OWN_DEPARTMENT: 'bg-surface-secondary text-text-secondary border border-border',
  SELECTED_DEPARTMENTS: 'bg-warning-light text-warning border border-warning/30',
  ALL_DEPARTMENTS: 'bg-success-light text-success border border-success/30',
};

interface ModuleRowProps {
  config: UserModuleAccessConfig;
  userId: string;
  allDepartments: { id: string; code: string; name: string }[];
  deptApiError: boolean;
  action: (userId: string, module: ModuleIdentifier, prev: ModuleAccessActionState, fd: FormData) => Promise<ModuleAccessActionState>;
  canManage: boolean;
  canManageAll: boolean;
}

function ModuleRow({ config, userId, allDepartments, deptApiError, action, canManage, canManageAll }: ModuleRowProps) {
  const [editing, setEditing] = useState(false);
  const [selectedScope, setSelectedScope] = useState<DepartmentAccessScope>(config.scope);
  const [checkedDeptIds, setCheckedDeptIds] = useState<Set<string>>(
    () => new Set(config.grantedDepartments.map((d) => d.id)),
  );

  function openEditing() {
    setSelectedScope(config.scope);
    setCheckedDeptIds(new Set(config.grantedDepartments.map((d) => d.id)));
    setEditing(true);
  }

  function cancelEditing() {
    setSelectedScope(config.scope);
    setCheckedDeptIds(new Set(config.grantedDepartments.map((d) => d.id)));
    setEditing(false);
  }

  const boundAction = async (prev: ModuleAccessActionState, fd: FormData): Promise<ModuleAccessActionState> => {
    const result = await action(userId, config.module, prev, fd);
    if (result?.success) setEditing(false);
    return result;
  };

  const [state, formAction, pending] = useActionState(boundAction, null);

  const noDeptSelected = selectedScope === 'SELECTED_DEPARTMENTS' && checkedDeptIds.size === 0 && !deptApiError;

  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">{MODULE_LABELS[config.module]}</p>
          {!editing && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SCOPE_COLORS[config.scope]}`}>
                {SCOPE_LABELS[config.scope]}
              </span>
              {config.scope === 'SELECTED_DEPARTMENTS' && config.grantedDepartments.length > 0 && (
                <span className="text-xs text-text-muted">
                  {config.grantedDepartments.map((d) => d.code).join(', ')}
                </span>
              )}
            </div>
          )}
        </div>
        {canManage && !editing && (
          <button
            type="button"
            onClick={openEditing}
            className="flex-shrink-0 text-xs text-accent hover:underline"
          >
            Change
          </button>
        )}
      </div>

      {editing && (
        <form action={formAction} className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Scope</label>
            <select
              name="scope"
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value as DepartmentAccessScope)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="OWN_DEPARTMENT">My Department (default)</option>
              <option value="SELECTED_DEPARTMENTS">Selected Departments</option>
              {canManageAll && <option value="ALL_DEPARTMENTS">All Departments</option>}
            </select>
          </div>

          {selectedScope === 'ALL_DEPARTMENTS' && (
            <p className="text-xs text-warning bg-warning-light border border-warning/30 rounded-md px-3 py-2">
              This gives company-wide access to this module.
            </p>
          )}

          {selectedScope === 'SELECTED_DEPARTMENTS' && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Departments</label>
              {deptApiError ? (
                <p className="text-xs text-error py-1">
                  Unable to load departments — contact your administrator.
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto rounded-md border border-border bg-surface p-2 space-y-1">
                  {allDepartments.map((dept) => (
                    <label key={dept.id} className="flex items-center gap-2 cursor-pointer hover:bg-surface-secondary rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        name="departmentIds"
                        value={dept.id}
                        checked={checkedDeptIds.has(dept.id)}
                        onChange={(e) => {
                          setCheckedDeptIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(dept.id); else next.delete(dept.id);
                            return next;
                          });
                        }}
                        className="rounded border-border text-accent focus:ring-accent"
                      />
                      <span className="text-sm text-text-primary">{dept.name}</span>
                      <span className="text-xs text-text-muted font-mono">{dept.code}</span>
                    </label>
                  ))}
                  {allDepartments.length === 0 && (
                    <p className="text-xs text-text-muted py-1 px-1">No active departments found.</p>
                  )}
                </div>
              )}
              {noDeptSelected && (
                <p className="text-xs text-error mt-1">Select at least one department.</p>
              )}
            </div>
          )}

          {state?.error && (
            <p className="text-xs text-danger">{state.error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending || noDeptSelected}
              className="px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              className="px-3 py-1.5 rounded-md border border-border bg-surface text-text-secondary text-xs hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

interface Props {
  userId: string;
  moduleAccess: UserModuleAccessConfig[];
  allDepartments: { id: string; code: string; name: string }[];
  deptApiError?: boolean;
  action: (userId: string, module: ModuleIdentifier, prev: ModuleAccessActionState, fd: FormData) => Promise<ModuleAccessActionState>;
  canManage: boolean;
  canManageAll: boolean;
}

export function ModuleAccessPanel({ userId, moduleAccess, allDepartments, deptApiError = false, action, canManage, canManageAll }: Props) {
  return (
    <div className="mt-8 pt-6 border-t border-border">
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
        Module Access Scopes
      </h3>
      <div className="rounded-lg border border-border bg-surface px-4">
        {moduleAccess.map((config) => (
          <ModuleRow
            key={config.module}
            config={config}
            userId={userId}
            allDepartments={allDepartments}
            deptApiError={deptApiError}
            action={action}
            canManage={canManage}
            canManageAll={canManageAll}
          />
        ))}
      </div>
      {!canManage && (
        <p className="mt-2 text-xs text-text-muted">
          You do not have permission to change module access scopes.
        </p>
      )}
    </div>
  );
}
