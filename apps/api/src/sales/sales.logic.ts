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

/**
 * FMP-SALES-17 — the ONE received-month rule used by the dashboard's Monthly Results cards AND the enquiry list's `month`
 * filter: every enquiry whose received date (enquiryDate, a Kuwait calendar date) falls in that month. Add
 * `status: WON` for the Confirmed group. Never mixes in confirmation dates.
 */
export function receivedMonthWhere(month: string): { enquiryDate: { gte: Date; lt: Date } } {
  const { start, endExclusive } = monthRange(month);
  return { enquiryDate: { gte: start, lt: endExclusive } };
}

/**
 * FMP-SALES-17 — the months the Month selector offers: the current Kuwait month, plus every earlier month with data, newest
 * first. Future months (a mistyped enquiry date, a clock skew) are never offered.
 */
export function reportingMonths(currentMonth: string, dataMonths: Iterable<string>): string[] {
  const set = new Set<string>([currentMonth]);
  for (const m of dataMonths) if (isValidMonth(m) && m <= currentMonth) set.add(m);
  return [...set].sort((a, b) => (a < b ? 1 : -1));
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
  WAITING_FOR_DRAWINGS: 'Waiting for Drawings',
  WAITING_FOR_CLIENT: 'Waiting for Client Response',
  // FMP-SALES-18 — never shown on its own: the enquiry's custom status name is (effectiveStatusLabel).
  CUSTOM: 'Custom Status',
};

/** FMP-SALES-18 — the one place an enquiry's displayed status is decided: a custom status shows its own name. */
export function effectiveStatusLabel(status: SalesEnquiryStatus, customStatusName: string | null | undefined): string {
  return status === SalesEnquiryStatus.CUSTOM && customStatusName ? customStatusName : STATUS_LABELS[status];
}

export const CUSTOM_STATUS_NAME_MAX = 60;

/** Trimmed, with every run of whitespace (tabs, line breaks, double spaces) turned into one space. */
export function normalizeStatusName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/** The comparison key stored in name_key: lower case, hyphens/underscores/full stops read as spaces, single spaces. */
export function statusNameKey(name: string): string {
  return normalizeStatusName(name.toLowerCase().replace(/[-_.]+/g, ' '));
}

/**
 * Names a custom status may never take: every system label, the stored codes written as words, and legacy wording
 * (Won / Lost / Awarded / Closed ...) and the list filter names, so no custom status can pass for a protected outcome.
 */
const RESERVED_STATUS_KEYS: ReadonlySet<string> = new Set(
  [
    ...Object.values(STATUS_LABELS),
    ...Object.keys(STATUS_LABELS),
    'New Enquiry', 'Contacted', 'Meeting Done', 'Follow Up', 'Won', 'Lost', 'Confirm', 'Confirmed Enquiry', 'Awarded', 'Win',
    'Not Proceed', 'Not Proceeding Enquiry', 'Closed', 'Cancelled', 'Canceled', 'Rejected', 'Active', 'All', 'Open', 'Custom',
  ].map(statusNameKey),
);

/** Why this custom status name cannot be used (before the database uniqueness check), or null. */
export function customStatusNameError(name: string): string | null {
  if (!name) return 'Please enter a status name.';
  if (name.length > CUSTOM_STATUS_NAME_MAX) return `Please keep the status name to ${CUSTOM_STATUS_NAME_MAX} characters or fewer.`;
  if (!/[\p{L}\p{N}]/u.test(name)) return 'The status name needs at least one letter or number.';
  if (RESERVED_STATUS_KEYS.has(statusNameKey(name))) return `“${name}” is a built-in status. Choose it from the Change Status menu, or use a different name.`;
  return null;
}

/** Human enquiry number: ENQ-2026-0001. */
export function formatEnquiryNumber(year: number, seq: number): string {
  return `ENQ-${year}-${String(seq).padStart(4, '0')}`;
}
