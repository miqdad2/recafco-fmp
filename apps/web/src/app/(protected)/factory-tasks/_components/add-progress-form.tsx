'use client';

import { useActionState } from 'react';
import { addProgressAction } from '../actions';
import type { ActionResult } from '../actions';

interface Props {
  taskId: string;
}

export function AddProgressForm({ taskId }: Props): React.JSX.Element {
  const boundAction = addProgressAction.bind(null, taskId);
  const [state, dispatch, pending] = useActionState<ActionResult, FormData>(boundAction, { error: null });

  return (
    <form action={dispatch} className="space-y-3">
      {(state.error ?? state.fieldErrors?.['note']?.[0]) && (
        <p role="alert" className="text-xs text-danger">
          {state.error ?? state.fieldErrors?.['note']?.[0]}
        </p>
      )}

      <div className="flex items-end gap-3">
        <div className="w-32">
          <label htmlFor="progress-percent" className="block text-xs font-medium text-text-secondary mb-1">
            % complete (optional)
          </label>
          <input
            id="progress-percent"
            name="progressPercent"
            type="number"
            min={0}
            max={100}
            step={1}
            placeholder="0–100"
            className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <p className="text-xs text-text-muted pb-2">Leave blank to skip updating percentage.</p>
      </div>

      <div>
        <label htmlFor="progress-note" className="block text-xs font-medium text-text-secondary mb-1">
          Progress note <span aria-hidden="true" className="text-danger">*</span>
        </label>
        <textarea
          id="progress-note"
          name="note"
          rows={3}
          maxLength={2000}
          placeholder="Describe what has been done so far…"
          className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? 'Saving…' : 'Add progress note'}
      </button>
    </form>
  );
}
