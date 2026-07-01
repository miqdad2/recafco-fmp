import type { FindingStatus } from '../../../../lib/safety-api';

const STATUS_STYLES: Record<FindingStatus, string> = {
  OPEN:            'bg-info-light text-info',
  ACTION_REQUIRED: 'bg-warning-light text-warning',
  RESOLVED:        'bg-accent-light text-accent',
  VERIFIED:        'bg-success-light text-success',
  CLOSED:          'bg-surface-secondary text-text-secondary',
};

const STATUS_LABELS: Record<FindingStatus, string> = {
  OPEN:            'Open',
  ACTION_REQUIRED: 'Action Required',
  RESOLVED:        'Resolved',
  VERIFIED:        'Verified',
  CLOSED:          'Closed',
};

interface Props {
  status: FindingStatus;
  className?: string | undefined;
}

export function FindingStatusBadge({ status, className = '' }: Props): React.JSX.Element {
  const style = STATUS_STYLES[status] ?? 'bg-surface-secondary text-text-muted';
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style} ${className}`}
      aria-label={`Finding status: ${label}`}
    >
      {label}
    </span>
  );
}
