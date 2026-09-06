import type { ContractClaimType } from '@/lib/contracts-api';
import { CLAIM_TYPE_DETAIL_LABELS } from '../../../../_lib/contract-claim-detail-helpers';

/**
 * CM-61 — manager-facing claim type badge for the Contract Detail Claims tab
 * ("Delay Claim", "EOT Claim", etc.). Deliberately a SEPARATE component from
 * ../../../claims/_components/claim-type-badge.tsx (the module-level Claim
 * Log's own badge, which keeps its original "Delay"/"Extension of Time"
 * wording untouched) — that page is out of scope for this unit.
 */
export function ContractClaimTypeBadge({ claimType }: { claimType: ContractClaimType }): React.JSX.Element {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium text-text-secondary whitespace-nowrap">
      {CLAIM_TYPE_DETAIL_LABELS[claimType]}
    </span>
  );
}
