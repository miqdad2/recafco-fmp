import { describe, it, expect } from 'vitest';
import { UnprocessableEntityException } from '@nestjs/common';
import { normalizePaymentTermDetails, legacyMissingPercentageKeys } from './payment-terms';

const message = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(UnprocessableEntityException);
    return (e as UnprocessableEntityException).getResponse() instanceof Object
      ? ((e as UnprocessableEntityException).getResponse() as { message: string }).message
      : '';
  }
  return '';
};

describe('normalizePaymentTermDetails (FMP-CONTRACT-06)', () => {
  it('saves Advance 10%, Retention 5% and Performance Bond 10%', () => {
    const out = normalizePaymentTermDetails(
      { advance: true, retention: true, performanceBond: true },
      { advance: { percentage: 10 }, retention: { percentage: '5' }, performanceBond: { percentage: 10 } },
    );
    expect(out).toEqual({ advance: { percentage: 10 }, retention: { percentage: 5 }, performanceBond: { percentage: 10 } });
  });

  it('allows decimals and the 0 / 100 boundaries', () => {
    expect(normalizePaymentTermDetails({ advance: true, retention: true }, { advance: { percentage: 2.5 }, retention: { percentage: 100 } })).toEqual({
      advance: { percentage: 2.5 },
      retention: { percentage: 100 },
    });
    expect(normalizePaymentTermDetails({ advance: true }, { advance: { percentage: 0 } })).toEqual({ advance: { percentage: 0 } });
  });

  it('rejects a selected Advance / Retention / Performance Bond without a percentage', () => {
    expect(message(() => normalizePaymentTermDetails({ advance: true }, {}))).toBe('Advance % is required.');
    expect(message(() => normalizePaymentTermDetails({ retention: true }, undefined))).toBe('Retention % is required.');
    expect(message(() => normalizePaymentTermDetails({ performanceBond: true }, { performanceBond: { percentage: '' } }))).toBe(
      'Performance Bond % is required.',
    );
  });

  it('rejects percentages above 100, negative and non-numeric', () => {
    expect(message(() => normalizePaymentTermDetails({ advance: true }, { advance: { percentage: 100.5 } }))).toBe('Advance % must be between 0 and 100.');
    expect(message(() => normalizePaymentTermDetails({ retention: true }, { retention: { percentage: -1 } }))).toBe('Retention % must be between 0 and 100.');
    expect(message(() => normalizePaymentTermDetails({ advance: true }, { advance: { percentage: 'abc' } }))).toBe('Advance % must be between 0 and 100.');
  });

  it('Insurance % is optional but validated when given', () => {
    expect(normalizePaymentTermDetails({ insurance: true }, {})).toEqual({ insurance: { percentage: null } });
    expect(normalizePaymentTermDetails({ insurance: true }, { insurance: { percentage: 3 } })).toEqual({ insurance: { percentage: 3 } });
    expect(message(() => normalizePaymentTermDetails({ insurance: true }, { insurance: { percentage: 101 } }))).toBe('Insurance % must be between 0 and 100.');
  });

  it('Interim Payment type/notes are optional; invalid type rejected', () => {
    expect(normalizePaymentTermDetails({ interimPayment: true }, {})).toEqual({ interimPayment: { type: null, notes: null } });
    expect(
      normalizePaymentTermDetails({ interimPayment: true }, { interimPayment: { type: 'PROGRESS_BASED', notes: ' monthly cert ' } }),
    ).toEqual({ interimPayment: { type: 'PROGRESS_BASED', notes: 'monthly cert' } });
    expect(message(() => normalizePaymentTermDetails({ interimPayment: true }, { interimPayment: { type: 'WEEKLY' } }))).toBe('Interim Payment type is invalid.');
  });

  it('Tax Clearance status is required when selected', () => {
    expect(message(() => normalizePaymentTermDetails({ taxClearance: true }, {}))).toBe('Tax Clearance status is required.');
    expect(normalizePaymentTermDetails({ taxClearance: true }, { taxClearance: { status: 'REQUIRED' } })).toEqual({
      taxClearance: { status: 'REQUIRED', notes: null },
    });
    expect(message(() => normalizePaymentTermDetails({ taxClearance: true }, { taxClearance: { status: 'MAYBE' } }))).toBe('Tax Clearance status is invalid.');
  });

  it('drops details for terms that are not selected', () => {
    expect(
      normalizePaymentTermDetails({ advance: false, retention: true }, { advance: { percentage: 10 }, retention: { percentage: 5 }, taxClearance: { status: 'REQUIRED' } }),
    ).toEqual({ retention: { percentage: 5 } });
    expect(normalizePaymentTermDetails({}, { advance: { percentage: 10 } })).toEqual({});
  });

  it('boolean-only legacy contracts: a legacy-missing percentage stays allowed, other terms are still enforced', () => {
    const legacy = legacyMissingPercentageKeys({ advance: true, retention: true }, { retention: { percentage: 5 } });
    expect([...legacy]).toEqual(['advance']);
    expect(normalizePaymentTermDetails({ advance: true, retention: true }, { retention: { percentage: 5 } }, legacy)).toEqual({
      retention: { percentage: 5 },
    });
    // A newly selected term is not legacy and must still carry a percentage.
    expect(message(() => normalizePaymentTermDetails({ advance: true, performanceBond: true }, {}, legacy))).toBe('Performance Bond % is required.');
    expect([...legacyMissingPercentageKeys({ advance: true }, null)]).toEqual(['advance']);
    expect([...legacyMissingPercentageKeys(null, null)]).toEqual([]);
  });
});
