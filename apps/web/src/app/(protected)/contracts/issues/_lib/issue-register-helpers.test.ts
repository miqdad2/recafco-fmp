import { describe, it, expect } from 'vitest';
import {
  deriveQuickView, deriveOtherStatus, quickViewToParams, hasAdvancedFilters, formatShowingRange, overdueLabel,
} from './issue-register-helpers';

describe('issue register helpers', () => {
  it('derives the quick view from existing params', () => {
    expect(deriveQuickView(undefined, false)).toBe('all');
    expect(deriveQuickView(undefined, true)).toBe('overdue');
    expect(deriveQuickView('OPEN', false)).toBe('open');
    expect(deriveQuickView('IN_PROGRESS', false)).toBe('inProgress');
    expect(deriveQuickView('RESOLVED', false)).toBe('resolved');
    expect(deriveQuickView('CLOSED', false)).toBe('closed');
    expect(deriveQuickView('WAITING_RESPONSE', false)).toBe('all');
    expect(deriveQuickView('OPEN', true)).toBe('all');
  });

  it('round-trips quick views to params', () => {
    expect(quickViewToParams('all')).toEqual({});
    expect(quickViewToParams('open')).toEqual({ status: 'OPEN' });
    expect(quickViewToParams('inProgress')).toEqual({ status: 'IN_PROGRESS' });
    expect(quickViewToParams('overdue')).toEqual({ overdueOnly: 'true' });
    expect(quickViewToParams('closed')).toEqual({ status: 'CLOSED' });
  });

  it('keeps non-quick statuses under Advanced', () => {
    expect(deriveOtherStatus('CANCELLED')).toBe('CANCELLED');
    expect(deriveOtherStatus('OPEN')).toBe('');
  });

  it('detects active advanced filters', () => {
    expect(hasAdvancedFilters({}, '')).toBe(false);
    expect(hasAdvancedFilters({ priority: 'HIGH' }, '')).toBe(true);
    expect(hasAdvancedFilters({}, 'CANCELLED')).toBe(true);
  });

  it('formats the showing range', () => {
    expect(formatShowingRange(1, 25, 25, 250)).toBe('Showing 1–25 of 250 issues');
    expect(formatShowingRange(2, 25, 3, 28)).toBe('Showing 26–28 of 28 issues');
    expect(formatShowingRange(1, 25, 1, 1)).toBe('Showing 1–1 of 1 issue');
    expect(formatShowingRange(1, 25, 0, 0)).toBe('Showing 0 of 0 issues');
  });

  it('labels overdue only from reported days', () => {
    expect(overdueLabel(null)).toBeNull();
    expect(overdueLabel(0)).toBeNull();
    expect(overdueLabel(1)).toBe('Overdue by 1 day');
    expect(overdueLabel(9)).toBe('Overdue by 9 days');
  });
});
