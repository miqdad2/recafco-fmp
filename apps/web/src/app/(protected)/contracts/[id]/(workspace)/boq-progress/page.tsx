import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchBoqConfirmations, fetchBoqAttachments, fetchDrawingGroups, fetchElementCoverage } from '../../../../../../lib/technical-api';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { getCurrentUserContext } from '../../../_lib/get-user-permissions';
import { withTechnicalRelease } from '../../../_lib/boq-progress-helpers';
import { ELEMENT_TEXT } from '../../../_lib/boq-element-progress-helpers';
import { BoqProgressView } from './_components/boq-progress-view';
import { AddBoqItemControl } from './_components/add-boq-item-control';
import { InitialBoqDrawings } from './_components/initial-boq-drawings';
import { canAddBoqItems, boqTotalNote } from '../../../_lib/add-boq-item-helpers';
import { formatContractValue } from '../../../_lib/contract-ui-helpers';

export const metadata: Metadata = { title: 'BOQ Progress — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filesNotSaved?: string }>;
}

/**
 * BOQ Progress (FMP-BOQ-10, reworked in FMP-BOQ-18): how each BOQ item and its individual elements
 * move through Technical, Production, Storage Yard & Delivery and Erection. Anyone who can view the
 * contract (contracts.read) can view it; the only change possible here is adding a BOQ item or
 * initial drawings, under the permissions those actions already had.
 *
 * Release numbers come from the Technical element coverage list (one row per element), NOT from the
 * drawing-group summary: that summary only knows elements released through a group, so it showed
 * "0 released" for elements Technical had released on their own.
 */
export default async function ContractBoqProgressTab({ params, searchParams }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const { filesNotSaved } = await searchParams;
  const notSavedCount = Number.parseInt(filesNotSaved ?? '', 10);
  const [{ id: userId, permissions }, items, groups, attachments, coverage, contract] = await Promise.all([
    getCurrentUserContext(),
    fetchBoqConfirmations(id),
    fetchDrawingGroups(id),
    fetchBoqAttachments(id),
    fetchElementCoverage(id),
    contractsApi.get(id).catch(() => null),
  ]);
  if (!permissions.includes('contracts.read')) notFound();

  if (!items) {
    return (
      <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
        BOQ progress could not be loaded. Please refresh the page.
      </div>
    );
  }

  const boqNote = boqTotalNote(contract?.boqItems ?? [], contract?.contractValue);

  return (
    <div className="space-y-4">
      {/* FMP-BOQ-17 — set by New Contract Register when the contract saved but some chosen files did not. */}
      {Number.isFinite(notSavedCount) && notSavedCount > 0 && (
        <div role="alert" className="rounded-md border border-warning bg-warning-light px-4 py-3 text-sm text-text-primary">
          The contract was saved, but {notSavedCount} drawing {notSavedCount === 1 ? 'file' : 'files'} could not be uploaded. Please add {notSavedCount === 1 ? 'it' : 'them'} again under Initial BOQ Drawings below.
        </div>
      )}
      {/* FMP-CONTRACT-11 — + Add BOQ Item (contracts.update, contract not closed / cancelled / terminated). */}
      <AddBoqItemControl
        contractId={id}
        currency={contract?.currency ?? 'KWD'}
        canAdd={contract !== null && canAddBoqItems(permissions, contract.status)}
      >
        <h2 className="text-xl font-semibold text-text-primary">{ELEMENT_TEXT.title}</h2>
        <p className="text-sm text-text-secondary">{ELEMENT_TEXT.subtitle}</p>
      </AddBoqItemControl>
      {boqNote?.differs && (
        <p className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-xs text-text-secondary">
          BOQ total: <span className="font-semibold text-text-primary">{formatContractValue(String(boqNote.boqTotal), contract?.currency)}</span>
          {' · '}Contract value: <span className="font-semibold text-text-primary">{formatContractValue(String(boqNote.contractValue), contract?.currency)}</span>.
          {' '}Adding a BOQ item does not change the contract value.
        </p>
      )}

      <BoqProgressView contractId={id} items={withTechnicalRelease(items, groups)} coverage={coverage?.elements ?? null} />

      {/* FMP-BOQ-17/18 — the client's initial drawings per BOQ item (Contract Management adds them; Technical views them). Collapsed by default. */}
      {items.length > 0 && (
        <InitialBoqDrawings
          contractId={id}
          items={items.map((i) => ({ id: i.boqItemId, sortOrder: i.sortOrder, itemCode: null, description: i.description }))}
          attachments={attachments}
          currentUserId={userId ?? ''}
          canUpload={permissions.includes('contracts.update')}
          canManage={permissions.includes('contracts.manage')}
        />
      )}
    </div>
  );
}
