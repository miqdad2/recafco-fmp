import type { Metadata } from 'next';
import { plants } from '@/lib/organizations-api';
import { LocationForm } from '../../_components/location-form';
import { PageHeader } from '../../_components/page-header';
import { Breadcrumbs } from '../../../_components/breadcrumbs';
import { createLocationAction } from '../actions';
import type { OrgEntity } from '@/lib/organizations-api';

export const metadata: Metadata = { title: 'New Location — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function NewLocationPage(): Promise<React.JSX.Element> {
  let activePlants: OrgEntity[] = [];
  try {
    const data = await plants.list({ isActive: true, pageSize: 100 });
    activePlants = data.items;
  } catch {
    // non-fatal: plant selector will be empty
  }

  return (
    <div className="min-h-full p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Administration', href: '/administration' },
            { label: 'Locations', href: '/administration/locations' },
            { label: 'New' },
          ]}
        />

        <PageHeader title="New Location" description="Enter a unique code and optionally assign a plant." />

        <LocationForm action={createLocationAction} plants={activePlants} submitLabel="Create Location" />
      </div>
    </div>
  );
}
