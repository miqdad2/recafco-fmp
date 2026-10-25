// ---------------------------------------------------------------------------
// FMP-SALES-06 — "today" and "this month" in Asia/Kuwait, computed the same way on the server and in the browser.
// Kuwait is UTC+3 all year (no daylight saving), so a fixed offset is exact and independent of the machine's own zone.
// ---------------------------------------------------------------------------

const KUWAIT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The Kuwait calendar date (YYYY-MM-DD) at an instant. */
export function kuwaitDateOf(epochMs: number): string {
  return new Date(epochMs + KUWAIT_OFFSET_MS).toISOString().slice(0, 10);
}

/** The Kuwait reporting month (YYYY-MM) at an instant. */
export function kuwaitMonthOf(epochMs: number): string {
  return kuwaitDateOf(epochMs).slice(0, 7);
}

/** Milliseconds from an instant to the next Kuwait midnight (always 1 .. 86,400,000). */
export function msUntilNextKuwaitMidnight(epochMs: number): number {
  const intoDay = (((epochMs + KUWAIT_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
  return DAY_MS - intoDay;
}
