import type { ContractScheduleOverviewStatus } from '@/lib/contracts-api';
import { SCHEDULE_STATUS_LABELS, SCHEDULE_STATUS_BADGE_CLASSES } from '../_lib/global-schedule-helpers';

export function GlobalScheduleStatusBadge({ status }: { status: ContractScheduleOverviewStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${SCHEDULE_STATUS_BADGE_CLASSES[status]}`}>
      {SCHEDULE_STATUS_LABELS[status]}
    </span>
  );
}
