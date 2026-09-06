import type { ContractDocumentObligationStatus } from '@/lib/contracts-api';
import { DOCUMENT_OBLIGATION_STATUS_LABELS, DOCUMENT_OBLIGATION_STATUS_BADGE_CLASSES } from '../../../../_lib/contract-document-obligation-helpers';

/** CM-63 — manager-facing status badge for the Contract Detail Documents & Obligations tab. Always the plain manual status value, never overridden by date math. */
export function ContractDocumentStatusBadge({ status }: { status: ContractDocumentObligationStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${DOCUMENT_OBLIGATION_STATUS_BADGE_CLASSES[status]}`}>
      {DOCUMENT_OBLIGATION_STATUS_LABELS[status]}
    </span>
  );
}
