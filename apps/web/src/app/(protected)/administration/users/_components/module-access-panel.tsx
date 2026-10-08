'use client';

import { useActionState, useState } from 'react';
import type { UserModuleAccessConfig, ModuleIdentifier, DepartmentAccessScope } from '@/lib/users-api';
import type { ModuleAccessActionState } from '../actions';
import { MODULE_LABELS } from './scope-utils';
import { ACCESS_MODE_HELPERS, ACCESS_MODE_LABELS, MODULE_DISPLAY_NAMES } from '../../../_lib/access-mode';
import { groupModuleAccess } from './access-mode-config';


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
  /** The user's primary department — what "My Department" actually means for them. */
  userDepartment?: DeptRef | null | undefined;
  labelOverrides?: Partial<Record<ModuleIdentifier, string>>;
}

interface DeptRef {
  code: string;
  name: string;
}

/** Plain-words scope: the department code(s), or All Departments. */
function scopeText(config: UserModuleAccessConfig, userDepartment: DeptRef | null | undefined): string {
  if (config.scope === 'ALL_DEPARTMENTS') return 'All Departments';
  if (config.scope === 'SELECTED_DEPARTMENTS') {
    return config.grantedDepartments.length > 0
      ? config.grantedDepartments.map((d) => d.code).join(', ')
      : 'No departments selected';
  }
  return userDepartment ? userDepartment.code : 'My Department';
}

function ModuleRow({ config, userId, allDepartments, deptApiError, action, canManage, canManageAll, userDepartment, labelOverrides }: ModuleRowProps) {
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
          <p className="text-sm font-medium text-text-primary">{labelOverrides?.[config.module] ?? MODULE_LABELS[config.module]}</p>
          {!editing && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SCOPE_COLORS[config.scope]}`}>
                {SCOPE_LABELS[config.scope]}
              </span>
              {config.scope === 'OWN_DEPARTMENT' && userDepartment && (
                <span className="text-xs text-text-muted">{userDepartment.code} — {userDepartment.name}</span>
              )}
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
  /** FMP-ACCESS-01 — permission codes of the user's role; drives which modules count as granted. */
  permissions: string[];
  fullPlatformAccess: boolean;
  userDepartment?: DeptRef | null | undefined;
  platformAccessAction: (prev: ModuleAccessActionState, fd: FormData) => Promise<ModuleAccessActionState>;
}

/** Explicit Full Platform Access switch. Only shown to administrators who may also grant All Departments. */
function PlatformAccessToggle({
  enabled,
  action,
}: {
  enabled: boolean;
  action: (prev: ModuleAccessActionState, fd: FormData) => Promise<ModuleAccessActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-3">
      <input type="hidden" name="fullPlatformAccess" value={enabled ? 'false' : 'true'} />
      <button
        type="submit"
        disabled={pending}
        className="px-3 py-1.5 rounded-md border border-border bg-surface text-text-primary text-xs font-medium hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
      >
        {pending ? 'Saving…' : enabled ? 'Remove Full Platform Access' : 'Grant Full Platform Access'}
      </button>
      <span className="text-xs text-text-muted">
        {enabled
          ? 'Returns this user to their normal module workspace. Role permissions are unchanged.'
          : 'Shows the Factory Operations Control Center and main sidebar. Role permissions are unchanged.'}
      </span>
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">{children}</h3>;
}

export function ModuleAccessPanel({
  userId,
  moduleAccess,
  allDepartments,
  deptApiError = false,
  action,
  canManage,
  canManageAll,
  permissions,
  fullPlatformAccess,
  userDepartment,
  platformAccessAction,
}: Props) {
  const groups = groupModuleAccess(moduleAccess, permissions, fullPlatformAccess);
  const { info } = groups;
  const rowProps = { userId, allDepartments, deptApiError, action, canManage, canManageAll, userDepartment, labelOverrides: groups.labelOverrides };

  return (
    <div className="space-y-6">
      <section aria-label="Access Mode" className="rounded-lg border border-border bg-surface px-4 py-3">
        <SectionTitle>Access Mode</SectionTitle>
        <p className="text-base font-semibold text-text-primary">{ACCESS_MODE_LABELS[info.mode]}</p>
        <p className="text-xs text-text-muted">{ACCESS_MODE_HELPERS[info.mode]}</p>
        {info.fullPlatformSource === 'explicit' && (
          <p className="mt-1 text-xs text-text-muted">Granted explicitly by an administrator.</p>
        )}
        {info.fullPlatformSource === 'role' && (
          <p className="mt-1 text-xs text-text-muted">
            Comes from this user&apos;s role, which already covers every module — no extra setting is needed.
          </p>
        )}
        {info.mode === 'SINGLE_MODULE' && info.primaryModule && (
          <dl className="mt-3 text-sm">
            <dt className="text-xs text-text-muted">Primary Module</dt>
            <dd className="font-medium text-text-primary">{MODULE_DISPLAY_NAMES[info.primaryModule]}</dd>
          </dl>
        )}
        {info.mode === 'FULL_PLATFORM' && (
          <dl className="mt-3 text-sm">
            <dt className="text-xs text-text-muted">Modules</dt>
            <dd className="font-medium text-text-primary">All platform modules</dd>
          </dl>
        )}
        {canManageAll && info.fullPlatformSource !== 'role' && (
          <PlatformAccessToggle enabled={fullPlatformAccess} action={platformAccessAction} />
        )}
      </section>

      {groups.primary && (
        <section aria-label="Primary Module">
          <SectionTitle>Primary Module</SectionTitle>
          <div className="rounded-lg border border-border bg-surface px-4">
            <ModuleRow config={groups.primary} {...rowProps} />
          </div>
        </section>
      )}

      {groups.primary && groups.relatedWorkflows.length > 0 && (
        <section aria-label="Related Workflow Access">
          <SectionTitle>Related Workflow Access</SectionTitle>
          <ul className="rounded-lg border border-border bg-surface px-4 divide-y divide-border">
            {groups.relatedWorkflows.map((name) => (
              <li key={name} className="py-2.5 text-sm text-text-primary">
                {name} <span className="text-text-muted">— {scopeText(groups.primary!, userDepartment)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-text-muted">
            Part of the {groups.labelOverrides[groups.primary.module] ?? MODULE_LABELS[groups.primary.module]} workflow. They follow the scope set above.
          </p>
        </section>
      )}

      {groups.modules.length > 0 && (
        <section aria-label="Modules">
          <SectionTitle>{info.mode === 'FULL_PLATFORM' ? 'Module Scopes' : 'Modules'}</SectionTitle>
          <div className="rounded-lg border border-border bg-surface px-4">
            {groups.modules.map((config) => (
              <ModuleRow key={config.module} config={config} {...rowProps} />
            ))}
          </div>
        </section>
      )}

      {groups.other.length > 0 && (
        <section aria-label="Other Module Access">
          <SectionTitle>Other Module Access</SectionTitle>
          <p className="mb-2 text-xs text-text-muted">
            Stored scopes for modules this role does not grant. They have no effect until the role includes the module.
          </p>
          <div className="rounded-lg border border-border bg-surface px-4">
            {groups.other.map((config) => (
              <ModuleRow key={config.module} config={config} {...rowProps} />
            ))}
          </div>
        </section>
      )}

      {groups.administration && (
        <section aria-label="Administration Access">
          <SectionTitle>Administration Access</SectionTitle>
          <div className="rounded-lg border border-border bg-surface px-4">
            <ModuleRow config={groups.administration} {...rowProps} />
          </div>
        </section>
      )}

      {groups.notGranted.length > 0 && (
        <details className="rounded-lg border border-border bg-surface px-4 py-3">
          <summary className="cursor-pointer text-xs font-medium text-text-secondary">
            Modules this role does not grant ({groups.notGranted.length})
          </summary>
          <p className="mt-2 text-xs text-text-muted">Default scope only — the user cannot open these modules.</p>
          <div className="mt-1">
            {groups.notGranted.map((config) => (
              <ModuleRow key={config.module} config={config} {...rowProps} />
            ))}
          </div>
        </details>
      )}

      {!canManage && (
        <p className="text-xs text-text-muted">You do not have permission to change module access scopes.</p>
      )}
    </div>
  );
}
