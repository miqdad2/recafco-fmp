import { describe, it, expect } from 'vitest';
import {
  deriveQuickView, deriveOtherStatus, quickViewToParams, hasAdvancedFilters, formatShowingRange,
  overdueLabel, formatDays, claimAmountCell,
} from './claim-register-helpers';

describe('claim register helpers', () => {
  it('derives the quick view from existing params', () => {
    expect(deriveQuickView(undefined, false)).toBe('all');
    expect(deriveQuickView(undefined, true)).toBe('overdue');
    expect(deriveQuickView('UNDER_REVIEW', false)).toBe('underReview');
    expect(deriveQuickView('APPROVED', false)).toBe('approved');
    expect(deriveQuickView('CLOSED', false)).toBe('closed');
    expect(deriveQuickView('SETTLED', false)).toBe('all');
    expect(deriveQuickView('APPROVED', true)).toBe('all');
  });

  it('round-trips quick views to params', () => {
    expect(quickViewToParams('all')).toEqual({});
    expect(quickViewToParams('underReview')).toEqual({ status: 'UNDER_REVIEW' });
    expect(quickViewToParams('approved')).toEqual({ status: 'APPROVED' });
    expect(quickViewToParams('overdue')).toEqual({ overdueOnly: 'true' });
    expect(quickViewToParams('closed')).toEqual({ status: 'CLOSED' });
  });

  it('keeps non-quick statuses under Advanced', () => {
    expect(deriveOtherStatus('SETTLED')).toBe('SETTLED');
    expect(deriveOtherStatus('REJECTED')).toBe('REJECTED');
    expect(deriveOtherStatus('APPROVED')).toBe('');
    expect(deriveOtherStatus(undefined)).toBe('');
  });

  it('detects active advanced filters', () => {
    expect(hasAdvancedFilters({}, '')).toBe(false);
    expect(hasAdvancedFilters({ claimType: 'DELAY' }, '')).toBe(true);
    expect(hasAdvancedFilters({}, 'SETTLED')).toBe(true);
  });

  it('formats the showing range', () => {
    expect(formatShowingRange(1, 25, 25, 250)).toBe('Showing 1–25 of 250 claims');
    expect(formatShowingRange(1, 25, 1, 1)).toBe('Showing 1–1 of 1 claim');
    expect(formatShowingRange(1, 25, 0, 0)).toBe('Showing 0 of 0 claims');
  });

  it('labels overdue only from reported days', () => {
    expect(overdueLabel(null)).toBeNull();
    expect(overdueLabel(0)).toBeNull();
    expect(overdueLabel(1)).toBe('Overdue by 1 day');
    expect(overdueLabel(5)).toBe('Overdue by 5 days');
  });

  it('formats day counts', () => {
    expect(formatDays(undefined)).toBe('—');
    expect(formatDays(0)).toBe('0 days');
    expect(formatDays(1)).toBe('1 day');
    expect(formatDays(2)).toBe('2 days');
  });

  it('shows days for EOT claims and money for the rest, never mixed', () => {
    expect(claimAmountCell({ claimType: 'EXTENSION_OF_TIME', eotClaimedDays: 2, eotApprovedDays: 0, submittedValue: '600.000' }))
      .toEqual({ kind: 'days', claimed: '2', approved: '0' });
    expect(claimAmountCell({ claimType: 'PAYMENT', submittedValue: '600.000', approvedValue: '400.000' }))
      .toEqual({ kind: 'money', claimed: '600.000', approved: '400.000' });
    expect(claimAmountCell({ claimType: 'DELAY', submittedValue: '10.000', eotClaimedDays: 3 }))
      .toEqual({ kind: 'money', claimed: '10.000', approved: undefined, extraDaysClaimed: 3 });
    expect(claimAmountCell({ claimType: 'EXTENSION_OF_TIME' })).toEqual({ kind: 'days', claimed: undefined, approved: undefined });
  });
});
