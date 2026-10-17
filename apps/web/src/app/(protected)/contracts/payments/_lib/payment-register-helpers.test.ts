import { describe, it, expect } from 'vitest';
import {
  deriveQuickView,
  deriveWorkflowStatus,
  quickViewToParams,
  hasAdvancedFilters,
  formatShowingRange,
  overdueLabel,
  isUnpaid,
} from './payment-register-helpers';

describe('payment register helpers', () => {
  it('derives the quick view from existing params', () => {
    expect(deriveQuickView(undefined, false)).toBe('all');
    expect(deriveQuickView(undefined, true)).toBe('overdue');
    expect(deriveQuickView('PAID', false)).toBe('paid');
    expect(deriveQuickView('PARTIALLY_PAID', false)).toBe('partial');
    expect(deriveQuickView('SUBMITTED', false)).toBe('all');
  });

  it('round-trips quick views to params', () => {
    expect(quickViewToParams('all')).toEqual({});
    expect(quickViewToParams('paid')).toEqual({ status: 'PAID' });
    expect(quickViewToParams('partial')).toEqual({ status: 'PARTIALLY_PAID' });
    expect(quickViewToParams('overdue')).toEqual({ overdueOnly: 'true' });
  });

  it('keeps workflow statuses out of the quick views', () => {
    expect(deriveWorkflowStatus('PAID')).toBe('');
    expect(deriveWorkflowStatus('CERTIFIED')).toBe('CERTIFIED');
    expect(deriveWorkflowStatus(undefined)).toBe('');
  });

  it('detects active advanced filters', () => {
    expect(hasAdvancedFilters({}, '')).toBe(false);
    expect(hasAdvancedFilters({ company: 'ACME' }, '')).toBe(true);
    expect(hasAdvancedFilters({}, 'CANCELLED')).toBe(true);
  });

  it('formats the showing range from real totals', () => {
    expect(formatShowingRange(1, 25, 25, 250)).toBe('Showing 1–25 of 250 payments');
    expect(formatShowingRange(3, 25, 10, 60)).toBe('Showing 51–60 of 60 payments');
    expect(formatShowingRange(1, 25, 1, 1)).toBe('Showing 1–1 of 1 payment');
    expect(formatShowingRange(1, 25, 0, 0)).toBe('Showing 0 of 0 payments');
  });

  it('only labels overdue when the API reports overdue days', () => {
    expect(overdueLabel(null)).toBeNull();
    expect(overdueLabel(0)).toBeNull();
    expect(overdueLabel(1)).toBe('Overdue 1 day');
    expect(overdueLabel(12)).toBe('Overdue 12 days');
  });

  it('marks unpaid only when a balance is owed and nothing is paid', () => {
    expect(isUnpaid({ status: 'SUBMITTED', paidAmount: '0.000', outstandingAmount: '100.000' })).toBe(true);
    expect(isUnpaid({ status: 'CERTIFIED', outstandingAmount: '100.000' })).toBe(true);
    expect(isUnpaid({ status: 'PARTIALLY_PAID', paidAmount: '10', outstandingAmount: '90.000' })).toBe(false);
    expect(isUnpaid({ status: 'SUBMITTED', paidAmount: '10', outstandingAmount: '90.000' })).toBe(false);
    expect(isUnpaid({ status: 'PAID', outstandingAmount: '0.000' })).toBe(false);
    expect(isUnpaid({ status: 'CANCELLED', outstandingAmount: '50.000' })).toBe(false);
    expect(isUnpaid({ status: 'SUBMITTED', outstandingAmount: null })).toBe(false);
  });
});
