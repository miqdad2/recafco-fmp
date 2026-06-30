import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { locations, plants } from '@/lib/organizations-api';
import type { OrgEntity } from '@/lib/organizations-api';
import { LocationForm } from '../../../_components/location-form';
import { PageHeader } from '../../../_components/page-header';
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
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <nav className="text-sm text-text-muted mb-4">
          <Link href="/administration" className="hover:text-text-primary">Administration</Link>
          {' / '}
          <Link href="/administration/locations" className="hover:text-text-primary">Locations</Link>
          {' / '}
          <span className="text-text-primary">Edit</span>
        </nav>

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
