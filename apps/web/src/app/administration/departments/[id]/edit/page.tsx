import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { departments } from '@/lib/organizations-api';
import { OrgEntityForm } from '../../../_components/org-entity-form';
import { PageHeader } from '../../../_components/page-header';
import { updateDepartmentAction } from '../../actions';

export const metadata: Metadata = { title: 'Edit Department — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditDepartmentPage({ params }: Props): Promise<React.JSX.Element> {
  const { id } = await params;

  let dept: Awaited<ReturnType<typeof departments.get>> | null = null;
  try {
    dept = await departments.get(id);
  } catch {
    notFound();
  }

  if (!dept) notFound();

  const updateAction = updateDepartmentAction.bind(null, id);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <nav className="text-sm text-text-muted mb-4">
          <Link href="/administration" className="hover:text-text-primary">Administration</Link>
          {' / '}
          <Link href="/administration/departments" className="hover:text-text-primary">Departments</Link>
          {' / '}
          <span className="text-text-primary">Edit</span>
        </nav>

        <PageHeader
          title={`Edit Department: ${dept.code}`}
          description={dept.isActive ? 'This department is currently active.' : 'This department is currently inactive.'}
        />

        <OrgEntityForm
          action={updateAction}
          defaultValues={{ code: dept.code, name: dept.name, ...(dept.description !== null ? { description: dept.description } : {}) }}
          submitLabel="Save Changes"
          codeReadonly
        />
      </div>
    </div>
  );
}
