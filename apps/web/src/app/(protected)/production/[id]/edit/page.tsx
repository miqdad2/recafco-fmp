import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../../_components/breadcrumbs';
import { productionApi } from '../../../../../lib/production-api';
import { updateProductionOrderAction } from '../../actions';
import type { ActionResult } from '../../actions';
import { EditOrderForm } from './_components/edit-order-form';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const order = await productionApi.get(id);
    return { title: `Edit ${order.referenceNumber} — RECAFCO FMP` };
  } catch {
    return { title: 'Edit Production Order — RECAFCO FMP' };
  }
}

export default async function EditProductionOrderPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const order = await productionApi.get(id).catch(() => notFound());

  if (order.status !== 'DRAFT') notFound();

  async function handleUpdate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    'use server';
    return updateProductionOrderAction(id, order.version, _prev, formData);
  }

  return (
    <div className="min-h-full p-8">
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Production Dashboard', href: '/production' },
          { label: order.referenceNumber, href: `/production/${id}` },
          { label: 'Edit' },
        ]} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Edit Production Order</h1>
          <p className="mt-1 text-sm text-text-muted font-mono">{order.referenceNumber}</p>
        </div>

        <EditOrderForm
          orderId={id}
          boundAction={handleUpdate}
          defaultValues={{
            title: order.title,
            ...(order.description !== undefined ? { description: order.description } : {}),
            ...(order.productCode !== undefined ? { productCode: order.productCode } : {}),
            ...(order.productName !== undefined ? { productName: order.productName } : {}),
            targetQuantity: order.targetQuantity,
            unit: order.unit,
            ...(order.scheduledStartAt !== undefined ? { scheduledStartAt: order.scheduledStartAt } : {}),
            ...(order.scheduledEndAt !== undefined ? { scheduledEndAt: order.scheduledEndAt } : {}),
          }}
        />
      </div>
    </div>
  );
}
