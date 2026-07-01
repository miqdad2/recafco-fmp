import type { MaintenanceStatus } from '../../../../lib/maintenance-api';

const STATUS_STYLES: Record<MaintenanceStatus, string> = {
  DRAFT:            'bg-surface-secondary text-text-muted',
  SUBMITTED:        'bg-secondary-accent-light text-secondary-accent',
  UNDER_REVIEW:     'bg-info-light text-info',
  APPROVED:         'bg-warning-light text-warning',
  ASSIGNED:         'bg-info-light text-info',
  IN_PROGRESS:      'bg-warning-light text-warning',
  WAITING_FOR_PARTS:'bg-danger-light text-danger',
  COMPLETED:        'bg-success-light text-success',
  CLOSED:           'bg-surface-secondary text-text-secondary',
  REJECTED:         'bg-danger-light text-danger',
  CANCELLED:        'bg-surface-secondary text-text-muted',
};

const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  DRAFT:            'Draft',
  SUBMITTED:        'Submitted',
  UNDER_REVIEW:     'Under Review',
  APPROVED:         'Approved',
  ASSIGNED:         'Assigned',
  IN_PROGRESS:      'In Progress',
  WAITING_FOR_PARTS:'Waiting for Parts',
  COMPLETED:        'Completed',
  CLOSED:           'Closed',
  REJECTED:         'Rejected',
  CANCELLED:        'Cancelled',
};

interface Props {
  status: MaintenanceStatus;
  className?: string | undefined;
}

export function MrStatusBadge({ status, className = '' }: Props): React.JSX.Element {
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
