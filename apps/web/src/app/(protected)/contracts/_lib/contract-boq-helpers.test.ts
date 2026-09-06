import { describe, it, expect } from 'vitest';
import {
  emptyBoqRow,
  emptyRegisterBoqRow,
  boqRowQty,
  boqLineTotal,
  boqInvoicedValue,
  boqProgressPercent,
  boqAmountRemaining,
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

  it('maps a saved invoiceQty back onto the editable row', () => {
    const rows = boqRowsFromExisting([{ description: 'Panels', invoiceQty: '40.000' }]);
    expect(rows[0]!.invoiceQty).toBe('40.000');
  });

  it('maps a saved drawingQty back onto the editable row', () => {
    const rows = boqRowsFromExisting([{ description: 'Panels', drawingQty: '90.000' }]);
    expect(rows[0]!.drawingQty).toBe('90.000');
  });
});

// ---------------------------------------------------------------------------
// CM-56 — emptyRegisterBoqRow / boqInvoicedValue / boqProgressPercent / boqAmountRemaining
// ---------------------------------------------------------------------------

describe('emptyRegisterBoqRow', () => {
  it('defaults Unit to m², unlike the shared emptyBoqRow()', () => {
    expect(emptyRegisterBoqRow().unitOfMeasure).toBe('m²');
    expect(emptyBoqRow().unitOfMeasure).toBe('');
  });

  it('is otherwise identical to emptyBoqRow() (same blank fields)', () => {
    const registerRow = emptyRegisterBoqRow();
    const plainRow = emptyBoqRow();
    expect({ ...registerRow, id: '', unitOfMeasure: '' }).toEqual({ ...plainRow, id: '', unitOfMeasure: '' });
  });
});

describe('boqInvoicedValue', () => {
  it('computes invoiceQty × unitPrice', () => {
    expect(boqInvoicedValue(makeRow({ invoiceQty: '40', unitPrice: '10' }))).toBe(400);
  });

  it('returns 0 when invoiceQty is blank', () => {
    expect(boqInvoicedValue(makeRow({ unitPrice: '10' }))).toBe(0);
  });

  it('returns 0 when unitPrice is blank', () => {
    expect(boqInvoicedValue(makeRow({ invoiceQty: '40' }))).toBe(0);
  });
});

describe('boqProgressPercent', () => {
  it('computes invoiceQty / BOQ qty × 100, rounded', () => {
    expect(boqProgressPercent(makeRow({ originalEstimatedQty: '200', invoiceQty: '50' }))).toBe(25);
  });

  it('returns 0 (not NaN) when BOQ qty is blank', () => {
    expect(boqProgressPercent(makeRow({ invoiceQty: '50' }))).toBe(0);
  });

  it('returns 0 (not a divide-by-zero error) when BOQ qty is exactly 0', () => {
    expect(boqProgressPercent(makeRow({ originalEstimatedQty: '0', invoiceQty: '50' }))).toBe(0);
  });

  it('returns 0 when invoiceQty is blank', () => {
    expect(boqProgressPercent(makeRow({ originalEstimatedQty: '200' }))).toBe(0);
  });

  it('prefers revisedQty over originalEstimatedQty, matching boqRowQty', () => {
    expect(boqProgressPercent(makeRow({ originalEstimatedQty: '200', revisedQty: '100', invoiceQty: '50' }))).toBe(50);
  });
});

describe('boqAmountRemaining', () => {
  it('computes Total Price minus invoiced value', () => {
    const row = makeRow({ originalEstimatedQty: '200', unitPrice: '10', invoiceQty: '50' });
    // total = 200*10 = 2000, invoiced = 50*10 = 500
    expect(boqAmountRemaining(row)).toBe(1500);
  });

  it('equals Total Price when invoiceQty is blank', () => {
    const row = makeRow({ originalEstimatedQty: '200', unitPrice: '10' });
    expect(boqAmountRemaining(row)).toBe(boqLineTotal(row));
  });

  it('is 0 (not negative) when BOQ qty is blank, even with a real invoiceQty entered', () => {
    const row = makeRow({ invoiceQty: '5', unitPrice: '10' });
    expect(boqAmountRemaining(row)).toBe(0);
  });

  it('is 0 (not negative) when BOQ qty is explicitly "0"', () => {
    const row = makeRow({ originalEstimatedQty: '0', invoiceQty: '5', unitPrice: '10' });
    expect(boqAmountRemaining(row)).toBe(0);
  });

  it('goes negative (not clamped) when invoiced value exceeds Total Price — real over-invoicing signal', () => {
    const row = makeRow({ originalEstimatedQty: '10', unitPrice: '10', invoiceQty: '20' });
    // total = 100, invoiced = 200
    expect(boqAmountRemaining(row)).toBe(-100);
  });
});

// ---------------------------------------------------------------------------
// CM-56D — Drawing Qty: purely informational, must never feed any formula.
// ---------------------------------------------------------------------------

describe('drawingQty is never read by any BOQ formula', () => {
  it('does not affect boqLineTotal (Total Price)', () => {
    const withoutDrawingQty = makeRow({ originalEstimatedQty: '100', unitPrice: '25.5' });
    const withDrawingQty = makeRow({ originalEstimatedQty: '100', unitPrice: '25.5', drawingQty: '999' });
    expect(boqLineTotal(withDrawingQty)).toBe(boqLineTotal(withoutDrawingQty));
    expect(boqLineTotal(withDrawingQty)).toBe(2550);
  });

  it('does not affect boqProgressPercent (Progress / Invoice %)', () => {
    const withoutDrawingQty = makeRow({ originalEstimatedQty: '200', invoiceQty: '50' });
    const withDrawingQty = makeRow({ originalEstimatedQty: '200', invoiceQty: '50', drawingQty: '999' });
    expect(boqProgressPercent(withDrawingQty)).toBe(boqProgressPercent(withoutDrawingQty));
    expect(boqProgressPercent(withDrawingQty)).toBe(25);
  });

  it('does not affect boqAmountRemaining (Amount Remaining)', () => {
    const withoutDrawingQty = makeRow({ originalEstimatedQty: '200', unitPrice: '10', invoiceQty: '50' });
    const withDrawingQty = makeRow({ originalEstimatedQty: '200', unitPrice: '10', invoiceQty: '50', drawingQty: '999' });
    expect(boqAmountRemaining(withDrawingQty)).toBe(boqAmountRemaining(withoutDrawingQty));
    expect(boqAmountRemaining(withDrawingQty)).toBe(1500);
  });

  it('is included in toBoqApiItems() when populated', () => {
    const row = makeRow({ description: 'Panels', drawingQty: '90' });
    expect(toBoqApiItems([row])).toEqual([{ description: 'Panels', drawingQty: 90 }]);
  });

  it('is omitted from toBoqApiItems() when blank', () => {
    const row = makeRow({ description: 'Panels' });
    expect(toBoqApiItems([row])[0]).not.toHaveProperty('drawingQty');
  });

  it('makes a row with only drawingQty set count as non-empty', () => {
    expect(boqRowHasAnyValue(makeRow({ drawingQty: '5' }))).toBe(true);
  });

  it('rejects a negative Drawing Qty', () => {
    const row = makeRow({ description: 'Panels', drawingQty: '-1' });
    expect(validateBoqRows([row])).toMatch(/Drawing Qty must be zero or positive/);
  });

  it('allows a blank Drawing Qty', () => {
    const row = makeRow({ description: 'Panels', originalEstimatedQty: '100', unitPrice: '25.5' });
    expect(validateBoqRows([row])).toBeNull();
  });
});
