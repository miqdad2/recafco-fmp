import { issueCategoryLabel } from '../../../../_lib/contract-issue-detail-helpers';

/** CM-65 — neutral badge for the Category column, consistent with the Attachments tab's soft/clean category badge convention. */
export function ContractIssueCategoryBadge({ category }: { category: string | undefined }): React.JSX.Element {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium text-text-muted whitespace-nowrap">
      {issueCategoryLabel(category)}
    </span>
  );
}
