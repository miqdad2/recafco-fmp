'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import type { ActionResult } from '../../../../actions';

interface Props {
  orderId: string;
  boundAction: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
}

export function AddEntryForm({ orderId, boundAction }: Props): React.JSX.Element {
  const [entryType, setEntryType] = useState<string>('OUTPUT');
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    boundAction,
    { error: null },
  );

  return (
    <>
      {state.error && (
        <div className="mb-6 rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-6 rounded-lg border border-border bg-surface p-6">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Entry Type <span className="text-danger">*</span>
          </label>
          <div className="flex gap-6 flex-wrap">
            {(['OUTPUT', 'DOWNTIME', 'ADJUSTMENT'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={entryType === t}
                  onChange={() => setEntryType(t)}
                  className="accent-accent"
                />
                <span className="text-sm text-text-primary">
                  {t === 'OUTPUT' ? 'Output' : t === 'DOWNTIME' ? 'Downtime' : 'Adjustment'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {entryType === 'OUTPUT' && (
          <>
            <div>
              <label htmlFor="quantityProduced" className="block text-sm font-medium text-text-primary mb-1">
                Quantity Produced <span className="text-danger">*</span>
              </label>
              <input
                id="quantityProduced" name="quantityProduced" type="number" required min={0}
                placeholder="e.g. 100"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="quantityAccepted" className="block text-sm font-medium text-text-primary mb-1">Accepted</label>
                <input
                  id="quantityAccepted" name="quantityAccepted" type="number" min={0}
                  placeholder="e.g. 95"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label htmlFor="quantityRejected" className="block text-sm font-medium text-text-primary mb-1">Rejected</label>
                <input
                  id="quantityRejected" name="quantityRejected" type="number" min={0}
                  placeholder="e.g. 5"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>
          </>
        )}

        {entryType === 'DOWNTIME' && (
          <div>
            <label htmlFor="downtimeMinutes" className="block text-sm font-medium text-text-primary mb-1">
              Downtime (minutes) <span className="text-danger">*</span>
            </label>
            <input
              id="downtimeMinutes" name="downtimeMinutes" type="number" required min={0}
              placeholder="e.g. 30"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        )}

        {entryType === 'ADJUSTMENT' && (
          <div>
            <label htmlFor="adjustmentQty" className="block text-sm font-medium text-text-primary mb-1">
              Adjustment Quantity <span className="text-danger">*</span>
            </label>
            <input
              id="adjustmentQty" name="adjustmentQty" type="number" required
              placeholder="Positive to add, negative to subtract"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        )}

        <div>
          <label htmlFor="note" className="block text-sm font-medium text-text-primary mb-1">Note</label>
          <textarea
            id="note" name="note" rows={2} maxLength={2000}
            placeholder="Optional note about this entry…"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
          />
        </div>

        <div>
          <label htmlFor="recordedAt" className="block text-sm font-medium text-text-primary mb-1">Recorded At</label>
          <input
            id="recordedAt" name="recordedAt" type="datetime-local"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <p className="mt-1 text-xs text-text-muted">Leave blank to use the current time.</p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={`/production/${orderId}`}
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {isPending ? 'Saving…' : 'Add entry'}
          </button>
        </div>
      </form>
    </>
  );
}
