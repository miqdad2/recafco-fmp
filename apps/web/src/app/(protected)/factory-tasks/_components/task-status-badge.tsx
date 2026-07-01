import type { TaskStatus } from '../../../../lib/factory-tasks-api';

const STATUS_STYLES: Record<TaskStatus, string> = {
  DRAFT:       'bg-surface-secondary text-text-muted',
  OPEN:        'bg-secondary-accent-light text-secondary-accent',
  ASSIGNED:    'bg-info-light text-info',
  IN_PROGRESS: 'bg-warning-light text-warning',
  BLOCKED:     'bg-danger-light text-danger',
  COMPLETED:   'bg-success-light text-success',
  CLOSED:      'bg-surface-secondary text-text-secondary',
  CANCELLED:   'bg-surface-secondary text-text-muted',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  DRAFT:       'Draft',
  OPEN:        'Open',
  ASSIGNED:    'Assigned',
  IN_PROGRESS: 'In Progress',
  BLOCKED:     'Blocked',
  COMPLETED:   'Completed',
  CLOSED:      'Closed',
  CANCELLED:   'Cancelled',
};

interface Props {
  status: TaskStatus;
  className?: string | undefined;
}

export function TaskStatusBadge({ status, className = '' }: Props): React.JSX.Element {
  const style = STATUS_STYLES[status] ?? 'bg-surface-secondary text-text-muted';
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style} ${className}`}
      aria-label={`Status: ${label}`}
    >
      {label}
    </span>
  );
}
