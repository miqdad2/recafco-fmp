import Link from 'next/link';
import type { Metadata } from 'next';
import { OrgEntityForm } from '../../_components/org-entity-form';
import { PageHeader } from '../../_components/page-header';
import { createPlantAction } from '../actions';

export const metadata: Metadata = { title: 'New Plant — RECAFCO FMP' };

export default function NewPlantPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <nav className="text-sm text-text-muted mb-4">
          <Link href="/administration" className="hover:text-text-primary">Administration</Link>
          {' / '}
          <Link href="/administration/plants" className="hover:text-text-primary">Plants</Link>
          {' / '}
          <span className="text-text-primary">New</span>
        </nav>

        <PageHeader title="New Plant" description="Enter a unique code and descriptive name." />

        <OrgEntityForm action={createPlantAction} submitLabel="Create Plant" />
      </div>
    </div>
  );
}
