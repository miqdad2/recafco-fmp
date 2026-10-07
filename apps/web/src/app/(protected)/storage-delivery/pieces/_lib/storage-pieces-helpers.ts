import type { StoragePieceQuery, StoragePieceSummary } from '@/lib/storage-delivery-pieces-api';

// FMP-BOQ-08 — wording and filter handling for the Piece Delivery screen.

export const STORAGE_STATUS_FILTERS: { value: string; label: string; statuses: string | undefined }[] = [
  { value: 'DEFAULT', label: 'Produced + In Store', statuses: undefined },
  { value: 'ALL', label: 'All', statuses: 'PRODUCED,IN_STORE,DELIVERED,ON_HOLD,REJECTED' },
  { value: 'PRODUCED', label: 'Produced', statuses: 'PRODUCED' },
  { value: 'IN_STORE', label: 'In Store', statuses: 'IN_STORE' },
  { value: 'DELIVERED', label: 'Delivered', statuses: 'DELIVERED' },
  { value: 'ON_HOLD', label: 'Hold', statuses: 'ON_HOLD' },
  { value: 'REJECTED', label: 'Rejected', statuses: 'REJECTED' },
];

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() !== '' ? s.trim() : undefined;
}

export interface StorageFilterValues {
  status: string;
  search: string;
  contractId: string;
  drawingNo: string;
  boqItem: string;
  page: number;
}

/** Page URL params → form values (status falls back to the default filter). */
export function readStorageFilterValues(params: Record<string, string | string[] | undefined>): StorageFilterValues {
  const status = first(params['status']);
  const page = parseInt(first(params['page']) ?? '1', 10);
  return {
    status: STORAGE_STATUS_FILTERS.some((f) => f.value === status) ? (status as string) : 'DEFAULT',
    search: first(params['search']) ?? '',
    contractId: first(params['contractId']) ?? '',
    drawingNo: first(params['drawingNo']) ?? '',
    boqItem: first(params['boqItem']) ?? '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Form values → API query. The default filter sends no status so the API applies Produced + In Store. */
export function buildStorageQuery(values: StorageFilterValues): StoragePieceQuery {
  const statuses = STORAGE_STATUS_FILTERS.find((f) => f.value === values.status)?.statuses;
  return {
    ...(statuses ? { statuses } : {}),
    ...(values.search ? { search: values.search } : {}),
    ...(values.contractId ? { contractId: values.contractId } : {}),
    ...(values.drawingNo ? { drawingNo: values.drawingNo } : {}),
    ...(values.boqItem ? { boqItem: values.boqItem } : {}),
    ...(values.page > 1 ? { page: values.page } : {}),
  };
}

export function hasActiveStorageFilters(values: StorageFilterValues): boolean {
  return values.status !== 'DEFAULT' || values.search !== '' || values.contractId !== '' || values.drawingNo !== '' || values.boqItem !== '';
}

export const STORAGE_SUMMARY_CARDS: { key: keyof StoragePieceSummary; label: string }[] = [
  { key: 'readyForStore', label: 'Ready for Store' },
  { key: 'inStore', label: 'In Store' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'onHoldOrRejected', label: 'On Hold / Rejected' },
];

/** Empty-state wording: nothing produced yet vs. "no match" when filters are active. */
export function storageEmptyStateText(filtered: boolean): { title: string; help: string } {
  return filtered
    ? { title: 'No pieces match these filters.', help: 'Try a different status or clear the filters.' }
    : {
        title: 'No pieces ready for storage or delivery.',
        help: 'Pieces will appear here after Production marks them as Produced.',
      };
}

/** The optional Location box only matters when pieces go to the store or are delivered. */
export function showsLocationInput(targetStatus: string): boolean {
  return targetStatus === 'IN_STORE' || targetStatus === 'DELIVERED';
}

/** "JO-100 · Tower A" — job order when there is one, otherwise the system reference. */
export function storageContractLabel(contract: { referenceNumber: string; jobOrder: string | null; title: string }): string {
  return `${contract.jobOrder || contract.referenceNumber} · ${contract.title}`;
}
