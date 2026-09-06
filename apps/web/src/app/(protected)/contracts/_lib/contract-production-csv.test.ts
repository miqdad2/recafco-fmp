import { describe, it, expect } from 'vitest';
import { buildProductionCsv, PRODUCTION_CSV_HEADERS } from './contract-production-csv';
import type { ContractProductionItem } from '@/lib/contracts-api';

function makeItem(overrides: Partial<ContractProductionItem> = {}): ContractProductionItem {
  return {
    id: 'item-1',
    itemCode: 'ITEM-001',
    category: 'Columns',
    description: 'Precast Concrete Columns',
    unitOfMeasure: 'Nos',
    totalQty: 1200,
    producedQty: 1050,
    deliveredQty: 800,
    stockNotDelivered: 250,
    remainingToCast: 150,
    progressPercent: 87,
    status: 'IN_PRODUCTION',
    remarks: 'Batch 3 in progress',
    updatedByUser: { id: 'user-1', displayName: 'Manager' },
    updatedAt: '2026-05-12T00:00:00Z',
    ...overrides,
  };
}

describe('buildProductionCsv', () => {
  it('produces a header row plus one row per item', () => {
    const csv = buildProductionCsv([makeItem()]);
    const rows = csv.split('\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(PRODUCTION_CSV_HEADERS.join(','));
    expect(rows[1]).toContain('ITEM-001');
    expect(rows[1]).toContain('Precast Concrete Columns');
    expect(rows[1]).toContain('In Production');
  });

  it('produces only the header row for an empty list (no fake rows)', () => {
    const csv = buildProductionCsv([]);
    expect(csv.split('\r\n')).toHaveLength(1);
  });

  it('escapes a description containing a comma', () => {
    const csv = buildProductionCsv([makeItem({ description: 'Beams, Type A' })]);
    expect(csv).toContain('"Beams, Type A"');
  });

  it('numbers rows sequentially starting at 1', () => {
    const csv = buildProductionCsv([makeItem({ id: 'a' }), makeItem({ id: 'b' })]);
    const rows = csv.split('\r\n');
    expect(rows[1]!.startsWith('1,')).toBe(true);
    expect(rows[2]!.startsWith('2,')).toBe(true);
  });
});
