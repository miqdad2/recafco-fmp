import { ExecutiveSummaryLoadingSkeleton } from '../../_components/executive-summary-loading-skeleton';

// FMP-PERF-02 — overrides the generic `contracts/loading.tsx` (title + one
// block) for this specific route with a shape closer to the real page: a
// KPI row followed by the Erection Workflow Status grid (one full-width
// panel, not a 2-column split).
export default function ErectionDashboardLoading(): React.JSX.Element {
  return <ExecutiveSummaryLoadingSkeleton metricCount={4} panels={1} />;
}
