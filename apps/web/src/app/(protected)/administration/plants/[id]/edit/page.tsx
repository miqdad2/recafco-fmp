import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { plants } from '@/lib/organizations-api';
import { OrgEntityForm } from '../../../_components/org-entity-form';
import { PageHeader } from '../../../_components/page-header';
import { Breadcrumbs } from '../../../../_components/breadcrumbs';
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
    <div className="min-h-full p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Administration', href: '/administration' },
            { label: 'Plants', href: '/administration/plants' },
            { label: 'Edit' },
          ]}
        />

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
