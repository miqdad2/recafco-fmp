// FMP-PERF-02 — shared route-level loading fallback for Executive Module
// Landing Pages and similar KPI-row + summary-panel dashboards (Contract
// Management Executive, Incident Executive, Erection Dashboard). These pages
// render a `MetricCard`/`ExecutiveKpiGrid` row followed by one or two content
// panels (summary list, needs-attention list) — this mirrors that shape at a
// generic level without depending on any one page's exact data, so it stays
// correct even if a page's own panel copy changes later. Same visual
// language as this app's other loading.tsx skeletons.
interface Props {
  /** KPI/metric card count across the top row — match the real page's count. */
  metricCount?: number;
  /** 1 = one full-width content panel below the KPI row, 2 = a summary/needs-attention split. */
  panels?: 1 | 2;
}

export function ExecutiveSummaryLoadingSkeleton({ metricCount = 4, panels = 2 }: Props): React.JSX.Element {
  return (
    <div className="min-h-full p-8" aria-live="polite" aria-label="Loading">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="mb-2 h-4 w-40 rounded bg-surface-secondary" />
        <div className="mb-8 h-8 w-72 rounded bg-surface-secondary" />

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: metricCount }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg border border-border bg-surface-secondary" />
          ))}
        </div>

        {panels === 2 ? (
          <div className="grid gap-4 lg:grid-cols-[13fr_7fr]">
            <div className="h-64 rounded-lg bg-surface-secondary" />
            <div className="h-64 rounded-lg bg-surface-secondary" />
          </div>
        ) : (
          <div className="h-72 rounded-lg bg-surface-secondary" />
        )}
      </div>
    </div>
  );
}
