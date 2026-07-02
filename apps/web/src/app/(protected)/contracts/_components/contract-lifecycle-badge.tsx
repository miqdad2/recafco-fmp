export type DerivedLifecycleStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'TERMINATED' | 'CLOSED';

const LABEL_MAP: Record<DerivedLifecycleStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  EXPIRING: 'Expiring Soon',
  EXPIRED: 'Expired',
  TERMINATED: 'Terminated',
  CLOSED: 'Closed',
};

interface Props {
  status: DerivedLifecycleStatus;
  className?: string | undefined;
}

export function ContractLifecycleBadge({ status, className = '' }: Props): React.JSX.Element {
  const label = LABEL_MAP[status] ?? status;

  let colorClass: string;
  if (status === 'DRAFT') {
    colorClass = 'bg-surface-secondary text-text-secondary border border-border';
  } else if (status === 'ACTIVE') {
    colorClass = 'bg-success/10 text-success border border-success/30';
  } else if (status === 'EXPIRING') {
    colorClass = 'bg-warning/10 text-warning border border-warning/30';
  } else if (status === 'EXPIRED') {
    colorClass = 'bg-danger/10 text-danger border border-danger/30';
  } else if (status === 'TERMINATED') {
    colorClass = 'bg-danger/10 text-danger border border-danger/30';
  } else {
    colorClass = 'bg-surface-secondary text-text-muted border border-border';
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass} ${className}`}
      aria-label={`Status: ${label}`}
    >
      {label}
    </span>
  );
}
