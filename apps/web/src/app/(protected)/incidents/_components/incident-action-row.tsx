'use client';

import { useTransition } from 'react';
import { updateActionItemStatusAction } from '../actions';
import type { IncidentAction, IncidentActionStatus } from '../../../../lib/incidents-api';

const STATUS_NEXT: Partial<Record<IncidentActionStatus, IncidentActionStatus>> = {
  OPEN:        'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
};

const STATUS_LABELS: Record<IncidentActionStatus, string> = {
  OPEN:        'Open',
  IN_PROGRESS: 'In Progress',
  COMPLETED:   'Completed',
  CANCELLED:   'Cancelled',
};

const STATUS_STYLES: Record<IncidentActionStatus, string> = {
  OPEN:        'bg-surface-secondary text-text-muted',
  IN_PROGRESS: 'bg-warning-light text-warning',
  COMPLETED:   'bg-success-light text-success',
  CANCELLED:   'bg-surface-secondary text-text-muted',
};

interface Props {
  action: IncidentAction;
  incidentId: string;
  canUpdate: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function IncidentActionRow({ action, incidentId, canUpdate }: Props): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  const nextStatus = STATUS_NEXT[action.status];

  function handleAdvance(): void {
    if (!nextStatus) return;
    startTransition(async () => {
      await updateActionItemStatusAction(incidentId, action.id, nextStatus);
    });
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{action.title}</p>
        {action.description && (
          <p className="text-xs text-text-secondary mt-0.5">{action.description}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-muted">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[action.status]}`}
          >
            {STATUS_LABELS[action.status]}
          </span>
          {action.assignedToUser && (
            <span>Assigned: {action.assignedToUser.displayName}</span>
          )}
          {action.dueDate && (
            <span>Due: {formatDate(action.dueDate)}</span>
          )}
          {action.completedAt && action.completedByUser && (
            <span>Completed by {action.completedByUser.displayName} on {formatDate(action.completedAt)}</span>
          )}
        </div>
      </div>
      {canUpdate && nextStatus && (
        <button
          onClick={handleAdvance}
          disabled={isPending}
          className="shrink-0 rounded-md border border-border bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
        >
          {isPending ? 'Saving…' : `Mark ${STATUS_LABELS[nextStatus]}`}
        </button>
      )}
    </div>
  );
}
