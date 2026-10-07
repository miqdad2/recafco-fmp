import { describe, it, expect } from 'vitest';
import {
  validateConfirmationForm,
  formatBoqItemOption,
  formatConfirmedPieces,
  formatContractQtyUnit,
  BOQ_CONFIRMATION_STATUS_LABELS,
} from './boq-confirmation-helpers';

const ok = { boqItemId: 'i1', drawingNo: 'HC-001', confirmedPieces: '20' };

describe('validateConfirmationForm', () => {
  it('accepts a complete confirmation', () => {
    expect(validateConfirmationForm(ok, true)).toEqual({});
  });
  it('uses the plain messages for missing item, drawing no and pieces', () => {
    expect(validateConfirmationForm({ boqItemId: '', drawingNo: ' ', confirmedPieces: '' }, true)).toEqual({
      boqItemId: 'Please select BOQ item.',
      drawingNo: 'Please enter drawing number.',
      confirmedPieces: 'Please enter confirmed pieces.',
    });
  });
  it('lets a draft leave pieces empty', () => {
    expect(validateConfirmationForm({ ...ok, confirmedPieces: '' }, false)).toEqual({});
  });
  it('rejects decimals, zero and negatives for drafts and confirms alike', () => {
    for (const confirming of [true, false]) {
      expect(validateConfirmationForm({ ...ok, confirmedPieces: '2.5' }, confirming).confirmedPieces).toBe('Confirmed pieces must be a whole number.');
      expect(validateConfirmationForm({ ...ok, confirmedPieces: '0' }, confirming).confirmedPieces).toBe('Confirmed pieces must be more than 0.');
      expect(validateConfirmationForm({ ...ok, confirmedPieces: '-4' }, confirming).confirmedPieces).toBe('Confirmed pieces must be more than 0.');
    }
  });
});

describe('display helpers', () => {
  it('shows the BOQ item with its contract quantity and unit', () => {
    expect(formatBoqItemOption({ description: 'Hollowcore Slab', contractQty: '500.000', contractUnit: 'm²' })).toBe('Hollowcore Slab — 500 M²');
    expect(formatBoqItemOption({ description: 'Beam', contractQty: null, contractUnit: null })).toBe('Beam');
    expect(formatContractQtyUnit('50.000', 'nos')).toBe('50 Nos');
    expect(formatContractQtyUnit(null, 'nos')).toBe('—');
  });
  it('counts confirmed pieces in Nos, or says not confirmed yet', () => {
    expect(formatConfirmedPieces(50)).toBe('50 Nos');
    expect(formatConfirmedPieces(null)).toBe('Not confirmed yet');
  });
  it('uses the approved status labels', () => {
    expect(BOQ_CONFIRMATION_STATUS_LABELS).toEqual({ DRAFT: 'Draft', CONFIRMED: 'Confirmed', REVISED: 'Revised', CANCELLED: 'Cancelled' });
  });
});

import { pieceStatusSummary, shouldShowGeneratePieces, BOQ_PIECE_STATUS_LABELS, BOQ_PIECE_FILTERS, BOQ_PIECE_UPDATE_OPTIONS, validatePieceUpdate, pieceUpdateOptionsFor } from './boq-confirmation-helpers';

describe('piece helpers (FMP-BOQ-04)', () => {
  it('uses the approved piece status labels', () => {
    expect(BOQ_PIECE_STATUS_LABELS.ON_HOLD).toBe('Hold');
    expect(BOQ_PIECE_STATUS_LABELS.DRAWING_READY).toBe('Drawing Ready');
    expect(Object.keys(BOQ_PIECE_STATUS_LABELS)).toHaveLength(11);
  });
  it('filters start with All and cover the listed statuses', () => {
    expect(BOQ_PIECE_FILTERS.map((f) => f.label)).toEqual([
      'All', 'Drawing Ready', 'In Production', 'Produced', 'In Store', 'Delivered', 'Erected', 'Hold', 'Rejected', 'Cancelled',
    ]);
  });
  it('summarises only statuses that have pieces, in lifecycle order', () => {
    expect(pieceStatusSummary({ IN_PRODUCTION: 5, DRAWING_READY: 45, ERECTED: 0 }).map((s) => `${s.label} ${s.count}`)).toEqual([
      'Drawing Ready 45',
      'In Production 5',
    ]);
    expect(pieceStatusSummary({})).toEqual([]);
  });
  it('shows Generate Pieces only while pieces are waiting to be created', () => {
    expect(shouldShowGeneratePieces([{ pendingPieces: 0 }, { pendingPieces: 3 }])).toBe(true);
    expect(shouldShowGeneratePieces([{ pendingPieces: 0 }])).toBe(false);
    expect(shouldShowGeneratePieces([])).toBe(false);
  });
});

describe('piece status update controls (FMP-BOQ-05)', () => {
  it('offers the ten statuses with friendly labels, never enum names', () => {
    expect(BOQ_PIECE_UPDATE_OPTIONS.map((o) => o.label)).toEqual([
      'Drawing Ready', 'In Production', 'Produced', 'In Store', 'Delivered', 'Erected', 'Completed', 'Hold', 'Rejected', 'Cancelled',
    ]);
    expect(BOQ_PIECE_UPDATE_OPTIONS.some((o) => o.label.includes('_'))).toBe(false);
  });
  it('asks for a piece first, then a status', () => {
    expect(validatePieceUpdate(0, 'PRODUCED')).toBe('Please select at least one piece.');
    expect(validatePieceUpdate(0, '')).toBe('Please select at least one piece.');
    expect(validatePieceUpdate(3, '')).toBe('Please select a status.');
    expect(validatePieceUpdate(3, 'PRODUCED')).toBeNull();
  });
});

describe('pieceUpdateOptionsFor (FMP-BOQ-06)', () => {
  it('a normal Technical user only sees the Technical-owned statuses', () => {
    const options = pieceUpdateOptionsFor(['DRAWING_READY', 'ON_HOLD', 'REJECTED', 'CANCELLED']);
    expect(options.map((o) => o.label)).toEqual(['Drawing Ready', 'Hold', 'Rejected', 'Cancelled']);
    const labels = options.map((o) => o.label);
    for (const hidden of ['In Production', 'Produced', 'In Store', 'Delivered', 'Erected', 'Completed']) {
      expect(labels).not.toContain(hidden);
    }
  });
  it('a manager/admin override user sees every status', () => {
    expect(pieceUpdateOptionsFor(BOQ_PIECE_UPDATE_OPTIONS.map((o) => o.value) as never)).toHaveLength(10);
  });
  it('fails safe: nothing to update when the list could not be resolved or is empty', () => {
    expect(pieceUpdateOptionsFor(null)).toEqual([]);
    expect(pieceUpdateOptionsFor([])).toEqual([]);
  });
});
