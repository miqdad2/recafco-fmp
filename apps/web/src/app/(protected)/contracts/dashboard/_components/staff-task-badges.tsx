// ---------------------------------------------------------------------------
// CM-47 — small status/priority badges for the plain `string`-typed status
// and priority fields on StaffTaskRow (the dashboard's own DTO, distinct
// from ContractWorkflowTask's narrower enum type). The workflow module's
// own WorkflowTaskStatusBadge/WorkflowTaskPriorityBadge require the
// narrower enum type, so this file — following the same local-style-map
// approach staff-task-table.tsx already used since CM-44 — keeps this
// dashboard's badges self-contained rather than casting types to reuse
// components built for a different DTO.
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  NOT_STARTED: 'bg-surface-secondary text-text-secondary',
  IN_PROGRESS: 'bg-info-light text-info',
  SUBMITTED: 'bg-info-light text-info',
  UNDER_REVIEW: 'bg-warning-light text-warning',
  APPROVED: 'bg-success-light text-success',
  REJECTED: 'bg-error-light text-error',
  COMPLETED: 'bg-success-light text-success',
  ON_HOLD: 'bg-surface-secondary text-text-secondary',
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-surface-secondary text-text-muted',
  MEDIUM: 'bg-surface-secondary text-text-secondary',
  HIGH: 'bg-warning-light text-warning',
  CRITICAL: 'bg-error-light text-error',
};

export function StaffTaskStatusBadge({ status }: { status: string }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${STATUS_STYLES[status] ?? 'bg-surface-secondary text-text-secondary'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function StaffTaskPriorityBadge({ priority }: { priority: string }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${PRIORITY_STYLES[priority] ?? 'bg-surface-secondary text-text-secondary'}`}>
      {priority}
    </span>
  );
}
