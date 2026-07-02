'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { ActionResult } from '../../../actions';

interface DefaultValues {
  title: string;
  description?: string;
  productCode?: string;
  productName?: string;
  targetQuantity: number;
  unit: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
}

interface Props {
  orderId: string;
  boundAction: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  defaultValues: DefaultValues;
}

export function EditOrderForm({ orderId, boundAction, defaultValues }: Props): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    boundAction,
    { error: null },
  );

  return (
    <>
      {state.error && (
        <div className="mb-6 rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-6 rounded-lg border border-border bg-surface p-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-text-primary mb-1">Title</label>
          <input
            id="title" name="title" type="text" maxLength={300} defaultValue={defaultValues.title}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-text-primary mb-1">Description</label>
          <textarea
            id="description" name="description" rows={3} maxLength={10000}
            defaultValue={defaultValues.description ?? ''}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="productCode" className="block text-sm font-medium text-text-primary mb-1">Product Code</label>
            <input
              id="productCode" name="productCode" type="text" maxLength={100}
              defaultValue={defaultValues.productCode ?? ''}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="productName" className="block text-sm font-medium text-text-primary mb-1">Product Name</label>
            <input
              id="productName" name="productName" type="text" maxLength={300}
              defaultValue={defaultValues.productName ?? ''}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="targetQuantity" className="block text-sm font-medium text-text-primary mb-1">Target Quantity</label>
            <input
              id="targetQuantity" name="targetQuantity" type="number" min={1}
              defaultValue={defaultValues.targetQuantity}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="unit" className="block text-sm font-medium text-text-primary mb-1">Unit</label>
            <input
              id="unit" name="unit" type="text" maxLength={50} defaultValue={defaultValues.unit}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={`/production/${orderId}`}
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </>
  );
}
