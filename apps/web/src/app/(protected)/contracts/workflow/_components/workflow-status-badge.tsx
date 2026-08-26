import type { WorkflowStatus } from '@/lib/contracts-api';

const STATUS_STYLES: Record<WorkflowStatus, string> = {
  NOT_GENERATED: 'bg-surface-secondary text-text-muted',
  NOT_STARTED: 'bg-surface-secondary text-text-secondary',
  IN_PROGRESS: 'bg-info-light text-info',
  COMPLETED: 'bg-success-light text-success',
};

const STATUS_LABELS: Record<WorkflowStatus, string> = {
  NOT_GENERATED: 'Not Generated',
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

export function WorkflowStatusBadge({ status }: { status: WorkflowStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
