import { ListChecks, UserCheck, CircleDashed, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { MetricCard, type MetricStatus } from '../../../_components/metric-card';
import type { ContractWorkflowSummary } from '@/lib/contracts-api';

interface Props {
  summary: ContractWorkflowSummary | null;
}

export function WorkflowSummaryCards({ summary }: Props): React.JSX.Element {
  const status: MetricStatus = summary ? 'ok' : 'unavailable';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
      <MetricCard
        label="Active Workflows"
        value={summary?.totalContractsWithWorkflow}
        icon={ListChecks}
        iconColor="text-accent"
        status={status}
      />
      <MetricCard
        label="My Open Tasks"
        value={summary?.myOpenTasks}
        icon={UserCheck}
        iconColor="text-accent"
        status={status}
      />
      <MetricCard
        label="Pending Tasks"
        value={summary?.tasksNotStarted}
        icon={CircleDashed}
        iconColor="text-text-secondary"
        status={status}
      />
      <MetricCard
        label="In Progress"
        value={summary?.tasksInProgress}
        icon={Loader2}
        iconColor="text-info"
        status={status}
      />
      <MetricCard
        label="Overdue Tasks"
        value={summary?.tasksOverdue}
        icon={AlertTriangle}
        iconColor="text-error"
        status={status}
      />
      <MetricCard
        label="Completed Tasks"
        value={summary?.tasksCompleted}
        icon={CheckCircle2}
        iconColor="text-success"
        status={status}
      />
    </div>
  );
}
