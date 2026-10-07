import type { FactoryTaskActivity, FactoryTaskComment } from '../../../../lib/factory-tasks-api';

// FMP-UI-20E — activity phrasing changed from "{actor} {event label}" (e.g.
// "manager Task created", read as run-on/awkward) to "{event label} by
// {actor}" (e.g. "Task created by manager"), per direct feedback. Raw
// event keys were already converted via EVENT_LABELS before this unit —
// only the WORD ORDER changed, not the label text itself.

type TimelineItem =
  | { kind: 'activity'; data: FactoryTaskActivity }
  | { kind: 'comment'; data: FactoryTaskComment };

const EVENT_LABELS: Record<string, string> = {
  TASK_CREATED:        'Task created',
  TASK_OPENED:         'Task opened',
  TASK_ASSIGNED:       'Task assigned',
  TASK_UNASSIGNED:     'Task unassigned',
  TASK_STARTED:        'Work started',
  TASK_BLOCKED:        'Task blocked',
  TASK_UNBLOCKED:      'Task unblocked',
  TASK_COMPLETED:      'Task completed',
  TASK_CLOSED:         'Task closed',
  TASK_REOPENED:       'Task reopened',
  TASK_CANCELLED:      'Task cancelled',
  TASK_PRIORITY_CHANGED: 'Priority changed',
  TASK_DUE_DATE_CHANGED: 'Due date changed',
  TASK_UPDATED:        'Task updated',
  PROGRESS_ADDED:      'Progress note added',
  COMMENT_ADDED:       'Comment posted',
  TASK_ATTACHMENT_UPLOADED: 'File uploaded',
  TASK_ATTACHMENT_DELETED:  'File removed',
};

const PRIORITY_WORDS: Record<string, string> = { LOW: 'Low', MEDIUM: 'Normal', HIGH: 'High', URGENT: 'Urgent' };

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface Props {
  activities: FactoryTaskActivity[];
  comments: FactoryTaskComment[];
}

export function TaskActivityTimeline({ activities, comments }: Props): React.JSX.Element {
  const items: TimelineItem[] = [
    ...activities.map((a) => ({ kind: 'activity' as const, data: a })),
    ...comments.map((c) => ({ kind: 'comment' as const, data: c })),
  ].sort((a, b) => new Date(a.data.createdAt).getTime() - new Date(b.data.createdAt).getTime());

  if (items.length === 0) {
    return <p className="text-sm text-text-muted py-4">Nothing has happened on this task yet.</p>;
  }

  return (
    <ol className="space-y-4" aria-label="Task history">
      {items.map((item) => {
        if (item.kind === 'activity') {
          const a = item.data;
          const label = EVENT_LABELS[a.event] ?? a.event.replace(/_/g, ' ').toLowerCase();
          const actorName = a.actorName ?? 'System';

          // Plain-language detail only; raw status transitions (e.g. ASSIGNED -> IN PROGRESS) are not shown.
          let detail: string | null = null;
          if (a.event === 'TASK_ASSIGNED' && a.metadata) {
            const m = a.metadata as { assignedToName?: string };
            detail = m.assignedToName ? `Assigned to ${m.assignedToName}` : null;
          } else if (a.event === 'TASK_PRIORITY_CHANGED' && a.metadata) {
            const m = a.metadata as { newPriority?: string };
            detail = m.newPriority ? `Priority is now ${PRIORITY_WORDS[m.newPriority] ?? m.newPriority}` : null;
          } else if (a.event === 'TASK_ATTACHMENT_UPLOADED' && a.metadata) {
            const m = a.metadata as { fileName?: string };
            detail = m.fileName ?? null;
          } else if ((a.event === 'TASK_REOPENED' || a.event === 'TASK_CANCELLED') && a.metadata) {
            const m = a.metadata as { hasReason?: boolean };
            detail = m.hasReason ? 'A reason was added' : null;
          }

          return (
            <li key={a.id} className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-text-muted text-xs" aria-hidden="true">
                ●
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-base text-text-secondary">
                  {label}{' by '}
                  <span className="font-medium text-text-primary">{actorName}</span>
                </p>
                {detail && (
                  <p className="text-sm text-text-secondary mt-0.5 break-words">{detail}</p>
                )}
                <p className="text-sm text-text-muted mt-0.5">{formatDate(a.createdAt)}</p>
              </div>
            </li>
          );
        }

        const c = item.data;
        const initial = (c.authorUser?.displayName ?? '?').charAt(0).toUpperCase();
        return (
          <li key={c.id} className="flex gap-3">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-semibold" aria-hidden="true">
              {initial}
            </span>
            <div className="flex-1 min-w-0 rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-base font-medium text-text-primary">
                  {c.authorUser?.displayName ?? 'Unknown'}
                </span>
                <span className="text-sm text-text-muted shrink-0">{formatDate(c.createdAt)}</span>
              </div>
              <p className="text-base text-text-secondary whitespace-pre-wrap break-words">{c.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
