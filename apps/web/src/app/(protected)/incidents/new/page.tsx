import type { Metadata } from 'next';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { IncidentForm } from '../_components/incident-form';
import { createIncidentAction } from '../actions';
import { plants, departments } from '../../../../lib/organizations-api';
import type { OrgRef } from '../../../../lib/incidents-api';

export const metadata: Metadata = { title: 'Report Incident — RECAFCO FMP' };

export default async function NewIncidentPage(): Promise<React.JSX.Element> {
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

  return (
    <div className="min-h-full p-8">
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Incident Report', href: '/incidents' },
          { label: 'Report incident' },
        ]} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Report incident</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Describe the incident or near-miss. Your report is saved as a draft until you submit.
          </p>
        </div>

        <IncidentForm
          action={createIncidentAction}
          submitLabel="Save as draft"
          plants={plantOptions}
          departments={deptOptions}
        />
      </div>
    </div>
  );
}
