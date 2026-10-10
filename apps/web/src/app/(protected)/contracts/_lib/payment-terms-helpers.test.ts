import { describe, it, expect } from 'vitest';
import {
  emptyPaymentTermsState,
  paymentTermsStateFrom,
  validatePaymentTermsState,
  toPaymentTermsPayload,
  readPaymentTermsState,
  legacyMissingKeys,
  paymentTermDetailText,
  anyPaymentTermSelected,
} from './payment-terms-helpers';

function withState(patch: Partial<ReturnType<typeof emptyPaymentTermsState>>): ReturnType<typeof emptyPaymentTermsState> {
  return { ...emptyPaymentTermsState(), ...patch };
}

describe('payment terms helpers (FMP-CONTRACT-06)', () => {
  it('no terms selected → nothing to validate, nothing selected', () => {
    expect(validatePaymentTermsState(emptyPaymentTermsState())).toEqual([]);
    expect(anyPaymentTermSelected(emptyPaymentTermsState())).toBe(false);
  });

  it('Advance % is required when Advance is selected', () => {
    expect(validatePaymentTermsState(withState({ enabled: { advance: true } }))).toEqual(['Advance % is required.']);
  });

  it('Retention % and Performance Bond % are validated between 0 and 100 (decimals allowed)', () => {
    const base = { enabled: { retention: true, performanceBond: true } };
    expect(validatePaymentTermsState(withState({ ...base, percentage: { retention: '2.5', performanceBond: '100' } }))).toEqual([]);
    expect(validatePaymentTermsState(withState({ ...base, percentage: { retention: '101', performanceBond: '-1' } }))).toEqual([
      'Retention % must be between 0 and 100.',
      'Performance Bond % must be between 0 and 100.',
    ]);
    expect(validatePaymentTermsState(withState({ ...base, percentage: { retention: '', performanceBond: 'abc' } }))).toEqual([
      'Retention % is required.',
      'Performance Bond % must be between 0 and 100.',
    ]);
  });

  it('Insurance % is optional; Tax Clearance status is required when selected', () => {
    expect(validatePaymentTermsState(withState({ enabled: { insurance: true } }))).toEqual([]);
    expect(validatePaymentTermsState(withState({ enabled: { insurance: true }, percentage: { insurance: '200' } }))).toEqual([
      'Insurance % must be between 0 and 100.',
    ]);
    expect(validatePaymentTermsState(withState({ enabled: { taxClearance: true } }))).toEqual(['Tax Clearance status is required.']);
    expect(validatePaymentTermsState(withState({ enabled: { taxClearance: true }, taxStatus: 'REQUIRED' }))).toEqual([]);
  });

  it('unselected terms are never validated (their leftover values are ignored)', () => {
    expect(validatePaymentTermsState(withState({ enabled: { advance: false }, percentage: { advance: '999' } }))).toEqual([]);
  });

  it('legacy contracts: a selected term with no stored percentage may stay unset', () => {
    const legacy = legacyMissingKeys({ advance: true, retention: true }, { retention: { percentage: 5 } });
    expect(legacy).toEqual(['advance']);
    const state = paymentTermsStateFrom({ advance: true, retention: true }, { retention: { percentage: 5 } });
    expect(validatePaymentTermsState(state, legacy)).toEqual([]);
    expect(validatePaymentTermsState(state, [])).toEqual(['Advance % is required.']);
  });

  it('payload sends booleans for every option and details only for selected terms', () => {
    const state = withState({
      enabled: { advance: true, retention: true, interimPayment: true, taxClearance: true, insurance: false },
      percentage: { advance: '10', retention: '5', insurance: '9' },
      interimType: 'PROGRESS_BASED',
      taxStatus: 'REQUIRED',
      taxNotes: ' certificate ',
    });
    const { paymentTerms, paymentTermDetails } = toPaymentTermsPayload(state);
    expect(paymentTerms).toEqual({
      advance: true, retention: true, performanceBond: false, insurance: false, interimPayment: true, taxClearance: true,
    });
    expect(paymentTermDetails).toEqual({
      advance: { percentage: 10 },
      retention: { percentage: 5 },
      interimPayment: { type: 'PROGRESS_BASED', notes: null },
      taxClearance: { status: 'REQUIRED', notes: 'certificate' },
    });
  });

  it('prefills editor state from saved terms and details', () => {
    const state = paymentTermsStateFrom(
      { advance: true, taxClearance: true },
      { advance: { percentage: 10 }, taxClearance: { status: 'TO_BE_CONFIRMED', notes: 'pending' } },
    );
    expect(state.enabled['advance']).toBe(true);
    expect(state.enabled['retention']).toBe(false);
    expect(state.percentage['advance']).toBe('10');
    expect(state.taxStatus).toBe('TO_BE_CONFIRMED');
    expect(state.taxNotes).toBe('pending');
  });

  it('reads the submitted form fields back into state', () => {
    const fd = new FormData();
    fd.set('paymentTerm_advance', 'on');
    fd.set('paymentTermPct_advance', '12.5');
    fd.set('paymentTerm_interimPayment', 'on');
    fd.set('paymentTermType_interimPayment', 'MONTHLY');
    const state = readPaymentTermsState(fd);
    expect(state.enabled['advance']).toBe(true);
    expect(state.enabled['retention']).toBe(false);
    expect(state.percentage['advance']).toBe('12.5');
    expect(state.interimType).toBe('MONTHLY');
    expect(toPaymentTermsPayload(state).paymentTermDetails).toEqual({
      advance: { percentage: 12.5 },
      interimPayment: { type: 'MONTHLY', notes: null },
    });
  });

  it('Overview display text: values, "Percentage not set" for old contracts, nothing for unselected terms', () => {
    const terms = { advance: true, retention: true, interimPayment: true, taxClearance: true };
    const details = {
      advance: { percentage: 10 },
      interimPayment: { type: 'PROGRESS_BASED', notes: null },
      taxClearance: { status: 'REQUIRED', notes: null },
    };
    expect(paymentTermDetailText('advance', terms, details)).toBe('10%');
    expect(paymentTermDetailText('retention', terms, details)).toBe('Not specified');
    expect(paymentTermDetailText('interimPayment', terms, details)).toBe('Progress Based');
    expect(paymentTermDetailText('taxClearance', terms, details)).toBe('Required');
    expect(paymentTermDetailText('performanceBond', terms, details)).toBeNull();
    expect(paymentTermDetailText('advance', { advance: true }, undefined)).toBe('Not specified');
    expect(paymentTermDetailText('insurance', { insurance: true }, undefined)).toBe('Not specified');
  });
});
