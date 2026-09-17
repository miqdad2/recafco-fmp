import type { ErectionStartDisplayStatus } from '@/lib/contracts-api';
import {
  ERECTION_START_DISPLAY_LABELS,
  ERECTION_START_BADGE_CLASSES,
} from '../../_lib/contract-erection-dashboard-helpers';

interface Props {
  status: ErectionStartDisplayStatus;
}

/** CM-71F — Step 5's own erection-start status badge, mirrors ErectionDeliveryStartStatusBadge exactly. */
export function ErectionStartStatusBadge({ status }: Props): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${ERECTION_START_BADGE_CLASSES[status]}`}>
      {ERECTION_START_DISPLAY_LABELS[status]}
    </span>
  );
}
