'use client';

import { useActionState } from 'react';

export interface OrgEntityFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

type FormAction = (prevState: OrgEntityFormState | null, formData: FormData) => Promise<OrgEntityFormState | null>;

interface OrgEntityFormProps {
  action: FormAction;
  defaultValues?: {
    code?: string;
    name?: string;
    description?: string;
  };
  submitLabel: string;
  codeReadonly?: boolean;
}

export function OrgEntityForm({
  action,
  defaultValues,
  submitLabel,
  codeReadonly = false,
}: OrgEntityFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(action, null);

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
        <label htmlFor="code" className="block text-sm font-medium text-text-primary mb-1">
          Code <span aria-hidden="true" className="text-error">*</span>
        </label>
        <input
          id="code"
          name="code"
          type="text"
          required
          readOnly={codeReadonly}
          defaultValue={defaultValues?.code ?? ''}
          placeholder="e.g. DEPT-01"
          aria-describedby={state?.fieldErrors?.['code'] ? 'code-error' : undefined}
          className={[
            'w-full h-10 px-3 rounded-md border text-sm font-mono uppercase',
            'focus:outline-none focus:ring-2 focus:ring-focus',
            codeReadonly
              ? 'bg-surface-secondary text-text-muted border-border cursor-not-allowed'
              : 'bg-surface text-text-primary border-border',
            state?.fieldErrors?.['code'] ? 'border-error' : '',
          ].join(' ')}
        />
        {state?.fieldErrors?.['code'] && (
          <p id="code-error" role="alert" className="mt-1 text-xs text-error">
            {state.fieldErrors['code']?.join('. ')}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-text-primary mb-1">
          Name <span aria-hidden="true" className="text-error">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={defaultValues?.name ?? ''}
          placeholder="Full descriptive name"
          aria-describedby={state?.fieldErrors?.['name'] ? 'name-error' : undefined}
          className={[
            'w-full h-10 px-3 rounded-md border text-sm',
            'focus:outline-none focus:ring-2 focus:ring-focus bg-surface text-text-primary',
            state?.fieldErrors?.['name'] ? 'border-error' : 'border-border',
          ].join(' ')}
        />
        {state?.fieldErrors?.['name'] && (
          <p id="name-error" role="alert" className="mt-1 text-xs text-error">
            {state.fieldErrors['name']?.join('. ')}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-text-primary mb-1">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaultValues?.description ?? ''}
          placeholder="Optional description"
          className="w-full px-3 py-2 rounded-md border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-focus bg-surface text-text-primary"
        />
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
