'use client';

import { useActionState, useState, useEffect, startTransition } from 'react';
import { EvidenceFilePicker } from './evidence-file-picker';
import { stageEvidenceFiles } from '../_lib/evidence-validation';
import type { StagedEvidenceFile } from '../_lib/evidence-validation';
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
  plantsFailed?: boolean;
  departments: OrgRef[];
  deptsFailed?: boolean;
  locations: OrgRef[];
  locationsFailed?: boolean;
  defaultValues?: Partial<Incident> | undefined;
  /** FMP-INC-01C — renders a real, optional evidence-staging section (was a static info-only note in FMP-INC-01B). Only true on the CREATE form (`new/page.tsx`) — the Edit Draft form (`[id]/edit/page.tsx`) edits an incident that already has a real id, so its own detail page's Evidence Attachments section is already reachable there. */
  showEvidenceUpload?: boolean;
}

function FieldError({ errors }: { errors: string[] | undefined }): React.JSX.Element | null {
  if (!errors?.length) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-danger">
      {errors[0]}
    </p>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      {children}
    </div>
  );
}

/** Real fetch failure vs. a successful fetch that just found zero rows — never a silently empty `<select>`, matching `DepartmentAndPlantFields` (factory-tasks) / `SafetyInspectionForm`'s own established pattern. Plant/Department/Location are all OPTIONAL for an incident report, so — unlike Factory Tasks' required Responsible Department — nothing here ever blocks submission. */
function OrgSelect({
  id, name, label, options, failed, defaultValue,
}: {
  id: string; name: string; label: string; options: OrgRef[]; failed: boolean; defaultValue: string | undefined;
}): React.JSX.Element {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text-primary">{label}</label>
      {failed ? (
        <p role="alert" className="mt-1 text-sm text-danger">Unable to load {label.toLowerCase()} options. Try again or contact admin.</p>
      ) : options.length === 0 ? (
        <p className="mt-1 text-sm text-text-muted">No {label.toLowerCase()} options found.</p>
      ) : (
        <select
          id={id}
          name={name}
          defaultValue={defaultValue ?? ''}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">None</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}

/**
 * FMP-UI-22 — grouped into the brief's own 3 sections (Incident Details /
 * Immediate Response / Location); "People involved / witnesses" and
 * "Injury / damage indicators" (both brief-requested, both "if already
 * supported") are omitted — `CreateIncidentDto` has no fields for either.
 * "Location / area" WAS already supported (`affectedLocationId` on the
 * DTO, already read by `createIncidentAction`) but the OLD form never
 * exposed it — added here for the first time.
 *
 * The old subtitle-level "Your report is saved as a draft until you
 * submit." is gone — the brief explicitly forbids making "draft" the
 * page's main message. A small, non-alarming info note near the submit
 * button covers the same real fact instead.
 *
 * FMP-INC-01C — the create form's Evidence Attachments section (when
 * `showEvidenceUpload`) is now a REAL, OPTIONAL file-staging area
 * (`EvidenceFilePicker`), not just an information note (FMP-INC-01B) —
 * staged files are merged into this form's own FormData on submit (see
 * `handleSubmit` below) and uploaded by `createIncidentAction` right
 * after the incident itself is created, reusing the exact same
 * `uploadAttachmentAction`-backed upload path the Incident Detail page
 * already uses (FMP-INC-01). Switched the form from a plain
 * `<form action={dispatch}>` to `onSubmit` so the staged `File` objects
 * (which live in this component's own React state, never inside the
 * native form's DOM) can be appended to the FormData before `dispatch`
 * is called — `dispatch()` (returned by `useActionState`) can be invoked
 * directly with any FormData, not only one a real submit event produced.
 *
 * FMP-INC-01D — that manual `dispatch(formData)` call from FMP-INC-01C was
 * itself the exact cause of the console warning "An async function with
 * useActionState was called outside of a transition": calling `dispatch`
 * outside `<form action={dispatch}>`'s own automatic wrapping needs an
 * explicit `startTransition(() => dispatch(formData))` (React's own
 * documented "Approach B" for this situation) — now fixed in
 * `handleSubmit`. Also fixed in the same pass: `occurredAt` is converted
 * from the raw `datetime-local` value to a real UTC ISO string
 * (`.toISOString()`) before submission, so the backend's future-date
 * check compares real instants instead of a timezone-ambiguous naive
 * string; and a client-only-computed `max` attribute (set after mount, in
 * an effect, to avoid a server/client hydration mismatch from computing
 * "now" during render) gives most browsers' native picker a real UX hint
 * — the server's own `validateOccurredAt()` remains the actual,
 * unbypassable check either way.
 */
export function IncidentForm({
  action, submitLabel, plants, plantsFailed = false, departments, deptsFailed = false,
  locations, locationsFailed = false, defaultValues, showEvidenceUpload = false,
}: Props): React.JSX.Element {
  const [state, dispatch, pending] = useActionState(action, { error: null });
  const [staged, setStaged] = useState<StagedEvidenceFile[]>([]);

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

  // FMP-INC-01D — `new Date()` must NEVER run directly in this component's
  // render body: this is a client component, but it's still
  // SERVER-rendered for the initial HTML, then hydrated in the browser —
  // computing "now" during render would embed the SERVER's clock/timezone
  // into the SSR output while the CLIENT's hydration pass computes a
  // DIFFERENT value from the BROWSER's own clock, a real hydration
  // mismatch. Computed once, after mount, in an effect instead — the
  // first render (both SSR and the initial client pass) has no `max` at
  // all, then a harmless follow-up render adds it purely client-side.
  // This is a UX helper only (most browsers block picking a later
  // date/time in their native picker); the server's own
  // `validateOccurredAt()` remains the real, unbypassable check.
  const [maxOccurredAt, setMaxOccurredAt] = useState<string | undefined>(undefined);
  useEffect(() => {
    setMaxOccurredAt(toLocalDatetime(new Date().toISOString()));
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // FMP-INC-01D — the raw `<input type="datetime-local">` value (e.g.
    // "2026-09-28T14:25") carries NO timezone of its own. Sent as-is, the
    // API's `new Date(dto.occurredAt)` would interpret it as local time
    // IN WHATEVER TIMEZONE THE SERVER PROCESS RUNS, not the user's own —
    // a real false-positive/false-negative future-date risk whenever
    // those differ. `new Date(localValue)` in the BROWSER correctly
    // assumes the BROWSER's own local timezone, so converting to a real
    // UTC ISO string (`.toISOString()`, always ends in "Z") HERE, before
    // it ever leaves the client, makes the server's comparison
    // unambiguous and timezone-safe.
    const occurredAtLocal = formData.get('occurredAt') as string | null;
    if (occurredAtLocal) {
      const parsed = new Date(occurredAtLocal);
      if (!isNaN(parsed.getTime())) formData.set('occurredAt', parsed.toISOString());
    }

    for (const { file, error } of staged) {
      if (!error) formData.append('evidenceFiles', file);
    }

    // FMP-INC-01D — `dispatch` (useActionState's own returned action) was
    // being called directly from this plain event handler, which is NOT
    // itself a transition — React warns "An async function with
    // useActionState was called outside of a transition" and `pending`
    // does not reliably track this call. `<form action={dispatch}>` (the
    // old wiring, before FMP-INC-01C) avoided this because React wraps
    // that automatically; a manual `dispatch(formData)` call needs the
    // same wrapping done explicitly.
    startTransition(() => {
      dispatch(formData);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {state.error && (
        <div role="alert" className="rounded-lg bg-danger-light border border-danger px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      <SectionCard title="Incident Details">
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

        <div>
          <label htmlFor="occurredAt" className="block text-sm font-medium text-text-primary">
            Date and time of occurrence <span aria-hidden="true" className="text-danger">*</span>
          </label>
          <input
            id="occurredAt"
            name="occurredAt"
            type="datetime-local"
            required
            max={maxOccurredAt}
            defaultValue={toLocalDatetime(defaultValues?.occurredAt)}
            className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <p className="mt-1 text-xs text-text-muted">Date and time of occurrence cannot be in the future.</p>
          <FieldError errors={state.fieldErrors?.['occurredAt']} />
        </div>

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
      </SectionCard>

      <SectionCard title="Immediate Response">
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
      </SectionCard>

      <SectionCard title="Location">
        <OrgSelect id="affectedPlantId" name="affectedPlantId" label="Affected plant" options={plants} failed={plantsFailed} defaultValue={defaultValues?.affectedPlantId ?? undefined} />
        <OrgSelect id="affectedDepartmentId" name="affectedDepartmentId" label="Affected department" options={departments} failed={deptsFailed} defaultValue={defaultValues?.affectedDepartmentId ?? undefined} />
        <OrgSelect id="affectedLocationId" name="affectedLocationId" label="Location / area" options={locations} failed={locationsFailed} defaultValue={defaultValues?.affectedLocationId ?? undefined} />
      </SectionCard>

      {showEvidenceUpload && (
        <SectionCard title="Evidence Attachments">
          <p className="text-sm text-text-secondary">Optional — attach photos, videos, or documents related to this incident.</p>
          <EvidenceFilePicker
            staged={staged}
            onAddFiles={(fileList) => setStaged((prev) => stageEvidenceFiles(fileList, prev))}
            onRemove={(index) => setStaged((prev) => prev.filter((_, i) => i !== index))}
            disabled={pending}
          />
          <p className="text-xs text-text-muted">You can also add more evidence after saving the incident.</p>
        </SectionCard>
      )}

      {/* Submit */}
      <div className="pt-2 space-y-2">
        <p className="text-xs text-text-muted">This report can be saved before final submission.</p>
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
