'use client';

import { useActionState } from 'react';
import type { ActionResult } from '../actions';
import type { Incident, OrgRef } from '../../../../lib/incidents-api';

const SEVERITIES = [
  { value: 'LOW',      label: 'Low — Minor impact, contained immediately' },
  { value: 'MEDIUM',   label: 'Medium — Moderate impact, brief disruption' },
  { value: 'HIGH',     label: 'High — Significant impact, recordable injury' },
  { value: 'CRITICAL', label: 'Critical — Severe impact, serious injury or regulatory violation' },
];

interface Props {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  plants: OrgRef[];
  departments: OrgRef[];
  defaultValues?: Partial<Incident> | undefined;
}

function FieldError({ errors }: { errors: string[] | undefined }): React.JSX.Element | null {
  if (!errors?.length) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-danger">
      {errors[0]}
    </p>
  );
}

export function IncidentForm({ action, submitLabel, plants, departments, defaultValues }: Props): React.JSX.Element {
  const [state, dispatch, pending] = useActionState(action, { error: null });

  const toLocalDatetime = (iso: string | undefined): string => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const pad = (n: number): string => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  return (
    <form action={dispatch} className="space-y-6 max-w-2xl">
      {state.error && (
        <div role="alert" className="rounded-lg bg-danger-light border border-danger px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-text-primary">
          Title <span aria-hidden="true" className="text-danger">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={300}
          defaultValue={defaultValues?.title}
          placeholder="Brief summary of what happened"
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <FieldError errors={state.fieldErrors?.['title']} />
      </div>

      {/* Severity */}
      <div>
        <label htmlFor="severity" className="block text-sm font-medium text-text-primary">
          Severity <span aria-hidden="true" className="text-danger">*</span>
        </label>
        <select
          id="severity"
          name="severity"
          required
          defaultValue={defaultValues?.severity ?? ''}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="" disabled>Select severity…</option>
          {SEVERITIES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <FieldError errors={state.fieldErrors?.['severity']} />
      </div>

      {/* Occurred at */}
      <div>
        <label htmlFor="occurredAt" className="block text-sm font-medium text-text-primary">
          Date and time of occurrence <span aria-hidden="true" className="text-danger">*</span>
        </label>
        <input
          id="occurredAt"
          name="occurredAt"
          type="datetime-local"
          required
          defaultValue={toLocalDatetime(defaultValues?.occurredAt)}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <FieldError errors={state.fieldErrors?.['occurredAt']} />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-text-primary">
          Description <span aria-hidden="true" className="text-danger">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={5}
          maxLength={10000}
          defaultValue={defaultValues?.description}
          placeholder="Describe what happened, where, and who was involved"
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <FieldError errors={state.fieldErrors?.['description']} />
      </div>

      {/* Immediate action */}
      <div>
        <label htmlFor="immediateAction" className="block text-sm font-medium text-text-primary">
          Immediate action taken
        </label>
        <textarea
          id="immediateAction"
          name="immediateAction"
          rows={3}
          maxLength={2000}
          defaultValue={defaultValues?.immediateAction ?? ''}
          placeholder="Describe any immediate containment or safety actions taken"
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Affected plant */}
      <div>
        <label htmlFor="affectedPlantId" className="block text-sm font-medium text-text-primary">
          Affected plant
        </label>
        <select
          id="affectedPlantId"
          name="affectedPlantId"
          defaultValue={defaultValues?.affectedPlantId ?? ''}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">None</option>
          {plants.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Affected department */}
      <div>
        <label htmlFor="affectedDepartmentId" className="block text-sm font-medium text-text-primary">
          Affected department
        </label>
        <select
          id="affectedDepartmentId"
          name="affectedDepartmentId"
          defaultValue={defaultValues?.affectedDepartmentId ?? ''}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">None</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Submit */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
