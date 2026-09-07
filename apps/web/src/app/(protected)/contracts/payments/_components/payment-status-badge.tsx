import type { ContractPaymentStatus } from '@/lib/contracts-api';

const STATUS_STYLES: Record<ContractPaymentStatus, string> = {
  DRAFT: 'bg-surface-secondary text-text-secondary',
  SUBMITTED: 'bg-info-light text-info',
  CERTIFIED: 'bg-info-light text-info',
  PARTIALLY_PAID: 'bg-warning-light text-warning',
  PAID: 'bg-success-light text-success',
  OVERDUE: 'bg-error-light text-error',
  CANCELLED: 'bg-surface-secondary text-text-muted line-through',
};

const STATUS_LABELS: Record<ContractPaymentStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  CERTIFIED: 'Certified',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
};

export function PaymentStatusBadge({ status }: { status: ContractPaymentStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
