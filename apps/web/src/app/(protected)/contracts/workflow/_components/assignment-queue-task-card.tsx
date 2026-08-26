import Link from 'next/link';
import type { WorkflowAssignmentQueueItem } from '@/lib/contracts-api';
import { WorkflowTaskStatusBadge } from './workflow-task-status-badge';
import { WorkflowTaskPriorityBadge } from './workflow-task-priority-badge';

interface Props {
  item: WorkflowAssignmentQueueItem;
  /** Team-accent top-border class, e.g. "border-t-info" — see TEAM_STYLES in assignment-queue-board.tsx. */
  accentBorderCls: string;
  onAssign: () => void;
  /** CM-40C — omits the contract reference/name/client lines when the card already sits inside a single contract's focused board, which shows that context once in its own header instead of repeating it per card. Defaults to false (unchanged behavior for the all-contracts board). */
  hideContractInfo?: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'No due date';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * CM-40B — one unassigned task, shown on the Kanban board. Deliberately a
 * plain (non-button) card with an explicit Assign action, unlike CM-32's
 * WorkflowTaskCard (which opens the full task drawer on click) — this card
 * has nothing else to open, only one action.
 */
export function AssignmentQueueTaskCard({ item, accentBorderCls, onAssign, hideContractInfo = false }: Props): React.JSX.Element {
  return (
    <div className={`rounded-md border border-border border-t-4 ${accentBorderCls} bg-surface p-2.5 space-y-1.5`}>
      {!hideContractInfo && (
        <>
          <Link href={`/contracts/workflow?contractId=${item.contractId}`} className="block font-mono text-xs text-accent hover:underline">
            {item.contractReference}
          </Link>
          <p className="text-xs font-medium text-text-primary truncate" title={item.contractTitle}>{item.contractTitle}</p>
          <p className="text-[11px] text-text-muted truncate" title={item.counterpartyName}>{item.counterpartyName}</p>
        </>
      )}
      <p className="text-xs text-text-secondary truncate" title={item.taskName}>{item.taskName}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <WorkflowTaskStatusBadge status={item.status} />
        <WorkflowTaskPriorityBadge priority={item.priority} />
      </div>

      <p className="text-[11px] text-text-muted">{formatDate(item.dueDate)}</p>

      <button
        type="button"
        onClick={onAssign}
        className="w-full inline-flex items-center justify-center rounded-md bg-accent/10 px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-focus"
      >
        Assign
      </button>
    </div>
  );
}
