import type { ContractWorkflowTaskStatus } from '@/lib/contracts-api';

const STATUS_STYLES: Record<ContractWorkflowTaskStatus, string> = {
  NOT_STARTED: 'bg-surface-secondary text-text-secondary',
  IN_PROGRESS: 'bg-info-light text-info',
  SUBMITTED: 'bg-info-light text-info',
  UNDER_REVIEW: 'bg-warning-light text-warning',
  APPROVED: 'bg-success-light text-success',
  REJECTED: 'bg-error-light text-error',
  COMPLETED: 'bg-success-light text-success',
  ON_HOLD: 'bg-surface-secondary text-text-muted',
};

const STATUS_LABELS: Record<ContractWorkflowTaskStatus, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  COMPLETED: 'Completed',
  ON_HOLD: 'On Hold',
};

export function WorkflowTaskStatusBadge({ status }: { status: ContractWorkflowTaskStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export const WORKFLOW_TASK_STATUS_LABELS = STATUS_LABELS;
