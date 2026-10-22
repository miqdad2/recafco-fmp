import { SalesEnquiryStatus } from '@recafco/database';

// ---------------------------------------------------------------------------
// FMP-SALES-01 — pure Sales rules (dates in Kuwait time, follow-up buckets, conversion
// rate, status rules, money validation). No database access here, so every rule is
// unit-tested directly.
// ---------------------------------------------------------------------------

const KUWAIT_OFFSET_MS = 3 * 60 * 60 * 1000; // Asia/Kuwait is UTC+3 all year (no daylight saving).

/** Today's calendar date in Kuwait as YYYY-MM-DD. */
export function kuwaitToday(now: Date = new Date()): string {
  return new Date(now.getTime() + KUWAIT_OFFSET_MS).toISOString().slice(0, 10);
}

/** A YYYY-MM-DD string as the Date Prisma stores in a DATE column (UTC midnight). */
export function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** The YYYY-MM-DD of a DATE value read back from the database. */
export function dateKey(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** YYYY-MM for a YYYY-MM-DD date. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** First day of the month and first day of the next month (half-open range) for YYYY-MM. */
export function monthRange(month: string): { start: Date; endExclusive: Date } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return { start: new Date(Date.UTC(y, m - 1, 1)), endExclusive: new Date(Date.UTC(y, m, 1)) };
}

export function isValidMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** The last `count` months ending with (and including) `month`, oldest first. */
export function lastMonths(month: string, count: number): string[] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    out.push(new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
  }
  return out;
}

export type FollowUpBucket = 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';

/** Where a follow-up sits relative to today (Kuwait). Completed and cancelled ones never count as due. */
export function followUpBucket(status: 'PENDING' | 'COMPLETED' | 'CANCELLED', followUpDate: string, today: string): FollowUpBucket {
  if (status === 'COMPLETED') return 'COMPLETED';
  if (status === 'CANCELLED') return 'CANCELLED';
  if (followUpDate < today) return 'OVERDUE';
  if (followUpDate === today) return 'TODAY';
  return 'UPCOMING';
}

export const CLOSED_STATUSES: readonly SalesEnquiryStatus[] = [SalesEnquiryStatus.WON, SalesEnquiryStatus.LOST];

export function isOpenStatus(status: SalesEnquiryStatus): boolean {
  return !CLOSED_STATUSES.includes(status);
}

/**
 * Monthly Enquiry Cohort Conversion Rate: of the enquiries CREATED in the month, the share that are
 * now Won. Returns null (shown as N/A) when nothing was created - never a division by zero.
 * One decimal place.
 */
export function cohortConversionRate(createdInMonth: number, createdInMonthNowWon: number): number | null {
  if (createdInMonth <= 0) return null;
  return Math.round((createdInMonthNowWon / createdInMonth) * 1000) / 10;
}

/** Estimated/awarded value: up to 12 digits and 3 decimals (KWD fils), never negative. */
const MONEY = /^\d{1,12}(\.\d{1,3})?$/;

export function normalizeMoney(value: string | number | null | undefined): string | null | 'INVALID' {
  if (value === null || value === undefined) return null;
  const text = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : 'x') : value.trim();
  if (text === '') return null;
  return MONEY.test(text) ? text : 'INVALID';
}

/** Why a status change cannot be made, or null when it can. */
export function statusChangeError(next: SalesEnquiryStatus, reason: string | null | undefined): string | null {
  if (next === SalesEnquiryStatus.LOST && !(reason && reason.trim())) return 'Please give a short reason why this enquiry is not proceeding.';
  return null;
}

export const STATUS_LABELS: Record<SalesEnquiryStatus, string> = {
  NEW_ENQUIRY: 'New',
  CONTACTED: 'Under Discussion',
  MEETING_DONE: 'Under Discussion',
  QUOTATION_SENT: 'Quotation Sent',
  FOLLOW_UP: 'Follow-up Needed',
  WON: 'Confirmed',
  LOST: 'Not Proceeding',
};

/** Human enquiry number: ENQ-2026-0001. */
export function formatEnquiryNumber(year: number, seq: number): string {
  return `ENQ-${year}-${String(seq).padStart(4, '0')}`;
}
