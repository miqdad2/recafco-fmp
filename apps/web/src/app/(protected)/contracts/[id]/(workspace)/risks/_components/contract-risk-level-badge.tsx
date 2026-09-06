import type { ContractRiskLevel } from '@/lib/contracts-api';
import { RISK_LEVEL_LABELS, RISK_LEVEL_BADGE_CLASSES } from '../../../../_lib/contract-risk-helpers';

/** CM-62 — shared badge for both the Risk Evaluation and Residual Risk columns (same real LOW/MEDIUM/HIGH/CRITICAL scale). */
export function ContractRiskLevelBadge({ level }: { level: ContractRiskLevel }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${RISK_LEVEL_BADGE_CLASSES[level]}`}>
      {RISK_LEVEL_LABELS[level]}
    </span>
  );
}
