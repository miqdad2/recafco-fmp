import Link from 'next/link';
import type { Metadata } from 'next';
import { OrgEntityForm } from '../../_components/org-entity-form';
import { PageHeader } from '../../_components/page-header';
import { createDepartmentAction } from '../actions';

export const metadata: Metadata = { title: 'New Department — RECAFCO FMP' };

export default function NewDepartmentPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <nav className="text-sm text-text-muted mb-4">
          <Link href="/administration" className="hover:text-text-primary">Administration</Link>
          {' / '}
          <Link href="/administration/departments" className="hover:text-text-primary">Departments</Link>
          {' / '}
          <span className="text-text-primary">New</span>
        </nav>

        <PageHeader title="New Department" description="Enter a unique code and descriptive name." />

        <OrgEntityForm action={createDepartmentAction} submitLabel="Create Department" />
      </div>
    </div>
  );
}
