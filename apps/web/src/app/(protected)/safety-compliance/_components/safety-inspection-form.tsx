'use client';

import { useActionState } from 'react';
import type { ActionResult } from '../actions';

interface OrgItem {
  id: string;
  code: string;
  name: string;
}

interface Props {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  cancelHref: string;
  departments: OrgItem[];
  /** FMP-UI-21C — true when the departments FETCH ITSELF failed (not just returned zero rows) — shows a real error instead of a silently empty dropdown. */
  deptsFailed?: boolean;
  plants: OrgItem[];
  /** FMP-UI-21C — same distinction as `deptsFailed`, for plants. */
  plantsFailed?: boolean;
  defaultValues?: {
    title?: string;
    summary?: string;
    departmentId?: string;
    plantId?: string;
  };
}

/**
 * FMP-UI-21B — extracted from `new/page.tsx`'s own inline function component.
 * The inline version rendered `<form action={action as unknown as string}>`
 * directly on a plain (server-rendered) `<form>`, with NO `useActionState` —
 * but `createInspectionAction`'s real signature is
 * `(prevState: ActionResult, formData: FormData)`, the shape React's
 * `useActionState` is specifically built to call. A plain `<form
 * action={fn}>` calls `fn(formData)` with ONE argument: `formData` ends up
 * bound to the `prevState` parameter, and the actual `formData` parameter
 * inside the action is `undefined` — the exact
 * "Cannot read properties of undefined (reading 'get')" crash reported.
 * The `as unknown as string` cast is what let this slip past TypeScript:
 * it forced an incompatible value through the `action` prop's real type
 * instead of surfacing the mismatch at compile time.
 *
 * Fixed the same way every other create/edit form in this app already
 * does it (see `factory-tasks/_components/task-form.tsx`): a client
 * component, `useActionState(action, { error: null })`, and
 * `<form action={dispatch}>` — `dispatch` is what actually supplies both
 * arguments correctly on every submit. Also added the error banner and a
 * "creating…" pending state, which the old inline form had neither of.
 *
 * FMP-UI-21C — `deptsFailed`/`plantsFailed` added, mirroring
 * `task-form.tsx`'s `DepartmentAndPlantFields` (FMP-UI-20D). Never renders
 * a `<select>` with options it doesn't actually have: a genuine fetch
 * FAILURE shows a real error; a successful fetch that returns zero ACTIVE
 * departments shows "No active departments found…" instead of a silently
 * empty "— None —"-only dropdown. Department/Plant are both optional for
 * a safety inspection (`CreateInspectionDto`), so unlike the Task form's
 * REQUIRED department, nothing here blocks submission — "— None —" alone
 * is a valid, real choice, not a fallback for missing data.
 */
export function SafetyInspectionForm({
  action,
  submitLabel,
  cancelHref,
  departments: depts,
  deptsFailed = false,
  plants: plantsData,
  plantsFailed = false,
  defaultValues,
}: Props): React.JSX.Element {
  const [state, dispatch, pending] = useActionState(action, { error: null });
  const deptsEmpty = !deptsFailed && depts.length === 0;
  const plantsEmpty = !plantsFailed && plantsData.length === 0;

  return (
    <form action={dispatch} className="space-y-6 rounded-lg border border-border bg-surface p-6">
      {state.error && (
        <div role="alert" className="rounded-lg border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-text-primary mb-1">
          Title <span className="text-danger">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={300}
          defaultValue={defaultValues?.title}
          placeholder="Brief description of the inspection"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div>
        <label htmlFor="summary" className="block text-sm font-medium text-text-primary mb-1">
          Summary
        </label>
        <textarea
          id="summary"
          name="summary"
          rows={4}
          maxLength={10000}
          defaultValue={defaultValues?.summary}
          placeholder="Describe the scope and objectives of this inspection…"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="departmentId" className="block text-sm font-medium text-text-primary mb-1">Department</label>
          {deptsFailed ? (
            <p role="alert" className="text-sm text-danger">Unable to load departments. Try again or contact admin.</p>
          ) : deptsEmpty ? (
            <p className="text-sm text-text-muted">No active departments found. Please configure departments in Administration.</p>
          ) : (
            <select
              id="departmentId"
              name="departmentId"
              defaultValue={defaultValues?.departmentId ?? ''}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">— None —</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label htmlFor="plantId" className="block text-sm font-medium text-text-primary mb-1">Plant</label>
          {plantsFailed ? (
            <p role="alert" className="text-sm text-danger">Unable to load plants. Try again or contact admin.</p>
          ) : (
            <select
              id="plantId"
              name="plantId"
              defaultValue={defaultValues?.plantId ?? ''}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">— None —</option>
              {plantsData.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          )}
          {plantsEmpty && (
            <p className="mt-1 text-xs text-text-muted">No plants exist yet — this list will populate once plants are added in Administration.</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <a
          href={cancelHref}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
        >
          {pending ? 'Creating…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
