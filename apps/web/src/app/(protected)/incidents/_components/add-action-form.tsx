'use client';

import { useState, useActionState } from 'react';
import { addActionItemAction } from '../actions';
import type { ActionResult } from '../actions';
import type { UserRef } from '../../../../lib/incidents-api';

interface Props {
  incidentId: string;
  people: UserRef[];
}

export function AddActionItemForm({ incidentId, people }: Props): React.JSX.Element {
  const [show, setShow] = useState(false);
  const boundAction = addActionItemAction.bind(null, incidentId);
  const [state, dispatch, pending] = useActionState<ActionResult, FormData>(boundAction, { error: null });

  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        className="rounded-md border border-border bg-surface-secondary px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
      >
        + Add action item
      </button>
    );
  }

  return (
    <form action={dispatch} className="rounded-lg border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-text-primary">New corrective action</h4>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="text-xs text-text-muted hover:text-text-primary focus:outline-none"
        >
          Discard
        </button>
      </div>

      {state.error && (
        <p role="alert" className="text-xs text-danger">{state.error}</p>
      )}

      <div>
        <label htmlFor="action-title" className="block text-xs font-medium text-text-secondary">
          Title <span aria-hidden="true" className="text-danger">*</span>
        </label>
        <input
          id="action-title"
          name="title"
          type="text"
          required
          maxLength={300}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {state.fieldErrors?.['title']?.[0] && (
          <p className="mt-1 text-xs text-danger">{state.fieldErrors['title'][0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="action-description" className="block text-xs font-medium text-text-secondary">Description</label>
        <textarea
          id="action-description"
          name="description"
          rows={2}
          maxLength={2000}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="action-assignee" className="block text-xs font-medium text-text-secondary">
            Assigned to
          </label>
          <select
            id="action-assignee"
            name="assignedToUserId"
            className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">Unassigned</option>
            {people.map((u) => (
              <option key={u.id} value={u.id}>{u.displayName}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="action-due" className="block text-xs font-medium text-text-secondary">Due date</label>
          <input
            id="action-due"
            name="dueDate"
            type="date"
            className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add action'}
        </button>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="rounded-md border border-border bg-surface-secondary px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong focus:outline-none"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
