import type { ContractIssuePriority } from '@/lib/contracts-api';
import { ISSUE_PRIORITY_LABELS, ISSUE_PRIORITY_BADGE_CLASSES } from '../../../../_lib/contract-issue-detail-helpers';

/** CM-65 — tab-local priority badge, matching Risk Assessment's escalation color pattern (gray -> amber -> red -> solid red). */
export function ContractIssuePriorityBadge({ priority }: { priority: ContractIssuePriority }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${ISSUE_PRIORITY_BADGE_CLASSES[priority]}`}>
      {ISSUE_PRIORITY_LABELS[priority]}
    </span>
  );
}
