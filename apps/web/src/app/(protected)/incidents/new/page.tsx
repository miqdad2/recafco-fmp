import type { Metadata } from 'next';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { IncidentForm } from '../_components/incident-form';
import { createIncidentAction } from '../actions';
import { incidentsApi } from '../../../../lib/incidents-api';

export const metadata: Metadata = { title: 'Report Incident — RECAFCO FMP' };

/**
 * FMP-UI-22 — fixed the Affected Plant/Department dropdowns, which only
 * ever rendered "None" for a normal `incidents.create`-only user. Root
 * cause: this page called the ADMIN-gated `organizations-api.ts`
 * (`plants.list()`/`departments.list()`, requiring `org.plants.read`/
 * `org.departments.read`); the 403 was silently swallowed by
 * `Promise.allSettled`, so the options were always empty with no error
 * shown — the exact same bug already fixed for Factory Tasks (FMP-UI-20D)
 * and Safety & Compliance (FMP-UI-21C). Switched to
 * `incidentsApi.departments()`/`.plants()`/`.locations()` (new
 * `GET /incidents/departments`/`/plants`/`/locations`, gated by
 * `incidents.read` — the same permission already required to reach this
 * page). `deptsFailed`/`plantsFailed`/`locationsFailed` are tracked and
 * passed through so the form can show a real error state instead of a
 * silently empty dropdown. Location/area is a genuinely real, already-
 * supported field (`affectedLocationId` on `CreateIncidentDto`,
 * `actions.ts` already reads it) that the OLD form never exposed at all —
 * added here for the first time, not fabricated.
 *
 * FMP-INC-01B — per direct feedback that this page "doesn't show photo/
 * video/file upload options" and reads as though evidence attachment is
 * missing: passed a `showEvidenceNote` prop to `IncidentForm`, rendering a
 * static information section explaining WHY upload controls weren't there.
 *
 * FMP-INC-01C — evidence upload is now genuinely possible here too, not
 * just explained: `showEvidenceUpload` (renamed from `showEvidenceNote`)
 * renders a REAL, OPTIONAL file-staging section. Selected files never
 * upload from this page directly (there is no `incidentId` yet) — they
 * ride along inside this form's own submit (`IncidentForm`'s `handleSubmit`
 * appends them to the FormData under `evidenceFiles`), and
 * `createIncidentAction` uploads them right after the incident itself is
 * created, reusing the exact same `uploadAttachmentAction`-backed path the
 * Incident Detail page already uses.
 */
export default async function NewIncidentPage(): Promise<React.JSX.Element> {
  const [deptsRes, plantsRes, locationsRes] = await Promise.allSettled([
    incidentsApi.departments(),
    incidentsApi.plants(),
    incidentsApi.locations(),
  ]);

  const deptOptions = deptsRes.status === 'fulfilled' ? deptsRes.value : [];
  const deptsFailed = deptsRes.status === 'rejected';
  const plantOptions = plantsRes.status === 'fulfilled' ? plantsRes.value : [];
  const plantsFailed = plantsRes.status === 'rejected';
  const locationOptions = locationsRes.status === 'fulfilled' ? locationsRes.value : [];
  const locationsFailed = locationsRes.status === 'rejected';

  return (
    <div className="min-h-full p-8">
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Incident Management', href: '/incidents' },
          { label: 'Report Incident' },
        ]} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Report Incident</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Record what happened, where it happened, and any immediate action taken.
          </p>
        </div>

        <IncidentForm
          action={createIncidentAction}
          submitLabel="Save Incident"
          plants={plantOptions}
          plantsFailed={plantsFailed}
          departments={deptOptions}
          deptsFailed={deptsFailed}
          locations={locationOptions}
          locationsFailed={locationsFailed}
          showEvidenceUpload
        />
      </div>
    </div>
  );
}
