import type { ContractWorkflowTaskPriority } from '@/lib/contracts-api';

const PRIORITY_STYLES: Record<ContractWorkflowTaskPriority, string> = {
  LOW: 'bg-surface-secondary text-text-secondary',
  MEDIUM: 'bg-info-light text-info',
  HIGH: 'bg-warning-light text-warning',
  CRITICAL: 'bg-danger-light text-danger',
};

const PRIORITY_LABELS: Record<ContractWorkflowTaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export function WorkflowTaskPriorityBadge({ priority }: { priority: ContractWorkflowTaskPriority }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${PRIORITY_STYLES[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
