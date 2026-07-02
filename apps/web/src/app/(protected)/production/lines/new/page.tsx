'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createProductionLineAction } from '../../actions';
import type { ActionResult } from '../../actions';

export default function NewProductionLinePage(): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    createProductionLineAction,
    { error: null },
  );

  return (
    <div className="min-h-full p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">New Production Line</h1>
          <p className="mt-1 text-sm text-text-muted">Add a factory production line that can be assigned to production orders.</p>
        </div>

        {state.error && (
          <div className="mb-6 rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-6 rounded-lg border border-border bg-surface p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-text-primary mb-1">
                Code <span className="text-danger">*</span>
              </label>
              <input
                id="code" name="code" type="text" required maxLength={32}
                placeholder="e.g. LINE-A"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent uppercase"
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-text-primary mb-1">
                Name <span className="text-danger">*</span>
              </label>
              <input
                id="name" name="name" type="text" required maxLength={200}
                placeholder="e.g. Assembly Line A"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-text-primary mb-1">Description</label>
            <textarea
              id="description" name="description" rows={2} maxLength={500}
              placeholder="Optional description…"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
            />
          </div>

          <div>
            <label htmlFor="capacity" className="block text-sm font-medium text-text-primary mb-1">Capacity (units/shift)</label>
            <input
              id="capacity" name="capacity" type="number" min={1}
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
              {isPending ? 'Creating…' : 'Create line'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
