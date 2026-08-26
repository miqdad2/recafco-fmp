import type { ScheduleItemType } from '@/lib/contracts-api';

const TYPE_LABELS: Record<ScheduleItemType, string> = {
  CONTRACT_START: 'Contract Start',
  CONTRACT_END: 'Contract End',
  FORECAST_COMPLETION: 'Forecast Completion',
  WORKFLOW_TASK: 'Workflow Task',
  ISSUE_DUE: 'Issue',
  CLAIM_DUE: 'Claim',
  PAYMENT_DUE: 'Payment',
  CLOSEOUT_REQUEST: 'Closeout Requested',
  CLOSEOUT_APPROVAL: 'Closeout Approved',
  CLOSEOUT_CLOSED: 'Contract Closed',
};

const TYPE_STYLES: Record<ScheduleItemType, string> = {
  CONTRACT_START: 'bg-surface-secondary text-text-secondary',
  CONTRACT_END: 'bg-surface-secondary text-text-secondary',
  FORECAST_COMPLETION: 'bg-surface-secondary text-text-secondary',
  WORKFLOW_TASK: 'bg-info-light text-info',
  ISSUE_DUE: 'bg-warning-light text-warning',
  CLAIM_DUE: 'bg-warning-light text-warning',
  PAYMENT_DUE: 'bg-accent/10 text-accent',
  CLOSEOUT_REQUEST: 'bg-success-light text-success',
  CLOSEOUT_APPROVAL: 'bg-success-light text-success',
  CLOSEOUT_CLOSED: 'bg-success-light text-success',
};

export function ScheduleItemTypeBadge({ type }: { type: ScheduleItemType }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TYPE_STYLES[type]}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

export const SCHEDULE_ITEM_TYPE_LABELS = TYPE_LABELS;
