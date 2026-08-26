import { Building2, ListTodo, Wrench, Factory, Truck, Receipt } from 'lucide-react';
import { MetricCard, type MetricStatus } from '../../../_components/metric-card';
import type { WorkflowAssignmentQueueSummary } from '@/lib/contracts-api';

interface Props {
  summary: WorkflowAssignmentQueueSummary | null;
}

/** CM-40 — 6 cards for the Assignment Queue: overall (contracts/tasks needing
 * assignment) plus a per-team breakdown so a manager can see at a glance
 * which team is most behind on assignment, without opening the filters. */
export function AssignmentQueueSummaryCards({ summary }: Props): React.JSX.Element {
  const status: MetricStatus = summary ? 'ok' : 'unavailable';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <MetricCard
        label="Contracts Needing Assignment"
        value={summary?.contractsNeedingAssignment}
        icon={Building2}
        iconColor="text-accent"
        status={status}
        dense
      />
      <MetricCard
        label="Unassigned Tasks"
        value={summary?.unassignedTasksTotal}
        icon={ListTodo}
        iconColor="text-warning"
        status={status}
        dense
      />
      <MetricCard
        label="Technical Unassigned"
        value={summary?.technicalUnassigned}
        icon={Wrench}
        iconColor="text-info"
        status={status}
        dense
      />
      <MetricCard
        label="Production Unassigned"
        value={summary?.productionUnassigned}
        icon={Factory}
        iconColor="text-info"
        status={status}
        dense
      />
      <MetricCard
        label="Erection Unassigned"
        value={summary?.erectionUnassigned}
        icon={Truck}
        iconColor="text-info"
        status={status}
        dense
      />
      <MetricCard
        label="QS / Commercial Unassigned"
        value={summary?.qsCommercialUnassigned}
        icon={Receipt}
        iconColor="text-info"
        status={status}
        dense
      />
    </div>
  );
}
