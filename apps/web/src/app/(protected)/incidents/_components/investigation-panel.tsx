'use client';

import { useActionState } from 'react';
import { updateInvestigationAction } from '../actions';
import type { ActionResult } from '../actions';

interface Props {
  incidentId: string;
  rootCause: string | null;
  investigationSummary: string | null;
}

export function InvestigationPanel({ incidentId, rootCause, investigationSummary }: Props): React.JSX.Element {
  const boundAction = updateInvestigationAction.bind(null, incidentId);
  const [state, dispatch, pending] = useActionState<ActionResult, FormData>(boundAction, { error: null });

  return (
    <form action={dispatch} className="space-y-4">
      {state.error && (
        <div role="alert" className="rounded-lg border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="rootCause" className="block text-sm font-medium text-text-primary">
          Root cause
        </label>
        <textarea
          id="rootCause"
          name="rootCause"
          rows={4}
          maxLength={2000}
          defaultValue={rootCause ?? ''}
          placeholder="What was the underlying cause of this incident?"
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div>
        <label htmlFor="investigationSummary" className="block text-sm font-medium text-text-primary">
          Investigation summary
        </label>
        <textarea
          id="investigationSummary"
          name="investigationSummary"
          rows={6}
          maxLength={4000}
          defaultValue={investigationSummary ?? ''}
          placeholder="Describe the investigation findings in detail"
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? 'Saving…' : 'Save investigation'}
      </button>
    </form>
  );
}
