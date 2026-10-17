import { ListChecks, ClipboardCheck, CheckCircle2, Archive } from 'lucide-react';
import { MetricCard, type MetricStatus } from '../../../_components/metric-card';
import type { CloseoutListSummary } from '@/lib/contracts-api';

interface Props {
  summary: CloseoutListSummary | null;
}

// FMP-CLOSEOUT-01 — four cards. Pending Review is the backend's Submitted + Under
// Review (each request counted once); Rejected and the individual Submitted /
// Under Review counts remain in the API summary and in the filters and list.
export function CloseoutSummaryCards({ summary }: Props): React.JSX.Element {
  const status: MetricStatus = summary ? 'ok' : 'unavailable';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard label="Total Requests" value={summary?.totalRequests} icon={ListChecks} iconColor="text-accent" status={status} />
      <MetricCard label="Pending Review" value={summary?.pendingReview} icon={ClipboardCheck} iconColor="text-warning" status={status} source="Submitted + Under Review" />
      <MetricCard label="Approved" value={summary?.approved} icon={CheckCircle2} iconColor="text-success" status={status} />
      <MetricCard label="Closed" value={summary?.closed} icon={Archive} iconColor="text-text-muted" status={status} />
    </div>
  );
}
