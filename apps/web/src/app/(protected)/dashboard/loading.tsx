import { CardGridLoadingSkeleton } from '../_components/card-grid-loading-skeleton';

// FMP-PERF-02 — the Platform Dashboard previously fell back to the generic
// top-level `(protected)/loading.tsx` spinner (the only loading.tsx above
// it in the segment tree). This route-specific skeleton matches the real
// page's own 11-card `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
// layout (dashboard/page.tsx) so the loading state reads as "this page,
// about to appear" rather than a generic wait indicator.
export default function DashboardLoading(): React.JSX.Element {
  return (
    <CardGridLoadingSkeleton
      cardCount={11}
      gridClassName="grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    />
  );
}
