import type { TechnicalActivity } from '@/lib/technical-api';
import { formatDateTime } from '../../../../../_lib/technical-format';

interface Props {
  activities: TechnicalActivity[];
  /** FMP-TECH-05C — when true, renders without its own outer card/heading, so it can nest inside Drawing Received's combined "Workflow Panel" without a double-border look. Defaults to false everywhere, so the other 3 stage screens (which don't pass this prop) render byte-for-byte the same as before. */
  bare?: boolean;
}

const EVENT_LABELS: Record<string, string> = {
  WORKFLOW_STARTED: 'Technical workflow started',
  DRAWING_PACKAGE_RECEIVED: 'Drawing package received',
  DETAILS_SAVED: 'Details saved',
  FILES_UPLOADED: 'Files uploaded',
  ATTACHMENT_REMOVED: 'File removed',
  CLARIFICATION_REQUESTED: 'Clarification requested',
  DRAWING_RECEIVED_COMPLETED: 'Step completed',
  // FMP-TECH-02 — this timeline is reused as-is on the SD & Calculation
  // Submission screen too (activities are scoped per-workflow, not
  // per-stage), so its event labels need to cover both stages' events.
  SD_SUBMISSION_SAVED: 'Submission saved',
  SD_ATTACHMENTS_UPLOADED: 'Attachments uploaded',
  SD_CLARIFICATION_REQUESTED: 'Clarification requested',
  SD_CALCULATION_SUBMITTED: 'SD & Calculation submitted',
  SD_CALCULATION_STAGE_COMPLETED: 'Stage completed',
  // FMP-TECH-03 — also reused as-is on the Getting Approval screen.
  APPROVAL_DETAILS_SAVED: 'Approval details saved',
  APPROVAL_ATTACHMENTS_UPLOADED: 'Attachments uploaded',
  APPROVAL_CLARIFICATION_REQUESTED: 'Clarification requested',
  CHANGES_REQUESTED: 'Changes requested',
  APPROVAL_RECEIVED: 'Approval received',
  REJECTED: 'Rejected',
  GETTING_APPROVAL_STAGE_COMPLETED: 'Stage completed',
  // FMP-TECH-04 — also reused as-is on the FD Issuance screen (the final stage).
  FD_DETAILS_SAVED: 'FD details saved',
  FD_ATTACHMENTS_UPLOADED: 'Attachments uploaded',
  FD_ISSUE_SUBMITTED: 'FD issue submitted',
  FD_RETURNED_REOPENED: 'Returned / reopened',
  TECHNICAL_WORKFLOW_COMPLETED: 'Technical workflow completed',
};

function eventLabel(event: string): string {
  return EVENT_LABELS[event] ?? event;
}

// FMP-TECH-01 — real activity records only (TechnicalWorkflowActivity rows
// written by TechnicalService as each real action happens) — never a
// fabricated/sample timeline.
export function TechnicalActivityTimeline({ activities, bare = false }: Props): React.JSX.Element {
  const list =
    activities.length === 0 ? (
      <p className={bare ? 'text-sm text-text-muted' : 'mt-3 text-sm text-text-muted'}>No activity recorded yet.</p>
    ) : (
      <ol className={bare ? 'space-y-2.5' : 'mt-3 space-y-3'}>
        {activities.map((activity) => (
          <li key={activity.id} className="flex gap-2.5 text-sm">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            <div>
              <p className="font-medium text-text-primary">{eventLabel(activity.event)}</p>
              <p className="text-xs text-text-muted">
                {activity.actorName ?? 'System'} · {formatDateTime(activity.createdAt)}
              </p>
              {activity.event === 'CLARIFICATION_REQUESTED' && typeof activity.metadata?.['note'] === 'string' && (
                <p className="mt-0.5 text-xs text-text-secondary">&ldquo;{activity.metadata['note']}&rdquo;</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    );

  if (bare) return list;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Activity Timeline</h2>
      {list}
    </div>
  );
}
