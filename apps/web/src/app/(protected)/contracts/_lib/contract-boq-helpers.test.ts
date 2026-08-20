import { describe, it, expect } from 'vitest';
import {
  emptyBoqRow,
  boqRowQty,
  boqLineTotal,
  boqRowHasAnyValue,
  validateBoqRows,
  toBoqApiItems,
  boqRowsFromExisting,
  type BoqRow,
} from './contract-boq-helpers';

function makeRow(overrides: Partial<BoqRow> = {}): BoqRow {
  return { ...emptyBoqRow(), ...overrides };
}

describe('boqRowQty', () => {
  it('prefers revisedQty over originalEstimatedQty', () => {
    expect(boqRowQty(makeRow({ originalEstimatedQty: '100', revisedQty: '120' }))).toBe(120);
  });

  it('falls back to originalEstimatedQty when revisedQty is empty', () => {
    expect(boqRowQty(makeRow({ originalEstimatedQty: '100', revisedQty: '' }))).toBe(100);
  });

  it('returns null when neither quantity is set', () => {
    expect(boqRowQty(makeRow())).toBeNull();
  });
});

describe('boqLineTotal', () => {
  it('computes qty × unitPrice', () => {
    expect(boqLineTotal(makeRow({ originalEstimatedQty: '100', unitPrice: '25.5' }))).toBe(2550);
  });

  it('returns 0 when quantity is missing', () => {
    expect(boqLineTotal(makeRow({ unitPrice: '25.5' }))).toBe(0);
  });

  it('returns 0 when unit price is missing', () => {
    expect(boqLineTotal(makeRow({ originalEstimatedQty: '100' }))).toBe(0);
  });
});

describe('boqRowHasAnyValue', () => {
  it('returns false for a fully empty row', () => {
    expect(boqRowHasAnyValue(makeRow())).toBe(false);
  });

  it('returns true when any field is set', () => {
    expect(boqRowHasAnyValue(makeRow({ category: 'Precast' }))).toBe(true);
  });
});

describe('validateBoqRows', () => {
  it('returns null for all-empty rows', () => {
    expect(validateBoqRows([makeRow(), makeRow()])).toBeNull();
  });

  it('returns null for a fully valid row', () => {
    const row = makeRow({ description: 'Panels', originalEstimatedQty: '100', unitPrice: '25.5' });
    expect(validateBoqRows([row])).toBeNull();
  });

  it('rejects a non-empty row missing a description', () => {
    const row = makeRow({ category: 'Precast' });
    expect(validateBoqRows([row])).toMatch(/missing a description/);
  });

  it('rejects a non-positive Original Estimated Qty', () => {
    const row = makeRow({ description: 'Panels', originalEstimatedQty: '0' });
    expect(validateBoqRows([row])).toMatch(/Original Estimated Qty must be positive/);
  });

  it('rejects a negative Unit Price', () => {
    const row = makeRow({ description: 'Panels', unitPrice: '-5' });
    expect(validateBoqRows([row])).toMatch(/Unit Price must be zero or positive/);
  });

  it('allows a zero Unit Price', () => {
    const row = makeRow({ description: 'Panels', unitPrice: '0' });
    expect(validateBoqRows([row])).toBeNull();
  });

  it('rejects duplicate item codes', () => {
    const rows = [
      makeRow({ description: 'A', itemCode: 'PC-001' }),
      makeRow({ description: 'B', itemCode: 'PC-001' }),
    ];
    expect(validateBoqRows(rows)).toMatch(/Duplicate Item\/Code/);
  });

  it('does not flag multiple rows with no item code as duplicates', () => {
    const rows = [makeRow({ description: 'A' }), makeRow({ description: 'B' })];
    expect(validateBoqRows(rows)).toBeNull();
  });
});

describe('toBoqApiItems', () => {
  it('omits fully empty rows', () => {
    expect(toBoqApiItems([makeRow(), makeRow()])).toEqual([]);
  });

  it('trims and includes only populated fields', () => {
    const row = makeRow({ description: '  Panels  ', itemCode: ' PC-001 ', originalEstimatedQty: '100' });
    expect(toBoqApiItems([row])).toEqual([{ description: 'Panels', itemCode: 'PC-001', originalEstimatedQty: 100 }]);
  });
});

describe('boqRowsFromExisting', () => {
  it('maps server BOQ items into editable rows with defaults for missing fields', () => {
    const rows = boqRowsFromExisting([{ description: 'Panels', unitPrice: '25.500' }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.description).toBe('Panels');
    expect(rows[0]!.unitPrice).toBe('25.500');
    expect(rows[0]!.itemCode).toBe('');
  });

  it('returns an empty array for no items', () => {
    expect(boqRowsFromExisting([])).toEqual([]);
  });
});
