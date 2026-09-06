import type { ContractRiskResponse } from '@/lib/contracts-api';
import { RISK_RESPONSE_LABELS, RISK_RESPONSE_BADGE_CLASSES } from '../../../../_lib/contract-risk-helpers';

/** CM-62 — manager-facing risk response badge. Exactly Mitigate/Accept/Avoid/Transfer, never Subcontracting/Insurance. */
export function ContractRiskResponseBadge({ response }: { response: ContractRiskResponse }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${RISK_RESPONSE_BADGE_CLASSES[response]}`}>
      {RISK_RESPONSE_LABELS[response]}
    </span>
  );
}
