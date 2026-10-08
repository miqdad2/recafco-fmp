import { describe, it, expect } from 'vitest';
import {
  readErectionFilterValues,
  buildErectionQuery,
  hasActiveErectionFilters,
  erectionEmptyStateText,
  showsLocationInput,
  erectionContractLabel,
  ERECTION_STATUS_FILTERS,
  ERECTION_SUMMARY_CARDS,
} from './erection-pieces-helpers';
import { pieceUpdateOptionsFor } from '../../../technical/_lib/boq-confirmation-helpers';

describe('status filter', () => {
  it('defaults to Delivered + Erected and sends no explicit status (the API applies the default)', () => {
    const values = readErectionFilterValues({});
    expect(values.status).toBe('DEFAULT');
    expect(buildErectionQuery(values)).toEqual({});
    expect(hasActiveErectionFilters(values)).toBe(false);
  });
  it('offers All, Delivered, Erected, Completed, Hold and Rejected', () => {
    expect(ERECTION_STATUS_FILTERS.map((f) => f.label)).toEqual(['Delivered + Erected', 'All', 'Delivered', 'Erected', 'Completed', 'Hold', 'Rejected']);
  });
  it('maps a chosen status to the API list and keeps the other filters', () => {
    const values = readErectionFilterValues({ status: 'COMPLETED', search: ' hc ', contractId: 'c1', drawingNo: 'HC-1', boqItem: 'Slab', page: '2' });
    expect(buildErectionQuery(values)).toEqual({ statuses: 'COMPLETED', search: 'hc', contractId: 'c1', drawingNo: 'HC-1', boqItem: 'Slab', page: 2 });
    expect(hasActiveErectionFilters(values)).toBe(true);
  });
  it('ignores a status this screen does not have (e.g. In Store) and a bad page', () => {
    const values = readErectionFilterValues({ status: 'IN_STORE', page: '0' });
    expect(values.status).toBe('DEFAULT');
    expect(values.page).toBe(1);
  });
});

describe('Erection update dropdown', () => {
  it('shows only Erected, Completed, Hold and Rejected', () => {
    const labels = pieceUpdateOptionsFor(['ERECTED', 'COMPLETED', 'ON_HOLD', 'REJECTED']).map((o) => o.label);
    expect(labels).toEqual(['Erected', 'Completed', 'Hold', 'Rejected']);
    for (const hidden of ['Drawing Ready', 'In Production', 'Produced', 'In Store', 'Delivered', 'Cancelled']) {
      expect(labels).not.toContain(hidden);
    }
  });
  it('hides the update controls for a read-only user or an unresolved list', () => {
    expect(pieceUpdateOptionsFor([])).toEqual([]);
    expect(pieceUpdateOptionsFor(null)).toEqual([]);
  });
});

describe('location / site note input', () => {
  it('only appears for Erected and Completed', () => {
    expect(showsLocationInput('ERECTED')).toBe(true);
    expect(showsLocationInput('COMPLETED')).toBe(true);
    expect(showsLocationInput('ON_HOLD')).toBe(false);
    expect(showsLocationInput('')).toBe(false);
  });
});

describe('wording', () => {
  it('has the four summary cards', () => {
    expect(ERECTION_SUMMARY_CARDS.map((c) => c.label)).toEqual(['Ready for Erection', 'Erected', 'Completed', 'On Hold / Rejected']);
  });
  it('empty state when no delivered pieces are ready', () => {
    expect(erectionEmptyStateText(false)).toEqual({
      title: 'No pieces ready for erection.',
      help: 'Pieces will appear here after Storage Yard & Delivery marks them as Delivered.',
    });
    expect(erectionEmptyStateText(true).title).toBe('No pieces match these filters.');
  });
  it('labels a job by job order, else system reference — never an id', () => {
    expect(erectionContractLabel({ referenceNumber: 'CONTRACT-2026-000012', jobOrder: 'JO-100', title: 'Tower A' })).toBe('JO-100 · Tower A');
    expect(erectionContractLabel({ referenceNumber: 'CONTRACT-2026-000012', jobOrder: null, title: 'Tower A' })).toBe('CONTRACT-2026-000012 · Tower A');
  });
});
