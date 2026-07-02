'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createProductionOrderAction } from '../actions';
import type { ActionResult } from '../actions';

export default function NewProductionOrderPage(): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    createProductionOrderAction,
    { error: null },
  );

  return (
    <div className="min-h-full p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">New Production Order</h1>
          <p className="mt-1 text-sm text-text-muted">Create a new production order. Ref: PROD-YYYY-NNNNNN</p>
        </div>

        {state.error && (
          <div className="mb-6 rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-6 rounded-lg border border-border bg-surface p-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-text-primary mb-1">
              Title <span className="text-danger">*</span>
            </label>
            <input
              id="title" name="title" type="text" required maxLength={300}
              placeholder="e.g. Batch #2024-001 — Widget Assembly"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-text-primary mb-1">Description</label>
            <textarea
              id="description" name="description" rows={3} maxLength={10000}
              placeholder="Optional details about this production run…"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="productCode" className="block text-sm font-medium text-text-primary mb-1">Product Code</label>
              <input
                id="productCode" name="productCode" type="text" maxLength={100}
                placeholder="e.g. WGT-100"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label htmlFor="productName" className="block text-sm font-medium text-text-primary mb-1">Product Name</label>
              <input
                id="productName" name="productName" type="text" maxLength={300}
                placeholder="e.g. Standard Widget"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="targetQuantity" className="block text-sm font-medium text-text-primary mb-1">
                Target Quantity <span className="text-danger">*</span>
              </label>
              <input
                id="targetQuantity" name="targetQuantity" type="number" required min={1}
                placeholder="e.g. 500"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label htmlFor="unit" className="block text-sm font-medium text-text-primary mb-1">
                Unit <span className="text-danger">*</span>
              </label>
              <input
                id="unit" name="unit" type="text" required maxLength={50}
                placeholder="e.g. units, kg, m"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="scheduledStartAt" className="block text-sm font-medium text-text-primary mb-1">Scheduled Start</label>
              <input
                id="scheduledStartAt" name="scheduledStartAt" type="datetime-local"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label htmlFor="scheduledEndAt" className="block text-sm font-medium text-text-primary mb-1">Scheduled End</label>
              <input
                id="scheduledEndAt" name="scheduledEndAt" type="datetime-local"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/production"
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
            >
              {isPending ? 'Creating…' : 'Create order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
