import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchBoqConfirmations, fetchDrawingGroups } from '../../../../../../lib/technical-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { withTechnicalRelease } from '../../../_lib/boq-progress-helpers';
import { BoqProgressView } from './_components/boq-progress-view';

export const metadata: Metadata = { title: 'BOQ Progress — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * FMP-BOQ-10 — BOQ Progress: the manager's one-page, read-only view of how each
 * BOQ item is moving through Technical, Production, Storage Yard & Delivery and
 * Erection. Anyone who can view the contract (contracts.read) can view it. It
 * only reads the existing piece data; no status can be changed from here, and
 * nothing new is created.
 */
export default async function ContractBoqProgressTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const [permissions, items, groups] = await Promise.all([getUserPermissions(), fetchBoqConfirmations(id), fetchDrawingGroups(id)]);
  if (!permissions.includes('contracts.read')) notFound();

  if (!items) {
    return (
      <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
        BOQ progress could not be loaded. Please refresh the page.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-text-primary">BOQ Progress</h2>
        <p className="text-sm text-text-secondary">
          Contract Qty is for contract value. Pieces are confirmed by Technical from drawings, then tracked through production, delivery and erection.
        </p>
      </div>
      <BoqProgressView contractId={id} items={withTechnicalRelease(items, groups)} />
    </div>
  );
}
