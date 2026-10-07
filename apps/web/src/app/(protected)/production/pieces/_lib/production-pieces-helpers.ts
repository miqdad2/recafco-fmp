import type { ProductionPieceQuery, ProductionPieceSummary } from '@/lib/production-pieces-api';

// FMP-BOQ-07 — wording and filter handling for the Piece Production screen.

export const PRODUCTION_STATUS_FILTERS: { value: string; label: string; statuses: string | undefined }[] = [
  { value: 'DEFAULT', label: 'Ready + In Production', statuses: undefined },
  { value: 'ALL', label: 'All', statuses: 'DRAWING_READY,IN_PRODUCTION,PRODUCED,ON_HOLD,REJECTED' },
  { value: 'DRAWING_READY', label: 'Drawing Ready', statuses: 'DRAWING_READY' },
  { value: 'IN_PRODUCTION', label: 'In Production', statuses: 'IN_PRODUCTION' },
  { value: 'PRODUCED', label: 'Produced', statuses: 'PRODUCED' },
  { value: 'ON_HOLD', label: 'Hold', statuses: 'ON_HOLD' },
  { value: 'REJECTED', label: 'Rejected', statuses: 'REJECTED' },
];

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() !== '' ? s.trim() : undefined;
}

export interface PieceFilterValues {
  status: string;
  search: string;
  contractId: string;
  drawingNo: string;
  boqItem: string;
  page: number;
}

/** Page URL params → form values (status falls back to the default filter). */
export function readFilterValues(params: Record<string, string | string[] | undefined>): PieceFilterValues {
  const status = first(params['status']);
  const page = parseInt(first(params['page']) ?? '1', 10);
  return {
    status: PRODUCTION_STATUS_FILTERS.some((f) => f.value === status) ? (status as string) : 'DEFAULT',
    search: first(params['search']) ?? '',
    contractId: first(params['contractId']) ?? '',
    drawingNo: first(params['drawingNo']) ?? '',
    boqItem: first(params['boqItem']) ?? '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Form values → API query. The default filter sends no status so the API applies Ready + In Production. */
export function buildPieceQuery(values: PieceFilterValues): ProductionPieceQuery {
  const statuses = PRODUCTION_STATUS_FILTERS.find((f) => f.value === values.status)?.statuses;
  return {
    ...(statuses ? { statuses } : {}),
    ...(values.search ? { search: values.search } : {}),
    ...(values.contractId ? { contractId: values.contractId } : {}),
    ...(values.drawingNo ? { drawingNo: values.drawingNo } : {}),
    ...(values.boqItem ? { boqItem: values.boqItem } : {}),
    ...(values.page > 1 ? { page: values.page } : {}),
  };
}

export function hasActiveFilters(values: PieceFilterValues): boolean {
  return values.status !== 'DEFAULT' || values.search !== '' || values.contractId !== '' || values.drawingNo !== '' || values.boqItem !== '';
}

export const SUMMARY_CARDS: { key: keyof ProductionPieceSummary; label: string }[] = [
  { key: 'readyForProduction', label: 'Ready for Production' },
  { key: 'inProduction', label: 'In Production' },
  { key: 'produced', label: 'Produced' },
  { key: 'onHoldOrRejected', label: 'On Hold / Rejected' },
];

/** Empty-state wording: "no pieces ready" when nothing is filtered, otherwise a plain "no match". */
export function emptyStateText(filtered: boolean): { title: string; help: string } {
  return filtered
    ? { title: 'No pieces match these filters.', help: 'Try a different status or clear the filters.' }
    : {
        title: 'No pieces ready for production.',
        help: 'Pieces will appear here after Technical confirms drawings and generates pieces.',
      };
}

/** "JO-100 · Tower A" — job order when there is one, otherwise the system reference. */
export function contractLabel(contract: { referenceNumber: string; jobOrder: string | null; title: string }): string {
  return `${contract.jobOrder || contract.referenceNumber} · ${contract.title}`;
}
