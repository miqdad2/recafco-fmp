import type { ErectionPieceQuery, ErectionPieceSummary } from '@/lib/erection-pieces-api';

// FMP-BOQ-09 — wording and filter handling for the Piece Erection screen.

export const ERECTION_STATUS_FILTERS: { value: string; label: string; statuses: string | undefined }[] = [
  { value: 'DEFAULT', label: 'Delivered + Erected', statuses: undefined },
  { value: 'ALL', label: 'All', statuses: 'DELIVERED,ERECTED,COMPLETED,ON_HOLD,REJECTED' },
  { value: 'DELIVERED', label: 'Delivered', statuses: 'DELIVERED' },
  { value: 'ERECTED', label: 'Erected', statuses: 'ERECTED' },
  { value: 'COMPLETED', label: 'Completed', statuses: 'COMPLETED' },
  { value: 'ON_HOLD', label: 'Hold', statuses: 'ON_HOLD' },
  { value: 'REJECTED', label: 'Rejected', statuses: 'REJECTED' },
];

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() !== '' ? s.trim() : undefined;
}

export interface ErectionFilterValues {
  status: string;
  search: string;
  contractId: string;
  drawingNo: string;
  boqItem: string;
  page: number;
}

/** Page URL params → form values (status falls back to the default filter). */
export function readErectionFilterValues(params: Record<string, string | string[] | undefined>): ErectionFilterValues {
  const status = first(params['status']);
  const page = parseInt(first(params['page']) ?? '1', 10);
  return {
    status: ERECTION_STATUS_FILTERS.some((f) => f.value === status) ? (status as string) : 'DEFAULT',
    search: first(params['search']) ?? '',
    contractId: first(params['contractId']) ?? '',
    drawingNo: first(params['drawingNo']) ?? '',
    boqItem: first(params['boqItem']) ?? '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Form values → API query. The default filter sends no status so the API applies Delivered + Erected. */
export function buildErectionQuery(values: ErectionFilterValues): ErectionPieceQuery {
  const statuses = ERECTION_STATUS_FILTERS.find((f) => f.value === values.status)?.statuses;
  return {
    ...(statuses ? { statuses } : {}),
    ...(values.search ? { search: values.search } : {}),
    ...(values.contractId ? { contractId: values.contractId } : {}),
    ...(values.drawingNo ? { drawingNo: values.drawingNo } : {}),
    ...(values.boqItem ? { boqItem: values.boqItem } : {}),
    ...(values.page > 1 ? { page: values.page } : {}),
  };
}

export function hasActiveErectionFilters(values: ErectionFilterValues): boolean {
  return values.status !== 'DEFAULT' || values.search !== '' || values.contractId !== '' || values.drawingNo !== '' || values.boqItem !== '';
}

export const ERECTION_SUMMARY_CARDS: { key: keyof ErectionPieceSummary; label: string }[] = [
  { key: 'readyForErection', label: 'Ready for Erection' },
  { key: 'erected', label: 'Erected' },
  { key: 'completed', label: 'Completed' },
  { key: 'onHoldOrRejected', label: 'On Hold / Rejected' },
];

/** Empty-state wording: nothing delivered yet vs. "no match" when filters are active. */
export function erectionEmptyStateText(filtered: boolean): { title: string; help: string } {
  return filtered
    ? { title: 'No pieces match these filters.', help: 'Try a different status or clear the filters.' }
    : {
        title: 'No pieces ready for erection.',
        help: 'Pieces will appear here after Storage Yard & Delivery marks them as Delivered.',
      };
}

/** The optional Location / site note only matters when pieces are erected or completed. */
export function showsLocationInput(targetStatus: string): boolean {
  return targetStatus === 'ERECTED' || targetStatus === 'COMPLETED';
}

/** "JO-100 · Tower A" — job order when there is one, otherwise the system reference. */
export function erectionContractLabel(contract: { referenceNumber: string; jobOrder: string | null; title: string }): string {
  return `${contract.jobOrder || contract.referenceNumber} · ${contract.title}`;
}
