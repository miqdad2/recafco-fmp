import type { ContractRiskStatus } from '@/lib/contracts-api';
import { RISK_STATUS_LABELS, RISK_STATUS_BADGE_CLASSES } from '../../../../_lib/contract-risk-helpers';

/** CM-62 — manager-facing risk status badge for the Contract Detail Risk Assessment tab. */
export function ContractRiskStatusBadge({ status }: { status: ContractRiskStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${RISK_STATUS_BADGE_CLASSES[status]}`}>
      {RISK_STATUS_LABELS[status]}
    </span>
  );
}
