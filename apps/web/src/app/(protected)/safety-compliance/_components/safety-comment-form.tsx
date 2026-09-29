'use client';

import { useActionState } from 'react';
import { addCommentAction } from '../actions';

interface Props {
  inspectionId: string;
}

/**
 * FMP-UI-21D — the Comments card used to post to a raw
 * `<form action="/safety-compliance/{id}/comments" method="POST">`, which
 * targets a path on the WEB APP's own origin, not the API — it never
 * actually worked. `addCommentAction` (`actions.ts`) already existed,
 * already worked, and was never actually called by any page. Wired here
 * via `useActionState`, matching every real create/edit FORM in this app
 * (as opposed to the multi-panel Available Actions component, which uses
 * `useTransition` instead — this is a single, simple form with one field,
 * exactly the shape `useActionState` fits).
 */
export function SafetyCommentForm({ inspectionId }: Props): React.JSX.Element {
  const [state, dispatch, pending] = useActionState(addCommentAction.bind(null, inspectionId), { error: null });

  return (
    <form action={dispatch} className="mt-4 border-t border-border pt-4">
      <label htmlFor="comment-body" className="block text-xs font-medium text-text-secondary mb-1">Add comment</label>
      <textarea
        id="comment-body"
        name="body"
        rows={3}
        maxLength={5000}
        required
        placeholder="Write a comment…"
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
      />
      {state.error && <p role="alert" className="mt-1 text-xs text-danger">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
      >
        {pending ? 'Posting…' : 'Post comment'}
      </button>
    </form>
  );
}
