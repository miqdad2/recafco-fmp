import { FormLoadingSkeleton } from '../../_components/form-loading-skeleton';

// FMP-PERF-02 — overrides the ancestor `incidents/loading.tsx` (a list-row
// skeleton, wrong shape for a create form) for this one route.
export default function NewIncidentLoading(): React.JSX.Element {
  return <FormLoadingSkeleton fieldCount={7} />;
}
