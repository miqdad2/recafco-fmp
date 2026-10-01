import { ExecutiveSummaryLoadingSkeleton } from '../../_components/executive-summary-loading-skeleton';

// FMP-PERF-02 — overrides the generic `contracts/loading.tsx` (title + one
// block) for this specific route with a shape closer to the real page: a
// KPI row (ExecutiveKpiGrid) followed by a ~65/35 summary/needs-attention
// split (contracts/executive/page.tsx's own `lg:grid-cols-[13fr_7fr]`).
export default function ContractsExecutiveLoading(): React.JSX.Element {
  return <ExecutiveSummaryLoadingSkeleton metricCount={4} panels={2} />;
}
