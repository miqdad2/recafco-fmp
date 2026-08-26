import type { ContractIssueStatus } from '@/lib/contracts-api';

const STATUS_STYLES: Record<ContractIssueStatus, string> = {
  OPEN: 'bg-surface-secondary text-text-secondary',
  IN_PROGRESS: 'bg-info-light text-info',
  WAITING_RESPONSE: 'bg-warning-light text-warning',
  RESOLVED: 'bg-success-light text-success',
  CLOSED: 'bg-success-light text-success',
  CANCELLED: 'bg-surface-secondary text-text-muted line-through',
};

const STATUS_LABELS: Record<ContractIssueStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  WAITING_RESPONSE: 'Waiting Response',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

export function IssueStatusBadge({ status }: { status: ContractIssueStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
