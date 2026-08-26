import Link from 'next/link';
import { FilePlus2, Workflow, CalendarDays, ClipboardCheck } from 'lucide-react';

interface Props {
  canCreate: boolean;
  canClose: boolean;
}

const BASE_BUTTON = 'inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-focus';
const PRIMARY_BUTTON = `${BASE_BUTTON} bg-accent text-white hover:bg-accent/90`;
const SECONDARY_BUTTON = `${BASE_BUTTON} border border-border bg-surface text-text-primary hover:bg-surface-secondary`;

/** CM-39C — compact, evenly-sized action buttons in one tight row; wording unchanged (New Contract / Assign Tasks / Schedule / Closeout Requests). */
export function ManagerTopActions({ canCreate, canClose }: Props): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canCreate && (
        <Link href="/contracts/new" title="New Contract Register" className={PRIMARY_BUTTON}>
          <FilePlus2 className="size-3.5 shrink-0" aria-hidden="true" />
          New Contract
        </Link>
      )}
      <Link href="/contracts/workflow?mode=assignment" title="Assign Workflow Tasks" className={SECONDARY_BUTTON}>
        <Workflow className="size-3.5 shrink-0" aria-hidden="true" />
        Assign Tasks
      </Link>
      <Link href="/contracts/schedule" title="View Schedule" className={SECONDARY_BUTTON}>
        <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
        Schedule
      </Link>
      {canClose && (
        <Link href="/contracts/closeouts?pendingOnly=true" title="Review Closeout Requests" className={SECONDARY_BUTTON}>
          <ClipboardCheck className="size-3.5 shrink-0" aria-hidden="true" />
          Closeout Requests
        </Link>
      )}
    </div>
  );
}
