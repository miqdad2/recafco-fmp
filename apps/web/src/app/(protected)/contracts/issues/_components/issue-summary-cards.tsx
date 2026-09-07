import { ListChecks, FolderOpen, Loader2, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { MetricCard, type MetricStatus } from '../../../_components/metric-card';
import type { ContractIssueSummary } from '@/lib/contracts-api';

interface Props {
  summary: ContractIssueSummary | null;
}

export function IssueSummaryCards({ summary }: Props): React.JSX.Element {
  const status: MetricStatus = summary ? 'ok' : 'unavailable';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
      <MetricCard
        label="Total Issues"
        value={summary?.totalIssues}
        icon={ListChecks}
        iconColor="text-accent"
        status={status}
      />
      <MetricCard
        label="Open Issues"
        value={summary?.openIssues}
        icon={FolderOpen}
        iconColor="text-text-secondary"
        status={status}
      />
      <MetricCard
        label="In Progress"
        value={summary?.inProgressIssues}
        icon={Loader2}
        iconColor="text-info"
        status={status}
      />
      <MetricCard
        label="High / Critical Priority"
        value={summary?.highCriticalIssues}
        icon={AlertTriangle}
        iconColor="text-warning"
        status={status}
      />
      <MetricCard
        label="Overdue Issues"
        value={summary?.overdueIssues}
        icon={Clock}
        iconColor="text-error"
        status={status}
      />
      <MetricCard
        label="Closed Issues"
        value={summary?.closedIssues}
        icon={CheckCircle2}
        iconColor="text-success"
        status={status}
      />
    </div>
  );
}
