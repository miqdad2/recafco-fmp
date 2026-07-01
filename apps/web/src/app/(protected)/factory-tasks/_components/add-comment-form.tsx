'use client';

import { useActionState } from 'react';
import { addTaskCommentAction } from '../actions';
import type { ActionResult } from '../actions';

interface Props {
  taskId: string;
}

export function AddTaskCommentForm({ taskId }: Props): React.JSX.Element {
  const boundAction = addTaskCommentAction.bind(null, taskId);
  const [state, dispatch, pending] = useActionState<ActionResult, FormData>(boundAction, { error: null });

  return (
    <form action={dispatch} className="space-y-3">
      {(state.error ?? state.fieldErrors?.['body']?.[0]) && (
        <p role="alert" className="text-xs text-danger">
          {state.error ?? state.fieldErrors?.['body']?.[0]}
        </p>
      )}
      <textarea
        name="body"
        rows={3}
        maxLength={5000}
        placeholder="Add a comment…"
        className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? 'Posting…' : 'Post comment'}
      </button>
    </form>
  );
}
