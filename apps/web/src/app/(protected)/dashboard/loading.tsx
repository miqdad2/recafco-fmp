import { CardGridLoadingSkeleton } from '../_components/card-grid-loading-skeleton';

// FMP-PERF-02 — the Platform Dashboard previously fell back to the generic
// top-level `(protected)/loading.tsx` spinner (the only loading.tsx above
// it in the segment tree). This route-specific skeleton matches the real
// page's own 11-card grid (dashboard/page.tsx) so the loading state reads as
// "this page, about to appear" rather than a generic wait indicator.
// FMP-UI-24 — same auto-fill columns, gap, and card height/radius as the
// standardized cards, so nothing shifts when the real cards replace it.
export default function DashboardLoading(): React.JSX.Element {
  return (
    <CardGridLoadingSkeleton
      cardCount={11}
      gridClassName="grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-3.5 lg:grid-cols-[repeat(auto-fill,minmax(17.5rem,1fr))]"
      cardClassName="h-64 rounded-2xl"
    />
  );
}
