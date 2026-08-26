import type { ContractCloseoutRequestStatus } from '@/lib/contracts-api';

const STATUS_STYLES: Record<ContractCloseoutRequestStatus, string> = {
  DRAFT: 'bg-surface-secondary text-text-secondary',
  SUBMITTED: 'bg-info-light text-info',
  UNDER_REVIEW: 'bg-warning-light text-warning',
  APPROVED: 'bg-success-light text-success',
  REJECTED: 'bg-danger-light text-danger',
  CLOSED: 'bg-surface-secondary text-text-secondary',
  CANCELLED: 'bg-surface-secondary text-text-muted',
};

function humanize(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function CloseoutStatusBadge({ status }: { status: ContractCloseoutRequestStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[status]}`}>
      {humanize(status)}
    </span>
  );
}
