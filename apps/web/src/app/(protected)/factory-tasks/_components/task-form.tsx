'use client';

import { useActionState } from 'react';
import type { ActionResult } from '../actions';
import type { FactoryTask, OrgRef, UserRef } from '../../../../lib/factory-tasks-api';

const PRIORITIES = [
  { value: 'LOW',      label: 'Low' },
  { value: 'MEDIUM',   label: 'Medium' },
  { value: 'HIGH',     label: 'High' },
  { value: 'URGENT', label: 'Urgent — must be addressed immediately' },
];

interface Props {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  departments: OrgRef[];
  plants: OrgRef[];
  people?: UserRef[];
  canLinkIncident?: boolean;
  defaultValues?: Partial<FactoryTask> | undefined;
}

function FieldError({ errors }: { errors: string[] | undefined }): React.JSX.Element | null {
  if (!errors?.length) return null;
  return <p role="alert" className="mt-1 text-xs text-danger">{errors[0]}</p>;
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

export function TaskForm({ action, submitLabel, departments, plants, canLinkIncident, defaultValues }: Props): React.JSX.Element {
  const [state, dispatch, pending] = useActionState(action, { error: null });

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
          placeholder="Brief description of the task"
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <FieldError errors={state.fieldErrors?.['title']} />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-text-primary">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={5000}
          defaultValue={defaultValues?.description ?? ''}
          placeholder="Detailed instructions or context for the assignee"
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Priority */}
      <div>
        <label htmlFor="priority" className="block text-sm font-medium text-text-primary">
          Priority
        </label>
        <select
          id="priority"
          name="priority"
          defaultValue={defaultValues?.priority ?? 'MEDIUM'}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Responsible department */}
      <div>
        <label htmlFor="responsibleDepartmentId" className="block text-sm font-medium text-text-primary">
          Responsible department
        </label>
        <select
          id="responsibleDepartmentId"
          name="responsibleDepartmentId"
          defaultValue={defaultValues?.responsibleDepartmentId ?? ''}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Select a department…</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-text-muted">Required before a draft can be opened.</p>
      </div>

      {/* Requesting department */}
      <div>
        <label htmlFor="requestingDepartmentId" className="block text-sm font-medium text-text-primary">
          Requesting department
        </label>
        <select
          id="requestingDepartmentId"
          name="requestingDepartmentId"
          defaultValue={defaultValues?.requestingDepartmentId ?? ''}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Same as responsible / not specified</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
          ))}
        </select>
      </div>

      {/* Plant */}
      <div>
        <label htmlFor="plantId" className="block text-sm font-medium text-text-primary">
          Plant
        </label>
        <select
          id="plantId"
          name="plantId"
          defaultValue={defaultValues?.plantId ?? ''}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Not specified</option>
          {plants.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
          ))}
        </select>
      </div>

      {/* Due date */}
      <div>
        <label htmlFor="dueAt" className="block text-sm font-medium text-text-primary">
          Due date / time
        </label>
        <input
          id="dueAt"
          name="dueAt"
          type="datetime-local"
          defaultValue={toDatetimeLocal(defaultValues?.dueAt)}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Incident link (only if user has incidents.read) */}
      {canLinkIncident && (
        <div>
          <label htmlFor="incidentId" className="block text-sm font-medium text-text-primary">
            Linked incident reference
          </label>
          <input
            id="incidentId"
            name="incidentId"
            type="text"
            defaultValue={defaultValues?.incidentId ?? ''}
            placeholder="Incident ID (UUID)"
            className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <p className="mt-1 text-xs text-text-muted">Leave blank if this task is not linked to an incident.</p>
        </div>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
