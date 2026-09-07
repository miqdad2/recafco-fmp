import { ListChecks, FileInput, Hourglass, CheckCircle2, XCircle, Archive, ClipboardCheck } from 'lucide-react';
import { MetricCard, type MetricStatus } from '../../../_components/metric-card';
import type { CloseoutListSummary } from '@/lib/contracts-api';

interface Props {
  summary: CloseoutListSummary | null;
}

export function CloseoutSummaryCards({ summary }: Props): React.JSX.Element {
  const status: MetricStatus = summary ? 'ok' : 'unavailable';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
      <MetricCard label="Total Requests" value={summary?.totalRequests} icon={ListChecks} iconColor="text-accent" status={status} />
      <MetricCard label="Submitted" value={summary?.submitted} icon={FileInput} iconColor="text-info" status={status} />
      <MetricCard label="Under Review" value={summary?.underReview} icon={Hourglass} iconColor="text-warning" status={status} />
      <MetricCard label="Approved" value={summary?.approved} icon={CheckCircle2} iconColor="text-success" status={status} />
      <MetricCard label="Rejected" value={summary?.rejected} icon={XCircle} iconColor="text-error" status={status} />
      <MetricCard label="Closed" value={summary?.closed} icon={Archive} iconColor="text-text-muted" status={status} />
      <MetricCard label="Pending Review" value={summary?.pendingReview} icon={ClipboardCheck} iconColor="text-warning" status={status} source="Submitted + Under Review" />
    </div>
  );
}
