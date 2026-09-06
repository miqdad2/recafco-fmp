import type { ContractIssueStatus } from '@/lib/contracts-api';
import { ISSUE_STATUS_LABELS, ISSUE_STATUS_BADGE_CLASSES } from '../../../../_lib/contract-issue-detail-helpers';

/** CM-65 — tab-local status badge. Waiting Response uses real indigo (`team-production`), never this theme's red `accent` token (see CM-64C). */
export function ContractIssueStatusBadge({ status }: { status: ContractIssueStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${ISSUE_STATUS_BADGE_CLASSES[status]}`}>
      {ISSUE_STATUS_LABELS[status]}
    </span>
  );
}
