import type { ErectionScheduleDisplayStatus } from '@/lib/contracts-api';
import {
  ERECTION_SCHEDULE_DISPLAY_LABELS,
  ERECTION_SCHEDULE_BADGE_CLASSES,
} from '../../_lib/contract-erection-dashboard-helpers';

interface Props {
  status: ErectionScheduleDisplayStatus;
}

/** CM-71D — Step 3's own schedule status badge, mirrors ErectionMethodStatementStatusBadge exactly. */
export function ErectionScheduleStatusBadge({ status }: Props): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${ERECTION_SCHEDULE_BADGE_CLASSES[status]}`}>
      {ERECTION_SCHEDULE_DISPLAY_LABELS[status]}
    </span>
  );
}
