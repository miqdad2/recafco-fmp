import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../../../_components/breadcrumbs';
import { productionApi } from '../../../../../../lib/production-api';
import { updateProductionLineAction } from '../../../actions';
import type { ActionResult } from '../../../actions';
import { EditLineForm } from './_components/edit-line-form';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const line = await productionApi.getLine(id);
    return { title: `Edit ${line.code} — RECAFCO FMP` };
  } catch {
    return { title: 'Edit Production Line — RECAFCO FMP' };
  }
}

export default async function EditProductionLinePage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const line = await productionApi.getLine(id).catch(() => notFound());

  async function handleUpdate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    'use server';
    return updateProductionLineAction(id, line.version, _prev, formData);
  }

  return (
    <div className="min-h-full p-8">
      <div className="max-w-2xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Production Dashboard', href: '/production' },
          { label: 'Lines', href: '/production/lines' },
          { label: line.code },
          { label: 'Edit' },
        ]} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Edit Production Line</h1>
          <p className="mt-1 text-sm font-mono text-text-muted">{line.code}</p>
        </div>

        <EditLineForm
          lineId={id}
          boundAction={handleUpdate}
          defaultValues={{
            name: line.name,
            ...(line.description !== undefined ? { description: line.description } : {}),
            ...(line.capacity !== undefined ? { capacity: line.capacity } : {}),
          }}
        />
      </div>
    </div>
  );
}
