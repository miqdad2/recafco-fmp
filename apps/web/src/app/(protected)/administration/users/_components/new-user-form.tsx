'use client';

import { useActionState, useState } from 'react';
import type { OrgEntity, LocationEntity } from '@/lib/organizations-api';
import type { RoleSummary, PermissionSummary } from '@/lib/roles-api';
import { RolePermissionSummary } from './role-permission-summary';
import { ModuleAccessEditor } from './module-access-editor';
import type { CreateWithAccessState } from '../actions';

export interface RoleWithPerms extends RoleSummary {
  permissions: PermissionSummary[];
}

interface Props {
  action: (prev: CreateWithAccessState, formData: FormData) => Promise<CreateWithAccessState>;
  roles: RoleWithPerms[];
  departments: OrgEntity[];
  plants: OrgEntity[];
  locations: LocationEntity[];
  canManageAll: boolean;
}

function FieldError({ errors }: { errors: string[] | undefined }): React.JSX.Element | null {
  if (!errors?.length) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-error">
      {errors.join('. ')}
    </p>
  );
}

function SectionHeader({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description?: string;
}): React.JSX.Element {
  return (
    <div className="flex items-start gap-3 mb-5">
      <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-accent text-accent-foreground text-xs font-semibold mt-0.5">
        {number}
      </span>
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex-shrink-0 h-8 px-3 rounded-md border border-border bg-surface text-xs text-text-secondary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

const inputCls = (hasError?: boolean): string =>
  [
    'w-full h-10 px-3 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-focus bg-surface text-text-primary',
    hasError ? 'border-error' : 'border-border',
  ].join(' ');

const selectCls =
  'w-full h-10 px-3 rounded-md border border-border bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus';

export function NewUserForm({
  action,
  roles,
  departments,
  plants,
  locations,
  canManageAll,
}: Props): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(action, null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedPlantId, setSelectedPlantId] = useState('');
  const [hasDept, setHasDept] = useState(true);

  if (state?.created) {
    const failures = state.created.accessFailures;
    return (
      <div className="space-y-5 max-w-2xl">
        {failures && failures.length > 0 && (
          <div
            role="alert"
            className="rounded-md bg-warning-light border border-warning/30 px-4 py-3 text-sm text-warning"
          >
            <p className="font-medium">User created — some module access scopes could not be applied.</p>
            <p className="mt-1 text-xs">
              The following modules will default to My Department. Go to the user to retry:
            </p>
            <ul className="mt-1.5 list-disc list-inside text-xs space-y-0.5">
              {failures.map((f) => (
                <li key={f.module}>
                  <strong>{f.module}</strong>: {f.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          className={`rounded-md px-4 py-3 text-sm ${
            failures?.length
              ? 'bg-surface border border-border'
              : 'bg-success-light border border-success text-success-foreground'
          }`}
        >
          <p className="font-medium">User &ldquo;{state.created.username}&rdquo; created successfully.</p>
          <p className="mt-1 text-xs text-text-secondary">
            Share the temporary password with <strong>{state.created.displayName}</strong>. It will not
            be shown again.
          </p>
        </div>

        <div className="rounded-md bg-surface border border-border px-4 py-3">
          <p className="text-xs text-text-secondary mb-1">Temporary password</p>
          <div className="flex items-center gap-3">
            <p className="font-mono text-sm text-text-primary break-all flex-1">
              {state.created.tempPassword}
            </p>
            <CopyButton text={state.created.tempPassword} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href={`/administration/users/${state.created.id}/edit`}
            className="inline-flex items-center h-10 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Go to User
          </a>
          <a
            href="/administration/users/new"
            className="inline-flex items-center h-10 px-4 rounded-md border border-border bg-surface text-text-primary text-sm font-medium hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Create Another User
          </a>
          <a
            href="/administration/users"
            className="inline-flex items-center h-10 px-4 rounded-md border border-border bg-surface text-text-primary text-sm font-medium hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Back to Users
          </a>
        </div>
      </div>
    );
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const filteredLocations = selectedPlantId
    ? locations.filter((l) => !l.plantId || l.plantId === selectedPlantId)
    : locations;

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      {state?.error && (
        <div
          role="alert"
          className="rounded-md bg-error-light border border-error px-4 py-3 text-sm text-error"
        >
          {state.error}
        </div>
      )}

      {/* Section 1: Account Information */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <SectionHeader number={1} title="Account Information" />
        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-text-primary mb-1">
              Username <span aria-hidden="true" className="text-error">*</span>
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="off"
              placeholder="e.g. john.doe"
              className={inputCls(!!state?.fieldErrors?.['username'])}
            />
            <FieldError errors={state?.fieldErrors?.['username']} />
            <p className="mt-1 text-xs text-text-muted">
              3–50 characters; lowercase letters, digits, dots, hyphens, underscores.
            </p>
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
              placeholder="Full name"
              className={inputCls(!!state?.fieldErrors?.['displayName'])}
            />
            <FieldError errors={state?.fieldErrors?.['displayName']} />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="optional@example.com"
              className={inputCls(!!state?.fieldErrors?.['email'])}
            />
            <FieldError errors={state?.fieldErrors?.['email']} />
          </div>
          <div>
            <label htmlFor="employeeNumber" className="block text-sm font-medium text-text-primary mb-1">
              Employee number
            </label>
            <input
              id="employeeNumber"
              name="employeeNumber"
              type="text"
              placeholder="e.g. EMP-001"
              className={inputCls(!!state?.fieldErrors?.['employeeNumber'])}
            />
            <FieldError errors={state?.fieldErrors?.['employeeNumber']} />
          </div>
        </div>
      </div>

      {/* Section 2: Organization Assignment */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <SectionHeader
          number={2}
          title="Organization Assignment"
          description="Assign the user to their primary organizational unit."
        />
        {!hasDept && (
          <div className="mb-4 rounded-md bg-warning-light border border-warning/30 px-4 py-3 text-xs text-warning">
            Users without a primary department cannot access department-scoped operational records
            unless explicit company-wide access is granted.
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label htmlFor="departmentId" className="block text-sm font-medium text-text-primary mb-1">
              Primary Department
            </label>
            <select
              id="departmentId"
              name="departmentId"
              className={selectCls}
              onChange={(e) => setHasDept(!!e.target.value)}
            >
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
            <select id="locationId" name="locationId" className={selectCls}>
              <option value="">— None —</option>
              {filteredLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.name}
                  {l.plant ? ` (${l.plant.code})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Section 3: Role and Permissions */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <SectionHeader
          number={3}
          title="Role and Permissions"
          description="The role defines what actions the user can perform in each module."
        />
        <div className="space-y-4">
          <div>
            <label htmlFor="roleId" className="block text-sm font-medium text-text-primary mb-1">
              Role <span aria-hidden="true" className="text-error">*</span>
            </label>
            <select
              id="roleId"
              name="roleId"
              className={selectCls}
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
            >
              <option value="">— Default (Viewer) —</option>
              {roles
                .filter((r) => r.isActive)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
            <FieldError errors={state?.fieldErrors?.['roleId']} />
          </div>

          {selectedRole ? (
            <div>
              <p className="text-xs text-text-muted mb-2">Permissions for this role:</p>
              <RolePermissionSummary permissions={selectedRole.permissions} />
            </div>
          ) : (
            <p className="text-xs text-text-muted">Select a role above to preview its permissions.</p>
          )}

          <p className="text-xs text-info bg-info-light border border-info/20 rounded-md px-3 py-2">
            Role controls actions. Scope controls which department records are visible.
          </p>
        </div>
      </div>

      {/* Section 4: Module Access */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <SectionHeader
          number={4}
          title="Module Access"
          description="Set the department scope for each module. Leave as My Department (default) if unsure."
        />
        <ModuleAccessEditor
          allDepartments={departments.map((d) => ({ id: d.id, code: d.code, name: d.name }))}
          canManageAll={canManageAll}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="h-10 px-5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-focus"
        >
          {isPending ? 'Creating…' : 'Create User'}
        </button>
        <a
          href="/administration/users"
          className="inline-flex items-center h-10 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
