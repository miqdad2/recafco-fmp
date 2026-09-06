import { describe, it, expect } from 'vitest';
import {
  RISK_LEVEL_LABELS,
  RISK_RESPONSE_LABELS,
  RISK_STATUS_LABELS,
  RISK_LEVEL_FILTER_OPTIONS,
  RISK_RESPONSE_FILTER_OPTIONS,
  RISK_STATUS_FILTER_OPTIONS,
  RISK_LEVEL_OPTIONS,
  RISK_RESPONSE_OPTIONS,
  RISK_STATUS_OPTIONS,
  formatDaysToDeadline,
} from './contract-risk-helpers';

describe('RISK_LEVEL_LABELS', () => {
  it('maps every real level to its manager-facing label', () => {
    expect(RISK_LEVEL_LABELS.LOW).toBe('Low');
    expect(RISK_LEVEL_LABELS.MEDIUM).toBe('Medium');
    expect(RISK_LEVEL_LABELS.HIGH).toBe('High');
    expect(RISK_LEVEL_LABELS.CRITICAL).toBe('Critical');
  });
});

describe('RISK_RESPONSE_LABELS', () => {
  it('has exactly the 4 manager-clarified response types, never Subcontracting/Insurance', () => {
    expect(Object.keys(RISK_RESPONSE_LABELS)).toEqual(['MITIGATE', 'ACCEPT', 'AVOID', 'TRANSFER']);
    for (const label of Object.values(RISK_RESPONSE_LABELS)) {
      expect(label).not.toMatch(/subcontract|insurance/i);
    }
  });
});

describe('RISK_STATUS_LABELS', () => {
  it('maps every real status to its manager-facing label', () => {
    expect(RISK_STATUS_LABELS.OPEN).toBe('Open');
    expect(RISK_STATUS_LABELS.IN_PROGRESS).toBe('In Progress');
    expect(RISK_STATUS_LABELS.MITIGATED).toBe('Mitigated');
    expect(RISK_STATUS_LABELS.CLOSED).toBe('Closed');
    expect(RISK_STATUS_LABELS.CANCELLED).toBe('Cancelled');
  });
});

describe('RISK_LEVEL_OPTIONS / RISK_RESPONSE_OPTIONS / RISK_STATUS_OPTIONS', () => {
  it('have exactly the real enum values, no "All" entry', () => {
    expect(RISK_LEVEL_OPTIONS).toHaveLength(4);
    expect(RISK_RESPONSE_OPTIONS).toHaveLength(4);
    expect(RISK_STATUS_OPTIONS).toHaveLength(5);
  });
});

describe('filter option lists', () => {
  it('include an "All"/"All Status" option plus every real value', () => {
    expect(RISK_LEVEL_FILTER_OPTIONS[0]).toEqual({ value: '', label: 'All' });
    expect(RISK_LEVEL_FILTER_OPTIONS).toHaveLength(5);
    expect(RISK_RESPONSE_FILTER_OPTIONS[0]).toEqual({ value: '', label: 'All' });
    expect(RISK_RESPONSE_FILTER_OPTIONS).toHaveLength(5);
    expect(RISK_STATUS_FILTER_OPTIONS[0]).toEqual({ value: '', label: 'All Status' });
    expect(RISK_STATUS_FILTER_OPTIONS).toHaveLength(6);
  });
});

describe('formatDaysToDeadline', () => {
  it('shows a negative number honestly for an overdue deadline', () => {
    expect(formatDaysToDeadline(-3)).toBe('-3');
  });

  it('shows a positive number for a not-yet-due deadline', () => {
    expect(formatDaysToDeadline(7)).toBe('7');
  });

  it('shows 0 on the due date itself', () => {
    expect(formatDaysToDeadline(0)).toBe('0');
  });

  it('shows "—" when there is no due date at all (never a fabricated number)', () => {
    expect(formatDaysToDeadline(undefined)).toBe('—');
  });
});
