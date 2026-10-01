// FMP-TECH-01C, updated in FMP-TECH-05 — skeleton shape matching the real
// Technical Dashboard (header card + 7 KPI tiles + stage progress/next
// action row + the Technical Workflow Jobs table), not a generic spinner —
// same visual language as this app's other loading.tsx skeletons
// (animate-pulse + bg-surface-secondary/border-border tokens).
export default function TechnicalDashboardLoading(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-5 py-6 lg:px-6" aria-live="polite" aria-label="Loading">
      <div className="animate-pulse">
        <div className="mb-6 h-20 rounded-xl border border-border bg-surface-secondary" />

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-border bg-surface-secondary" />
          ))}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="h-40 rounded-lg border border-border bg-surface-secondary" />
          <div className="h-40 rounded-lg border border-border bg-surface-secondary" />
        </div>

        <div className="mb-2 h-5 w-56 rounded bg-surface-secondary" />
        <div className="overflow-hidden rounded-lg border border-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 border-b border-border px-4 py-3.5 last:border-b-0">
              <div className="h-4 w-24 rounded bg-surface-secondary" />
              <div className="h-4 flex-1 rounded bg-surface-secondary" />
              <div className="h-4 w-28 rounded bg-surface-secondary" />
              <div className="h-4 w-20 rounded bg-surface-secondary" />
              <div className="h-4 w-24 rounded bg-surface-secondary" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
