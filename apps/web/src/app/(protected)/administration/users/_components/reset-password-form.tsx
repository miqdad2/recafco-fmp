'use client';

import { useActionState } from 'react';
import type { UserFormState } from './user-form';

interface Props {
  action: (prev: UserFormState | null, formData: FormData) => Promise<UserFormState | null>;
}

export function ResetPasswordForm({ action }: Props): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(action, null);

  if (state?.passwordReset) {
    return (
      <div className="space-y-3">
        <div className="rounded-md bg-success-light border border-success px-4 py-3 text-sm text-success-foreground">
          <p className="font-medium">Password reset.</p>
          <p className="mt-1">
            Share this temporary password with <strong>{state.passwordReset.username}</strong>. It will
            not be shown again.
          </p>
        </div>
        <div className="rounded-md bg-surface border border-border px-4 py-3">
          <p className="text-xs text-text-secondary mb-1">Temporary password</p>
          <p className="font-mono text-sm text-text-primary break-all">{state.passwordReset.tempPassword}</p>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      {state?.error && (
        <p role="alert" className="text-xs text-error">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="h-9 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-focus"
      >
        {isPending ? 'Resetting…' : 'Reset password'}
      </button>
    </form>
  );
}
