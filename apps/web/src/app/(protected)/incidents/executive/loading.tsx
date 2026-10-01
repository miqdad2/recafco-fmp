import { ExecutiveSummaryLoadingSkeleton } from '../../_components/executive-summary-loading-skeleton';

// FMP-PERF-02 — overrides the ancestor `incidents/loading.tsx` (a list-row
// skeleton, correct for `/incidents` itself but visibly wrong for this KPI
// landing page) with a shape matching this route's real
// `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5` MetricCard row.
export default function IncidentsExecutiveLoading(): React.JSX.Element {
  return <ExecutiveSummaryLoadingSkeleton metricCount={5} panels={2} />;
}
