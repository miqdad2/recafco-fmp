import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { plants } from '@/lib/organizations-api';
import { OrgEntityForm } from '../../../_components/org-entity-form';
import { PageHeader } from '../../../_components/page-header';
import { updatePlantAction } from '../../actions';

export const metadata: Metadata = { title: 'Edit Plant — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditPlantPage({ params }: Props): Promise<React.JSX.Element> {
  const { id } = await params;

  let plant: Awaited<ReturnType<typeof plants.get>> | null = null;
  try {
    plant = await plants.get(id);
  } catch {
    notFound();
  }

  if (!plant) notFound();

  const updateAction = updatePlantAction.bind(null, id);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <nav className="text-sm text-text-muted mb-4">
          <Link href="/administration" className="hover:text-text-primary">Administration</Link>
          {' / '}
          <Link href="/administration/plants" className="hover:text-text-primary">Plants</Link>
          {' / '}
          <span className="text-text-primary">Edit</span>
        </nav>

        <PageHeader
          title={`Edit Plant: ${plant.code}`}
          description={plant.isActive ? 'This plant is currently active.' : 'This plant is currently inactive.'}
        />

        <OrgEntityForm
          action={updateAction}
          defaultValues={{ code: plant.code, name: plant.name, ...(plant.description !== null ? { description: plant.description } : {}) }}
          submitLabel="Save Changes"
          codeReadonly
        />
      </div>
    </div>
  );
}
