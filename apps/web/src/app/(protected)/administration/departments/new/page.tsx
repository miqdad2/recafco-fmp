import type { Metadata } from 'next';
import { OrgEntityForm } from '../../_components/org-entity-form';
import { PageHeader } from '../../_components/page-header';
import { Breadcrumbs } from '../../../_components/breadcrumbs';
import { createDepartmentAction } from '../actions';

export const metadata: Metadata = { title: 'New Department — RECAFCO FMP' };

export default function NewDepartmentPage(): React.JSX.Element {
  return (
    <div className="min-h-full p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Administration', href: '/administration' },
            { label: 'Departments', href: '/administration/departments' },
            { label: 'New' },
          ]}
        />

        <PageHeader title="New Department" description="Enter a unique code and descriptive name." />

        <OrgEntityForm action={createDepartmentAction} submitLabel="Create Department" />
      </div>
    </div>
  );
}
