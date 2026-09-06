import { describe, it, expect } from 'vitest';
import { formatScheduleDate, formatDelayDays, delayDaysClassName } from './contract-schedule-detail-helpers';

describe('formatScheduleDate', () => {
  it('returns "—" for null', () => {
    expect(formatScheduleDate(null)).toBe('—');
  });

  it('formats a real ISO date as en-GB day/month/year', () => {
    expect(formatScheduleDate('2026-03-05')).toBe('05 Mar 2026');
  });
});

describe('formatDelayDays', () => {
  it('returns "—" for null (nothing real to show)', () => {
    expect(formatDelayDays(null)).toBe('—');
  });

  it('returns "On time" for exactly 0', () => {
    expect(formatDelayDays(0)).toBe('On time');
  });

  it('formats a positive (late) delay with a plus sign', () => {
    expect(formatDelayDays(5)).toBe('+5d');
  });

  it('formats a negative (early) delay as-is', () => {
    expect(formatDelayDays(-3)).toBe('-3d');
  });
});

describe('delayDaysClassName', () => {
  it('is muted for null', () => {
    expect(delayDaysClassName(null)).toBe('text-text-muted');
  });

  it('is error-colored when late', () => {
    expect(delayDaysClassName(4)).toBe('text-error');
  });

  it('is success-colored when early', () => {
    expect(delayDaysClassName(-4)).toBe('text-success');
  });

  it('is neutral secondary when exactly on time', () => {
    expect(delayDaysClassName(0)).toBe('text-text-secondary');
  });
});
