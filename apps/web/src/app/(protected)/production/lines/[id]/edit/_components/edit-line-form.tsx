'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { ActionResult } from '../../../../actions';

interface Props {
  lineId: string;
  boundAction: (_prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  defaultValues: {
    name: string;
    description?: string;
    capacity?: number;
  };
}

export function EditLineForm({ boundAction, defaultValues }: Omit<Props, 'lineId'> & { lineId: string }): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    boundAction,
    { error: null },
  );

  return (
    <>
      {state.error && (
        <div className="mb-6 rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
          {state.error}
          {state.error.includes('refresh') && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ml-2 underline"
            >
              Refresh
            </button>
          )}
        </div>
      )}

      <form action={formAction} className="space-y-6 rounded-lg border border-border bg-surface p-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-text-primary mb-1">
            Name <span className="text-danger">*</span>
          </label>
          <input
            id="name" name="name" type="text" required maxLength={200}
            defaultValue={defaultValues.name}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-text-primary mb-1">Description</label>
          <textarea
            id="description" name="description" rows={3} maxLength={500}
            defaultValue={defaultValues.description ?? ''}
            placeholder="Optional description…"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
          />
        </div>

        <div>
          <label htmlFor="capacity" className="block text-sm font-medium text-text-primary mb-1">Capacity (units/shift)</label>
          <input
            id="capacity" name="capacity" type="number" min={1}
            defaultValue={defaultValues.capacity ?? ''}
            placeholder="e.g. 500"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <p className="mt-1 text-xs text-text-muted">Optional. Used for display and capacity planning only.</p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/production/lines"
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </>
  );
}
