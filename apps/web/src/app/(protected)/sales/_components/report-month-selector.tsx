'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { formatMonth } from '../_lib/sales-format';
import { reportMonthHref } from '../_lib/report-month';

/**
 * FMP-SALES-17 — the Monthly Results "Month" selector. The choice lives only in the page address (/sales?month=YYYY-MM):
 * refreshes and on-page actions (router.refresh) keep it, while a fresh visit to /sales starts on the current Kuwait month.
 * Choosing the current month (or This Month) drops the parameter, so the page FOLLOWS the calendar again and the existing
 * DashboardClock refresh carries it into the next month at Kuwait midnight - no extra timer. A historical month is never
 * changed at rollover. The options and the current month come from the server, never the browser clock. Options are plain month
 * names (a short select keeps the definition line beside it on one line); the This Month button shows, pressed, when the page
 * is on the current month.
 */
export function ReportMonthSelector({ months, selected, currentMonth }: { months: string[]; selected: string; currentMonth: string }): React.JSX.Element {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (month: string): void => start(() => router.push(reportMonthHref(month, currentMonth), { scroll: false }));
  const following = selected === currentMonth;

  return (
    <div className="sd-month-picker flex flex-wrap items-center gap-2" aria-busy={pending}>
      <label htmlFor="report-month" className="flex items-center gap-1.5 text-lg font-semibold text-text-primary 2xl:text-xl">
        <CalendarDays className="size-5 text-text-secondary" aria-hidden="true" /> Month
      </label>
      <select
        id="report-month"
        value={selected}
        onChange={(e) => go(e.target.value)}
        className="min-h-12 min-w-52 rounded-lg border-2 border-border-strong bg-surface px-3 text-lg font-semibold text-text-primary shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus 2xl:text-xl"
        data-report-month-select
      >
        {months.map((m) => (
          <option key={m} value={m}>{formatMonth(m)}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => go(currentMonth)}
        aria-pressed={following}
        className={`min-h-12 rounded-lg border-2 px-4 text-lg font-semibold shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus 2xl:text-xl ${following ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-blue-700 bg-blue-700 text-white hover:bg-blue-800'}`}
        data-this-month
      >
        This Month
      </button>
      {pending && <span role="status" className="text-base text-text-secondary">Loading…</span>}
    </div>
  );
}
