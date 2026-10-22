import { describe, it, expect } from 'vitest';
import { SalesEnquiryStatus } from '@recafco/database';
import {
  kuwaitToday, dateOnly, dateKey, monthOf, monthRange, lastMonths, followUpBucket, cohortConversionRate, normalizeMoney,
  statusChangeError, isOpenStatus, formatEnquiryNumber, isValidDateString, isValidMonth,
} from './sales.logic';

describe('Kuwait dates', () => {
  it('uses UTC+3: 22:00 UTC is already tomorrow in Kuwait', () => {
    expect(kuwaitToday(new Date('2026-03-31T22:00:00Z'))).toBe('2026-04-01');
    expect(kuwaitToday(new Date('2026-03-31T20:59:59Z'))).toBe('2026-03-31');
  });

  it('round-trips a calendar date', () => {
    expect(dateKey(dateOnly('2026-10-05'))).toBe('2026-10-05');
    expect(dateKey(null)).toBeNull();
  });

  it('validates real dates only', () => {
    expect(isValidDateString('2026-02-28')).toBe(true);
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('26-02-28')).toBe(false);
    expect(isValidMonth('2026-13')).toBe(false);
    expect(isValidMonth('2026-12')).toBe(true);
  });

  it('month helpers', () => {
    expect(monthOf('2026-10-21')).toBe('2026-10');
    const r = monthRange('2026-12');
    expect(dateKey(r.start)).toBe('2026-12-01');
    expect(dateKey(r.endExclusive)).toBe('2027-01-01');
    expect(lastMonths('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('follow-up buckets (compared with today in Kuwait)', () => {
  const today = '2026-10-21';
  it('overdue, today, upcoming', () => {
    expect(followUpBucket('PENDING', '2026-10-20', today)).toBe('OVERDUE');
    expect(followUpBucket('PENDING', '2026-10-21', today)).toBe('TODAY');
    expect(followUpBucket('PENDING', '2026-10-22', today)).toBe('UPCOMING');
  });
  it('completed and cancelled are never due, even when the date has passed', () => {
    expect(followUpBucket('COMPLETED', '2026-01-01', today)).toBe('COMPLETED');
    expect(followUpBucket('CANCELLED', '2026-01-01', today)).toBe('CANCELLED');
  });
});

describe('cohort conversion rate', () => {
  it('is won / created x 100 with one decimal', () => {
    expect(cohortConversionRate(8, 2)).toBe(25);
    expect(cohortConversionRate(3, 1)).toBe(33.3);
    expect(cohortConversionRate(1, 1)).toBe(100);
    expect(cohortConversionRate(5, 0)).toBe(0);
  });
  it('is N/A (null), not a division by zero, when nothing was created', () => {
    expect(cohortConversionRate(0, 0)).toBeNull();
  });
});

describe('money', () => {
  it('keeps blank as null (never 0) and accepts KWD fils', () => {
    expect(normalizeMoney('')).toBeNull();
    expect(normalizeMoney('   ')).toBeNull();
    expect(normalizeMoney(null)).toBeNull();
    expect(normalizeMoney(undefined)).toBeNull();
    expect(normalizeMoney('1234.567')).toBe('1234.567');
    expect(normalizeMoney(0)).toBe('0');
    expect(normalizeMoney(15000)).toBe('15000');
  });
  it('rejects negatives, 4 decimals and text', () => {
    expect(normalizeMoney('-5')).toBe('INVALID');
    expect(normalizeMoney('1.2345')).toBe('INVALID');
    expect(normalizeMoney('abc')).toBe('INVALID');
    expect(normalizeMoney(Number.NaN)).toBe('INVALID');
  });
});

describe('status rules', () => {
  it('Lost needs a reason', () => {
    expect(statusChangeError(SalesEnquiryStatus.LOST, undefined)).not.toBeNull();
    expect(statusChangeError(SalesEnquiryStatus.LOST, '   ')).not.toBeNull();
    expect(statusChangeError(SalesEnquiryStatus.LOST, 'Went with another supplier')).toBeNull();
    expect(statusChangeError(SalesEnquiryStatus.WON, undefined)).toBeNull();
    expect(statusChangeError(SalesEnquiryStatus.CONTACTED, undefined)).toBeNull();
  });
  it('Won and Lost are closed', () => {
    expect(isOpenStatus(SalesEnquiryStatus.WON)).toBe(false);
    expect(isOpenStatus(SalesEnquiryStatus.LOST)).toBe(false);
    expect(isOpenStatus(SalesEnquiryStatus.QUOTATION_SENT)).toBe(true);
  });
  it('enquiry number', () => {
    expect(formatEnquiryNumber(2026, 7)).toBe('ENQ-2026-0007');
    expect(formatEnquiryNumber(2026, 12345)).toBe('ENQ-2026-12345');
  });
});

describe('plain-language status wording (FMP-SALES-01C)', () => {
  it('Won / Lost read as Confirmed / Not Proceeding; Contacted and Meeting Done read as Under Discussion', async () => {
    const { STATUS_LABELS } = await import('./sales.logic');
    expect(STATUS_LABELS.WON).toBe('Confirmed');
    expect(STATUS_LABELS.LOST).toBe('Not Proceeding');
    expect(STATUS_LABELS.CONTACTED).toBe('Under Discussion');
    expect(STATUS_LABELS.MEETING_DONE).toBe('Under Discussion');
    expect(STATUS_LABELS.NEW_ENQUIRY).toBe('New');
    expect(STATUS_LABELS.FOLLOW_UP).toBe('Follow-up Needed');
  });
  it('the not-proceeding reason message is plain', () => {
    expect(statusChangeError(SalesEnquiryStatus.LOST, '')).toBe('Please give a short reason why this enquiry is not proceeding.');
  });
});
