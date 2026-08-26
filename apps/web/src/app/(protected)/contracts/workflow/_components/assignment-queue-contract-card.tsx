import Link from 'next/link';
import type { AssignmentQueueContractGroup } from '../../_lib/assignment-queue-grouping';

interface Props {
  group: AssignmentQueueContractGroup;
  /** Navigates into this contract's focused assignment board (?mode=assignment&contractId=...), preserving active filters. */
  assignHref: string;
}

const TEAM_LABELS: Record<string, string> = {
  TECHNICAL: 'Technical',
  PRODUCTION: 'Production',
  ERECTION: 'Erection',
  QS_COMMERCIAL: 'QS / Commercial',
};

// Same subtle team-accent tokens as the Kanban board (assignment-queue-board.tsx) —
// info/team-production/warning/success, never raw Tailwind colors, per ui-tokens.md.
const TEAM_BADGE_STYLES: Record<string, string> = {
  TECHNICAL: 'bg-info-light text-info',
  PRODUCTION: 'bg-team-production-light text-team-production',
  ERECTION: 'bg-warning-light text-warning',
  QS_COMMERCIAL: 'bg-success-light text-success',
};

/**
 * CM-40C — one contract on the contract-first Assignment Queue landing view.
 * The reference links to the ordinary "All Workflows" board (full task list,
 * assigned and unassigned) for a quick look; "Assign Tasks" is the primary
 * action, entering this contract's focused unassigned-only board.
 * CM-40D — kept compact (fixed line-clamped fields, one action) and swapped
 * the plain comma-joined team text for small team badges.
 */
export function AssignmentQueueContractCard({ group, assignHref }: Props): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface p-3.5 flex flex-col gap-2">
      <div className="min-w-0">
        <Link href={`/contracts/workflow?contractId=${group.contractId}`} className="font-mono text-xs text-accent hover:underline">
          {group.contractReference}
        </Link>
        <p className="text-sm font-medium text-text-primary mt-0.5 truncate" title={group.contractTitle}>
          {group.contractTitle}
        </p>
        <p className="text-xs text-text-muted truncate" title={group.counterpartyName}>
          Client: {group.counterpartyName}
        </p>
      </div>

      <p className="text-xs text-text-secondary">
        <span className="font-semibold text-text-primary">{group.unassignedCount}</span> unassigned task{group.unassignedCount === 1 ? '' : 's'}
      </p>

      {group.teams.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {group.teams.map((t) => (
            <span key={t} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${TEAM_BADGE_STYLES[t] ?? 'bg-surface-secondary text-text-secondary'}`}>
              {TEAM_LABELS[t] ?? t}
            </span>
          ))}
        </div>
      )}

      <Link
        href={assignHref}
        className="mt-1 inline-flex items-center justify-center rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
      >
        Assign Tasks
      </Link>
    </div>
  );
}
