import type { ContractBoqProductionStatus } from '@/lib/contracts-api';
import { PRODUCTION_STATUS_LABELS, PRODUCTION_STATUS_BADGE_CLASSES } from '../../../../_lib/contract-production-helpers';

/**
 * CM-59 — manager-facing production status badge for the Contract Detail
 * Production Status tab. CM-59B — bumped to font-semibold for a clearer,
 * more scannable badge in the table; colors/labels unchanged.
 */
export function ContractProductionStatusBadge({ status }: { status: ContractBoqProductionStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${PRODUCTION_STATUS_BADGE_CLASSES[status]}`}>
      {PRODUCTION_STATUS_LABELS[status]}
    </span>
  );
}
