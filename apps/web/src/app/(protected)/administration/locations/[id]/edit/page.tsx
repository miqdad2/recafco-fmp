import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { locations, plants } from '@/lib/organizations-api';
import type { OrgEntity } from '@/lib/organizations-api';
import { LocationForm } from '../../../_components/location-form';
import { PageHeader } from '../../../_components/page-header';
import { Breadcrumbs } from '../../../../_components/breadcrumbs';
import { updateLocationAction } from '../../actions';

export const metadata: Metadata = { title: 'Edit Location — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditLocationPage({ params }: Props): Promise<React.JSX.Element> {
  const { id } = await params;

  let location: Awaited<ReturnType<typeof locations.get>> | null = null;
  try {
    location = await locations.get(id);
  } catch {
    notFound();
  }

  if (!location) notFound();

  let activePlants: OrgEntity[] = [];
  try {
    const data = await plants.list({ isActive: true, pageSize: 100 });
    activePlants = data.items;
  } catch {
    // non-fatal
  }

  const updateAction = updateLocationAction.bind(null, id);

  return (
    <div className="min-h-full p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Administration', href: '/administration' },
            { label: 'Locations', href: '/administration/locations' },
            { label: 'Edit' },
          ]}
        />

        <PageHeader
          title={`Edit Location: ${location.code}`}
          description={location.isActive ? 'This location is currently active.' : 'This location is currently inactive.'}
        />

        <LocationForm
          action={updateAction}
          defaultValues={{
            code: location.code,
            name: location.name,
            ...(location.description !== null ? { description: location.description } : {}),
            plantId: location.plantId,
          }}
          plants={activePlants}
          submitLabel="Save Changes"
          codeReadonly
        />
      </div>
    </div>
  );
}
