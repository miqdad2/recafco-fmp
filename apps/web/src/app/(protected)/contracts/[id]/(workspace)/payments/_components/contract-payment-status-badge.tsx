import type { ContractPaymentStatus } from '@/lib/contracts-api';
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_BADGE_CLASSES } from '../../../../_lib/contract-payment-detail-helpers';

/**
 * CM-58 — manager-friendly payment status badge for the Contract Detail
 * Payments tab. Deliberately a SEPARATE component from
 * ../../../payments/_components/payment-status-badge.tsx (the module-level
 * register's own badge, which keeps its original "Paid"/"Partially Paid"
 * labels) — that page is explicitly out of scope for this unit, so its
 * labels/behavior are untouched.
 */
export function ContractPaymentStatusBadge({ status }: { status: ContractPaymentStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${PAYMENT_STATUS_BADGE_CLASSES[status]}`}>
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
