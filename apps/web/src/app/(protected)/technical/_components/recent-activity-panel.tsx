import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { TECHNICAL_STAGE_LABELS } from '@/lib/technical-api';
import type { TechnicalActivityFeedItem } from '@/lib/technical-api';
import { formatDateTime, stageBadgeClasses } from '../_lib/technical-format';

interface Props {
  activities: TechnicalActivityFeedItem[];
}

const EVENT_LABELS: Record<string, string> = {
  WORKFLOW_STARTED: 'Technical workflow started',
  DRAWING_PACKAGE_RECEIVED: 'Drawing package received',
  DETAILS_SAVED: 'Details saved',
  FILES_UPLOADED: 'Files uploaded',
  ATTACHMENT_REMOVED: 'File removed',
  CLARIFICATION_REQUESTED: 'Clarification requested',
  DRAWING_RECEIVED_COMPLETED: 'Step completed',
  // FMP-TECH-02
  SD_SUBMISSION_SAVED: 'Submission saved',
  SD_ATTACHMENTS_UPLOADED: 'Attachments uploaded',
  SD_CLARIFICATION_REQUESTED: 'Clarification requested',
  SD_CALCULATION_SUBMITTED: 'SD & Calculation submitted',
  SD_CALCULATION_STAGE_COMPLETED: 'Stage completed',
  // FMP-TECH-03
  APPROVAL_DETAILS_SAVED: 'Approval details saved',
  APPROVAL_ATTACHMENTS_UPLOADED: 'Attachments uploaded',
  APPROVAL_CLARIFICATION_REQUESTED: 'Clarification requested',
  CHANGES_REQUESTED: 'Changes requested',
  APPROVAL_RECEIVED: 'Approval received',
  REJECTED: 'Rejected',
  GETTING_APPROVAL_STAGE_COMPLETED: 'Stage completed',
  // FMP-TECH-04
  FD_DETAILS_SAVED: 'FD details saved',
  FD_ATTACHMENTS_UPLOADED: 'Attachments uploaded',
  FD_ISSUE_SUBMITTED: 'FD issue submitted',
  FD_RETURNED_REOPENED: 'Returned / reopened',
  TECHNICAL_WORKFLOW_COMPLETED: 'Technical workflow completed',
};

// A short list of events that represent a positive/terminal outcome for
// their stage — shown with a success-tinted label instead of the default
// neutral one, purely a visual read aid (no new data, no status change).
const POSITIVE_EVENTS = new Set([
  'DRAWING_RECEIVED_COMPLETED',
  'SD_CALCULATION_STAGE_COMPLETED',
  'APPROVAL_RECEIVED',
  'GETTING_APPROVAL_STAGE_COMPLETED',
  'TECHNICAL_WORKFLOW_COMPLETED',
]);
const WARNING_EVENTS = new Set(['CLARIFICATION_REQUESTED', 'SD_CLARIFICATION_REQUESTED', 'APPROVAL_CLARIFICATION_REQUESTED', 'CHANGES_REQUESTED', 'REJECTED', 'FD_RETURNED_REOPENED']);

function eventLabel(event: string): string {
  return EVENT_LABELS[event] ?? event;
}

function eventDotClasses(event: string): string {
  if (POSITIVE_EVENTS.has(event)) return 'bg-success-light';
  if (WARNING_EVENTS.has(event)) return 'bg-warning-light';
  return 'bg-accent-light';
}

function eventDotInnerClasses(event: string): string {
  if (POSITIVE_EVENTS.has(event)) return 'bg-success';
  if (WARNING_EVENTS.has(event)) return 'bg-warning';
  return 'bg-accent';
}

// FMP-TECH-01C, polished in FMP-TECH-05 — real technical_workflow_activities
// rows across every in-scope job order, newest first (TechnicalService.
// getDashboard already fetches and orders these) — never a "coming soon"
// placeholder, since the activity table has existed since FMP-TECH-01.
// Rendered as a connected timeline (dot + line, matching the same visual
// language as TechnicalActivityTimeline on each stage's own screen) rather
// than a flat list of rows.
export function RecentActivityPanel({ activities }: Props): React.JSX.Element {
  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">
        No Technical activity recorded yet.
      </div>
    );
  }

  return (
    <ol className="space-y-0">
      {activities.map((a, i) => (
        <li key={a.id} className="relative flex gap-3 pb-3.5 last:pb-0">
          {i < activities.length - 1 && (
            <span className="absolute left-[6.5px] top-5 bottom-0 w-px bg-border" aria-hidden="true" />
          )}
          <span className={`relative z-10 mt-1 flex size-3.5 shrink-0 items-center justify-center rounded-full ${eventDotClasses(a.event)}`}>
            <span className={`size-1.5 rounded-full ${eventDotInnerClasses(a.event)}`} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3.5 py-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-medium text-text-primary">{eventLabel(a.event)}</p>
              <Link
                href={`/technical/jobs/${a.contractId}`}
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-accent hover:underline"
              >
                Open
                <ArrowUpRight className="size-3" aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
              <span className="font-semibold text-text-secondary">{a.jobOrderNo ?? a.referenceNumber}</span>
              <span aria-hidden="true">·</span>
              <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${stageBadgeClasses(a.stage)}`}>
                {TECHNICAL_STAGE_LABELS[a.stage]}
              </span>
              <span aria-hidden="true">·</span>
              <span>{a.actorName ?? 'System'}</span>
              <span aria-hidden="true">·</span>
              <span>{formatDateTime(a.createdAt)}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
