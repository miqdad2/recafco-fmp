import Link from 'next/link';
import { IncidentSeverityBadge } from './incident-severity-badge';
import { IncidentStatusBadge } from './incident-status-badge';
import type { IncidentDashboardData, IncidentStatus } from '../../../../lib/incidents-api';

interface Props {
  items: IncidentDashboardData['recent'];
  canCreate: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/**
 * FMP-UI-22 — the Incident Control Center's "Recent Incidents" section —
 * replaces the fully-removed "Recent Activity" table. Shows at most 3 of
 * `data.recent` (already sorted by `updatedAt desc` server-side, capped at
 * 8), each with reference number, title, severity/status badges, reported
 * date, and an "Open" button — mirrors `SafetyLatestRecordsList`'s
 * established shape (FMP-UI-21D).
 */
export function IncidentRecentList({ items, canCreate }: Props): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
        <p>No recent incidents in your scope.</p>
        {canCreate && <p className="mt-1">Report the first incident.</p>}
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
              <IncidentSeverityBadge severity={item.severity} />
              <IncidentStatusBadge status={item.status as IncidentStatus} />
            </div>
            <p className="text-sm font-medium text-text-primary">{item.title}</p>
            <p className="text-xs text-text-secondary">Reported {formatDate(item.createdAt)}</p>
          </div>
          <Link
            href={`/incidents/${item.id}`}
            className="inline-flex h-9 shrink-0 items-center rounded-md border border-border bg-surface px-3.5 text-sm font-semibold text-text-primary transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Open
          </Link>
        </li>
      ))}
    </ul>
  );
}
