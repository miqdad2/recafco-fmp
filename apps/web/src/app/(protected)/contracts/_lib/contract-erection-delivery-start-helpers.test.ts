import { describe, it, expect } from 'vitest';
import {
  ERECTION_DELIVERY_START_STATUS_LABELS,
  ERECTION_DELIVERY_ITEM_STATUS_LABELS,
  ERECTION_DELIVERY_DOCUMENT_STATUS_LABELS,
  ERECTION_DELIVERY_DOCUMENT_NAMES,
  validateErectionDeliveryStartFormValues,
  validateErectionDeliveryStartHoldOrReturnComments,
  validateErectionDeliveryItemRows,
  computeDisplayStatus,
  computeDeliveryTotalsPreview,
  computeErectionStepTrackerCurrentStep,
  type ErectionDeliveryStartFormValidationInput,
  type ErectionDeliveryItemFormRow,
} from './contract-erection-delivery-start-helpers';

const VALID_INPUT: ErectionDeliveryStartFormValidationInput = {
  deliveryReferenceNo: 'DEL-GRM-001',
  deliveryDate: '2026-10-28',
  plannedDeliveryWindowStart: '2026-10-28',
  plannedDeliveryWindowEnd: '2026-10-30',
  transportMode: 'Road',
  dispatchProductionSource: 'RECAFCO Precast Yard',
  dispatchFromYard: 'RECAFCO Mina Abdullah Yard',
  deliveryToSiteLocation: 'GRM Site - Boundary Wall Zone A',
};

describe('ERECTION_DELIVERY_START_STATUS_LABELS', () => {
  it('maps every real backend status to its manager-facing label', () => {
    expect(ERECTION_DELIVERY_START_STATUS_LABELS.DRAFT).toBe('Draft');
    expect(ERECTION_DELIVERY_START_STATUS_LABELS.STARTED).toBe('Started');
    expect(ERECTION_DELIVERY_START_STATUS_LABELS.HOLD).toBe('Hold');
    expect(ERECTION_DELIVERY_START_STATUS_LABELS.RETURNED).toBe('Returned');
  });
});

describe('ERECTION_DELIVERY_ITEM_STATUS_LABELS', () => {
  it('covers all 4 real item statuses', () => {
    expect(ERECTION_DELIVERY_ITEM_STATUS_LABELS.READY_TO_DISPATCH).toBe('Ready to Dispatch');
    expect(ERECTION_DELIVERY_ITEM_STATUS_LABELS.DISPATCHED).toBe('Dispatched');
    expect(ERECTION_DELIVERY_ITEM_STATUS_LABELS.DELIVERED).toBe('Delivered');
    expect(ERECTION_DELIVERY_ITEM_STATUS_LABELS.HOLD).toBe('Hold');
  });
});

describe('ERECTION_DELIVERY_DOCUMENT_STATUS_LABELS / ERECTION_DELIVERY_DOCUMENT_NAMES', () => {
  it('covers all 3 real document statuses', () => {
    expect(ERECTION_DELIVERY_DOCUMENT_STATUS_LABELS.PENDING).toBe('Pending');
    expect(ERECTION_DELIVERY_DOCUMENT_STATUS_LABELS.ATTACHED).toBe('Attached');
    expect(ERECTION_DELIVERY_DOCUMENT_STATUS_LABELS.NOT_REQUIRED).toBe('Not Required');
  });

  it('has exactly the 4 documents this unit specifies, in order', () => {
    expect(ERECTION_DELIVERY_DOCUMENT_NAMES).toEqual([
      'Packing List',
      'Material Test Certificates',
      'Delivery Note / Invoice',
      'Bill of Lading / LR',
    ]);
  });
});

describe('validateErectionDeliveryStartFormValues', () => {
  it('returns no errors when every required field is filled in', () => {
    expect(validateErectionDeliveryStartFormValues(VALID_INPUT)).toEqual([]);
  });

  it('requires Delivery Reference No.', () => {
    expect(validateErectionDeliveryStartFormValues({ ...VALID_INPUT, deliveryReferenceNo: '' })).toContain('Delivery Reference No. is required.');
  });

  it('requires Delivery Date', () => {
    expect(validateErectionDeliveryStartFormValues({ ...VALID_INPUT, deliveryDate: '' })).toContain('Delivery Date is required.');
  });

  it('requires Planned Delivery Window Start', () => {
    expect(validateErectionDeliveryStartFormValues({ ...VALID_INPUT, plannedDeliveryWindowStart: '' })).toContain('Planned Delivery Window Start is required.');
  });

  it('requires Planned Delivery Window End', () => {
    expect(validateErectionDeliveryStartFormValues({ ...VALID_INPUT, plannedDeliveryWindowEnd: '' })).toContain('Planned Delivery Window End is required.');
  });

  it('requires Transport Mode', () => {
    expect(validateErectionDeliveryStartFormValues({ ...VALID_INPUT, transportMode: '  ' })).toContain('Transport Mode is required.');
  });

  it('requires Dispatch / Production Source', () => {
    expect(validateErectionDeliveryStartFormValues({ ...VALID_INPUT, dispatchProductionSource: '' })).toContain('Dispatch / Production Source is required.');
  });

  it('requires Dispatch From / Yard', () => {
    expect(validateErectionDeliveryStartFormValues({ ...VALID_INPUT, dispatchFromYard: '' })).toContain('Dispatch From / Yard is required.');
  });

  it('requires Delivery To Site / Location', () => {
    expect(validateErectionDeliveryStartFormValues({ ...VALID_INPUT, deliveryToSiteLocation: '' })).toContain('Delivery To Site / Location is required.');
  });

  it('rejects a delivery window end before the window start', () => {
    const errors = validateErectionDeliveryStartFormValues({ ...VALID_INPUT, plannedDeliveryWindowStart: '2026-10-30', plannedDeliveryWindowEnd: '2026-10-28' });
    expect(errors).toContain('Planned Delivery Window End cannot be before Planned Delivery Window Start.');
  });

  it('collects every missing required field, not just the first', () => {
    const errors = validateErectionDeliveryStartFormValues({
      deliveryReferenceNo: '', deliveryDate: '', plannedDeliveryWindowStart: '', plannedDeliveryWindowEnd: '',
      transportMode: '', dispatchProductionSource: '', dispatchFromYard: '', deliveryToSiteLocation: '',
    });
    expect(errors).toHaveLength(8);
  });
});

describe('validateErectionDeliveryStartHoldOrReturnComments', () => {
  it('requires comments', () => {
    expect(validateErectionDeliveryStartHoldOrReturnComments('')).toContain('Comments are required to place delivery on Hold or Return it.');
  });

  it('rejects whitespace-only comments', () => {
    expect(validateErectionDeliveryStartHoldOrReturnComments('   ')).toHaveLength(1);
  });

  it('accepts real comments text', () => {
    expect(validateErectionDeliveryStartHoldOrReturnComments('Waiting on vehicle availability.')).toEqual([]);
  });
});

describe('validateErectionDeliveryItemRows', () => {
  const validRow: ErectionDeliveryItemFormRow = {
    description: 'Precast Boundary Wall Panel Type A', packageNo: 'PKG-001', weight: '12.60', volume: '18.40', quantity: '100', status: 'READY_TO_DISPATCH',
  };

  it('returns no errors for a fully valid row', () => {
    expect(validateErectionDeliveryItemRows([validRow])).toEqual([]);
  });

  it('requires a Description', () => {
    const errors = validateErectionDeliveryItemRows([{ ...validRow, description: '' }]);
    expect(errors).toEqual(['Item 1: Description is required.']);
  });

  it('requires a positive Qty', () => {
    expect(validateErectionDeliveryItemRows([{ ...validRow, quantity: '' }])).toEqual(['Item 1: Qty must be a positive number.']);
    expect(validateErectionDeliveryItemRows([{ ...validRow, quantity: '0' }])).toEqual(['Item 1: Qty must be a positive number.']);
    expect(validateErectionDeliveryItemRows([{ ...validRow, quantity: '-5' }])).toEqual(['Item 1: Qty must be a positive number.']);
  });

  it('returns no errors for an empty item list — items are optional overall', () => {
    expect(validateErectionDeliveryItemRows([])).toEqual([]);
  });

  it('labels each row by its own 1-based position', () => {
    const errors = validateErectionDeliveryItemRows([validRow, { ...validRow, description: '' }]);
    expect(errors).toEqual(['Item 2: Description is required.']);
  });
});

describe('computeDisplayStatus', () => {
  it('shows "Draft" when no record has been created yet', () => {
    expect(computeDisplayStatus(null, []).label).toBe('Draft');
  });

  it('shows "Ready to Start" for a DRAFT record whose required fields are all already valid — a computed label, never a stored status', () => {
    expect(computeDisplayStatus('DRAFT', []).label).toBe('Ready to Start');
  });

  it('shows plain "Draft" for a DRAFT record still missing required fields', () => {
    expect(computeDisplayStatus('DRAFT', ['Delivery Reference No. is required.']).label).toBe('Draft');
  });

  it('shows the real stored label for STARTED regardless of validation state', () => {
    expect(computeDisplayStatus('STARTED', []).label).toBe('Started');
  });

  it('shows the real stored label for HOLD', () => {
    expect(computeDisplayStatus('HOLD', []).label).toBe('Hold');
  });

  it('shows the real stored label for RETURNED', () => {
    expect(computeDisplayStatus('RETURNED', []).label).toBe('Returned');
  });
});

describe('computeDeliveryTotalsPreview', () => {
  it('returns all-zero/null for an empty item list — never fabricates a total', () => {
    expect(computeDeliveryTotalsPreview([])).toEqual({ totalPackages: 0, totalWeight: null, totalVolume: null, totalItems: 0 });
  });

  it('matches the unit demo data exactly (5 items)', () => {
    const items = [
      { weight: 12.6, volume: 18.4, quantity: 100 },
      { weight: 8.75, volume: 12.2, quantity: 60 },
      { weight: 4.3, volume: 5.1, quantity: 20 },
      { weight: 6.8, volume: 7.9, quantity: 40 },
      { weight: 5.25, volume: 4.6, quantity: 150 },
    ];
    const totals = computeDeliveryTotalsPreview(items);
    expect(totals.totalPackages).toBe(5);
    expect(totals.totalWeight).toBeCloseTo(37.7, 5);
    expect(totals.totalVolume).toBeCloseTo(48.2, 5);
    expect(totals.totalItems).toBe(370);
  });
});

describe('computeErectionStepTrackerCurrentStep', () => {
  it('stays on Step 3 until the schedule reaches Issued', () => {
    expect(computeErectionStepTrackerCurrentStep(null, null)).toBe(3);
    expect(computeErectionStepTrackerCurrentStep('DRAFT', null)).toBe(3);
    expect(computeErectionStepTrackerCurrentStep('HOLD', null)).toBe(3);
  });

  it('moves to Step 4 once the schedule is Issued and delivery has not Started yet', () => {
    expect(computeErectionStepTrackerCurrentStep('ISSUED', null)).toBe(4);
    expect(computeErectionStepTrackerCurrentStep('ISSUED', 'DRAFT')).toBe(4);
    expect(computeErectionStepTrackerCurrentStep('ISSUED', 'HOLD')).toBe(4);
  });

  it('moves to Step 5 once delivery has Started', () => {
    expect(computeErectionStepTrackerCurrentStep('ISSUED', 'STARTED')).toBe(5);
  });
});
