import type { AssignmentQueueContractGroup } from '../../_lib/assignment-queue-grouping';
import { AssignmentQueueContractCard } from './assignment-queue-contract-card';

interface Props {
  groups: AssignmentQueueContractGroup[];
  buildAssignHref: (contractId: string) => string;
}

/**
 * CM-40C — the Assignment Queue's default landing content: one card per
 * contract that has unassigned tasks, instead of every task from every
 * contract at once. No client state — cards are plain links, filtering
 * happens server-side via the existing query params.
 */
export function AssignmentQueueContractList({ groups, buildAssignHref }: Props): React.JSX.Element {
  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-secondary">All generated workflow tasks are assigned.</p>
        <p className="text-xs text-text-muted mt-1">Use Workflow &amp; Team Tasks to monitor progress.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {groups.map((group) => (
        <AssignmentQueueContractCard key={group.contractId} group={group} assignHref={buildAssignHref(group.contractId)} />
      ))}
    </div>
  );
}
