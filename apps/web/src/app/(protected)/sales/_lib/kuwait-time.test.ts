import { describe, it, expect } from 'vitest';
import { kuwaitDateOf, kuwaitMonthOf, msUntilNextKuwaitMidnight } from './kuwait-time';

const at = (iso: string): number => new Date(iso).getTime();

describe('Kuwait date and month (UTC+3, no daylight saving)', () => {
  it('moves to the next day at 21:00 UTC', () => {
    expect(kuwaitDateOf(at('2026-10-24T20:59:59.999Z'))).toBe('2026-10-24');
    expect(kuwaitDateOf(at('2026-10-24T21:00:00.000Z'))).toBe('2026-10-25');
  });

  it('rolls December into January of the next year', () => {
    expect(kuwaitMonthOf(at('2026-12-31T20:59:59Z'))).toBe('2026-12');
    expect(kuwaitMonthOf(at('2026-12-31T21:00:00Z'))).toBe('2027-01');
    expect(kuwaitDateOf(at('2026-12-31T21:00:00Z'))).toBe('2027-01-01');
  });

  it('handles month ends, leap day and the first moments of a month', () => {
    expect(kuwaitMonthOf(at('2028-02-29T10:00:00Z'))).toBe('2028-02');
    expect(kuwaitMonthOf(at('2028-02-29T21:00:00Z'))).toBe('2028-03');
    expect(kuwaitMonthOf(at('2027-01-31T21:00:00Z'))).toBe('2027-02');
    expect(kuwaitMonthOf(at('2026-09-30T20:00:00Z'))).toBe('2026-09');
  });

  it('does not depend on the machine time zone (pure arithmetic on the instant)', () => {
    expect(kuwaitDateOf(at('2026-03-01T00:30:00+03:00'))).toBe('2026-03-01');
    expect(kuwaitDateOf(at('2026-02-28T23:30:00+03:00'))).toBe('2026-02-28');
  });

  it('counts the time to the next Kuwait midnight', () => {
    expect(msUntilNextKuwaitMidnight(at('2026-12-31T20:59:00Z'))).toBe(60_000);
    expect(msUntilNextKuwaitMidnight(at('2026-12-31T21:00:00Z'))).toBe(86_400_000);
    expect(msUntilNextKuwaitMidnight(at('2026-10-24T09:00:00Z'))).toBe(12 * 3_600_000);
  });
});
