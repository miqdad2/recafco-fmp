const TERMINAL_STATUS_WORDS = ['CLOSED', 'PAID', 'SETTLED', 'COMPLETED', 'APPROVED', 'CANCELLED', 'ENDED', 'REJECTED'];

function humanize(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

interface Props {
  status: string;
  isOverdue: boolean;
}

/**
 * A single generic badge shared across all 10 schedule item types (each with
 * its own distinct status vocabulary) rather than 10 separate per-type badge
 * components — colored primarily by isOverdue, with a light heuristic for
 * terminal-looking raw status values. Each source register already has its
 * own precise status badge (IssueStatusBadge, ClaimStatusBadge, etc.) for
 * when the user follows the action link to the source page.
 */
export function ScheduleStatusBadge({ status, isOverdue }: Props): React.JSX.Element {
  const isTerminal = TERMINAL_STATUS_WORDS.some((w) => status.toUpperCase().includes(w));
  const className = isOverdue
    ? 'bg-danger-light text-danger'
    : isTerminal
      ? 'bg-success-light text-success'
      : 'bg-surface-secondary text-text-secondary';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${className}`}>
      {humanize(status)}
    </span>
  );
}
