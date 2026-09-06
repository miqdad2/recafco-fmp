import { formatKwdCompact } from '../_lib/dashboard-insights-helpers';
import type { ManagerDashboardFinancials } from '@/lib/contracts-api';

interface Props {
  financials: ManagerDashboardFinancials | undefined;
}

// CM-54 — "Financial Performance (KWD)" bar chart. Plain CSS bars (no chart
// library in this repo, none added) — 4 bars only: Contract Value,
// Submitted Invoices, Received Payments, Outstanding. The approved
// screenshot's "Certified" bar is deliberately removed per the change
// request. CM-54B — bar labels renamed to plain payment-flow wording; same
// underlying values (contractValueTotal/submittedTotal/paidTotal/
// outstandingTotal), no calculation change. CM-54C — visual-only polish:
// header spacing, a baseline rule under the bars, wider/rounder bars, and
// tabular-numeral value labels. Same bar values/order/colors.
// CM-54D — header spacing and chart height tightened a notch; bars widened
// slightly further so the 4-bar row reads less sparse against the card's
// narrower footprint. Same bar values/order/colors, no calculation change.
export function FinancialPerformanceChart({ financials }: Props): React.JSX.Element {
  const bars: { key: string; label: string; value: number; colorClass: string }[] = [
    { key: 'current', label: 'Contract Value', value: financials?.contractValueTotal ?? 0, colorClass: 'bg-info' },
    { key: 'submitted', label: 'Submitted Invoices', value: financials?.submittedTotal ?? 0, colorClass: 'bg-team-production' },
    { key: 'paid', label: 'Received Payments', value: financials?.paidTotal ?? 0, colorClass: 'bg-success' },
    { key: 'outstanding', label: 'Outstanding', value: financials?.outstandingTotal ?? 0, colorClass: 'bg-warning' },
  ];
  const max = Math.max(1, ...bars.map((b) => b.value));

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-text-primary mb-4">Financial Performance (KWD)</h2>
      {financials === undefined ? (
        <p className="text-xs text-text-muted">Data unavailable.</p>
      ) : (
        <div className="flex items-end justify-between gap-2.5 h-40 px-1 pb-2 border-b border-border/70">
          {bars.map((bar) => (
            <div key={bar.key} className="flex-1 flex flex-col items-center justify-end h-full gap-2">
              <span className="text-[11px] font-semibold text-text-primary tabular-nums">{formatKwdCompact(bar.value, false)}</span>
              <div className="w-full flex items-end justify-center h-full">
                <div
                  className={`w-full max-w-18 rounded-t-lg ${bar.colorClass}`}
                  style={{ height: `${Math.max(2, (bar.value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {financials !== undefined && (
        <div className="flex items-start justify-between gap-3 px-1 mt-2">
          {bars.map((bar) => (
            <span key={bar.key} className="flex-1 text-[11px] text-text-secondary text-center leading-snug">{bar.label}</span>
          ))}
        </div>
      )}
    </section>
  );
}
