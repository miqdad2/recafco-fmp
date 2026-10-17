import { describe, it, expect } from 'vitest';
import {
  deriveQuickView, deriveOtherStatus, quickViewToParams, hasAdvancedFilters, formatShowingRange,
} from './closeout-register-helpers';

describe('closeout register helpers', () => {
  it('derives the quick view from existing params', () => {
    expect(deriveQuickView(undefined, false)).toBe('all');
    expect(deriveQuickView(undefined, true)).toBe('pending');
    expect(deriveQuickView('APPROVED', false)).toBe('approved');
    expect(deriveQuickView('REJECTED', false)).toBe('rejected');
    expect(deriveQuickView('CLOSED', false)).toBe('closed');
    expect(deriveQuickView('UNDER_REVIEW', false)).toBe('all');
    expect(deriveQuickView('APPROVED', true)).toBe('all');
  });

  it('keeps Approved and Closed as distinct statuses', () => {
    expect(quickViewToParams('approved')).toEqual({ status: 'APPROVED' });
    expect(quickViewToParams('closed')).toEqual({ status: 'CLOSED' });
  });

  it('maps the other quick views to existing params', () => {
    expect(quickViewToParams('all')).toEqual({});
    expect(quickViewToParams('pending')).toEqual({ pendingOnly: 'true' });
    expect(quickViewToParams('rejected')).toEqual({ status: 'REJECTED' });
  });

  it('keeps non-quick statuses under Advanced', () => {
    expect(deriveOtherStatus('SUBMITTED')).toBe('SUBMITTED');
    expect(deriveOtherStatus('UNDER_REVIEW')).toBe('UNDER_REVIEW');
    expect(deriveOtherStatus('APPROVED')).toBe('');
    expect(deriveOtherStatus(undefined)).toBe('');
  });

  it('detects active advanced filters', () => {
    expect(hasAdvancedFilters({}, '')).toBe(false);
    expect(hasAdvancedFilters({ approvedDateFrom: '2026-01-01' }, '')).toBe(true);
    expect(hasAdvancedFilters({}, 'DRAFT')).toBe(true);
  });

  it('formats the showing range', () => {
    expect(formatShowingRange(1, 25, 25, 250)).toBe('Showing 1–25 of 250 requests');
    expect(formatShowingRange(1, 25, 1, 1)).toBe('Showing 1–1 of 1 request');
    expect(formatShowingRange(1, 25, 0, 0)).toBe('Showing 0 of 0 requests');
  });
});
