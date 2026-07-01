import type { TaskPriority } from '../../../../lib/factory-tasks-api';

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  LOW:      'bg-surface-secondary text-text-muted',
  MEDIUM:   'bg-info-light text-info',
  HIGH:     'bg-warning-light text-warning',
  URGENT: 'bg-danger-light text-danger',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW:      'Low',
  MEDIUM:   'Medium',
  HIGH:     'High',
  URGENT: 'Urgent',
};

interface Props {
  priority: TaskPriority;
  className?: string | undefined;
}

export function TaskPriorityBadge({ priority, className = '' }: Props): React.JSX.Element {
  const style = PRIORITY_STYLES[priority] ?? 'bg-surface-secondary text-text-muted';
  const label = PRIORITY_LABELS[priority] ?? priority;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style} ${className}`}
      aria-label={`Priority: ${label}`}
    >
      {label}
    </span>
  );
}
