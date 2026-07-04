'use client';

import { useActionState } from 'react';
import type { OrgEntity } from '@/lib/organizations-api';
import type { LocationEntity } from '@/lib/organizations-api';
import type { RoleSummary } from '@/lib/roles-api';

export interface UserFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  created?: {
    id: string;
    username: string;
    displayName: string;
    tempPassword: string;
  };
  passwordReset?: {
    username: string;
    tempPassword: string;
  };
}

type FormAction = (prev: UserFormState | null, formData: FormData) => Promise<UserFormState | null>;

interface Props {
  action: FormAction;
  submitLabel: string;
  isEdit?: boolean;
  defaultValues?: {
    username?: string;
    displayName?: string;
    email?: string;
    employeeNumber?: string;
    roleId?: string;
    departmentId?: string;
    plantId?: string;
    locationId?: string;
  };
  roles: RoleSummary[];
  departments: OrgEntity[];
  plants: OrgEntity[];
  locations: LocationEntity[];
}

function FieldError({ errors }: { errors: string[] | undefined }): React.JSX.Element | null {
  if (!errors?.length) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-error">
      {errors.join('. ')}
    </p>
  );
}

export function UserForm({
  action,
  submitLabel,
  isEdit = false,
  defaultValues = {},
  roles,
  departments,
  plants,
  locations,
}: Props): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(action, null);

  if (state?.created) {
    return (
      <div className="space-y-4 max-w-lg">
        <div className="rounded-md bg-success-light border border-success px-4 py-3 text-sm text-success-foreground">
          <p className="font-medium">User created successfully.</p>
          <p className="mt-1">
            Share the temporary password below with <strong>{state.created.displayName}</strong> (
            {state.created.username}). It will not be shown again.
          </p>
        </div>
        <div className="rounded-md bg-surface border border-border px-4 py-3">
          <p className="text-xs text-text-secondary mb-1">Temporary password</p>
          <p className="font-mono text-sm text-text-primary break-all">{state.created.tempPassword}</p>
        </div>
        <a
          href="/administration/users"
          className="inline-flex items-center h-10 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Back to users
        </a>
      </div>
    );
  }

  if (state?.passwordReset) {
    return (
      <div className="space-y-4 max-w-lg">
        <div className="rounded-md bg-success-light border border-success px-4 py-3 text-sm text-success-foreground">
          <p className="font-medium">Password reset successfully.</p>
          <p className="mt-1">
            Share the new temporary password with <strong>{state.passwordReset.username}</strong>. It
            will not be shown again.
          </p>
        </div>
        <div className="rounded-md bg-surface border border-border px-4 py-3">
          <p className="text-xs text-text-secondary mb-1">Temporary password</p>
          <p className="font-mono text-sm text-text-primary break-all">{state.passwordReset.tempPassword}</p>
        </div>
        <a
          href="/administration/users"
          className="inline-flex items-center h-10 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Back to users
        </a>
      </div>
    );
  }

  const inputCls = (field: string): string =>
    [
      'w-full h-10 px-3 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-focus bg-surface text-text-primary',
      state?.fieldErrors?.[field] ? 'border-error' : 'border-border',
    ].join(' ');

  return (
    <form action={formAction} className="space-y-5 max-w-lg">
      {state?.error && (
        <div
          role="alert"
          className="rounded-md bg-error-light border border-error px-4 py-3 text-sm text-error"
        >
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="username" className="block text-sm font-medium text-text-primary mb-1">
          Username <span aria-hidden="true" className="text-error">*</span>
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          readOnly={isEdit}
          defaultValue={defaultValues.username ?? ''}
          placeholder="e.g. john.doe"
          className={
            isEdit
              ? 'w-full h-10 px-3 rounded-md border border-border bg-surface-secondary text-text-muted text-sm cursor-not-allowed font-mono'
              : inputCls('username')
          }
        />
        <FieldError errors={state?.fieldErrors?.['username']} />
        {!isEdit && (
          <p className="mt-1 text-xs text-text-muted">3–50 characters; lowercase letters, digits, dots, hyphens, underscores.</p>
        )}
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
          defaultValue={defaultValues.displayName ?? ''}
          placeholder="Full name"
          className={inputCls('displayName')}
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
          defaultValue={defaultValues.email ?? ''}
          placeholder="optional@example.com"
          className={inputCls('email')}
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
          defaultValue={defaultValues.employeeNumber ?? ''}
          placeholder="e.g. EMP-001"
          className={inputCls('employeeNumber')}
        />
        <FieldError errors={state?.fieldErrors?.['employeeNumber']} />
      </div>

      <div>
        <label htmlFor="roleId" className="block text-sm font-medium text-text-primary mb-1">
          Role <span aria-hidden="true" className="text-error">*</span>
        </label>
        <select
          id="roleId"
          name="roleId"
          defaultValue={defaultValues.roleId ?? ''}
          className="w-full h-10 px-3 rounded-md border border-border bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <option value="">— Default (Viewer) —</option>
          {roles.filter((r) => r.isActive).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <FieldError errors={state?.fieldErrors?.['roleId']} />
      </div>

      <div>
        <label htmlFor="departmentId" className="block text-sm font-medium text-text-primary mb-1">
          Department
        </label>
        <select
          id="departmentId"
          name="departmentId"
          defaultValue={defaultValues.departmentId ?? ''}
          className="w-full h-10 px-3 rounded-md border border-border bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <option value="">— None —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} — {d.name}
            </option>
          ))}
        </select>
        <FieldError errors={state?.fieldErrors?.['departmentId']} />
      </div>

      <div>
        <label htmlFor="plantId" className="block text-sm font-medium text-text-primary mb-1">
          Plant
        </label>
        <select
          id="plantId"
          name="plantId"
          defaultValue={defaultValues.plantId ?? ''}
          className="w-full h-10 px-3 rounded-md border border-border bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <option value="">— None —</option>
          {plants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
        <FieldError errors={state?.fieldErrors?.['plantId']} />
      </div>

      <div>
        <label htmlFor="locationId" className="block text-sm font-medium text-text-primary mb-1">
          Location
        </label>
        <select
          id="locationId"
          name="locationId"
          defaultValue={defaultValues.locationId ?? ''}
          className="w-full h-10 px-3 rounded-md border border-border bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <option value="">— None —</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code} — {l.name}
              {l.plant ? ` (${l.plant.code})` : ''}
            </option>
          ))}
        </select>
        <FieldError errors={state?.fieldErrors?.['locationId']} />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="h-10 px-5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-focus"
        >
          {isPending ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
