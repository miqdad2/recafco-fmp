import { describe, it, expect } from 'vitest';
import {
  readStorageFilterValues,
  buildStorageQuery,
  hasActiveStorageFilters,
  storageEmptyStateText,
  showsLocationInput,
  storageContractLabel,
  STORAGE_STATUS_FILTERS,
  STORAGE_SUMMARY_CARDS,
} from './storage-pieces-helpers';
import { pieceUpdateOptionsFor } from '../../../technical/_lib/boq-confirmation-helpers';

describe('status filter', () => {
  it('defaults to Produced + In Store and sends no explicit status (the API applies the default)', () => {
    const values = readStorageFilterValues({});
    expect(values.status).toBe('DEFAULT');
    expect(buildStorageQuery(values)).toEqual({});
    expect(hasActiveStorageFilters(values)).toBe(false);
  });
  it('offers All, Produced, In Store, Delivered, Hold and Rejected', () => {
    expect(STORAGE_STATUS_FILTERS.map((f) => f.label)).toEqual(['Produced + In Store', 'All', 'Produced', 'In Store', 'Delivered', 'Hold', 'Rejected']);
  });
  it('maps a chosen status to the API list and keeps the other filters', () => {
    const values = readStorageFilterValues({ status: 'DELIVERED', search: ' hc ', contractId: 'c1', drawingNo: 'HC-1', boqItem: 'Slab', page: '2' });
    expect(buildStorageQuery(values)).toEqual({ statuses: 'DELIVERED', search: 'hc', contractId: 'c1', drawingNo: 'HC-1', boqItem: 'Slab', page: 2 });
    expect(hasActiveStorageFilters(values)).toBe(true);
  });
  it('ignores a status this screen does not have (e.g. Drawing Ready) and a bad page', () => {
    const values = readStorageFilterValues({ status: 'DRAWING_READY', page: '0' });
    expect(values.status).toBe('DEFAULT');
    expect(values.page).toBe(1);
  });
});

describe('Storage & Delivery update dropdown', () => {
  it('shows only In Store, Delivered, Hold and Rejected', () => {
    const labels = pieceUpdateOptionsFor(['IN_STORE', 'DELIVERED', 'ON_HOLD', 'REJECTED']).map((o) => o.label);
    expect(labels).toEqual(['In Store', 'Delivered', 'Hold', 'Rejected']);
    for (const hidden of ['Drawing Ready', 'In Production', 'Produced', 'Erected', 'Completed', 'Cancelled']) {
      expect(labels).not.toContain(hidden);
    }
  });
  it('hides the update controls for a read-only user or an unresolved list', () => {
    expect(pieceUpdateOptionsFor([])).toEqual([]);
    expect(pieceUpdateOptionsFor(null)).toEqual([]);
  });
});

describe('location input', () => {
  it('only appears for In Store and Delivered', () => {
    expect(showsLocationInput('IN_STORE')).toBe(true);
    expect(showsLocationInput('DELIVERED')).toBe(true);
    expect(showsLocationInput('ON_HOLD')).toBe(false);
    expect(showsLocationInput('')).toBe(false);
  });
});

describe('wording', () => {
  it('has the four summary cards', () => {
    expect(STORAGE_SUMMARY_CARDS.map((c) => c.label)).toEqual(['Ready for Store', 'In Store', 'Delivered', 'On Hold / Rejected']);
  });
  it('empty state when no produced pieces are ready', () => {
    expect(storageEmptyStateText(false)).toEqual({
      title: 'No pieces ready for storage or delivery.',
      help: 'Pieces will appear here after Production marks them as Produced.',
    });
    expect(storageEmptyStateText(true).title).toBe('No pieces match these filters.');
  });
  it('labels a job by job order, else system reference — never an id', () => {
    expect(storageContractLabel({ referenceNumber: 'CONTRACT-2026-000012', jobOrder: 'JO-100', title: 'Tower A' })).toBe('JO-100 · Tower A');
    expect(storageContractLabel({ referenceNumber: 'CONTRACT-2026-000012', jobOrder: null, title: 'Tower A' })).toBe('CONTRACT-2026-000012 · Tower A');
  });
});
