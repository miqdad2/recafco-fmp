// FMP-PERF-02 — shared route-level loading fallback for pages whose real
// content is a uniform grid of module/metric cards (the Platform Dashboard's
// 11-card grid is the canonical example). Same visual language as the
// existing list-shaped loading.tsx files already in this app (incidents,
// factory-tasks, safety-compliance): `animate-pulse` + `bg-surface-secondary`
// tokens, one `aria-live="polite"` region — kept here as a reusable component
// (not copy-pasted per route) since more than one route needs this exact shape.
interface Props {
  /** Number of card placeholders — match the real page's own card count so the skeleton doesn't visibly "pop" to a different grid size once data arrives. */
  cardCount: number;
  /** Tailwind grid-column classes — pass the real page's own responsive grid so the skeleton reflows at the same breakpoints. */
  gridClassName?: string;
}

export function CardGridLoadingSkeleton({
  cardCount,
  gridClassName = 'grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
}: Props): React.JSX.Element {
  return (
    <div className="min-h-full p-8" aria-live="polite" aria-label="Loading">
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="mx-auto mb-8 h-8 w-80 rounded bg-surface-secondary" />
        <div className={`grid ${gridClassName}`}>
          {Array.from({ length: cardCount }).map((_, i) => (
            <div key={i} className="h-40 rounded-lg border border-border bg-surface-secondary" />
          ))}
        </div>
      </div>
    </div>
  );
}
