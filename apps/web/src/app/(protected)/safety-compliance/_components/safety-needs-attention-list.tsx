import Link from 'next/link';
import { FindingSeverityBadge } from './finding-severity-badge';
import { FindingStatusBadge } from './finding-status-badge';
import type { SafetyNeedsAttentionItem } from '../../../../lib/safety-api';

interface Props {
  items: SafetyNeedsAttentionItem[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/**
 * FMP-UI-21 — the Safety Control Center's "Needs Attention" list. Each row
 * is a REAL finding (critical or overdue, per safety.service.ts's own
 * getDashboard() query) — reference number and title from its parent
 * inspection (findings have no reference number of their own), severity/
 * status badges reused verbatim from the finding detail view, due date if
 * set, and an explicit "Open Record" button (not just a clickable row) so
 * the action is never hidden or implied, per this unit's own accessibility
 * requirement. "Open Record" always routes to the parent inspection's
 * detail page — the only real place a finding can be reviewed or actioned.
 */
export function SafetyNeedsAttentionList({ items }: Props): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
        No critical or overdue safety items right now.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-text-muted">{item.inspectionReferenceNumber}</span>
              <FindingSeverityBadge severity={item.severity} />
              <FindingStatusBadge status={item.status} />
            </div>
            <p className="text-sm font-medium text-text-primary">{item.title}</p>
            {item.dueAt && (
              <p className="text-xs text-text-secondary">Due {formatDate(item.dueAt)}</p>
            )}
          </div>
          <Link
            href={`/safety-compliance/${item.inspectionId}`}
            className="inline-flex h-9 shrink-0 items-center rounded-md border border-border bg-surface px-3.5 text-sm font-semibold text-text-primary transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Open Record
          </Link>
        </li>
      ))}
    </ul>
  );
}
