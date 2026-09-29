import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../../_components/breadcrumbs';
import { IncidentForm } from '../../_components/incident-form';
import { updateDraftAction } from '../../actions';
import { incidentsApi } from '../../../../../lib/incidents-api';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getCurrentUserId(): Promise<string> {
  try {
    const store = await cookies();
    const token = store.get('recafco_access')?.value;
    if (!token) return '';
    const raw = token.split('.')[1];
    if (!raw) return '';
    const payload = JSON.parse(Buffer.from(raw, 'base64url').toString()) as { sub?: string };
    return payload.sub ?? '';
  } catch {
    return '';
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const incident = await incidentsApi.get(id);
    return { title: `Edit ${incident.referenceNumber} — RECAFCO FMP` };
  } catch {
    return { title: 'Edit incident — RECAFCO FMP' };
  }
}

/**
 * FMP-UI-22 — this page shares `IncidentForm` with `new/page.tsx`, which
 * this same unit fixed to source Plant/Department/Location options from
 * `incidentsApi.departments()`/`.plants()`/`.locations()` (module-scoped,
 * gated `incidents.read`) instead of the admin-gated `organizations-api.ts`
 * (`org.departments.read`/`org.plants.read`, a permission an
 * `incidents.create`-only user does not hold). Applied the identical fix
 * here — this page had the exact same bug, just previously out of this
 * unit's stated scope until `IncidentForm`'s own prop signature changed
 * and required this call site to be updated anyway.
 */
export default async function EditIncidentPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [incidentRes, currentUserId] = await Promise.all([
    incidentsApi.get(id).catch(() => null),
    getCurrentUserId(),
  ]);

  if (!incidentRes) notFound();

  // Only the reporter can edit their own DRAFT
  if (incidentRes.status !== 'DRAFT' || incidentRes.reportedByUserId !== currentUserId) {
    redirect(`/incidents/${id}`);
  }

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

  const boundAction = updateDraftAction.bind(null, id);

  return (
    <div className="min-h-full p-8">
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Incident Management', href: '/incidents' },
          { label: incidentRes.referenceNumber, href: `/incidents/${id}` },
          { label: 'Edit draft' },
        ]} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Edit draft</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Update the incident details before submitting for review.
          </p>
        </div>

        <IncidentForm
          action={boundAction}
          submitLabel="Save changes"
          plants={plantOptions}
          plantsFailed={plantsFailed}
          departments={deptOptions}
          deptsFailed={deptsFailed}
          locations={locationOptions}
          locationsFailed={locationsFailed}
          defaultValues={incidentRes}
        />
      </div>
    </div>
  );
}
