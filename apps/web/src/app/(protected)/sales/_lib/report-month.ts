/**
 * FMP-SALES-17 — the dashboard's reporting-month address. Only an EARLIER month is written into the URL; the current month is
 * the plain /sales address, so the page keeps following the Kuwait calendar (and a fresh visit never inherits a selection).
 */
export const REPORT_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function reportMonthHref(month: string, currentMonth: string): string {
  return REPORT_MONTH_PATTERN.test(month) && month < currentMonth ? `/sales?month=${month}` : '/sales';
}

/** The `month` search parameter when it is a well-formed YYYY-MM; anything else means "the current month". */
export function requestedReportMonth(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && REPORT_MONTH_PATTERN.test(v) ? v : undefined;
}
