import { describe, it, expect } from 'vitest';
import type { BoqConfirmationItem, ElementCoverageRow } from '@/lib/technical-api';
import { technicalStats, productionStats, deliveryStats, erectionStats, departmentLink } from './contract-department-helpers';

const item = (statusCounts: BoqConfirmationItem['statusCounts'], confirmedPieces: number | null = 0): BoqConfirmationItem =>
  ({ boqItemId: 'b', sortOrder: 1, description: 'd', contractQty: null, contractUnit: null, confirmedPieces, confirmations: [], piecesGenerated: 0, statusCounts, pendingPieces: 0, needsAttention: false });

const row = (currentStatus: ElementCoverageRow['currentStatus'], releaseState: ElementCoverageRow['releaseState'], coverage: ElementCoverageRow['coverage']): ElementCoverageRow =>
  ({ id: Math.random().toString(), boqItemId: 'b', boqItemSortOrder: 1, boqItemDescription: 'd', pieceNo: 1, pieceCode: 'p', drawingNo: 'x', currentStatus, group: null, individualFileCount: 0, releasedToProductionAt: null, releasedAt: null, releasedByName: null, releasedVia: null, coverage, releaseState });

const val = (stats: { label: string; value: number | null }[], label: string): number | null => stats.find((s) => s.label === label)!.value;

describe('contract department summaries (FMP-CONTRACT-DETAIL-01)', () => {
  const rows = [row('NOT_STARTED', 'WAITING', 'NONE'), row('DRAWING_READY', 'READY', 'GROUP'), row('DRAWING_READY', 'RELEASED', 'INDIVIDUAL'), row('IN_PRODUCTION', 'RELEASED', 'GROUP')];

  it('technical counts come from coverage rows and confirmations', () => {
    const s = technicalStats([item({}, 4), item({}, 2)], rows, 3);
    expect(val(s, 'Initial BOQ Drawings')).toBe(3);
    expect(val(s, 'Confirmed Elements')).toBe(6);
    expect(val(s, 'Elements with Final Drawings')).toBe(3);
    expect(val(s, 'Waiting for Drawings')).toBe(1);
    expect(val(s, 'Waiting for Release')).toBe(1);
    expect(val(s, 'Released to Production')).toBe(2);
  });

  it('technical shows unavailable (null), not zero, when coverage or attachments did not load', () => {
    const s = technicalStats([item({}, 1)], null, null);
    expect(val(s, 'Elements with Final Drawings')).toBeNull();
    expect(val(s, 'Released to Production')).toBeNull();
    expect(val(s, 'Initial BOQ Drawings')).toBeNull();
    expect(val(s, 'Confirmed Elements')).toBe(1);
  });

  it('production counts', () => {
    const items = [item({ IN_PRODUCTION: 2, PRODUCED: 3, SENT_TO_STORAGE: 1, ON_HOLD: 1, REJECTED: 2 })];
    const s = productionStats(items, rows);
    expect(val(s, 'Ready for Production')).toBe(1);
    expect(val(s, 'In Production')).toBe(2);
    expect(val(s, 'Produced')).toBe(4);
    expect(val(s, 'On Hold / Rejected')).toBe(3);
    expect(val(s, 'Sent to Storage Yard')).toBe(1);
    expect(val(productionStats(items, null), 'Ready for Production')).toBeNull();
  });

  it('delivery counts use only real statuses', () => {
    const s = deliveryStats([item({ SENT_TO_STORAGE: 2, IN_STORE: 3, DELIVERED: 4, ERECTED: 9 })]);
    expect(val(s, 'Elements in Store')).toBe(3);
    expect(val(s, 'Delivered')).toBe(4);
    expect(val(s, 'Pending Delivery')).toBe(5);
  });

  it('erection marks untracked values as unavailable instead of inventing them', () => {
    const s = erectionStats([item({ DELIVERED: 2, ERECTED: 3, COMPLETED: 1, ON_HOLD: 5 })]);
    expect(val(s, 'Awaiting Erection')).toBe(2);
    expect(val(s, 'Erected')).toBe(3);
    expect(val(s, 'Completed')).toBe(1);
    expect(val(s, 'In Erection')).toBeNull();
    expect(val(s, 'Hold / Rejected')).toBeNull();
  });

  it('links appear only with the screen’s own permission and keep the contract filter', () => {
    expect(departmentLink('production', 'c1', [])).toBeNull();
    expect(departmentLink('production', 'c1', ['production.read'])?.href).toBe('/production/pieces?contractId=c1');
    expect(departmentLink('delivery', 'c1', ['storage_delivery.read'])?.href).toBe('/storage-delivery/pieces?contractId=c1');
    expect(departmentLink('erection', 'c1', ['contracts.read'])).toBeNull();
    expect(departmentLink('erection', 'c1', ['erection.read'])?.href).toBe('/erection/pieces?contractId=c1');
    expect(departmentLink('technical', 'c1', ['contracts.read'])?.href).toBe('/technical/jobs/c1');
    expect(departmentLink('technical', 'c1', [])).toBeNull();
  });
});
