import Link from 'next/link';
import type { Metadata } from 'next';
import { plants } from '@/lib/organizations-api';
import { LocationForm } from '../../_components/location-form';
import { PageHeader } from '../../_components/page-header';
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
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <nav className="text-sm text-text-muted mb-4">
          <Link href="/administration" className="hover:text-text-primary">Administration</Link>
          {' / '}
          <Link href="/administration/locations" className="hover:text-text-primary">Locations</Link>
          {' / '}
          <span className="text-text-primary">New</span>
        </nav>

        <PageHeader title="New Location" description="Enter a unique code and optionally assign a plant." />

        <LocationForm action={createLocationAction} plants={activePlants} submitLabel="Create Location" />
      </div>
    </div>
  );
}
