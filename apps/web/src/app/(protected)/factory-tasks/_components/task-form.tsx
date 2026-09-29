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

const SELECT_CLASS = 'mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

interface Props {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  departments: OrgRef[];
  /** FMP-UI-20D — true only when the departments fetch itself failed (network/permission error) — distinct from a genuinely empty, successfully-fetched list. Drives which of the 2 different messages this form shows. */
  deptsFailed?: boolean | undefined;
  plants: OrgRef[];
  /** FMP-UI-20D — same distinction as `deptsFailed`, for plants/locations. */
  plantsFailed?: boolean | undefined;
  /** FMP-UI-20B — real people list for "Assign To User". Only passed (non-empty) when the current viewer holds `tasks.assign` — see new/page.tsx. Omitted entirely on the edit form, which has no assignment step of its own. */
  people?: UserRef[] | undefined;
  /** FMP-UI-20B — true only when `people` is real AND the viewer holds `tasks.assign`. Gates the whole "Assign To User" field — never shown/rendered when this is false, so nothing on the page implies assignment works when it doesn't. */
  canAssign?: boolean | undefined;
  canLinkIncident?: boolean | undefined;
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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      {children}
    </div>
  );
}

interface DepartmentAndPlantFieldsProps {
  departments: OrgRef[];
  deptsFailed: boolean;
  plants: OrgRef[];
  plantsFailed: boolean;
  defaultValues: Partial<FactoryTask> | undefined;
  fieldErrors: Record<string, string[]> | undefined;
}

/**
 * FMP-UI-20D — Responsible/Requesting Department + Plant/Location, shared
 * by both the create and edit Assignment cards (previously duplicated
 * verbatim between them). Never renders a `<select>` with options it
 * doesn't actually have:
 *   - `deptsFailed`/`plantsFailed` (the FETCH itself errored) shows a real
 *     error message, never a silently empty dropdown.
 *   - A successfully-fetched but genuinely EMPTY list shows the required
 *     "No active departments found…" copy instead of an empty `<select>`.
 *     The `responsibleDepartmentId` field is omitted from the DOM entirely
 *     in both of those cases — on the edit form this means the field is
 *     simply absent from the submitted FormData, which `updateDraftTaskAction`
 *     already treats as "leave this field unchanged" (never silently clears
 *     an existing selection); on the create form it means the required
 *     check in `createTaskAction` correctly blocks submission, matching the
 *     button being disabled for the same reason.
 */
function DepartmentAndPlantFields({ departments, deptsFailed, plants, plantsFailed, defaultValues, fieldErrors }: DepartmentAndPlantFieldsProps): React.JSX.Element {
  const hasExistingDept = Boolean(defaultValues?.responsibleDepartmentId);
  const deptsEmpty = !deptsFailed && departments.length === 0;

  return (
    <>
      <div>
        <label htmlFor="responsibleDepartmentId" className="block text-sm font-medium text-text-primary">
          Responsible Department <span aria-hidden="true" className="text-danger">*</span>
        </label>
        {deptsFailed ? (
          <p role="alert" className="mt-1 text-sm text-danger">Unable to load departments. Try again or contact admin.</p>
        ) : deptsEmpty ? (
          <p className="mt-1 text-sm text-text-muted">
            No active departments found. Please create departments in Administration first.
            {hasExistingDept && ' Your current department selection will be kept unchanged.'}
          </p>
        ) : (
          <select
            id="responsibleDepartmentId"
            name="responsibleDepartmentId"
            required
            defaultValue={defaultValues?.responsibleDepartmentId ?? ''}
            className={SELECT_CLASS}
          >
            <option value="">Select a department…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
            ))}
          </select>
        )}
        {deptsEmpty && !hasExistingDept && (
          <p role="alert" className="mt-1 text-xs text-danger">Responsible Department is required, but no active departments are available.</p>
        )}
        <p className="mt-1 text-xs text-text-muted">The department responsible for completing this task.</p>
        <FieldError errors={fieldErrors?.['responsibleDepartmentId']} />
      </div>

      <div>
        <label htmlFor="requestingDepartmentId" className="block text-sm font-medium text-text-primary">
          Requesting Department
        </label>
        <select
          id="requestingDepartmentId"
          name="requestingDepartmentId"
          defaultValue={defaultValues?.requestingDepartmentId ?? ''}
          className={SELECT_CLASS}
        >
          <option value="">Same as responsible / not specified</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-text-muted">The department requesting this task. Leave as same/not specified if not applicable.</p>
      </div>

      <div>
        <label htmlFor="plantId" className="block text-sm font-medium text-text-primary">
          Plant / Location
        </label>
        {plantsFailed ? (
          <p role="alert" className="mt-1 text-sm text-danger">Unable to load plants. Try again or contact admin.</p>
        ) : (
          <select
            id="plantId"
            name="plantId"
            defaultValue={defaultValues?.plantId ?? ''}
            className={SELECT_CLASS}
          >
            <option value="">{plants.length === 0 ? 'Not specified' : 'Select plant or location'}</option>
            {plants.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>
        )}
      </div>
    </>
  );
}

/**
 * FMP-UI-20B — the New Task / Edit Draft form, redesigned per direct
 * feedback that it read as "one long block" with no clear grouping and no
 * visible assignment step. Grouped into 4 section cards (Task Details /
 * Assignment / Priority & Schedule / Additional Details) matching this
 * unit's own required structure.
 *
 * The whole "Assign To User" field only renders when `canAssign` is true
 * (real people list + `tasks.assign` permission, computed by the page,
 * never assumed here) — for a viewer without that permission, this section
 * shows one plain sentence instead, never a field that would silently fail.
 *
 * FMP-UI-20C — "Save as Draft" / "Create & Assign Task" / "Create Draft"
 * read as internal lifecycle jargon to normal users, per direct feedback.
 * Collapsed to ONE footer button, always labelled "Create Task" (Cancel /
 * Create Task, nothing else) — whether the created task ends up assigned or
 * not is decided purely by whether the viewer picked someone in "Assign To
 * User", never by a second button the user has to understand.
 *
 * FMP-UI-20D — fixed Responsible/Requesting Department and Plant/Location
 * silently rendering with zero options (root cause: the page was calling
 * an admin-gated API — see new/page.tsx's own doc comment). This form now
 * distinguishes "the fetch failed" from "the fetch succeeded but returned
 * zero rows" (see `DepartmentAndPlantFields`) and disables the submit
 * button when Responsible Department is required but genuinely
 * unselectable (no options AND no existing value to fall back to).
 */
export function TaskForm({ action, submitLabel, departments, deptsFailed = false, plants, plantsFailed = false, people, canAssign, canLinkIncident, defaultValues }: Props): React.JSX.Element {
  const [state, dispatch, pending] = useActionState(action, { error: null });
  const isEdit = Boolean(defaultValues?.id);
  const hasExistingDept = Boolean(defaultValues?.responsibleDepartmentId);
  const blockSubmit = (deptsFailed || departments.length === 0) && !hasExistingDept;

  return (
    <form action={dispatch} className="space-y-5 max-w-2xl">
      {state.error && (
        <div role="alert" className="rounded-lg bg-danger-light border border-danger px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      <SectionCard title="Task Details">
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
      </SectionCard>

      {!isEdit && (
        <SectionCard title="Assignment">
          {canAssign && people ? (
            <div>
              <label htmlFor="assignedToUserId" className="block text-sm font-medium text-text-primary">
                Assign To User
              </label>
              <select
                id="assignedToUserId"
                name="assignedToUserId"
                defaultValue=""
                className={SELECT_CLASS}
              >
                <option value="">Select user to complete this task</option>
                {people.map((u) => (
                  <option key={u.id} value={u.id}>{u.displayName} (@{u.username})</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-text-muted">The selected user will see this task under My Tasks.</p>
            </div>
          ) : (
            <p className="text-xs text-text-muted">
              This task will be created under the selected responsible department.
            </p>
          )}

          <DepartmentAndPlantFields
            departments={departments}
            deptsFailed={deptsFailed}
            plants={plants}
            plantsFailed={plantsFailed}
            defaultValues={defaultValues}
            fieldErrors={state.fieldErrors}
          />
        </SectionCard>
      )}

      {isEdit && (
        <SectionCard title="Assignment">
          <DepartmentAndPlantFields
            departments={departments}
            deptsFailed={deptsFailed}
            plants={plants}
            plantsFailed={plantsFailed}
            defaultValues={defaultValues}
            fieldErrors={state.fieldErrors}
          />
        </SectionCard>
      )}

      <SectionCard title="Priority & Schedule">
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-text-primary">
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            defaultValue={defaultValues?.priority ?? 'MEDIUM'}
            className={SELECT_CLASS}
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="dueAt" className="block text-sm font-medium text-text-primary">
            Due Date / Time
          </label>
          <input
            id="dueAt"
            name="dueAt"
            type="datetime-local"
            defaultValue={toDatetimeLocal(defaultValues?.dueAt)}
            className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <p className="mt-1 text-xs text-text-muted">Set when this task should be completed.</p>
          <FieldError errors={state.fieldErrors?.['dueAt']} />
        </div>
      </SectionCard>

      {!isEdit && (
        <SectionCard title="Additional Details">
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
          <p className="text-xs text-text-muted">
            Attachments are not available for tasks yet. Comments can be added once this task has been created.
          </p>
        </SectionCard>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <a
          href={isEdit ? `/factory-tasks/${defaultValues?.id}` : '/factory-tasks/executive'}
          className="inline-flex items-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={pending || blockSubmit}
          title={blockSubmit ? 'Responsible Department is required, but no active departments are available.' : undefined}
          className="inline-flex items-center rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
