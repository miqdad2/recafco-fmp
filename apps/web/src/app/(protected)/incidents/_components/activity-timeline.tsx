import type { IncidentActivity, IncidentComment } from '../../../../lib/incidents-api';

type TimelineItem =
  | { kind: 'activity'; data: IncidentActivity }
  | { kind: 'comment'; data: IncidentComment };

const EVENT_LABELS: Record<string, string> = {
  INCIDENT_CREATED:      'Incident created',
  STATUS_CHANGED:        'Status changed',
  INCIDENT_REOPENED:     'Incident reopened',
  INCIDENT_CANCELLED:    'Incident cancelled',
  INVESTIGATOR_ASSIGNED: 'Investigator assigned',
  ACTION_ADDED:          'Corrective action added',
  ACTION_STATUS_CHANGED: 'Action status changed',
  COMMENT_ADDED:         'Comment posted',
  SEVERITY_CHANGED:      'Severity changed',
  INVESTIGATION_UPDATED: 'Investigation updated',
  ROOT_CAUSE_UPDATED:    'Root cause updated',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface Props {
  activities: IncidentActivity[];
  comments: IncidentComment[];
}

export function ActivityTimeline({ activities, comments }: Props): React.JSX.Element {
  const items: TimelineItem[] = [
    ...activities.map((a) => ({ kind: 'activity' as const, data: a })),
    ...comments.map((c) => ({ kind: 'comment' as const, data: c })),
  ].sort((a, b) => new Date(a.data.createdAt).getTime() - new Date(b.data.createdAt).getTime());

  if (items.length === 0) {
    return <p className="text-sm text-text-muted py-4">No activity yet.</p>;
  }

  return (
    <ol className="space-y-4" aria-label="Incident activity timeline">
      {items.map((item) => {
        if (item.kind === 'activity') {
          const a = item.data;
          const label = EVENT_LABELS[a.event] ?? a.event.replace(/_/g, ' ').toLowerCase();
          const actorName = a.actorName ?? 'System';

          let detail: string | null = null;
          if (a.event === 'STATUS_CHANGED' && a.previousStatus && a.newStatus) {
            detail = `${a.previousStatus.replace(/_/g, ' ')} → ${a.newStatus.replace(/_/g, ' ')}`;
          } else if (a.event === 'SEVERITY_CHANGED' && a.metadata) {
            const m = a.metadata as { previousSeverity?: string; newSeverity?: string };
            detail = `${m.previousSeverity ?? '?'} → ${m.newSeverity ?? '?'}`;
          } else if (a.event === 'INCIDENT_REOPENED' && a.metadata) {
            const m = a.metadata as { reason?: string };
            detail = m.reason ? `Reason: ${m.reason}` : null;
          }

          return (
            <li key={a.id} className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-text-muted text-xs" aria-hidden="true">
                ●
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">{actorName}</span>
                  {' '}{label}
                </p>
                {detail && (
                  <p className="text-xs text-text-muted font-mono mt-0.5">{detail}</p>
                )}
                <p className="text-xs text-text-muted mt-0.5">{formatDate(a.createdAt)}</p>
              </div>
            </li>
          );
        }

        const c = item.data;
        return (
          <li key={c.id} className="flex gap-3">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-semibold" aria-hidden="true">
              {c.authorUser.displayName.charAt(0).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0 rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-medium text-text-primary">{c.authorUser.displayName}</span>
                <span className="text-xs text-text-muted shrink-0">{formatDate(c.createdAt)}</span>
              </div>
              <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{c.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
