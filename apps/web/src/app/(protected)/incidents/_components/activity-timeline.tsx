import type { IncidentActivity, IncidentStatus } from '../../../../lib/incidents-api';

const EVENT_LABELS: Record<string, string> = {
  INCIDENT_CREATED:      'Incident created',
  INCIDENT_REOPENED:     'Incident reopened',
  INCIDENT_CANCELLED:    'Incident cancelled',
  INVESTIGATOR_ASSIGNED: 'Investigator assigned',
  ACTION_ADDED:          'Corrective action added',
  ACTION_STATUS_CHANGED: 'Action status changed',
  COMMENT_ADDED:         'Comment posted',
  SEVERITY_CHANGED:      'Severity changed',
  INVESTIGATION_UPDATED: 'Investigation updated',
  ROOT_CAUSE_UPDATED:    'Root cause updated',
  // FMP-INC-01
  EVIDENCE_UPLOADED:     'Evidence uploaded',
  EVIDENCE_REMOVED:      'Evidence removed',
};

/**
 * FMP-INC-01E — every real status transition (submit, start review, begin
 * investigation, request corrective actions, resolve, close) logs the
 * SAME generic `STATUS_CHANGED` event server-side (see
 * `incidents.service.ts`'s own transition methods) — cancel/reopen are the
 * only 2 transitions with their own dedicated event keys. Without this
 * map, every one of those 6 real transitions would read as the identical,
 * unhelpful "Status changed" line. Keyed by the REAL `newStatus` value on
 * the activity row, matching the brief's own exact example wording
 * ("Incident submitted by manager") for the SUBMITTED case.
 */
const STATUS_CHANGE_LABELS: Partial<Record<IncidentStatus, string>> = {
  SUBMITTED: 'Incident submitted',
  UNDER_REVIEW: 'Review started',
  INVESTIGATION: 'Investigation started',
  ACTION_REQUIRED: 'Corrective action requested',
  RESOLVED: 'Incident resolved',
  CLOSED: 'Incident closed',
};

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Never a raw `STATUS_CHANGED`/`ACTION_ADDED`-style key — always a real, human sentence fragment. */
function labelForActivity(a: IncidentActivity): string {
  if (a.event === 'STATUS_CHANGED' && a.newStatus) {
    return STATUS_CHANGE_LABELS[a.newStatus as IncidentStatus] ?? `Status changed to ${toTitleCase(a.newStatus)}`;
  }
  return EVENT_LABELS[a.event] ?? toTitleCase(a.event);
}

interface Props {
  activities: IncidentActivity[];
}

/**
 * FMP-INC-01E — no longer merges in comments (was `activities` +
 * `comments` in one interleaved timeline) — the brief explicitly asks for
 * Activity and Comments as 2 separate cards ("Comments and activity feel
 * mixed together" was one of this unit's own named issues). Comments now
 * render in their own card in `[id]/page.tsx` directly, alongside
 * `AddCommentForm`. Every activity line renders as `"{label} by {actor}"`
 * (e.g. "Incident submitted by manager"), matching the brief's own exact
 * example wording for ALL 4 of its given cases ("Incident created by
 * manager", "Evidence uploaded by manager", "Incident submitted by
 * manager", "Incident cancelled by manager") — not just the 2 evidence
 * events FMP-INC-01 special-cased. That per-event special case is gone;
 * this is now the ONE convention every activity line uses.
 */
export function ActivityTimeline({ activities }: Props): React.JSX.Element {
  if (activities.length === 0) {
    return <p className="text-sm text-text-muted py-4">No activity yet.</p>;
  }

  return (
    <ol className="space-y-4" aria-label="Incident activity timeline">
      {activities.map((a) => {
        const label = labelForActivity(a);
        const actorName = a.actorName ?? 'System';

        let detail: string | null = null;
        if (a.event === 'STATUS_CHANGED' && a.previousStatus && a.newStatus) {
          detail = `${toTitleCase(a.previousStatus)} → ${toTitleCase(a.newStatus)}`;
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
                {label} by <span className="font-medium text-text-primary">{actorName}</span>
              </p>
              {detail && (
                <p className="text-xs text-text-muted mt-0.5">{detail}</p>
              )}
              <p className="text-xs text-text-muted mt-0.5">{formatDate(a.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
