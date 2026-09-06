import type { ContractDocumentObligationCategory } from '@/lib/contracts-api';
import { DOCUMENT_OBLIGATION_CATEGORY_LABELS, DOCUMENT_OBLIGATION_CATEGORY_BADGE_CLASSES } from '../../../../_lib/contract-document-obligation-helpers';

/** CM-63 — manager-facing category badge for the Contract Detail Documents & Obligations tab. */
export function ContractDocumentCategoryBadge({ category }: { category: ContractDocumentObligationCategory }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${DOCUMENT_OBLIGATION_CATEGORY_BADGE_CLASSES[category]}`}>
      {DOCUMENT_OBLIGATION_CATEGORY_LABELS[category]}
    </span>
  );
}
