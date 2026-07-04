import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../../../_components/breadcrumbs';
import { productionApi } from '../../../../../../lib/production-api';
import { addProductionEntryAction } from '../../../actions';
import type { ActionResult } from '../../../actions';
import { AddEntryForm } from './_components/add-entry-form';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: 'Add Entry — RECAFCO FMP' };

export default async function AddEntryPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  let order;
  try {
    order = await productionApi.get(id);
  } catch {
    notFound();
  }

  const ENTERABLE = ['IN_PROGRESS', 'PAUSED'];
  if (!ENTERABLE.includes(order.status)) notFound();

  async function handleAddEntry(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    'use server';
    return addProductionEntryAction(id, _prev, formData);
  }

  return (
    <div className="min-h-full p-8">
      <div className="max-w-2xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Production Dashboard', href: '/production' },
          { label: order.referenceNumber, href: `/production/${id}` },
          { label: 'Add Entry' },
        ]} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Add Production Entry</h1>
          <p className="mt-1 text-sm text-text-muted font-mono">{order.referenceNumber} · {order.title}</p>
        </div>

        <AddEntryForm orderId={id} boundAction={handleAddEntry} />
      </div>
    </div>
  );
}
