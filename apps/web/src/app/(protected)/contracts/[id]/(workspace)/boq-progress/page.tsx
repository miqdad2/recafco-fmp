import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchBoqConfirmations, fetchBoqAttachments, fetchDrawingGroups } from '../../../../../../lib/technical-api';
import { getCurrentUserContext } from '../../../_lib/get-user-permissions';
import { withTechnicalRelease } from '../../../_lib/boq-progress-helpers';
import { BoqProgressView } from './_components/boq-progress-view';
import { BoqItemFilesCard } from '../../../../technical/_components/boq-item-files-card';

export const metadata: Metadata = { title: 'BOQ Progress — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filesNotSaved?: string }>;
}

/**
 * FMP-BOQ-10 — BOQ Progress: the manager's one-page, read-only view of how each
 * BOQ item is moving through Technical, Production, Storage Yard & Delivery and
 * Erection. Anyone who can view the contract (contracts.read) can view it. It
 * only reads the existing piece data; no status can be changed from here, and
 * nothing new is created.
 */
export default async function ContractBoqProgressTab({ params, searchParams }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const { filesNotSaved } = await searchParams;
  const notSavedCount = Number.parseInt(filesNotSaved ?? '', 10);
  const [{ id: userId, permissions }, items, groups, attachments] = await Promise.all([
    getCurrentUserContext(),
    fetchBoqConfirmations(id),
    fetchDrawingGroups(id),
    fetchBoqAttachments(id),
  ]);
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
      {/* FMP-BOQ-17 — set by New Contract Register when the contract saved but some chosen files did not. */}
      {Number.isFinite(notSavedCount) && notSavedCount > 0 && (
        <div role="alert" className="rounded-md border border-warning bg-warning-light px-4 py-3 text-sm text-text-primary">
          The contract was saved, but {notSavedCount} drawing {notSavedCount === 1 ? 'file' : 'files'} could not be uploaded. Please add {notSavedCount === 1 ? 'it' : 'them'} again below with &quot;Add Drawing / File&quot;.
        </div>
      )}
      <div>
        <h2 className="text-base font-semibold text-text-primary">BOQ Progress</h2>
        <p className="text-sm text-text-secondary">
          Contract Qty is for contract value. Pieces are confirmed by Technical from drawings, then tracked through production, delivery and erection.
        </p>
      </div>
      <BoqProgressView contractId={id} items={withTechnicalRelease(items, groups)} />

      {/* FMP-BOQ-17 — drawing files per BOQ item (Contract Management adds client drawings; Technical views them). */}
      {items.length > 0 && (
        <section aria-labelledby="boq-files-heading" className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h3 id="boq-files-heading" className="mb-3 text-base font-semibold text-text-primary">BOQ Drawing Files</h3>
          <BoqItemFilesCard
            contractId={id}
            items={items.map((i) => ({ id: i.boqItemId, sortOrder: i.sortOrder, itemCode: null, description: i.description }))}
            attachments={attachments}
            currentUserId={userId ?? ''}
            canUpload={permissions.includes('contracts.update')}
            canManage={permissions.includes('contracts.manage')}
          />
        </section>
      )}
    </div>
  );
}
