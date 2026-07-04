'use client';

import { useState, useActionState } from 'react';
import type { UserSummary, UserModuleAccessConfig, ModuleIdentifier } from '@/lib/users-api';
import type { OrgEntity, LocationEntity } from '@/lib/organizations-api';
import type { RoleSummary, PermissionSummary } from '@/lib/roles-api';
import type { UserFormState } from './user-form';
import type { ModuleAccessActionState } from '../actions';
import { RolePermissionSummary } from './role-permission-summary';
import { ModuleAccessPanel } from './module-access-panel';
import { ResetPasswordForm } from './reset-password-form';
import { UserSecurityStatus } from './user-security-status';

export interface RoleWithPerms extends RoleSummary {
  permissions: PermissionSummary[];
}

type Tab = 'profile' | 'organization' | 'role' | 'access' | 'security';

const TAB_LABELS: Record<Tab, string> = {
  profile: 'Profile',
  organization: 'Organization',
  role: 'Role & Permissions',
  access: 'Module Access',
  security: 'Security',
};

interface Props {
  user: UserSummary;
  roles: RoleWithPerms[];
  departments: OrgEntity[];
  plants: OrgEntity[];
  locations: LocationEntity[];
  moduleAccess: UserModuleAccessConfig[] | null;
  canManageAccess: boolean;
  canManageAll: boolean;
  updateProfileAction: (prev: UserFormState | null, fd: FormData) => Promise<UserFormState | null>;
  updateOrgAction: (prev: UserFormState | null, fd: FormData) => Promise<UserFormState | null>;
  assignRoleAction: (prev: UserFormState | null, fd: FormData) => Promise<UserFormState | null>;
  resetPasswordActionBound: (prev: UserFormState | null, fd: FormData) => Promise<UserFormState | null>;
  deactivateAction: () => Promise<void>;
  activateAction: () => Promise<void>;
  unlockAction: () => Promise<void>;
  setModuleAccessAction: (
    userId: string,
    module: ModuleIdentifier,
    prev: ModuleAccessActionState,
    fd: FormData,
  ) => Promise<ModuleAccessActionState>;
}

const inputCls = 'w-full h-10 px-3 rounded-md border border-border bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus';
const selectCls = inputCls;
const readOnlyCls = 'w-full h-10 px-3 rounded-md border border-border bg-surface-secondary text-text-muted text-sm cursor-not-allowed font-mono';

function SaveSuccess({ message = 'Changes saved.' }: { message?: string }): React.JSX.Element {
  return (
    <div className="rounded-md bg-success-light border border-success px-4 py-3 text-sm text-success-foreground">
      {message}
    </div>
  );
}

function FormError({ message }: { message: string }): React.JSX.Element {
  return (
    <div role="alert" className="rounded-md bg-error-light border border-error px-4 py-3 text-sm text-error">
      {message}
    </div>
  );
}

function ProfileTab({
  user,
  action,
}: {
  user: UserSummary;
  action: (prev: UserFormState | null, fd: FormData) => Promise<UserFormState | null>;
}): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-5 max-w-lg">
      {state?.success && <SaveSuccess />}
      {state?.error && <FormError message={state.error} />}

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">Username</label>
        <input readOnly value={user.username} className={readOnlyCls} aria-label="Username (read-only)" />
      </div>
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-text-primary mb-1">
          Display name <span aria-hidden="true" className="text-error">*</span>
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          defaultValue={user.displayName}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={user.email ?? ''}
          placeholder="optional@example.com"
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="employeeNumber" className="block text-sm font-medium text-text-primary mb-1">
          Employee number
        </label>
        <input
          id="employeeNumber"
          name="employeeNumber"
          type="text"
          defaultValue={user.employeeNumber ?? ''}
          placeholder="e.g. EMP-001"
          className={inputCls}
        />
      </div>
      <div className="pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="h-10 px-5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-focus"
        >
          {isPending ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </form>
  );
}

function OrgTab({
  user,
  departments,
  plants,
  locations,
  action,
}: {
  user: UserSummary;
  departments: OrgEntity[];
  plants: OrgEntity[];
  locations: LocationEntity[];
  action: (prev: UserFormState | null, fd: FormData) => Promise<UserFormState | null>;
}): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(action, null);
  const [selectedPlantId, setSelectedPlantId] = useState(user.plantId ?? '');
  const filteredLocations = selectedPlantId
    ? locations.filter((l) => !l.plantId || l.plantId === selectedPlantId)
    : locations;

  return (
    <form action={formAction} className="space-y-5 max-w-lg">
      {state?.success && <SaveSuccess />}
      {state?.error && <FormError message={state.error} />}

      <div>
        <label htmlFor="departmentId" className="block text-sm font-medium text-text-primary mb-1">
          Primary Department
        </label>
        <select id="departmentId" name="departmentId" defaultValue={user.departmentId ?? ''} className={selectCls}>
          <option value="">— None —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} — {d.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="plantId" className="block text-sm font-medium text-text-primary mb-1">
          Plant
        </label>
        <select
          id="plantId"
          name="plantId"
          defaultValue={user.plantId ?? ''}
          className={selectCls}
          onChange={(e) => setSelectedPlantId(e.target.value)}
        >
          <option value="">— None —</option>
          {plants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="locationId" className="block text-sm font-medium text-text-primary mb-1">
          Location
        </label>
        <select id="locationId" name="locationId" defaultValue={user.locationId ?? ''} className={selectCls}>
          <option value="">— None —</option>
          {filteredLocations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code} — {l.name}
              {l.plant ? ` (${l.plant.code})` : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="h-10 px-5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-focus"
        >
          {isPending ? 'Saving…' : 'Save Organization'}
        </button>
      </div>
    </form>
  );
}

function RoleTab({
  user,
  roles,
  action,
}: {
  user: UserSummary;
  roles: RoleWithPerms[];
  action: (prev: UserFormState | null, fd: FormData) => Promise<UserFormState | null>;
}): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(action, null);
  const [selectedRoleId, setSelectedRoleId] = useState(user.roleId);
  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  return (
    <div className="space-y-5 max-w-lg">
      {state?.success && <SaveSuccess message="Role updated." />}
      {state?.error && <FormError message={state.error} />}

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="roleId" className="block text-sm font-medium text-text-primary mb-1">
            Role
          </label>
          <select
            id="roleId"
            name="roleId"
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className={selectCls}
          >
            {roles
              .filter((r) => r.isActive || r.id === user.roleId)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {!r.isActive ? ' (inactive)' : ''}
                </option>
              ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isPending || selectedRoleId === user.roleId}
          className="h-10 px-5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-focus"
        >
          {isPending ? 'Saving…' : 'Save Role'}
        </button>
      </form>

      {selectedRole && (
        <div>
          <p className="text-xs font-medium text-text-secondary mb-2">Permissions for this role:</p>
          <RolePermissionSummary permissions={selectedRole.permissions} />
        </div>
      )}

      <p className="text-xs text-info bg-info-light border border-info/20 rounded-md px-3 py-2">
        Role controls actions. Scope controls which department records are visible.
      </p>
    </div>
  );
}

function SecurityTab({
  user,
  resetPasswordAction,
  deactivateAction,
  activateAction,
  unlockAction,
}: {
  user: UserSummary;
  resetPasswordAction: (prev: UserFormState | null, fd: FormData) => Promise<UserFormState | null>;
  deactivateAction: () => Promise<void>;
  activateAction: () => Promise<void>;
  unlockAction: () => Promise<void>;
}): React.JSX.Element {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h4 className="text-sm font-semibold text-text-primary mb-3">Account Status</h4>
        <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
          <UserSecurityStatus
            isActive={user.isActive}
            isLocked={user.isLocked}
            mustChangePassword={user.mustChangePassword}
          />
          {user.lastLoginAt && (
            <p className="text-xs text-text-muted">
              Last login:{' '}
              <span className="text-text-secondary">
                {new Date(user.lastLoginAt).toISOString().slice(0, 19).replace('T', ' ')} UTC
              </span>
            </p>
          )}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-text-primary mb-3">Actions</h4>
        <div className="flex flex-wrap gap-3">
          <ResetPasswordForm action={resetPasswordAction} />

          {user.isLocked && (
            <form action={unlockAction}>
              <button
                type="submit"
                className="h-9 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
              >
                Unlock account
              </button>
            </form>
          )}

          {user.isActive ? (
            <form action={deactivateAction}>
              <button
                type="submit"
                className="h-9 px-4 rounded-md border border-error bg-error-light text-error text-sm hover:bg-error/20 focus:outline-none focus:ring-2 focus:ring-focus"
              >
                Deactivate account
              </button>
            </form>
          ) : (
            <form action={activateAction}>
              <button
                type="submit"
                className="h-9 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
              >
                Activate account
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function EditUserTabs({
  user,
  roles,
  departments,
  plants,
  locations,
  moduleAccess,
  canManageAccess,
  canManageAll,
  updateProfileAction,
  updateOrgAction,
  assignRoleAction,
  resetPasswordActionBound,
  deactivateAction,
  activateAction,
  unlockAction,
  setModuleAccessAction,
}: Props): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const tabs: Tab[] = ['profile', 'organization', 'role', 'access', 'security'];

  return (
    <div>
      <div
        className="flex border-b border-border mb-6 -mx-8 px-8 overflow-x-auto"
        role="tablist"
        aria-label="User edit sections"
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 -mb-px focus:outline-none focus:ring-2 focus:ring-focus transition-colors',
              activeTab === tab
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-strong',
            ].join(' ')}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeTab === 'profile' && (
          <ProfileTab user={user} action={updateProfileAction} />
        )}
        {activeTab === 'organization' && (
          <OrgTab
            user={user}
            departments={departments}
            plants={plants}
            locations={locations}
            action={updateOrgAction}
          />
        )}
        {activeTab === 'role' && (
          <RoleTab user={user} roles={roles} action={assignRoleAction} />
        )}
        {activeTab === 'access' && (
          <>
            {moduleAccess !== null ? (
              <ModuleAccessPanel
                userId={user.id}
                moduleAccess={moduleAccess}
                allDepartments={departments.map((d) => ({ id: d.id, code: d.code, name: d.name }))}
                action={setModuleAccessAction}
                canManage={canManageAccess}
                canManageAll={canManageAll}
              />
            ) : (
              <p className="text-sm text-text-muted">Module access data unavailable.</p>
            )}
          </>
        )}
        {activeTab === 'security' && (
          <SecurityTab
            user={user}
            resetPasswordAction={resetPasswordActionBound}
            deactivateAction={deactivateAction}
            activateAction={activateAction}
            unlockAction={unlockAction}
          />
        )}
      </div>
    </div>
  );
}
