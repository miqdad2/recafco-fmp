import Link from 'next/link';
import { IncidentSeverityBadge } from './incident-severity-badge';
import { IncidentStatusBadge } from './incident-status-badge';
import type { IncidentNeedsAttentionItem, IncidentStatus } from '../../../../lib/incidents-api';

interface Props {
  items: IncidentNeedsAttentionItem[];
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * FMP-UI-22 — the Incident Control Center's "Needs Attention" list. Each
 * row is a REAL incident that is both critical and currently open (per
 * incidents.service.ts's own getDashboard() query) — reference number,
 * title, severity/status badges, reported date/time, and an explicit
 * "Open Incident" button, mirroring `SafetyNeedsAttentionList`'s
 * established shape exactly (FMP-UI-21).
 */
export function IncidentNeedsAttentionList({ items }: Props): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
        No incidents currently need urgent attention.
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
              <span className="font-mono text-xs text-text-muted">{item.referenceNumber}</span>
              <IncidentSeverityBadge severity={item.severity} />
              <IncidentStatusBadge status={item.status as IncidentStatus} />
            </div>
            <p className="text-sm font-medium text-text-primary">{item.title}</p>
            <p className="text-xs text-text-secondary">Reported {formatDateTime(item.createdAt)}</p>
          </div>
          <Link
            href={`/incidents/${item.id}`}
            className="inline-flex h-9 shrink-0 items-center rounded-md border border-border bg-surface px-3.5 text-sm font-semibold text-text-primary transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Open Incident
          </Link>
        </li>
      ))}
    </ul>
  );
}
