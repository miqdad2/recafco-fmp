import type { IncidentStatus } from '../../../../lib/incidents-api';

const STATUS_STYLES: Record<IncidentStatus, string> = {
  DRAFT:           'bg-surface-secondary text-text-muted',
  SUBMITTED:       'bg-secondary-accent-light text-secondary-accent',
  UNDER_REVIEW:    'bg-warning-light text-warning',
  INVESTIGATION:   'bg-warning-light text-warning',
  ACTION_REQUIRED: 'bg-danger-light text-danger',
  RESOLVED:        'bg-success-light text-success',
  CLOSED:          'bg-surface-secondary text-text-secondary',
  CANCELLED:       'bg-surface-secondary text-text-muted',
};

const STATUS_LABELS: Record<IncidentStatus, string> = {
  DRAFT:           'Draft',
  SUBMITTED:       'Submitted',
  UNDER_REVIEW:    'Under Review',
  INVESTIGATION:   'Investigation',
  ACTION_REQUIRED: 'Action Required',
  RESOLVED:        'Resolved',
  CLOSED:          'Closed',
  CANCELLED:       'Cancelled',
};

interface Props {
  status: IncidentStatus;
  className?: string | undefined;
}

export function IncidentStatusBadge({ status, className = '' }: Props): React.JSX.Element {
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
