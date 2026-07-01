import type { Metadata } from 'next';
import { OrgEntityForm } from '../../_components/org-entity-form';
import { PageHeader } from '../../_components/page-header';
import { Breadcrumbs } from '../../../_components/breadcrumbs';
import { createPlantAction } from '../actions';

export const metadata: Metadata = { title: 'New Plant — RECAFCO FMP' };

export default function NewPlantPage(): React.JSX.Element {
  return (
    <div className="min-h-full p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Administration', href: '/administration' },
            { label: 'Plants', href: '/administration/plants' },
            { label: 'New' },
          ]}
        />

        <PageHeader title="New Plant" description="Enter a unique code and descriptive name." />

        <OrgEntityForm action={createPlantAction} submitLabel="Create Plant" />
      </div>
    </div>
  );
}
