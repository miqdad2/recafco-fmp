import { formatActivityEventLabel, toTitleCase } from '../_lib/safety-detail-helpers';
import type { InspectionActivity } from '../../../../lib/safety-api';

interface Props {
  activities: InspectionActivity[];
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * FMP-UI-21D — the Inspection Detail page's Activity list used to render
 * raw event keys directly (`{a.event.replace(/_/g, ' ')}`, e.g. "manager —
 * INSPECTION CREATED → DRAFT"), per direct feedback that this reads as
 * "technical wording". Each line is now `{label} by {actor}` (a real
 * sentence, via `formatActivityEventLabel()`), with the resulting status —
 * only when the event actually changed one — on its own line in Title
 * Case (e.g. "Status: Draft"), matching the brief's own example exactly:
 * "Inspection created by manager / Status: Draft / 28 Sept 2026, 11:30".
 */
export function SafetyActivityTimeline({ activities }: Props): React.JSX.Element {
  if (activities.length === 0) {
    return <p className="text-sm text-text-muted">No activity recorded yet.</p>;
  }

  return (
    <ol className="space-y-3" aria-label="Inspection activity timeline">
      {activities.map((a) => (
        <li key={a.id} className="flex gap-3">
          <div className="shrink-0 mt-1.5 size-2 rounded-full bg-border-strong" aria-hidden="true" />
          <div>
            <p className="text-sm text-text-primary">
              {formatActivityEventLabel(a.event)} by <span className="font-medium">{a.actorName ?? 'System'}</span>
            </p>
            {a.newStatus && (
              <p className="text-sm text-text-secondary">Status: {toTitleCase(a.newStatus)}</p>
            )}
            <p className="text-xs text-text-muted">{formatDateTime(a.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
