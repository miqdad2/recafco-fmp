'use client';

import { useActionState } from 'react';
import type { ChangePasswordState } from '../actions';

interface Props {
  action: (prev: ChangePasswordState | null, formData: FormData) => Promise<ChangePasswordState | null>;
}

export function ChangePasswordForm({ action }: Props): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div
          role="alert"
          className="rounded-md bg-error-light border border-error px-4 py-3 text-sm text-error"
        >
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="currentPassword" className="block text-sm font-medium text-text-primary mb-1">
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          autoFocus
          className="w-full h-10 px-3 rounded-md border border-border bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus"
        />
      </div>

      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-text-primary mb-1">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          autoComplete="new-password"
          className={[
            'w-full h-10 px-3 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-focus bg-surface text-text-primary',
            state?.fieldErrors?.['newPassword'] ? 'border-error' : 'border-border',
          ].join(' ')}
        />
        {state?.fieldErrors?.['newPassword'] && (
          <p role="alert" className="mt-1 text-xs text-error">
            {state.fieldErrors['newPassword']?.join('. ')}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-text-primary mb-1">
          Confirm new password
        </label>
        <input
          id="confirmNewPassword"
          name="confirmNewPassword"
          type="password"
          required
          autoComplete="new-password"
          className={[
            'w-full h-10 px-3 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-focus bg-surface text-text-primary',
            state?.fieldErrors?.['confirmNewPassword'] ? 'border-error' : 'border-border',
          ].join(' ')}
        />
        {state?.fieldErrors?.['confirmNewPassword'] && (
          <p role="alert" className="mt-1 text-xs text-error">
            {state.fieldErrors['confirmNewPassword']?.join('. ')}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full h-10 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-focus"
      >
        {isPending ? 'Changing…' : 'Change password'}
      </button>
    </form>
  );
}
