import Link from 'next/link';
import { InspectionStatusBadge } from './inspection-status-badge';
import type { InspectionStatus, SafetyDashboardData } from '../../../../lib/safety-api';

interface Props {
  items: SafetyDashboardData['recent'];
  canCreate: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/**
 * FMP-UI-21D — the Safety Control Center's "Latest Safety Records" section
 * (the brief's own required replacement for the fully-removed "Recent
 * Activity"). Shows at most 3 of `data.recent` (already sorted by
 * `updatedAt desc` server-side, capped at 8 — this list slices to the
 * brief's own required max of 3), each with reference number, title,
 * status badge, department (or "Not specified"), scheduled date (or
 * "Not scheduled"), and an explicit "Open Record" button — matching
 * `SafetyNeedsAttentionList`'s own established shape exactly.
 */
export function SafetyLatestRecordsList({ items, canCreate }: Props): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
        <p>No safety inspections yet.</p>
        {canCreate && <p className="mt-1">Create your first safety inspection.</p>}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.slice(0, 3).map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-text-muted">{item.referenceNumber}</span>
              <InspectionStatusBadge status={item.status as InspectionStatus} />
            </div>
            <p className="text-sm font-medium text-text-primary">{item.title}</p>
            <p className="text-xs text-text-secondary">
              {item.departmentName ?? 'Not specified'} · {item.scheduledAt ? formatDate(item.scheduledAt) : 'Not scheduled'}
            </p>
          </div>
          <Link
            href={`/safety-compliance/${item.id}`}
            className="inline-flex h-9 shrink-0 items-center rounded-md border border-border bg-surface px-3.5 text-sm font-semibold text-text-primary transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Open Record
          </Link>
        </li>
      ))}
    </ul>
  );
}
