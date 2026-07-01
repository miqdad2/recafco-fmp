'use client';

import { useActionState } from 'react';
import type { OrgEntity } from '@/lib/organizations-api';

export interface LocationFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

type FormAction = (prevState: LocationFormState | null, formData: FormData) => Promise<LocationFormState | null>;

interface LocationFormProps {
  action: FormAction;
  defaultValues?: {
    code?: string;
    name?: string;
    description?: string;
    plantId?: string | null;
  };
  plants: OrgEntity[];
  submitLabel: string;
  codeReadonly?: boolean;
}

export function LocationForm({
  action,
  defaultValues,
  plants,
  submitLabel,
  codeReadonly = false,
}: LocationFormProps): React.JSX.Element {
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
          placeholder="e.g. LOC-A1"
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
          <p role="alert" className="mt-1 text-xs text-error">
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
          className="w-full h-10 px-3 rounded-md border border-border text-sm focus:outline-none focus:ring-2 focus:ring-focus bg-surface text-text-primary"
        />
        {state?.fieldErrors?.['name'] && (
          <p role="alert" className="mt-1 text-xs text-error">
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
          className="w-full px-3 py-2 rounded-md border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-focus bg-surface text-text-primary"
        />
      </div>

      <div>
        <label htmlFor="plantId" className="block text-sm font-medium text-text-primary mb-1">
          Plant <span className="text-text-muted font-normal">(optional)</span>
        </label>
        <select
          id="plantId"
          name="plantId"
          defaultValue={defaultValues?.plantId ?? ''}
          className="w-full h-10 px-3 rounded-md border border-border text-sm focus:outline-none focus:ring-2 focus:ring-focus bg-surface text-text-primary"
        >
          <option value="">— No plant —</option>
          {plants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
        {state?.fieldErrors?.['plantId'] && (
          <p role="alert" className="mt-1 text-xs text-error">
            {state.fieldErrors['plantId']?.join('. ')}
          </p>
        )}
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
