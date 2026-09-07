import type { ContractClaimStatus } from '@/lib/contracts-api';

const STATUS_STYLES: Record<ContractClaimStatus, string> = {
  DRAFT: 'bg-surface-secondary text-text-secondary',
  UNDER_REVIEW: 'bg-info-light text-info',
  SUBMITTED: 'bg-info-light text-info',
  UNDER_NEGOTIATION: 'bg-warning-light text-warning',
  APPROVED: 'bg-success-light text-success',
  PARTIALLY_APPROVED: 'bg-warning-light text-warning',
  REJECTED: 'bg-error-light text-error',
  SETTLED: 'bg-success-light text-success',
  CLOSED: 'bg-success-light text-success',
  CANCELLED: 'bg-surface-secondary text-text-muted line-through',
};

const STATUS_LABELS: Record<ContractClaimStatus, string> = {
  DRAFT: 'Draft',
  UNDER_REVIEW: 'Under Review',
  SUBMITTED: 'Submitted',
  UNDER_NEGOTIATION: 'Under Negotiation',
  APPROVED: 'Approved',
  PARTIALLY_APPROVED: 'Partially Approved',
  REJECTED: 'Rejected',
  SETTLED: 'Settled',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

export function ClaimStatusBadge({ status }: { status: ContractClaimStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
