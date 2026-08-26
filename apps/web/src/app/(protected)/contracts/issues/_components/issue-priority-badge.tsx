import type { ContractIssuePriority } from '@/lib/contracts-api';

const PRIORITY_STYLES: Record<ContractIssuePriority, string> = {
  LOW: 'bg-surface-secondary text-text-secondary',
  MEDIUM: 'bg-info-light text-info',
  HIGH: 'bg-warning-light text-warning',
  CRITICAL: 'bg-danger-light text-danger',
};

const PRIORITY_LABELS: Record<ContractIssuePriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export function IssuePriorityBadge({ priority }: { priority: ContractIssuePriority }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
