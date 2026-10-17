import { describe, it, expect } from 'vitest';
import {
  validateNewBoqItem,
  newBoqItemTotal,
  canAddBoqItems,
  boqTotalNote,
  elementsNotConfirmed,
  filesFailedText,
  ADD_BOQ_ITEM_TEXT,
  REGISTER_UNIT_OPTIONS,
} from './add-boq-item-helpers';

const ok = { description: 'Hollowcore Slab', unit: 'm²', contractQty: '500', unitPrice: '12.5' };

describe('validateNewBoqItem', () => {
  it('accepts a complete item', () => {
    expect(validateNewBoqItem(ok)).toEqual({});
  });
  it('asks for every field in plain words', () => {
    expect(validateNewBoqItem({ description: ' ', unit: '', contractQty: '', unitPrice: '' })).toEqual({
      description: 'Please enter item description.',
      unit: 'Please select unit.',
      contractQty: 'Please enter Contract Qty.',
      unitPrice: 'Please enter unit price.',
    });
  });
  it('rejects zero / negative quantity and negative price, but allows a price of 0', () => {
    expect(validateNewBoqItem({ ...ok, contractQty: '0' }).contractQty).toBe('Contract Qty must be more than 0.');
    expect(validateNewBoqItem({ ...ok, contractQty: '-3' }).contractQty).toBe('Contract Qty must be more than 0.');
    expect(validateNewBoqItem({ ...ok, unitPrice: '-1' }).unitPrice).toBe('Unit price must be 0 or more.');
    expect(validateNewBoqItem({ ...ok, unitPrice: '0' })).toEqual({});
  });
  it('only offers the New Contract Register units, in the same order', () => {
    expect(REGISTER_UNIT_OPTIONS).toEqual(['m²', 'm³', 'nos', 'lm']);
    expect(validateNewBoqItem({ ...ok, unit: 'ton' }).unit).toBe('Please select unit.');
  });
});

describe('newBoqItemTotal', () => {
  it('is Contract Qty × Unit Price to 3 decimals, and 0 until both are valid', () => {
    expect(newBoqItemTotal('500', '12.5')).toBe(6250);
    expect(newBoqItemTotal('1.333', '3')).toBe(3.999);
    expect(newBoqItemTotal('', '5')).toBe(0);
    expect(newBoqItemTotal('5', 'abc')).toBe(0);
  });
});

describe('who sees + Add BOQ Item', () => {
  it('needs contracts.update; view-only users do not get it', () => {
    expect(canAddBoqItems(['contracts.read', 'contracts.update'], 'ACTIVE')).toBe(true);
    expect(canAddBoqItems(['contracts.read'], 'ACTIVE')).toBe(false);
    expect(canAddBoqItems(['contracts.read', 'contracts.workflow_update'], 'ACTIVE')).toBe(false);
  });
  it('works for Draft and Active contracts, not for closed, cancelled or terminated ones', () => {
    for (const s of ['DRAFT', 'ACTIVE']) expect(canAddBoqItems(['contracts.update'], s)).toBe(true);
    for (const s of ['CLOSED', 'CANCELLED', 'TERMINATED']) expect(canAddBoqItems(['contracts.update'], s)).toBe(false);
  });
});

describe('BOQ total vs contract value', () => {
  it('reports when the BOQ total differs from the (unchanged) contract value', () => {
    expect(boqTotalNote([{ totalPrice: '1000.000' }, { totalPrice: '250.500' }], '1000.000')).toEqual({ boqTotal: 1250.5, contractValue: 1000, differs: true });
  });
  it('says nothing is different when they match, and handles missing data', () => {
    expect(boqTotalNote([{ totalPrice: '1000' }], '1000.000')?.differs).toBe(false);
    expect(boqTotalNote([], '1000')).toBeNull();
    expect(boqTotalNote([{}], '1000')).toBeNull();
    expect(boqTotalNote([{ totalPrice: '10' }], undefined)).toEqual({ boqTotal: 10, contractValue: null, differs: false });
  });
});

describe('Elements Not Confirmed', () => {
  it('shows for an item with nothing confirmed or generated', () => {
    expect(elementsNotConfirmed({ confirmedPieces: null, piecesGenerated: 0, confirmations: [] })).toBe(true);
    expect(elementsNotConfirmed({ confirmedPieces: null, piecesGenerated: 0, confirmations: [{ confirmationStatus: 'DRAFT' }] })).toBe(true);
  });
  it('goes away once Technical confirms elements or elements exist', () => {
    expect(elementsNotConfirmed({ confirmedPieces: 5, piecesGenerated: 0, confirmations: [{ confirmationStatus: 'CONFIRMED' }] })).toBe(false);
    expect(elementsNotConfirmed({ confirmedPieces: 5, piecesGenerated: 5, confirmations: [] })).toBe(false);
  });
});

describe('wording', () => {
  it('uses the approved messages', () => {
    expect(ADD_BOQ_ITEM_TEXT.button).toBe('+ Add BOQ Item');
    expect(ADD_BOQ_ITEM_TEXT.success).toBe('BOQ item added successfully. Technical can now review and confirm its elements.');
    expect(ADD_BOQ_ITEM_TEXT.elementsNotConfirmed).toBe('Elements Not Confirmed');
  });
  it('reports partial success with the failed files', () => {
    expect(filesFailedText(['a.pdf: too large.'])).toBe('The BOQ item was saved, but some files could not be uploaded. a.pdf: too large.');
  });
});
