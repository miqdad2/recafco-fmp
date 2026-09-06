import type { ContractVariationStatus } from '@/lib/contracts-api';
import { VARIATION_STATUS_LABELS, VARIATION_STATUS_BADGE_CLASSES } from '../../../../_lib/contract-variation-helpers';

/** CM-60 — manager-facing variation status badge for the Contract Detail Variations / Change Orders tab. */
export function ContractVariationStatusBadge({ status }: { status: ContractVariationStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${VARIATION_STATUS_BADGE_CLASSES[status]}`}>
      {VARIATION_STATUS_LABELS[status]}
    </span>
  );
}
