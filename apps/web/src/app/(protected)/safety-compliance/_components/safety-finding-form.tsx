'use client';

import { useState, useTransition } from 'react';
import { createFindingAction } from '../actions';

interface Props {
  inspectionId: string;
}

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

/**
 * FMP-UI-21D — the Findings card used to show "Use API to add findings"
 * instead of a real form, per the brief's own complaint. `createFindingAction`
 * (`actions.ts`) already existed and already worked (once this unit fixed
 * its stray `assignedToUserId` field — see that action's own doc comment)
 * but was never actually called by any page. This is that real form:
 * title/description/severity (all required, matching `CreateFindingDto`
 * exactly) plus optional action-required note and due date. Only rendered
 * by the parent page when `canDoCreateFinding` is true (IN_PROGRESS or
 * COMPLETED status AND the viewer holds `safety.finding_create`) — never
 * shown as a button that wouldn't work.
 */
export function SafetyFindingForm({ inspectionId }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<string>('MEDIUM');
  const [actionRequired, setActionRequired] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
      >
        + Record Finding
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <p className="text-sm font-medium text-text-primary">Record Finding</p>
      <div>
        <label htmlFor="finding-title" className="block text-xs font-medium text-text-secondary">
          Title <span aria-hidden="true" className="text-danger">*</span>
        </label>
        <input
          id="finding-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={300}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <div>
        <label htmlFor="finding-description" className="block text-xs font-medium text-text-secondary">
          Description <span aria-hidden="true" className="text-danger">*</span>
        </label>
        <textarea
          id="finding-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={10000}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <div>
        <label htmlFor="finding-severity" className="block text-xs font-medium text-text-secondary">Severity</label>
        <select
          id="finding-severity"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="finding-action" className="block text-xs font-medium text-text-secondary">Action required (optional)</label>
        <textarea
          id="finding-action"
          rows={2}
          value={actionRequired}
          onChange={(e) => setActionRequired(e.target.value)}
          maxLength={5000}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <div>
        <label htmlFor="finding-due" className="block text-xs font-medium text-text-secondary">Due date (optional)</label>
        <input
          id="finding-due"
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending || !title.trim() || !description.trim()}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const fd = new FormData();
              fd.set('title', title.trim());
              fd.set('description', description.trim());
              fd.set('severity', severity);
              if (actionRequired.trim()) fd.set('actionRequired', actionRequired.trim());
              if (dueAt) fd.set('dueAt', new Date(dueAt).toISOString());
              const result = await createFindingAction(inspectionId, { error: null }, fd);
              if (result?.error) setError(result.error);
            });
          }}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving…' : 'Record finding'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-border bg-surface-secondary px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
