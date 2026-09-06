import { describe, it, expect } from 'vitest';
import {
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_STATUS_FILTER_OPTIONS,
  PRODUCTION_STATUS_OPTIONS,
  computeStockNotDelivered,
  computeRemainingToCast,
  computePercentOfTotal,
  suggestProductionStatus,
  validateProductionFormValues,
  type ProductionFormValidationInput,
} from './contract-production-helpers';

describe('PRODUCTION_STATUS_LABELS', () => {
  it('maps every real backend status to its manager-facing label', () => {
    expect(PRODUCTION_STATUS_LABELS.NOT_STARTED).toBe('Not Started');
    expect(PRODUCTION_STATUS_LABELS.IN_PRODUCTION).toBe('In Production');
    expect(PRODUCTION_STATUS_LABELS.PARTIALLY_DELIVERED).toBe('Partially Delivered');
    expect(PRODUCTION_STATUS_LABELS.COMPLETED).toBe('Completed');
    expect(PRODUCTION_STATUS_LABELS.DELAYED).toBe('Delayed');
  });
});

describe('PRODUCTION_STATUS_FILTER_OPTIONS', () => {
  it('includes an "All" option plus every real status', () => {
    expect(PRODUCTION_STATUS_FILTER_OPTIONS[0]).toEqual({ value: '', label: 'All' });
    expect(PRODUCTION_STATUS_FILTER_OPTIONS).toHaveLength(6);
  });
});

describe('PRODUCTION_STATUS_OPTIONS', () => {
  it('has exactly the 5 real statuses, no "All" entry', () => {
    expect(PRODUCTION_STATUS_OPTIONS).toHaveLength(5);
    expect(PRODUCTION_STATUS_OPTIONS.map((o) => o.value)).toEqual([
      'NOT_STARTED', 'IN_PRODUCTION', 'PARTIALLY_DELIVERED', 'COMPLETED', 'DELAYED',
    ]);
  });
});

describe('computeStockNotDelivered', () => {
  it('is produced minus delivered', () => {
    expect(computeStockNotDelivered(1050, 800)).toBe(250);
  });

  it('is 0 for zero inputs', () => {
    expect(computeStockNotDelivered(0, 0)).toBe(0);
  });
});

describe('computeRemainingToCast', () => {
  it('is total minus produced', () => {
    expect(computeRemainingToCast(1200, 1050)).toBe(150);
  });

  it('is 0 when total and produced are both 0', () => {
    expect(computeRemainingToCast(0, 0)).toBe(0);
  });
});

describe('computePercentOfTotal', () => {
  it('computes a real percentage matching the backend', () => {
    expect(computePercentOfTotal(7850, 12450)).toBeCloseTo(63.052, 2);
  });

  it('is divide-by-zero safe: returns 0 when total is 0', () => {
    expect(computePercentOfTotal(500, 0)).toBe(0);
  });

  it('is divide-by-zero safe: returns 0 when total is negative', () => {
    expect(computePercentOfTotal(500, -10)).toBe(0);
  });
});

describe('CM-70B — test data verification (Precast Boundary Wall Panel Type A, Total Qty 400, Produced 120, Delivered 40)', () => {
  it('Stock / Not Delivered = 80', () => {
    expect(computeStockNotDelivered(120, 40)).toBe(80);
  });

  it('Remaining to Cast = 280', () => {
    expect(computeRemainingToCast(400, 120)).toBe(280);
  });

  it('Progress = 30%', () => {
    expect(Math.round(computePercentOfTotal(120, 400))).toBe(30);
  });
});

describe('suggestProductionStatus', () => {
  it('returns null with no real positive Total Qty', () => {
    expect(suggestProductionStatus(0, 0, 0)).toBeNull();
  });

  it('Produced = 0 → NOT_STARTED', () => {
    expect(suggestProductionStatus(400, 0, 0)).toBe('NOT_STARTED');
  });

  it('0 < Produced < Total → IN_PRODUCTION', () => {
    expect(suggestProductionStatus(400, 120, 40)).toBe('IN_PRODUCTION');
  });

  it('Produced = Total and Delivered < Total → PARTIALLY_DELIVERED', () => {
    expect(suggestProductionStatus(400, 400, 100)).toBe('PARTIALLY_DELIVERED');
  });

  it('Delivered = Total → COMPLETED', () => {
    expect(suggestProductionStatus(400, 400, 400)).toBe('COMPLETED');
  });

  it('never suggests DELAYED — it is manual-only, not amount-derivable', () => {
    for (const [total, produced, delivered] of [[400, 0, 0], [400, 120, 40], [400, 400, 100], [400, 400, 400]] as const) {
      expect(suggestProductionStatus(total, produced, delivered)).not.toBe('DELAYED');
    }
  });
});

describe('validateProductionFormValues', () => {
  function makeInput(overrides: Partial<ProductionFormValidationInput> = {}): ProductionFormValidationInput {
    return { totalQty: 400, producedQty: '120', deliveredQty: '40', ...overrides };
  }

  it('a valid produced/delivered pair within Total Qty passes', () => {
    expect(validateProductionFormValues(makeInput())).toEqual([]);
  });

  it('Delivered = 0 with Produced > 0 is valid (production started, nothing delivered yet)', () => {
    expect(validateProductionFormValues(makeInput({ deliveredQty: '0' }))).toEqual([]);
  });

  it('requires Casted / Produced quantity', () => {
    expect(validateProductionFormValues(makeInput({ producedQty: '' }))).toContain('Casted / Produced quantity is required.');
  });

  it('requires Delivered quantity, but 0 is a fully valid, non-missing value', () => {
    expect(validateProductionFormValues(makeInput({ deliveredQty: '' }))).toContain('Delivered quantity is required.');
    expect(validateProductionFormValues(makeInput({ deliveredQty: '0' }))).not.toContain('Delivered quantity is required.');
  });

  it('rejects a negative Casted / Produced quantity', () => {
    expect(validateProductionFormValues(makeInput({ producedQty: '-5' }))).toContain('Casted / Produced quantity cannot be negative.');
  });

  it('rejects a negative Delivered quantity', () => {
    expect(validateProductionFormValues(makeInput({ deliveredQty: '-5' }))).toContain('Delivered quantity cannot be negative.');
  });

  it('rejects Casted / Produced exceeding Total Qty', () => {
    const errors = validateProductionFormValues(makeInput({ producedQty: '450' }));
    expect(errors).toContain('Casted / Produced quantity cannot exceed the item’s Total Qty.');
  });

  it('rejects Delivered exceeding Casted / Produced with the exact required message', () => {
    const errors = validateProductionFormValues(makeInput({ producedQty: '100', deliveredQty: '150' }));
    expect(errors).toContain('Delivered quantity cannot be more than casted/produced quantity.');
  });

  it('Produced = Total Qty exactly is valid (not an overrun)', () => {
    expect(validateProductionFormValues(makeInput({ producedQty: '400', deliveredQty: '400' }))).toEqual([]);
  });
});
