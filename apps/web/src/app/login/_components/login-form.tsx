'use client';

import { useActionState, useState } from 'react';
import { AlertCircle, User, Lock, Eye, EyeOff } from 'lucide-react';
import type { LoginState } from '../actions';

interface Props {
  action: (prev: LoginState | null, formData: FormData) => Promise<LoginState | null>;
}

// FMP-UI-08 — visual polish only: the exact same `action`/`useActionState`
// wiring, `name`/`type`/`required`/`autoComplete` attributes, and error
// state as before — nothing about how credentials are submitted or
// validated changed, only how the fields and error message look.
//
// FMP-UI-08C — field spacing loosened (space-y-5 → space-y-6) and every
// focus ring switched from the generic blue `--color-focus` to RECAFCO's own
// brand colors: `ring-accent` (red) on the inputs, `ring-nav` (navy) on the
// button — a navy ring reads clearly against the button's own red fill,
// where a red-on-red ring would not. The button also gained a premium
// shadow. Nothing else about this form changed.
//
// FMP-UI-11 — the input focus ring moved from `ring-accent` (red) to
// `ring-nav` (navy): a red ring around a field with no actual error read as
// "this field has a problem" even when it didn't — the error banner above
// already uses `--color-error` (a different, more brick-toned red than
// `--color-accent`'s brighter RECAFCO red) specifically so an actual error
// state and a plain focus state are never the same color, per this unit's
// own "focus state and error state must be visually different" requirement.
//
// FMP-UI-12 — added a show/hide toggle inside the password field. Purely
// local UI state (`showPassword`) flipping the input's own `type` attribute
// between "password"/"text" — the field stays the same uncontrolled native
// input (no `value`/`onChange`), so toggling never clears or resets
// whatever the user has already typed. The toggle is a plain `type="button"`
// (never the form's implicit submit type) so it can never submit the form.
//
// FMP-UI-12B/12C — previously also cleared a `sessionStorage` "welcome
// already shown" flag here (on click, then on mount), to work around a
// once-per-tab skip guard on the welcome screen. FMP-UI-12F removed that
// guard entirely (the welcome screen now always shows after a real login),
// so there is no flag left to clear — this form only handles the actual
// sign-in submission again.
export function LoginForm({ action }: Props): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(action, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-error bg-error-light px-4 py-3 text-sm text-error"
        >
          <AlertCircle className="mt-0.5 size-4.5 shrink-0" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}

      <div>
        <label htmlFor="username" className="mb-1.5 block text-sm font-semibold text-text-primary">
          Username
        </label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input
            id="username"
            name="username"
            type="text"
            required
            autoComplete="username"
            autoFocus
            className="h-12 w-full rounded-lg border border-border bg-surface pl-11 pr-3 text-base text-text-primary transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-nav"
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-text-primary">
          Password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            className="h-12 w-full rounded-lg border border-border bg-surface pl-11 pr-11 text-base text-text-primary transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-nav"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={0}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded text-text-muted transition-colors hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-nav"
          >
            {showPassword ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="h-12 w-full rounded-lg bg-accent text-base font-semibold text-accent-foreground shadow-md transition-all hover:bg-accent-hover hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-nav focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
