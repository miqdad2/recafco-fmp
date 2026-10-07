import { describe, it, expect } from 'vitest';
import {
  readFilterValues,
  buildPieceQuery,
  hasActiveFilters,
  emptyStateText,
  contractLabel,
  PRODUCTION_STATUS_FILTERS,
  SUMMARY_CARDS,
} from './production-pieces-helpers';
import { pieceUpdateOptionsFor } from '../../../technical/_lib/boq-confirmation-helpers';

describe('status filter', () => {
  it('defaults to Ready + In Production and sends no explicit status (the API applies the default)', () => {
    const values = readFilterValues({});
    expect(values.status).toBe('DEFAULT');
    expect(buildPieceQuery(values)).toEqual({});
    expect(hasActiveFilters(values)).toBe(false);
  });
  it('offers All, Drawing Ready, In Production, Produced, Hold and Rejected', () => {
    expect(PRODUCTION_STATUS_FILTERS.map((f) => f.label)).toEqual([
      'Ready + In Production', 'All', 'Drawing Ready', 'In Production', 'Produced', 'Hold', 'Rejected',
    ]);
  });
  it('maps a chosen status to the API list and keeps the other filters', () => {
    const values = readFilterValues({ status: 'PRODUCED', search: ' hc ', contractId: 'c1', drawingNo: 'HC-001', boqItem: 'Slab', page: '3' });
    expect(buildPieceQuery(values)).toEqual({ statuses: 'PRODUCED', search: 'hc', contractId: 'c1', drawingNo: 'HC-001', boqItem: 'Slab', page: 3 });
    expect(hasActiveFilters(values)).toBe(true);
  });
  it('ignores an unknown status and a bad page number', () => {
    const values = readFilterValues({ status: 'DELIVERED', page: '-4' });
    expect(values.status).toBe('DEFAULT');
    expect(values.page).toBe(1);
  });
});

describe('Production update dropdown', () => {
  it('shows only In Production, Produced, Hold and Rejected', () => {
    const options = pieceUpdateOptionsFor(['IN_PRODUCTION', 'PRODUCED', 'ON_HOLD', 'REJECTED']);
    expect(options.map((o) => o.label)).toEqual(['In Production', 'Produced', 'Hold', 'Rejected']);
    for (const hidden of ['Drawing Ready', 'In Store', 'Delivered', 'Erected', 'Completed', 'Cancelled']) {
      expect(options.map((o) => o.label)).not.toContain(hidden);
    }
  });
  it('hides the update controls for a read-only user or an unresolved list', () => {
    expect(pieceUpdateOptionsFor([])).toEqual([]);
    expect(pieceUpdateOptionsFor(null)).toEqual([]);
  });
});

describe('wording', () => {
  it('has the four summary cards', () => {
    expect(SUMMARY_CARDS.map((c) => c.label)).toEqual(['Ready for Production', 'In Production', 'Produced', 'On Hold / Rejected']);
  });
  it('empty state when no pieces are ready', () => {
    expect(emptyStateText(false)).toEqual({
      title: 'No pieces ready for production.',
      help: 'Pieces will appear here after Technical confirms drawings and generates pieces.',
    });
    expect(emptyStateText(true).title).toBe('No pieces match these filters.');
  });
  it('labels a job by job order, else system reference — never an id', () => {
    expect(contractLabel({ referenceNumber: 'CONTRACT-2026-000012', jobOrder: 'JO-100', title: 'Tower A' })).toBe('JO-100 · Tower A');
    expect(contractLabel({ referenceNumber: 'CONTRACT-2026-000012', jobOrder: null, title: 'Tower A' })).toBe('CONTRACT-2026-000012 · Tower A');
  });
});
