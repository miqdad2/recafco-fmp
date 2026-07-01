import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../../_components/breadcrumbs';
import { IncidentForm } from '../../_components/incident-form';
import { updateDraftAction } from '../../actions';
import { incidentsApi } from '../../../../../lib/incidents-api';
import { plants, departments } from '../../../../../lib/organizations-api';
import type { OrgRef } from '../../../../../lib/incidents-api';

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

  const [plantsRes, deptsRes] = await Promise.allSettled([
    plants.list({ isActive: true, pageSize: 100 }),
    departments.list({ isActive: true, pageSize: 100 }),
  ]);

  const plantOptions: OrgRef[] = plantsRes.status === 'fulfilled'
    ? plantsRes.value.items.map((p) => ({ id: p.id, code: p.code, name: p.name }))
    : [];
  const deptOptions: OrgRef[] = deptsRes.status === 'fulfilled'
    ? deptsRes.value.items.map((d) => ({ id: d.id, code: d.code, name: d.name }))
    : [];

  const boundAction = updateDraftAction.bind(null, id);

  return (
    <div className="min-h-full p-8">
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Incidents', href: '/incidents' },
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
          departments={deptOptions}
          defaultValues={incidentRes}
        />
      </div>
    </div>
  );
}
