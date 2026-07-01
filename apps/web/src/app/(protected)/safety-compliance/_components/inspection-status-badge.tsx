import type { InspectionStatus } from '../../../../lib/safety-api';

const STATUS_STYLES: Record<InspectionStatus, string> = {
  DRAFT:       'bg-surface-secondary text-text-muted',
  SCHEDULED:   'bg-info-light text-info',
  IN_PROGRESS: 'bg-warning-light text-warning',
  COMPLETED:   'bg-success-light text-success',
  CLOSED:      'bg-surface-secondary text-text-secondary',
  CANCELLED:   'bg-surface-secondary text-text-muted',
};

const STATUS_LABELS: Record<InspectionStatus, string> = {
  DRAFT:       'Draft',
  SCHEDULED:   'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED:   'Completed',
  CLOSED:      'Closed',
  CANCELLED:   'Cancelled',
};

interface Props {
  status: InspectionStatus;
  className?: string | undefined;
}

export function InspectionStatusBadge({ status, className = '' }: Props): React.JSX.Element {
  const style = STATUS_STYLES[status] ?? 'bg-surface-secondary text-text-muted';
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style} ${className}`}
      aria-label={`Status: ${label}`}
    >
      {label}
    </span>
  );
}
